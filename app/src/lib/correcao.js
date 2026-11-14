// Lê "Transcrições e devolutivas.md" de uma correção: um bloco "## Aluno" com foto, "### Texto" e "### Avaliação" (tabela).
import { invoke } from "@/lib/api";
import { setProp } from "@/lib/frontmatter";

export const MARCAS = /\[[^\]]*\?\]|\[ilegível\]/g;

/**
 * Erros do aluno marcados na transcrição (a transcrição guarda o que o aluno escreveu; quem marca é o professor/Claude):
 *   {errado|certo}      ortografia (a correção é opcional: {errado})
 *   {p:antes|depois}    pontuação: {p:|,} falta a vírgula; {p:,|} vírgula a mais; {p:e|, e} troca
 */
export const ERRO = /\{(p:)?([^{}|]*)(?:\|([^{}]*))?\}/;
export function contarErros(texto) {
  let orto = 0, pont = 0;
  for (const m of texto.matchAll(new RegExp(ERRO.source, "g"))) { if (m[1]) pont++; else orto++; }
  return { orto, pont };
}

export function parseCorrecao(text, dados = null) {
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(text)?.[1] ?? "";
  const prop = (k) => new RegExp(`^${k}:\\s*(.*)$`, "m").exec(fm)?.[1]?.trim() ?? "";
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const [legenda, ...blocos] = body.split(/^## /m);
  const alunos = blocos.filter((b) => /^### Avaliação/m.test(b)).map((b, i) => {
    const nome = b.split("\n")[0].trim();
    const foto = /!\[\[([^\]|]+)/.exec(b)?.[1]?.trim() ?? null;
    const [antes, aval] = b.split(/^### Avaliação\s*$/m);
    const texto = (/^### Texto\s*$([\s\S]*)/m.exec(antes)?.[1] ?? "").trim();
    const criterios = [];
    let final = null;
    for (const l of aval.replace(/\\\|/g, "\u0001").split("\n")) {
      if (!l.trim().startsWith("|")) continue;
      const c = l.split("|").slice(1, -1).map((x) => x.replaceAll("\u0001", "|").trim());
      if (/^\|\s*:?-{2,}/.test(l) || c[0] === "Critério") continue;
      if (/nota final/i.test(c[0])) { final = c[1].replace(/\*/g, ""); continue; }
      criterios.push({ nome: c[0], nota: c[1], comentario: c[2] ?? "" });
    }
    const total = somar(criterios);
    return { n: i + 1, nome, foto, texto, criterios, final, total, marcas: (texto.match(MARCAS) ?? []).length, erros: contarErros(texto) };
  });
  const { pesos, niveis, gradacao } = pesosDe(dados);
  return { pesos, niveis, gradacao, transcricao: prop("transcricao"), media: Number(/Média:\s*(\d+(?:[.,]\d+)?)/.exec(legenda)?.[1]?.replace(",", ".")) || 6, maxCriterio: maximoCriterio(legenda), turma: prop("turma"), mes: prop("mês") || prop("mes"), atividade: prop("atividade"), status: prop("status"), legenda: legenda.trim(), alunos };
}

export const listaCorrecoes = (items) => items
  .filter((i) => /^Anos\/\d{4}\/Correcoes\/[^/]+\/Transcrições e devolutivas\.md$/.test(i.rel))
  .map((i) => ({ ...i, pasta: i.rel.split("/")[3] }));

/** Pesos, níveis dos descritores e gradação vindos do `_dados.json` da pasta; sem ele, todos os critérios valem igual. */
function pesosDe(dados) {
  const crit = Array.isArray(dados?.criterios) ? dados.criterios.filter((c) => c && typeof c === "object" && c.nome && Number.isFinite(Number(c.peso))) : [];
  const pesos = Object.fromEntries(crit.map((c) => [c.nome, Number(c.peso)]));
  // Chaves dos descritores ("1", "0,5", "0"…) = fração do peso que cada nível vale.
  const niveis = Object.fromEntries(crit.map((c) => [c.nome, Object.keys(c.descritores ?? {}).map((k) => Number(k.replace(",", "."))).filter(Number.isFinite)]).filter(([, v]) => v.length >= 2));
  const gradacao = Array.isArray(dados?.gradacao) && dados.gradacao.every((g) => Number.isFinite(Number(g))) ? dados.gradacao.map(Number) : null;
  return { pesos, niveis, gradacao };
}
/** Máximo de pontos do critério: o peso do `_dados.json`, ou o valor único lido da rubrica. */
export const maxDe = (d, nome) => d.pesos?.[nome] ?? d.maxCriterio;
/** Notas que o critério aceita: níveis dos descritores × peso; senão gradação × peso em múltiplos de 0,25; sem `_dados.json`, de 0,5 em 0,5. */
export function opcoesDe(d, nome) {
  const max = maxDe(d, nome);
  const frac = d.niveis?.[nome] ?? (d.gradacao && d.pesos?.[nome] != null ? d.gradacao : null);
  let base = frac ? frac.map((g) => g * max) : [];
  if (!d.niveis?.[nome]) base = base.filter((x) => Math.abs(x * 4 - Math.round(x * 4)) < 1e-9);
  if (base.length < 2) base = Array.from({ length: Math.round(max / 0.5) + 1 }, (_, k) => k * 0.5);
  return [...new Set(base.map((x) => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
}

export async function lerCorrecao(item) {
  const texto = await invoke("read_note", { path: item.path });
  let dados = null;
  try { const j = await invoke("read_sidecar", { path: item.path.replace(/[\\/][^\\/]*$/, "/_dados.json") }); dados = j ? JSON.parse(j) : null; } catch { /* sem _dados.json: pesos iguais */ }
  return { ...parseCorrecao(texto, dados), path: item.path };
}

// ---------- notas ----------
export const num = (s) => { const n = parseFloat(String(s ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
export const fmt = (n) => (n == null ? "—" : String(Math.round(n * 100) / 100).replace(".", ","));
function somar(criterios) {
  const v = criterios.map((c) => num(c.nota));
  return v.some((x) => x == null) ? (v.every((x) => x == null) ? null : v.reduce((a, b) => a + (b ?? 0), 0)) : v.reduce((a, b) => a + b, 0);
}
/** "Cada critério vale 0, 0,5 ou 1 ponto" → 1 (pesos iguais; vem do texto da rubrica, sem _dados.json). */
function maximoCriterio(legenda) {
  const m = /vale\s+([\d.,]+(?:\s*,\s*[\d.,]+)*)\s+ou\s+([\d.,]+)\s*ponto/i.exec(legenda);
  return (m && num(m[2])) || 1;
}

/** Média, mediana, faixas e média por critério da turma. Nota = soma dos critérios (a "Nota final" do arquivo só confere). */
export function estatisticas(d) {
  const crit = d.alunos[0]?.criterios.map((c) => c.nome) ?? [];
  const maximo = crit.reduce((t, n) => t + maxDe(d, n), 0);
  const notas = d.alunos.map((a) => a.total).filter((x) => x != null).sort((x, y) => x - y);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const mediana = notas.length ? (notas.length % 2 ? notas[(notas.length - 1) / 2] : (notas[notas.length / 2 - 1] + notas[notas.length / 2]) / 2) : null;
  const nFaixas = Math.max(1, Math.ceil(maximo)); // uma faixa a cada 1 ponto; a última inclui o máximo
  const faixas = Array.from({ length: nFaixas }, (_, k) => ({ de: k, ate: Math.min(k + 1, maximo), n: 0 }));
  for (const x of notas) faixas[Math.min(nFaixas - 1, Math.floor(x))].n++;
  const porCriterio = crit.map((nome, k) => {
    const v = d.alunos.map((a) => num(a.criterios[k]?.nota)).filter((x) => x != null);
    return { nome, max: maxDe(d, nome), media: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null };
  });
  const divergentes = d.alunos.filter((a) => a.total != null && a.final != null && num(a.final) !== a.total).map((a) => a.n);
  return {
    maximo, media, mediana, min: notas[0] ?? null, max: notas[notas.length - 1] ?? null, faixas, porCriterio, divergentes,
    abaixo: notas.filter((x) => x < d.media).length, semNota: d.alunos.filter((a) => a.total == null).length,
    pendentes: d.alunos.filter((a) => a.marcas > 0).length, marcas: d.alunos.reduce((s, a) => s + a.marcas, 0),
  };
}

export function devolutiva(d, a, nome = true) {
  const max = a.criterios.reduce((t, c) => t + maxDe(d, c.nome), 0);
  return [`# ${nome ? a.nome : "Aluno " + a.n} — ${d.atividade || "Produção textual"}${d.turma ? ` (turma ${d.turma})` : ""}`, "",
    `**Nota: ${fmt(a.total)} de ${fmt(max)}**`, "",
    ...a.criterios.map((c) => `- **${c.nome}** (${c.nota}): ${c.comentario}`)].join("\n") + "\n";
}

/** Troca a nota de um critério do aluno e recalcula a linha "Nota final" do bloco, mexendo só nessas linhas. */
export function editarNota(text, alunoNome, criterio, valor) {
  const linhas = text.split("\n");
  const ini = linhas.findIndex((l) => l.trim() === "## " + alunoNome);
  if (ini < 0) throw new Error("aluno não encontrado: " + alunoNome);
  let fim = linhas.findIndex((l, i) => i > ini && /^## /.test(l)); if (fim < 0) fim = linhas.length;
  let achou = false, final = -1;
  const notas = [];
  for (let i = ini; i < fim; i++) {
    if (!linhas[i].trim().startsWith("|")) continue;
    const m = /^(\|\s*)([^|]*?)(\s*\|\s*)([^|]*?)(\s*\|.*)$/.exec(linhas[i]);
    if (!m || /^:?-{2,}/.test(m[2]) || m[2] === "Critério") continue;
    if (/nota final/i.test(m[2])) { final = i; continue; }
    if (m[2] === criterio) { linhas[i] = m[1] + m[2] + m[3] + fmt(valor) + m[5]; achou = true; }
    notas.push(num(/^(\|\s*[^|]*?\s*\|\s*)([^|]*?)\s*\|/.exec(linhas[i])?.[2]));
  }
  if (!achou) throw new Error("critério não encontrado: " + criterio);
  if (final >= 0) { const soma = notas.reduce((a, b) => a + (b ?? 0), 0); linhas[final] = linhas[final].replace(/^(\|\s*\*\*Nota final\*\*\s*\|\s*)\*\*[^*]*\*\*/, `$1**${fmt(soma)}**`); }
  return linhas.join("\n");
}

export async function gravarNota(path, alunoNome, criterio, valor) {
  const t = await invoke("read_note", { path });
  await invoke("save_note", { path, text: editarNota(t, alunoNome, criterio, valor) });
}
export async function aprovarTranscricao(path, estado = "aprovada") {
  const t = await invoke("read_note", { path });
  await invoke("save_note", { path, text: setProp(t, "transcricao", estado) });
}
