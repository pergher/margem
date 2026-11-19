import { IconChevronDown as Chevron } from "@tabler/icons-react";

/** Bloco recolhido por padrão (modo compacto). O título próprio do conteúdo (h2) fica escondido: o resumo já o mostra. */
export function Recolhivel({ titulo, children }) {
  return (
    <details className="group rounded-xl border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
        {titulo}<Chevron aria-hidden className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3 [&_h2]:hidden">{children}</div>
    </details>
  );
}
