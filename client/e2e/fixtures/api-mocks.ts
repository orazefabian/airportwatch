import type { Page } from "@playwright/test";
import type { ScheduleResponse } from "../../src/types";

import { AIRPORTS_FIXTURE } from "../../src/test/mocks/fixtures/airports";
import { SCHEDULE_FIXTURE, EMPTY_SCHEDULE_FIXTURE } from "../../src/test/mocks/fixtures/schedule";

export { SCHEDULE_FIXTURE, EMPTY_SCHEDULE_FIXTURE };

export async function mockDefaultRoutes(page: Page): Promise<void> {
  await page.route("**/api/airports", (route) =>
    route.fulfill({ json: AIRPORTS_FIXTURE })
  );
  await page.route("**/api/schedule/**", (route) =>
    route.fulfill({ json: SCHEDULE_FIXTURE })
  );
  await page.route("**/api/track**", (route) =>
    route.fulfill({ json: [] })
  );
}

/**
 * OS 101 with status "Arrived" and arrival `minsAgo` minutes in the past.
 * minsAgo > 30  → FlightStatusBanner shows "Reached destination" (past the 30-min buffer).
 * minsAgo ≤ 30 + airborne track → FlightTable overrides status to "EnRoute".
 */
export function arrivedFlightSchedule(minsAgo = 30): ScheduleResponse {
  const pastDate = new Date(Date.now() - minsAgo * 60 * 1000);
  // AeroDataBox timestamp format: "2024-01-15 08:00:00 +0000"
  const arrUtc = pastDate
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " +0000");
  return {
    arrivals: [
      {
        ...SCHEDULE_FIXTURE.arrivals[0],
        status: "Arrived",
        arrival: {
          ...SCHEDULE_FIXTURE.arrivals[0].arrival,
          scheduledTime: { utc: arrUtc, local: arrUtc },
        },
      },
    ],
    departures: [],
  };
}

/** 11 arrivals (OS 100–OS 110) — enough to trigger pagination (PAGE_SIZE = 10). */
export function bigSchedule(): ScheduleResponse {
  return {
    arrivals: Array.from({ length: 11 }, (_, i) => ({
      ...SCHEDULE_FIXTURE.arrivals[0],
      number: `OS ${100 + i}`,
      callSign: `AUA${100 + i}`,
    })),
    departures: [],
  };
}
