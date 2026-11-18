// Revisão de uma proposta da IA dentro da própria nota (CodeMirror).
// O texto da nota NÃO muda durante a revisão: cada trecho alterado é escondido atrás de um bloco que mostra o que sai (vermelho) e o que
// entra (verde), com Aceitar/Recusar. Aceitar é uma edição normal (desfazer, salvamento automático); recusar só tira o bloco.
// A comparação é sempre com o texto de agora, então reabrir a revisão depois de aceitar alguns trechos mostra só os que faltam.
import { Annotation, EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { trechos } from "@/lib/proposta";
import { htmlIA } from "@/lib/iaMarkdown";

const daRevisao = Annotation.define(); // marca as edições feitas pela própria revisão (as demais cancelam a revisão)
const efIniciar = StateEffect.define();
const efResolver = StateEffect.define(); // { id, aceito }
const efModo = StateEffect.define();
const efAtual = StateEffect.define();
const efEncerrar = StateEffect.define();

const VAZIO = { itens: [], total: 0, aceitos: 0, atual: 0, modo: "renderizado", motivo: null, decos: Decoration.none };

/** Trechos que diferem entre `doc` e `novo`, com a posição de cada um no documento. */
export function criarItens(doc, novo) {
  const itens = [];
  let n = 1; // linha (1-based) do documento onde o próximo trecho começa
  for (const s of trechos(doc.toString(), novo)) {
    if (s.tipo === "igual") { n += s.linhas.length; continue; }
    const nr = s.removidas.length;
    const fimDoc = nr === 0 && n > doc.lines;
    const from = fimDoc ? doc.length : doc.line(n).from;
    const to = nr ? doc.line(n + nr - 1).to : from;
    itens.push({ id: itens.length, from, to, rem: s.removidas, add: s.adicionadas, fimDoc });
    n += nr;
  }
  return itens;
}

/** A edição que aplica o trecho ao documento. */
export function mudancaDe({ from, to, rem, add, fimDoc }, doc) {
  const novo = add.join("\n");
  if (rem.length && add.length) return { from, to, insert: novo };
  if (rem.length) return to < doc.length ? { from, to: to + 1 } : { from: Math.max(0, from - 1), to }; // some junto com uma quebra de linha
  return fimDoc ? { from, insert: "\n" + novo } : { from, insert: novo + "\n" };
}

const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };
const botao = (texto, cls, fn) => {
  const b = el("button", "cm-rev-bt " + cls, texto);
  b.type = "button";
  b.addEventListener("mousedown", (e) => e.preventDefault()); // o editor não perde o foco
  b.addEventListener("click", fn);
  return b;
};

function bloco(tipo, linhas, modo) {
  const d = el("div", `cm-rev-${tipo}`);
  if (modo === "renderizado") {
    const m = el("div", "aula-md ia-md");
    m.innerHTML = htmlIA(linhas.join("\n")); // htmlIA: HTML cru escapado, sem imagens nem links ativos
    d.append(m);
  } else {
    for (const l of linhas) { const r = el("div", "cm-rev-lin"); r.append(el("span", "cm-rev-sinal", tipo === "add" ? "+" : "−"), document.createTextNode(l || " ")); d.append(r); }
  }
  return d;
}

class ItemWidget extends WidgetType {
  constructor(it, k, n, modo, atual) { super(); this.it = it; this.k = k; this.n = n; this.modo = modo; this.atual = atual; }
  eq(o) {
    return o.k === this.k && o.n === this.n && o.modo === this.modo && o.atual === this.atual && o.it.id === this.it.id
      && o.it.rem.join("\n") === this.it.rem.join("\n") && o.it.add.join("\n") === this.it.add.join("\n");
  }
  ignoreEvent() { return true; }
  toDOM(view) {
    const { it, k, n, modo, atual } = this;
    const raiz = el("div", "cm-rev" + (atual ? " cm-rev-atual" : ""));
    raiz.dataset.rev = String(it.id);
    const cab = el("div", "cm-rev-cab");
    cab.append(el("span", "cm-rev-n", `Alteração ${k + 1} de ${n}`), el("span", "cm-rev-esp"),
      botao("✓ Aceitar", "cm-rev-ok", () => aceitarTrecho(view, it.id)), botao("✗ Recusar", "cm-rev-no", () => recusarTrecho(view, it.id)));
    raiz.append(cab);
    if (it.rem.length) raiz.append(bloco("del", it.rem, modo));
    if (it.add.length) raiz.append(bloco("add", it.add, modo));
    return raiz;
  }
}

function montar(v, doc) {
  const out = [];
  v.itens.forEach((it, k) => {
    const w = new ItemWidget(it, k, v.itens.length, v.modo, k === v.atual);
    if (it.rem.length) {
      const fim = it.to > it.from ? it.to : Math.min(doc.length, it.to + 1); // linha vazia: cobre a quebra de linha
      out.push(fim > it.from ? Decoration.replace({ widget: w, block: true }).range(it.from, fim) : Decoration.widget({ widget: w, block: true, side: -1 }).range(it.from));
    } else out.push(Decoration.widget({ widget: w, block: true, side: it.fimDoc ? 1 : -1 }).range(it.from));
  });
  return Decoration.set(out, true);
}

export const revisaoCampo = StateField.define({
  create: () => VAZIO,
  update(v, tr) {
    // qualquer edição que não venha da revisão (recarregar do disco, por exemplo) invalida as posições
    if (tr.docChanged && v.itens.length && !tr.annotation(daRevisao)) return { ...VAZIO, modo: v.modo, motivo: "cancelada" };
    let n = v;
    if (tr.docChanged && v.itens.length) {
      n = { ...v, itens: v.itens.map((i) => { const from = tr.changes.mapPos(i.from, 1); return { ...i, from, to: Math.max(from, tr.changes.mapPos(i.to, -1)) }; }) };
    }
    for (const e of tr.effects) {
      if (e.is(efIniciar)) { const itens = criarItens(tr.state.doc, e.value); n = { ...VAZIO, modo: n.modo, itens, total: itens.length, motivo: itens.length ? null : "vazia" }; }
      else if (e.is(efResolver)) {
        const itens = n.itens.filter((i) => i.id !== e.value.id);
        n = { ...n, itens, aceitos: n.aceitos + (e.value.aceito ? 1 : 0), atual: Math.min(n.atual, Math.max(0, itens.length - 1)), motivo: itens.length ? n.motivo : "concluida" };
      } else if (e.is(efModo)) n = { ...n, modo: e.value };
      else if (e.is(efAtual)) n = { ...n, atual: e.value };
      else if (e.is(efEncerrar)) n = { ...VAZIO, modo: n.modo, motivo: n.itens.length ? "cancelada" : n.motivo };
    }
    return n === v ? v : { ...n, decos: montar(n, tr.state.doc) };
  },
  provide: (f) => [EditorView.decorations.from(f, (v) => v.decos), EditorState.readOnly.from(f, (v) => v.itens.length > 0)],
});

export const resumoRevisao = (v) => ({ ativa: v.itens.length > 0, total: v.total, restantes: v.itens.length, atual: v.atual, modo: v.modo, motivo: v.motivo, aceitos: v.aceitos });
export const estadoRevisao = (view) => view.state.field(revisaoCampo);

function rolarPara(view, i) {
  const it = estadoRevisao(view).itens[i];
  if (it) view.dispatch({ effects: EditorView.scrollIntoView(it.from, { y: "center" }) });
}

/** Começa a revisão do texto `novo` na nota aberta; devolve quantos trechos há para revisar. */
export function iniciarRevisao(view, novo) {
  view.dispatch({ effects: efIniciar.of(novo) });
  const n = estadoRevisao(view).itens.length;
  if (n) rolarPara(view, 0);
  return n;
}

export function aceitarTrecho(view, id) {
  const it = estadoRevisao(view).itens.find((i) => i.id === id);
  if (!it) return;
  view.dispatch({ changes: mudancaDe(it, view.state.doc), effects: efResolver.of({ id, aceito: true }), annotations: daRevisao.of(true) });
  rolarPara(view, estadoRevisao(view).atual);
}

export function recusarTrecho(view, id) {
  view.dispatch({ effects: efResolver.of({ id, aceito: false }) });
  rolarPara(view, estadoRevisao(view).atual);
}

export function aceitarTudo(view) {
  const { itens } = estadoRevisao(view);
  if (!itens.length) return;
  view.dispatch({ changes: itens.map((i) => mudancaDe(i, view.state.doc)), effects: itens.map((i) => efResolver.of({ id: i.id, aceito: true })), annotations: daRevisao.of(true) });
}

export function recusarTudo(view) {
  const { itens } = estadoRevisao(view);
  if (itens.length) view.dispatch({ effects: itens.map((i) => efResolver.of({ id: i.id, aceito: false })) });
}

export function irPara(view, delta) {
  const { itens, atual } = estadoRevisao(view), n = itens.length;
  if (!n) return;
  const a = (atual + delta + n) % n;
  view.dispatch({ effects: efAtual.of(a) });
  rolarPara(view, a);
}

export const definirModo = (view, modo) => view.dispatch({ effects: efModo.of(modo) });
export const encerrarRevisao = (view) => view.dispatch({ effects: efEncerrar.of(null) });
