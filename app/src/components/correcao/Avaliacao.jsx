import { IconChevronRight as ChevronRight } from "@tabler/icons-react";
import { Estado } from "@/components/ui/estado";
import { devolutiva, opcoesDe, fmt, num } from "@/lib/correcao";
import { CAB } from "./estilos";
import { Inline } from "./Inline";
import { Rating } from "./Rating";
import { baixar } from "./baixar";

export function Avaliacao({ largura, d, a, est, abertos, alternar, setCrit, mudarNota, copiar, nomeArq }) {
  return (
        <section aria-label="Avaliação" style={{ width: largura, minWidth: 280 }} className="flex shrink flex-col">
          <div className={CAB + " gap-x-3"}><span className="flex-1 font-semibold">Avaliação</span>
            <button onClick={() => copiar(devolutiva(d, a))} className="text-xs font-normal text-primary hover:underline">copiar devolutiva</button>
            <button onClick={() => baixar(nomeArq(a), devolutiva(d, a))} className="text-xs font-normal text-primary hover:underline">baixar</button></div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-auto px-3 py-2">
            {a.criterios.map((c, ci) => {
              const aberto = abertos.has(c.nome), temCom = !!c.comentario?.trim();
              return (
                <li key={c.nome} onClick={() => setCrit(ci)} className="rounded-lg px-2 py-2.5 hover:bg-accent/60">
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setCrit(ci); alternar(c.nome); }} aria-expanded={aberto} disabled={!temCom}
                      title={temCom ? (aberto ? "Ocultar o comentário" : "Ver o comentário") : "Sem comentário"}
                      className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium hover:bg-transparent disabled:cursor-default">
                      <ChevronRight aria-hidden className={"h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform " + (aberto ? "rotate-90 " : "") + (temCom ? "" : "opacity-0")} />
                      <span className="truncate">{c.nome}</span>
                    </button>
                    <Rating nome={c.nome} valor={num(c.nota)} opcoes={opcoesDe(d, c.nome)} onChange={(v) => mudarNota(c, v)} />
                  </div>
                  {aberto && temCom && <div className="mb-1 ml-[18px] mt-2.5 text-sm leading-relaxed text-foreground/85"><Inline s={c.comentario} /></div>}
                </li>
              );
            })}
          </ul>
          <div className="shrink-0 border-t bg-muted p-4">
            <div className="flex items-baseline justify-between"><span className="text-sm font-semibold">Nota final</span><span className="font-serif text-2xl font-semibold">{fmt(a.total)} <span className="text-sm font-normal text-muted-foreground">de {fmt(est.maximo)}</span></span></div>
            {est.divergentes.includes(a.n) && <Estado tipo="warn" className="mt-1 text-xs">A “Nota final” do arquivo ({a.final}) difere da soma dos critérios.</Estado>}
          </div>
        </section>
  );
}
