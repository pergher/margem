import { useEffect, useRef, useState } from "react";
import { IconChevronDown as ChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/** Botão "Ações" com menu suspenso. `itens`: [{ rotulo, fn, off, dica }]. `pequeno` acompanha a barra flutuante da nota. */
export function MenuAcoes({ itens, pequeno }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (!ref.current?.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAberto(!aberto)} aria-haspopup="menu" aria-expanded={aberto}
        className={cn("flex items-center gap-1.5 rounded-md border hover:bg-accent", pequeno ? "px-3 py-1 text-xs" : "px-3 py-2 text-sm")}>Ações<ChevronDown aria-hidden className="h-3.5 w-3.5" /></button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border bg-background p-1 shadow-lg">
          {itens.map((it) => (
            <button key={it.rotulo} role="menuitem" disabled={it.off} title={it.dica} onClick={() => { setAberto(false); it.fn(); }}
              className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent">{it.rotulo}</button>
          ))}
        </div>
      )}
    </div>
  );
}
