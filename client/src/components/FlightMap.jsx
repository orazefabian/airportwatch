import { MapContainer, TileLayer, Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const AIRPORT_ICON = L.divIcon({
  className: "",
  html: `<div style="font-size:22px;line-height:1;" title="LOWK">🛬</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function planeIcon(heading, onGround) {
  const color = onGround ? "#f59e0b" : "#22d3ee";
  const deg = heading ?? 0;
  return L.divIcon({
    className: "",
    html: `
      <div style="transform:rotate(${deg}deg);width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${color}">
          <path d="M12 2L8 9H3l3 3-1 8 7-4 7 4-1-8 3-3h-5L12 2z"/>
        </svg>
      </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function msToKnots(ms) {
  if (ms == null) return "—";
  return `${Math.round(ms * 1.94384)} kts`;
}

export default function FlightMap({ states, center, isLoading }) {
  const validStates = (states || []).filter(
    (s) => s.latitude != null && s.longitude != null
  );

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700" style={{ height: 480 }}>
      {isLoading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-900/70">
          <span className="text-cyan-400 text-sm animate-pulse">Loading live traffic…</span>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={8}
        style={{ height: "100%", width: "100%", background: "#0d1117" }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Airport marker */}
        <Marker position={center} icon={AIRPORT_ICON}>
          <Tooltip permanent direction="top" offset={[0, -10]}>
            <span className="text-xs font-bold">LOWK</span>
          </Tooltip>
        </Marker>

        {/* Aircraft markers */}
        {validStates.map((s) => (
          <Marker
            key={s.icao24}
            position={[s.latitude, s.longitude]}
            icon={planeIcon(s.heading, s.on_ground)}
          >
            <Popup>
              <div style={{ minWidth: 160, fontFamily: "monospace", fontSize: 13 }}>
                <div style={{ fontWeight: "bold", fontSize: 15, marginBottom: 4 }}>
                  {s.callsign || s.icao24}
                </div>
                <div>Country: {s.origin_country}</div>
                <div>Altitude: {s.altitude != null ? `${Math.round(s.altitude)} m` : "—"}</div>
                <div>Speed: {msToKnots(s.velocity)}</div>
                <div>Heading: {s.heading != null ? `${Math.round(s.heading)}°` : "—"}</div>
                <div>Status: {s.on_ground ? "🟡 On ground" : "🟢 Airborne"}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute bottom-3 left-3 z-[1000] flex gap-3 text-xs bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700">
        <span><span style={{ color: "#22d3ee" }}>●</span> Airborne ({validStates.filter(s => !s.on_ground).length})</span>
        <span><span style={{ color: "#f59e0b" }}>●</span> Ground ({validStates.filter(s => s.on_ground).length})</span>
      </div>
    </div>
  );
}
