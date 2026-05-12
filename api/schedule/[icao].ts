import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as cache from "../../server/src/cache";
import AIRPORTS from "../../server/src/airports";
import { enrichSchedule, fetchScheduleChunked, SCHEDULE_TTL, WINDOW_OPTIONS } from "../../server/src/scheduleUtils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const icao        = ((req.query.icao as string) || "").toUpperCase();
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
  } catch (err: unknown) {
    const error = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
    const status  = error.response?.status  || 500;
    const message = error.response?.data?.message || error.message || "Internal server error";
    res.status(status).json({ error: message });
  }
}
