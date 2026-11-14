// Edição de um banco de questões (Acervo/Questoes) direto no texto do arquivo, sem depender do parser de leitura.
// Dois formatos: "antigo" (## Texto N / #### Questão n · …, numeração global) e "blocos" (### T1 / ### A1 · T1 · …, rótulos por bloco).
// Tudo trabalha em linhas: cada texto-base e cada questão é um intervalo [ini, fim) que se troca inteiro.

const ehTraco = (l) => /^\s*(-{3,}|\*{3,})\s*$/.test(l);

/** Mapa do arquivo: onde começa e termina cada texto-base, cada questão e o gabarito. */
export function estrutura(text) {
  const L = text.split("\n");
  const blocos = /^##\s+Bloco\s+[ABC]\b/m.test(text);
  const cab = [], cerca0 = [];
  let cerca = false;
  L.forEach((l, i) => {
    if (/^\s*```/.test(l)) cerca = !cerca;
    cerca0[i] = cerca;
    const m = !cerca && /^(#{1,4})\s/.exec(l);
    if (m) cab.push({ i, n: m[1].length });
  });
  const fimDe = (i, nivel) => cab.find((h) => h.i > i && h.n <= nivel)?.i ?? L.length;
  // fim "útil": sem as linhas em branco e os traços `---` que separam os blocos
  const util = (ini, fim) => { let f = fim; while (f > ini + 1 && (!L[f - 1].trim() || ehTraco(L[f - 1]))) f--; return f; };
  const textos = [], questoes = [];
  const extras = []; // seções `##` que não são parte da estrutura do banco: viram abas editáveis
  let gab = null, grupo = null;
  L.forEach((l, i) => {
    let m;
    if (blocos) {
      if ((m = /^###\s+T(\d+)\s+—\s*(.*)$/.exec(l))) { const f = fimDe(i, 3); textos.push({ n: Number(m[1]), cab: l.replace(/^###\s+/, ""), ini: i, fim: util(i, f), fimBruto: f }); }
      else if ((m = /^###\s+([ABC])(\d+)\s*·\s*(.*)$/.exec(l))) {
        const f = fimDe(i, 3), t = m[1] === "C" ? null : Number(/^\s*T(\d+)\b/.exec(m[3])?.[1]);
        questoes.push({ chave: m[1] + m[2], letra: m[1], num: Number(m[2]), grupo: m[1] === "C" ? "ind" : "t" + t, texto: t, cab: l.replace(/^###\s+/, ""), ini: i, fim: util(i, f), fimBruto: f });
      }
    } else {
      if ((m = /^##\s+Texto\s+(\d+)\s+—\s*(.*)$/.exec(l))) { grupo = "t" + m[1]; const f = fimDe(i, 3); textos.push({ n: Number(m[1]), cab: l.replace(/^##\s+/, ""), ini: i, fim: util(i, f), fimBruto: f }); }
      else if (/^##\s+Questões independentes/.test(l)) grupo = "ind";
      else if (/^##\s+Gabarito/i.test(l)) grupo = null;
      else if ((m = /^####\s+Questão\s+(\d+)\s*·?\s*(.*)$/.exec(l))) {
        const f = fimDe(i, 4);
        questoes.push({ chave: m[1], num: Number(m[1]), grupo, texto: grupo?.startsWith("t") ? Number(grupo.slice(1)) : null, cab: l.replace(/^####\s+/, ""), ini: i, fim: util(i, f), fimBruto: f });
      }
    }
    if (!cerca0[i] && /^##\s+\S/.test(l) && !/^##\s+(Texto\s+\d+\s+—|Textos-base|Bloco\s+[ABC]\b|Questões independentes|Gabarito)/i.test(l)) { const f = fimDe(i, 2); extras.push({ ini: i, fim: util(i, f), fimBruto: f, nome: l.replace(/^##\s+/, "").trim() }); }
    if (/^##\s+Gabarito/i.test(l)) { const f = fimDe(i, 2); gab = { ini: i, fim: util(i, f), fimBruto: f }; }
  });
  return { L, blocos, textos, questoes, extras, gab, cab, fimDe };
}

const juntar = (L) => L.join("\n");
const marca = (est, tipo) => (tipo === "texto" ? (est.blocos ? "### " : "## ") : est.blocos ? "### " : "#### ");

/** Troca o texto-base ou a questão `x` (da estrutura) por novo cabeçalho e corpo. */
export function trocarBloco(text, est, tipo, x, cabecalho, corpoMd) {
  const corpo = corpoMd.replace(/\s+$/, "");
  const novo = [marca(est, tipo) + cabecalho.replace(/\n/g, " "), ...(corpo ? corpo.split("\n") : [])];
  return juntar([...est.L.slice(0, x.ini), ...novo, ...est.L.slice(x.fim)]);
}
export const corpoDe = (est, x) => est.L.slice(x.ini + 1, x.fim).join("\n");

const reGab = (chave) => new RegExp(`^-\\s+\\*\\*${chave}:\\*\\*\\s?`);
export function gabaritoDe(est, chave) {
  const i = est.L.findIndex((l, k) => est.gab && k > est.gab.ini && reGab(chave).test(l));
  return i < 0 ? null : { linha: i, texto: est.L[i].replace(reGab(chave), "") };
}
/** Grava (ou cria) a linha `- **chave:** valor` do gabarito, perto das vizinhas. */
export function definirGabarito(text, est, chave, valor) {
  const atual = gabaritoDe(est, chave), L = est.L.slice(), linha = `- **${chave}:** ${valor.replace(/\n/g, " ")}`;
  if (atual) { L[atual.linha] = valor.trim() || !atual ? linha : linha; return juntar(L); }
  if (!valor.trim()) return text;
  if (!est.gab) return text.replace(/\s*$/, "") + `\n\n---\n\n## Gabarito e respostas esperadas\n\n${linha}\n`;
  const ordem = est.questoes.findIndex((q) => q.chave === chave);
  let apos = -1;
  for (let k = ordem - 1; k >= 0 && apos < 0; k--) apos = gabaritoDe(est, est.questoes[k].chave)?.linha ?? -1;
  if (apos < 0) apos = est.gab.fim - 1;
  L.splice(apos + 1, 0, linha);
  return juntar(L);
}

// Renumera (formato antigo): questões e gabarito com número ≥ de, somando `delta`.
function renumerar(L, est, de, delta) {
  for (const q of est.questoes) if (q.num >= de) L[q.ini] = L[q.ini].replace(/^(####\s+Questão\s+)\d+/, `$1${q.num + delta}`);
  if (est.gab) for (let k = est.gab.ini + 1; k < est.gab.fimBruto; k++) { const m = /^(-\s+\*\*)(\d+)(:\*\*)/.exec(L[k]); if (m && Number(m[2]) >= de) L[k] = L[k].replace(m[0], m[1] + (Number(m[2]) + delta) + m[3]); }
}

/** Nova questão. `o`: { tipo: "interp" | "cont" | "ind", texto?: n }. Devolve { text, chave }. */
export function novaQuestao(text, est, o) {
  const L = est.L.slice(), dissert = ["(Resposta: 4 linhas)"];
  if (!est.blocos) {
    const grupo = o.tipo === "ind" ? "ind" : "t" + o.texto, doGrupo = est.questoes.filter((q) => q.grupo === grupo);
    let ponto;
    if (doGrupo.length) ponto = doGrupo[doGrupo.length - 1].fim;
    else if (grupo === "ind") ponto = (est.cab.find((h) => /^##\s+Questões independentes/.test(L[h.i])) ? est.cab.find((h) => /^##\s+Questões independentes/.test(L[h.i])).i + 1 : null);
    else { const t = est.textos.find((x) => x.n === o.texto), h = t && est.cab.find((c) => c.i >= t.ini && /^###\s+Questões/.test(L[c.i])); ponto = h ? h.i + 1 : t ? t.fim : null; }
    const novoNum = est.questoes.filter((q) => q.ini < (ponto ?? L.length)).length + 1;
    const cabecalho = o.tipo === "ind" ? `Questão ${novoNum} · Assunto` : `Questão ${novoNum} · ${o.tipo === "cont" ? "Conteúdo" : "Interpretação"} · Dissertativa`;
    const bloco = ["", "#### " + cabecalho, "Enunciado da questão.", ...(o.tipo === "ind" ? [] : dissert)];
    if (ponto == null) { // sem a seção de independentes: cria antes do gabarito
      const g = est.gab?.ini ?? L.length;
      renumerar(L, est, novoNum, 1);
      L.splice(g, 0, "## Questões independentes", ...bloco.slice(1), "", "---", "");
    } else { renumerar(L, est, novoNum, 1); L.splice(ponto, 0, ...bloco); }
    return { text: juntar(L), chave: String(novoNum) };
  }
  const letra = o.tipo === "ind" ? "C" : o.tipo === "cont" ? "B" : "A", daLetra = est.questoes.filter((q) => q.letra === letra);
  const num = daLetra.reduce((m, q) => Math.max(m, q.num), 0) + 1, chave = letra + num;
  const daTexto = o.tipo === "ind" ? daLetra : daLetra.filter((q) => q.texto === o.texto);
  const ref = (daTexto.length ? daTexto : daLetra)[(daTexto.length ? daTexto : daLetra).length - 1];
  const cabecalho = letra === "C" ? `${chave} · Assunto · Dissertativa · [M]` : `${chave} · T${o.texto ?? 1} · Dissertativa · [M]`;
  const bloco = ["", "### " + cabecalho, "Enunciado da questão.", ...dissert];
  if (ref) L.splice(ref.fim, 0, ...bloco);
  else {
    const g = est.gab?.ini ?? L.length, tit = { A: "Bloco A — Interpretação (escolher 2)", B: "Bloco B — Conteúdo ligado ao texto (escolher 2)", C: "Bloco C — Conteúdo independente (escolher 6)" }[letra];
    L.splice(g, 0, "## " + tit, ...bloco, "", "---", "");
  }
  return { text: juntar(L), chave };
}

/** Remove a questão `chave` (e a linha dela no gabarito); no formato antigo, renumera as seguintes. */
export function removerQuestao(text, est, chave) {
  const q = est.questoes.find((x) => x.chave === chave);
  if (!q) return text;
  const L = est.L.slice(), g = gaba(est, chave);
  const cortes = [[q.ini, q.fim], ...(g != null ? [[g, g + 1]] : [])].sort((a, b) => b[0] - a[0]);
  if (!est.blocos) renumerar(L, { ...est, questoes: est.questoes.filter((x) => x.num > q.num) }, q.num + 1, -1);
  // o gabarito do formato antigo também desce: renumerar() já trata as linhas com número maior
  for (const [a, b] of cortes) L.splice(a, b - a);
  if (L[q.ini - 1] != null && !L[q.ini - 1].trim() && L[q.ini] != null && !L[q.ini].trim()) L.splice(q.ini, 1); // não deixa duas linhas em branco
  return juntar(L);
}
const gaba = (est, chave) => gabaritoDe(est, chave)?.linha ?? null;

/** Novo texto-base, ao fim dos textos. Devolve { text, n }. */
export function novoTexto(text, est) {
  const L = est.L.slice(), n = est.textos.reduce((m, t) => Math.max(m, t.n), 0) + 1;
  if (est.blocos) {
    const ultimo = est.textos[est.textos.length - 1];
    const bloco = ["", `### T${n} — Gênero — Autor, "Título"`, "Fonte: ", "", "Cole aqui o texto-base."];
    if (ultimo) L.splice(ultimo.fim, 0, ...bloco);
    else { const a = est.cab.find((h) => /^##\s+Bloco/.test(L[h.i]))?.i ?? est.gab?.ini ?? L.length; L.splice(a, 0, "## Textos-base", ...bloco, "", "---", ""); }
  } else {
    const ate = est.cab.find((h) => /^##\s+(Questões independentes|Gabarito)/i.test(L[h.i]))?.i ?? L.length;
    L.splice(ate, 0, `## Texto ${n} — Gênero — Autor, "Título"`, "", "> Cole aqui o texto-base.", "", `### Questões sobre o Texto ${n}`, "", "---", "");
  }
  return { text: juntar(L), n };
}

/** Linha "Conteúdos excluídos: …" (cria depois do título se não houver). */
export function definirExcluidos(text, valor) {
  const linha = `Conteúdos excluídos: ${valor.trim()}`;
  if (/^Conteúdos excluídos:.*$/m.test(text)) return text.replace(/^Conteúdos excluídos:.*$/m, () => linha);
  return text.replace(/^(#\s+.*)$/m, (h) => `${h}\n\n${linha}`);
}
/** Assunto: a parte do meio do título "# Banco de questões — ASSUNTO — 6º ano". */
export function assuntoDe(text) {
  const h = /^#\s+(.*)$/m.exec(text.replace(/^---\n[\s\S]*?\n---\n?/, ""))?.[1] ?? "";
  return h.replace(/^Banco de questões\s*—\s*/, "").replace(/\s*—\s*\d+º ano\s*$/, "");
}
export function definirAssunto(text, assunto, ano) {
  return text.replace(/^(#\s+Banco de questões\s*—\s*).*$/m, (_, p) => `${p}${assunto.trim()}${ano ? ` — ${ano}º ano` : ""}`);
}

/** Troca a seção de gabarito inteira (título "## Gabarito…" e o que vem abaixo). */
export function trocarGabarito(text, est, md) {
  if (!est.gab) return text;
  const corpo = md.replace(/\s+$/, "");
  return juntar([...est.L.slice(0, est.gab.ini), ...(corpo ? corpo.split("\n") : []), ...est.L.slice(est.gab.fim)]);
}
