import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { server } from "../mocks/server";
import { SCHEDULE_FIXTURE } from "../mocks/fixtures/schedule";
import Dashboard from "../../pages/Dashboard";

vi.mock("../../components/FlightMap", () => ({
  default: () => <div data-testid="flight-map-mock" />,
}));

describe("Dashboard — stale data", () => {
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

    await waitFor(
      () => {
        expect(screen.getAllByText("OS 101").length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );

    await act(async () => {
      await qc.refetchQueries({ queryKey: ["schedule"] });
    });

    // Previous flight data must still be visible (table not replaced by ErrorCard)
    expect(screen.getAllByText("OS 101").length).toBeGreaterThan(0);
    // Stale data banner must appear
    await waitFor(
      () => {
        expect(screen.getByText(/Could not refresh/)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
