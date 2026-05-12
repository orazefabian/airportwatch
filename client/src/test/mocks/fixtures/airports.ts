import type { Airport } from "../../../types";

export const AIRPORTS_FIXTURE: Airport[] = [
  {
    icao: "LOWK",
    iata: "KLU",
    name: "Klagenfurt Airport",
    city: "Klagenfurt",
    country: "Austria",
    lat: 46.6425,
    lon: 14.3376,
    tz: "Europe/Vienna",
  },
  {
    icao: "EGLL",
    iata: "LHR",
    name: "London Heathrow Airport",
    city: "London",
    country: "United Kingdom",
    lat: 51.4775,
    lon: -0.4614,
    tz: "Europe/London",
  },
];
