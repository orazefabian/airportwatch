import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { renderWithProviders } from "../utils/renderWithProviders";
import Dashboard from "../../pages/Dashboard";

// Leaflet needs real browser geometry APIs not available in jsdom — mock the map component
vi.mock("../../components/FlightMap", () => ({
  default: () => <div data-testid="flight-map-mock" />,
}));

describe("Dashboard", () => {
  it("shows skeleton rows while schedule is loading", () => {
    server.use(
      http.get("/api/schedule/:icao", async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json({ arrivals: [], departures: [] });
      })
    );

    renderWithProviders(<Dashboard />, { initialEntries: ["/airport/LOWK"] });

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders flight data after schedule loads", async () => {
    renderWithProviders(<Dashboard />, { initialEntries: ["/airport/LOWK"] });

    await waitFor(() => {
      expect(screen.getAllByText("OS 101").length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("renders airport header after airports load", async () => {
    renderWithProviders(<Dashboard />, { initialEntries: ["/airport/LOWK"] });

    await waitFor(() => {
      expect(screen.getByText("Klagenfurt Airport")).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getAllByText("LOWK").length).toBeGreaterThan(0);
  });

  it("shows empty-state (not ErrorCard) when server returns empty schedule", async () => {
    // Simulates the server correctly handling AeroDataBox's 404 by returning 200 empty arrays.
    // The ZERO icao triggers this path in our MSW handlers.
    server.use(
      http.get("/api/schedule/:icao", () =>
        HttpResponse.json({ arrivals: [], departures: [] })
      )
    );

    renderWithProviders(<Dashboard />, { initialEntries: ["/airport/ZERO"] });

    await waitFor(() => {
      expect(screen.getAllByText(/No arrivals in the current window/).length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // No ErrorCard Retry button — this is an empty schedule, not an error
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("shows ErrorCard with Retry when the API call genuinely fails", async () => {
    server.use(
      http.get("/api/schedule/:icao", () =>
        new HttpResponse(null, { status: 500 })
      )
    );

    renderWithProviders(<Dashboard />, { initialEntries: ["/airport/LOWK"] });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
