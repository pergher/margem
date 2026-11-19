import { useEffect, useMemo, useRef, useState } from "react";
import { IconCommand as Command, IconFileText as FileText } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useEhCompacto } from "@/lib/useCompacto";

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Paleta de comandos: `commands` = [{ id, label, hint?, keys?, run }]; notas aparecem quando há texto. */
export function CommandPalette({ commands, items, onOpenNote, onClose }) {
  const compacto = useEhCompacto();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const list = useRef(null);

  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    const cmds = commands
      .filter((c) => terms.every((t) => norm(c.label + " " + (c.hint || "")).includes(t)))
      .map((c) => ({ type: "cmd", c, score: norm(c.label).startsWith(terms[0] || "") ? 0 : 1 }))
      .sort((a, b) => a.score - b.score);
    const notes = terms.length
      ? items.filter((it) => terms.every((t) => norm(it.rel).includes(t)))
          .map((it) => ({ type: "note", it, score: terms.every((t) => norm(it.name).includes(t)) ? 0 : 1 }))
          .sort((a, b) => a.score - b.score || a.it.name.localeCompare(b.it.name, "pt-BR", { numeric: true }))
          .slice(0, 12)
      : [];
    return [...cmds, ...notes];
  }, [q, commands, items]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => { list.current?.children[idx]?.scrollIntoView({ block: "nearest" }); }, [idx]);

  const exec = (r) => { onClose(); r.type === "cmd" ? r.c.run() : onOpenNote(r.it.path); };
  const key = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[idx]) { e.preventDefault(); exec(results[idx]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Paleta de comandos" className="w-[min(640px,92vw)] overflow-hidden rounded-xl border bg-background shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-4">
          <Command className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="Digite um comando ou nome de arquivo…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <kbd className="rounded border px-1.5 text-xs text-muted-foreground">Esc</kbd>
        </div>
        <div ref={list} className="max-h-[50vh] overflow-auto p-1.5">
          {results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nada encontrado.</p>}
          {results.map((r, i) => (
            <button key={r.type + (r.c?.id ?? r.it.path)} onClick={() => exec(r)} onMouseMove={() => setIdx(i)}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left", i === idx && "bg-accent")}>
              {r.type === "cmd" ? <Command className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate text-sm">{r.type === "cmd" ? r.c.label : r.it.name}</span>
              <span className="ml-auto max-w-[40%] truncate pl-3 text-xs text-muted-foreground">
                {r.type === "cmd" ? (compacto ? "" : r.c.keys) : r.it.rel.split("/").slice(0, -1).join(" / ")}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
