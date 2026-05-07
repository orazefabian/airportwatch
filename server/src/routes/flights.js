const express = require("express");
const axios = require("axios");
const { getAccessToken } = require("../auth");
const cache = require("../cache");
const AIRPORTS = require("../airports");

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

// GET /api/flights/:icao
router.get("/flights/:icao", async (req, res, next) => {
  const icao = req.params.icao.toUpperCase();
  const cacheKey = `flights:${icao}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const now = Math.floor(Date.now() / 1000);
  const begin = now - 2 * 60 * 60; // 2 hours ago
  const end = now;

  try {
    const [arrivalsData, departuresData] = await Promise.all([
      openskyGet("/flights/arrival", { airport: icao, begin, end }),
      openskyGet("/flights/departure", { airport: icao, begin, end }),
    ]);

    const result = {
      arrivals: arrivalsData || [],
      departures: departuresData || [],
    };

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

module.exports = router;
