const fs   = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "cache");

function keyToFile(key) {
  return path.join(DIR, key.replace(/[:/]/g, "_") + ".json");
}

async function load() {
  fs.mkdirSync(DIR, { recursive: true });
}

function get(key) {
  try {
    const raw = fs.readFileSync(keyToFile(key), "utf8");
    const { value, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      fs.unlink(keyToFile(key), () => {});
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function set(key, value, expiresAt) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFile(keyToFile(key), JSON.stringify({ value, expiresAt }), () => {});
}

module.exports = { load, get, set };
