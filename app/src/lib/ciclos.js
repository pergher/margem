// Ciclos são atemporais: notas de Acervo/Ciclos (nome = título, 16 aulas na tabela "## Aulas"). Quem os põe num ano é o
// Planejamento do Ano (Anos/AAAA/Planejamento AAAA.md, tabela "Ano | Trimestre | Ordem | Ciclo"), sem turma.
// Ainda lê o formato antigo (Anos/AAAA/Planejamento/ATC - Título - PR.md) até o vault ser migrado (`vault ciclos`).
import { raizDe, raizBarra } from "@/lib/raiz";
import { invoke } from "@/lib/api";
import { gravarTurmas, AULAS_PADRAO } from "@/lib/turmas";

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

const LEGADO = /^Anos\/(\d{4})\/Planejamento\/\d{3}\b/;
export const ehCiclo = (rel) => /^Acervo\/Ciclos\//.test(rel) || LEGADO.test(rel);

export function parseCiclo(item, text) {
  const legado = /^(\d)(\d)(\d)(?:\s*-\s*(.*))?$/.exec(item.name);
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const secao = (nome) => new RegExp(`^##\\s+${nome}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "m").exec(body)?.[1] ?? "";
  const aulas = secao("Aulas").split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l)).map((l) => {
    const c = l.split(/(?<!\\)\|/).map((x) => x.trim().replace(/\\\|/g, "|"));
    return { n: Number(c[1]), texto: c[2] ?? "", recurso: c[3] ?? "", fase: faseDaAula(c[2] ?? "") };
  });
  const comum = {
    path: item.path, rel: item.rel, aulas,
    habilidades: [...new Set(body.match(/EF\d\dLP\d\d/g) ?? [])],
    habTexto: secao("Habilidades").split("\n").map((l) => /^\(?(EF\d\dLP\d\d)\)?\s*(.*)/.exec(l.trim())).filter(Boolean).map((m) => ({ codigo: m[1], texto: m[2] })),
    conteudos: secao("Conteúdos").split("\n").map((l) => /^\s*-\s+(.*)/.exec(l)?.[1]).filter(Boolean),
  };
  if (legado && LEGADO.test(item.rel ?? "")) {
    const rest = (legado[4] ?? "").replace(/\s*-\s*(PR|PT|TG)\s*$/, "").replace(/^(PR|PT|TG)$/, "").trim();
    return { ...comum, name: item.name, ano: Number(legado[1]), tri: Number(legado[2]), ciclo: Number(legado[3]), titulo: rest || `Ciclo ${legado[1]}${legado[2]}${legado[3]}`, vazio: !rest, sufixo: /-\s*(PR|PT|TG)\s*$/.exec(item.name)?.[1] ?? null, incluido: true, legado: true };
  }
  const sufixo = /^sufixo:\s*(PR|PT|TG)\s*$/m.exec(text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "")?.[1] ?? null;
  return { ...comum, name: item.name, ano: null, tri: null, ciclo: null, titulo: item.name, vazio: /^Ciclo \d{3}$/.test(item.name), sufixo, incluido: false, legado: false };
}

/** Linhas `| 6 | 1 | 2 | [[Ciclo]] |` do Planejamento do Ano: nome do ciclo (minúsculo) → { ano, tri, ciclo }. */
export function lerLinhasPlanejamento(text) {
  const por = {};
  for (const l of text.split("\n")) {
    const c = l.replace(/^\||\|\s*$/g, "").split(/(?<!\\)\|/).map((x) => x.trim());
    const m = /^\[\[([^\]|#]+)/.exec(c[3] ?? "");
    if (m && /^\d$/.test(c[0]) && /^\d$/.test(c[1])) por[m[1].trim().toLowerCase()] = { ano: Number(c[0]), tri: Number(c[1]), ciclo: Number(c[2]) || 1 };
  }
  return por;
}

export const planejamentoDoAno = (items, ano) => items.find((i) => i.rel === `Anos/${ano}/Planejamento ${ano}.md`) ?? null;

/** Anos letivos que existem em `Anos/AAAA/`, em ordem crescente. */
export const anosLetivos = (items) => [...new Set(items.map((i) => /^Anos\/(\d{4})\//.exec(i.rel)?.[1]).filter(Boolean))].sort();

/** Cria o ano letivo seguinte, vazio: Planejamento AAAA sem ciclos e, se vierem, as turmas do ano. Devolve o ano criado. */
export async function criarProximoAno(items, { turmas = [], aulas } = {}) {
  const anos = anosLetivos(items);
  const novo = String((anos.length ? Number(anos[anos.length - 1]) : new Date().getFullYear()) + 1);
  if (items.some((i) => i.rel.startsWith(`Anos/${novo}/`))) throw new Error(`O ano ${novo} já existe.`);
  const root = raizBarra(items);
  const path = await invoke("create_note", { dir: root + `Anos/${novo}/`, name: `Planejamento ${novo}` });
  await invoke("save_note", { path, text: modeloPlanejamento(novo) });
  if (turmas.length) await gravarTurmas(items, novo, { turmas, aulas: aulas ?? AULAS_PADRAO });
  return novo;
}

export async function lerCiclos(items, anoEscolhido = null) {
  const anoLetivo = anoEscolhido ?? anosLetivos(items).pop() ?? null;
  const plan = anoLetivo ? planejamentoDoAno(items, anoLetivo) : null;
  const linhas = plan ? lerLinhasPlanejamento(await invoke("read_note", { path: plan.path }).catch(() => "")) : {};
  const alvo = items.filter((i) => /^Acervo\/Ciclos\/.+\.md$/.test(i.rel) || (LEGADO.test(i.rel) && LEGADO.exec(i.rel)[1] === anoLetivo));
  const list = await Promise.all(alvo.map(async (i) => {
    try {
      const c = parseCiclo(i, await invoke("read_note", { path: i.path }));
      const p = c.legado ? null : linhas[c.name.toLowerCase()];
      return p ? { ...c, ...p, incluido: true } : c;
    } catch { return null; }
  }));
  const ordem = (a, b) => (b.incluido - a.incluido) || (a.ano - b.ano) || (a.tri - b.tri) || (a.ciclo - b.ciclo) || a.name.localeCompare(b.name, "pt-BR");
  return { anoLetivo, ciclos: list.filter(Boolean).sort(ordem), planejamento: plan };
}

/** Texto do Planejamento do Ano com o ciclo na linha `ano`/`tri` (ordem = última do trimestre + 1); cria a tabela se faltar. */
export function incluirNoPlanejamento(text, nomeCiclo, { ano, tri }) {
  const linhas = text.split("\n");
  const ocupadas = Object.values(lerLinhasPlanejamento(text)).filter((p) => p.ano === ano && p.tri === tri).length;
  const nova = `| ${ano} | ${tri} | ${ocupadas + 1} | [[${nomeCiclo}]] |`;
  const ult = linhas.reduce((u, l, i) => (/^\|.*\[\[.*\]\]\s*\|\s*$/.test(l) ? i : u), -1);
  if (ult >= 0) { linhas.splice(ult + 1, 0, nova); return linhas.join("\n"); }
  // Tabela ainda sem ciclos (modelo novo, ou esvaziada): a linha entra logo abaixo do separador. O Obsidian pode alinhar as colunas.
  const sep = linhas.findIndex((l, i) => /^\|[\s:|-]+$/.test(l) && /^\|\s*Ano\s*\|\s*Trimestre\s*\|\s*Ordem\s*\|\s*Ciclo\s*\|\s*$/.test(linhas[i - 1] ?? ""));
  if (sep >= 0) { linhas.splice(sep + 1, 0, nova); return linhas.join("\n"); }
  return text.replace(/\s*$/, "\n\n") + `| Ano | Trimestre | Ordem | Ciclo |\n| --- | --- | --- | --- |\n${nova}\n`;
}

/** Muda a posição de um ciclo no Planejamento: vai para o ano/trimestre `ano`/`tri`, antes de `antesDe` (nome) ou no fim. Renumera a "Ordem" dos grupos mexidos. */
export function moverNoPlanejamento(text, nomeCiclo, { ano, tri, antesDe = null }) {
  const alvo = nomeCiclo.toLowerCase();
  const celulas = (l) => l.replace(/^\||\|\s*$/g, "").split(/(?<!\\)\|/).map((x) => x.trim());
  const nomeDe = (c) => /^\[\[([^\]|#]+)/.exec(c[3] ?? "")?.[1].trim().toLowerCase();
  let linhas = text.split("\n");
  const ehLinha = (l) => { const c = celulas(l); return l.startsWith("|") && /^\d$/.test(c[0]) && /^\d$/.test(c[1]) && nomeDe(c); };
  const i0 = linhas.findIndex((l) => ehLinha(l) && nomeDe(celulas(l)) === alvo);
  if (i0 < 0) return text;
  const origem = celulas(linhas[i0]);
  const [oAno, oTri] = [Number(origem[0]), Number(origem[1])];
  const raw = linhas.splice(i0, 1)[0];
  const ult = linhas.reduce((u, l, i) => (ehLinha(l) ? i : u), i0 - 1);
  linhas.splice(ult + 1, 0, raw);
  const grupo = (a, t) => linhas.map((l, i) => ({ l, i, c: ehLinha(l) ? celulas(l) : null })).filter((x) => x.c && Number(x.c[0]) === a && Number(x.c[1]) === t);
  const ordenar = (g) => g.sort((x, y) => (Number(x.c[2]) || 1) - (Number(y.c[2]) || 1) || x.i - y.i);
  const reescrever = (g, a, t) => g.forEach((x, k) => { linhas[x.i] = `| ${a} | ${t} | ${k + 1} | ${x.c[3]} |`; });
  const destino = ordenar(grupo(ano, tri)).filter((x) => nomeDe(x.c) !== alvo);
  const x = { i: ult + 1, c: celulas(raw) };
  const pos = antesDe ? destino.findIndex((y) => nomeDe(y.c) === antesDe.toLowerCase()) : -1;
  destino.splice(pos < 0 ? destino.length : pos, 0, x);
  reescrever(destino, ano, tri);
  if (ano !== oAno || tri !== oTri) reescrever(ordenar(grupo(oAno, oTri)), oAno, oTri);
  return linhas.join("\n");
}

export function tirarDoPlanejamento(text, nomeCiclo) {
  const alvo = `[[${nomeCiclo.toLowerCase()}]]`;
  return text.split("\n").filter((l) => !(l.startsWith("|") && l.toLowerCase().includes(alvo))).join("\n");
}

export function modeloPlanejamento(ano) {
  return `---\ntipo: planejamento\nano_letivo: ${ano}\n---\nCada linha liga um ciclo (\`Acervo/Ciclos\`) a um ano escolar e a um trimestre. O ciclo em si não tem ano nem turma.\n\n| Ano | Trimestre | Ordem | Ciclo |\n| --- | --- | --- | --- |\n`;
}

/** Põe o ciclo no Planejamento do Ano (cria a nota do ano se faltar). Devolve o caminho da nota. */
export async function incluirCicloNoAno(items, ciclo, anoLetivo, pos) {
  let plan = planejamentoDoAno(items, anoLetivo);
  let path;
  if (plan) path = plan.path;
  else {
    const root = raizBarra(items);
    path = await invoke("create_note", { dir: root + `Anos/${anoLetivo}/`, name: `Planejamento ${anoLetivo}` });
    await invoke("save_note", { path, text: modeloPlanejamento(anoLetivo) });
  }
  const text = await invoke("read_note", { path });
  await invoke("save_note", { path, text: incluirNoPlanejamento(text, ciclo.name, pos) });
  return path;
}

export async function moverCicloNoAno(items, ciclo, anoLetivo, destino) {
  const plan = planejamentoDoAno(items, anoLetivo);
  if (!plan) return;
  await invoke("save_note", { path: plan.path, text: moverNoPlanejamento(await invoke("read_note", { path: plan.path }), ciclo.name, destino) });
}

export async function tirarCicloDoAno(items, ciclo, anoLetivo) {
  const plan = planejamentoDoAno(items, anoLetivo);
  if (!plan) return;
  await invoke("save_note", { path: plan.path, text: tirarDoPlanejamento(await invoke("read_note", { path: plan.path }), ciclo.name) });
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

// Move a aula `de` para a posição `para` (1-based, já na lista final); as demais deslocam e tudo é renumerado.
export function moverAula(text, de, para) {
  return editarTabela(text, (rows) => { const r = [...rows]; const [x] = r.splice(de - 1, 1); r.splice(para - 1, 0, x); return r; });
}

// Troca o conteúdo (col. 2) ou o recurso (col. 3) de uma aula, sem mexer no resto da linha.
export function editarCelula(text, n, col, valor) {
  const v = valor.replace(/\s*\n\s*/g, " ").replace(/(?<!\\)\|/g, "\\|").trim();
  return editarTabela(text, (rows) => rows.map((l, i) => {
    if (i !== n - 1) return l;
    const cel = l.split(/(?<!\\)\|/);
    while (cel.length < 5) cel.splice(cel.length - 1, 0, " ");
    cel[col] = ` ${v} `;
    return cel.join("|");
  }));
}

// Troca o corpo de uma seção "## Nome" (cria antes de "## Aulas" se faltar).
function trocarSecao(text, nome, linhas) {
  const corpo = "\n" + (linhas.length ? linhas.join("\n") + "\n" : "") + "\n";
  const re = new RegExp(`(^##\\s+${nome}\\s*$)([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "m");
  if (re.test(text)) return text.replace(re, (_, h) => h + corpo);
  const bloco = `## ${nome}${corpo}`;
  return /^##\s+Aulas\s*$/m.test(text) ? text.replace(/^##\s+Aulas\s*$/m, (m) => bloco + m) : text.replace(/\s*$/, "\n\n") + bloco;
}
export const salvarConteudos = (text, itens) => trocarSecao(text, "Conteúdos", itens.map((x) => `- ${x}`));
export const salvarHabilidades = (text, hs) => trocarSecao(text, "Habilidades", hs.map((h) => `(${h.codigo}) ${h.texto}`.trim()));

// Nome do arquivo com o título novo (no formato antigo mantém ATC e o sufixo PR/PT/TG).
export const nomeComTitulo = (c, titulo) => c.legado ? `${c.ano}${c.tri}${c.ciclo} - ${titulo.trim()}${c.sufixo ? ` - ${c.sufixo}` : ""}` : titulo.trim().replace(/[\\/:|]/g, " ").replace(/\s+/g, " ");

export function removerAula(text, n) {
  return editarTabela(text, (rows) => rows.filter((_, i) => i !== n - 1));
}

/** parseCiclo mantendo a posição no ano (que vem do Planejamento, não da nota). */
export const reparse = (velho, item, text) => { const n = parseCiclo({ path: item.path, name: item.name, rel: velho.rel }, text); return n.legado ? n : { ...n, ano: velho.ano, tri: velho.tri, ciclo: velho.ciclo, incluido: velho.incluido }; };

export async function salvarAulas(ciclo, acao) {
  const text = await invoke("read_note", { path: ciclo.path });
  await invoke("save_note", { path: ciclo.path, text: acao(text) });
  return reparse(ciclo, { path: ciclo.path, name: ciclo.name }, await invoke("read_note", { path: ciclo.path }));
}

/** Modelo de um ciclo novo: 16 aulas em branco para preencher (a tabela `## Aulas` precisa existir para editar). */
export function modeloCiclo() {
  const linhas = Array.from({ length: 16 }, (_, i) => `| ${i + 1} |  |  |`).join("\n");
  return `---\ntipo: ciclo\n---\n## Conteúdos\n\n- \n\n## Habilidades\n\n\n## Aulas\n\n| # | Conteúdo | Recurso |\n| --- | --- | --- |\n${linhas}\n`;
}

/** Cria `Acervo/Ciclos/<Título>.md` com o modelo; devolve o caminho (erro se já existir um com esse nome). */
export async function criarCicloVazio(items, titulo, pasta = "") {
  const nome = titulo.replace(/\[\[|\]\]/g, "").replace(/[\\/:*?"<>|#^]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!nome) throw new Error("O ciclo não tem título.");
  const igual = items.find((i) => i.name.toLowerCase() === nome.toLowerCase());
  if (igual) throw new Error(`Já existe uma nota chamada “${igual.name}”.`);
  const root = raizBarra(items);
  await invoke("create_folder", { dir: root + "Acervo/", name: "Ciclos" }).catch(() => {});
  const path = await invoke("create_note", { dir: root + "Acervo/Ciclos/" + (pasta ? pasta + "/" : ""), name: nome });
  await invoke("save_note", { path, text: modeloCiclo() });
  return path;
}

/** Progresso de um ciclo por turma, lido das notas de semana (✓ = aula dada; aulas descartadas saem do total). Só entram turmas ligadas ao ciclo. */
export function progressoDoCiclo(c, semanas) {
  const nome = c.name.toLowerCase(), por = {}, fora = {};
  for (const sm of semanas ?? []) for (const t of sm.turmas) {
    if (t.cicloNome?.toLowerCase() === nome) por[t.turma] ??= { dadas: new Set(), total: c.aulas.length };
    for (const a of t.aulas) if (a.cicloNome?.toLowerCase() === nome && a.cicloN) {
      const x = (por[t.turma] ??= { dadas: new Set(), total: c.aulas.length });
      if (a.dada) x.dadas.add(a.cicloN);
      if (a.situacao === "descartada") (fora[t.turma] ??= new Set()).add(a.cicloN);
    }
  }
  return Object.entries(por).map(([turma, x]) => ({ turma, dadas: x.dadas.size, total: Math.max(x.total, c.aulas.length) - (fora[turma]?.size ?? 0) }));
}
