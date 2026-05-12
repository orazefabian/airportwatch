import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../utils/renderWithProviders";
import FlightStatusBanner from "../../components/FlightStatusBanner";
import type { Flight } from "../../types";
import { SCHEDULE_FIXTURE } from "../mocks/fixtures/schedule";

const PAST_UTC   = "2020-01-15 08:00:00 +0000";
const FUTURE_UTC = "2099-12-31 23:00:00 +0000";

/** Returns a UTC string N minutes before now — for testing "recently past" arrival times. */
function minutesAgo(n: number): string {
  const d = new Date(Date.now() - n * 60 * 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ` +
         `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000`;
}

const base = SCHEDULE_FIXTURE.arrivals[0]; // OS 101

describe("FlightStatusBanner", () => {
  it("renders nothing when the flight is live-tracked", () => {
    const { container } = renderWithProviders(
      <FlightStatusBanner flight={base} isTracked={true} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows amber 'Parked' banner when departure time is still in the future", () => {
    const flight: Flight = {
      ...base,
      departure: { ...base.departure, scheduledTime: { utc: FUTURE_UTC, local: FUTURE_UTC } },
    };
    renderWithProviders(<FlightStatusBanner flight={flight} isTracked={false} />);
    expect(screen.getByText(/Parked at/)).toBeInTheDocument();
    expect(screen.queryByText(/In the air/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reached destination/)).not.toBeInTheDocument();
  });

  it("shows green 'In the air' banner when departed but arrival time is in the future", () => {
    const flight: Flight = {
      ...base,
      departure: { ...base.departure, scheduledTime: { utc: PAST_UTC,   local: PAST_UTC   } },
      arrival:   { ...base.arrival,   scheduledTime: { utc: FUTURE_UTC, local: FUTURE_UTC } },
    };
    renderWithProviders(<FlightStatusBanner flight={flight} isTracked={false} />);
    expect(screen.getByText(/In the air/)).toBeInTheDocument();
    expect(screen.queryByText(/Reached destination/)).not.toBeInTheDocument();
    const banner = screen.getByText(/In the air/).closest("div")!;
    expect(banner).toHaveClass("border-green-700");
    expect(banner).not.toHaveClass("border-pink-700");
  });

  it("shows pink 'Reached destination' when actualTime confirms landing", () => {
    const flight: Flight = {
      ...base,
      departure: { ...base.departure, scheduledTime: { utc: PAST_UTC, local: PAST_UTC } },
      arrival:   { ...base.arrival,   actualTime:    { utc: PAST_UTC, local: PAST_UTC } },
    };
    renderWithProviders(<FlightStatusBanner flight={flight} isTracked={false} />);
    expect(screen.getByText(/Reached destination/)).toBeInTheDocument();
    expect(screen.queryByText(/In the air/)).not.toBeInTheDocument();
    const banner = screen.getByText(/Reached destination/).closest("div")!;
    expect(banner).toHaveClass("border-pink-700");
    expect(banner).not.toHaveClass("border-green-700");
  });

  it("shows pink 'Reached destination' when scheduledTime is far in the past and no actualTime — flight has certainly arrived", () => {
    // PAST_UTC is 2020 — years ago. Without actualTime AeroDataBox won't always set it, but
    // a flight whose scheduled slot was years ago has unambiguously completed.
    const flight: Flight = {
      ...base,
      departure: { ...base.departure, scheduledTime: { utc: PAST_UTC, local: PAST_UTC } },
      arrival:   { ...base.arrival,   scheduledTime: { utc: PAST_UTC, local: PAST_UTC } },
    };
    renderWithProviders(<FlightStatusBanner flight={flight} isTracked={false} />);
    expect(screen.getByText(/Reached destination/)).toBeInTheDocument();
    expect(screen.queryByText(/In the air/)).not.toBeInTheDocument();
  });

  it("shows 'In the air' when scheduled arrival was only minutes ago and no actualTime — delayed flight still airborne", () => {
    // A flight delayed by ~10 minutes has its scheduledTime recently in the past.
    // We must NOT show "Reached destination" here because the plane might still be on approach.
    const recentlyPast = minutesAgo(10);
    const flight: Flight = {
      ...base,
      departure: { ...base.departure, scheduledTime: { utc: PAST_UTC,    local: PAST_UTC    } },
      arrival:   { ...base.arrival,   scheduledTime: { utc: recentlyPast, local: recentlyPast } },
    };
    renderWithProviders(<FlightStatusBanner flight={flight} isTracked={false} />);
    expect(screen.getByText(/In the air/)).toBeInTheDocument();
    expect(screen.queryByText(/Reached destination/)).not.toBeInTheDocument();
  });
});
