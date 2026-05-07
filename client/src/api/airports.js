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
