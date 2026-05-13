import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { server } from "../mocks/server";
import { renderWithProviders } from "../utils/renderWithProviders";
import { SCHEDULE_FIXTURE } from "../mocks/fixtures/schedule";
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

  it("shows 'In the air' banner above the map when a departed flight is selected", async () => {
    // OS 101 has a past departure time and future arrival time — it is en route.
    // Selecting it must show the FlightStatusBanner. This test guards against accidentally
    // removing the FlightStatusBanner render from Dashboard.
    renderWithProviders(<Dashboard />, { initialEntries: ["/airport/LOWK"] });

    await waitFor(() => {
      expect(screen.getAllByText("OS 101").length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Click the first OS 101 element — bubbles to the card/row onClick
    fireEvent.click(screen.getAllByText("OS 101")[0]);

    await waitFor(() => {
      expect(screen.getByText(/In the air — live position unavailable/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("shows StaleDataBanner (not ErrorCard) when a refetch fails but previous data exists", async () => {
    let calls = 0;
    server.use(
      http.get("/api/schedule/:icao", () => {
        calls++;
        if (calls === 1) return HttpResponse.json(SCHEDULE_FIXTURE);
        return new HttpResponse(null, { status: 500 });
      })
    );

    const qc = new QueryClient({
      defaultOptions: { queries: { staleTime: 0, retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/airport/LOWK"]}>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for initial data
    await waitFor(() => {
      expect(screen.getAllByText("OS 101").length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Trigger a refetch that will hit the 500
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["schedule"] });
    });

    // Previous flight data must still be visible (table not replaced by ErrorCard)
    expect(screen.getAllByText("OS 101").length).toBeGreaterThan(0);
    // Stale data banner must appear
    await waitFor(() => {
      expect(screen.getByText(/Could not refresh/)).toBeInTheDocument();
    }, { timeout: 3000 });
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
