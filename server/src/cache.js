const TTL_MS = 60 * 1000; // 60 seconds

const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value) {
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

module.exports = { get, set };
