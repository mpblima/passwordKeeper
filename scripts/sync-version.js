/**
 * Sincroniza a versão de tauri.conf.json e Cargo.toml com a tag git.
 * Uso: node scripts/sync-version.js <versao>
 * Ex:  node scripts/sync-version.js 0.1.3
 */
const fs = require("fs");
const path = require("path");

const version = (process.argv[2] || "").replace(/^v/, "");
if (!version) {
  console.error("Uso: node scripts/sync-version.js <versao>");
  process.exit(1);
}

// tauri.conf.json
const confPath = path.join(__dirname, "..", "src-tauri", "tauri.conf.json");
const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
conf.version = version;
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");
console.log("tauri.conf.json →", version);

// Cargo.toml — atualiza apenas a primeira linha `version = "..."`
const cargoPath = path.join(__dirname, "..", "src-tauri", "Cargo.toml");
let cargo = fs.readFileSync(cargoPath, "utf8");
cargo = cargo.replace(/^version = "[^"]+"/, 'version = "' + version + '"');
fs.writeFileSync(cargoPath, cargo);
console.log("Cargo.toml →", version);
