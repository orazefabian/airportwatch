import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAirports } from "../api/airports";
import type { Airport } from "../types";

const STORAGE_KEY = "airportwatch_last_airport";

export default function AirportSelector() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: airports = [], isLoading } = useQuery<Airport[]>({
    queryKey: ["airports"],
    queryFn: fetchAirports,
    staleTime: Infinity,
  });

  const lastIcao = localStorage.getItem(STORAGE_KEY);
  const lastAirport = airports.find((a) => a.icao === lastIcao);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return airports;
    return airports.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.iata.toLowerCase().includes(q) ||
        a.icao.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q)
    );
  }, [airports, search]);

  function select(airport: Airport) {
    localStorage.setItem(STORAGE_KEY, airport.icao);
    navigate(`/airport/${airport.icao}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-center mb-2 text-slate-100">
          Select an Airport
        </h1>
        <p className="text-center text-slate-400 mb-8 text-sm">
          Track real-time arrivals, departures, and live traffic
        </p>

        {lastAirport && (
          <div className="mb-6 p-4 rounded-lg border border-cyan-800 bg-cyan-950/30">
            <p className="text-xs text-cyan-400 uppercase tracking-wider mb-2">Last visited</p>
            <button
              onClick={() => select(lastAirport)}
              className="w-full text-left hover:text-cyan-300 transition-colors"
            >
              <span className="font-semibold text-slate-100">{lastAirport.name}</span>
              <span className="text-slate-400 text-sm ml-2">
                {lastAirport.iata} · {lastAirport.city}, {lastAirport.country}
              </span>
            </button>
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            placeholder="Search by airport name, city, IATA or ICAO code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
          />

          {open && (search || !lastAirport) && (
            <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl max-h-80 overflow-y-auto scrollbar-thin">
              {isLoading ? (
                <div className="px-4 py-6 text-center text-slate-400 text-sm">Loading airports...</div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-400 text-sm">No airports found</div>
              ) : (
                filtered.map((airport) => (
                  <button
                    key={airport.icao}
                    onClick={() => {
                      setOpen(false);
                      setSearch("");
                      select(airport);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-700 border-b border-slate-700 last:border-0 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-100 text-sm">{airport.name}</span>
                      <span className="text-xs font-mono text-cyan-400 ml-2 flex-shrink-0">
                        {airport.iata} / {airport.icao}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {airport.city}, {airport.country}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {open && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
