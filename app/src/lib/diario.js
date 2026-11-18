// Diário de aula e notas de aluno (dados sensíveis; o MCP não lê estas pastas).
//   Anos/AAAA/Diarios/<turma>/Diario <turma> - <rótulo da semana>.md   (tipo: diario)
//   Anos/AAAA/Alunos/<turma>/<Nome>.md                                 (tipo: aluno)
// No diário, cada aula é uma seção "## Aula N — texto"; ocorrência de aluno = linha "- [[Nome]] — texto".
// As notas de aluno não guardam cópia: o app junta as ocorrências lendo os diários.
import { raizDe, raizBarra } from "@/lib/raiz";
import { invoke } from "@/lib/api";
import { setProp } from "@/lib/frontmatter";
import { serieDeTurma } from "@/lib/utils";

export const ESTADOS = [
  { id: "pendente", nome: "Pendente" },
  { id: "aguardando-revisao", nome: "Aguardando revisão" },
  { id: "aprovada", nome: "Aprovada" },
];

const raiz = (items) => raizDe(items);
const pasta = (items, ano, tipo, turma) => `${raiz(items)}/Anos/${ano}/${tipo}/${turma}`;
const prop = (text, k) => new RegExp(`^${k}:[ \\t]*["']?(.*?)["']?[ \\t]*$`, "m").exec(text.split(/\n---/)[0])?.[1] ?? "";
/**
 * Identificação do aluno: duas primeiras letras do primeiro nome + duas do último sobrenome ("Paulo Pergher" → "PaPe").
 * Quem já tem uma palavra só (por exemplo "PaPe") fica como está, então aplicar de novo não muda nada.
 */
export const abreviar = (nome) => {
  const p = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (p.length < 2) return p[0] ?? "";
  const dois = (x) => x.charAt(0).toLocaleUpperCase("pt-BR") + x.slice(1, 2).toLocaleLowerCase("pt-BR");
  return dois(p[0]) + dois(p[p.length - 1]);
};
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
  const fm = `---\ntipo: diario\n${serieDeTurma(turma) ? `ano: ${serieDeTurma(turma)}\n` : ""}turma: "${turma}"\nsemana: ${semana}\ntranscricao: ${foto ? "pendente" : "aprovada"}\n${foto ? `foto: ${foto}\n` : ""}---\n`;
  const corpo = aulas.map((a, i) => `## Aula ${i + 1} — ${a}\n\nDado: \n`).join("\n");
  await invoke("save_note", { path, text: `${fm}# Diário ${turma} — ${semana}\n\n${corpo}` });
  return path;
}

export async function criarAluno(items, { ano, turma, nome }) {
  const dirTipo = `${raiz(items)}/Anos/${ano}`;
  for (const [dir, n] of [[dirTipo, "Alunos"], [`${dirTipo}/Alunos`, turma]]) { try { await invoke("create_folder", { dir, name: n }); } catch { /* já existe */ } }
  const path = await invoke("create_note", { dir: pasta(items, ano, "Alunos", turma), name: nome });
  await invoke("save_note", { path, text: `---\ntipo: aluno\n${serieDeTurma(turma) ? `ano: ${serieDeTurma(turma)}\n` : ""}turma: "${turma}"\n---\n# ${nome}\n\nAs ocorrências vêm dos diários (aba Alunos do app). Observações livres abaixo.\n` });
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

// ---------- comportamentos e registros (página Diário) ----------
// Na linha da ocorrência o professor pode etiquetar: "- [[Nome]] — #conversa #celular texto livre".
// Sem etiqueta, o app sugere pelo texto (marcado como "sugerido"); a etiqueta no arquivo sempre vale mais.
export const COMPORTAMENTOS = [
  { id: "conversa", nome: "Conversa em sala", tag: "conversa", ponto: "bg-warn", re: /conversa|conversou|conversando|papo|barulh|bagunç|bagunc/i },
  { id: "produtividade", nome: "Falta de produtividade", tag: "produtividade", ponto: "bg-warn", re: /n[ãa]o fez|sem material|sem produzir|n[ãa]o produz|n[ãa]o copiou|n[ãa]o realiz|n[ãa]o entreg|improdutiv|sem caderno|n[ãa]o trouxe|esqueceu o (?:caderno|material)/i },
  { id: "espelho", nome: "Fora do espelho de classe", tag: "espelho", ponto: "bg-warn", re: /espelho|lugar errado|trocou de lugar|fora do lugar/i },
  { id: "andando", nome: "Andando pela sala", tag: "andando", ponto: "bg-warn", re: /andando|andou|levant|circul|saiu da sala|sem pedir|fora da carteira/i },
  { id: "briga", nome: "Briga", tag: "briga", ponto: "bg-err", re: /brig[aou]|agred|empurr|xing|soco|tapa|discutiu|discuss[ãa]o (?:acalorada|com)|bateu/i },
  { id: "celular", nome: "Uso de celular", tag: "celular", ponto: "bg-warn", re: /celular|telefone|fone de ouvido/i },
];
export const POSITIVO = { id: "positivo", nome: "Positivo", tag: "positivo", ponto: "bg-ok", re: /particip|elogi|ajudou|caprich|excelente|criativ|bem organizad|com aten[çc][ãa]o|liderou|completa/i };
export const OUTRO = { id: "outro", nome: "Sem categoria", ponto: "bg-muted-foreground/50" };
export const CATEGORIAS = [...COMPORTAMENTOS, POSITIVO];

/** Separa as etiquetas (#conversa…) do texto e devolve { texto, cats: [{ id, sugerida }] }. */
export function comportamentosDe(bruto) {
  const tags = [...bruto.matchAll(/(?:^|\s)#([\p{L}-]+)/gu)].map((m) => m[1].toLowerCase());
  const texto = bruto.replace(/(?:^|\s)#[\p{L}-]+/gu, " ").replace(/\s+/g, " ").trim();
  const dadas = CATEGORIAS.filter((c) => tags.includes(c.tag)).map((c) => ({ id: c.id, sugerida: false }));
  if (dadas.length) return { texto, cats: dadas };
  // "ausente" e "atrasou" não são os comportamentos acompanhados: ficam sem categoria.
  const achadas = CATEGORIAS.filter((c) => c.re.test(texto)).map((c) => ({ id: c.id, sugerida: true }));
  return { texto, cats: achadas.some((c) => c.id !== "positivo") ? achadas.filter((c) => c.id !== "positivo") : achadas };
}
export const insereTags = (ids, texto) => `${ids.map((i) => `#${CATEGORIAS.find((c) => c.id === i).tag}`).join(" ")}${ids.length ? " " : ""}${texto}`.trim();

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Primeiro dia da semana como Date: aceita "2026-09-21" e "9 a 13 de Novembro" (ano vem da pasta). `null` se não der. */
export function dataDaSemana(semana, ano) {
  const s = String(semana ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})(?:\s+de\s+([A-Za-zçÇ]+))?\s+a\s+(\d{1,2})\s+de\s+([A-Za-zçÇ]+)/i.exec(s);
  if (!m) return null;
  const fim = MESES.findIndex((x) => semAcento(x) === semAcento(m[4])), ini = m[2] ? MESES.findIndex((x) => semAcento(x) === semAcento(m[2])) : fim;
  return fim < 0 || ini < 0 ? null : new Date(+ano, ini, +m[1]);
}
export const mesDe = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "");
export const nomeDoMes = (ym) => { const [a, m] = ym.split("-"); return `${MESES[+m - 1]} de ${a}`; };

/**
 * Registros de um diário, prontos para a lista: uma "aula" por seção e uma "ocorrencia" por linha de aluno.
 * `quando` ordena (data da semana + número da aula); `cats` só existe nas ocorrências.
 */
export function registrosDoDiario(text, d) {
  const meta = lerMeta(text), data = dataDaSemana(meta.semana, d.ano), linhas = text.split("\n");
  const base = { diario: d.path, turma: d.turma, ano: d.ano, semana: meta.semana, data, mes: mesDe(data), transcricao: meta.transcricao };
  const aulas = aulasDoDiario(text), regs = [];
  aulas.forEach((a, k) => {
    const [rot, tema = ""] = a.titulo.split(/\s+—\s+/), n = Number(/\d+/.exec(rot)?.[0] ?? k + 1);
    const corpo = linhas.slice(a.ini + 1, a.fim).filter((l) => l.trim() && !/^\s*-\s+\[\[/.test(l) && !/^\s*<!--.*-->\s*$/.test(l)).map((l) => l.replace(/^Dado:\s*/, "").trim()).filter(Boolean).join(" ");
    regs.push({ ...base, id: `${d.path}#a${n}`, tipo: "aula", n, aula: rot, tema, texto: corpo, ord: (data?.getTime() ?? 0) + n });
  });
  for (const o of ocorrenciasDoDiario(text)) {
    const n = Number(/Aula\s+(\d+)/i.exec(o.aula)?.[1] ?? 0), { texto, cats } = comportamentosDe(o.texto);
    regs.push({ ...base, id: `${d.path}#l${o.linha}`, tipo: "ocorrencia", n, aula: o.aula.replace(/\s+—.*/, ""), tema: o.aula.split(/\s+—\s+/)[1] ?? "", aluno: o.aluno, texto, cats, linha: o.linha, ord: (data?.getTime() ?? 0) + n + 0.5 });
  }
  return regs;
}

// ---------- ações com o aluno (nota do aluno, seção "## Ações") ----------
// Uma linha por ação: "- 2026-11-18 14h — #agendar #conversa #planejada texto livre".
// Tipo (#conversar, #diretoria, #agendar, #notificar), comportamento (as mesmas etiquetas do diário) e estado (#planejada | #feita).
export const TIPOS_ACAO = [
  { id: "conversar", nome: "Conversar", longo: "Conversar com o aluno" },
  { id: "diretoria", nome: "Encaminhar", longo: "Encaminhar à direção" },
  { id: "agendar", nome: "Agendar", longo: "Agendar com os responsáveis" },
  { id: "notificar", nome: "Notificar", longo: "Notificar os responsáveis" },
  { id: "informar", nome: "Informar à direção", longo: "Informar à direção" },
];
export const tipoAcao = (id) => TIPOS_ACAO.find((t) => t.id === id);
export const NEGATIVOS = COMPORTAMENTOS.map((c) => c.id);
// Agendar tem um ciclo próprio (solicitada → agendada → realizada); as demais ações são registradas já feitas.
export const ESTADOS_AGENDA = [
  { id: "solicitada", nome: "Solicitada" },
  { id: "agendada", nome: "Agendada" },
  { id: "realizada", nome: "Realizada" },
];
export const nomeEstado = (id) => ESTADOS_AGENDA.find((e) => e.id === id)?.nome ?? (id === "planejada" ? "Planejada" : "Feita");
/** Ainda por acontecer (solicitada, agendada, ou o antigo "planejada"). */
export const pendente = (a) => ["solicitada", "agendada", "planejada"].includes(a.estado);
const ESTADO_RE = /#(?:solicitada|agendada|realizada|planejada|feita)\b/;
const TITULO_ACOES = /^##\s+A[çc][õo]es\s*$/i;

// Linhas antigas usavam #planejada/#feita; em "agendar" valem como agendada/realizada.
function estadoDe(tipo, tags) {
  const e = ["solicitada", "agendada", "realizada", "planejada", "feita"].find((x) => tags.includes(x));
  if (tipo === "agendar") return e === "solicitada" || e === "agendada" || e === "realizada" ? e : e === "planejada" ? "agendada" : "realizada";
  return e === "planejada" ? "planejada" : "feita";
}

/** Ações da nota do aluno: [{ linha, data: "AAAA-MM-DD", hora, tipo, cat, estado, texto }]. */
export function acoesDoAluno(text) {
  const linhas = text.split("\n"), out = [];
  let dentro = false;
  linhas.forEach((l, i) => {
    if (/^##\s/.test(l)) { dentro = TITULO_ACOES.test(l); return; }
    if (!dentro) return;
    const m = /^\s*-\s+(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}h(?:\d{2})?))?\s*(?:[—–-]\s*)?(.*)$/.exec(l);
    if (!m) return;
    const tags = [...m[3].matchAll(/(?:^|\s)#([\p{L}-]+)/gu)].map((x) => x[1].toLowerCase());
    const tipo = TIPOS_ACAO.find((t) => tags.includes(t.id))?.id;
    if (!tipo) return;
    out.push({
      linha: i, data: m[1], hora: m[2] ?? "", tipo,
      cat: CATEGORIAS.find((c) => tags.includes(c.tag))?.id ?? "",
      estado: estadoDe(tipo, tags),
      texto: m[3].replace(/(?:^|\s)#[\p{L}-]+/gu, " ").replace(/\s+/g, " ").trim(),
    });
  });
  return out;
}

/** Acrescenta a ação ao fim da seção "## Ações" (criando a seção, se não existir). */
export function inserirAcao(text, { data, hora, tipo, cat, estado = tipo === "agendar" ? "solicitada" : "feita", texto }) {
  const linha = `- ${data}${hora ? ` ${hora}` : ""} — #${tipo}${cat ? ` #${CATEGORIAS.find((c) => c.id === cat)?.tag ?? cat}` : ""} #${estado} ${String(texto ?? "").replace(/\n/g, " ")}`.trimEnd();
  const linhas = text.split("\n"), ini = linhas.findIndex((l) => TITULO_ACOES.test(l));
  if (ini < 0) return `${text.replace(/\s+$/, "")}\n\n## Ações\n\n${linha}\n`;
  let fim = linhas.findIndex((l, i) => i > ini && /^##\s/.test(l));
  if (fim < 0) fim = linhas.length;
  while (fim > ini + 1 && linhas[fim - 1].trim() === "") fim--;
  linhas.splice(fim, 0, linha);
  return linhas.join("\n");
}

/** Troca #planejada por #feita na linha indicada. */
export function marcarFeita(text, linha) {
  const linhas = text.split("\n");
  if (linhas[linha] != null) linhas[linha] = linhas[linha].replace(/#planejada\b/, "#feita");
  return linhas.join("\n");
}

/** Muda o estado (e, se vierem, a data e a hora) da ação na linha indicada. */
export function atualizarAcao(text, linha, { estado, data, hora }) {
  const linhas = text.split("\n"), m = /^(\s*-\s+)(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}h(?:\d{2})?))?(.*)$/.exec(linhas[linha] ?? "");
  if (!m) return text;
  let resto = m[4];
  if (estado) resto = ESTADO_RE.test(resto) ? resto.replace(ESTADO_RE, `#${estado}`) : `${resto} #${estado}`;
  const h = hora === undefined ? m[3] : hora; // "" apaga a hora; sem `hora`, mantém
  linhas[linha] = `${m[1]}${data ?? m[2]}${h ? ` ${h}` : ""}${resto}`;
  return linhas.join("\n");
}

/** Solicitações e agendamentos de reunião ainda em aberto, em todas as notas de aluno (para a página Hoje). */
export async function reunioesEmAberto(items) {
  const out = [];
  for (const f of listarAlunos(items)) {
    let text; try { text = await invoke("read_note", { path: f.path }); } catch { continue; }
    for (const a of acoesDoAluno(text)) if (a.tipo === "agendar" && (a.estado === "solicitada" || a.estado === "agendada")) out.push({ ...a, aluno: f.name, turma: f.turma, path: f.path });
  }
  // Agendadas primeiro, da mais próxima à mais distante; depois as solicitações, da mais antiga.
  return out.sort((a, b) => (a.estado === b.estado ? a.data.localeCompare(b.data) : a.estado === "agendada" ? -1 : 1));
}

// Semanas contadas desde 1970 (segunda a domingo), para comparar ocorrências e ações.
const MS_SEMANA = 7 * 864e5;
const segunda = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const indiceSemana = (d) => Math.round(segunda(d).getTime() / MS_SEMANA);
export const dataIso = (s) => { const [a, m, d] = s.split("-").map(Number); return new Date(a, m - 1, d); };
const conta = (ocs, cat, de, ate) => ocs.filter((o) => o.cats.some((c) => c.id === cat) && o.data && indiceSemana(o.data) >= de && indiceSemana(o.data) <= ate).length;

/** Ocorrências nas 2 semanas até a ação x nas 2 seguintes (até hoje). `null` se não é "feita" ou ainda não há semana depois. */
export function efeitoDaAcao(a, ocs, hoje = new Date()) {
  if (pendente(a) || a.estado === "solicitada" || !a.cat) return null;
  const w = indiceSemana(dataIso(a.data)), atual = indiceSemana(hoje), fim = Math.min(w + 2, atual);
  if (w + 1 > atual) return null;
  const antes = conta(ocs, a.cat, w - 1, w), depois = conta(ocs, a.cat, w + 1, fim);
  return { antes, depois, semanas: fim - w, tendencia: depois < antes ? "diminuiu" : depois > antes ? "aumentou" : "igual" };
}

/** Sinais: comportamento negativo com `limite` ou mais ocorrências nas últimas 4 semanas, com o que já foi feito a respeito. */
export function sinaisDoAluno(ocs, acoes, hoje = new Date(), limite = 3) {
  const atual = indiceSemana(hoje), out = [];
  for (const c of NEGATIVOS) {
    const n = conta(ocs, c, atual - 3, atual);
    if (n < limite) continue;
    const doCat = acoes.filter((a) => a.cat === c);
    const feitas = doCat.filter((a) => !pendente(a)).map((a) => ({ ...a, efeito: efeitoDaAcao(a, ocs, hoje) })).filter((a) => a.efeito);
    out.push({ cat: c, n, planejada: doCat.find(pendente) ?? null, semMelhora: feitas.length > 0 && feitas.every((a) => a.efeito.depois >= a.efeito.antes), feitas: feitas.length });
  }
  return out;
}

/**
 * Alunos em alerta, de todas as turmas: comportamento negativo com sinal (ver `sinaisDoAluno`) e sem ação planejada.
 * `motivo`: "sem-acao" (nada feito a respeito) ou "sem-melhora" (houve ação, mas as ocorrências não diminuíram).
 * Devolve [{ aluno, turma, ano, path (ficha, ou null), sinais: [{ cat, n, motivo }] }], os mais graves primeiro.
 */
export async function alunosEmAlerta(items, hoje = new Date()) {
  const ocs = [];
  for (const d of listarDiarios(items)) {
    try { ocs.push(...registrosDoDiario(await invoke("read_note", { path: d.path }), d).filter((r) => r.tipo === "ocorrencia" && r.aluno)); } catch { /* diário ilegível */ }
  }
  const fichas = listarAlunos(items), chaves = new Map();
  for (const o of ocs) chaves.set(`${o.turma}|${o.aluno}`, { aluno: o.aluno, turma: o.turma, ano: o.ano });
  const out = [];
  for (const [k, { aluno, turma, ano }] of chaves) {
    const ficha = fichas.find((f) => f.turma === turma && f.ano === ano && f.name === aluno) ?? null;
    let acoes = [];
    if (ficha) { try { acoes = acoesDoAluno(await invoke("read_note", { path: ficha.path })); } catch { /* sem ações lidas */ } }
    const sinais = sinaisDoAluno(ocs.filter((o) => `${o.turma}|${o.aluno}` === k), acoes, hoje)
      .filter((x) => !x.planejada)
      .map((x) => ({ cat: x.cat, n: x.n, motivo: x.feitas > 0 ? (x.semMelhora ? "sem-melhora" : null) : "sem-acao" }))
      .filter((x) => x.motivo);
    if (sinais.length) out.push({ aluno, turma, ano, path: ficha?.path ?? null, sinais });
  }
  const peso = (a) => a.sinais.reduce((s, x) => s + x.n, 0);
  return out.sort((a, b) => peso(b) - peso(a) || a.aluno.localeCompare(b.aluno, "pt-BR"));
}

/** Diários ainda não aprovados: { pendente, revisao } (transcrição por fazer / aguardando revisão). */
export async function diariosParaRever(items) {
  const r = { pendente: 0, revisao: 0 };
  for (const d of listarDiarios(items)) {
    try {
      const t = lerMeta(await invoke("read_note", { path: d.path })).transcricao;
      if (t === "pendente") r.pendente++; else if (t === "aguardando-revisao") r.revisao++;
    } catch { /* diário ilegível */ }
  }
  return r;
}

/** As últimas `n` semanas (a atual por último): [{ ini: Date, por: [{ cat, n }] }]. */
export function serieSemanal(ocs, hoje = new Date(), n = 6) {
  const atual = indiceSemana(hoje);
  return Array.from({ length: n }, (_, k) => {
    const w = atual - (n - 1 - k);
    const ini = segunda(hoje); ini.setDate(ini.getDate() - 7 * (n - 1 - k));
    return { w, ini, por: CATEGORIAS.map((c) => ({ cat: c.id, n: ocs.filter((o) => o.data && indiceSemana(o.data) === w && o.cats.some((x) => x.id === c.id)).length })).filter((x) => x.n) };
  });
}

// ---------- períodos da ficha do aluno: semanas, meses e ano ----------
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const PERIODOS = [
  { id: "semanas", nome: "Semanas", titulo: "Semana a semana" },
  { id: "ano", nome: "Ano", titulo: "Mês a mês no ano" },
];

/**
 * Janela de tempo e seus intervalos: [{ rotulo, ini, fim }] com `fim` exclusivo; `atual` = índice do intervalo de hoje.
 * semanas: as 6 últimas; ano: os 12 meses do ano de hoje. `rotulo` descreve a janela.
 */
export function periodoDe(tipo, hoje = new Date()) {
  let buckets, rotulo;
  // O rótulo mostra segunda a sexta ("2–6/11"): as ocorrências só guardam a semana, não o dia.
  const semana = (ini) => {
    const fim = new Date(ini), sex = new Date(ini); fim.setDate(fim.getDate() + 7); sex.setDate(sex.getDate() + 4);
    return { rotulo: sex.getMonth() === ini.getMonth() ? `${ini.getDate()}–${sex.getDate()}/${ini.getMonth() + 1}` : `${ini.getDate()}/${ini.getMonth() + 1}–${sex.getDate()}/${sex.getMonth() + 1}`, ini, fim };
  };
  if (tipo === "semanas") {
    buckets = Array.from({ length: 6 }, (_, k) => { const ini = segunda(hoje); ini.setDate(ini.getDate() - 7 * (5 - k)); return semana(ini); });
    rotulo = "Últimas 6 semanas";
  } else {
    buckets = Array.from({ length: 12 }, (_, k) => ({ rotulo: MES_CURTO[k], ini: new Date(hoje.getFullYear(), k, 1), fim: new Date(hoje.getFullYear(), k + 1, 1) }));
    rotulo = `Ano de ${hoje.getFullYear()}`;
  }
  return { tipo, rotulo, buckets, ini: buckets[0].ini, fim: buckets[buckets.length - 1].fim, atual: buckets.findIndex((b) => hoje >= b.ini && hoje < b.fim) };
}
export const naJanela = (o, p) => !!o.data && o.data >= p.ini && o.data < p.fim;
/** Contagem de cada comportamento por intervalo do período. */
export const serieDoPeriodo = (ocs, p) => p.buckets.map((b) => ({ ...b, por: CATEGORIAS.map((c) => ({ cat: c.id, n: ocs.filter((o) => o.data && o.data >= b.ini && o.data < b.fim && o.cats.some((x) => x.id === c.id)).length })).filter((x) => x.n) }));
