// Leitura de uma aula do acervo (`tipo: aula`, Acervo/Aulas). Seções reconhecidas por título de nível 2; as anotações do
// professor são callouts `> [!margem]`, que a visão tira do corpo e mostra na coluna "Na margem".
import { parseFm } from "@/lib/frontmatter";

const sem = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const SECOES = [
  { id: "objetivos", nome: "Objetivos", casa: /^objetivos?$/ },
  { id: "habilidades", nome: "Habilidades", casa: /^(habilidades?|bncc|habilidades? \(bncc\))$/ },
  { id: "conteudo", nome: "Conteúdo", casa: /^conteudo$/ },
  { id: "mindmap", nome: "Mindmap", casa: /^(mindmap|mapa mental|esquema)$/ },
  { id: "atividades", nome: "Atividades", casa: /^atividades?$/ },
];

/** Tira os callouts `[!margem]` do texto e devolve o que sobrou mais as anotações (uma por callout). */
export function separarMargem(texto) {
  const linhas = texto.split("\n"), resto = [], notas = [];
  let i = 0, fence = false;
  while (i < linhas.length) {
    const l = linhas[i];
    if (/^\s*```/.test(l)) fence = !fence;
    if (!fence && /^>\s*\[!margem\]/i.test(l)) {
      const bloco = [];
      while (i < linhas.length && /^>/.test(linhas[i])) { bloco.push(linhas[i].replace(/^>\s?/, "")); i++; }
      const [primeira, ...demais] = bloco;
      const titulo = primeira.replace(/^\[!margem\][+-]?\s*/i, "").trim();
      notas.push([titulo, ...demais].filter(Boolean).join("\n"));
      continue;
    }
    resto.push(l); i++;
  }
  return { texto: resto.join("\n"), notas };
}

export function parseAula(text) {
  const fm = parseFm(text);
  const val = (k) => { const e = fm.entries.find((x) => x.key === k); return e?.value || (e?.items ?? []).join(", ") || ""; };
  const corpoBruto = fm.has ? fm.lines.slice(fm.end + 1).join("\n") : text;
  const { texto: corpo, notas } = separarMargem(corpoBruto);
  const linhas = corpo.split("\n"), partes = [];
  let atual = { titulo: "", linhas: [] }, fence = false;
  for (const l of linhas) {
    if (/^\s*```/.test(l)) fence = !fence;
    const h = !fence && /^##\s+(.*)$/.exec(l);
    if (h) { partes.push(atual); atual = { titulo: h[1].trim(), linhas: [] }; } else atual.linhas.push(l);
  }
  partes.push(atual);
  const secoes = [], outras = [];
  for (const p of partes) {
    const md = p.linhas.join("\n").trim();
    if (!p.titulo) { if (md) outras.push({ nome: "Introdução", md }); continue; }
    const def = SECOES.find((s) => s.casa.test(sem(p.titulo.replace(/^[^\p{L}\p{N}(]+/u, ""))));
    if (def && !secoes.some((s) => s.id === def.id)) secoes.push({ id: def.id, nome: def.nome, md });
    else outras.push({ nome: p.titulo, md });
  }
  secoes.sort((a, b) => SECOES.findIndex((s) => s.id === a.id) - SECOES.findIndex((s) => s.id === b.id));
  return {
    meta: { status: val("status"), ano: val("ano"), assuntos: val("assuntos"), tags: val("tags") },
    secoes, outras, notas, corpo: corpo.trim(),
    codigos: [...new Set((secoes.find((s) => s.id === "habilidades")?.md ?? "").match(/EF\d\dLP\d\d/g) ?? [])],
  };
}

/** Código de um bloco ```mermaid dentro do Markdown da seção (ou `null`). */
export const mermaidDe = (md) => /```mermaid\s*\n([\s\S]*?)```/.exec(md)?.[1]?.trim() ?? null;
