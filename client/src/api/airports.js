import api from "./client";

export async function fetchAirports() {
  const { data } = await api.get("/airports");
  return data;
}

export async function fetchFlights(icao) {
  const { data } = await api.get(`/flights/${icao}`);
  return data;
}

export async function fetchLiveTraffic(icao) {
  const { data } = await api.get(`/live/${icao}`);
  return data;
}

export async function fetchSchedule(icao, windowHours = 4) {
  const { data } = await api.get(`/schedule/${icao}`, { params: { window: windowHours } });
  return data;
}

export async function fetchTrack(icao24Codes) {
  if (!icao24Codes?.length) return [];
  const { data } = await api.get("/track", { params: { icao24: icao24Codes.join(",") } });
  return data;
}
