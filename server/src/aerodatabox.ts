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

  try {
    const { data } = await axios.get(
      `${BASE_URL}/flights/airports/icao/${icao}/${from}/${to}`,
      {
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
      }
    );

    const raw = data as { arrivals?: unknown[]; departures?: unknown[] };
    return {
      arrivals:   ((raw.arrivals   || []) as ScheduleResponse["arrivals"]).sort((a, b) => compareScheduled(a.arrival,   b.arrival)),
      departures: ((raw.departures || []) as ScheduleResponse["departures"]).sort((a, b) => compareScheduled(a.departure, b.departure)),
    };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      (err as { response?: { status?: number } }).response?.status === 404
    ) {
      // AeroDataBox returns 404 when no flights exist in the window — not an error
      return { arrivals: [], departures: [] };
    }
    throw err;
  }
}

function compareScheduled(
  a: { scheduledTime?: { utc?: string } },
  b: { scheduledTime?: { utc?: string } }
): number {
  const ta = a?.scheduledTime?.utc || "";
  const tb = b?.scheduledTime?.utc || "";
  return ta.localeCompare(tb);
}
