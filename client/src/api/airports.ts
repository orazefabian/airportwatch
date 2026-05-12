import api from "./client";
import type { Airport, Flight, LiveAircraftState, ScheduleResponse } from "../types";

export async function fetchAirports(): Promise<Airport[]> {
  const { data } = await api.get<Airport[]>("/airports");
  return data;
}

export async function fetchFlights(icao: string): Promise<{ arrivals: Flight[]; departures: Flight[] }> {
  const { data } = await api.get<{ arrivals: Flight[]; departures: Flight[] }>(`/flights/${icao}`);
  return data;
}

export async function fetchLiveTraffic(icao: string): Promise<LiveAircraftState[]> {
  const { data } = await api.get<LiveAircraftState[]>(`/live/${icao}`);
  return data;
}

export async function fetchSchedule(icao: string, windowHours: number = 4): Promise<ScheduleResponse> {
  const { data } = await api.get<ScheduleResponse>(`/schedule/${icao}`, { params: { window: windowHours } });
  return data;
}

export async function fetchTrack(icao24Codes: string[]): Promise<LiveAircraftState[]> {
  if (!icao24Codes?.length) return [];
  const { data } = await api.get<LiveAircraftState[]>("/track", { params: { icao24: icao24Codes.join(",") } });
  return data;
}
