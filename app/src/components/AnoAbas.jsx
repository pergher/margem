import { useEffect, useState } from "react";
import { SemanaPage } from "@/components/SemanaPage";
import { AnoPage } from "@/components/AnoPage";
import { CorrecoesPage } from "@/components/CorrecoesPage";
import { CorrecaoPage } from "@/components/CorrecaoPage";
import { DiarioPage } from "@/components/DiarioPage";
import { FechamentoPage } from "@/components/FechamentoPage";
import { lerTurmas } from "@/lib/turmas";
import { lerSemanas } from "@/lib/semana";
import { corTurma } from "@/lib/cores";
import { store } from "@/lib/store";
import { cn } from "@/lib/utils";

export const ABAS_ANO = [
  { id: "semana", nome: "Semana", dica: "As aulas da semana, turma por turma" },
  { id: "plano", nome: "Planejamento", dica: "Os ciclos do ano, por trimestre" },
  { id: "prod", nome: "Produções", dica: "Produções dos alunos: a corrigir e já corrigidas" },
  { id: "diario", nome: "Diário", dica: "Diário de classe e notas de alunos" },
  { id: "fechamento", nome: "Fechamento", dica: "O que falta para fechar o trimestre" },
];

/**
 * Ano: tudo o que tem data ou turma, numa página só, em abas (Semana, Planejamento, Produções, Diário e Fechamento).
 * Cada aba mostra a tela que antes era separada. Na correção de um lote (tela cheia) as abas somem até voltar.
 */
/** Turmas do ano corrente: as do arquivo "Turmas AAAA"; sem ele, as que aparecem nas notas de semana. */
function useTurmas(items) {
  const [turmas, setTurmas] = useState([]);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const cfg = await lerTurmas(items, String(new Date().getFullYear())).catch(() => ({ turmas: [] }));
      const doAno = cfg.turmas.length ? cfg.turmas : [...new Set((await lerSemanas(items).catch(() => [])).flatMap((s) => s.turmas.map((t) => t.turma)))].sort();
      if (vivo) setTurmas(doAno);
    })();
    return () => { vivo = false; };
  }, [items]);
  return turmas;
}

export function AnoAbas({ aba, setAba, items, onOpen, onRefresh, onCiclo, onMarkdown, onRename, onDelete, correcao }) {
  const { foco, vista, corrigir, turma, voltar } = correcao;
  const turmas = useTurmas(items);
  const [filtro, setFiltroState] = useState(() => store.get("anoTurma", "")); // "" = todas as turmas
  const setFiltro = (t) => { setFiltroState(t); store.set("anoTurma", t); };
  const turmaGlobal = turmas.includes(filtro) ? filtro : ""; // turma que deixou de existir volta para "Todas"
  if (aba === "prod" && foco) return <div className="flex min-h-0 flex-1 flex-col"><CorrecaoPage items={items} onOpen={onOpen} focoPath={foco} vistaInicial={vista} onVoltar={voltar} /></div>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-stretch gap-x-6 gap-y-2 border-b px-8">
        <div role="tablist" aria-label="Seções do ano" className="flex gap-1 overflow-x-auto">
          {ABAS_ANO.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} title={a.dica} onClick={() => setAba(a.id)}
              className={cn("whitespace-nowrap border-b-[3px] px-5 py-3 text-base transition-colors hover:text-foreground", aba === a.id ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground")}>{a.nome}</button>
          ))}
        </div>
        {turmas.length > 1 && (
          <div role="group" aria-label="Turma" className="ml-auto flex flex-wrap items-center justify-end gap-2 self-center py-2">
            <span className="text-sm text-muted-foreground">Turma</span>
            {[{ t: "", nome: "Todas" }, ...turmas.map((t) => ({ t, nome: t }))].map((o) => (
              <button key={o.t} type="button" aria-pressed={turmaGlobal === o.t} title={o.t ? `Só a turma ${o.t}` : "Todas as turmas"} onClick={() => setFiltro(o.t)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-sm", turmaGlobal === o.t ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                {o.t && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: corTurma(o.t) }} />}{o.nome}
              </button>
            ))}
          </div>
        )}
      </div>
      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
        {aba === "semana" && <SemanaPage items={items} onOpen={onOpen} onRefresh={onRefresh} turmaGlobal={turmaGlobal} />}
        {aba === "plano" && <AnoPage items={items} onOpen={onOpen} onRefresh={onRefresh} onCiclo={onCiclo} turmaGlobal={turmaGlobal} />}
        {aba === "prod" && <CorrecoesPage items={items} turmasAno={turmas} onRefresh={onRefresh} onCorrigir={corrigir} onTurma={turma} onOpen={onOpen} onRename={onRename} onDelete={onDelete} turmaGlobal={turmaGlobal} />}
        {aba === "fechamento" && <FechamentoPage items={items} onOpen={onOpen} onCorrigir={(p) => { corrigir(p); setAba("prod"); }} onDiario={() => setAba("diario")} onRefresh={onRefresh} turmaGlobal={turmaGlobal} />}
        {aba === "diario" && <DiarioPage items={items} onOpen={onOpen} onMarkdown={onMarkdown} onRefresh={onRefresh} turmaGlobal={turmaGlobal} />}
      </div>
    </div>
  );
}
