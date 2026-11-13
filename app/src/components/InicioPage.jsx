import { useEffect, useState } from "react";
import { SemanaPage } from "@/components/SemanaPage";
import { AnoPage } from "@/components/AnoPage";
import { HojePage } from "@/components/HojePage";
import { listaCorrecoes, lerCorrecao, num } from "@/lib/correcao";
import { cn } from "@/lib/utils";

/** Página de trabalho diário: escolha entre a Semana e o Ano (ciclos); correções em curso sempre à vista. */
export function InicioPage({ items, onOpen, onRefresh, onCiclo, onCorrecao, modo, setModo }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b px-6 py-2">
        <div role="tablist" aria-label="O que ver" className="inline-flex rounded-full border p-0.5 text-xs">
          {[["hoje", "Hoje"], ["semana", "Semana"], ["ano", "Ano e ciclos"]].map(([id, nome]) => (
            <button key={id} role="tab" aria-selected={modo === id} onClick={() => setModo(id)}
              className={cn("rounded-full px-4 py-1.5", modo === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{nome}</button>
          ))}
        </div>
        {modo !== "hoje" && <CorrecoesEmCurso items={items} onAbrir={onCorrecao} />}
      </div>
      {modo === "hoje"
        ? <HojePage items={items} onOpen={onOpen} onCorrecao={onCorrecao} onSemana={() => setModo("semana")} />
        : modo === "semana"
        ? <SemanaPage items={items} onOpen={onOpen} onRefresh={onRefresh} />
        : <AnoPage items={items} onOpen={onOpen} onRefresh={onRefresh} onCiclo={onCiclo} />}
    </div>
  );
}

/** Lotes de correção que ainda não estão finalizados nem arquivados, em chips que levam direto ao lote. */
function CorrecoesEmCurso({ items, onAbrir }) {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    let vivo = true;
    Promise.all(listaCorrecoes(items).map((it) => lerCorrecao(it).then((d) => ({ it, d })).catch(() => null)))
      .then((r) => vivo && setLista(r.filter((x) => x && !/^(finalizado|arquivado)$/i.test(x.d.status ?? ""))));
    return () => { vivo = false; };
  }, [items]);
  if (!lista.length) return null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto text-xs">
      <span className="shrink-0 text-muted-foreground">Correções em curso</span>
      {lista.map(({ it, d }) => {
        const feitas = d.alunos.filter((a) => a.criterios.length && a.criterios.every((c) => num(c.nota) != null)).length;
        return (
          <button key={it.path} onClick={() => onAbrir(it.path)} title={`${it.pasta} — abrir a correção`} className="shrink-0 rounded-lg border px-3 py-1 text-left hover:bg-accent">
            <span className="font-medium">{d.turma ? `Turma ${d.turma.replace(/"/g, "")}` : it.pasta}</span>
            <span className="text-muted-foreground"> · {d.atividade || it.pasta} · {feitas} de {d.alunos.length} com nota{d.transcricao === "aprovada" ? "" : " · transcrição a aprovar"}</span>
          </button>
        );
      })}
    </div>
  );
}
