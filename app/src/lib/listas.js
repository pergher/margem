// Listas no editor: Tab / Shift+Tab mudam o nível do item (pela largura do marcador do item de cima, não por um número fixo),
// e as listas numeradas se renumeram depois de Tab, Shift+Tab e Enter. Comandos de estado (`{ state, dispatch }`), testáveis sem DOM.
import { ChangeSet } from "@codemirror/state";
import { insertNewlineContinueMarkup } from "@codemirror/lang-markdown";

const ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])( +)/;

/** Lê uma linha de texto como item de lista (ou null). `larg` = largura do marcador com o espaço: quanto um filho precisa recuar. */
export function lerItem(texto) {
  const m = ITEM.exec(texto);
  if (!m) return null;
  const ordenado = /\d/.test(m[2]);
  return { indent: m[1].length, marcador: m[2], ordenado, larg: m[2].length + 1, inicioMarcador: m[1].length, numero: ordenado ? parseInt(m[2], 10) : null, delim: ordenado ? m[2].slice(-1) : null };
}

/** O frontmatter (YAML entre `---`) também tem "- item": ali, Tab não mexe. */
function noFrontmatter(doc, numLinha) {
  if (doc.line(1).text.trim() !== "---") return false;
  for (let i = 2; i <= doc.lines; i++) if (doc.line(i).text.trim() === "---") return numLinha <= i;
  return false;
}

/** Faixa de linhas do "bloco de lista" que contém `numLinha`: linhas de lista, recuadas ou em branco, sem cercas de código. */
function blocoDaLista(doc, numLinha) {
  const ok = (n) => { const t = doc.line(n).text; return t.trim() === "" || ITEM.test(t) || /^[ \t]+\S/.test(t); };
  const cerca = (n) => /^[ \t]*(```|~~~)/.test(doc.line(n).text);
  let a = numLinha, b = numLinha;
  while (a > 1 && ok(a - 1) && !cerca(a - 1)) a--;
  while (b < doc.lines && ok(b + 1) && !cerca(b + 1)) b++;
  return [a, b];
}

/** Mudanças que renumeram as listas ordenadas do bloco: cada nível conta 1, 2, 3… (o primeiro item do bloco mantém o seu número). */
export function mudancasDeRenumeracao(doc, numLinha) {
  const [a, b] = blocoDaLista(doc, numLinha);
  const pilha = []; // { indent, n }  (n = null: nível de marcadores)
  const mud = [];
  for (let i = a; i <= b; i++) {
    const linha = doc.line(i), it = lerItem(linha.text);
    if (!it) continue;
    while (pilha.length && pilha.at(-1).indent > it.indent) pilha.pop();
    let nivel = pilha.at(-1);
    if (!nivel || nivel.indent < it.indent) { nivel = { indent: it.indent, n: null, primeiro: true }; pilha.push(nivel); }
    if (!it.ordenado) { nivel.n = null; nivel.primeiro = false; continue; }
    const n = nivel.n === null ? (nivel.primeiro && pilha.length === 1 ? it.numero : 1) : nivel.n + 1;
    nivel.n = n; nivel.primeiro = false;
    if (n !== it.numero) {
      const de = linha.from + it.inicioMarcador, ate = de + String(it.numero).length;
      mud.push({ from: de, to: ate, insert: String(n) });
    }
  }
  return mud;
}

/** Linhas (números) tocadas pela seleção. */
function linhasDaSelecao(state) {
  const set = new Set();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number;
    let b = state.doc.lineAt(r.to).number;
    if (b > a && state.doc.line(b).from === r.to) b--; // seleção que termina no começo de uma linha não a inclui
    for (let i = a; i <= b; i++) set.add(i);
  }
  return [...set];
}

/** Irmão de cima: o item anterior com o mesmo recuo (sem passar por um item mais raso). */
function irmaoDeCima(doc, numLinha, indent) {
  for (let i = numLinha - 1; i >= 1; i--) {
    const it = lerItem(doc.line(i).text);
    if (!it) { if (doc.line(i).text.trim() === "" || /^[ \t]+\S/.test(doc.line(i).text)) continue; return null; }
    if (it.indent < indent) return null;
    if (it.indent === indent) return it;
  }
  return null;
}
/** Pai: o item anterior com recuo menor. */
function paiDeCima(doc, numLinha, indent) {
  for (let i = numLinha - 1; i >= 1; i--) {
    const it = lerItem(doc.line(i).text);
    if (it && it.indent < indent) return it;
  }
  return null;
}

function aplicar({ state, dispatch }, indentar) {
  const doc = state.doc, linhas = linhasDaSelecao(state);
  const primeira = linhas.find((n) => lerItem(doc.line(n).text));
  if (!primeira || noFrontmatter(doc, primeira)) return false;
  const it0 = lerItem(doc.line(primeira).text);
  let delta;
  if (indentar) {
    const irmao = irmaoDeCima(doc, primeira, it0.indent);
    delta = irmao ? irmao.indent + irmao.larg - it0.indent : 0;
  } else {
    const pai = paiDeCima(doc, primeira, it0.indent);
    delta = it0.indent > 0 ? (pai ? pai.indent : 0) - it0.indent : 0;
  }
  if (delta === 0) return true; // é item de lista: Tab não faz nada, mas também não tira o foco do editor
  const mud = [];
  for (const n of linhas) {
    const l = doc.line(n), it = lerItem(l.text);
    if (!it) continue;
    mud.push({ from: l.from, to: l.from + it.indent, insert: " ".repeat(Math.max(0, it.indent + delta)) });
  }
  // Recuo e renumeração numa só transação (um único Ctrl+Z desfaz os dois).
  const recuo = ChangeSet.of(mud, doc.length);
  const depois = recuo.apply(doc);
  const renum = ChangeSet.of(mudancasDeRenumeracao(depois, primeira), depois.length); // o recuo não muda o número de linhas
  dispatch(state.update({ changes: recuo.compose(renum), userEvent: indentar ? "input.indent" : "delete.dedent" }));
  return true;
}

export const indentarItem = (view) => aplicar(view, true);
export const recuarItem = (view) => aplicar(view, false);

/** Enter: continua a lista (comportamento do CodeMirror) e renumera os itens que vêm depois. */
export const enterNaLista = (view) => {
  if (!insertNewlineContinueMarkup(view)) return false;
  const st = view.state, linha = st.doc.lineAt(st.selection.main.head);
  if (!lerItem(linha.text) && !(linha.number > 1 && lerItem(st.doc.line(linha.number - 1).text))) return true;
  const mud = mudancasDeRenumeracao(st.doc, linha.number);
  if (mud.length) view.dispatch(st.update({ changes: mud, userEvent: "input" }));
  return true;
};
