import { useEffect, useRef, useState } from "react";
import { FilePlus2, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { "Nova nota": FilePlus2, "Nova pasta": FolderPlus, "Renomear pasta": Pencil, "Renomear nota": Pencil, Excluir: Trash2 };

/** Pede um nome (`input`) ou confirma uma ação. `onOk(valor)` pode lançar erro de texto. */
export function EntryDialog({ title, message, initial = "", input, okLabel = "OK", danger, onOk, onClose }) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState("");
  const ref = useRef(null);
  const Icon = ICONS[title];
  useEffect(() => { ref.current?.focus(); ref.current?.select?.(); }, []);
  const submit = async () => {
    if (input && !v.trim()) return;
    try { await onOk(v.trim()); onClose(); } catch (e) { setErr(String(e)); }
  };
  const key = (e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } else if (e.key === "Enter") { e.preventDefault(); submit(); } };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label={title} onKeyDown={key} onMouseDown={(e) => e.stopPropagation()}
        className="w-[min(440px,92vw)] overflow-hidden rounded-xl border bg-background shadow-2xl">
        <div className="flex items-center gap-2.5 border-b px-4 py-3">
          {Icon && <Icon className={cn("h-4 w-4 shrink-0", danger ? "text-red-600" : "text-muted-foreground")} strokeWidth={1.8} />}
          <h2 className="flex-1 text-[15px] font-medium">{title}</h2>
          <kbd className="rounded border px-1.5 text-[11px] text-muted-foreground">Esc</kbd>
        </div>
        <div className="px-4 py-4">
          {message && <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>}
          {input && <input ref={ref} value={v} onChange={(e) => { setV(e.target.value); setErr(""); }} placeholder="Nome"
            className="h-10 w-full rounded-lg border bg-background px-3 text-[15px] outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" />}
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t bg-muted/50 px-4 py-3">
          <button onClick={onClose} className="h-8 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">Cancelar</button>
          <button ref={input ? undefined : ref} onClick={submit}
            className={cn("h-8 rounded-lg px-4 text-sm font-medium text-primary-foreground hover:opacity-90", danger ? "bg-red-600 text-white" : "bg-primary")}>{okLabel}</button>
        </div>
      </div>
    </div>
  );
}
