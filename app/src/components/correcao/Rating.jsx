import { fmt } from "@/lib/correcao";

/** Nota por critério: uma fileira de níveis (0, 0,5, 1…); o escolhido fica preenchido; clicar nele de novo zera. */
export function Rating({ nome, valor, opcoes, onChange }) {
  const min = opcoes[0] ?? 0, max = opcoes[opcoes.length - 1] ?? 1;
  // vermelho (mínimo) → verde (máximo), pelo matiz
  const cor = (o) => `hsl(${Math.round(((o - min) / ((max - min) || 1)) * 125)} 50% 36%)`;
  return (
    <div role="radiogroup" aria-label={`Nota de ${nome}`} onClick={(e) => e.stopPropagation()} className="flex h-7 shrink-0 overflow-hidden rounded-md border bg-background">
      {opcoes.map((o) => {
        const on = valor === o;
        return (
          <button key={o} role="radio" aria-checked={on} onClick={() => onChange(on ? min : o)} style={on ? { background: cor(o) } : undefined}
            className={"min-w-8 border-r px-1.5 text-xs tabular-nums last:border-r-0 " + (on ? "font-medium text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
            {fmt(o)}
          </button>
        );
      })}
    </div>
  );
}
