import express, { Request, Response, NextFunction } from "express";
import axios from "axios";
import { getAccessToken } from "../auth";
import * as cache from "../cache";
import AIRPORTS from "../airports";
import { enrichSchedule, fetchScheduleChunked, SCHEDULE_TTL, WINDOW_OPTIONS } from "../scheduleUtils";
import type { LiveAircraftState } from "../types";

const router = express.Router();
const OPENSKY_BASE = "https://opensky-network.org/api";

interface OpenSkyStateArray extends Array<unknown> {
  0: string;       // icao24
  1: string;       // callsign
  2: string;       // origin_country
  4: number;       // last_contact
  5: number;       // longitude
  6: number;       // latitude
  7: number | null;// altitude
  8: boolean;      // on_ground
  9: number | null;// velocity
  10: number | null;// heading
  11: number | null;// vertical_rate
  14: string | null;// squawk
}

async function openskyGet(path: string, params: Record<string, unknown>): Promise<unknown> {
  const token = await getAccessToken();
  try {
    const response = await axios.get(`${OPENSKY_BASE}${path}`, {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (err: unknown) {
    // OpenSky returns 404 when no data exists for the query
    if (
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      (err as { response?: { status?: number } }).response?.status === 404
    ) return null;
    throw err;
  }
}

router.get("/airports", (_req: Request, res: Response) => {
  res.json(AIRPORTS);
});

const HOURS_BACK = 8;

interface OpenSkyFlight {
  icao24: string;
  firstSeen: number;
  lastSeen: number;
  callsign: string;
  estArrivalAirport: string;
  estDepartureAirport: string;
}

async function fetchFlightWindows(path: string, icao: string): Promise<OpenSkyFlight[]> {
  const now = Math.floor(Date.now() / 1000);
  const windows = [];
  for (let i = 0; i < HOURS_BACK; i++) {
    windows.push({ begin: now - (i + 1) * 3600, end: now - i * 3600 });
  }

  const results = await Promise.all(
    windows.map((w) => openskyGet(path, { airport: icao, begin: w.begin, end: w.end }))
  );

  const seen = new Set<string>();
  const flights: OpenSkyFlight[] = [];
  for (const batch of results) {
    for (const f of (batch as OpenSkyFlight[] | null) || []) {
      const key = `${f.icao24}:${f.firstSeen}`;
      if (!seen.has(key)) {
        seen.add(key);
        flights.push(f);
      }
    }
  }
  return flights.sort((a, b) => b.lastSeen - a.lastSeen);
}

router.get("/flights/:icao", async (req: Request, res: Response, next: NextFunction) => {
  const icao = (req.params.icao as string).toUpperCase();
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

router.get("/live/:icao", async (req: Request, res: Response, next: NextFunction) => {
  const icao = (req.params.icao as string).toUpperCase();
  const airport = AIRPORTS.find((a) => a.icao === icao);

  if (!airport) {
    return res.status(404).json({ error: `Airport ${icao} not found` });
  }

  const cacheKey = `live:${icao}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const delta = 2.5;
  const { lat, lon } = airport;

  try {
    const data = await openskyGet("/states/all", {
      lamin: lat - delta, lamax: lat + delta,
      lomin: lon - delta, lomax: lon + delta,
    }) as { states?: OpenSkyStateArray[] } | null;

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
  } catch (err) {
    next(err);
  }
});

router.get("/schedule/:icao", async (req: Request, res: Response, next: NextFunction) => {
  const icao        = (req.params.icao as string).toUpperCase();
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

router.get("/track", async (req: Request, res: Response, next: NextFunction) => {
  const { icao24 } = req.query;
  if (!icao24) return res.json([]);

  const cacheKey = `track:${icao24}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const data = await openskyGet("/states/all", { icao24 }) as { states?: OpenSkyStateArray[] } | null;
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
  } catch (err) {
    next(err);
  }
});

export default router;
