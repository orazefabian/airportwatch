import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../utils/renderWithProviders";
import FlightTable from "../../components/FlightTable";
import { SCHEDULE_FIXTURE } from "../mocks/fixtures/schedule";
import type { LiveAircraftState } from "../../types";

const arrivals   = SCHEDULE_FIXTURE.arrivals;
const departures = SCHEDULE_FIXTURE.departures;
const noop = vi.fn();

// OS 101 has departure.scheduledTime.utc in the past → hasDepartedFromOrigin = true
// FR 2173 has departure.scheduledTime.utc in the future → hasDepartedFromOrigin = false

// OS 101 has modeS "abc123" — used for live-state reconciliation tests

describe("FlightTable — arrivals", () => {
  it("renders arrival flight numbers, origin IATA, belt, and status badge", () => {
    renderWithProviders(
      <FlightTable
        flights={arrivals}
        isLoading={false}
        type="arrivals"
        selectedFlight={null}
        onFlightSelect={noop}
      />
    );
    // Flight numbers
    expect(screen.getAllByText("OS 101").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FR 2173").length).toBeGreaterThan(0);

    // Status badges
    expect(screen.getAllByText("Expected").length).toBeGreaterThanOrEqual(2);

    // Baggage belt for OS 101
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows green in-air dep indicator (✈ Dep. …) when departure time is in the past", () => {
    renderWithProviders(
      <FlightTable
        flights={arrivals}
        isLoading={false}
        type="arrivals"
        selectedFlight={null}
        onFlightSelect={noop}
      />
    );
    // OS 101 departed in the past → should render a dep time element with green class
    const depElements = screen.getAllByText(/✈ Dep\./);
    expect(depElements.length).toBeGreaterThan(0);
    expect(depElements[0]).toHaveClass("text-green-400");
  });

  it("shows muted dep indicator (no ✈) when departure is still in the future", () => {
    renderWithProviders(
      <FlightTable
        flights={arrivals}
        isLoading={false}
        type="arrivals"
        selectedFlight={null}
        onFlightSelect={noop}
      />
    );
    // FR 2173 has future departure — muted style, no ✈ prefix
    const mutedDeps = screen.getAllByText(/^Dep\./);
    expect(mutedDeps.length).toBeGreaterThan(0);
    expect(mutedDeps[0]).toHaveClass("text-slate-500");
    expect(mutedDeps[0].textContent).not.toContain("✈");
  });

  it("shows empty-state message when flights array is empty", () => {
    renderWithProviders(
      <FlightTable
        flights={[]}
        isLoading={false}
        type="arrivals"
        selectedFlight={null}
        onFlightSelect={noop}
      />
    );
    expect(screen.getAllByText(/No arrivals in the current window/).length).toBeGreaterThan(0);
  });

  it("renders skeleton placeholders while loading", () => {
    renderWithProviders(
      <FlightTable
        flights={[]}
        isLoading={true}
        type="arrivals"
        selectedFlight={null}
        onFlightSelect={noop}
      />
    );
    // Skeleton rows have animate-pulse class on the <tr>
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("calls onFlightSelect when a flight row is clicked", () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <FlightTable
        flights={arrivals}
        isLoading={false}
        type="arrivals"
        selectedFlight={null}
        onFlightSelect={onSelect}
      />
    );
    // Click the first flight number on desktop (inside <td>)
    const flightNumbers = screen.getAllByText("OS 101");
    fireEvent.click(flightNumbers[0].closest("tr") ?? flightNumbers[0]);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(arrivals[0]);
  });

  it("does NOT override 'Arrived' when aircraft is airborne but arrival was far in the past (different leg)", () => {
    // The same physical aircraft that flew OS 101 this morning is now flying a different route.
    // OS 101's arrival was PAST_UTC (2020) — well over 60 min ago.
    // We must NOT show "EnRoute" here — the aircraft is on a completely different flight.
    const landedFlight = {
      ...arrivals[0],
      status: "Arrived" as const,
      arrival: {
        ...arrivals[0].arrival,
        scheduledTime: { utc: "2020-01-15 09:00:00 +0000", local: "2020-01-15 10:00:00 +0100" },
      },
    };
    const liveState: LiveAircraftState = {
      icao24: "abc123",
      callsign: "AUA101",
      origin_country: "Austria",
      last_contact: Date.now() / 1000,
      longitude: 14.0,
      latitude: 46.5,
      altitude: 8000,
      on_ground: false,
      velocity: 220,
      heading: 270,
      vertical_rate: 0,
      squawk: null,
    };

    renderWithProviders(
      <FlightTable
        flights={[landedFlight]}
        isLoading={false}
        type="arrivals"
        selectedFlight={null}
        onFlightSelect={noop}
        liveStates={[liveState]}
      />
    );

    // Arrived must be preserved — the airborne aircraft is on a different leg
    expect(screen.getAllByText("Arrived").length).toBeGreaterThan(0);
    expect(screen.queryByText("EnRoute")).not.toBeInTheDocument();
  });

  it("overrides 'Arrived' to 'EnRoute' when live data shows aircraft is still airborne", () => {
    const arrivedFlight = { ...arrivals[0], status: "Arrived" as const };
    const liveState: LiveAircraftState = {
      icao24: "abc123",        // matches arrivals[0].aircraft.modeS
      callsign: "AUA101",
      origin_country: "Austria",
      last_contact: Date.now() / 1000,
      longitude: 14.0,
      latitude: 46.5,
      altitude: 5000,
      on_ground: false,        // still airborne!
      velocity: 200,
      heading: 90,
      vertical_rate: -5,
      squawk: null,
    };

    renderWithProviders(
      <FlightTable
        flights={[arrivedFlight]}
        isLoading={false}
        type="arrivals"
        selectedFlight={null}
        onFlightSelect={noop}
        liveStates={[liveState]}
      />
    );

    // "Arrived" from AeroDataBox must not be shown when live data says airborne
    expect(screen.queryByText("Arrived")).not.toBeInTheDocument();
    // Live-corrected status must appear instead
    expect(screen.getAllByText("EnRoute").length).toBeGreaterThan(0);
  });
});

describe("FlightTable — departures", () => {
  it("renders departure rows with gate info", () => {
    renderWithProviders(
      <FlightTable
        flights={departures}
        isLoading={false}
        type="departures"
        selectedFlight={null}
        onFlightSelect={noop}
      />
    );
    expect(screen.getAllByText("OS 202").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Delayed").length).toBeGreaterThan(0);
    // Gate A3
    expect(screen.getByText("A3")).toBeInTheDocument();
  });

  it("does NOT show departure time indicator on departure rows", () => {
    renderWithProviders(
      <FlightTable
        flights={departures}
        isLoading={false}
        type="departures"
        selectedFlight={null}
        onFlightSelect={noop}
      />
    );
    // The "Dep. …" indicator is only for arrival rows
    expect(screen.queryByText(/Dep\./)).not.toBeInTheDocument();
  });
});
