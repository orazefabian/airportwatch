import { test, expect } from "../fixtures/test";
import {
  SCHEDULE_FIXTURE,
  EMPTY_SCHEDULE_FIXTURE,
  arrivedFlightSchedule,
  bigSchedule,
} from "../fixtures/api-mocks";
import type { LiveAircraftState } from "../../src/types";

test.describe("Schedule loading", () => {
  test("shows skeleton rows while schedule is loading", async ({ page }) => {
    await page.route("**/api/schedule/**", async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.fulfill({ json: SCHEDULE_FIXTURE });
    });

    await page.goto("/airport/LOWK");
    await expect(page.locator(".animate-pulse").first()).toBeVisible();
  });

  test("renders flight data after schedule loads", async ({ page }) => {
    await page.goto("/airport/LOWK");
    await expect(page.locator("table").getByText("OS 101")).toBeVisible();
  });

  test("renders airport header after airports load", async ({ page }) => {
    await page.goto("/airport/LOWK");
    await expect(page.getByText("Klagenfurt Airport")).toBeVisible();
    // Scope LOWK check to the ICAO badge to avoid matching the map marker button
    await expect(
      page.getByText("ICAO").locator("xpath=..").getByText("LOWK")
    ).toBeVisible();
  });
});

test.describe("Tab switching", () => {
  test("arrivals tab is active by default", async ({ page }) => {
    await page.goto("/airport/LOWK");
    await expect(page.locator("table").getByText("OS 101")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /arrivals/i }).first()
    ).toHaveAttribute("aria-selected", "true");
  });

  test("switching to departures tab shows departure flights", async ({
    page,
  }) => {
    await page.goto("/airport/LOWK");
    await expect(page.locator("table").getByText("OS 101")).toBeVisible();
    await page.getByRole("button", { name: /^departures/i }).first().click();
    await expect(page.locator("table").getByText("OS 202")).toBeVisible();
  });
});

test.describe("Window selector", () => {
  test("default fetch uses window=4", async ({ page }) => {
    const reqPromise = page.waitForRequest("**/api/schedule/**");
    await page.goto("/airport/LOWK");
    const req = await reqPromise;
    expect(req.url()).toContain("window=4");
  });

  test("clicking ±2h refetches with window=2", async ({ page }) => {
    await page.goto("/airport/LOWK");
    await expect(page.locator("table").getByText("OS 101")).toBeVisible();

    const [req] = await Promise.all([
      page.waitForRequest("**/api/schedule/**"),
      page.getByRole("button", { name: "±2h" }).click(),
    ]);
    expect(req.url()).toContain("window=2");
  });

  test("clicking ±8h refetches with window=8", async ({ page }) => {
    await page.goto("/airport/LOWK");
    await expect(page.locator("table").getByText("OS 101")).toBeVisible();

    const [req] = await Promise.all([
      page.waitForRequest("**/api/schedule/**"),
      page.getByRole("button", { name: "±8h" }).click(),
    ]);
    expect(req.url()).toContain("window=8");
  });
});

test.describe("Flight selection", () => {
  test("clicking OS 101 shows In the air status banner", async ({ page }) => {
    await page.goto("/airport/LOWK");
    await page.getByRole("row", { name: /OS 101/ }).click();
    await expect(
      page.getByText("In the air — live position unavailable")
    ).toBeVisible();
  });

  test("clicking a selected flight deselects it and hides the banner", async ({
    page,
  }) => {
    await page.goto("/airport/LOWK");
    await page.getByRole("row", { name: /OS 101/ }).click();
    await expect(
      page.getByText("In the air — live position unavailable")
    ).toBeVisible();
    await page.getByRole("row", { name: /OS 101/ }).click();
    await expect(
      page.getByText("In the air — live position unavailable")
    ).not.toBeVisible();
  });

  test("clicking FR 2173 shows Parked banner", async ({ page }) => {
    await page.goto("/airport/LOWK");
    await page.getByRole("row", { name: /FR 2173/ }).click();
    await expect(page.getByText(/Parked at LEPA/)).toBeVisible();
  });

  test("clicking a recently arrived flight shows Reached destination banner", async ({
    page,
  }) => {
    await page.route("**/api/schedule/**", (route) =>
      route.fulfill({ json: arrivedFlightSchedule(65) })
    );
    await page.goto("/airport/LOWK");
    await page.getByRole("row", { name: /OS 101/ }).click();
    await expect(page.getByText("Reached destination")).toBeVisible();
  });

  test("switching tabs clears flight selection", async ({ page }) => {
    await page.goto("/airport/LOWK");
    await page.getByRole("row", { name: /OS 101/ }).click();
    await expect(
      page.getByText("In the air — live position unavailable")
    ).toBeVisible();
    await page.getByRole("button", { name: /^departures/i }).first().click();
    await expect(
      page.getByText("In the air — live position unavailable")
    ).not.toBeVisible();
  });
});

test.describe("Empty schedule", () => {
  test("shows empty-state message, not ErrorCard, when schedule is empty", async ({
    page,
  }) => {
    await page.route("**/api/schedule/**", (route) =>
      route.fulfill({ json: EMPTY_SCHEDULE_FIXTURE })
    );
    await page.goto("/airport/LOWK");
    await expect(
      page.locator("table").getByText("No arrivals in the current window")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /retry/i })
    ).not.toBeVisible();
  });
});

test.describe("Error states", () => {
  test("shows Retry button when first API call fails", async ({ page }) => {
    await page.route("**/api/schedule/**", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.goto("/airport/LOWK");
    // Production QueryClient has retry:3 with backoff (1s+2s+4s) — allow up to 15s
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible({
      timeout: 15000,
    });
  });
});

test.describe("Live status override", () => {
  test("overrides Arrived status to EnRoute when aircraft is airborne", async ({
    page,
  }) => {
    const airborneState: LiveAircraftState = {
      icao24: "abc123",
      callsign: "AUA101",
      origin_country: "Austria",
      last_contact: Date.now() / 1000,
      longitude: 14.0,
      latitude: 47.0,
      altitude: 10000,
      on_ground: false,
      velocity: 250,
      heading: 180,
      vertical_rate: 0,
      squawk: null,
    };

    await page.route("**/api/schedule/**", (route) =>
      route.fulfill({ json: arrivedFlightSchedule() })
    );
    await page.route("**/api/track**", (route) =>
      route.fulfill({ json: [airborneState] })
    );

    await page.goto("/airport/LOWK");
    await expect(page.getByRole("cell", { name: "EnRoute" })).toBeVisible();
    await expect(page.locator("table").getByText("Arrived")).not.toBeVisible();
  });
});

test.describe("Pagination", () => {
  test("shows Next button when more than 10 flights", async ({ page }) => {
    await page.route("**/api/schedule/**", (route) =>
      route.fulfill({ json: bigSchedule() })
    );
    await page.goto("/airport/LOWK");
    await expect(page.getByRole("button", { name: "Next ›" })).toBeVisible();
  });

  test("clicking Next advances to page 2 and removes page 1 content", async ({
    page,
  }) => {
    await page.route("**/api/schedule/**", (route) =>
      route.fulfill({ json: bigSchedule() })
    );
    await page.goto("/airport/LOWK");
    await page.getByRole("button", { name: "Next ›" }).first().click();
    // OS 110 is the 11th flight (index 10), shown only on page 2
    await expect(page.locator("table").getByText("OS 110")).toBeVisible();
    await expect(page.locator("table").getByText("OS 100")).not.toBeVisible();
  });
});
