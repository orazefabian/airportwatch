const axios = require("axios");

const RAPIDAPI_HOST = "aerodatabox.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// Format a Date as "YYYY-MM-DDTHH:mm" in the given IANA timezone.
// AeroDataBox expects local airport time, not UTC.
function fmtLocal(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

async function fetchSchedule(icao, timezone = "UTC", fromDate, toDate) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set in server/.env");

  // Express window in local airport time — AeroDataBox requires this
  const from = fmtLocal(fromDate, timezone);
  const to   = fmtLocal(toDate,   timezone);

  const { data } = await axios.get(
    `${BASE_URL}/flights/airports/icao/${icao}/${from}/${to}`,
    {
      params: {
        withLeg: true,
        direction: "Both",
        withCancelled: true,
        withCodeshared: true,
        withCargo: false,
        withPrivate: false,
      },
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    }
  );

  return {
    arrivals:   (data.arrivals   || []).sort((a, b) => compareScheduled(a.arrival,   b.arrival)),
    departures: (data.departures || []).sort((a, b) => compareScheduled(a.departure, b.departure)),
  };
}

function compareScheduled(a, b) {
  const ta = a?.scheduledTime?.utc || "";
  const tb = b?.scheduledTime?.utc || "";
  return ta.localeCompare(tb);
}

module.exports = { fetchSchedule };
