import SkeletonRow from "./SkeletonRow";

function msToKnots(ms) {
  if (ms == null) return "—";
  return Math.round(ms * 1.94384);
}

export default function LiveTraffic({ states, isLoading, error, onRetry }) {
  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/30 p-6 text-center">
        <p className="text-red-400 mb-3 text-sm">{error.message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm bg-red-800 hover:bg-red-700 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800 text-slate-400 uppercase text-xs tracking-wider">
            <th className="px-4 py-3 text-left">Callsign</th>
            <th className="px-4 py-3 text-left">Country</th>
            <th className="px-4 py-3 text-left">Altitude (m)</th>
            <th className="px-4 py-3 text-left">Speed (kts)</th>
            <th className="px-4 py-3 text-left">Heading</th>
            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
          ) : !states || states.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                No airborne aircraft detected near this airport
              </td>
            </tr>
          ) : (
            states.map((s) => (
              <tr
                key={s.icao24}
                className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-cyan-400 font-semibold">
                  {s.callsign || s.icao24}
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs">{s.origin_country}</td>
                <td className="px-4 py-3 text-slate-300">
                  {s.altitude != null ? Math.round(s.altitude) : "—"}
                </td>
                <td className="px-4 py-3 text-slate-300">{msToKnots(s.velocity)}</td>
                <td className="px-4 py-3 text-slate-300">
                  {s.heading != null ? `${Math.round(s.heading)}°` : "—"}
                </td>
                <td className="px-4 py-3">
                  {s.on_ground ? (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-amber-900/50 text-amber-400 border border-amber-800">
                      Ground
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-900/50 text-green-400 border border-green-800">
                      Airborne
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
