import { IconHome as House, IconCalendarWeek as CalendarRange, IconLibrary as Library, IconHeartbeat as HeartPulse, IconSettings as Settings, IconBook as BookText, IconBookmarks as BookMarked, IconQuote as Quote, IconRepeat as Repeat2, IconCalendarEvent as CalendarEvent, IconTimeline as Timeline, IconClipboardCheck as ClipboardCheck, IconNotebook as Notebook, IconSun as Sun, IconMoon as Moon } from "@tabler/icons-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const PRINCIPAL = [
  { id: "hoje", nome: "Hoje", Icone: House, dica: "O dia: próximas aulas, correção em curso e documentos recentes" },
  { id: "documentos", nome: "Documentos", Icone: Library, dica: "Toda a pasta Acervo: aulas, gramática, textos, questões, oficinas…" },
  { id: "ano", nome: "Ano", Icone: CalendarRange, dica: "Semana, planejamento, produções e diário" },
];
// Atalhos sob Documentos (já filtrados por tipo) e sob Ano (abrem na aba escolhida).
const SUBS = {
  documentos: [
    { id: "documentos:aula", nome: "Aulas", Icone: BookText, dica: "Documentos, só aulas", sub: true },
    { id: "documentos:gramatica", nome: "Gramática", Icone: BookMarked, dica: "Documentos, só gramática", sub: true },
    { id: "documentos:texto", nome: "Textos", Icone: Quote, dica: "Documentos, só textos", sub: true },
    { id: "documentos:ciclo", nome: "Ciclos", Icone: Repeat2, dica: "Documentos, só ciclos", sub: true },
  ],
  ano: [
    { id: "ano:semana", nome: "Semana", Icone: CalendarEvent, dica: "Ano: as aulas da semana", sub: true },
    { id: "ano:plano", nome: "Planejamento", Icone: Timeline, dica: "Ano: os ciclos por trimestre", sub: true },
    { id: "ano:prod", nome: "Produções", Icone: ClipboardCheck, dica: "Ano: produções a corrigir e corrigidas", sub: true },
    { id: "ano:diario", nome: "Diário", Icone: Notebook, dica: "Ano: diário de classe", sub: true },
  ],
};
const MAIS = [
  { id: "saude", nome: "Saúde do vault", Icone: HeartPulse },
];

function Item({ item, ativo, onGo, compacto }) {
  const { id, nome, Icone, dica, sub } = item;
  return (
    <button type="button" title={compacto ? nome : dica ?? nome} aria-label={nome} aria-current={ativo === id ? "page" : undefined} onClick={() => onGo(id)}
      className={cn("flex items-center rounded-lg text-left text-sm transition-colors hover:bg-accent", compacto ? (sub ? "h-9 w-10 justify-center" : "h-10 w-10 justify-center") : sub ? "min-h-9 w-full gap-3 pl-9 pr-3" : "min-h-11 w-full gap-3 px-3", ativo === id ? "bg-accent font-semibold" : "text-foreground/80")}>
      <Icone aria-hidden className={cn("shrink-0", sub ? "h-4 w-4" : "h-5 w-5")} strokeWidth={1.6} />{!compacto && nome}
    </button>
  );
}

/** Menu lateral: marca, as três áreas de trabalho (Hoje, Documentos e Ano), ferramentas de apoio, configurações e tema. */
/** `compacto`: versão reduzida (só ícones), usada quando o menu é fechado com Ctrl+B. */
export function Menu({ ativo, onGo, dark, setDark, compacto }) {
  return (
    <nav aria-label="Navegação" className={cn("flex shrink-0 flex-col border-r bg-muted", compacto ? "w-14 items-center gap-1.5 py-3" : "w-60 gap-6 px-3 py-5")}>
      <button type="button" aria-label="Margem — ir para Hoje" title="Margem" onClick={() => onGo("hoje")}
        className={cn("flex items-center gap-2.5 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", compacto ? "mb-1" : "px-2")}>
        <Logo className={compacto ? "h-9 w-9 shrink-0" : "h-8 w-8 shrink-0"} />
        {!compacto && <span className="text-2xl font-semibold leading-none tracking-tight" style={{ fontFamily: "var(--f-h1)" }}>Margem</span>}
      </button>
      <div className={cn("flex flex-col gap-0.5", compacto && "items-center")}>{PRINCIPAL.flatMap((i) => [<Item key={i.id} item={i} ativo={ativo} onGo={onGo} compacto={compacto} />, ...(SUBS[i.id] ? SUBS[i.id].map((s) => <Item key={s.id} item={s} ativo={ativo} onGo={onGo} compacto={compacto} />) : [])])}</div>
      <div className={cn("flex flex-col gap-0.5", compacto && "items-center border-t pt-1.5")}>
        {!compacto && <span className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mais</span>}
        {MAIS.map((i) => <Item key={i.id} item={i} ativo={ativo} onGo={onGo} compacto={compacto} />)}
      </div>
      <div className={cn("mt-auto flex flex-col gap-0.5", compacto && "items-center")}>
        <Item item={{ id: "config", nome: "Configurações", Icone: Settings }} ativo={ativo} onGo={onGo} compacto={compacto} />
        <button type="button" title={dark ? "Tema claro" : "Tema escuro"} aria-label={dark ? "Tema claro" : "Tema escuro"} onClick={() => setDark(!dark)} className={cn("flex items-center rounded-lg text-left text-sm text-foreground/80 transition-colors hover:bg-accent", compacto ? "h-10 w-10 justify-center" : "min-h-11 w-full gap-3 px-3")}>
          {dark ? <Sun aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.6} /> : <Moon aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.6} />}
          {!compacto && (dark ? "Tema claro" : "Tema escuro")}
        </button>
      </div>
    </nav>
  );
}
