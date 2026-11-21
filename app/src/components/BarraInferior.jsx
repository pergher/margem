import { IconHome as House, IconLibrary as Library, IconCalendarWeek as CalendarRange } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const ABAS = [
  { id: "hoje", nome: "Hoje", Icone: House },
  { id: "documentos", nome: "Documentos", Icone: Library },
  { id: "ano", nome: "Semana", Icone: CalendarRange },
];

/** Barra inferior do modo compacto: as três áreas de trabalho, com alvos de toque de 44 px ou mais. */
export function BarraInferior({ ativo, onGo }) {
  const area = String(ativo ?? "").split(":")[0];
  return (
    <nav aria-label="Navegação" className="flex shrink-0 border-t bg-muted" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}>
      {ABAS.map(({ id, nome, Icone }) => (
        <button key={id} type="button" aria-current={area === id ? "page" : undefined} onClick={() => onGo(id)}
          className={cn("flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors", area === id ? "font-semibold text-primary" : "text-foreground/70")}>
          <Icone aria-hidden className="h-6 w-6" strokeWidth={1.6} />{nome}
        </button>
      ))}
    </nav>
  );
}
