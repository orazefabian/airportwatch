import type * as FileCacheModule from "./fileCache";

const TTL_MS       = 60 * 1000;
const SCHEDULE_TTL = 15 * 60 * 1000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

// Conditional require — Vercel's filesystem is read-only outside /tmp
let fileCache: typeof FileCacheModule | null = null;
if (!process.env.VERCEL) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fileCache = require("./fileCache") as typeof FileCacheModule;
}

export function get(key: string): unknown | null {
  const entry = store.get(key);
  if (entry) {
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
    } else {
      return entry.value;
    }
  }
  if (fileCache && key.startsWith("schedule:")) {
    const value = fileCache.get(key);
    if (value !== null) {
      store.set(key, { value, expiresAt: Date.now() + SCHEDULE_TTL });
      return value;
    }
  }
  return null;
}

export function set(key: string, value: unknown, ttlMs: number = TTL_MS): void {
  const expiresAt = Date.now() + ttlMs;
  store.set(key, { value, expiresAt });
  if (fileCache && key.startsWith("schedule:")) fileCache.set(key, value, expiresAt);
}
