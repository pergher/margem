import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Text } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { livePreview, frontmatterEnd as fmEnd, focusTableCellOnCreate } from "@/lib/livePreview";

export const Editor = forwardRef(function Editor({ onChange, onSave, onLink }, ref) {
  const host = useRef(null), view = useRef(null);
  const cb = useRef({});
  cb.current = { onChange, onSave, onLink };
  const silent = useRef(false);

  useEffect(() => {
    view.current = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: "",
        extensions: [
          history(), markdown({ extensions: [GFM] }), livePreview, EditorView.lineWrapping,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((u) => { if (u.docChanged && !silent.current) cb.current.onChange(u.state.doc); }),
          EditorView.domEventHandlers({
            mousedown(e) {
              const rendered = e.target.closest?.(".cm-wikilink");
              const raw = e.target.closest?.(".cm-wikilink-raw");
              if (rendered || (raw && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                cb.current.onLink((rendered || raw).dataset.target);
                return true;
              }
            },
          }),
        ],
      }),
    });
    const h = host.current, open = (e) => cb.current.onLink(e.detail);
    h.addEventListener("cm-open-link", open);
    return () => { h.removeEventListener("cm-open-link", open); view.current.destroy(); };
  }, []);

  useImperativeHandle(ref, () => ({
    getText: () => view.current.state.doc.toString(),
    setText: (t) => {
      silent.current = true;
      view.current.dispatch({ changes: { from: 0, to: view.current.state.doc.length, insert: t }, selection: { anchor: fmEnd(Text.of(t.split("\n"))) ? Math.min(fmEnd(Text.of(t.split("\n"))) + 1, t.length) : 0 }, scrollIntoView: true });
      silent.current = false;
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
    focus: () => view.current.focus(),
    goTo: (pos) => { view.current.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 24 }) }); view.current.focus(); },
    remeasure: () => view.current.requestMeasure(),
  }));

  return <div ref={host} className="h-full" />;
});
