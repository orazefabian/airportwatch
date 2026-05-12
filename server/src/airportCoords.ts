import coordsJson from "./data/airportCoords.json";

const coords = coordsJson as unknown as Record<string, [number, number]>;

export function getCoords(icao: string): { lat: number; lon: number } | null {
  const pair = coords[(icao || "").toUpperCase()];
  return pair ? { lat: pair[0], lon: pair[1] } : null;
}
