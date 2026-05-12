import type { ScheduleResponse } from "../../../types";

// Past departure time → hasDepartedFromOrigin returns true → should show green "✈ Dep."
const PAST_UTC = "2020-01-15 08:00:00 +0000";

// Future departure time → hasDepartedFromOrigin returns false → should show muted "Dep."
const FUTURE_UTC = "2099-12-31 23:00:00 +0000";

export const SCHEDULE_FIXTURE: ScheduleResponse = {
  arrivals: [
    {
      number: "OS 101",
      callSign: "AUA101",
      status: "Expected",
      aircraft: { modeS: "abc123", model: "A320" },
      airline: { name: "Austrian Airlines" },
      departure: {
        airport: {
          icao: "EGLL",
          iata: "LHR",
          name: "London Heathrow Airport",
          municipalityName: "London",
          country: "United Kingdom",
          lat: 51.4775,
          lon: -0.4614,
        },
        scheduledTime: { utc: PAST_UTC, local: "2020-01-15 09:00:00 +0100" },
      },
      arrival: {
        airport: {
          icao: "LOWK",
          iata: "KLU",
          name: "Klagenfurt Airport",
          municipalityName: "Klagenfurt",
          country: "Austria",
          lat: 46.6425,
          lon: 14.3376,
        },
        scheduledTime: { utc: FUTURE_UTC, local: "2099-12-31 24:00:00 +0100" },
        baggageBelt: "3",
      },
    },
    {
      number: "FR 2173",
      callSign: "RYR2173",
      status: "Expected",
      aircraft: { model: "B737" },
      airline: { name: "Ryanair" },
      departure: {
        airport: {
          icao: "LEPA",
          iata: "PMI",
          name: "Palma de Mallorca Airport",
          municipalityName: "Palma De Mallorca",
          country: "Spain",
          lat: 39.5517,
          lon: 2.7388,
        },
        scheduledTime: { utc: FUTURE_UTC, local: "2099-12-31 24:00:00 +0100" },
      },
      arrival: {
        airport: {
          icao: "LOWK",
          iata: "KLU",
          name: "Klagenfurt Airport",
          municipalityName: "Klagenfurt",
          country: "Austria",
          lat: 46.6425,
          lon: 14.3376,
        },
        scheduledTime: { utc: FUTURE_UTC, local: "2099-12-31 25:00:00 +0100" },
      },
    },
  ],
  departures: [
    {
      number: "OS 202",
      callSign: "AUA202",
      status: "Delayed",
      aircraft: { modeS: "def456", model: "B737" },
      airline: { name: "Austrian Airlines" },
      departure: {
        airport: {
          icao: "LOWK",
          iata: "KLU",
          name: "Klagenfurt Airport",
          country: "Austria",
          lat: 46.6425,
          lon: 14.3376,
        },
        scheduledTime: { utc: PAST_UTC, local: "2020-01-15 09:00:00 +0100" },
        revisedTime:   { utc: "2020-01-15 08:30:00 +0000", local: "2020-01-15 09:30:00 +0100" },
        gate: "A3",
      },
      arrival: {
        airport: {
          icao: "EDDF",
          iata: "FRA",
          name: "Frankfurt Airport",
          country: "Germany",
          lat: 50.0379,
          lon: 8.5622,
        },
        scheduledTime: { utc: FUTURE_UTC, local: "2099-12-31 24:00:00 +0100" },
      },
    },
  ],
};

export const EMPTY_SCHEDULE_FIXTURE: ScheduleResponse = {
  arrivals: [],
  departures: [],
};
