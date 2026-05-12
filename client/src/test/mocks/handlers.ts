import { http, HttpResponse } from "msw";
import { AIRPORTS_FIXTURE } from "./fixtures/airports";
import { SCHEDULE_FIXTURE, EMPTY_SCHEDULE_FIXTURE } from "./fixtures/schedule";

const API_BASE = "/api";

export const handlers = [
  http.get(`${API_BASE}/airports`, () => HttpResponse.json(AIRPORTS_FIXTURE)),

  http.get(`${API_BASE}/schedule/:icao`, ({ params, request }) => {
    const url = new URL(request.url);
    const window = url.searchParams.get("window");
    if (params.icao === "ZERO") {
      // Simulate AeroDataBox returning 404 for an empty time window
      return new HttpResponse(null, { status: 404 });
    }
    if (window === "2") {
      return HttpResponse.json(EMPTY_SCHEDULE_FIXTURE);
    }
    return HttpResponse.json(SCHEDULE_FIXTURE);
  }),

  http.get(`${API_BASE}/track`, () => HttpResponse.json([])),
];
