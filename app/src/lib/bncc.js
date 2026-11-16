// Descrições das habilidades da BNCC, lidas de `_sistema/bncc/bncc-lp-{6..9}ano.md` (linhas "- **EF06LP12** `6º` — texto ^ef06lp12").
import { raizDe, raizBarra } from "@/lib/raiz";
import { invoke } from "@/lib/api";

const raiz = (items) => raizDe(items);
let cache = { raiz: null, mapa: null };

export async function carregarBncc(items) {
  if (!items?.length) return {};
  const r = raiz(items);
  if (cache.raiz === r && cache.mapa) return cache.mapa;
  const mapa = {};
  for (const ano of [6, 7, 8, 9]) {
    let t; try { t = await invoke("read_note", { path: `${r}/_sistema/bncc/bncc-lp-${ano}ano.md` }); } catch { continue; }
    for (const l of t.split("\n")) {
      const m = /^- \*\*(EF\d\dLP\d\d)\*\*(?:\s*`[^`]*`)?\s*—\s*(.*?)(?:\s*\^ef\d\dlp\d\d)?\s*$/i.exec(l);
      if (m && !mapa[m[1].toUpperCase()]) mapa[m[1].toUpperCase()] = m[2].trim();
    }
  }
  cache = { raiz: r, mapa };
  return mapa;
}

/**
 * Lê o que foi escrito no campo Habilidades: só códigos (separados por vírgula, espaço ou linha) ou "código texto" por linha.
 * Completa o texto que faltar com a BNCC. Devolve { hs, faltam } (faltam = códigos sem descrição encontrada).
 */
export async function interpretarHabilidades(entrada, items) {
  const CODIGO = /\(?\b(EF\d\dLP\d\d)\b\)?/gi;
  const hs = [];
  for (const linha of entrada.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const codigos = [...linha.matchAll(CODIGO)].map((m) => m[1].toUpperCase());
    if (!codigos.length) continue;
    const resto = linha.replace(CODIGO, "").replace(/[\s,;.:–—-]+/g, "");
    if (!resto) codigos.forEach((c) => hs.push({ codigo: c, texto: "" }));
    else { const m = /^\(?(EF\d\dLP\d\d)\)?[\s:.–—-]*(.*)$/i.exec(linha); if (m) hs.push({ codigo: m[1].toUpperCase(), texto: m[2].trim() }); }
  }
  const unicos = hs.filter((h, i) => hs.findIndex((x) => x.codigo === h.codigo) === i);
  const faltam = [];
  if (unicos.some((h) => !h.texto)) {
    const mapa = await carregarBncc(items);
    for (const h of unicos) if (!h.texto) { if (mapa[h.codigo]) h.texto = mapa[h.codigo]; else faltam.push(h.codigo); }
  }
  return { hs: unicos, faltam };
}
