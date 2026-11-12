// Leitura e edição do frontmatter (YAML simples do vault) direto no texto, linha a linha.
// Listas são gravadas em linha (`turmas: ["61", "62"]`), como no formato do vault.

function bounds(lines) {
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  return end > 0 ? { end } : null;
}

const unq = (s) => s.trim().replace(/^(["'])(.*)\1$/, "$2");

function splitFlow(inner) {
  const out = []; let cur = "", q = null;
  for (const c of inner) {
    if (q) { cur += c; if (c === q) q = null; }
    else if (c === '"' || c === "'") { q = c; cur += c; }
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map(unq).filter((x) => x !== "");
}

/** { has, entries: [{ key, value, items|null, from, to }] } — from/to = índices de linha (to inclusive). */
export function parseFm(text) {
  const lines = text.split("\n"), b = bounds(lines);
  if (!b) return { has: false, entries: [], lines };
  const entries = [];
  for (let i = 1; i < b.end; i++) {
    const m = /^([\w-]+):[ \t]*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const e = { key: m[1], value: unq(m[2]), items: null, from: i, to: i };
    const raw = m[2].trim();
    if (raw.startsWith("[") && raw.endsWith("]")) { e.items = splitFlow(raw.slice(1, -1)); e.value = ""; }
    else if (!raw) {
      const items = [];
      while (i + 1 < b.end && /^\s*-\s+/.test(lines[i + 1])) { items.push(unq(lines[++i].replace(/^\s*-\s+/, ""))); }
      if (items.length) { e.items = items; e.to = i; }
    }
    entries.push(e);
  }
  return { has: true, entries, lines, end: b.end };
}

const needsQuote = (s) => /^[\s\-?:,[\]{}#&*!|>'"%@`]|[:#]\s|:$|\s$/.test(s);
const fmtItem = (s) => (needsQuote(s) || /[,[\]]/.test(s) || /^[\d.]+$/.test(s) || /^(true|false|null)$/i.test(s) ? JSON.stringify(s) : s);
const fmtScalar = (s) => (s === "" ? "" : needsQuote(s) ? JSON.stringify(s) : s);

export function formatLine(key, value) {
  if (Array.isArray(value)) return `${key}: [${value.map(fmtItem).join(", ")}]`;
  const v = fmtScalar(String(value));
  return v ? `${key}: ${v}` : `${key}:`;
}

/** Devolve o texto com a propriedade `key` trocada (string ou array), criada, ou removida (`undefined`). */
export function setProp(text, key, value) {
  const fm = parseFm(text), lines = fm.lines;
  const e = fm.entries.find((x) => x.key === key);
  if (!fm.has) {
    if (value === undefined) return text;
    return ["---", formatLine(key, value), "---", ...lines].join("\n");
  }
  if (e) {
    lines.splice(e.from, e.to - e.from + 1, ...(value === undefined ? [] : [formatLine(key, value)]));
  } else if (value !== undefined) {
    lines.splice(fm.end, 0, formatLine(key, value));
  }
  return lines.join("\n");
}

export const lineStart = (text, line) => { let p = 0; for (let i = 1; i < line; i++) { const n = text.indexOf("\n", p); if (n < 0) return text.length; p = n + 1; } return p; };
