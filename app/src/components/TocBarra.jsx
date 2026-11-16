import { cn } from "@/lib/utils";

/** Sumário em abas na barra superior (mesmo estilo da aula): seções de 2º nível, ou o nível mais alto se não houver. */
export function TocBarra({ headings, active, onGo }) {
  const nivel = headings.some((h) => h.level === 2) ? 2 : headings.length ? Math.min(...headings.map((h) => h.level)) : 1;
  const abas = headings.map((h, i) => ({ h, i })).filter((x) => x.h.level === nivel);
  if (!abas.length) return null;
  const ativo = abas.filter((x) => x.i <= active).pop()?.i ?? -1;
  return (
    <nav aria-label="Sumário" className="flex min-w-0 items-center gap-0.5 overflow-x-auto border-l pl-3">
      <div role="tablist" aria-label="Partes do texto" className="flex gap-0.5">
        {abas.map(({ h, i }) => (
          <button key={i} role="tab" aria-selected={ativo === i} title={h.title} onClick={() => onGo(h.pos, i)}
            className={cn("h-7 shrink-0 whitespace-nowrap rounded-md px-2.5 text-xs", ativo === i ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{h.title}</button>
        ))}
      </div>
    </nav>
  );
}
