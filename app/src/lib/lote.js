// Ações em lote do Explorador: planos puros (texto da nota → texto novo) para "mudar status" e "adicionar tag".
// Cada plano devolve { rotulo, novo } — `novo` é `null` quando a nota não muda (e `rotulo` diz por quê).
import { parseFm, setProp } from "./frontmatter";

export const STATUS_LOTE = ["pendente", "andamento", "finalizado", "arquivado"];

/** Tag como o professor digitou: sem `#` na frente nem espaços nas pontas. */
export const limparTag = (t) => String(t ?? "").trim().replace(/^#+/, "").trim();

export function planejarStatus(texto, status) {
  const e = parseFm(texto).entries.find((x) => x.key === "status");
  if (!e) return { rotulo: "sem campo status: não muda", novo: null };
  if (e.value === status) return { rotulo: `já é ${status}`, novo: null };
  return { rotulo: `${e.value || "—"} → ${status}`, novo: setProp(texto, "status", status) };
}

export function planejarTag(texto, tag) {
  const t = limparTag(tag);
  if (!t) return { rotulo: "digite a tag", novo: null };
  const e = parseFm(texto).entries.find((x) => x.key === "tags");
  const atuais = e?.items ?? (e?.value ? [e.value] : []);
  if (atuais.some((x) => x.toLowerCase() === t.toLowerCase())) return { rotulo: "já tem a tag", novo: null };
  return { rotulo: `tags: ${[...atuais, t].join(", ")}`, novo: setProp(texto, "tags", [...atuais, t]) };
}

/** Intervalo de `ids` entre `de` e `ate` (inclusive), na ordem da lista; se `de` não está na lista, só `ate`. */
export function intervalo(ids, de, ate) {
  const a = ids.indexOf(de), b = ids.indexOf(ate);
  if (b < 0) return [];
  if (a < 0) return [ate];
  return ids.slice(Math.min(a, b), Math.max(a, b) + 1);
}
