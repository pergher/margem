// Jogos a partir de uma aula: caça-palavras, cruzadinha e cartas (jogo da memória). Tudo local: a lista `palavra: dica`
// é do professor (o app só sugere candidatas tiradas da aula); as grades são geradas aqui, com semente para repetir o resultado.
import { raizDe } from "@/lib/raiz";

export const TIPOS_JOGO = [
  { id: "caca-palavras", nome: "Caça-palavras", precisaDica: false },
  { id: "cruzadinha", nome: "Cruzadinha", precisaDica: true },
  { id: "cartas", nome: "Cartas (jogo da memória)", precisaDica: true },
];

/** Maiúsculas, sem acento e só letras A–Z: a forma que entra na grade. */
export const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ç/gi, "c").toUpperCase().replace(/[^A-Z]/g, "");

function aleatorio(semente) { // mulberry32
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- lista de palavras ----------

/** Linhas `palavra: dica` (também `- palavra: dica`, `palavra — dica`). Sem dica, a dica fica vazia. Repetidas e com menos de 3 letras saem. */
export function lerLista(texto) {
  const vistas = new Set(), out = [];
  for (const bruta of String(texto ?? "").split("\n")) {
    const l = bruta.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").replace(/\s*:\s*$/, "").trim(); // "palavra:" sem dica vale como "palavra"
    if (!l) continue;
    const m = /^(.*?)\s*(?::| — | - )\s*(.+)$/.exec(l);
    const original = (m ? m[1] : l).trim(), dica = (m ? m[2] : "").trim(), palavra = normalizar(original);
    if (palavra.length < 3 || vistas.has(palavra)) continue;
    vistas.add(palavra);
    out.push({ original, palavra, dica });
  }
  return out;
}

const PARADAS = new Set(("porque quando assim também tambem exemplo exemplos palavra palavras texto textos sobre entre ainda onde muito outra outro outras outros "
  + "dessa desse nesse nessa essas esses aquele aquela seguinte seguintes pode podem deve devem serve forma formas mesmo mesma depois antes durante "
  + "sempre cada qualquer todas todos toda todo apenas somente aula aulas atividade atividades conteúdo conteudo objetivo objetivos habilidade habilidades "
  + "leia leiam responda respondam classifique identifique observe complete escreva explique regra geral nesta neste desta deste estão estao havia "
  + "quais qual como pelo pela pelos pelas numa num nossa nosso então entao porém porem contudo portanto").split(" "));

/** Palavras candidatas tiradas do texto de uma aula: primeiro os termos em **negrito**, depois as mais repetidas (5+ letras). */
export function palavrasDaAula(texto, max = 15) {
  const corpo = String(texto ?? "").replace(/^---[\s\S]*?\n---/, "").replace(/```[\s\S]*?```/g, " ").replace(/!?\[\[([^\]|]*\|)?([^\]]+)\]\]/g, "$2")
    .replace(/\^q\d+/g, " ").replace(/^#{1,6}\s.*$/gm, (h) => h.replace(/^#+\s*/, ""));
  const vistas = new Set(), out = [];
  const pegar = (p) => { const n = normalizar(p); if (n.length < 4 || n.length > 14 || vistas.has(n)) return; vistas.add(n); out.push(p.toLowerCase()); };
  for (const m of corpo.matchAll(/\*\*([^*\n]+)\*\*/g)) { const ps = m[1].trim().split(/\s+/); if (ps.length === 1 && !PARADAS.has(ps[0].toLowerCase().replace(/[^\p{L}]/gu, ""))) pegar(ps[0].replace(/[^\p{L}-]/gu, "")); }
  const freq = new Map();
  for (const p of corpo.toLowerCase().match(/\p{L}{5,}/gu) ?? []) if (!PARADAS.has(p)) freq.set(p, (freq.get(p) ?? 0) + 1);
  [...freq].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).forEach(([p]) => pegar(p));
  return out.slice(0, max);
}

/** Pedido para o Claude sugerir dicas curtas (o app não escreve as dicas sozinho: o professor cola de volta). */
export const pedidoDeDicas = (titulo, palavras) =>
  `Escreva uma dica curta (no máximo 12 palavras, adequada ao ensino fundamental) para cada palavra abaixo, para uma cruzadinha da aula "${titulo}". `
  + "Não use a própria palavra na dica. Responda só com linhas no formato `palavra: dica`, na mesma ordem.\n\n" + palavras.join("\n");

// ---------- caça-palavras ----------

const DIRECOES = {
  facil: [[0, 1], [1, 0]],
  medio: [[0, 1], [1, 0], [1, 1]],
  dificil: [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1], [-1, 1]],
};
const ALFABETO = "AAAAAEEEEEIIIOOOUUSSSRRNNMMTTCCDDLLPPBFGHQVXJZ";

/** Caça-palavras. `dificuldade`: facil (→ ↓), medio (+ diagonal), dificil (todas as direções). Devolve a grade e onde cada palavra ficou. */
export function cacaPalavras(entradas, { tamanho = 0, dificuldade = "medio", semente = 1 } = {}) {
  const lista = [...new Map(entradas.map((e) => [e.palavra, e])).values()].filter((e) => e.palavra.length >= 3).sort((a, b) => b.palavra.length - a.palavra.length);
  const letras = lista.reduce((n, e) => n + e.palavra.length, 0), maior = lista[0]?.palavra.length ?? 0;
  const n = tamanho || Math.min(22, Math.max(10, maior + 2, Math.ceil(Math.sqrt(letras * 2.4))));
  const dirs = DIRECOES[dificuldade] ?? DIRECOES.medio;
  let melhor = null;
  for (let tentativa = 0; tentativa < 25; tentativa++) {
    const rnd = aleatorio(semente * 1000 + tentativa);
    const g = Array.from({ length: n }, () => Array(n).fill(""));
    const colocadas = [], falta = [];
    for (const e of lista) {
      let ok = false;
      for (let k = 0; k < 300 && !ok; k++) {
        const [dr, dc] = dirs[Math.floor(rnd() * dirs.length)];
        const r0 = Math.floor(rnd() * n), c0 = Math.floor(rnd() * n);
        const r1 = r0 + dr * (e.palavra.length - 1), c1 = c0 + dc * (e.palavra.length - 1);
        if (r1 < 0 || r1 >= n || c1 < 0 || c1 >= n) continue;
        let cabe = true;
        for (let i = 0; i < e.palavra.length && cabe; i++) { const x = g[r0 + dr * i][c0 + dc * i]; if (x && x !== e.palavra[i]) cabe = false; }
        if (!cabe) continue;
        for (let i = 0; i < e.palavra.length; i++) g[r0 + dr * i][c0 + dc * i] = e.palavra[i];
        colocadas.push({ ...e, r: r0, c: c0, dr, dc }); ok = true;
      }
      if (!ok) falta.push(e.original);
    }
    if (!melhor || colocadas.length > melhor.colocadas.length) melhor = { g, colocadas, falta, rnd };
    if (!falta.length) break;
  }
  const { g, colocadas, falta, rnd } = melhor ?? { g: Array.from({ length: n }, () => Array(n).fill("")), colocadas: [], falta: [], rnd: aleatorio(semente) };
  const grade = g.map((l) => l.map((x) => x || ALFABETO[Math.floor(rnd() * ALFABETO.length)]));
  return { tamanho: n, grade, colocadas, naoCouberam: falta };
}

// ---------- cruzadinha ----------

/** Cruzadinha: posiciona as palavras cruzando-se (mais cruzamentos primeiro) e numera as casas. Palavras sem cruzamento possível ficam em `naoCouberam`. */
export function cruzadinha(entradas, { semente = 1 } = {}) {
  const lista = [...new Map(entradas.map((e) => [e.palavra, e])).values()].filter((e) => e.palavra.length >= 3).sort((a, b) => b.palavra.length - a.palavra.length);
  const N = 60, meio = 30;
  let melhor = null;
  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const rnd = aleatorio(semente * 1000 + tentativa);
    const g = Array.from({ length: N }, () => Array(N).fill("")), dg = Array.from({ length: N }, () => Array(N).fill(0)); // dg: 1 = horizontal, 2 = vertical, 3 = ambos
    const pos = [];
    const livre = (r, c) => r < 0 || c < 0 || r >= N || c >= N || !g[r][c];
    const testar = (p, r, c, h) => {
      const dr = h ? 0 : 1, dc = h ? 1 : 0, bit = h ? 1 : 2, len = p.length;
      if (r < 0 || c < 0 || r + dr * (len - 1) >= N || c + dc * (len - 1) >= N) return -1;
      if (!livre(r - dr, c - dc) || !livre(r + dr * len, c + dc * len)) return -1;
      let cruz = 0;
      for (let i = 0; i < len; i++) {
        const rr = r + dr * i, cc = c + dc * i;
        if (g[rr][cc]) { if (g[rr][cc] !== p[i] || (dg[rr][cc] & bit)) return -1; cruz++; }
        else if (!livre(rr + dc, cc + dr) || !livre(rr - dc, cc - dr)) return -1;
      }
      return cruz;
    };
    const por = (e, r, c, h) => { const dr = h ? 0 : 1, dc = h ? 1 : 0; for (let i = 0; i < e.palavra.length; i++) { g[r + dr * i][c + dc * i] = e.palavra[i]; dg[r + dr * i][c + dc * i] |= h ? 1 : 2; } pos.push({ ...e, r, c, h }); };
    const resto = [];
    lista.forEach((e, k) => { if (k === 0) por(e, meio, meio - Math.floor(e.palavra.length / 2), true); else resto.push(e); });
    let pendentes = resto;
    for (let passo = 0; passo < 3 && pendentes.length; passo++) {
      const sobra = [];
      for (const e of pendentes) {
        let melhorPos = null;
        for (const q of pos) for (let i = 0; i < q.palavra.length; i++) for (let j = 0; j < e.palavra.length; j++) {
          if (q.palavra[i] !== e.palavra[j]) continue;
          const h = !q.h, qr = q.h ? q.r : q.r + i, qc = q.h ? q.c + i : q.c; // a casa de q onde as duas se cruzam
          const R = h ? qr : qr - j, C = h ? qc - j : qc;
          const cruz = testar(e.palavra, R, C, h);
          if (cruz >= 1 && (!melhorPos || cruz > melhorPos.cruz || (cruz === melhorPos.cruz && rnd() < 0.3))) melhorPos = { R, C, h, cruz };
        }
        if (melhorPos) por(e, melhorPos.R, melhorPos.C, melhorPos.h); else sobra.push(e);
      }
      pendentes = sobra;
    }
    const r = { g, pos, falta: pendentes.map((e) => e.original) };
    if (!melhor || pos.length > melhor.pos.length) melhor = r;
    if (!r.falta.length) break;
  }
  const { g, pos, falta } = melhor ?? { g: [], pos: [], falta: [] };
  if (!pos.length) return { linhas: 0, colunas: 0, grade: [], numeros: [], horizontais: [], verticais: [], naoCouberam: falta };
  const rs = pos.map((p) => p.r), cs = pos.map((p) => p.c);
  const r0 = Math.min(...rs), c0 = Math.min(...cs);
  const r1 = Math.max(...pos.map((p) => p.r + (p.h ? 0 : p.palavra.length - 1))), c1 = Math.max(...pos.map((p) => p.c + (p.h ? p.palavra.length - 1 : 0)));
  const linhas = r1 - r0 + 1, colunas = c1 - c0 + 1;
  const grade = Array.from({ length: linhas }, (_, i) => Array.from({ length: colunas }, (_, j) => g[r0 + i][c0 + j] || ""));
  const numeros = Array.from({ length: linhas }, () => Array(colunas).fill(0));
  const horizontais = [], verticais = [];
  let n = 0;
  for (let i = 0; i < linhas; i++) for (let j = 0; j < colunas; j++) {
    if (!grade[i][j]) continue;
    const h = pos.find((p) => p.h && p.r - r0 === i && p.c - c0 === j), v = pos.find((p) => !p.h && p.r - r0 === i && p.c - c0 === j);
    if (!h && !v) continue;
    n++; numeros[i][j] = n;
    if (h) horizontais.push({ n, palavra: h.palavra, original: h.original, dica: h.dica, tamanho: h.palavra.length });
    if (v) verticais.push({ n, palavra: v.palavra, original: v.original, dica: v.dica, tamanho: v.palavra.length });
  }
  return { linhas, colunas, grade, numeros, horizontais, verticais, naoCouberam: falta };
}

// ---------- cartas ----------

/** Jogo da memória: um cartão com a palavra e outro com a dica, embaralhados. */
export function cartas(entradas, { semente = 1 } = {}) {
  const rnd = aleatorio(semente);
  const todas = entradas.filter((e) => e.dica).flatMap((e) => [{ tipo: "palavra", texto: e.original, par: e.palavra }, { tipo: "dica", texto: e.dica, par: e.palavra }]);
  for (let i = todas.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [todas[i], todas[j]] = [todas[j], todas[i]]; }
  return { cartas: todas, semDica: entradas.filter((e) => !e.dica).map((e) => e.original) };
}

// ---------- impressão ----------

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const CSS = `@page{size:A4;margin:14mm}body{font:11pt Georgia,serif;color:#000}h1{font-size:15pt;margin:0 0 2pt}.nome{margin:0 0 10pt;font-size:10pt}
table{border-collapse:collapse;margin:0 auto}.cp td{width:8.5mm;height:8.5mm;text-align:center;font:600 12pt monospace;padding:0}.cp td.ac{background:#bbb}
.cz td{width:9mm;height:9mm;border:1px solid #000;position:relative;padding:0;text-align:center;font:600 12pt monospace}.cz td.v{border:0}.cz td i{position:absolute;left:1px;top:0;font:normal 7pt sans-serif}
.lista{columns:3;font-size:10pt;margin-top:10pt}.dicas{columns:2;font-size:10pt;margin-top:10pt}.dicas h2{font-size:11pt;margin:0 0 3pt;column-span:none}.dicas p{margin:0 0 2pt}
.cartas{display:grid;grid-template-columns:repeat(3,1fr);gap:0}.carta{border:1px dashed #666;height:34mm;display:flex;align-items:center;justify-content:center;text-align:center;padding:3mm;font-size:12pt}.carta.palavra{font-weight:bold;font-size:15pt}`;

/** Corpo HTML (para imprimir) de um jogo. `professor` mostra as respostas. */
export function jogoEmHtml(tipo, dados, { titulo = "", professor = false } = {}) {
  const topo = `<h1>${esc(titulo)}${professor ? " — gabarito" : ""}</h1>${professor ? "" : '<p class="nome">Nome: ______________________________ Turma: ______ Data: ___/___</p>'}`;
  if (tipo === "caca-palavras") {
    const marcadas = new Set();
    if (professor) for (const p of dados.colocadas) for (let i = 0; i < p.palavra.length; i++) marcadas.add(`${p.r + p.dr * i},${p.c + p.dc * i}`);
    const t = dados.grade.map((l, i) => `<tr>${l.map((x, j) => `<td${marcadas.has(`${i},${j}`) ? ' class="ac"' : ""}>${x}</td>`).join("")}</tr>`).join("");
    const lista = dados.colocadas.map((p) => `<div>☐ ${esc(p.original)}</div>`).join("");
    return `${topo}<table class="cp">${t}</table><div class="lista">${lista}</div>`;
  }
  if (tipo === "cruzadinha") {
    const t = dados.grade.map((l, i) => `<tr>${l.map((x, j) => x ? `<td>${dados.numeros[i][j] ? `<i>${dados.numeros[i][j]}</i>` : ""}${professor ? x : ""}</td>` : '<td class="v"></td>').join("")}</tr>`).join("");
    const dica = (d) => `<p><b>${d.n}.</b> ${esc(d.dica || "(sem dica)")} <small>(${d.tamanho})</small></p>`;
    return `${topo}<table class="cz">${t}</table><div class="dicas"><h2>Horizontais</h2>${dados.horizontais.map(dica).join("")}<h2>Verticais</h2>${dados.verticais.map(dica).join("")}</div>`;
  }
  return `<h1>${esc(titulo)}</h1><p class="nome">Recorte os cartões e junte cada palavra à sua dica.</p><div class="cartas">${dados.cartas.map((c) => `<div class="carta ${c.tipo}">${esc(c.texto)}</div>`).join("")}</div>`;
}

/** Abre o diálogo de impressão (ou "Salvar em PDF") com o HTML numa janela invisível. */
export function imprimirJogo(corpo, titulo = "Jogo") {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  f.contentDocument.write(`<!doctype html><title>${esc(titulo)}</title><style>${CSS}</style>${corpo}`);
  f.contentDocument.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 200);
}

// ---------- guardar no vault ----------

export const nomeDoJogo = (aula, tipo) => `Jogo - ${aula} - ${TIPOS_JOGO.find((t) => t.id === tipo)?.nome.split(" (")[0].toLowerCase() ?? tipo}`.replace(/[\\/:*?"<>|#^]/g, " ").replace(/\s+/g, " ").trim();

/** Grava (ou atualiza) a lista como oficina em `Acervo/Oficinas/`. Devolve o caminho. */
export async function guardarJogo(items, { aula, tipo, lista }) {
  const { invoke } = await import("@/lib/api");
  const nome = nomeDoJogo(aula, tipo), raiz = raizDe(items);
  const texto = `---\ntipo: oficina\ntitulo: ${nome}\njogo: ${tipo}\naula: "[[${aula}]]"\nanos: []\ntags: []\n---\n# ${nome}\n\nLista de palavras do jogo (uma por linha, \`palavra: dica\`). Gere de novo pela aula, em Gerar jogo.\n\n${lista.trim().split("\n").filter(Boolean).map((l) => `- ${l.replace(/^\s*[-*]\s+/, "")}`).join("\n")}\n`;
  const existente = items.find((i) => i.rel === `Acervo/Oficinas/${nome}.md`);
  if (existente) { await invoke("save_note", { path: existente.path, text: texto }); return existente.path; }
  if (!items.some((i) => i.rel.startsWith("Acervo/Oficinas/"))) { try { await invoke("create_folder", { dir: `${raiz}/Acervo`, name: "Oficinas" }); } catch { /* já existe */ } }
  const path = await invoke("create_note", { dir: `${raiz}/Acervo/Oficinas`, name: nome });
  await invoke("save_note", { path, text: texto });
  return path;
}
