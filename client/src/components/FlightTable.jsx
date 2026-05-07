import SkeletonRow from "./SkeletonRow";

function formatTime(unixSeconds) {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FlightTable({ flights, isLoading, type }) {
  const isArrival = type === "arrivals";

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800 text-slate-400 uppercase text-xs tracking-wider">
            <th className="px-4 py-3 text-left">Callsign</th>
            <th className="px-4 py-3 text-left">{isArrival ? "Origin" : "Destination"}</th>
            <th className="px-4 py-3 text-left">First Seen</th>
            <th className="px-4 py-3 text-left">Last Seen</th>
            <th className="px-4 py-3 text-left">ICAO24</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
          ) : flights.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                No {type} found in the last 2 hours
              </td>
            </tr>
          ) : (
            flights.map((flight, i) => (
              <tr
                key={`${flight.icao24}-${i}`}
                className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-cyan-400 font-semibold">
                  {flight.callsign || "—"}
                </td>
                <td className="px-4 py-3 font-mono text-slate-300">
                  {isArrival
                    ? flight.estDepartureAirport || "—"
                    : flight.estArrivalAirport || "—"}
                </td>
                <td className="px-4 py-3 text-slate-300">{formatTime(flight.firstSeen)}</td>
                <td className="px-4 py-3 text-slate-300">{formatTime(flight.lastSeen)}</td>
                <td className="px-4 py-3 font-mono text-slate-500 text-xs">{flight.icao24}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
