// Fora do Tauri (navegador em desenvolvimento) lê o vault de teste via servidor do Vite, somente leitura.
import { invoke as tauriInvoke } from "@tauri-apps/api/core";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const isTauri = inTauri;
const get = (u) => fetch("/__vault" + u).then((r) => r.json());

// Navegador (dev): as operações de gerenciar notas valem só em memória, para testar a interface.
let mem = null;
const orig = {}; // caminho atual -> caminho real no disco (para ler notas renomeadas/movidas)
const ensure = async () => (mem ??= { items: await get("/list"), dirs: null });
const rootOf = (m) => m.items[0].path.slice(0, -m.items[0].rel.length);
const dirsOf = (m) => m.dirs ??= [...new Set(m.items.flatMap((i) => i.rel.split("/").slice(0, -1).map((_, k, a) => a.slice(0, k + 1).join("/") + "/")))];
const relOf = (m, p) => p.slice(rootOf(m).length);
const mk = (m, rel) => ({ name: rel.split("/").pop().replace(/\.md$/, ""), rel, path: rootOf(m) + rel });
const remap = (m, from, to) => {
  const fr = relOf(m, from), tr = relOf(m, to);
  m.items = m.items.map((i) => {
    if (!(i.rel === fr || i.rel.startsWith(fr + "/"))) return i;
    const n = mk(m, tr + i.rel.slice(fr.length));
    orig[n.path] = orig[i.path] ?? i.path;
    return n;
  });
  m.dirs = dirsOf(m).map((d) => (d === fr + "/" || d.startsWith(fr + "/") ? tr + "/" + d.slice(fr.length + 1) : d)).map((d) => d.replace(/\/\/$/, "/"));
};
const dev = async (cmd, a) => {
  const m = await ensure();
  const r = a.dir ? relOf(m, a.dir) : "";
  const dir = r ? r.replace(/\/?$/, "/") : "";
  if (cmd === "list_notes") return [...m.items];
  if (cmd === "list_dirs") return [...dirsOf(m)];
  if (cmd === "create_note") { const n = mk(m, dir + a.name.replace(/\.md$/, "") + ".md"); if (m.items.some((i) => i.rel === n.rel)) throw "já existe"; m.items.push(n); return n.path; }
  if (cmd === "create_folder") { dirsOf(m).push(dir + a.name + "/"); return rootOf(m) + dir + a.name; }
  if (cmd === "rename_entry" || cmd === "move_entry") {
    const fr = relOf(m, a.path), base = fr.split("/").pop();
    const note = m.items.some((i) => i.rel === fr);
    const to = cmd === "move_entry" ? dir + base : fr.split("/").slice(0, -1).concat(note ? a.name.replace(/\.md$/, "") + ".md" : a.name).join("/");
    if (to !== fr && (m.items.some((i) => i.rel === to) || dirsOf(m).includes(to + "/"))) throw "já existe um item com esse nome";
    if (to.startsWith(fr + "/")) throw "não dá para mover para dentro de si mesma";
    remap(m, a.path, rootOf(m) + to);
    return { path: rootOf(m) + to, links: 0 };
  }
  if (cmd === "delete_entry") { const fr = relOf(m, a.path); m.items = m.items.filter((i) => i.rel !== fr && !i.rel.startsWith(fr + "/")); m.dirs = dirsOf(m).filter((d) => d !== fr + "/" && !d.startsWith(fr + "/")); return null; }
};
const DEV_CMDS = ["list_notes", "list_dirs", "create_note", "create_folder", "rename_entry", "move_entry", "delete_entry"];

const anexos = {}; // simulação: imagens "gravadas" nesta sessão (nome em minúsculas -> data URL)
const b64 = (bytes) => { let t = ""; for (const b of bytes) t += String.fromCharCode(b); return btoa(t); };
const salvas = {}; // simulação no navegador: textos "salvos" nesta sessão
const hist = {}; // simulação do histórico: caminho -> [{ id, ts, texto }] (mais novo primeiro)
const guardar = async (path, forcar) => {
  const atual = path in salvas ? salvas[path] : await get("/read?path=" + encodeURIComponent(orig[path] ?? path)).catch(() => null);
  if (atual == null) return;
  const h = (hist[path] ??= []);
  if (h[0] && (h[0].texto === atual || (!forcar && Date.now() / 1000 - h[0].ts < 600))) return;
  h.unshift({ id: String(Math.floor(Date.now() / 1000) + h.length), ts: Math.floor(Date.now() / 1000), texto: atual });
};
export const invoke = inTauri ? tauriInvoke : async (cmd, a = {}) => {
  if (DEV_CMDS.includes(cmd)) return dev(cmd, a);
  if (cmd === "read_note" && a.path in salvas) return salvas[a.path];
  if (cmd === "read_note") return a.path in orig ? get("/read?path=" + encodeURIComponent(orig[a.path])) : get("/read?path=" + encodeURIComponent(a.path)).catch(() => "# " + a.path.split("/").pop().replace(/\.md$/, "") + "\n");
  if (cmd === "note_info") return get("/info?path=" + encodeURIComponent(orig[a.path] ?? a.path));
  if (cmd === "vault_health") return get("/health");
  if (cmd === "search_text") return get("/search?q=" + encodeURIComponent(a.query));
  if (cmd === "read_embed") {
    const nome = a.target.split("/").pop().trim().toLowerCase();
    if (anexos[nome]) return { kind: "image", name: a.target.split("/").pop(), data: anexos[nome] };
    return get("/embed?target=" + encodeURIComponent(a.target));
  }
  if (cmd === "read_sidecar") return fetch("/__vault/read?path=" + encodeURIComponent(a.path)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (cmd === "save_attachment") {
    const ext = a.name.split(".").pop().toLowerCase();
    anexos[a.name.toLowerCase()] = `data:image/${ext === "png" ? "png" : "jpeg"};base64,${b64(a.data)}`;
    return a.dir + "/" + a.name;
  }
  if (cmd === "resolve_link") return get("/resolve?target=" + encodeURIComponent(a.target));
  if (cmd === "save_note") { await guardar(a.path, false); salvas[a.path] = a.text; return null; }
  if (cmd === "list_history") return (hist[a.path] ?? []).map((v) => ({ id: v.id, ts: v.ts, bytes: v.texto.length }));
  if (cmd === "read_version") return hist[a.path].find((v) => v.id === a.id).texto;
  if (cmd === "restore_version") { await guardar(a.path, true); const t = hist[a.path].find((v) => v.id === a.id).texto; salvas[a.path] = t; return t; }
  if (cmd === "read_config") return localStorage.getItem("atalhos");
  if (cmd === "write_config") { localStorage.setItem("atalhos", a.text); return null; }
  throw new Error("comando desconhecido: " + cmd);
};
