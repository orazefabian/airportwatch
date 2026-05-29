import { useState, useRef, useMemo, Suspense, lazy } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Navbar from "../components/Navbar";
import FlightTable from "../components/FlightTable";
import FlightStatusBanner from "../components/FlightStatusBanner";
import { fetchAirports, fetchSchedule, fetchTrack } from "../api/airports";
import type { Airport, Flight, LiveAircraftState } from "../types";

const FlightMap = lazy(() => import("../components/FlightMap"));

const REFETCH_MS = 60 * 1000;

export default function Dashboard() {
  const { icao: icaoParam } = useParams<{ icao: string }>();
  const icao = icaoParam ?? "LOWK";

  const [activeTab, setActiveTab] = useState<"arrivals" | "departures">("arrivals");
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [windowHours, setWindowHours] = useState(4);
  const mapRef = useRef<HTMLElement>(null);

  const { data: airports = [] } = useQuery<Airport[]>({
    queryKey: ["airports"],
    queryFn: fetchAirports,
    staleTime: Infinity,
  });

  const airport = airports.find((a) => a.icao === icao.toUpperCase());

  const {
    data: flightData,
    isLoading: flightsLoading,
    error: flightsError,
    refetch: refetchFlights,
  } = useQuery({
    queryKey: ["schedule", icao, windowHours],
    queryFn: () => fetchSchedule(icao, windowHours),
    staleTime: 15 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 429) return false;
      return failureCount < 2;
    },
  });

  const arrivals:   Flight[] = flightData?.arrivals   || [];
  const departures: Flight[] = flightData?.departures || [];
  const mapCenter: [number, number] = airport ? [airport.lat, airport.lon] : [46.6425, 14.3376];

  const icao24Map = useMemo(() => {
    const map: Record<string, { flightType: "arrival" | "departure"; flight: Flight }> = {};
    arrivals.forEach((f) => {
      const code = f.aircraft?.modeS?.toLowerCase();
      if (code) map[code] = { flightType: "arrival", flight: f };
    });
    departures.forEach((f) => {
      const code = f.aircraft?.modeS?.toLowerCase();
      if (code) map[code] = { flightType: "departure", flight: f };
    });
    return map;
  }, [arrivals, departures]);

  const icao24Codes = useMemo(() => Object.keys(icao24Map), [icao24Map]);

  const {
    data: trackedStates,
    isLoading: trackLoading,
    error: trackError,
    refetch: refetchTrack,
  } = useQuery({
    queryKey: ["track", icao24Codes.join(",")],
    queryFn: () => fetchTrack(icao24Codes),
    staleTime: REFETCH_MS,
    enabled: icao24Codes.length > 0,
    refetchInterval: REFETCH_MS,
    retry: 1,
  });

  const relevantStates = useMemo((): LiveAircraftState[] => {
    if (!trackedStates) return [];
    return trackedStates
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => {
        const info = icao24Map[s.icao24?.toLowerCase()];
        return info ? { ...s, flightType: info.flightType } : null;
      })
      .filter((s) => s !== null) as LiveAircraftState[];
  }, [trackedStates, icao24Map]);

  function handleFlightSelect(flight: Flight) {
    if (selectedFlight?.number === flight.number && selectedFlight?.callSign === flight.callSign) {
      setSelectedFlight(null);
      return;
    }
    setSelectedFlight(flight);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleMapPlaneClick(state: LiveAircraftState) {
    const info = icao24Map[state.icao24?.toLowerCase()];
    if (!info) return;
    setActiveTab(info.flightType === "arrival" ? "arrivals" : "departures");
    const flight = info.flight;
    if (selectedFlight?.number === flight.number && selectedFlight?.callSign === flight.callSign) {
      setSelectedFlight(null);
    } else {
      setSelectedFlight(flight);
    }
  }

  const isTracked = useMemo(() => {
    if (!selectedFlight) return false;
    return relevantStates.some((s) => {
      if (selectedFlight.aircraft?.modeS) {
        return selectedFlight.aircraft.modeS.toLowerCase() === (s.icao24 || "").toLowerCase();
      }
      return selectedFlight.callSign?.trim().toLowerCase() === (s.callsign || "").trim().toLowerCase();
    });
  }, [selectedFlight, relevantStates]);

  const mapLoading = trackLoading && icao24Codes.length > 0;
  const mapError   = trackError;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar showTimer refetchInterval={60} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">

        <Link to="/select" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Change airport
        </Link>

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
          {airport ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-100">{airport.name}</h1>
                <p className="text-slate-400 mt-1">{airport.city}, {airport.country}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge label="ICAO" value={airport.icao} />
                <Badge label="IATA" value={airport.iata} />
                <StatBadge label="Arrivals"   value={flightsLoading ? "…" : arrivals.length}   color="cyan"   />
                <StatBadge label="Departures" value={flightsLoading ? "…" : departures.length} color="violet" />
              </div>
            </div>
          ) : (
            <div className="animate-pulse flex justify-between">
              <div>
                <div className="h-7 bg-slate-700 rounded w-64 mb-2" />
                <div className="h-4 bg-slate-700 rounded w-40" />
              </div>
            </div>
          )}
        </div>

        <section>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-4 border-b border-slate-700">
            <div className="flex gap-1">
              {(["arrivals", "departures"] as const).map((tab) => (
                <button
                  key={tab}
                  aria-selected={activeTab === tab}
                  onClick={() => { setActiveTab(tab); setSelectedFlight(null); }}
                  className={`px-5 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? "border-cyan-500 text-cyan-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab}
                  {!flightsLoading && flightData && (
                    <span className="ml-2 text-xs bg-slate-800 px-1.5 py-0.5 rounded-full">
                      {tab === "arrivals" ? arrivals.length : departures.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 py-2 sm:pb-2 overflow-x-auto">
              <span className="text-xs text-slate-500 mr-1 flex-shrink-0">Window</span>
              {[2, 4, 8, 12, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => { setWindowHours(h); setSelectedFlight(null); }}
                  className={`flex-shrink-0 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    windowHours === h
                      ? "bg-cyan-900/60 text-cyan-300 border-cyan-700"
                      : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-500"
                  }`}
                >
                  ±{h}h
                </button>
              ))}
            </div>
          </div>

          {flightsError && !flightData ? (
            <ErrorCard message={(flightsError as Error).message} onRetry={refetchFlights} />
          ) : (
            <>
              {flightsError && <StaleDataBanner onRetry={refetchFlights} />}
              <FlightTable
                flights={activeTab === "arrivals" ? arrivals : departures}
                isLoading={flightsLoading}
                type={activeTab}
                selectedFlight={selectedFlight}
                onFlightSelect={handleFlightSelect}
                liveStates={relevantStates}
              />
            </>
          )}
        </section>

        <section ref={mapRef}>
          <h2 className="text-base font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live Traffic Map
            <span className="text-xs text-slate-500 font-normal">scheduled flights only · worldwide tracking</span>
            {selectedFlight && (
              <span className="ml-2 text-xs text-cyan-400 font-medium">Tracking {selectedFlight.number}</span>
            )}
            {mapError && (
              <button onClick={() => refetchTrack()} className="ml-auto text-xs text-red-400 hover:text-red-300">Retry</button>
            )}
          </h2>

          {selectedFlight && (
            <FlightStatusBanner flight={selectedFlight} isTracked={isTracked} />
          )}

          <Suspense fallback={<MapPlaceholder />}>
            <FlightMap
              states={relevantStates}
              center={mapCenter}
              isLoading={mapLoading}
              icao={icao.toUpperCase()}
              selectedFlight={selectedFlight}
              onFlightSelect={handleMapPlaneClick}
              onFlightDeselect={() => setSelectedFlight(null)}
            />
          </Suspense>
        </section>

      </main>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center bg-slate-800 rounded-lg px-4 py-2 border border-slate-700">
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="font-mono font-bold text-cyan-400 text-lg leading-tight">{value}</div>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: string | number; color: "cyan" | "violet" }) {
  const colors = {
    cyan:   "text-cyan-400 border-cyan-900 bg-cyan-950/40",
    violet: "text-violet-400 border-violet-900 bg-violet-950/40",
  };
  return (
    <div className={`text-center rounded-lg px-4 py-2 border ${colors[color]}`}>
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="font-mono font-bold text-2xl leading-tight">{value}</div>
    </div>
  );
}

function MapPlaceholder() {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 flex items-center justify-center" style={{ height: 480 }}>
      <span className="text-slate-500 text-sm animate-pulse">Loading map…</span>
    </div>
  );
}

function StaleDataBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between rounded-lg border border-amber-800/50 bg-amber-950/20 px-4 py-2 text-xs text-amber-400">
      <span>Could not refresh — showing last known data</span>
      <button onClick={onRetry} className="ml-3 underline hover:text-amber-300">Retry</button>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-red-800 bg-red-950/30 p-6 text-center">
      <p className="text-red-400 mb-3 text-sm">{message}</p>
      <button onClick={onRetry} className="px-4 py-2 text-sm bg-red-800 hover:bg-red-700 rounded-lg transition-colors">
        Retry
      </button>
    </div>
  );
}
