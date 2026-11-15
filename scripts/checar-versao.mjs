// Falha se as três versões do app (package.json, tauri.conf.json, Cargo.toml) divergirem.
import { readFileSync } from "node:fs";
const lerJson = (p) => JSON.parse(readFileSync(p, "utf8")).version;
const cargo = /^version\s*=\s*"([^"]+)"/m.exec(readFileSync("app/src-tauri/Cargo.toml", "utf8"))?.[1];
const v = { "app/package.json": lerJson("app/package.json"), "app/src-tauri/tauri.conf.json": lerJson("app/src-tauri/tauri.conf.json"), "app/src-tauri/Cargo.toml": cargo };
console.log(v);
if (new Set(Object.values(v)).size !== 1) { console.error("versões diferentes"); process.exit(1); }
