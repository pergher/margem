// Live preview de Markdown para CodeMirror 6: renderiza títulos, ênfase, listas, tarefas,
// citações, callouts, tabelas, wikilinks e frontmatter; mostra o texto-fonte só onde está o cursor.
import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import { StateField } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { invoke } from "@/lib/api";

const hide = Decoration.replace({});

function touches(state, from, to) {
  return state.selection.ranges.some((r) => r.from <= to && r.to >= from);
}

/** Fim do frontmatter (posição após a linha `---` de fechamento) ou 0. */
export function frontmatterEnd(doc) {
  if (doc.lines < 3 || doc.line(1).text.trim() !== "---") return 0;
  for (let i = 2; i <= doc.lines; i++) {
    if (doc.line(i).text.trim() === "---") return doc.line(i).to;
  }
  return 0;
}

// ---------- widgets ----------

class BulletWidget extends WidgetType {
  toDOM() { const s = document.createElement("span"); s.className = "cm-bullet"; s.textContent = "•"; return s; }
  eq() { return true; }
  ignoreEvent() { return false; }
}

class CheckWidget extends WidgetType {
  constructor(checked) { super(); this.checked = checked; }
  eq(o) { return o.checked === this.checked; }
  toDOM(view) {
    const i = document.createElement("input");
    i.type = "checkbox"; i.checked = this.checked; i.className = "cm-check";
    i.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const pos = view.posAtDOM(i);
      view.dispatch({ changes: { from: pos + 1, to: pos + 2, insert: this.checked ? " " : "x" } });
    });
    return i;
  }
  ignoreEvent() { return true; }
}

class HrWidget extends WidgetType {
  toDOM() { const h = document.createElement("hr"); h.className = "cm-hr"; return h; }
  eq() { return true; }
  ignoreEvent() { return false; }
}

class CalloutTitle extends WidgetType {
  constructor(tipo, titulo) { super(); this.tipo = tipo; this.titulo = titulo; }
  eq(o) { return o.tipo === this.tipo && o.titulo === this.titulo; }
  toDOM() {
    const d = document.createElement("span");
    d.className = "cm-callout-title";
    const t = document.createElement("span");
    if (this.titulo) t.innerHTML = inlineMd(this.titulo.replace(/<\/?(?:mark|u|b|i|sub|sup)[^>]*>/g, ""));
    else t.textContent = LABELS[this.tipo] || this.tipo;
    d.append(t);
    return d;
  }
  ignoreEvent() { return false; } // clique no título leva o cursor à linha e revela o código
}

const LABELS = { professor: "Dica para o professor", tip: "Dica", note: "Nota", abstract: "Resumo", info: "Informação", warning: "Atenção", attention: "Atenção", example: "Exemplo", question: "Pergunta", important: "Importante" };
const CALLOUT_RE = /^>\s*\[!(\w[\w-]*)\][+-]?\s*(.*)$/;

function inlineMd(s) {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return esc
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?\|([^\]]+)\]\]/g, '<span class="cm-wikilink" data-target="$1">$2</span>')
    .replace(/\[\[([^\]|#]+)(#[^\]|]*)?\]\]/g, '<span class="cm-wikilink" data-target="$1">$1$2</span>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\\\|/g, "|");
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}

// ---------- embeds: ![[imagem]] e ![[nota]] ----------

const embedCache = new Map(); // alvo -> { t, p }; imagens ficam, notas valem 4 s
function fetchEmbed(target, anchor) {
  const key = target + "#" + (anchor || ""), hit = embedCache.get(key);
  if (hit && (hit.img || Date.now() - hit.t < 4000)) return hit.p;
  const p = invoke("read_embed", { target, anchor: anchor || null }).catch(() => null);
  embedCache.set(key, { t: Date.now(), p, img: /\.(png|jpe?g|gif|webp|svg)$/i.test(target) });
  return p;
}

/** Markdown reduzido para mostrar o conteúdo de uma nota embutida. */
function embedHtml(text) {
  const out = [];
  let fence = false;
  for (const raw of text.split("\n").slice(0, 80)) {
    const l = raw.replace(/\s*\^[\w-]+\s*$/, "");
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; continue; }
    if (fence) { out.push(`<div class="cm-embed-code">${inlineMd(l) || "&nbsp;"}</div>`); continue; }
    if (!l.trim()) { out.push('<div class="cm-embed-gap"></div>'); continue; }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) out.push(`<div class="cm-embed-h">${inlineMd(m[2])}</div>`);
    else if (/^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l)) continue;
    else if (l.trim().startsWith("|")) out.push(`<div class="cm-embed-row">${splitRow(l).map(inlineMd).join(" &nbsp;·&nbsp; ")}</div>`);
    else if ((m = /^(\s*)[-*+]\s+(.*)$/.exec(l))) out.push(`<div style="padding-left:${m[1].length * 6 + 4}px">• ${inlineMd(m[2])}</div>`);
    else if ((m = /^>\s?(.*)$/.exec(l))) out.push(`<div class="cm-embed-quote">${inlineMd(m[1].replace(/^\[![\w-]+\][+-]?\s*/, ""))}</div>`);
    else out.push(`<div>${inlineMd(l)}</div>`);
  }
  return out.join("");
}

class EmbedWidget extends WidgetType {
  constructor(target, anchor, size) { super(); this.target = target; this.anchor = anchor; this.size = size; }
  eq(o) { return o.target === this.target && o.anchor === this.anchor && o.size === this.size; }
  toDOM(view) {
    const box = document.createElement("span");
    box.className = "cm-embed-box";
    box.textContent = "▣ " + this.target + "…";
    fetchEmbed(this.target, this.anchor).then((r) => {
      box.textContent = "";
      if (!r) { box.className = "cm-embed-box cm-embed-missing"; box.textContent = `▣ ${this.target} não encontrado`; }
      else if (r.kind === "image") {
        box.className = "cm-embed-box cm-embed-img";
        const img = document.createElement("img");
        img.src = r.data; img.alt = r.name; img.draggable = false;
        if (this.size) img.style.width = this.size + "px";
        img.addEventListener("load", () => view.requestMeasure());
        box.append(img);
      } else if (r.kind === "file") { box.className = "cm-embed-box cm-embed-file"; box.textContent = "▣ " + r.name; }
      else {
        box.className = "cm-embed-box cm-embed-note";
        const h = document.createElement("div");
        h.className = "cm-embed-title"; h.textContent = r.name + (this.anchor ? " › " + this.anchor.replace(/^\^/, "") : ""); h.title = "Abrir nota";
        h.addEventListener("mousedown", (e) => { e.preventDefault(); box.dispatchEvent(new CustomEvent("cm-open-link", { bubbles: true, detail: r.name })); });
        const b = document.createElement("div");
        b.innerHTML = embedHtml(r.text);
        box.append(h, b);
      }
      view.requestMeasure();
    });
    return box;
  }
  ignoreEvent() { return false; } // clique leva o cursor e revela o código
}

// ---------- tabela editável ----------

function parseTable(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  const head = splitRow(lines[0] || "");
  const n = head.length;
  const aligns = splitRow(lines[1] || "").map((c) => (/^:-+:$/.test(c) ? "center" : /-+:$/.test(c) ? "right" : "left"));
  while (aligns.length < n) aligns.push("left");
  const fit = (r) => { r = r.slice(0, n); while (r.length < n) r.push(""); return r; };
  return { head, aligns: aligns.slice(0, n), rows: lines.slice(2).map((l) => fit(splitRow(l))) };
}

function serializeTable(m) {
  const row = (cells) => "| " + cells.join(" | ") + " |";
  const del = m.aligns.map((a) => (a === "center" ? ":---:" : a === "right" ? "---:" : "---"));
  return [row(m.head), row(del), ...m.rows.map(row)].join("\n");
}

const cleanCell = (t) => t.replace(/\n/g, " ").replace(/(?<!\\)\|/g, "\\|").trim();
export const focusTableCellOnCreate = (r, c) => { pendingFocus = { r, c }; };
let selectAll = false;     // foco vindo do teclado: marca o texto da célula inteira
let pendingFocus = null; // { r, c } a focar quando o widget novo for criado

class TableWidget extends WidgetType {
  constructor(text) { super(); this.text = text; }
  eq(o) { return o.text === this.text; }
  toDOM(view) {
    const model = parseTable(this.text);
    const wrap = document.createElement("div");
    wrap.className = "cm-table-wrap";
    const bar = document.createElement("div");
    bar.className = "cm-table-bar";
    const t = document.createElement("table");
    wrap.append(bar, t);
    let active = { r: 0, c: 0 };
    const text = this.text;

    const commit = (m) => {
      const from = view.posAtDOM(wrap);
      if (view.state.doc.sliceString(from, from + text.length) !== text) return;
      view.dispatch({ changes: { from, to: from + text.length, insert: serializeTable(m) } });
    };
    const focusCell = (r, c) => wrap.querySelector(`[data-r="${r}"][data-c="${c}"]`)?.focus();
    // a célula antiga grava ao perder o foco e o widget é recriado: pede para refocar a nova
    const goCell = (r, c) => {
      pendingFocus = { r, c };
      setTimeout(() => { if (pendingFocus && pendingFocus.r === r && pendingFocus.c === c) pendingFocus = null; }, 100);
      selectAll = true;
      focusCell(r, c);
      selectAll = false;
    };
    const leave = () => { const pos = view.posAtDOM(wrap); view.focus(); view.dispatch({ selection: { anchor: Math.max(0, pos - 1) } }); };
    const addRow = (at) => { const m = structuredClone(model); m.rows.splice(at, 0, m.head.map(() => "")); pendingFocus = { r: at, c: active.c }; commit(m); };

    const cells = [];
    const mk = (tag, raw, r, c) => {
      const el = document.createElement(tag);
      el.dataset.r = r; el.dataset.c = c;
      el.style.textAlign = model.aligns[c] || "left";
      el.contentEditable = "plaintext-only";
      el.spellcheck = false;
      el.innerHTML = inlineMd(raw);
      el.addEventListener("mousedown", (e) => {
        const w = e.target.closest?.(".cm-wikilink");
        if (w && (e.ctrlKey || e.metaKey)) { e.preventDefault(); wrap.dispatchEvent(new CustomEvent("cm-open-link", { bubbles: true, detail: w.dataset.target })); }
      });
      el.addEventListener("focus", () => {
        active = { r, c }; el.textContent = raw;
        if (selectAll || /^Coluna( \d+)?$/.test(raw.trim())) { selectAll = false; const s = getSelection(), g = document.createRange(); g.selectNodeContents(el); s.removeAllRanges(); s.addRange(g); } // texto-modelo: digitar substitui
      });
      el.addEventListener("blur", () => {
        const v = cleanCell(el.textContent);
        if (v === raw.trim()) { el.innerHTML = inlineMd(raw); return; }
        const m = structuredClone(model);
        (r < 0 ? m.head : m.rows[r])[c] = v;
        commit(m);
      });
      el.addEventListener("keydown", (e) => {
        e.stopPropagation();
        const last = { r: model.rows.length - 1, c: model.head.length - 1 };
        const step = (r, c) => { e.preventDefault(); goCell(r, c); };
        if (e.key === "Tab") {
          const f = e.shiftKey ? -1 : 1;
          let i = (r + 1) * model.head.length + c + f; // r=-1 → linha 0
          const total = (model.rows.length + 1) * model.head.length;
          if (i < 0) return e.preventDefault();
          if (i >= total) { e.preventDefault(); el.blur(); return addRow(model.rows.length); }
          step(Math.floor(i / model.head.length) - 1, i % model.head.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (r === last.r) { el.blur(); addRow(model.rows.length); } else goCell(r + 1, c);
        } else if (e.key === "ArrowUp" && !e.shiftKey && r > -1) { step(r - 1, c);
        } else if (e.key === "ArrowDown" && !e.shiftKey && r < last.r) { step(r + 1, c);
        } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.shiftKey && !e.altKey) {
          const s = getSelection(), len = el.textContent.length;
          if (!s.isCollapsed) return; // texto marcado: ← vai ao início e → ao fim (comportamento padrão)
          const off = s.anchorOffset;
          if (e.key === "ArrowLeft" && off === 0 && c > 0) step(r, c - 1);
          else if (e.key === "ArrowRight" && off >= len && c < last.c) step(r, c + 1);
        } else if (e.key === "Escape") { e.preventDefault(); el.blur(); leave(); }
      });
      el.addEventListener("paste", (e) => { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData.getData("text/plain") || "").replace(/\s*\n\s*/g, " ")); });
      cells.push(el);
      return el;
    };

    const thead = t.createTHead().insertRow();
    model.head.forEach((h, c) => thead.append(mk("th", h, -1, c)));
    const tb = t.createTBody();
    model.rows.forEach((row, r) => { const tr = tb.insertRow(); row.forEach((v, c) => tr.append(mk("td", v, r, c))); });

    const btn = (label, title, fn) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = label; b.title = title;
      b.addEventListener("mousedown", (e) => { e.preventDefault(); fn(); });
      bar.append(b);
    };
    const edit = (fn, focus) => { const m = structuredClone(model); fn(m); if (focus) pendingFocus = focus; commit(m); };
    btn("+ Linha", "Inserir linha abaixo", () => edit((m) => m.rows.splice(active.r + 1, 0, m.head.map(() => "")), { r: active.r + 1, c: active.c }));
    btn("+ Coluna", "Inserir coluna à direita", () => edit((m) => { const c = active.c + 1; m.head.splice(c, 0, "Coluna"); m.aligns.splice(c, 0, "left"); m.rows.forEach((r) => r.splice(c, 0, "")); }, { r: active.r, c: active.c + 1 }));
    btn("− Linha", "Remover linha", () => { if (active.r >= 0 && model.rows.length) edit((m) => m.rows.splice(active.r, 1), { r: Math.max(0, Math.min(active.r, model.rows.length - 2)), c: active.c }); });
    btn("− Coluna", "Remover coluna", () => { if (model.head.length > 1) edit((m) => { m.head.splice(active.c, 1); m.aligns.splice(active.c, 1); m.rows.forEach((r) => r.splice(active.c, 1)); }, { r: active.r, c: Math.max(0, active.c - 1) }); });
    for (const [a, label] of [["left", "⇤"], ["center", "↔"], ["right", "⇥"]]) btn(label, "Alinhar coluna: " + a, () => edit((m) => { m.aligns[active.c] = a; }, { ...active }));
    btn("</>", "Ver o texto-fonte", () => { view.dispatch({ selection: { anchor: view.posAtDOM(wrap) } }); view.focus(); });

    if (pendingFocus) { const f = pendingFocus; pendingFocus = null; setTimeout(() => { selectAll = true; focusCell(f.r, f.c); selectAll = false; }, 0); }
    return wrap;
  }
  ignoreEvent() { return true; }
}

/** Propriedades (frontmatter) como chips; campo vazio vira aviso "campo pendente". */
class PropsWidget extends WidgetType {
  constructor(text) { super(); this.text = text; }
  eq(o) { return o.text === this.text; }
  toDOM(view) {
    const wrap = document.createElement("div");
    wrap.className = "cm-props";
    const chip = (txt, cls = "") => { const s = document.createElement("span"); s.className = "cm-chip " + cls; s.textContent = txt; wrap.append(s); return s; };
    const items = [];
    let key = null;
    for (const raw of this.text.split("\n").slice(1, -1)) {
      const m = raw.match(/^([\w-]+):\s*(.*)$/);
      if (m) { key = m[1]; items.push([key, m[2].trim()]); }
      else if (key && /^\s*-\s+/.test(raw)) {
        const last = items[items.length - 1];
        last[1] = (last[1] ? last[1] + ", " : "") + raw.replace(/^\s*-\s+/, "").trim();
      }
    }
    for (const [k, v0] of items) {
      const v = v0.replace(/^\[|\]$/g, "").replace(/^["']|["']$/g, "").trim();
      if (!v) { chip(`${k} pendente`, "cm-chip-warn"); continue; }
      if (k === "tipo" || k === "type") { chip(v); continue; }
      if (k === "status") { const c = chip(v, "cm-chip-status"); c.dataset.status = v; continue; }
      if (v.length > 40) { chip(`${k}: ${v.slice(0, 38)}…`); continue; }
      chip(`${k}: ${v}`, "cm-chip-soft");
    }
    const b = document.createElement("button");
    b.className = "cm-props-edit"; b.textContent = "Editar";
    b.addEventListener("mousedown", (e) => { e.preventDefault(); view.dispatch({ selection: { anchor: 4 }, scrollIntoView: true }); view.focus(); });
    wrap.append(b);
    return wrap;
  }
  ignoreEvent() { return true; }
}

// ---------- decorações de bloco (StateField) ----------

function blockDecos(state) {
  const out = [];
  const fmEnd = frontmatterEnd(state.doc);
  if (fmEnd && !touches(state, 0, fmEnd)) {
    out.push(Decoration.replace({ widget: new PropsWidget(state.doc.sliceString(0, fmEnd)), block: true }).range(0, fmEnd));
  }
  syntaxTree(state).iterate({
    enter(n) {
      if (n.name === "Table" && n.from >= fmEnd && !touches(state, n.from, n.to)) {
        out.push(Decoration.replace({ widget: new TableWidget(state.doc.sliceString(n.from, n.to)), block: true }).range(n.from, n.to));
        return false;
      }
    },
  });
  return Decoration.set(out, true);
}

export const blockField = StateField.define({
  create: blockDecos,
  update(v, tr) { return tr.docChanged || tr.selection || syntaxTree(tr.state) !== syntaxTree(tr.startState) ? blockDecos(tr.state) : v; },
  provide: (f) => EditorView.decorations.from(f),
});

// ---------- decorações inline/linha (ViewPlugin) ----------

const WIKI = /(!?)\[\[([^\]\n]+)\]\]/g;

function build(view) {
  const { state } = view;
  const doc = state.doc;
  const fmEnd = frontmatterEnd(doc);
  const out = [];
  const T = (a, b) => view.hasFocus && touches(state, a, b);
  const lineDeco = (pos, cls) => out.push(Decoration.line({ class: cls }).range(doc.lineAt(pos).from));

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from, to,
      enter(n) {
        if (n.to <= fmEnd) return false;
        const name = n.name;
        let m;
        if ((m = /^ATXHeading([1-6])$/.exec(name))) {
          lineDeco(n.from, `cm-h cm-h${m[1]}`);
          return;
        }
        if (name === "HeaderMark" && n.node.parent?.name.startsWith("ATX")) {
          const hl = doc.lineAt(n.from);
          if (!T(hl.from, hl.to)) out.push(hide.range(n.from, Math.min(n.to + 1, hl.to)));
          return;
        }
        if (name === "StrongEmphasis" || name === "Emphasis" || name === "Strikethrough") {
          const cls = name === "StrongEmphasis" ? "cm-strong" : name === "Emphasis" ? "cm-em" : "cm-strike";
          out.push(Decoration.mark({ class: cls }).range(n.from, n.to));
          return;
        }
        if (name === "EmphasisMark" || name === "StrikethroughMark") {
          const p = n.node.parent;
          if (!T(p.from, p.to)) out.push(hide.range(n.from, n.to));
          return;
        }
        if (name === "InlineCode") {
          out.push(Decoration.mark({ class: "cm-icode" }).range(n.from, n.to));
          return;
        }
        if (name === "CodeMark" && n.node.parent?.name === "InlineCode") {
          const p = n.node.parent;
          if (!T(p.from, p.to)) out.push(hide.range(n.from, n.to));
          return;
        }
        if (name === "FencedCode") {
          for (let l = doc.lineAt(n.from).number; l <= doc.lineAt(n.to).number; l++) {
            out.push(Decoration.line({ class: "cm-codeblock" }).range(doc.line(l).from));
          }
          return;
        }
        if (name === "Link" || name === "Image") {
          if (/^\[![\w-]+\]$/.test(doc.sliceString(n.from, n.to))) return false; // marcador de callout: não é link
          const active = T(n.from, n.to);
          out.push(Decoration.mark({ class: "cm-mdlink" }).range(n.from, n.to));
          if (!active) {
            const c = n.node.cursor();
            if (c.firstChild()) do {
              if (c.name === "LinkMark" || c.name === "URL" || c.name === "LinkTitle") out.push(hide.range(c.from, c.to));
            } while (c.nextSibling());
          }
          return;
        }
        if (name === "HorizontalRule") {
          if (!T(n.from, n.to)) out.push(Decoration.replace({ widget: new HrWidget() }).range(n.from, n.to));
          return;
        }
        if (name === "Blockquote") {
          const first = doc.lineAt(n.from);
          const cm = CALLOUT_RE.exec(first.text);
          const l0 = first.number, l1 = doc.lineAt(n.to).number;
          if (cm) {
            const tipo = cm[1].toLowerCase();
            for (let l = l0; l <= l1; l++) {
              const ln = doc.line(l);
              out.push(Decoration.line({ class: `cm-callout cm-callout-${tipo}${l === l0 ? " cm-callout-first" : ""}${l === l1 ? " cm-callout-last" : ""}` }).range(ln.from));
              if (l > l0 && !T(ln.from, ln.to)) {
                const q = /^>\s?/.exec(ln.text);
                if (q) out.push(hide.range(ln.from, ln.from + q[0].length));
              }
            }
            if (!T(first.from, first.to)) out.push(Decoration.replace({ widget: new CalloutTitle(tipo, cm[2].trim()) }).range(first.from, first.to));
            return; // desce nos filhos: negrito, itálico, código e links dentro do callout
          }
          for (let l = l0; l <= l1; l++) lineDeco(doc.line(l).from, "cm-quote");
          return;
        }
        if (name === "QuoteMark") {
          const ln = doc.lineAt(n.from);
          if (CALLOUT_RE.test(doc.line(doc.lineAt(n.node.parent.from).number).text)) return; // callout: já tratado acima
          if (!T(ln.from, ln.to)) out.push(hide.range(n.from, Math.min(n.to + 1, ln.to)));
          return;
        }
        if (name === "ListMark" && n.node.parent?.parent?.name === "BulletList") {
          const item = n.node.parent;
          const task = item.getChild("Task");
          const ln = doc.lineAt(n.from);
          if (!T(ln.from, ln.to)) {
            const end = Math.min(n.to + 1, ln.to);
            out.push(task ? hide.range(n.from, end) : Decoration.replace({ widget: new BulletWidget() }).range(n.from, n.to));
          }
          return;
        }
        if (name === "TaskMarker") {
          const ln = doc.lineAt(n.from);
          const checked = /x/i.test(doc.sliceString(n.from, n.to));
          if (!T(ln.from, ln.to)) out.push(Decoration.replace({ widget: new CheckWidget(checked) }).range(n.from, n.to));
          if (checked) out.push(Decoration.mark({ class: "cm-done" }).range(n.to, ln.to));
          return;
        }
      },
    });

    // HTML inline mínimo: <u>, <mark>, <b>, <i>, <sub>, <sup>
    const su = doc.sliceString(from, to);
    for (const u of su.matchAll(/<(u|mark|b|i|sub|sup)(?:\s[^>]*)?>([^<\n]*)<\/\1>/g)) {
      const a = from + u.index, b = a + u[0].length;
      if (b <= fmEnd || T(a, b)) continue;
      const openLen = u[0].length - u[2].length - (u[1].length + 3);
      out.push(hide.range(a, a + openLen));
      out.push(Decoration.mark({ class: "cm-h-" + u[1] }).range(a + openLen, b - (u[1].length + 3)));
      out.push(hide.range(b - (u[1].length + 3), b));
    }

    // wikilinks e embeds (não fazem parte da gramática Markdown padrão)
    const slice = doc.sliceString(from, to);
    WIKI.lastIndex = 0;
    let m;
    while ((m = WIKI.exec(slice))) {
      const a = from + m.index, b = a + m[0].length;
      if (b <= fmEnd) continue;
      const embed = m[1] === "!";
      const inner = m[2];
      const target = inner.split("|")[0].split("#")[0].trim();
      const anchor = (inner.split("|")[0].split("#")[1] || "").trim();
      const pipe = inner.indexOf("|");
      const open = a + (embed ? 3 : 2);
      const active = T(a, b);
      if (active) {
        out.push(Decoration.mark({ class: "cm-wikilink-raw", attributes: { "data-target": target } }).range(a, b));
        continue;
      }
      if (embed) {
        const size = /^\d+$/.test(inner.split("|")[1] || "") ? Number(inner.split("|")[1]) : 0;
        out.push(Decoration.replace({ widget: new EmbedWidget(target, anchor, size) }).range(a, b));
        continue;
      }
      out.push(hide.range(a, open));
      let textFrom = open;
      if (pipe >= 0) { textFrom = open + pipe + 1; out.push(hide.range(open, textFrom)); }
      out.push(Decoration.mark({ class: embed ? "cm-embed" : "cm-wikilink", attributes: { "data-target": target } }).range(textFrom, b - 2));
      out.push(hide.range(b - 2, b));
    }
  }
  return Decoration.set(out, true);
}

export const livePreview = [
  blockField,
  ViewPlugin.fromClass(class {
    constructor(v) { this.decorations = build(v); }
    update(u) {
      if (u.docChanged || u.selectionSet || u.focusChanged || u.viewportChanged || syntaxTree(u.state) !== syntaxTree(u.startState)) this.decorations = build(u.view);
    }
  }, { decorations: (p) => p.decorations }),
];
