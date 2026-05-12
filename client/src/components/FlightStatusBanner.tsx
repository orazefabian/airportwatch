import type { Flight } from "../types";

function parseUtc(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw.replace(" ", "T").replace(" ", ""));
  return isNaN(d.getTime()) ? null : d;
}

interface FlightStatusBannerProps {
  flight:    Flight;
  isTracked: boolean;
}

export default function FlightStatusBanner({ flight, isTracked }: FlightStatusBannerProps) {
  if (isTracked) return null;

  const depUtc = flight.departure?.revisedTime?.utc || flight.departure?.scheduledTime?.utc;
  // actualTime/revisedTime are reliable confirmed/updated arrival markers.
  // scheduledTime alone is not — a delayed plane's slot may have passed while it's still airborne.
  // Buffer: only treat scheduledTime as "arrived" if it's > 30 min in the past.
  const ARRIVAL_BUFFER_MS = 30 * 60 * 1000;
  const arrConfirmedUtc = flight.arrival?.actualTime?.utc || flight.arrival?.revisedTime?.utc;
  const arrScheduledUtc = flight.arrival?.scheduledTime?.utc;

  const now         = new Date();
  const hasDeparted = (parseUtc(depUtc) ?? new Date(0)) < now;
  const hasArrived  = arrConfirmedUtc
    ? (parseUtc(arrConfirmedUtc) ?? new Date(8640000000000000)) < now
    : !!arrScheduledUtc &&
      (parseUtc(arrScheduledUtc)?.getTime() ?? Infinity) < now.getTime() - ARRIVAL_BUFFER_MS;

  const depAirport = flight.departure?.airport;

  if (!hasDeparted) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 mb-2 rounded-xl border text-sm font-medium bg-slate-950 border-amber-700 text-amber-300">
        <span className="text-base">🅿</span>
        <span className="font-mono font-bold">{flight.number}</span>
        <span className="opacity-40">·</span>
        <span>{`Parked at ${depAirport?.icao || "origin airport"} — not yet departed`}</span>
      </div>
    );
  }

  if (hasArrived) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 mb-2 rounded-xl border text-sm font-medium bg-slate-950 border-pink-700 text-pink-300">
        <span className="text-base">🏁</span>
        <span className="font-mono font-bold">{flight.number}</span>
        <span className="opacity-40">·</span>
        <span>Reached destination</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 mb-2 rounded-xl border text-sm font-medium bg-slate-950 border-green-700 text-green-300">
      <span className="text-base">✈</span>
      <span className="font-mono font-bold">{flight.number}</span>
      <span className="opacity-40">·</span>
      <span className="text-slate-300">In the air — live position unavailable</span>
    </div>
  );
}
