import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState, Text, Compartment, Prec } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { menuBarra } from "@/lib/menuBarra";
import { livePreview, gutterAlinhado, frontmatterEnd as fmEnd, focusTableCellOnCreate, navegacaoBlocos, navegacaoEntreEditores, tituloExt } from "@/lib/livePreview";

// `numeros`: mostra a numeração das linhas; `linhaInicial`: número da linha em que o texto começa no arquivo (seções de uma aula).
const gutter = (numeros, linhaInicial) => (numeros ? [lineNumbers({ formatNumber: (n) => String(n + linhaInicial) }), gutterAlinhado] : []);

export const Editor = forwardRef(function Editor({ onChange, onSave, onLink, numeros = false, linhaInicial = 0, titulo = "" }, ref) {
  const host = useRef(null), view = useRef(null), comp = useRef(new Compartment());
  const cb = useRef({});
  cb.current = { onChange, onSave, onLink };
  const silent = useRef(false);

  const tit = useRef(new Compartment()), tituloAtual = useRef(titulo);
  tituloAtual.current = titulo;
  const gutterAtual = useRef({ numeros, linhaInicial });
  gutterAtual.current = { numeros, linhaInicial };

  // Estado novo por nota: o histórico de desfazer começa vazio, então Ctrl+Z nunca devolve o texto de outra nota.
  const novoEstado = (doc, anchor = 0) => EditorState.create({
    doc, selection: { anchor },
    extensions: [
      history(), markdown({ extensions: [GFM] }), livePreview, menuBarra, EditorView.lineWrapping, comp.current.of(gutter(gutterAtual.current.numeros, gutterAtual.current.linhaInicial)),
      Prec.high(navegacaoBlocos), Prec.high(navegacaoEntreEditores), tit.current.of(tituloExt(tituloAtual.current)),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of((u) => { if (u.docChanged && !silent.current) cb.current.onChange(u.state.doc); }),
      EditorView.domEventHandlers({
        mousedown(e) {
          const rendered = e.target.closest?.(".cm-wikilink");
          const raw = e.target.closest?.(".cm-wikilink-raw");
          if (rendered || (raw && (e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            cb.current.onLink((rendered || raw).dataset.target, (rendered || raw).dataset.anchor || "");
            return true;
          }
        },
      }),
    ],
  });

  useEffect(() => {
    view.current = new EditorView({ parent: host.current, state: novoEstado("") });
    const h = host.current, open = (e) => cb.current.onLink(e.detail);
    h.addEventListener("cm-open-link", open);
    return () => { h.removeEventListener("cm-open-link", open); view.current.destroy(); };
  }, []);

  useEffect(() => { view.current?.dispatch({ effects: comp.current.reconfigure(gutter(numeros, linhaInicial)) }); }, [numeros, linhaInicial]);

  useEffect(() => { view.current?.dispatch({ effects: tit.current.reconfigure(tituloExt(titulo)) }); }, [titulo]);

  useImperativeHandle(ref, () => ({
    getText: () => view.current.state.doc.toString(),
    setText: (t, rolar = true) => {
      const fm = fmEnd(Text.of(t.split("\n")));
      silent.current = true;
      view.current.setState(novoEstado(t, fm ? Math.min(fm + 1, t.length) : 0));
      silent.current = false;
      if (rolar) view.current.dispatch({ scrollIntoView: true }); // editores de seção (página única) não rolam a página ao montar
      view.current.contentDOM.blur(); // sem foco, nada fica com a fonte aberta ao abrir a nota
    },
    /** Troca o texto mudando só o trecho diferente; segue o fluxo normal (onChange, desfazer). */
    replaceDoc: (t) => {
      const v = view.current, old = v.state.doc.toString();
      let a = 0; while (a < old.length && a < t.length && old[a] === t[a]) a++;
      let b = 0; while (b < old.length - a && b < t.length - a && old[old.length - 1 - b] === t[t.length - 1 - b]) b++;
      v.dispatch({ changes: { from: a, to: old.length - b, insert: t.slice(a, t.length - b) } });
    },
    insertTable: () => {
      const v = view.current, st = v.state, line = st.doc.lineAt(st.selection.main.head);
      const tbl = "| Coluna 1 | Coluna 2 | Coluna 3 |\n| --- | --- | --- |\n|  |  |  |";
      const pre = line.text.trim() ? "\n\n" : line.from > 0 && st.doc.lineAt(line.from - 1).text.trim() ? "\n" : "";
      const ins = pre + tbl + "\n\n";
      const from = line.text.trim() ? line.to : line.from, to = line.text.trim() ? line.to : line.to;
      focusTableCellOnCreate(-1, 0);
      v.dispatch({ changes: { from, to, insert: ins }, selection: { anchor: from + ins.length } });
    },
    posNoTopo: (y) => { const v = view.current, r = v.contentDOM.getBoundingClientRect(); return v.posAtCoords({ x: r.left + 20, y }, false); },
    focus: () => view.current.focus(),
    goTo: (pos) => { view.current.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 24 }) }); view.current.focus(); },
    remeasure: () => view.current.requestMeasure(),
  }));

  return <div ref={host} className="h-full" />;
});
