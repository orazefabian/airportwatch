const express = require("express");
const axios = require("axios");
const { getAccessToken } = require("../auth");
const cache = require("../cache");
const AIRPORTS = require("../airports");
const { fetchSchedule } = require("../aerodatabox");
const { getCoords } = require("../airportCoords");

const router = express.Router();
const OPENSKY_BASE = "https://opensky-network.org/api";

async function openskyGet(path, params) {
  const token = await getAccessToken();
  try {
    const response = await axios.get(`${OPENSKY_BASE}${path}`, {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (err) {
    // OpenSky returns 404 when no data exists for the query (e.g. no flights in window)
    if (err.response?.status === 404) return null;
    throw err;
  }
}

// GET /api/airports
router.get("/airports", (req, res) => {
  res.json(AIRPORTS);
});

// OpenSky enforces a hard 1-hour max per request on the flights endpoints.
// We fan out across N sequential 1-hour windows and merge the results.
const HOURS_BACK = 8;

async function fetchFlightWindows(path, icao) {
  const now = Math.floor(Date.now() / 1000);
  const windows = [];
  for (let i = 0; i < HOURS_BACK; i++) {
    windows.push({ begin: now - (i + 1) * 3600, end: now - i * 3600 });
  }

  const results = await Promise.all(
    windows.map((w) => openskyGet(path, { airport: icao, begin: w.begin, end: w.end }))
  );

  // Flatten and deduplicate by icao24+firstSeen
  const seen = new Set();
  const flights = [];
  for (const batch of results) {
    for (const f of batch || []) {
      const key = `${f.icao24}:${f.firstSeen}`;
      if (!seen.has(key)) {
        seen.add(key);
        flights.push(f);
      }
    }
  }
  return flights.sort((a, b) => b.lastSeen - a.lastSeen);
}

// GET /api/flights/:icao
router.get("/flights/:icao", async (req, res, next) => {
  const icao = req.params.icao.toUpperCase();
  const cacheKey = `flights:${icao}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const [arrivals, departures] = await Promise.all([
      fetchFlightWindows("/flights/arrival", icao),
      fetchFlightWindows("/flights/departure", icao),
    ]);

    const result = { arrivals, departures };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/live/:icao
router.get("/live/:icao", async (req, res, next) => {
  const icao = req.params.icao.toUpperCase();
  const airport = AIRPORTS.find((a) => a.icao === icao);

  if (!airport) {
    return res.status(404).json({ error: `Airport ${icao} not found` });
  }

  const cacheKey = `live:${icao}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const delta = 2.5; // ~275 km — catches aircraft on approach/departure paths
  const { lat, lon } = airport;

  try {
    const data = await openskyGet("/states/all", {
      lamin: lat - delta,
      lamax: lat + delta,
      lomin: lon - delta,
      lomax: lon + delta,
    });

    const states = (data?.states || []).map((s) => ({
      icao24: s[0],
      callsign: (s[1] || "").trim(),
      origin_country: s[2],
      last_contact: s[4],
      longitude: s[5],
      latitude: s[6],
      altitude: s[7],
      on_ground: s[8],
      velocity: s[9],
      heading: s[10],
      vertical_rate: s[11],
      squawk: s[14],
    }));

    cache.set(cacheKey, states);
    res.json(states);
  } catch (err) {
    next(err);
  }
});

function enrichAirport(airport) {
  if (!airport) return airport;
  const c = getCoords(airport.icao);
  return c ? { ...airport, lat: c.lat, lon: c.lon } : airport;
}

function inferStatus(flight, isArrival) {
  if (flight.status !== "Expected" && flight.status !== "Scheduled") return flight;
  const utcStr = isArrival
    ? flight.arrival?.scheduledTime?.utc
    : flight.departure?.scheduledTime?.utc;
  if (!utcStr) return flight;
  const scheduled = new Date(utcStr.replace(" ", "T").replace(/Z$/, "+00:00"));
  if (scheduled < new Date()) {
    return { ...flight, status: isArrival ? "Arrived" : "Departed" };
  }
  return flight;
}

function enrichSchedule(data) {
  const enrich = (flights, isArrival) =>
    (flights || []).map((f) => {
      const enriched = {
        ...f,
        departure: f.departure ? { ...f.departure, airport: enrichAirport(f.departure.airport) } : f.departure,
        arrival:   f.arrival   ? { ...f.arrival,   airport: enrichAirport(f.arrival.airport)   } : f.arrival,
      };
      return inferStatus(enriched, isArrival);
    });
  return { arrivals: enrich(data.arrivals, true), departures: enrich(data.departures, false) };
}

// Splits any ±windowHours range into ≤12h AeroDataBox chunks (API max per call).
// Sequential with 1.1s gaps to respect the per-second rate limit.
const CHUNK_H = 12 * 3600 * 1000;

async function fetchScheduleChunked(icao, tz, hoursBack, hoursForward) {
  const now  = Date.now();
  const from = now - hoursBack    * 3600 * 1000;
  const to   = now + hoursForward * 3600 * 1000;

  const chunks = [];
  for (let t = from; t < to; t += CHUNK_H) {
    chunks.push({ from: new Date(t), to: new Date(Math.min(t + CHUNK_H, to)) });
  }

  const seenArr = new Set(), seenDep = new Set();
  const arrivals = [], departures = [];

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    const batch = await fetchSchedule(icao, tz, chunks[i].from, chunks[i].to);
    for (const f of batch.arrivals   || []) { const k = f.number || JSON.stringify(f); if (!seenArr.has(k)) { seenArr.add(k); arrivals.push(f); } }
    for (const f of batch.departures || []) { const k = f.number || JSON.stringify(f); if (!seenDep.has(k)) { seenDep.add(k); departures.push(f); } }
  }

  return { arrivals, departures };
}

// GET /api/schedule/:icao — AeroDataBox flight schedule (arrivals + departures)
// ?window=N means ±N hours (symmetric around now). Options: 2, 4, 8, 12, 24.
const SCHEDULE_TTL  = 15 * 60 * 1000;
const WINDOW_OPTIONS = new Set([2, 4, 8, 12, 24]);

router.get("/schedule/:icao", async (req, res, next) => {
  const icao        = req.params.icao.toUpperCase();
  const windowHours = WINDOW_OPTIONS.has(Number(req.query.window)) ? Number(req.query.window) : 4;

  const cacheKey = `schedule:${icao}:${windowHours}`;
  const cached   = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const airport = AIRPORTS.find((a) => a.icao === icao);
  const tz      = airport?.tz || "UTC";

  try {
    const raw  = await fetchScheduleChunked(icao, tz, windowHours, windowHours);
    const data = enrichSchedule(raw);
    cache.set(cacheKey, data, SCHEDULE_TTL);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/track?icao24=abc123,def456 — fetch current states for specific transponder codes
// This finds scheduled aircraft anywhere in the world, not just near the airport.
router.get("/track", async (req, res, next) => {
  const { icao24 } = req.query;
  if (!icao24) return res.json([]);

  const cacheKey = `track:${icao24}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await openskyGet("/states/all", { icao24 });
    const states = (data?.states || []).map((s) => ({
      icao24: s[0],
      callsign: (s[1] || "").trim(),
      origin_country: s[2],
      last_contact: s[4],
      longitude: s[5],
      latitude: s[6],
      altitude: s[7],
      on_ground: s[8],
      velocity: s[9],
      heading: s[10],
      vertical_rate: s[11],
      squawk: s[14],
    }));
    cache.set(cacheKey, states);
    res.json(states);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
