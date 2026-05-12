import fs from "fs";
import path from "path";

const DIR = path.join(__dirname, "..", "cache");

function keyToFile(key: string): string {
  return path.join(DIR, key.replace(/[:/]/g, "_") + ".json");
}

export async function load(): Promise<void> {
  fs.mkdirSync(DIR, { recursive: true });
}

export function get(key: string): unknown | null {
  try {
    const raw = fs.readFileSync(keyToFile(key), "utf8");
    const { value, expiresAt } = JSON.parse(raw) as { value: unknown; expiresAt: number };
    if (Date.now() > expiresAt) {
      fs.unlink(keyToFile(key), () => {});
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function set(key: string, value: unknown, expiresAt: number): void {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFile(keyToFile(key), JSON.stringify({ value, expiresAt }), () => {});
}
