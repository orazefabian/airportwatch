import { Link } from "react-router-dom";
import { useCountdown } from "../hooks/useCountdown";

export default function Navbar({ showTimer = false, refetchInterval = 60 }) {
  const remaining = useCountdown(refetchInterval);

  return (
    <nav className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
        <RadarIcon />
        <span className="text-base sm:text-xl font-bold tracking-wider sm:tracking-widest text-cyan-400 group-hover:text-cyan-300 transition-colors">
          AIRPORT<span className="text-slate-200">WATCH</span>
        </span>
      </Link>

      {showTimer && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          <span className="hidden sm:inline">Refreshing in </span>
          <span className="text-cyan-400 font-mono font-bold">{remaining}s</span>
        </div>
      )}
    </nav>
  );
}

function RadarIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="flex-shrink-0">
      <circle cx="16" cy="16" r="14" fill="none" stroke="#164e63" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#164e63" strokeWidth="1" />
      <circle cx="16" cy="16" r="4" fill="none" stroke="#164e63" strokeWidth="1" />
      <circle cx="16" cy="16" r="1.5" fill="#22d3ee" />
      <g className="radar-sweep" style={{ transformOrigin: "16px 16px" }}>
        <line x1="16" y1="16" x2="16" y2="2" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        <path d="M16 16 L16 2 A14 14 0 0 1 27 10 Z" fill="#22d3ee" opacity="0.15" />
      </g>
    </svg>
  );
}
