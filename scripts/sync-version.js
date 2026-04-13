import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const version = (process.argv[2] || "").replace(/^v/, "");
if (!version) {
  console.error("Uso: node scripts/sync-version.js <versao>");
  process.exit(1);
}

// tauri.conf.json
const confPath = join(__dirname, "..", "src-tauri", "tauri.conf.json");
const conf = JSON.parse(readFileSync(confPath, "utf8"));
conf.version = version;
writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");
console.log("tauri.conf.json →", version);

// Cargo.toml — atualiza apenas a primeira linha `version = "..."`
const cargoPath = join(__dirname, "..", "src-tauri", "Cargo.toml");
let cargo = readFileSync(cargoPath, "utf8");
cargo = cargo.replace(/^version = "[^"]+"/, `version = "${version}"`);
writeFileSync(cargoPath, cargo);
console.log("Cargo.toml →", version);
