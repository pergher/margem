// Barra no topo da nota enquanto uma proposta da IA está em revisão (os trechos aparecem dentro da nota, ver lib/revisao.js).
import { cn } from "@/lib/utils";

export function BarraRevisao({ resumo, r, onIr, onAceitarTudo, onRecusarTudo, onModo, onSair }) {
  const bt = "h-7 rounded-md px-2.5 text-xs hover:bg-accent";
  return (
    <div role="region" aria-label="Revisão da proposta da IA" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-primary/5 px-6 py-1.5 text-sm">
      <span className="font-medium">Proposta da IA</span>
      {resumo && <span className="hidden min-w-0 max-w-[28ch] truncate text-xs text-muted-foreground lg:inline" title={resumo}>{resumo}</span>}
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <button aria-label="Alteração anterior" onClick={() => onIr(-1)} className="rounded px-1.5 hover:bg-accent">‹</button>
        {r.atual + 1} de {r.restantes}
        <button aria-label="Próxima alteração" onClick={() => onIr(1)} className="rounded px-1.5 hover:bg-accent">›</button>
      </span>
      <span className="flex-1" />
      <span role="radiogroup" aria-label="Como mostrar as alterações" className="flex overflow-hidden rounded-md border text-xs">
        {[["renderizado", "Renderizado"], ["codigo", "Código"]].map(([id, nome]) => (
          <button key={id} role="radio" aria-checked={r.modo === id} onClick={() => onModo(id)} className={cn("h-7 px-2.5", r.modo === id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60")}>{nome}</button>
        ))}
      </span>
      <button onClick={onRecusarTudo} className={cn(bt, "text-muted-foreground")}>Recusar tudo</button>
      <button onClick={onAceitarTudo} className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90">Aceitar tudo</button>
      <button onClick={onSair} aria-label="Sair da revisão" title="Sair da revisão (a proposta continua pendente)" className="h-7 rounded px-1.5 text-muted-foreground hover:bg-accent">✕</button>
    </div>
  );
}
