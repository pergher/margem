// Barra flutuante: aparece acima do texto selecionado, com os formatos mais usados (negrito, itálico, destaque, código, link,
// títulos, citação e lista). Os comandos servem a qualquer EditorView e são testáveis só com o estado.
import { EditorSelection, StateField } from "@codemirror/state";
import { showTooltip } from "@codemirror/view";

/** `*` (itálico) não pode confundir `**` (negrito) com o seu próprio marcador. */
const abreCom = (t, m) => t.startsWith(m) && !(m === "*" && t.startsWith("**") && !t.startsWith("***"));
const fechaCom = (t, m) => t.endsWith(m) && !(m === "*" && t.endsWith("**") && !t.endsWith("***"));

/** Liga/desliga os marcadores em volta de cada trecho selecionado (dentro da seleção ou logo fora dela). */
export function alternarEnvolver(view, abre, fecha = abre) {
  const { state } = view;
  const tr = state.changeByRange((r) => {
    if (r.empty) return { range: r };
    const t = state.sliceDoc(r.from, r.to), n = abre.length, m = fecha.length;
    if (t.length >= n + m && abreCom(t, abre) && fechaCom(t, fecha)) { // marcadores dentro da seleção
      return { changes: [{ from: r.from, to: r.from + n }, { from: r.to - m, to: r.to }], range: EditorSelection.range(r.from, r.to - n - m) };
    }
    const antes = state.sliceDoc(Math.max(0, r.from - n), r.from), depois = state.sliceDoc(r.to, r.to + m);
    if (antes === abre && depois === fecha && !(abre === "*" && (state.sliceDoc(r.from - 2, r.from) === "**" || state.sliceDoc(r.to, r.to + 2) === "**") && state.sliceDoc(r.from - 3, r.from) !== "***")) {
      return { changes: [{ from: r.from - n, to: r.from }, { from: r.to, to: r.to + m }], range: EditorSelection.range(r.from - n, r.to - n) };
    }
    return { changes: [{ from: r.from, insert: abre }, { from: r.to, insert: fecha }], range: EditorSelection.range(r.from + n, r.to + n) };
  });
  view.dispatch(state.update(tr, { userEvent: "input.format", scrollIntoView: true }));
  view.focus();
  return true;
}

/** Link: `[texto](endereço)`; se o texto selecionado já é um endereço, ele vira o destino e o cursor vai para o texto. */
export function inserirLink(view) {
  const { state } = view, r = state.selection.main;
  if (r.empty) return false;
  const t = state.sliceDoc(r.from, r.to);
  if (/^(https?:\/\/|www\.)\S+$/.test(t)) {
    view.dispatch({ changes: { from: r.from, to: r.to, insert: `[](${t})` }, selection: { anchor: r.from + 1 }, userEvent: "input.format" });
  } else {
    view.dispatch({ changes: { from: r.from, to: r.to, insert: `[${t}](endereço)` }, selection: { anchor: r.from + t.length + 3, head: r.from + t.length + 11 }, userEvent: "input.format" });
  }
  view.focus();
  return true;
}

/** Prefixo de linha (título, citação, lista): se todas as linhas já o têm, tira; senão põe (trocando outro do mesmo tipo). */
export function alternarLinhas(view, { tira, poe }) {
  const { state } = view, doc = state.doc, linhas = [];
  for (const r of state.selection.ranges) {
    const a = doc.lineAt(r.from).number;
    let b = doc.lineAt(r.to).number;
    if (b > a && doc.line(b).from === r.to) b--;
    for (let i = a; i <= b; i++) if (!linhas.includes(i)) linhas.push(i);
  }
  const cheias = linhas.map((n) => doc.line(n)).filter((l) => l.text.trim() !== "");
  if (!cheias.length) return false;
  const todas = cheias.every((l) => l.text.startsWith(poe));
  const final = todas
    ? cheias.map((l) => ({ from: l.from, to: l.from + poe.length, insert: "" }))
    : cheias.filter((l) => !l.text.startsWith(poe)).map((l) => ({ from: l.from, to: l.from + (tira.exec(l.text)?.[0].length ?? 0), insert: poe }));
  if (!final.length) return true;
  view.dispatch({ changes: final, userEvent: "input.format" });
  view.focus();
  return true;
}

const TITULO = /^#{1,6} /, CITACAO = /^> ?/, LISTA = /^([-*+] |\d{1,9}[.)] )/;
export const BOTOES = [
  { id: "negrito", rotulo: "N", dica: "Negrito", estilo: "font-weight:700", run: (v) => alternarEnvolver(v, "**") },
  { id: "italico", rotulo: "I", dica: "Itálico", estilo: "font-style:italic", run: (v) => alternarEnvolver(v, "*") },
  { id: "destaque", rotulo: "Ab", dica: "Destaque", classe: "cm-h-mark", run: (v) => alternarEnvolver(v, "<mark>", "</mark>") },
  { id: "codigo", rotulo: "</>", dica: "Código", estilo: "font-family:monospace", run: (v) => alternarEnvolver(v, "`") },
  { id: "link", rotulo: "Link", dica: "Link", run: inserirLink },
  { sep: true },
  { id: "h2", rotulo: "T2", dica: "Título", run: (v) => alternarLinhas(v, { tira: TITULO, poe: "## " }) },
  { id: "h3", rotulo: "T3", dica: "Subtítulo", run: (v) => alternarLinhas(v, { tira: TITULO, poe: "### " }) },
  { id: "citacao", rotulo: "“”", dica: "Citação", run: (v) => alternarLinhas(v, { tira: CITACAO, poe: "> " }) },
  { id: "lista", rotulo: "•", dica: "Lista", run: (v) => alternarLinhas(v, { tira: LISTA, poe: "- " }) },
];

function criarBarra(view) {
  const dom = document.createElement("div");
  dom.className = "cm-barra-flutuante";
  dom.setAttribute("role", "toolbar");
  dom.setAttribute("aria-label", "Formatar texto");
  for (const b of BOTOES) {
    if (b.sep) { const s = document.createElement("span"); s.className = "cm-barra-sep"; dom.appendChild(s); continue; }
    const el = document.createElement("button");
    el.type = "button"; el.textContent = b.rotulo; el.title = b.dica; el.setAttribute("aria-label", b.dica);
    if (b.estilo) el.style.cssText = b.estilo;
    if (b.classe) el.classList.add(b.classe);
    el.addEventListener("mousedown", (e) => { e.preventDefault(); b.run(view); }); // mousedown: não tira a seleção do texto
    dom.appendChild(el);
  }
  return { dom };
}

const toque = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches; // no celular já há o menu do sistema

/** Frontmatter (entre `---`): sem barra, ali é um formulário. */
const noFrontmatter = (doc, pos) => {
  if (doc.line(1).text.trim() !== "---") return false;
  for (let i = 2; i <= doc.lines; i++) if (doc.line(i).text.trim() === "---") return pos <= doc.line(i).to;
  return false;
};

export const barraFlutuante = StateField.define({
  create: () => null,
  update(_, tr) {
    const r = tr.state.selection.main;
    if (r.empty || r.to - r.from > 5000 || toque() || noFrontmatter(tr.state.doc, r.from)) return null;
    return { pos: r.from, above: true, strictSide: true, arrow: false, create: criarBarra };
  },
  provide: (f) => showTooltip.from(f),
});
