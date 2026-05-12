export interface TimeObject {
  utc: string;
  local: string;
}

export interface AirportInfo {
  icao: string;
  iata: string;
  name: string;
  municipalityName?: string;
  city?: string;
  country: { name: string } | string;
  lat?: number;
  lon?: number;
  tz?: string;
}

export type FlightStatus =
  | "Expected"
  | "Scheduled"
  | "Delayed"
  | "Departed"
  | "Arrived"
  | "Cancelled"
  | "EnRoute"
  | "Landing"
  | "GateClosed";

export interface Flight {
  number: string;
  callSign?: string;
  status: FlightStatus;
  airline?: { name: string };
  aircraft?: { modeS?: string; model?: string };
  departure: {
    airport: AirportInfo;
    scheduledTime: TimeObject;
    revisedTime?: TimeObject;
    actualTime?: TimeObject;
    gate?: string;
  };
  arrival: {
    airport: AirportInfo;
    scheduledTime: TimeObject;
    revisedTime?: TimeObject;
    actualTime?: TimeObject;
    baggageBelt?: string;
  };
}

export interface LiveAircraftState {
  icao24: string;
  callsign: string;
  origin_country: string;
  last_contact: number;
  longitude: number;
  latitude: number;
  altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  heading: number | null;
  vertical_rate: number | null;
  squawk: string | null;
  flightType?: "arrival" | "departure";
}

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
}

export interface ScheduleResponse {
  arrivals: Flight[];
  departures: Flight[];
}
