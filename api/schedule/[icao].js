const cache = require("../../server/src/cache");
const AIRPORTS = require("../../server/src/airports");
const { fetchSchedule } = require("../../server/src/aerodatabox");
const { getCoords } = require("../../server/src/airportCoords");

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

const SCHEDULE_TTL  = 15 * 60 * 1000;
const WINDOW_OPTIONS = new Set([2, 4, 8, 12, 24]);

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const icao        = (req.query.icao || "").toUpperCase();
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
    const status  = err.response?.status || 500;
    const message = err.response?.data?.message || err.message || "Internal server error";
    res.status(status).json({ error: message });
  }
};
