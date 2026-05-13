import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Flight, LiveAircraftState } from "../types";

function matchesSelected(state: LiveAircraftState, selectedFlight: Flight | null): boolean {
  if (!selectedFlight) return false;
  if (selectedFlight.aircraft?.modeS) {
    return selectedFlight.aircraft.modeS.toLowerCase() === (state.icao24 || "").toLowerCase();
  }
  return selectedFlight.callSign?.trim().toLowerCase() === (state.callsign || "").trim().toLowerCase();
}

function localTime(timeObj: { local?: string; utc?: string } | null | undefined): string | null {
  const raw = timeObj?.local || timeObj?.utc || "";
  const m = raw.match(/\d{2}:\d{2}/);
  return m ? m[0] : null;
}

function planeIcon(heading: number | null, flightType: "arrival" | "departure" | undefined, highlighted: boolean): L.DivIcon {
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

function airportIcon(icao: string): L.DivIcon {
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

function destIcon(icao: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `
      <style>
        @keyframes dest-pulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.65);opacity:0}}
        .dest-ring{animation:dest-pulse 2.5s ease-out infinite}
      </style>
      <div style="position:relative;width:40px;height:40px;">
        <div class="dest-ring" style="position:absolute;inset:0;border-radius:50%;border:1.5px solid #a78bfa;transform-origin:center;"></div>
        <div style="position:absolute;inset:6px;border-radius:50%;border:1px solid #a78bfa55;"></div>
        <div style="position:absolute;inset:13px;border-radius:50%;background:#a78bfa;box-shadow:0 0 6px #a78bfa,0 0 16px #a78bfa66;"></div>
        <div style="position:absolute;top:44px;left:50%;transform:translateX(-50%);background:#020617;color:#a78bfa;font-size:10px;font-weight:700;letter-spacing:1.5px;padding:2px 7px;border-radius:4px;border:1px solid #a78bfa;white-space:nowrap;font-family:monospace;box-shadow:0 0 8px #a78bfa33;">${icao}</div>
      </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function originIcon(icao: string): L.DivIcon {
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

function parseAdbUtc(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw.replace(" ", "T").replace(" ", ""));
  return isNaN(d.getTime()) ? null : d;
}

function msToKnots(ms: number | null): string {
  if (ms == null) return "—";
  return `${Math.round(ms * 1.94384)} kts`;
}

interface MapFocusControllerProps {
  states:        LiveAircraftState[];
  selectedFlight: Flight | null;
  airportCenter:  [number, number];
  originCoords:   { lat: number; lon: number } | null;
  destCoords:     { lat: number; lon: number } | null;
}

function MapFocusController({ states, selectedFlight, airportCenter, originCoords, destCoords }: MapFocusControllerProps) {
  const map = useMap();
  const hasZoomedRef = useRef<boolean>(false);

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
    } else if (destCoords) {
      map.flyTo([destCoords.lat, destCoords.lon], 7, { duration: 1.5 });
      hasZoomedRef.current = true;
    }
  }, [selectedFlight, states, originCoords, destCoords]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

interface FlightMapProps {
  states:          LiveAircraftState[];
  center:          [number, number];
  isLoading:       boolean;
  icao:            string;
  selectedFlight:  Flight | null;
  onFlightSelect:  (state: LiveAircraftState) => void;
  onFlightDeselect: () => void;
}

export default function FlightMap({ states, center, isLoading, icao, selectedFlight, onFlightSelect, onFlightDeselect }: FlightMapProps) {
  const arrivals   = (states || []).filter((s) => s.flightType === "arrival");
  const departures = (states || []).filter((s) => s.flightType === "departure");

  const isTracked = selectedFlight && (states || []).some((s) => matchesSelected(s, selectedFlight));

  const depAirport = selectedFlight?.departure?.airport;

  const depUtc =
    selectedFlight?.departure?.revisedTime?.utc ||
    selectedFlight?.departure?.scheduledTime?.utc;
  const now          = new Date();
  const hasDeparted  = (parseAdbUtc(depUtc) ?? new Date(0)) < now;

  const arrActualUtc = selectedFlight?.arrival?.actualTime?.utc;
  const hasArrived = arrActualUtc
    ? (parseAdbUtc(arrActualUtc) ?? new Date(8640000000000000)) < now
    : selectedFlight?.status === "Arrived";

  const arrAirport = selectedFlight?.arrival?.airport;
  // AeroDataBox omits the ICAO of the queried airport on whichever side it appears.
  // For arrivals: depAirport.icao is present (origin is not our airport).
  // For departures: depAirport.icao is absent (AeroDataBox omits it as the queried airport).
  // So: presence of a non-matching depAirport.icao means it's an arrival flight.
  const isUntrackedArrival =
    depAirport?.icao != null && depAirport.icao.toUpperCase() !== (icao || "").toUpperCase();

  const estimatedDepPos: [number, number] | null = isUntrackedArrival
    ? (depAirport?.lat != null && depAirport?.lon != null ? [depAirport.lat, depAirport.lon] : null)
    : center;
  const estimatedArrPos: [number, number] | null = isUntrackedArrival
    ? center
    : (arrAirport?.lat != null && arrAirport?.lon != null ? [arrAirport.lat, arrAirport.lon] : null);
  const estimatedRouteColor = isUntrackedArrival ? "#22d3ee" : "#a78bfa";

const showEstimatedRoute =
    !isTracked &&
    !!selectedFlight &&
    hasDeparted &&
    !hasArrived &&
    estimatedDepPos !== null &&
    estimatedArrPos !== null;

  const showDest =
    showEstimatedRoute &&
    !isUntrackedArrival &&
    arrAirport?.lat != null &&
    arrAirport?.icao?.toUpperCase() !== (icao || "").toUpperCase();

  const destCoords = showDest ? { lat: arrAirport!.lat!, lon: arrAirport!.lon! } : null;

  const showOrigin =
    !isTracked &&
    selectedFlight &&
    depAirport?.lat != null &&
    depAirport?.icao?.toUpperCase() !== (icao || "").toUpperCase();

  const originCoords = showOrigin ? { lat: depAirport!.lat!, lon: depAirport!.lon! } : null;

  const trackedState = isTracked
    ? (states || []).find((s) => matchesSelected(s, selectedFlight))
    : null;
  const planePos = trackedState
    ? [trackedState.latitude, trackedState.longitude] as [number, number]
    : null;
  const routeColor = trackedState?.flightType === "departure" ? "#a78bfa" : "#22d3ee";

  const isArrivalFlight = trackedState?.flightType !== "departure";
  const depApt = selectedFlight?.departure?.airport;
  const arrApt = selectedFlight?.arrival?.airport;
  const routeDepPos: [number, number] | null = isArrivalFlight
    ? (depApt?.lat != null && depApt?.lon != null ? [depApt.lat, depApt.lon] : null)
    : center;
  const routeArrPos: [number, number] | null = isArrivalFlight
    ? center
    : (arrApt?.lat != null && arrApt?.lon != null ? [arrApt.lat, arrApt.lon] : null);

  return (
    <div>
    <div className="relative rounded-xl overflow-hidden border border-slate-700 h-64 sm:h-[480px]">
      {isLoading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-900/70">
          <span className="text-cyan-400 text-sm animate-pulse">Loading live traffic…</span>
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
          destCoords={destCoords}
        />

        <Marker position={center} icon={airportIcon(icao || "LOWK")} />

        {showOrigin && depAirport?.lat != null && depAirport?.lon != null && (
          <Marker position={[depAirport.lat, depAirport.lon]} icon={originIcon(depAirport.icao)}>
            <Popup>
              <div style={{ minWidth: 160, fontFamily: "monospace", fontSize: 13 }}>
                <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 4, color: "#fbbf24" }}>
                  {depAirport.icao} · {depAirport.name}
                </div>
                <div style={{ marginBottom: 6, color: "#888" }}>
                  {selectedFlight!.number} · {hasDeparted ? "in the air · position unavailable" : "awaiting departure"}
                </div>
                {selectedFlight!.departure?.scheduledTime && (
                  <div>Scheduled dep: {localTime(selectedFlight!.departure.scheduledTime)}</div>
                )}
                {selectedFlight!.departure?.revisedTime && (
                  <div>Revised dep: {localTime(selectedFlight!.departure.revisedTime)}</div>
                )}
                {selectedFlight!.aircraft?.model && (
                  <div>Aircraft: {selectedFlight!.aircraft.model}</div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {showDest && arrAirport?.lat != null && arrAirport?.lon != null && (
          <Marker position={[arrAirport.lat, arrAirport.lon]} icon={destIcon(arrAirport.icao)}>
            <Popup>
              <div style={{ minWidth: 160, fontFamily: "monospace", fontSize: 13 }}>
                <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 4, color: "#a78bfa" }}>
                  {arrAirport.icao} · {arrAirport.name}
                </div>
                <div style={{ marginBottom: 6, color: "#888" }}>
                  {selectedFlight!.number} · in the air · position unavailable
                </div>
                {selectedFlight!.arrival?.scheduledTime && (
                  <div>Scheduled arr: {localTime(selectedFlight!.arrival.scheduledTime)}</div>
                )}
                {selectedFlight!.arrival?.revisedTime && (
                  <div>Revised arr: {localTime(selectedFlight!.arrival.revisedTime)}</div>
                )}
                {selectedFlight!.aircraft?.model && (
                  <div>Aircraft: {selectedFlight!.aircraft.model}</div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {showEstimatedRoute && estimatedDepPos && estimatedArrPos && (
          <>
            <Polyline
              positions={[estimatedDepPos, estimatedArrPos]}
              pathOptions={{ color: estimatedRouteColor, weight: 1.5, opacity: 0.12 }}
            />
            <Polyline
              positions={[estimatedDepPos, estimatedArrPos]}
              pathOptions={{
                color: estimatedRouteColor, weight: 3, opacity: 0.65,
                dashArray: "6 16", lineCap: "round",
                className: "route-estimated-line",
              }}
            />
          </>
        )}

        {planePos && (
          <>
            {routeDepPos && routeArrPos && (
              <Polyline
                positions={[routeDepPos, planePos, routeArrPos]}
                pathOptions={{ color: routeColor, weight: 1.5, opacity: 0.12 }}
              />
            )}
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
              <Popup eventHandlers={highlighted && onFlightDeselect ? { popupclose: onFlightDeselect } : {}}>
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

      <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-x-3 gap-y-1 text-xs bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700 max-w-[calc(100%-1.5rem)]">
        <span><span style={{ color: "#22d3ee" }}>✈</span> Arrivals ({arrivals.length})</span>
        <span><span style={{ color: "#a78bfa" }}>✈</span> Departures ({departures.length})</span>
        {selectedFlight && isTracked && (
          <span><span style={{ color: "#ffffff" }}>✈</span> {selectedFlight.number} · tracking</span>
        )}
        {showEstimatedRoute && (
          <span><span style={{ color: estimatedRouteColor }}>- -</span> {selectedFlight!.number} · estimated route</span>
        )}
      </div>

      {!isLoading && (states || []).length === 0 && !selectedFlight && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-[1000] text-center text-slate-500 text-sm pointer-events-none">
          No scheduled aircraft currently in range
        </div>
      )}
    </div>
    </div>
  );
}
