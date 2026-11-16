// Leitura de uma aula do acervo (`tipo: aula`, Acervo/Aulas). Seções reconhecidas por título de nível 2; as anotações do
// professor são callouts `> [!margem]`, que a visão tira do corpo e mostra na coluna "Na margem".
import { parseFm } from "@/lib/frontmatter";

const sem = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const SECOES = [
  { id: "objetivos", nome: "Objetivos", casa: /^objetivos?$/ },
  { id: "habilidades", nome: "Habilidades", casa: /^(habilidades?|bncc|habilidades? \(bncc\))$/ },
  { id: "conteudo", nome: "Conteúdo", casa: /^conteudos?$/ },
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
  // Cada seção `##` leva as próprias anotações [!margem] (a margem as mostra ao lado do trecho a que pertencem).
  const linhas = corpoBruto.split("\n"), partes = [];
  let atual = { titulo: "", linhas: [] }, fence = false;
  for (const l of linhas) {
    if (/^\s*```/.test(l)) fence = !fence;
    const h = !fence && /^##\s+(.*)$/.exec(l);
    if (h) { partes.push(atual); atual = { titulo: h[1].trim(), linhas: [] }; } else atual.linhas.push(l);
  }
  partes.push(atual);
  const limpas = partes.map((p) => separarMargem(p.linhas.join("\n")));
  // Toda seção `##` vira uma aba, na ordem do arquivo; o id é a posição (estável ao renomear o título). `tipo` só serve para os dados da margem.
  const tipoDe = (t) => SECOES.find((x) => x.casa.test(sem(t.replace(/^[^\p{L}\p{N}(]+/u, ""))))?.id ?? null;
  const secoes = partes.slice(1).map((p, k) => ({ id: "s" + k, tipo: tipoDe(p.titulo), nome: p.titulo || "(sem título)", md: limpas[k + 1].texto.trim(), notas: limpas[k + 1].notas }));
  const intro = limpas[0].texto.split("\n").filter((l) => !/^#\s/.test(l)).join("\n").trim();
  const introNotas = limpas[0].notas;
  return {
    meta: { status: val("status"), ano: val("ano"), assuntos: val("assuntos"), tags: val("tags") },
    secoes, intro, introNotas, notas, corpo: corpo.trim(),
    codigos: [...new Set((secoes.find((s) => s.tipo === "habilidades")?.md ?? "").match(/EF\d\dLP\d\d/g) ?? [])],
  };
}

/** Código de um bloco ```mermaid dentro do Markdown da seção (ou `null`). */
export const mermaidDe = (md) => /```mermaid\s*\n([\s\S]*?)```/.exec(md)?.[1]?.trim() ?? null;

/** Modelo de uma aula nova do acervo (as seções que a visão personalizada reconhece). */
export function modeloAula({ ano, titulo }) {
  return `---
tipo: aula
ano: ${ano || ""}
assuntos: []
tags: []
status: pendente
---
# ${titulo}

## Objetivos

- 

## Habilidades

- 

## Conteúdo

## Mindmap

\`\`\`mermaid
mindmap
  root((${titulo.replace(/[()]/g, "")}))
    Ideia 1
    Ideia 2
\`\`\`

## Atividades

- 
`;
}

/** Cria `Acervo/Aulas/<titulo>.md` com o modelo e devolve o caminho; se já existir uma nota com o nome, só devolve o dela. */
export async function criarAula(items, { titulo, turma, pasta = "" }) {
  const { invoke } = await import("@/lib/api");
  const nome = titulo.replace(/\[\[|\]\]/g, "").replace(/[\\/:*?"<>|#^]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!nome) throw new Error("A aula não tem título.");
  const ja = items.find((i) => i.rel.startsWith("Acervo/Aulas/") && i.name.toLowerCase() === nome.toLowerCase());
  if (ja) return ja.path;
  const raiz = items[0].path.slice(0, items[0].path.length - items[0].rel.length).replace(/\/$/, "");
  const dir = `${raiz}/Acervo/Aulas${pasta ? "/" + pasta : ""}`;
  if (!items.some((i) => i.rel.startsWith("Acervo/Aulas/"))) { try { await invoke("create_folder", { dir: `${raiz}/Acervo`, name: "Aulas" }); } catch { /* já existe */ } }
  const path = await invoke("create_note", { dir, name: nome });
  await invoke("save_note", { path, text: modeloAula({ ano: /^[6-9]/.test(turma ?? "") ? turma[0] : "", titulo: nome }) });
  return path;
}

/** Seções do texto bruto (com os callouts [!margem] no lugar): por título `##`, o intervalo de linhas do corpo. */
export function secoesBrutas(text) {
  const linhas = text.split("\n"), cab = [];
  let fence = false;
  linhas.forEach((l, i) => {
    if (/^\s*```/.test(l)) fence = !fence;
    const h = !fence && /^##\s+(.*)$/.exec(l);
    if (h) cab.push({ i, titulo: h[1].trim() });
  });
  const out = [];
  // Trecho antes do primeiro `##` (sem o título `#`): também se edita na página, como as demais seções.
  const fm = parseFm(text), fimIntro = cab.length ? cab[0].i : linhas.length;
  let ini = fm.has ? fm.end + 1 : 0;
  while (ini < fimIntro && !linhas[ini].trim()) ini++;
  if (ini < fimIntro && /^#\s/.test(linhas[ini])) ini++;
  while (ini < fimIntro && !linhas[ini].trim()) ini++;
  const mdIntro = linhas.slice(ini, fimIntro).join("\n").replace(/\s+$/, "");
  if (mdIntro.trim()) out.push({ id: "intro", ini, fim: fimIntro, linha0: ini, md: mdIntro });
  cab.forEach((c, k) => {
    const fim = k + 1 < cab.length ? cab[k + 1].i : linhas.length;
    // `md` inclui a linha do título `##`; linha0: quantas linhas do arquivo vêm antes dela (para numerar as linhas como no arquivo)
    out.push({ id: "s" + k, ini: c.i, fim, linha0: c.i, md: linhas.slice(c.i, fim).join("\n").replace(/\s+$/, "") });
  });
  return out;
}

/** Troca a seção `id` (título `##` + corpo) no texto bruto, mantendo o resto da nota; se o título sumir da edição, mantém o antigo. */
export function trocarSecao(text, id, md) {
  const s = secoesBrutas(text).find((x) => x.id === id);
  if (!s) return text;
  const linhas = text.split("\n");
  let corpo = md.replace(/\s+$/, "");
  if (id !== "intro" && !/^##\s/.test(corpo)) corpo = linhas[s.ini] + "\n" + corpo;
  const novo = [...corpo.split("\n"), ...(s.fim < linhas.length ? [""] : [])];
  return [...linhas.slice(0, s.ini), ...novo, ...linhas.slice(s.fim)].join("\n");
}

const itensDe = (md) => (md ?? "").split("\n").filter((l) => /^(\d+[.)]|[-*+])\s+(\[[ xX]\]\s+)?\S/.test(l)).length;
const palavrasDe = (md) => ((md ?? "").replace(/[#>*_`|\-\[\]]/g, " ").match(/\S+/g) ?? []).length;

/** Dados calculados da aula para a margem (nada é digitado: tudo sai do texto). */
export function dadosDaAula(a, text) {
  const sec = (id) => a.secoes.find((s) => s.tipo === id)?.md ?? "";
  const ativ = sec("atividades"), atividades = itensDe(ativ) || (ativ.match(/^###\s+\S/gm) ?? []).length;
  const corpo = a.corpo;
  return {
    mindmap: !!mermaidDe(sec("mindmap")),
    objetivos: itensDe(sec("objetivos")),
    habilidades: a.codigos.length,
    atividades,
    palavras: palavrasDe(sec("conteudo")),
    imagens: (corpo.match(/!\[\[|!\[[^\]]*\]\(/g) ?? []).length,
    links: (corpo.match(/(?<!!)\[\[[^\]]+\]\]/g) ?? []).length,
    faltam: ["objetivos", "habilidades", "conteudo", "atividades"].filter((id) => !itensDe(sec(id)) && !palavrasDe(sec(id))),
  };
}
