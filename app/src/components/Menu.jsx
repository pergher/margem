import { House, CalendarDays, CalendarRange, BookText, CircleHelp, ClipboardCheck, BookOpen, HeartPulse, Settings, Sun, Moon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const PRINCIPAL = [
  { id: "hoje", nome: "Hoje", Icone: House, dica: "O dia: próximas aulas, correção em curso e documentos recentes" },
  { id: "semana", nome: "Semana", Icone: CalendarDays, dica: "As aulas da semana, turma por turma", sub: true },
  { id: "ano", nome: "Ano e ciclos", Icone: CalendarRange, dica: "Os ciclos do ano e o andamento de cada um", sub: true },
  { id: "aulas", nome: "Aulas", Icone: BookText, dica: "Os arquivos de Acervo/Aulas" },
  { id: "questoes", nome: "Questões", Icone: CircleHelp, dica: "Bancos de questões, provas e montagem de prova" },
  { id: "correcao", nome: "Correção", Icone: ClipboardCheck, dica: "Projetos a corrigir e já corrigidos" },
];
const MAIS = [
  { id: "diario", nome: "Diário e alunos", Icone: BookOpen },
  { id: "saude", nome: "Saúde do vault", Icone: HeartPulse },
];

function Item({ item, ativo, onGo, compacto }) {
  const { id, nome, Icone, dica, sub } = item;
  return (
    <button type="button" title={compacto ? nome : dica ?? nome} aria-label={nome} aria-current={ativo === id ? "page" : undefined} onClick={() => onGo(id)}
      className={cn("flex items-center rounded-lg text-left text-sm transition-colors hover:bg-accent", compacto ? "h-10 w-10 justify-center" : sub ? "min-h-10 w-full gap-3 pl-3 pr-3" : "min-h-11 w-full gap-3 px-3", ativo === id ? "bg-accent font-semibold" : "text-foreground/80")}>
      <Icone aria-hidden className={cn("shrink-0", "h-5 w-5")} strokeWidth={1.6} />{!compacto && nome}
    </button>
  );
}

/** Menu lateral: marca, as quatro áreas de trabalho, ferramentas de apoio, configurações e tema. */
/** `compacto`: versão reduzida (só ícones), usada quando o menu é fechado com Ctrl+B. */
export function Menu({ ativo, onGo, dark, setDark, compacto }) {
  return (
    <nav aria-label="Navegação" className={cn("flex shrink-0 flex-col border-r bg-muted", compacto ? "w-14 items-center gap-1.5 py-3" : "w-60 gap-6 px-3 py-5")}>
      <button type="button" aria-label="Margem — ir para Hoje" title="Margem" onClick={() => onGo("hoje")}
        className={cn("flex items-center gap-2.5 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", compacto ? "mb-1" : "px-2")}>
        <Logo className={compacto ? "h-9 w-9 shrink-0" : "h-8 w-8 shrink-0"} />
        {!compacto && <span className="text-2xl font-semibold leading-none tracking-tight" style={{ fontFamily: "var(--f-h1)" }}>Margem</span>}
      </button>
      <div className={cn("flex flex-col gap-0.5", compacto && "items-center")}>{PRINCIPAL.filter((i) => !i.sub).map((i) => (
          <div key={i.id} className="flex flex-col gap-0.5">
            <Item item={i} ativo={ativo} onGo={onGo} compacto={compacto} />
            {i.id === "hoje" && (
              <div className={cn("flex flex-col gap-0.5", compacto ? "items-center" : "ml-[22px] border-l-2 border-foreground/15 pl-2")}>
                {PRINCIPAL.filter((s) => s.sub).map((s) => <Item key={s.id} item={s} ativo={ativo} onGo={onGo} compacto={compacto} />)}
              </div>
            )}
          </div>
        ))}</div>
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
