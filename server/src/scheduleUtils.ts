import { fetchSchedule } from "./aerodatabox";
import { getCoords } from "./airportCoords";
import type { Flight, AirportInfo, ScheduleResponse } from "./types";

export function enrichAirport(airport: AirportInfo | null | undefined): AirportInfo | null | undefined {
  if (!airport) return airport;
  const c = getCoords(airport.icao);
  return c ? { ...airport, lat: c.lat, lon: c.lon } : airport;
}

export function inferStatus(flight: Flight, isArrival: boolean): Flight {
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

export function enrichSchedule(data: ScheduleResponse): ScheduleResponse {
  const enrich = (flights: Flight[], isArrival: boolean): Flight[] =>
    flights.map((f) => {
      const enriched: Flight = {
        ...f,
        departure: f.departure
          ? { ...f.departure, airport: enrichAirport(f.departure.airport) ?? f.departure.airport }
          : f.departure,
        arrival: f.arrival
          ? { ...f.arrival, airport: enrichAirport(f.arrival.airport) ?? f.arrival.airport }
          : f.arrival,
      };
      return inferStatus(enriched, isArrival);
    });
  return {
    arrivals:   enrich(data.arrivals   || [], true),
    departures: enrich(data.departures || [], false),
  };
}

// AeroDataBox accepts max 12 hours per call; fan out for wider windows
const CHUNK_H = 12 * 3600 * 1000;

export async function fetchScheduleChunked(
  icao: string,
  tz: string,
  hoursBack: number,
  hoursForward: number
): Promise<ScheduleResponse> {
  const now  = Date.now();
  const from = now - hoursBack    * 3600 * 1000;
  const to   = now + hoursForward * 3600 * 1000;

  const chunks: { from: Date; to: Date }[] = [];
  for (let t = from; t < to; t += CHUNK_H) {
    chunks.push({ from: new Date(t), to: new Date(Math.min(t + CHUNK_H, to)) });
  }

  const seenArr = new Set<string>();
  const seenDep = new Set<string>();
  const arrivals: Flight[]   = [];
  const departures: Flight[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await new Promise<void>((r) => setTimeout(r, 1100));
    const batch = await fetchSchedule(icao, tz, chunks[i].from, chunks[i].to);
    for (const f of batch.arrivals   || []) { const k = f.number || JSON.stringify(f); if (!seenArr.has(k)) { seenArr.add(k); arrivals.push(f); } }
    for (const f of batch.departures || []) { const k = f.number || JSON.stringify(f); if (!seenDep.has(k)) { seenDep.add(k); departures.push(f); } }
  }

  return { arrivals, departures };
}

export const SCHEDULE_TTL   = 15 * 60 * 1000;
export const WINDOW_OPTIONS = new Set([2, 4, 8, 12, 24]);
