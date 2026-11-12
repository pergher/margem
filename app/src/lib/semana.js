// Lê `Anos/AAAA/Planejamento/Planejamento.md`: "## A fazer" (tarefas) e "## Sema" com uma tabela por turma ("### 61").
// Em cada tabela a linha marcada com ✓ já foi dada; a primeira sem ✓ é a aula de hoje.
import { invoke } from "@/lib/api";
import { faseDaAula } from "@/lib/ciclos";

export function parseSemana(text) {
  const t = text.replace(/\\\|/g, "\u0001");
  const cel = (s) => s.replaceAll("\u0001", "|").trim();
  const afazer = [...(/^##\s+A fazer\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(t)?.[1] ?? "").matchAll(/^\s*-\s+\[( |x)\]\s+(.*)$/gm)].map((m) => ({ feito: m[1] === "x", texto: m[2] }));
  const sema = /^##\s+Sema\s*$([\s\S]*)/m.exec(t)?.[1] ?? "";
  const turmas = sema.split(/^###\s+/m).slice(1).map((bloco) => {
    const [titulo, ...resto] = bloco.split("\n");
    const linhas = resto.filter((l) => l.trim().startsWith("|"));
    const cab = linhas[0]?.split("|").slice(1, -1).map(cel) ?? [];
    const aulas = linhas.slice(2).map((l) => l.split("|").slice(1, -1).map(cel)).filter((c) => c[0]).map((c, i) => ({
      n: i + 1, texto: c[0].replace(/\s*✓\s*$/, ""), recurso: c[1] ?? "", dada: /✓\s*$/.test(c[0]), fase: faseDaAula(c[0]),
    }));
    return { turma: titulo.trim(), trimestre: cab[0] ?? "", cicloNome: /\[\[([^\]|#]+)/.exec(cab[1] ?? "")?.[1]?.trim() ?? null, aulas };
  }).filter((x) => x.aulas.length);
  return { afazer, turmas };
}

export async function lerSemana(items) {
  const it = items.filter((i) => /^Anos\/\d{4}\/Planejamento\/Planejamento\.md$/.test(i.rel)).sort((a, b) => a.rel.localeCompare(b.rel)).pop();
  if (!it) return null;
  return { path: it.path, ...parseSemana(await invoke("read_note", { path: it.path })) };
}

// Marca/desmarca ✓ na aula `n` (1 = primeira linha) da tabela da turma, mexendo só nessa célula.
export const alternarAula = (text, turma, n, dada) => situacaoAula(text, turma, n, dada ? "dada" : null);
export function situacaoAula(text, turma, n, situacao) {
  const marca = SITUACOES.find((x) => x.id === situacao)?.marca ?? "";
  const linhas = text.split("\n");
  let i = linhas.findIndex((l) => new RegExp(`^###\\s+${turma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`).test(l));
  if (i < 0) throw new Error("turma não encontrada: " + turma);
  let vistas = -1;
  for (i += 1; i < linhas.length && !/^#{1,3}\s/.test(linhas[i]); i++) {
    if (!linhas[i].trim().startsWith("|")) continue;
    vistas++;
    if (vistas < 2 || vistas - 1 !== n) continue;
    const m = /^(\|\s*)(.*?)(\s*)(\|.*)$/.exec(linhas[i]);
    const conteudo = tiraMarca(m[2]);
    linhas[i] = m[1] + (marca ? conteudo + " " + marca : conteudo) + (marca ? m[3] : m[3] + "  ") + m[4];
    return linhas.join("\n");
  }
  throw new Error("aula não encontrada: " + n);
}

export async function marcarAula(path, turma, n, dada) {
  const text = await invoke("read_note", { path });
  await invoke("save_note", { path, text: alternarAula(text, turma, n, dada) });
}

// ======================= Notas `tipo: semana` (Anos/AAAA/Semanas/Semana AAAA-MM-DD.md) =======================
// Uma tabela por turma ("### 61") com colunas Aula | Recurso | Ciclo. ✓ no fim da Aula = já dada.
// Ciclo = "[[231 - Crase]] 3" (aula 3 do ciclo) ou vazio (aula avulsa). Só o rótulo é mostrado, sem datas de aula.
import { inserirAula, parseCiclo } from "@/lib/ciclos";

export const AULAS_POR_SEMANA = 4;

/** Situação de uma aula da semana; a marca fica no fim da célula "Aula". Sem marca = ainda planejada. */
export const SITUACOES = [
  { id: "dada", marca: "✓", nome: "Dada" },
  { id: "pulada", marca: "↷", nome: "Pulei" },
  { id: "incerta", marca: "❔", nome: "Não sei" },
];
const reMarca = /\s*(✓|↷|❔)\s*$/;
const tiraMarca = (t) => t.replace(reMarca, "");
const marcaDe = (a) => { const m = SITUACOES.find((x) => x.id === (a.situacao ?? (a.dada ? "dada" : null)))?.marca; return m ? " " + m : ""; };
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad = (n) => String(n).padStart(2, "0");

/** Segunda-feira da semana de `hoje` (sábado e domingo valem para a semana seguinte). */
export function segundaDe(hoje = new Date()) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dow = d.getDay(); // 0 = domingo
  d.setDate(d.getDate() + (dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow));
  return d;
}
export function rotuloDe(seg) {
  const sex = new Date(seg); sex.setDate(seg.getDate() + 4);
  return seg.getMonth() === sex.getMonth()
    ? `${seg.getDate()} a ${sex.getDate()} de ${MESES[seg.getMonth()]}`
    : `${seg.getDate()} de ${MESES[seg.getMonth()]} a ${sex.getDate()} de ${MESES[sex.getMonth()]}`;
}
export const nomeSemana = (seg) => `Semana ${seg.getFullYear()}-${pad(seg.getMonth() + 1)}-${pad(seg.getDate())}`;

const celula = (s) => s.replace(/\|/g, "\\|");
const refCiclo = (a) => (a.cicloNome ? `[[${a.cicloNome}]]${a.cicloN ? " " + a.cicloN : ""}` : "");

export function renderSemana({ ano, rotulo, turmas }) {
  const blocos = turmas.map((t) => [
    `### ${t.turma}`, "", ...(t.cicloNome ? [`Ciclo: [[${t.cicloNome}]]`, ""] : []), "| Aula | Recurso | Ciclo |", "|---|---|---|",
    ...t.aulas.map((a) => `| ${celula(a.texto)}${marcaDe(a)} | ${celula(a.recurso ?? "")} | ${refCiclo(a)} |`),
  ].join("\n"));
  return `---\ntipo: semana\nano: ${ano}\nrotulo: ${rotulo}\n---\n# Semana — ${rotulo}\n\n${blocos.join("\n\n")}\n`;
}

export function parseSemanaNota(text) {
  const t = text.replace(/\\\|/g, "\u0001");
  const cel = (s) => s.replaceAll("\u0001", "|").trim();
  const rotulo = /^rotulo:\s*(.+)$/m.exec(t)?.[1]?.trim() ?? "";
  const corpo = t.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const turmas = corpo.split(/^###\s+/m).slice(1).map((bloco) => {
    const [titulo, ...resto] = bloco.split("\n");
    const linhas = resto.filter((l) => l.trim().startsWith("|")).slice(2);
    const cicloTurma = /^Ciclo:\s*\[\[([^\]|#]+)/m.exec(resto.join("\n"))?.[1]?.trim() ?? null;
    const aulas = linhas.map((l) => l.split("|").slice(1, -1).map(cel)).filter((c) => c[0]).map((c, i) => {
      const m = /\[\[([^\]|#]+)[^\]]*\]\]\s*(\d+)?/.exec(c[2] ?? "");
      const situacao = SITUACOES.find((x) => c[0].endsWith(x.marca))?.id ?? null;
      return { n: i + 1, texto: tiraMarca(c[0]), situacao, dada: situacao === "dada", recurso: c[1] ?? "", cicloNome: m?.[1].trim() ?? null, cicloN: m?.[2] ? Number(m[2]) : null, fase: faseDaAula(c[0]) };
    });
    return { turma: titulo.trim(), cicloNome: cicloTurma, aulas };
  });
  return { rotulo, turmas };
}

export async function lerSemanas(items) {
  const its = items.filter((i) => /^Anos\/\d{4}\/Semanas\/[^/]+\.md$/.test(i.rel)).sort((a, b) => a.rel.localeCompare(b.rel));
  const out = [];
  for (const it of its) {
    try {
      const text = await invoke("read_note", { path: it.path });
      if (/^tipo:\s*semana\s*$/m.test(text)) out.push({ path: it.path, name: it.name, ...parseSemanaNota(text) });
    } catch { /* ignora nota ilegível */ }
  }
  return out;
}

const mesmaChave = (a, nome, n) => a.cicloNome && a.cicloNome.toLowerCase() === nome.toLowerCase() && a.cicloN === n;

/** Ciclo atual de uma turma: o declarado na semana mais recente que a tem, ou o da última aula ligada a um ciclo. */
export function cicloDaTurma(semanas, turma) {
  for (const sm of [...semanas].reverse()) {
    const t = sm.turmas.find((x) => x.turma === turma);
    if (!t) continue;
    const nome = t.cicloNome ?? [...t.aulas].reverse().find((a) => a.cicloNome)?.cicloNome;
    if (nome) return nome;
  }
  return null;
}

/** As próximas aulas (ainda sem linha em nenhuma semana) do ciclo `nomeCiclo`, até `qtd`. */
export function proximasDoCiclo({ ciclos, semanas, turma, nomeCiclo, qtd, excluir = [] }) {
  const ciclo = nomeCiclo ? ciclos.find((c) => c.name.toLowerCase() === nomeCiclo.toLowerCase()) : null;
  if (!ciclo) return [];
  const todas = semanas.flatMap((s) => s.turmas.filter((t) => t.turma === turma).flatMap((t) => t.aulas));
  return ciclo.aulas.filter((a) => !todas.some((x) => mesmaChave(x, nomeCiclo, a.n)) && !excluir.some((x) => mesmaChave(x, nomeCiclo, a.n))).slice(0, Math.max(0, qtd))
    .map((a) => ({ texto: a.texto.replace(/\s*✓\s*$/, ""), recurso: a.recurso ?? "", cicloNome: nomeCiclo, cicloN: a.n, dada: false, situacao: null, fase: a.fase }));
}

/**
 * Rascunho da semana nova: por turma (as turmas das semanas já gravadas), as aulas não dadas da semana anterior
 * (o professor tira com ✕) e as próximas do ciclo atual até completar `qtd`.
 */
export function sugerirSemana({ ciclos, semanas, qtd = AULAS_POR_SEMANA }) {
  const ultima = semanas[semanas.length - 1];
  const turmas = [...new Set(semanas.flatMap((s) => s.turmas.map((t) => t.turma)))].sort();
  return turmas.map((turma) => {
    const cicloNome = cicloDaTurma(semanas, turma);
    const sobras = (ultima?.turmas.find((t) => t.turma === turma)?.aulas ?? []).filter((a) => !a.dada).map((a) => ({ ...a, dada: false, situacao: null, trazida: true }));
    let nome = cicloNome;
    let novas = proximasDoCiclo({ ciclos, semanas, turma, nomeCiclo: nome, qtd: qtd - sobras.length, excluir: sobras });
    // Ciclo esgotado (todas as aulas já têm linha numa semana): propõe o ciclo seguinte do plano.
    const k = ciclos.findIndex((c) => c.name.toLowerCase() === (nome ?? "").toLowerCase());
    if (!novas.length && !sobras.length && k >= 0 && ciclos[k + 1]) {
      nome = ciclos[k + 1].name;
      novas = proximasDoCiclo({ ciclos, semanas, turma, nomeCiclo: nome, qtd, excluir: [] });
    }
    return { turma, cicloNome: nome, aulas: [...sobras, ...novas] };
  });
}

/**
 * Cria a nota de histórico a partir do Planejamento.md antigo (uma só vez): por turma, o ciclo e as aulas já marcadas ✓.
 * Depois disso nenhuma tela lê o Planejamento.md: o progresso vive nas notas `tipo: semana`.
 */
export async function importarLegado(items, legado, ano) {
  const turmas = legado.turmas.map((t) => ({
    turma: t.turma, cicloNome: t.cicloNome,
    aulas: t.aulas.filter((a) => a.dada).map((a) => ({ texto: a.texto, recurso: a.recurso, dada: true, situacao: "dada", cicloNome: t.cicloNome, cicloN: a.n })),
  }));
  const raiz = items[0].path.slice(0, items[0].path.length - items[0].rel.length).replace(/\/$/, "");
  const dirAno = `${raiz}/Anos/${ano}`;
  try { await invoke("create_folder", { dir: dirAno, name: "Semanas" }); } catch { /* já existe */ }
  const path = await invoke("create_note", { dir: `${dirAno}/Semanas`, name: "Semana 0000 - Histórico importado" });
  await invoke("save_note", { path, text: renderSemana({ ano, rotulo: "Histórico importado do Planejamento antigo", turmas }) });
  return path;
}

export async function criarSemana(items, { ano, seg, rotulo, turmas }) {
  const raiz = items[0].path.slice(0, items[0].path.length - items[0].rel.length).replace(/\/$/, "");
  const dirAno = `${raiz}/Anos/${ano}`;
  try { await invoke("create_folder", { dir: dirAno, name: "Semanas" }); } catch { /* já existe */ }
  const path = await invoke("create_note", { dir: `${dirAno}/Semanas`, name: nomeSemana(seg) });
  await invoke("save_note", { path, text: renderSemana({ ano, rotulo, turmas }) });
  return path;
}

async function editar(path, fn) {
  const text = await invoke("read_note", { path });
  await invoke("save_note", { path, text: fn(text) });
}
const reescrever = (text, fn) => { const s = parseSemanaNota(text); const nova = fn(s) ?? s; return text.replace(/^---\n[\s\S]*$/, renderSemana({ ano: /^ano:\s*(\d+)/m.exec(text)?.[1] ?? "", rotulo: s.rotulo, turmas: nova.turmas })); };

export const removerAulaSemana = (path, turma, n) => editar(path, (t) => reescrever(t, (s) => { const x = s.turmas.find((z) => z.turma === turma); x.aulas = x.aulas.filter((a) => a.n !== n); }));
export const adicionarAvulsa = (path, turma, texto, recurso = "") => editar(path, (t) => reescrever(t, (s) => {
  let x = s.turmas.find((z) => z.turma === turma);
  if (!x) s.turmas.push((x = { turma, aulas: [] }));
  x.aulas.push({ texto, recurso, dada: false, cicloNome: null, cicloN: null });
}));

/**
 * Mantém as notas de semana certas quando o ciclo muda: ao inserir uma aula na posição P, as linhas ligadas às aulas de P em diante
 * passam a apontar para N+1; ao remover a aula N, a linha ligada a ela vira avulsa e as seguintes apontam para N-1.
 */
export async function ajustarSemanasAoCiclo(items, cicloNome, { inserirEm = null, removida = null }) {
  const alvo = cicloNome.toLowerCase();
  for (const it of items.filter((i) => /^Anos\/\d{4}\/Semanas\/[^/]+\.md$/.test(i.rel))) {
    let text;
    try { text = await invoke("read_note", { path: it.path }); } catch { continue; }
    if (!/^tipo:\s*semana\s*$/m.test(text)) continue;
    let mudou = false;
    const novo = reescrever(text, (s) => {
      for (const t of s.turmas) for (const a of t.aulas) {
        if (!a.cicloNome || a.cicloNome.toLowerCase() !== alvo || a.cicloN == null) continue;
        if (inserirEm != null && a.cicloN >= inserirEm) { a.cicloN += 1; mudou = true; }
        else if (removida != null && a.cicloN === removida) { a.cicloNome = null; a.cicloN = null; mudou = true; }
        else if (removida != null && a.cicloN > removida) { a.cicloN -= 1; mudou = true; }
      }
    });
    if (mudou) await invoke("save_note", { path: it.path, text: novo });
  }
}

/** Promove uma aula avulsa a aula do fim do ciclo `ciclo` (objeto de parseCiclo) e liga a linha da semana a ela. */
export async function promoverAvulsa(path, turma, n, ciclo) {
  const text = await invoke("read_note", { path });
  const a = parseSemanaNota(text).turmas.find((t) => t.turma === turma)?.aulas.find((x) => x.n === n);
  if (!a) throw new Error("aula não encontrada");
  const cicloText = await invoke("read_note", { path: ciclo.path });
  const pos = parseCiclo({ path: ciclo.path, name: ciclo.name }, cicloText).aulas.length + 1;
  await invoke("save_note", { path: ciclo.path, text: inserirAula(cicloText, pos, a.texto) });
  await invoke("save_note", { path, text: reescrever(text, (s) => { const x = s.turmas.find((z) => z.turma === turma).aulas.find((z) => z.n === n); x.cicloNome = ciclo.name; x.cicloN = pos; }) });
}
