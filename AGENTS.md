# AGENTS.md — AirportWatch Project Context

> **Live Document — AI Agent Maintenance Required**
> This file is the authoritative context source for AI agents working in this repository. Every agent that makes a substantive change to the codebase (new feature, refactor, dependency change, architectural decision, endpoint modification, new component, etc.) **must update this file** before finishing its turn so that it accurately reflects the current state of the project. Do not let this file drift from reality.

---

## Overview

AirportWatch is a real-time airport flight tracking web application. Users select an airport and see a live map of nearby aircraft alongside a filterable arrivals/departures schedule. It is a monorepo deployed on Vercel.

---

## Repository Layout

```
airportwatch/
├── client/          # React 19 + Vite SPA (the frontend)
├── server/          # Express API server (local development only)
├── api/             # Vercel serverless functions (production API)
├── .env.example     # Required environment variable template
├── vercel.json      # Vercel deployment configuration
└── package.json     # Root: runs client + server concurrently for local dev
```

### Dual API strategy
- **Local dev**: Express server in `server/` runs at `http://localhost:3001`. Client proxies to it via `VITE_API_URL=http://localhost:3001/api`.
- **Production (Vercel)**: Serverless functions in `api/` handle requests. The Express server is not deployed. `VITE_API_URL` defaults to `/api` (same origin).

---

## Tech Stack

| Area | Technology | Version |
|------|-----------|---------|
| Frontend framework | React | 19.2.5 |
| Frontend build | Vite | 8.0.10 |
| Routing | React Router DOM | v6 |
| Server state & caching | TanStack React Query | v5.51.1 |
| Maps | Leaflet + react-leaflet | 1.9.4 / 5.0.0 |
| Styling | Tailwind CSS | 3.4.7 |
| HTTP client | Axios | 1.7.2 |
| Backend framework | Express | 4.19.2 |
| Dev runner | concurrently | ^8.2.2 (root) |
| Deployment | Vercel | serverless |

The client and server are **TypeScript** with `strict: true`. All new code must use `.ts` / `.tsx` — see the TypeScript Strict Mode rule in CLAUDE.md.

---

## Environment Variables

| Variable | Where used | Purpose |
|----------|-----------|---------|
| `OPENSKY_CLIENT_ID` | `server/` and `api/` | OpenSky OAuth2 client ID |
| `OPENSKY_CLIENT_SECRET` | `server/` and `api/` | OpenSky OAuth2 client secret |
| `RAPIDAPI_KEY` | `server/` and `api/` | RapidAPI key for AeroDataBox (primary schedule source) |
| `PORT` | `server/` | Express listen port (default: 3001) |
| `VITE_API_URL` | `client/` | Base URL for API calls (default: `/api`) |

---

## External APIs

### OpenSky Network (`https://opensky-network.org/api`)
- **Auth**: OAuth2 Bearer token. Tokens last 8 hours; refreshed 5 min before expiry.
- **Rate limit**: 4,000 requests/day for authenticated users.
- **Endpoints used**:
  - `GET /flights/arrival` — historical arrivals for a given airport + time window
  - `GET /flights/departure` — historical departures
  - `GET /states/all` — live aircraft states with bounding-box spatial filter
- **Constraint**: Each call covers max 1 hour. The backend fans out 8 sequential calls to cover an 8-hour window, then deduplicates by `icao24:firstSeen`.

### AeroDataBox via RapidAPI (`aerodatabox.p.rapidapi.com`) — primary schedule source
- **Auth**: `x-rapidapi-key` header.
- **Endpoint used**: `GET /flights/airports/icao/{ICAO}/{from}/{to}` — returns arrivals and departures for an airport within a local-time window.
- **Parameters**: `withLeg: true`, `direction: Both`, `withCancelled: true`, `withCodeshared: true`, `withCargo: false`, `withPrivate: false`.
- **Data returned**: Flight number, callsign, status, airline, aircraft (including `modeS` ICAO24 transponder), origin/destination, scheduled/estimated/actual times, gate (departures), baggage belt (arrivals).
- **Timezone**: AeroDataBox expects local airport time; the server converts using `Intl.DateTimeFormat`.
- **Window limit**: Maximum 12 hours per call. The server chunks the requested ±N hour window into 12-hour segments and calls them sequentially with 1.1 s gaps (to stay within the per-second rate limit), then deduplicates by flight number.
- **Result cached**: 15 minutes per `schedule:{icao}:{windowHours}` key.

---

## API Endpoints

The Express server exposes all routes; only a subset are also deployed as Vercel serverless functions (see below).

| Endpoint | Cache TTL | Data source | Notes |
|----------|-----------|-------------|-------|
| `GET /api/airports` | Infinity (React Query) | Static hardcoded list | 30+ major airports |
| `GET /api/flights/:icao` | 60 s | OpenSky | 8h history; fans out 8x 1-hour windows. **Express only — no Vercel function.** |
| `GET /api/live/:icao` | 60 s | OpenSky `/states/all` | ±2.5° bounding box (~275 km). **Express only — no Vercel function.** |
| `GET /api/schedule/:icao?window=N` | 15 min | AeroDataBox | N ∈ {2,4,8,12,24} hours symmetric; chunked into 12 h blocks |
| `GET /api/track?icao24=A,B,...` | 60 s | OpenSky `/states/all` | Comma-separated ICAO24 codes |
| `GET /health` | — | — | `{ status: "ok" }` |

### Vercel serverless files
```
api/airports.ts            → GET /api/airports
api/track.ts               → GET /api/track
api/schedule/[icao].ts     → GET /api/schedule/:icao   (30 s max duration)
```

---

## Server Modules (`server/src/`)

| File | Responsibility |
|------|---------------|
| `index.ts` | Express app, CORS (`http://localhost:5173`), mounts router, global error handler |
| `routes/flights.ts` | All route handlers. Orchestrates OpenSky fan-out and AeroDataBox schedule fetching |
| `aerodatabox.ts` | AeroDataBox schedule calls via RapidAPI; timezone-aware date formatting; exports `fetchSchedule` |
| `auth.ts` | OpenSky OAuth2 token lifecycle: fetch, cache, pre-expiry refresh |
| `cache.ts` | In-memory `Map`-based cache with TTL; integrates file cache for schedule keys |
| `fileCache.ts` | Persists schedule cache to `server/cache/*.json`. Disabled when `process.env.VERCEL` is set |
| `airports.ts` | Hardcoded list of 30+ airports: `{ icao, iata, name, city, country, lat, lon, tz }` |
| `airportCoords.ts` | Coordinate lookup for 1,000+ airports (used to enrich departure/arrival airport objects) |

### Caching layers (server-side)

1. **In-memory `Map`** — always active; 60 s TTL for live/track, 15 min for schedule.
2. **File cache** (`server/cache/`) — schedule keys only; survives restarts locally; disabled on Vercel.

### Status inference
If AeroDataBox returns `"Expected"` or `"Scheduled"` but the scheduled time is in the past, the server promotes the status to `"Arrived"` or `"Departed"` before returning the response.

---

## Frontend Architecture (`client/src/`)

### Entry points
- `main.tsx` — React 19 `createRoot`, wraps app in `StrictMode`
- `App.tsx` — React Router `<BrowserRouter>`, React Query `<QueryClientProvider>` (global `staleTime: 30s`), route definitions

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| `pages/Home.tsx` | `/` | Redirects to last visited airport (localStorage) or default `LOWK` |
| `pages/Select.tsx` | `/select` | Airport search and selection |
| `pages/Dashboard.tsx` | `/airport/:icao` | Main view: schedule table + live map |

#### Dashboard data orchestration
- React Query `["airports"]` — staleTime: Infinity
- React Query `["schedule", icao, windowHours]` — staleTime 15 min, refetchInterval 15 min
- React Query `["track", icao24Codes.join(",")]` — staleTime 60 s, refetchInterval 60 s
- Links schedule → live: `flight.aircraft.modeS === state.icao24`
- Builds `icao24Map` for O(1) lookups when matching live positions to schedule flights

### Components

| Component | File | Role |
|-----------|------|------|
| `Navbar` | `components/Navbar.tsx` | Sticky header; shows radar icon, countdown timer, home link |
| `AirportSelector` | `components/AirportSelector.tsx` | Search dropdown for airports; persists choice to localStorage |
| `FlightMap` | `components/FlightMap.tsx` | Leaflet map — aircraft icons, route polylines, airport markers, selection zoom. **Lazy loaded** |
| `FlightTable` | `components/FlightTable.tsx` | Responsive arrivals/departures table with status filter, pagination (10/page) |
| `LiveTraffic` | `components/LiveTraffic.tsx` | Alternate raw live-states table (currently not rendered in Dashboard) |
| `SkeletonRow` | `components/SkeletonRow.tsx` | Animated loading placeholder rows |

### Custom hook

`hooks/useCountdown.ts` — decrements from `totalSeconds` to 0 every second, resets automatically. Used by Navbar to show "Refreshing in Xs".

### API client layer

`api/client.ts` — Axios instance; `baseURL = import.meta.env.VITE_API_URL || "/api"`; 15 s timeout.

`api/airports.ts` — exported functions:
- `fetchAirports()`
- `fetchFlights(icao)`
- `fetchLiveTraffic(icao)`
- `fetchSchedule(icao, windowHours)`
- `fetchTrack(icao24Codes)`

### Client-side caching (React Query)
Mirrors server TTLs: `staleTime: 15 min` for schedule, `staleTime: 60 s` for track. No WebSockets — pure HTTP polling.

---

## Testing

Two test layers exist. Both must pass before any change is shipped.

### Vitest (`client/src/test/`)

Runs in jsdom — no real browser. Tests component rendering and logic in isolation.

- **MSW handlers**: `src/test/mocks/handlers.ts` — intercepts API calls at the fetch level
- **Render helper**: `src/test/utils/renderWithProviders.tsx` — wraps components in React Query + Router
- **Shared fixtures**: `src/test/mocks/fixtures/airports.ts`, `src/test/mocks/fixtures/schedule.ts` — imported by both Vitest and Playwright
- **Covers**: `FlightTable`, `FlightStatusBanner`, `Dashboard` (StaleDataBanner only — direct `QueryClient` manipulation not possible in a real browser)
- **Excludes**: `FlightMap` — Leaflet requires real browser geometry APIs unavailable in jsdom
- **Commands**: `npm run test:run` (single pass), `npm test` (watch), `npm run coverage`

### Playwright E2E (`client/e2e/`)

Runs against a real Chromium browser pointed at the Vite dev server.

- **Config**: `client/playwright.config.ts` — starts `npm run dev` with `VITE_API_URL=/api` so same-origin API calls are interceptable by `page.route()`
- **Network mocking**: `page.route()` intercepts at the browser level; no MSW needed
- **Auto-fixture**: `e2e/fixtures/test.ts` extends Playwright's base `test` with an `apiMocks` fixture that calls `mockDefaultRoutes()` automatically before every test
- **Override pattern**: `page.route()` calls inside a test body are LIFO — the last registered handler wins, so per-test overrides take priority over the auto-fixture defaults
- **Mock builders** (`e2e/fixtures/api-mocks.ts`):
  - `arrivedFlightSchedule(minsAgo)` — flight with a past arrival; `minsAgo > 30` triggers "Reached destination" banner, `minsAgo ≤ 30` + airborne track triggers "EnRoute" override
  - `bigSchedule()` — 11 arrivals to trigger pagination (PAGE_SIZE = 10)
- **Covers**: Dashboard page flows — tab switching, flight selection, window picker, status banners, pagination, error states, live status override
- **Commands**: `npm run test:e2e`, `npm run test:e2e:ui` (interactive), `npm run test:e2e:debug`

### Locator patterns for Playwright

The responsive layout renders **two DOM copies** of every flight row — a mobile card (`div.sm:hidden`) and a desktop table (`div.hidden.sm:block`). At the default 1280×720 test viewport, the mobile copy is hidden but still in the DOM. Always scope locators to avoid hitting the hidden copy:

```ts
page.locator("table").getByText("OS 101")              // desktop table cell, not mobile card
page.getByRole("row", { name: /OS 101/ }).click()      // <tr> elements only exist in the table
page.getByRole("cell", { name: "EnRoute" })            // status badge
page.getByText("ICAO").locator("xpath=..").getByText("LOWK")  // ICAO badge (not map marker)
```

---

## Map Rendering (FlightMap)

Built with react-leaflet on CartoDB dark tiles.

### Icon types
- **Plane icon** (`L.divIcon`): plane emoji (✈) rotated to match `heading`. Cyan = arrival, purple = departure, white + ping ring = selected.
- **Airport icon**: pulsing cyan concentric circles + ICAO label (destination airport).
- **Origin icon**: pulsing amber circles (shown when selected arrival is not yet airborne).

### Route polylines
Three overlapping polylines per selected flight:
1. Faint full route: departure → current position → destination
2. Dimmer dashed past segment: departure → current position
3. Bright dashed future segment: current position → destination (CSS `route-flow` animation)

### MapFocusController
Internal component using `useMap()`. On flight selection: flies to aircraft at zoom 10 (or to origin airport at zoom 7 if aircraft not tracked yet). Resets to airport centre zoom 8 on deselect.

---

## Key Data Structures

### Airport
```js
{
  icao: string,
  iata: string,
  name: string,
  city: string,
  country: string,
  lat: number,
  lon: number,
  tz: string  // IANA timezone e.g. "Europe/Vienna"
}
```

### Flight (AeroDataBox schedule)
```js
{
  number: string,           // "OS 123"
  callSign: string,         // "AUA123"
  status: "Expected" | "Scheduled" | "Delayed" | "Departed" | "Arrived"
        | "Cancelled" | "EnRoute" | "Landing" | "GateClosed",
  aircraft: { modeS: string, model: string },  // modeS is the ICAO24
  airline: { name: string },
  departure: {
    airport: Airport,
    scheduledTime: { utc: string, local: string },
    revisedTime?: { utc: string, local: string },
    gate?: string
  },
  arrival: {
    airport: Airport,
    scheduledTime: { utc: string, local: string },
    revisedTime?: { utc: string, local: string },
    actualTime?: { utc: string, local: string },
    baggageBelt?: string
  }
}
```

### LiveAircraftState (OpenSky → transformed)
```js
{
  icao24: string,          // transponder hex code == flight.aircraft.modeS
  callsign: string,
  origin_country: string,
  last_contact: number,    // Unix timestamp
  longitude: number | null,
  latitude: number | null,
  altitude: number | null, // metres
  on_ground: boolean,
  velocity: number | null, // m/s
  heading: number | null,  // 0–360 degrees
  vertical_rate: number | null,
  squawk: string | null,
  flightType?: "arrival" | "departure"  // added by frontend matching logic
}
```

---

## Styling

Tailwind CSS with a custom navy palette:

| Token | Hex |
|-------|-----|
| `navy-900` | `#0a0f1e` |
| `navy-800` | `#0d1530` |

Semantic accent colours: cyan (arrivals, primary), purple/violet (departures), amber (delays, origin marker), green (on-ground/landed), red (cancelled).

Custom CSS in `client/src/index.css`:
- `.radar-sweep` — 3 s rotation on navbar icon
- `.route-flow-line` — 0.8 s flowing dash animation on future route segment
- `.scrollbar-thin` — custom slim scrollbar

---

## Deployment (Vercel)

`vercel.json` configuration:
- **Install**: installs root + `server/` + `client/` dependencies
- **Build**: `cd client && npm run build`
- **Output**: `client/dist`
- **Serverless function timeout**: `api/schedule/[icao].ts` → 30 s max duration
- **SPA fallback**: all non-`/api/` requests rewrite to `/index.html`
- **File cache**: disabled (`VERCEL` env var detected); in-memory only

### Local dev
```bash
npm install          # root
npm run install:all  # installs server/ and client/ deps
npm run dev          # starts both servers via concurrently
```
Client: `http://localhost:5173` — Server: `http://localhost:3001`

---

## Known Constraints & Gotchas

- **OpenSky 1-hour limit**: `/flights/arrival` and `/flights/departure` accept max 1-hour window per call. The server fans out 8 calls (covering 8 hours) and deduplicates by `icao24:firstSeen`.
- **OpenSky daily cap**: 4,000 requests/day. Aggressive polling will exhaust this quickly.
- **AeroDataBox 12-hour chunk limit**: AeroDataBox accepts a maximum 12-hour window per request. For windows wider than 12 hours the server fans out sequential calls (1.1 s apart) and deduplicates by flight number.
- **AeroDataBox returns modeS directly**: No registration → ICAO24 resolution is needed; AeroDataBox includes the transponder hex code (`modeS`) in the schedule response. If `modeS` is absent for a flight, that plane won't appear on the map.
- **Vercel read-only FS**: File cache writes to `server/cache/` are disabled on Vercel; only in-memory cache is available.
- **Vercel cold starts**: In-process caches (schedule Map in `cache.ts`) are empty on cold start. First schedule request per airport after a cold start hits AeroDataBox directly.
- **`/api/flights/:icao` and `/api/live/:icao` are Express-only**: These OpenSky endpoints exist in the server router but have no Vercel serverless counterparts. The frontend does not use them — live positions are obtained via `fetchTrack` (the `/api/track` endpoint) which targets specific scheduled aircraft worldwide.
- **FlightMap lazy loading**: Wrapped in `React.lazy` + `Suspense` in Dashboard; do not import it directly without a Suspense boundary.
- **LiveTraffic component**: exists but is **not currently rendered** in the Dashboard. It's a raw live-states table that was superseded by the map integration.
