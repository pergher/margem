import { useState } from "react";
import { turmasDeTexto } from "@/lib/turmas";

/** Primeira vez: pede as turmas do ano (grava `Anos/AAAA/Turmas AAAA.md`). Usada na Semana e no Planejamento quando ainda não há turmas. */
export function DefinirTurmas({ ano, onOk, children }) {
  const [txt, setTxt] = useState("");
  const lista = turmasDeTexto(txt);
  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <h1 className="font-serif text-3xl font-semibold">Quais são as suas turmas em {ano}?</h1>
      <p className="mt-2 max-w-xl text-xs text-muted-foreground">{children} Você pode mudar isso depois em Configurações → Turmas do ano.</p>
      <div className="mt-4 flex items-center gap-2">
        <input autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lista.length && onOk(lista)} placeholder="ex.: 61, 62, 71, 81" aria-label="Turmas do ano" className="w-72 rounded-md border bg-background px-3 py-1.5 text-sm" />
        <button disabled={!lista.length} onClick={() => onOk(lista)} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-40">Salvar</button>
      </div>
    </div>
  );
}
