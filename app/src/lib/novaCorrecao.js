// Começa uma correção pelo app: cria a pasta do lote (Anos/AAAA/Correcoes/<turma>-<mês>-<atividade>) e a nota
// "Transcrições e devolutivas" com um bloco por aluno, já com os critérios da rubrica e as notas em branco.
import { raizDe } from "@/lib/raiz";
import { invoke } from "@/lib/api";
import { abreviar, listarAlunos } from "@/lib/diario";

export const MESES_NOMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const limpa = (s) => s.trim().replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ");

/** Siglas iguais (dois alunos que dão "AnSi") ganham número no fim, para nenhum bloco sumir: AnSi, AnSi2. */
const unicos = (l) => { const vistos = {}; return l.map((n) => { vistos[n] = (vistos[n] ?? 0) + 1; return vistos[n] > 1 ? `${n}${vistos[n]}` : n; }); };

/** Rubricas do vault (notas `Rubrica…` ou dentro de uma pasta de rubricas). */
export const listarRubricas = (items) => items.filter((i) => /(^|\/)rubricas?\b/i.test(i.rel) || /^Rubrica/i.test(i.name));

/** Critérios e pesos da tabela `| critério | peso |` da rubrica. */
export function criteriosDaRubrica(texto) {
  const out = [];
  for (const l of texto.split("\n")) {
    if (!l.trim().startsWith("|") || /^\|\s*:?-{2,}/.test(l)) continue;
    const c = l.split("|").slice(1, -1).map((x) => x.trim());
    if (c.length < 2 || /^crit[ée]rio$/i.test(c[0]) || !c[0]) continue;
    out.push({ nome: c[0], peso: c[1] });
  }
  return out;
}

/** Nomes dos alunos já cadastrados (Anos/AAAA/Alunos/<turma>) — ponto de partida da lista. */
export const alunosDaTurma = (items, ano, turma) => listarAlunos(items).filter((a) => a.ano === String(ano) && a.turma === turma).map((a) => a.name);

export function textoDaCorrecao({ turma, mes, atividade, rubrica, criterios, alunos, enunciado }) {
  const maxc = Math.max(0, ...criterios.map((c) => Number(String(c.peso).replace(",", ".")) || 0));
  const legenda = maxc ? `Média: 6. Cada critério vale 0, ${maxc / 2} ou ${maxc} ponto${maxc > 1 ? "s" : ""}.` : "Média: 6.";
  const cab = `---\ntipo: correcao\nturma: "${turma}"\nmes: ${mes}\natividade: ${atividade}\n${rubrica ? `rubrica: "[[${rubrica}]]"\n` : ""}status: andamento\ntranscricao: pendente\n---\n\n# Correção · ${turma} · ${atividade}\n\n${legenda}\n\n`;
  const enun = enunciado?.trim() ? `## Enunciado\n\n${enunciado.trim()}\n\n` : "";
  const crit = criterios.length ? criterios : [{ nome: "Nota" }];
  const bloco = (nome) => `## ${nome}\n\n### Texto\n\n\n\n### Avaliação\n\n| Critério | nota | comentário |\n|---|---|---|\n${crit.map((c) => `| ${c.nome} |  |  |`).join("\n")}\n| **Nota final** | **0** | |\n`;
  return cab + enun + alunos.map(bloco).join("\n");
}

/** Cria o lote e devolve o caminho da nota. Falha se a pasta já existir. */
export async function criarCorrecao(items, { ano, turma, mes, atividade, rubricaItem, alunos, enunciado }) {
  const nomeAtiv = limpa(atividade), nomes = unicos(alunos.map((a) => abreviar(limpa(a))).filter(Boolean));
  if (!nomeAtiv) throw new Error("Dê um nome à atividade.");
  if (!turma) throw new Error("Escolha a turma.");
  if (!nomes.length) throw new Error("Informe ao menos um aluno.");
  const pasta = `${turma}-${mes}-${nomeAtiv}`.replace(/\s/g, "-");
  const base = `${raizDe(items)}/Anos/${ano}`;
  if (items.some((i) => i.rel.startsWith(`Anos/${ano}/Correcoes/${pasta}/`))) throw new Error("Já existe uma correção com esse nome.");
  for (const [dir, name] of [[base, "Correcoes"], [`${base}/Correcoes`, pasta]]) { try { await invoke("create_folder", { dir, name }); } catch { /* já existe */ } }
  const criterios = rubricaItem ? criteriosDaRubrica(await invoke("read_note", { path: rubricaItem.path })) : [];
  const path = await invoke("create_note", { dir: `${base}/Correcoes/${pasta}`, name: "Transcrições e devolutivas" });
  await invoke("save_note", { path, text: textoDaCorrecao({ turma, mes, atividade: nomeAtiv, rubrica: rubricaItem?.name, criterios, alunos: nomes, enunciado }) });
  return path;
}
