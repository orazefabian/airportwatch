# CLAUDE.md — AirportWatch Agent Rules

Rules derived from real bugs in this codebase. Read before making any change.

## One Change at a Time

Make the smallest possible edit that fixes the stated problem. Do not touch CSS, layout, or unrelated logic while fixing a bug. Do not refactor while adding a feature. If you notice a second issue, note it and stop — do not fix it in the same turn.

## Leaflet / CSS Stacking Context Rule

Never place any element with `z-index`, `backdrop-filter`, `backdrop-blur`, `filter`, `transform`, `opacity < 1`, or `will-change` inside a container that is also an ancestor of the Leaflet `<MapContainer>` and that has `overflow: hidden`.

Leaflet creates its own DOM subtree with internal z-index layers. A CSS stacking context on an `overflow: hidden` ancestor collapses those layers, breaking marker rendering entirely.

Correct pattern (already used in `FlightMap.tsx`): banners and overlays go **outside** the `overflow: hidden` map wrapper, in a sibling element above it. The map wrapper keeps only `position: relative`, `overflow: hidden`, `rounded-xl`, `border`, and a fixed height.

## AeroDataBox 404 = Empty Window, Not an Error

AeroDataBox returns HTTP 404 when no flights exist in the requested time window — not an empty array. This is valid and expected for small airports during quiet periods.

In `server/src/aerodatabox.ts` and `api/schedule/[icao].ts`, catch 404 from AeroDataBox and return `{ arrivals: [], departures: [] }`. Never propagate AeroDataBox 404 as an error to the client.

## Verify Adjacent Features After Any Change

After every change, confirm these still work:
1. Map shows plane markers
2. FlightTable renders arrivals and departures
3. Window selector (±2/4/8/12/24h) works
4. Clicking a flight highlights it on the map

## TypeScript Strict Mode

All `.ts` / `.tsx` files must compile with `strict: true`. No implicit `any`. Use `unknown` + narrowing instead. Optional chaining (`?.`) over non-null assertions (`!`). Shared domain types live in `client/src/types.ts` and `server/src/types.ts` — import from there, never redefine inline. All new code is TypeScript; no new `.js` / `.jsx` files.

## External API Responses Are Untrusted at the Boundary

AeroDataBox and OpenSky may omit optional fields. Always use optional chaining when reading nested fields from API responses. The `Flight` interface marks all optional fields with `?` — respect that.

## Write or Update Tests for Every Substantive Change

Any change to `FlightTable`, `Dashboard`, or server schedule logic must have a corresponding test case added or updated in `client/src/test/`. Run `npm test` in `client/` before marking a task complete. `FlightMap` is explicitly excluded from the test suite (Leaflet requires browser geometry APIs not available in jsdom).
