// Lê os planos de ciclo de Anos/AAAA/Planejamento (nome "ATC - Título - PR.md": A = ano, T = trimestre, C = ciclo).
import { invoke } from "@/lib/api";

export const FASES = [
  { id: "diagnosticar", nome: "Diagnosticar", cor: "#8A78B8" },
  { id: "ler", nome: "Ler e interpretar", cor: "#5B8DB8" },
  { id: "explicar", nome: "Explicar", cor: "#4F8A8F" },
  { id: "sistematizar", nome: "Sistematizar", cor: "#6F9A5F" },
  { id: "exercitar", nome: "Exercitar", cor: "#D49A2A" },
  { id: "revisar", nome: "Revisar", cor: "#B8607E" },
  { id: "avaliar", nome: "Avaliar", cor: "#C0584A" },
  { id: "corrigir", nome: "Corrigir", cor: "#8C867B" },
  { id: "recuperar", nome: "Recuperar", cor: "#C9803A" },
  { id: "fechar", nome: "Fechar", cor: "#6B9A86" },
];

export function faseDaAula(texto) {
  const t = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/diagnostic/.test(t)) return "diagnosticar";
  if (/recuperacao/.test(t)) return "recuperar";
  if (/correcao/.test(t)) return "corrigir";
  if (/\bprova\b/.test(t)) return "avaliar";
  if (/finalizacao|fechamento/.test(t)) return "fechar";
  if (/revisao/.test(t)) return "revisar";
  if (/^\W*exercicios/.test(t) || texto.trim().startsWith("🔻")) return "exercitar";
  if (/leitura|interpreta/.test(t)) return "ler";
  if (/sistematiza|definicao/.test(t)) return "sistematizar";
  if (/exercicios/.test(t)) return "exercitar";
  return "explicar";
}

export function parseCiclo(item, text) {
  const m = /^(\d)(\d)(\d)(?:\s*-\s*(.*))?$/.exec(item.name);
  if (!m) return null;
  const rest = (m[4] ?? "").replace(/\s*-\s*(PR|PT|TG)\s*$/, "").replace(/^(PR|PT|TG)$/, "").trim();
  const sufixo = /-\s*(PR|PT|TG)\s*$/.exec(item.name)?.[1] ?? null;
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const secao = (nome) => new RegExp(`^##\\s+${nome}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "m").exec(body)?.[1] ?? "";
  const aulas = secao("Aulas").split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l)).map((l) => {
    const c = l.split("|").map((x) => x.trim());
    return { n: Number(c[1]), texto: c[2] ?? "", recurso: c[3] ?? "", fase: faseDaAula(c[2] ?? "") };
  });
  return {
    path: item.path, name: item.name, ano: Number(m[1]), tri: Number(m[2]), ciclo: Number(m[3]),
    titulo: rest || `Ciclo ${m[1]}${m[2]}${m[3]}`, vazio: !rest, sufixo, aulas,
    habilidades: [...new Set(body.match(/EF\d\dLP\d\d/g) ?? [])],
    habTexto: secao("Habilidades").split("\n").map((l) => /^\(?(EF\d\dLP\d\d)\)?\s*(.*)/.exec(l.trim())).filter(Boolean).map((m) => ({ codigo: m[1], texto: m[2] })),
    conteudos: secao("Conteúdos").split("\n").map((l) => /^\s*-\s+(.*)/.exec(l)?.[1]).filter(Boolean),
  };
}

export async function lerCiclos(items) {
  const r = items.map((i) => ({ i, m: /^Anos\/(\d{4})\/Planejamento\/\d{3}\b/.exec(i.rel) })).filter((x) => x.m);
  const anoLetivo = r.map((x) => x.m[1]).sort().pop() ?? null;
  const list = await Promise.all(r.filter((x) => x.m[1] === anoLetivo).map(async ({ i }) => {
    try { return parseCiclo(i, await invoke("read_note", { path: i.path })); } catch { return null; }
  }));
  return { anoLetivo, ciclos: list.filter(Boolean).sort((a, b) => a.ano - b.ano || a.tri - b.tri || a.ciclo - b.ciclo) };
}

// Edição da tabela "## Aulas": mexe só nas linhas `| N | ... |`, mantém as outras como estão e renumera.
const ehAula = (l) => /^\|\s*\d+\s*\|/.test(l);
function editarTabela(text, fn) {
  const linhas = text.split("\n");
  const ini = linhas.findIndex((l) => /^##\s+Aulas\s*$/.test(l));
  if (ini < 0) throw new Error("O plano não tem a seção “## Aulas”.");
  let a = ini + 1;
  while (a < linhas.length && !ehAula(linhas[a]) && !/^##\s/.test(linhas[a])) a++;
  let b = a;
  while (b < linhas.length && ehAula(linhas[b])) b++;
  if (a === b) throw new Error("A tabela de aulas está vazia.");
  const novas = fn(linhas.slice(a, b)).map((l, i) => l.replace(/^\|(\s*)(\d+)(\s*)\|/, (_, x, velho, y) => {
    const larg = x.length + velho.length + y.length, n = String(i + 1);
    return "|" + x + n + " ".repeat(Math.max(1, larg - x.length - n.length)) + "|";
  }));
  return [...linhas.slice(0, a), ...novas, ...linhas.slice(b)].join("\n");
}

// Insere uma aula nova na posição `pos` (1 = antes da primeira; N+1 = no fim): as seguintes deslocam.
export function inserirAula(text, pos, conteudo) {
  const nova = `| 0 | ${conteudo.replace(/\|/g, "\\|")} |  |`;
  return editarTabela(text, (rows) => [...rows.slice(0, pos - 1), nova, ...rows.slice(pos - 1)]);
}

export function removerAula(text, n) {
  return editarTabela(text, (rows) => rows.filter((_, i) => i !== n - 1));
}

export async function salvarAulas(ciclo, acao) {
  const text = await invoke("read_note", { path: ciclo.path });
  await invoke("save_note", { path: ciclo.path, text: acao(text) });
  return parseCiclo({ path: ciclo.path, name: ciclo.name }, await invoke("read_note", { path: ciclo.path }));
}
