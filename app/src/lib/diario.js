// Diário de aula e notas de aluno (dados sensíveis; o MCP não lê estas pastas).
//   Anos/AAAA/Diarios/<turma>/Diario <turma> - <rótulo da semana>.md   (tipo: diario)
//   Anos/AAAA/Alunos/<turma>/<Nome>.md                                 (tipo: aluno)
// No diário, cada aula é uma seção "## Aula N — texto"; ocorrência de aluno = linha "- [[Nome]] — texto".
// As notas de aluno não guardam cópia: o app junta as ocorrências lendo os diários.
import { invoke } from "@/lib/api";
import { setProp } from "@/lib/frontmatter";

export const ESTADOS = [
  { id: "pendente", nome: "Pendente" },
  { id: "aguardando-revisao", nome: "Aguardando revisão" },
  { id: "aprovada", nome: "Aprovada" },
];

const raiz = (items) => items[0].path.slice(0, items[0].path.length - items[0].rel.length).replace(/\/$/, "");
const pasta = (items, ano, tipo, turma) => `${raiz(items)}/Anos/${ano}/${tipo}/${turma}`;
const prop = (text, k) => new RegExp(`^${k}:[ \\t]*["']?(.*?)["']?[ \\t]*$`, "m").exec(text.split(/\n---/)[0])?.[1] ?? "";
export const turmasDe = (s) => [...new Set((s.match(/\d{2}/g) ?? []))];

export function listarDiarios(items) {
  return items.map((i) => ({ i, m: /^Anos\/(\d{4})\/Diarios\/([^/]+)\/[^/]+\.md$/.exec(i.rel) })).filter((x) => x.m)
    .map(({ i, m }) => ({ ...i, ano: m[1], turma: m[2] })).sort((a, b) => a.rel.localeCompare(b.rel, "pt-BR", { numeric: true }));
}
export function listarAlunos(items) {
  return items.map((i) => ({ i, m: /^Anos\/(\d{4})\/Alunos\/([^/]+)\/[^/]+\.md$/.exec(i.rel) })).filter((x) => x.m)
    .map(({ i, m }) => ({ ...i, ano: m[1], turma: m[2] })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export const lerMeta = (text) => ({ semana: prop(text, "semana"), transcricao: prop(text, "transcricao") || "pendente", foto: prop(text, "foto") });

/** Aulas do diário: [{ titulo, ini, fim }] em linhas; ocorrências: [{ aluno, texto, linha }]. */
export function aulasDoDiario(text) {
  const linhas = text.split("\n"), aulas = [];
  linhas.forEach((l, i) => { if (/^##\s+Aula\b/.test(l)) aulas.push({ titulo: l.replace(/^##\s+/, ""), ini: i, fim: linhas.length }); });
  aulas.forEach((a, k) => { if (aulas[k + 1]) a.fim = aulas[k + 1].ini; });
  return aulas;
}
export function ocorrenciasDoDiario(text) {
  const linhas = text.split("\n"), aulas = aulasDoDiario(text), out = [];
  linhas.forEach((l, i) => {
    const m = /^\s*-\s+\[\[([^\]|#]+)(?:[^\]]*)\]\]\s*(?:[—–-]\s*)?(.*)$/.exec(l);
    if (m) out.push({ aluno: m[1].trim(), texto: m[2].trim(), linha: i, aula: aulas.find((a) => i > a.ini && i < a.fim)?.titulo ?? "" });
  });
  return out;
}

export async function criarDiario(items, { ano, turma, semana, aulas, foto }) {
  const dirTipo = `${raiz(items)}/Anos/${ano}`;
  for (const [dir, name] of [[dirTipo, "Diarios"], [`${dirTipo}/Diarios`, turma]]) { try { await invoke("create_folder", { dir, name }); } catch { /* já existe */ } }
  const path = await invoke("create_note", { dir: pasta(items, ano, "Diarios", turma), name: `Diario ${turma} - ${semana}` });
  const fm = `---\ntipo: diario\nano: ${ano}\nturma: "${turma}"\nsemana: ${semana}\ntranscricao: ${foto ? "pendente" : "aprovada"}\n${foto ? `foto: ${foto}\n` : ""}---\n`;
  const corpo = aulas.map((a, i) => `## Aula ${i + 1} — ${a}\n\nDado: \n`).join("\n");
  await invoke("save_note", { path, text: `${fm}# Diário ${turma} — ${semana}\n\n${corpo}` });
  return path;
}

export async function criarAluno(items, { ano, turma, nome }) {
  const dirTipo = `${raiz(items)}/Anos/${ano}`;
  for (const [dir, n] of [[dirTipo, "Alunos"], [`${dirTipo}/Alunos`, turma]]) { try { await invoke("create_folder", { dir, name: n }); } catch { /* já existe */ } }
  const path = await invoke("create_note", { dir: pasta(items, ano, "Alunos", turma), name: nome });
  await invoke("save_note", { path, text: `---\ntipo: aluno\nano: ${ano}\nturma: "${turma}"\n---\n# ${nome}\n\nAs ocorrências vêm dos diários (aba Alunos do app). Observações livres abaixo.\n` });
  return path;
}

/** Acrescenta "- [[Aluno]] — texto" ao fim da aula `n` (1 = primeira); sem essa aula, ao fim da nota. */
export function inserirOcorrencia(text, n, aluno, texto) {
  const linhas = text.split("\n"), aula = aulasDoDiario(text)[n - 1];
  let pos = aula ? aula.fim : linhas.length;
  while (pos > (aula?.ini ?? 0) + 1 && linhas[pos - 1].trim() === "") pos--;
  linhas.splice(pos, 0, `- [[${aluno}]] — ${texto.replace(/\n/g, " ")}`);
  return linhas.join("\n");
}
export const mudarEstado = (text, estado) => setProp(text, "transcricao", estado);
