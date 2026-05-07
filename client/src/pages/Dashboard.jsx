import { useState, Suspense, lazy } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "../components/Navbar";
import FlightTable from "../components/FlightTable";
import { fetchAirports, fetchFlights, fetchLiveTraffic } from "../api/airports";

// Lazy-load the map so Leaflet doesn't block initial render
const FlightMap = lazy(() => import("../components/FlightMap"));

const REFETCH_MS = 60 * 1000;

export default function Dashboard() {
  const { icao } = useParams();
  const [activeTab, setActiveTab] = useState("arrivals");

  const { data: airports = [] } = useQuery({
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
    queryKey: ["flights", icao],
    queryFn: () => fetchFlights(icao),
    refetchInterval: REFETCH_MS,
    retry: 1,
  });

  const {
    data: liveStates,
    isLoading: liveLoading,
    error: liveError,
    refetch: refetchLive,
  } = useQuery({
    queryKey: ["live", icao],
    queryFn: () => fetchLiveTraffic(icao),
    refetchInterval: REFETCH_MS,
    retry: 1,
  });

  const arrivals = flightData?.arrivals || [];
  const departures = flightData?.departures || [];
  const mapCenter = airport ? [airport.lat, airport.lon] : [46.6425, 14.3376];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar showTimer refetchInterval={60} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">

        {/* Back / change airport */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-400 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Change airport
        </Link>

        {/* Airport header */}
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
          {airport ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-100">{airport.name}</h1>
                <p className="text-slate-400 mt-1">{airport.city}, {airport.country}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge label="ICAO" value={airport.icao} />
                <Badge label="IATA" value={airport.iata} />
                <StatBadge label="Arrivals (2h)" value={flightsLoading ? "…" : arrivals.length} color="cyan" />
                <StatBadge label="Departures (2h)" value={flightsLoading ? "…" : departures.length} color="violet" />
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

        {/* Live map */}
        <section>
          <h2 className="text-base font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live Traffic Map
            <span className="text-xs text-slate-500 font-normal">~150 km radius · click aircraft for details</span>
            {liveError && (
              <button onClick={refetchLive} className="ml-auto text-xs text-red-400 hover:text-red-300">
                Retry
              </button>
            )}
          </h2>

          <Suspense fallback={<MapPlaceholder />}>
            <FlightMap
              states={liveStates}
              center={mapCenter}
              isLoading={liveLoading}
            />
          </Suspense>
        </section>

        {/* Arrivals / Departures */}
        <section>
          <div className="flex gap-1 mb-4 border-b border-slate-700">
            {["arrivals", "departures"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
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

          {flightsError ? (
            <ErrorCard message={flightsError.message} onRetry={refetchFlights} />
          ) : (
            <FlightTable
              flights={activeTab === "arrivals" ? arrivals : departures}
              isLoading={flightsLoading}
              type={activeTab}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <div className="text-center bg-slate-800 rounded-lg px-4 py-2 border border-slate-700">
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="font-mono font-bold text-cyan-400 text-lg leading-tight">{value}</div>
    </div>
  );
}

function StatBadge({ label, value, color }) {
  const colors = {
    cyan: "text-cyan-400 border-cyan-900 bg-cyan-950/40",
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

function ErrorCard({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-800 bg-red-950/30 p-6 text-center">
      <p className="text-red-400 mb-3 text-sm">{message}</p>
      <button onClick={onRetry} className="px-4 py-2 text-sm bg-red-800 hover:bg-red-700 rounded-lg transition-colors">
        Retry
      </button>
    </div>
  );
}
