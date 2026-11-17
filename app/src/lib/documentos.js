// Documentos = a pasta Acervo inteira numa só lista (as provas moram em Acervo/Provas; as antigas, em Anos/AAAA/Provas, ainda são reconhecidas).
// Funções puras de apoio: tipo de cada arquivo (pelo caminho), constantes de situação/ano e metadados de aula e gramática.
import { parseFm } from "@/lib/frontmatter";
import { parseGramatica } from "@/lib/gramatica";

export const norm = (x) => String(x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const SITUACOES = [
  { id: "pendente", nome: "Pendente", ponto: "bg-muted-foreground/50" },
  { id: "andamento", nome: "Em andamento", ponto: "bg-warn" },
  { id: "finalizado", nome: "Finalizada", ponto: "bg-ok" },
];
export const ANOS = ["6", "7", "8", "9"];
export const quando = (s) => (s ? new Date(s * 1000).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "—");

/** Tipos de documento, na ordem em que aparecem nos filtros. `pasta`: onde nasce em Acervo (vazio = fora do Acervo). */
export const TIPOS = [
  { id: "aula", nome: "Aulas", um: "Aula", pasta: "Aulas" },
  { id: "gramatica", nome: "Gramática", um: "Gramática", pasta: "Gramática" },
  { id: "texto", nome: "Textos", um: "Texto", pasta: "Textos" },
  { id: "banco", nome: "Bancos de questões", um: "Banco de questões", pasta: "Questoes" },
  { id: "oficina", nome: "Oficinas", um: "Oficina", pasta: "Oficinas" },
  { id: "ciclo", nome: "Ciclos", um: "Ciclo", pasta: "Ciclos" },
  { id: "prova", nome: "Provas", um: "Prova", pasta: "Provas" },
  { id: "doc", nome: "Outros", um: "Documento", pasta: "" },
];
export const NOMES_PASTA = { Questoes: "Questões" };

export const ehProvaLegada = (rel) => /^Anos\/\d{4}\/Provas\/[^/]+\.md$/.test(rel);
export const ehProva = (rel) => /^Acervo\/Provas\/[^/]+\.md$/.test(rel) || ehProvaLegada(rel);
export const listaProvas = (items) => items.filter((i) => ehProva(i.rel));
/** Documento do Acervo (qualquer .md, menos as imagens de textos). */
export const ehDoAcervo = (rel) => /^Acervo\/.+\.md$/.test(rel) && !/\/imagens\//.test(rel);

/** Tipo do documento, só pelo caminho. */
export function tipoDe(rel) {
  if (ehProva(rel)) return "prova";
  if (/^Acervo\/Aulas\//.test(rel)) return "aula";
  if (/^Acervo\/Gram[aá]tica\//.test(rel)) return "gramatica";
  if (/^Acervo\/Textos\//.test(rel)) return "texto";
  if (/^Acervo\/Questoes\//.test(rel)) return "banco";
  if (/^Acervo\/Oficinas\//.test(rel)) return "oficina";
  if (/^Acervo\/Ciclos\//.test(rel)) return "ciclo";
  return "doc";
}

/** Subpasta dentro da pasta do tipo, quando a pasta aberta em Documentos está nela ("" se não estiver). Ex.: ("Aulas/_novas", "Aulas") → "_novas". */
export const subDaPasta = (pastaAberta, pastaDoTipo) => (pastaAberta.split("/")[0] === pastaDoTipo ? pastaAberta.split("/").slice(1).join("/") : "");

const campoFm = (fm, ...ks) => { for (const k of ks) { const e = fm.entries.find((x) => x.key === k); const v = e?.value || (e?.items ?? []).join(", "); if (v) return v; } return ""; };
const anosDe = (s) => (String(s).match(/[6-9]/g) ?? []).filter((a, i, arr) => arr.indexOf(a) === i);
const limpar = (l) => l.replace(/^>\s*(\[![^\]]*\][+-]?\s*)?/, "").replace(/^#+\s.*$/, "").replace(/!?\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/<[^>]*>/g, "").replace(/[*_`=~]/g, "").replace(/^[-+]\s+/, "").trim();

/** Metadados de uma aula, lidos do frontmatter e do corpo: ano(s), situação, assuntos, seções e um trecho para a prévia. */
export function metaDe(texto) {
  const fm = parseFm(texto);
  const val = (k) => fm.entries.find((e) => e.key === k);
  const lista = (k) => { const e = val(k); return e ? (e.items ?? (e.value ? [e.value] : [])).map(String).filter(Boolean) : []; };
  const corpo = (fm.has ? fm.lines.slice(fm.end + 1).join("\n") : texto);
  const titulos = [...corpo.matchAll(/^##\s+(.*)$/gm)].map((m) => norm(m[1]));
  const trecho = corpo.split("\n").map(limpar).filter((l) => l.length > 24 && !/^[-|:]+$/.test(l)).slice(0, 4).join(" ");
  return {
    anos: lista("ano"), situacao: (val("status")?.value || "pendente").trim(), assuntos: lista("assuntos"), tags: lista("tags"),
    mindmap: titulos.some((t) => /mindmap|mapa mental|esquema/.test(t)) || /```mermaid/.test(corpo),
    atividades: titulos.some((t) => /atividade/.test(t)),
    palavras: corpo.split(/\s+/).filter(Boolean).length, trecho: trecho.slice(0, 260),
  };
}

/** Metadados de um tópico de gramática. */
export function metaGramatica(texto) {
  const g = parseGramatica(texto), regra = g.secoes.find((s) => s.tipo === "regra")?.md ?? "";
  return { anos: g.anos, situacao: g.status || "pendente", assuntos: g.assuntos.split(",").map((x) => x.trim()).filter(Boolean), exemplos: (texto.match(/^```exemplo/gm) ?? []).length, trecho: regra.replace(/[*_`>#\-]/g, "").replace(/\s+/g, " ").trim().slice(0, 260) };
}

/** Metadados de texto, oficina ou qualquer outro documento: o que o frontmatter tiver (autor, gênero, foco…) e um trecho. */
export function metaFicha(texto) {
  const fm = parseFm(texto), g = (...a) => campoFm(fm, ...a);
  const corpo = (fm.has ? fm.lines.slice(fm.end + 1).join("\n") : texto);
  const trecho = corpo.split("\n").map(limpar).filter((l) => l.length > 0).join(" ").replace(/\s+/g, " ").slice(0, 220);
  return {
    anos: anosDe(g("ano", "anos")), situacao: "", autor: g("autor", "author"), genero: g("genero"), foco: g("foco", "conteudo"),
    titulo: g("titulo", "title"), assuntos: [], trecho,
    busca: [g("autor", "author"), g("genero"), g("tags"), g("conteudos", "conteudo")].join(" "),
  };
}

/** Metadados de uma prova (frontmatter solto, lido por expressão regular). */
export function metaProva(texto) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(texto)?.[1] ?? "", corpo = texto.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const prop = (k) => new RegExp(`^${k}:\\s*(.*)$`, "m").exec(fm)?.[1]?.trim().replace(/^"(.*)"$/, "$1") ?? "";
  const turma = prop("turma");
  return { turma, anos: /^[6-9]/.test(turma) ? [turma[0]] : [], data: prop("data"), valor: prop("valor"), nq: (prop("questoes").match(/\d+/g) ?? []).length, trecho: corpo.replace(/[#*>\[\]]/g, "").trim().slice(0, 200) };
}
