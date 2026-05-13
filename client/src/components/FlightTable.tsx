import { useState, useEffect, useMemo } from "react";
import SkeletonRow from "./SkeletonRow";
import type { Flight, FlightStatus, LiveAircraftState, TimeObject } from "../types";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<FlightStatus | "Unknown", string> = {
  Expected:   "bg-slate-700/60 text-slate-300 border-slate-600",
  Scheduled:  "bg-slate-700/60 text-slate-300 border-slate-600",
  Delayed:    "bg-amber-900/60 text-amber-300 border-amber-700",
  Departed:   "bg-green-900/60 text-green-300 border-green-700",
  Arrived:    "bg-green-900/60 text-green-300 border-green-700",
  Cancelled:  "bg-red-900/60 text-red-300 border-red-700",
  GateClosed: "bg-orange-900/60 text-orange-300 border-orange-700",
  EnRoute:    "bg-cyan-900/60 text-cyan-300 border-cyan-700",
  Landing:    "bg-cyan-900/60 text-cyan-300 border-cyan-700",
  Unknown:    "bg-slate-800/60 text-slate-500 border-slate-700",
};

const CHIP_ACTIVE: Record<FlightStatus | "Unknown", string> = {
  Expected:   "bg-slate-700 text-slate-200 border-slate-500",
  Scheduled:  "bg-slate-700 text-slate-200 border-slate-500",
  Delayed:    "bg-amber-800 text-amber-200 border-amber-600",
  Departed:   "bg-green-800 text-green-200 border-green-600",
  Arrived:    "bg-green-800 text-green-200 border-green-600",
  Cancelled:  "bg-red-800 text-red-200 border-red-600",
  GateClosed: "bg-orange-800 text-orange-200 border-orange-600",
  EnRoute:    "bg-cyan-800 text-cyan-200 border-cyan-600",
  Landing:    "bg-cyan-800 text-cyan-200 border-cyan-600",
  Unknown:    "bg-slate-700 text-slate-400 border-slate-600",
};

const STATUS_ORDER: (FlightStatus | "Unknown")[] = [
  "Expected", "Scheduled", "EnRoute", "Landing", "Delayed",
  "GateClosed", "Arrived", "Departed", "Cancelled", "Unknown",
];

function isSelected(flight: Flight, selectedFlight: Flight | null): boolean {
  if (!selectedFlight) return false;
  return flight.number === selectedFlight.number && flight.callSign === selectedFlight.callSign;
}

function localTime(timeObj: TimeObject | null | undefined): string | null {
  if (!timeObj) return null;
  const raw = timeObj.local || timeObj.utc || "";
  const match = raw.match(/(\d{2}):(\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = match[2];
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${suffix}`;
}

function dateLabel(timeObj: TimeObject | null | undefined): string | null {
  if (!timeObj) return null;
  const raw = timeObj.local || timeObj.utc || "";
  const match = raw.match(/(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const flightDate = match[1];
  const fmt = (d: Date) => d.toLocaleDateString("en-CA");
  const today     = fmt(new Date());
  const tomorrow  = fmt(new Date(Date.now() + 86_400_000));
  const yesterday = fmt(new Date(Date.now() - 86_400_000));
  if (flightDate === today)     return "Today";
  if (flightDate === tomorrow)  return "Tomorrow";
  if (flightDate === yesterday) return "Yesterday";
  return flightDate;
}

function delayMinutes(
  scheduledObj: TimeObject | null | undefined,
  revisedObj:   TimeObject | null | undefined
): number | null {
  if (!scheduledObj?.utc || !revisedObj?.utc) return null;
  const parse = (s: string) => new Date(s.replace(" ", "T").replace(/([+-]\d{2}:\d{2}|Z)$/, "Z"));
  return Math.round((parse(revisedObj.utc).getTime() - parse(scheduledObj.utc).getTime()) / 60000);
}

function hasDepartedFromOrigin(flight: Flight): boolean {
  const raw = flight.departure?.revisedTime?.utc || flight.departure?.scheduledTime?.utc;
  if (!raw) return false;
  return new Date(raw.replace(" ", "T").replace(" ", "")) < new Date();
}

interface DelayBadgeProps {
  scheduled: TimeObject | null | undefined;
  revised:   TimeObject | null | undefined;
}

function DelayBadge({ scheduled, revised }: DelayBadgeProps) {
  const mins = delayMinutes(scheduled, revised);
  if (mins === null || Math.abs(mins) < 2) return null;
  return (
    <span className={`ml-1.5 text-xs font-medium ${mins > 0 ? "text-amber-400" : "text-green-400"}`}>
      {mins > 0 ? `+${mins}m` : `${mins}m`}
    </span>
  );
}

interface PaginationControlsProps {
  page:     number;
  pageCount: number;
  setPage:  React.Dispatch<React.SetStateAction<number>>;
}

function PaginationControls({ page, pageCount, setPage }: PaginationControlsProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        onClick={() => setPage((p) => Math.max(0, p - 1))}
        disabled={page === 0}
        className="px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ‹ Prev
      </button>
      <span className="text-slate-500">{page + 1} / {pageCount}</span>
      <button
        onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
        disabled={page === pageCount - 1}
        className="px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next ›
      </button>
    </div>
  );
}

interface FlightCardProps {
  flight:          Flight;
  isArrival:       boolean;
  selected:        boolean;
  onSelect:        (flight: Flight) => void;
  effectiveStatus: FlightStatus | "Unknown";
}

function FlightCard({ flight, isArrival, selected, onSelect, effectiveStatus }: FlightCardProps) {
  const dep = flight.departure;
  const arr = flight.arrival;
  const timeEvent   = isArrival ? arr : dep;
  const scheduled   = timeEvent?.scheduledTime;
  const revised     = timeEvent?.revisedTime ?? timeEvent?.actualTime;
  const displayTime = localTime(revised) || localTime(scheduled);
  const displayDate = dateLabel(revised)  || dateLabel(scheduled);
  const statusStyle = STATUS_STYLES[effectiveStatus] || STATUS_STYLES.Unknown;
  const counterpart = isArrival ? dep?.airport : arr?.airport;
  const extra = isArrival
    ? (arr?.baggageBelt ? `Belt ${arr.baggageBelt}` : null)
    : (dep?.gate        ? `Gate ${dep.gate}`        : null);
  const depTime = isArrival ? (localTime(dep?.revisedTime) || localTime(dep?.scheduledTime)) : null;
  const arrTime = !isArrival ? (localTime(arr?.revisedTime ?? arr?.actualTime) || localTime(arr?.scheduledTime)) : null;
  const inAir   = isArrival && hasDepartedFromOrigin(flight);

  return (
    <div
      onClick={() => onSelect(flight)}
      className={`rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
        selected
          ? "bg-cyan-950/50 border-cyan-600"
          : "bg-slate-900 border-slate-700 active:bg-slate-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {selected && <span className="text-cyan-400 text-xs flex-shrink-0">▶</span>}
            <span className="font-mono font-bold text-slate-100">{flight.number || "—"}</span>
          </div>
          {flight.airline?.name && (
            <div className="text-xs text-slate-500 truncate">{flight.airline.name}</div>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs border font-medium flex-shrink-0 ${statusStyle}`}>
          {effectiveStatus}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 mb-0.5">{isArrival ? "From" : "To"}</div>
          <span className="font-mono text-cyan-400 font-semibold">
            {counterpart?.iata || counterpart?.icao || "—"}
          </span>
          {counterpart?.municipalityName && (
            <span className="text-xs text-slate-500 ml-1">{counterpart.municipalityName}</span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono text-slate-200 text-sm">
            {displayTime || "—"}
            <DelayBadge scheduled={scheduled} revised={revised} />
          </div>
          {displayDate && <div className="text-xs text-slate-500">{displayDate}</div>}
        </div>
      </div>
      {(extra || depTime || arrTime) && (
        <div className="mt-1.5 text-xs flex items-center gap-2">
          {extra && <span className="font-mono font-bold text-violet-400">{extra}</span>}
          {depTime && (
            <span className={`font-mono ${inAir ? "text-green-400" : "text-slate-500"}`}>
              {inAir ? "✈ " : ""}Dep. {depTime}
            </span>
          )}
          {arrTime && (
            <span className="font-mono text-slate-500">Arr. {arrTime}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  flight:          Flight;
  selected:        boolean;
  onSelect:        (flight: Flight) => void;
  effectiveStatus: FlightStatus | "Unknown";
}

function ArrivalRow({ flight, selected, onSelect, effectiveStatus }: RowProps) {
  const dep = flight.departure;
  const arr = flight.arrival;
  const scheduled   = arr?.scheduledTime;
  const revised     = arr?.revisedTime ?? arr?.actualTime;
  const displayTime = localTime(revised) || localTime(scheduled);
  const displayDate = dateLabel(revised) || dateLabel(scheduled);
  const statusStyle = STATUS_STYLES[effectiveStatus] || STATUS_STYLES.Unknown;
  const depTime = localTime(dep?.revisedTime) || localTime(dep?.scheduledTime);
  const inAir   = hasDepartedFromOrigin(flight);

  return (
    <tr
      onClick={() => onSelect(flight)}
      className={`border-b border-slate-800 cursor-pointer transition-colors ${
        selected
          ? "bg-cyan-950/50 border-l-2 border-l-cyan-500"
          : "hover:bg-slate-800/40"
      }`}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          {selected && <span className="text-cyan-400 text-xs">▶</span>}
          <div>
            <span className="font-mono font-bold text-slate-100">{flight.number || "—"}</span>
            {flight.airline?.name && (
              <div className="text-xs text-slate-500 mt-0.5">{flight.airline.name}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-mono text-cyan-400 font-semibold">
          {dep?.airport?.iata || dep?.airport?.icao || "—"}
        </span>
        {dep?.airport?.municipalityName && (
          <div className="text-xs text-slate-500 mt-0.5">{dep.airport.municipalityName}</div>
        )}
        {depTime && (
          <div className={`text-xs mt-0.5 font-mono ${inAir ? "text-green-400" : "text-slate-500"}`}>
            {inAir ? "✈ " : ""}Dep. {depTime}
          </div>
        )}
      </td>
      <td className="px-4 py-3.5">
        <div className="font-mono text-slate-200">
          {displayTime || "—"}
          <DelayBadge scheduled={scheduled} revised={revised} />
        </div>
        {displayDate && <div className="text-xs text-slate-500 mt-0.5">{displayDate}</div>}
      </td>
      <td className="px-4 py-3.5">
        {arr?.baggageBelt
          ? <span className="font-mono font-bold text-violet-400">{arr.baggageBelt}</span>
          : <span className="text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3.5">
        <span className={`px-2.5 py-0.5 rounded-full text-xs border font-medium ${statusStyle}`}>
          {effectiveStatus}
        </span>
      </td>
    </tr>
  );
}

function DepartureRow({ flight, selected, onSelect, effectiveStatus }: RowProps) {
  const dep = flight.departure;
  const arr = flight.arrival;
  const scheduled   = dep?.scheduledTime;
  const revised     = dep?.revisedTime ?? dep?.actualTime;
  const displayTime = localTime(revised) || localTime(scheduled);
  const displayDate = dateLabel(revised) || dateLabel(scheduled);
  const statusStyle = STATUS_STYLES[effectiveStatus] || STATUS_STYLES.Unknown;
  const arrTime = localTime(arr?.revisedTime ?? arr?.actualTime) || localTime(arr?.scheduledTime);

  return (
    <tr
      onClick={() => onSelect(flight)}
      className={`border-b border-slate-800 cursor-pointer transition-colors ${
        selected
          ? "bg-cyan-950/50 border-l-2 border-l-cyan-500"
          : "hover:bg-slate-800/40"
      }`}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          {selected && <span className="text-cyan-400 text-xs">▶</span>}
          <div>
            <span className="font-mono font-bold text-slate-100">{flight.number || "—"}</span>
            {flight.airline?.name && (
              <div className="text-xs text-slate-500 mt-0.5">{flight.airline.name}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-mono text-cyan-400 font-semibold">
          {arr?.airport?.iata || arr?.airport?.icao || "—"}
        </span>
        {arr?.airport?.municipalityName && (
          <div className="text-xs text-slate-500 mt-0.5">{arr.airport.municipalityName}</div>
        )}
        {arrTime && (
          <div className="text-xs mt-0.5 font-mono text-slate-500">
            Arr. {arrTime}
          </div>
        )}
      </td>
      <td className="px-4 py-3.5">
        <div className="font-mono text-slate-200">
          {displayTime || "—"}
          <DelayBadge scheduled={scheduled} revised={revised} />
        </div>
        {displayDate && <div className="text-xs text-slate-500 mt-0.5">{displayDate}</div>}
      </td>
      <td className="px-4 py-3.5">
        {dep?.gate
          ? <span className="font-mono font-bold text-violet-400">{dep.gate}</span>
          : <span className="text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3.5">
        <span className={`px-2.5 py-0.5 rounded-full text-xs border font-medium ${statusStyle}`}>
          {effectiveStatus}
        </span>
      </td>
    </tr>
  );
}

interface FlightTableProps {
  flights:        Flight[];
  isLoading:      boolean;
  type:           "arrivals" | "departures";
  selectedFlight: Flight | null;
  onFlightSelect: (flight: Flight) => void;
  liveStates?:    LiveAircraftState[];
}

export default function FlightTable({ flights, isLoading, type, selectedFlight, onFlightSelect, liveStates }: FlightTableProps) {
  const isArrival = type === "arrivals";
  const [statusFilter, setStatusFilter] = useState<FlightStatus | "Unknown" | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [type]);
  useEffect(() => { setPage(0); }, [statusFilter]);

  const airborneIcaos = useMemo(() => {
    if (!liveStates) return new Set<string>();
    return new Set(liveStates.filter((s) => !s.on_ground).map((s) => s.icao24.toLowerCase()));
  }, [liveStates]);

  function getEffectiveStatus(flight: Flight): FlightStatus | "Unknown" {
    const modeS = flight.aircraft?.modeS?.toLowerCase();
    if (modeS && airborneIcaos.has(modeS) && flight.status === "Arrived") {
      // Guard: if the arrival time was >60 min ago the aircraft is on a different leg.
      // Only override when the arrival is recent enough to be THIS flight.
      const arrUtc = flight.arrival?.actualTime?.utc
        || flight.arrival?.revisedTime?.utc
        || flight.arrival?.scheduledTime?.utc;
      if (arrUtc) {
        const arrMs = new Date(arrUtc.replace(" ", "T").replace(" ", "")).getTime();
        if (Date.now() - arrMs > 60 * 60 * 1000) return flight.status || "Unknown";
      }
      return "EnRoute";
    }
    return flight.status || "Unknown";
  }

  const presentStatuses = useMemo(() => {
    const counts: Partial<Record<FlightStatus | "Unknown", number>> = {};
    (flights || []).forEach((f) => {
      const s = getEffectiveStatus(f);
      counts[s] = (counts[s] || 0) + 1;
    });
    return STATUS_ORDER.filter((s) => counts[s]).map((s) => ({ status: s, count: counts[s]! }));
  }, [flights, airborneIcaos]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () => statusFilter ? (flights || []).filter((f) => getEffectiveStatus(f) === statusFilter) : (flights || []),
    [flights, statusFilter, airborneIcaos]  // eslint-disable-line react-hooks/exhaustive-deps
  );

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-2">
      {!isLoading && presentStatuses.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter(null)}
            className={`px-3 py-1 rounded-full text-xs border font-medium transition-colors ${
              statusFilter === null
                ? "bg-slate-600 text-slate-100 border-slate-400"
                : "bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300"
            }`}
          >
            All ({(flights || []).length})
          </button>
          {presentStatuses.map(({ status, count }) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? null : status)}
              className={`px-3 py-1 rounded-full text-xs border font-medium transition-colors ${
                statusFilter === status
                  ? CHIP_ACTIVE[status] || CHIP_ACTIVE.Unknown
                  : "bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300"
              }`}
            >
              {status} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Mobile: card list */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 animate-pulse">
              <div className="flex justify-between mb-2">
                <div className="h-4 bg-slate-700 rounded w-20" />
                <div className="h-5 bg-slate-700 rounded-full w-16" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 bg-slate-700 rounded w-24" />
                <div className="h-3 bg-slate-700 rounded w-14" />
              </div>
            </div>
          ))
        ) : paginated.length === 0 ? (
          <div className="rounded-lg border border-slate-700 px-4 py-12 text-center text-slate-500 text-sm">
            {statusFilter
              ? `No ${type} with status "${statusFilter}"`
              : `No ${type} in the current window`}
          </div>
        ) : (
          paginated.map((flight, i) => (
            <FlightCard
              key={flight.number ?? i}
              flight={flight}
              isArrival={isArrival}
              selected={isSelected(flight, selectedFlight)}
              onSelect={onFlightSelect}
              effectiveStatus={getEffectiveStatus(flight)}
            />
          ))
        )}
        {!isLoading && filtered.length > 0 && pageCount > 1 && (
          <div className="flex justify-center pt-1">
            <PaginationControls page={page} pageCount={pageCount} setPage={setPage} />
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/80 text-slate-400 uppercase text-xs tracking-wider">
              <th className="px-4 py-3 text-left">Flight</th>
              <th className="px-4 py-3 text-left">{isArrival ? "From" : "To"}</th>
              <th className="px-4 py-3 text-left">{isArrival ? "Arrives" : "Departs"}</th>
              <th className="px-4 py-3 text-left">{isArrival ? "Belt" : "Gate"}</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  {statusFilter
                    ? `No ${type} with status "${statusFilter}"`
                    : `No ${type} in the current window`}
                </td>
              </tr>
            ) : (
              paginated.map((flight, i) =>
                isArrival ? (
                  <ArrivalRow
                    key={flight.number ?? i}
                    flight={flight}
                    selected={isSelected(flight, selectedFlight)}
                    onSelect={onFlightSelect}
                    effectiveStatus={getEffectiveStatus(flight)}
                  />
                ) : (
                  <DepartureRow
                    key={flight.number ?? i}
                    flight={flight}
                    selected={isSelected(flight, selectedFlight)}
                    onSelect={onFlightSelect}
                    effectiveStatus={getEffectiveStatus(flight)}
                  />
                )
              )
            )}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="px-4 py-2 flex items-center justify-between border-t border-slate-800">
            <span className="text-xs text-slate-600">
              Click a row to track on map · click again to deselect
            </span>
            {pageCount > 1 && (
              <PaginationControls page={page} pageCount={pageCount} setPage={setPage} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
