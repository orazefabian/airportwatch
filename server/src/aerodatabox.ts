import axios from "axios";
import type { ScheduleResponse } from "./types";

const RAPIDAPI_HOST = "aerodatabox.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

function fmtLocal(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

const MAX_RETRIES = 2;

export async function fetchSchedule(
  icao: string,
  timezone: string = "UTC",
  fromDate: Date,
  toDate: Date
): Promise<ScheduleResponse> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set in server/.env");

  const from = fmtLocal(fromDate, timezone);
  const to   = fmtLocal(toDate,   timezone);

  const requestOptions = {
    params: {
      withLeg: true,
      direction: "Both",
      withCancelled: true,
      withCodeshared: true,
      withCargo: false,
      withPrivate: false,
    },
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    },
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get(
        `${BASE_URL}/flights/airports/icao/${icao}/${from}/${to}`,
        requestOptions
      );

      const raw = data as { arrivals?: unknown[]; departures?: unknown[] };
      return {
        arrivals:   ((raw.arrivals   || []) as ScheduleResponse["arrivals"]).sort((a, b) => compareScheduled(a.arrival,   b.arrival)),
        departures: ((raw.departures || []) as ScheduleResponse["departures"]).sort((a, b) => compareScheduled(a.departure, b.departure)),
      };
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      // AeroDataBox returns 404 when no flights exist in the window — not an error
      if (status === 404) return { arrivals: [], departures: [] };
      // Retry on 429 with exponential backoff (handles transient per-second rate limits)
      if (status === 429 && attempt < MAX_RETRIES) {
        await new Promise<void>((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      if (status === 429) {
        throw Object.assign(
          new Error("AeroDataBox rate limit reached — API quota may be exhausted"),
          { status: 429 }
        );
      }
      throw err;
    }
  }

  // Unreachable — loop always returns or throws
  throw new Error("fetchSchedule: unexpected exit from retry loop");
}

function compareScheduled(
  a: { scheduledTime?: { utc?: string } },
  b: { scheduledTime?: { utc?: string } }
): number {
  const ta = a?.scheduledTime?.utc || "";
  const tb = b?.scheduledTime?.utc || "";
  return ta.localeCompare(tb);
}
