import { useState } from "react";
import { IconInbox as Caixa } from "@tabler/icons-react";
import { gravarCaixa, acrescentar } from "@/lib/caixa";

/** Captura rápida: uma linha, Enter guarda na Caixa de entrada (arquivo .md) e fecha. */
export function CapturaDialog({ items, onClose, onGuardada, onErro }) {
  const [texto, setTexto] = useState("");
  const [gravando, setGravando] = useState(false);
  const guardar = async () => {
    if (!texto.trim() || gravando) return;
    setGravando(true);
    try { await gravarCaixa(items, (t) => acrescentar(t, texto)); onGuardada?.(); onClose(); }
    catch (e) { onErro?.(e); setGravando(false); }
  };
  const key = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); guardar(); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[18vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Captura rápida" className="w-[min(560px,92vw)] overflow-hidden rounded-xl border bg-background shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4">
          <Caixa aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={key} disabled={gravando}
            placeholder="Anotar na Caixa de entrada…" aria-label="Texto da anotação"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <kbd className="rounded border px-1.5 text-xs text-muted-foreground">Enter</kbd>
        </div>
      </div>
    </div>
  );
}
