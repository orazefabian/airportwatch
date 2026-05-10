import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function matchesSelected(state, selectedFlight) {
  if (!selectedFlight) return false;
  if (selectedFlight.aircraft?.modeS) {
    return selectedFlight.aircraft.modeS.toLowerCase() === (state.icao24 || "").toLowerCase();
  }
  return selectedFlight.callSign?.trim().toLowerCase() === (state.callsign || "").trim().toLowerCase();
}

function localTime(timeObj) {
  const raw = timeObj?.local || timeObj?.utc || "";
  const m = raw.match(/\d{2}:\d{2}/);
  return m ? m[0] : null;
}

// ✈ points east by default → subtract 90° so heading 0 = north
function planeIcon(heading, flightType, highlighted) {
  const color = highlighted
    ? "#ffffff"
    : flightType === "departure"
    ? "#a78bfa"
    : "#22d3ee";
  const glow = highlighted ? "#ffffffcc" : color + "66";
  const size = highlighted ? 26 : 20;
  const deg  = (heading ?? 0) - 90;
  const pad  = highlighted ? 24 : 4;
  const total = size + pad;

  const rings = highlighted
    ? `<div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(255,255,255,0.9);animation:sel-ping 1.4s ease-out infinite;"></div>
       <div style="position:absolute;inset:6px;border-radius:50%;border:1px solid rgba(255,255,255,0.35);"></div>`
    : "";

  return L.divIcon({
    className: "",
    html: `
      ${highlighted ? "<style>@keyframes sel-ping{0%{transform:scale(1);opacity:1}100%{transform:scale(1.9);opacity:0}}</style>" : ""}
      <div style="position:relative;width:${total}px;height:${total}px;display:flex;align-items:center;justify-content:center;">
        ${rings}
        <div style="transform:rotate(${deg}deg);font-size:${size}px;line-height:1;color:${color};filter:drop-shadow(0 0 7px ${glow});position:relative;z-index:1;">✈</div>
      </div>`,
    iconSize: [total, total],
    iconAnchor: [total / 2, total / 2],
  });
}

function airportIcon(icao) {
  return L.divIcon({
    className: "",
    html: `
      <style>
        @keyframes rs-ring-pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.7);opacity:0}}
        .rs-ring{animation:rs-ring-pulse 2s ease-out infinite}
      </style>
      <div style="position:relative;width:48px;height:48px;">
        <div class="rs-ring" style="position:absolute;inset:0;border-radius:50%;border:2px solid #22d3ee;transform-origin:center;"></div>
        <div style="position:absolute;inset:6px;border-radius:50%;border:1.5px solid #22d3ee88;"></div>
        <div style="position:absolute;inset:14px;border-radius:50%;background:#22d3ee;box-shadow:0 0 8px #22d3ee,0 0 20px #22d3ee88;"></div>
        <div style="position:absolute;top:52px;left:50%;transform:translateX(-50%);background:#020617;color:#22d3ee;font-size:10px;font-weight:700;letter-spacing:1.5px;padding:2px 7px;border-radius:4px;border:1px solid #22d3ee;white-space:nowrap;font-family:monospace;box-shadow:0 0 8px #22d3ee44;">${icao}</div>
      </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

function originIcon(icao) {
  return L.divIcon({
    className: "",
    html: `
      <style>
        @keyframes orig-pulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.65);opacity:0}}
        .orig-ring{animation:orig-pulse 2.5s ease-out infinite}
      </style>
      <div style="position:relative;width:40px;height:40px;">
        <div class="orig-ring" style="position:absolute;inset:0;border-radius:50%;border:1.5px solid #fbbf24;transform-origin:center;"></div>
        <div style="position:absolute;inset:6px;border-radius:50%;border:1px solid #fbbf2455;"></div>
        <div style="position:absolute;inset:13px;border-radius:50%;background:#fbbf24;box-shadow:0 0 6px #fbbf24,0 0 16px #fbbf2466;"></div>
        <div style="position:absolute;top:44px;left:50%;transform:translateX(-50%);background:#020617;color:#fbbf24;font-size:10px;font-weight:700;letter-spacing:1.5px;padding:2px 7px;border-radius:4px;border:1px solid #fbbf24;white-space:nowrap;font-family:monospace;box-shadow:0 0 8px #fbbf2433;">${icao}</div>
      </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function msToKnots(ms) {
  if (ms == null) return "—";
  return `${Math.round(ms * 1.94384)} kts`;
}

function MapFocusController({ states, selectedFlight, airportCenter, originCoords }) {
  const map = useMap();
  const hasZoomedRef = useRef(false);

  useEffect(() => {
    hasZoomedRef.current = false;
  }, [selectedFlight]);

  useEffect(() => {
    if (!selectedFlight) {
      map.flyTo(airportCenter, 8, { duration: 1.2 });
      return;
    }
    if (hasZoomedRef.current) return;

    const match = states.find((s) => matchesSelected(s, selectedFlight));
    if (match) {
      map.flyTo([match.latitude, match.longitude], 10, { duration: 1.5 });
      hasZoomedRef.current = true;
    } else if (originCoords) {
      map.flyTo([originCoords.lat, originCoords.lon], 7, { duration: 1.5 });
      hasZoomedRef.current = true;
    }
  }, [selectedFlight, states, originCoords]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function FlightMap({ states, center, isLoading, icao, selectedFlight, onFlightSelect, onFlightDeselect }) {
  const arrivals   = (states || []).filter((s) => s.flightType === "arrival");
  const departures = (states || []).filter((s) => s.flightType === "departure");

  const isTracked = selectedFlight && (states || []).some((s) => matchesSelected(s, selectedFlight));

  const depAirport = selectedFlight?.departure?.airport;

  // Whether the scheduled (or revised) departure has already passed
  const depUtc =
    selectedFlight?.departure?.revisedTime?.utc ||
    selectedFlight?.departure?.scheduledTime?.utc;
  const hasDeparted = depUtc
    ? new Date(depUtc.replace(" ", "T").replace(/Z$/, "+00:00")) < new Date()
    : false;

  // Show the departure airport marker whenever the flight isn't tracked — regardless of
  // whether it has departed yet. If it has departed but we have no live position (modeS
  // absent from AeroDataBox or aircraft outside OpenSky coverage), the marker still gives
  // a visual anchor; the label/popup text differentiates the two states.
  const showOrigin =
    !isTracked &&
    selectedFlight &&
    depAirport?.lat != null &&
    depAirport?.icao?.toUpperCase() !== (icao || "").toUpperCase();

  const originCoords = showOrigin ? { lat: depAirport.lat, lon: depAirport.lon } : null;

  // Animated route line — only when the plane has a live position
  const trackedState = isTracked
    ? (states || []).find((s) => matchesSelected(s, selectedFlight))
    : null;
  const planePos = trackedState
    ? [trackedState.latitude, trackedState.longitude]
    : null;
  const routeColor = trackedState?.flightType === "departure" ? "#a78bfa" : "#22d3ee";

  // For arrivals: dep = origin airport (enriched), arr = watched airport (center)
  // For departures: dep = watched airport (center), arr = destination airport (enriched)
  const isArrivalFlight = trackedState?.flightType !== "departure";
  const depApt = selectedFlight?.departure?.airport;
  const arrApt = selectedFlight?.arrival?.airport;
  const routeDepPos = isArrivalFlight
    ? (depApt?.lat != null ? [depApt.lat, depApt.lon] : null)
    : center;
  const routeArrPos = isArrivalFlight
    ? center
    : (arrApt?.lat != null ? [arrApt.lat, arrApt.lon] : null);

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700 h-64 sm:h-[480px]">
      {isLoading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-900/70">
          <span className="text-cyan-400 text-sm animate-pulse">Loading live traffic…</span>
        </div>
      )}

      {/* Prominent banner when selected flight can't be tracked */}
      {selectedFlight && !isTracked && (
        <div className="absolute top-3 inset-x-3 z-[1000] flex justify-center pointer-events-none">
          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium shadow-lg backdrop-blur-sm ${
            hasDeparted
              ? "bg-slate-950/90 border-green-700 text-green-300"
              : "bg-slate-950/90 border-amber-700 text-amber-300"
          }`}>
            <span className="text-base">{hasDeparted ? "✈" : "🅿"}</span>
            <span className="font-mono font-bold">{selectedFlight.number}</span>
            <span className="opacity-40">·</span>
            <span className={hasDeparted ? "text-slate-300" : ""}>
              {hasDeparted
                ? "In the air — live position unavailable"
                : `Parked at ${depAirport?.icao || "origin airport"} — not yet departed`}
            </span>
          </div>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={8}
        style={{ height: "100%", width: "100%", background: "#0d1117" }}
        zoomControl
        attributionControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        <MapFocusController
          states={states || []}
          selectedFlight={selectedFlight}
          airportCenter={center}
          originCoords={originCoords}
        />

        {/* Watched airport */}
        <Marker position={center} icon={airportIcon(icao || "LOWK")} />

        {/* Origin airport — shown when selected arrival hasn't taken off yet */}
        {showOrigin && (
          <Marker position={[depAirport.lat, depAirport.lon]} icon={originIcon(depAirport.icao)}>
            <Popup>
              <div style={{ minWidth: 160, fontFamily: "monospace", fontSize: 13 }}>
                <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 4, color: "#fbbf24" }}>
                  {depAirport.icao} · {depAirport.name}
                </div>
                <div style={{ marginBottom: 6, color: "#888" }}>
                  {selectedFlight.number} · {hasDeparted ? "in the air · position unavailable" : "awaiting departure"}
                </div>
                {selectedFlight.departure?.scheduledTime && (
                  <div>Scheduled dep: {localTime(selectedFlight.departure.scheduledTime)}</div>
                )}
                {selectedFlight.departure?.revisedTime && (
                  <div>Revised dep: {localTime(selectedFlight.departure.revisedTime)}</div>
                )}
                {selectedFlight.aircraft?.model && (
                  <div>Aircraft: {selectedFlight.aircraft.model}</div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Animated route — dep → plane → dest, shown when plane is tracked */}
        {planePos && (
          <>
            {/* Faint guide line for the full route */}
            {routeDepPos && routeArrPos && (
              <Polyline
                positions={[routeDepPos, planePos, routeArrPos]}
                pathOptions={{ color: routeColor, weight: 1.5, opacity: 0.12 }}
              />
            )}
            {/* Dep → plane: dimmer (already flown) */}
            {routeDepPos && (
              <Polyline
                positions={[routeDepPos, planePos]}
                pathOptions={{
                  color: routeColor, weight: 3, opacity: 0.4,
                  dashArray: "4 14", lineCap: "round",
                  className: "route-flow-line",
                }}
              />
            )}
            {/* Plane → dest: brighter (upcoming path) */}
            {routeArrPos && (
              <Polyline
                positions={[planePos, routeArrPos]}
                pathOptions={{
                  color: routeColor, weight: 3, opacity: 0.85,
                  dashArray: "4 14", lineCap: "round",
                  className: "route-flow-line",
                }}
              />
            )}
          </>
        )}

        {/* Live aircraft — scheduled flights only */}
        {(states || []).map((s) => {
          const highlighted = matchesSelected(s, selectedFlight);
          return (
            <Marker
              key={s.icao24}
              position={[s.latitude, s.longitude]}
              icon={planeIcon(s.heading, s.flightType, highlighted)}
              zIndexOffset={highlighted ? 1000 : 0}
              eventHandlers={{ click: () => onFlightSelect(s) }}
            >
              <Popup onClose={highlighted ? onFlightDeselect : undefined}>
                <div style={{ minWidth: 160, fontFamily: "monospace", fontSize: 13 }}>
                  <div style={{ fontWeight: "bold", fontSize: 15, marginBottom: 4 }}>
                    {s.callsign || s.icao24}
                    {highlighted && <span style={{ color: "#22d3ee", marginLeft: 6, fontSize: 11 }}>● tracking</span>}
                  </div>
                  <div>Type: {s.flightType === "arrival" ? "➡ Arriving" : "⬅ Departing"}</div>
                  <div>Country: {s.origin_country}</div>
                  <div>Altitude: {s.altitude != null ? `${Math.round(s.altitude)} m` : "—"}</div>
                  <div>Speed: {msToKnots(s.velocity)}</div>
                  <div>Heading: {s.heading != null ? `${Math.round(s.heading)}°` : "—"}</div>
                  <div>Status: {s.on_ground ? "🟡 On ground" : "🟢 Airborne"}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-x-3 gap-y-1 text-xs bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700 max-w-[calc(100%-1.5rem)]">
        <span><span style={{ color: "#22d3ee" }}>✈</span> Arrivals ({arrivals.length})</span>
        <span><span style={{ color: "#a78bfa" }}>✈</span> Departures ({departures.length})</span>
        {selectedFlight && isTracked && (
          <span><span style={{ color: "#ffffff" }}>✈</span> {selectedFlight.number} · tracking</span>
        )}
      </div>

      {!isLoading && (states || []).length === 0 && !selectedFlight && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-[1000] text-center text-slate-500 text-sm pointer-events-none">
          No scheduled aircraft currently in range
        </div>
      )}
    </div>
  );
}
