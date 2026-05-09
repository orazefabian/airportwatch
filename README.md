# AirportWatch

Real-time airport flight tracker showing arrivals, departures, and live airborne traffic for any major airport worldwide, powered by the [OpenSky Network API](https://opensky-network.org/).

## Features

- Search and select from 30+ major world airports
- Real-time arrivals and departures (last 2 hours)
- Live traffic radar showing airborne aircraft within ~1.5° of the airport
- Auto-refresh every 60 seconds with a countdown timer
- Dark aviation-themed UI
- Remembers your last selected airport

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19, Vite, Tailwind CSS        |
| Backend  | Node.js, Express                    |
| Data     | OpenSky Network REST API (OAuth2)   |
| State    | TanStack Query (React Query v5)     |
| Routing  | React Router v6                     |

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- A free OpenSky Network account with OAuth2 credentials

## OpenSky API Setup

1. Register at [opensky-network.org](https://opensky-network.org/index.php?option=com_users&view=registration)
2. Go to your profile → **OpenSky API** → create a client application
3. Note your **Client ID** and **Client Secret**

> Rate limit: 4,000 API requests per day for authenticated users.

## Setup

1. **Clone or enter the project directory**

   ```bash
   cd airportwatch
   ```

2. **Copy environment variables**

   ```bash
   cp .env.example server/.env
   ```

   Then edit `server/.env` and fill in your credentials:

   ```
   OPENSKY_CLIENT_ID=your_client_id_here
   OPENSKY_CLIENT_SECRET=your_client_secret_here
   PORT=3001
   ```

3. **Install all dependencies**

   ```bash
   npm run install:all
   ```

   This installs root devDependencies (concurrently) plus both server and client packages.

## Running the App

### Option A — Single command (recommended)

From the project root:

```bash
npm run dev
```

This starts both servers concurrently:
- **Backend** → http://localhost:3001
- **Frontend** → http://localhost:5173

### Option B — Two separate terminals

**Terminal 1 (server):**
```bash
cd server
npm run dev
```

**Terminal 2 (client):**
```bash
cd client
npm run dev
```

Then open http://localhost:5173 in your browser.

## API Endpoints

| Method | Path                  | Description                                |
|--------|-----------------------|--------------------------------------------|
| GET    | `/api/airports`       | List of all supported airports             |
| GET    | `/api/flights/:icao`  | Arrivals + departures for the last 2 hours |
| GET    | `/api/live/:icao`     | Live airborne states near the airport      |
| GET    | `/health`             | Server health check                        |

## Notes

- The OpenSky API may return empty arrays during low-traffic periods or for smaller airports.
- Access tokens are cached server-side and refreshed 5 minutes before expiry (tokens last 8 hours).
- Flight and live-traffic responses are cached for 60 seconds to stay within rate limits.
