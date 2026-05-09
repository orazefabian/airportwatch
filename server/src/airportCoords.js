const coords = require("./data/airportCoords.json");

function getCoords(icao) {
  const pair = coords[(icao || "").toUpperCase()];
  return pair ? { lat: pair[0], lon: pair[1] } : null;
}

module.exports = { getCoords };
