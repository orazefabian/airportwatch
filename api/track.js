const axios = require("axios");
const { getAccessToken } = require("../server/src/auth");
const cache = require("../server/src/cache");

const OPENSKY_BASE = "https://opensky-network.org/api";

async function openskyGet(path, params) {
  const token = await getAccessToken();
  const response = await axios.get(`${OPENSKY_BASE}${path}`, {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

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
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.message || "Internal server error";
    res.status(status).json({ error: message });
  }
};
