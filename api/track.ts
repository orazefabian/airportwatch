import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import { getAccessToken } from "../server/src/auth";
import * as cache from "../server/src/cache";
import type { LiveAircraftState } from "../server/src/types";

const OPENSKY_BASE = "https://opensky-network.org/api";

async function openskyGet(path: string, params: Record<string, unknown>): Promise<unknown> {
  const token = await getAccessToken();
  const response = await axios.get(`${OPENSKY_BASE}${path}`, {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

type OpenSkyStateRow = [
  string,        // 0: icao24
  string,        // 1: callsign
  string,        // 2: origin_country
  number,        // 3: time_position
  number,        // 4: last_contact
  number,        // 5: longitude
  number,        // 6: latitude
  number | null, // 7: altitude
  boolean,       // 8: on_ground
  number | null, // 9: velocity
  number | null, // 10: heading
  number | null, // 11: vertical_rate
  null,          // 12: sensors
  null,          // 13: geo_altitude
  string | null, // 14: squawk
  boolean,       // 15: spi
  number,        // 16: position_source
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const { icao24 } = req.query;
  if (!icao24) return res.json([]);

  const cacheKey = `track:${icao24}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await openskyGet("/states/all", { icao24 }) as { states?: OpenSkyStateRow[] } | null;
    const states: LiveAircraftState[] = (data?.states || []).map((s) => ({
      icao24:         s[0],
      callsign:       (s[1] || "").trim(),
      origin_country: s[2],
      last_contact:   s[4],
      longitude:      s[5],
      latitude:       s[6],
      altitude:       s[7],
      on_ground:      s[8],
      velocity:       s[9],
      heading:        s[10],
      vertical_rate:  s[11],
      squawk:         s[14],
    }));
    cache.set(cacheKey, states);
    res.json(states);
  } catch (err: unknown) {
    const error = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
    const status  = error.response?.status  || 500;
    const message = error.response?.data?.message || error.message || "Internal server error";
    res.status(status).json({ error: message });
  }
}
