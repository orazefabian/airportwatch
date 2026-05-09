const fileCache = require("./fileCache");

const TTL_MS       = 60 * 1000;       // 60s default — track, live
const SCHEDULE_TTL = 15 * 60 * 1000; // 15 min — AeroDataBox schedule data

const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (entry) {
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
    } else {
      return entry.value;
    }
  }
  // File-backed fallback for schedule keys — survives server restarts
  if (key.startsWith("schedule:")) {
    const value = fileCache.get(key);
    if (value !== null) {
      store.set(key, { value, expiresAt: Date.now() + SCHEDULE_TTL });
      return value;
    }
  }
  return null;
}

function set(key, value, ttlMs = TTL_MS) {
  const expiresAt = Date.now() + ttlMs;
  store.set(key, { value, expiresAt });
  if (key.startsWith("schedule:")) fileCache.set(key, value, expiresAt);
}

module.exports = { get, set };
