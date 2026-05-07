const axios = require("axios");
const qs = require("querystring");

const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  // Refresh 5 minutes before actual expiry
  if (cachedToken && now < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const { OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET } = process.env;
  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) {
    throw new Error("OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET must be set in .env");
  }

  const response = await axios.post(
    TOKEN_URL,
    qs.stringify({
      grant_type: "client_credentials",
      client_id: OPENSKY_CLIENT_ID,
      client_secret: OPENSKY_CLIENT_SECRET,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  cachedToken = response.data.access_token;
  // expires_in is in seconds; default to 8h if missing
  const expiresIn = response.data.expires_in || 28800;
  tokenExpiresAt = now + expiresIn * 1000;

  return cachedToken;
}

module.exports = { getAccessToken };
