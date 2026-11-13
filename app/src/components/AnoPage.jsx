import { CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { PlanejarCicloDialog } from "@/components/PlanejarCicloDialog";
import { FASES, lerCiclos } from "@/lib/ciclos";
import { lerSemanas } from "@/lib/semana";
import { Estado, Carregando, Erro, Vazio } from "@/components/ui/estado";

const cor = Object.fromEntries(FASES.map((f) => [f.id, f.cor]));

function Barra({ aulas }) {
  if (!aulas.length) return <div className="mt-2 h-[5px] rounded bg-border" />;
  return (
    <div className="mt-2 flex h-[5px] gap-0.5">
      {aulas.map((a) => <span key={a.n} title={`Aula ${a.n}: ${FASES.find((f) => f.id === a.fase).nome}`} style={{ flex: 1, background: cor[a.fase] }} />)}
    </div>
  );
}

export function AnoPage({ items, onOpen, onCiclo, onRefresh }) {
  const [plan, setPlan] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => { setDados(null); Promise.all([lerCiclos(items), lerSemanas(items).catch(() => [])]).then(([c, semanas]) => setDados({ ...c, semanas })).catch((e) => setErro(String(e))); }, [items]);

  if (erro) return <Erro>Erro: {erro}</Erro>;
  if (!dados) return <Carregando>Lendo os planos…</Carregando>;
  const { anoLetivo, ciclos } = dados;
  const dialogo = plan && <PlanejarCicloDialog items={items} onClose={() => setPlan(false)} onCriado={(p) => { setPlan(false); onRefresh?.(); onOpen?.(p); }} />;
  if (!ciclos.length) return <><Vazio titulo="Nenhum plano de ciclo ainda" acao={{ rotulo: "Planejar ciclo", onClick: () => setPlan(true) }}>Os planos ficam em Anos/AAAA/Planejamento. Crie o primeiro para ver o ano aqui.</Vazio>{dialogo}</>;
  const anos = [...new Set(ciclos.map((c) => c.ano))];
  // Progresso vem das notas de semana (✓ = aula dada); só ciclos ligados a uma turma têm situação.
  const progresso = (c) => {
    const nome = c.name.toLowerCase(), por = {};
    for (const sm of dados.semanas ?? []) for (const t of sm.turmas) {
      if (t.cicloNome?.toLowerCase() === nome) por[t.turma] ??= { dadas: new Set(), total: c.aulas.length };
      for (const a of t.aulas) if (a.cicloNome?.toLowerCase() === nome && a.cicloN) {
      const x = (por[t.turma] ??= { dadas: new Set(), total: c.aulas.length });
      if (a.dada) x.dadas.add(a.cicloN);
    }
    }
    return Object.entries(por).map(([turma, x]) => ({ turma, dadas: x.dadas.size, total: Math.max(x.total, c.aulas.length) }));
  };
  const situacao = (p) => !p.length ? null : p.every((x) => x.dadas >= x.total) ? "Concluído" : "Em andamento";
  const semHabilidade = ciclos.filter((c) => !c.habilidades.length);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      {dialogo}
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Planejamento {anoLetivo}</h1>
        <span className="text-xs text-muted-foreground">{ciclos.length} ciclos · posição por trimestre, sem datas; o andamento vem das aulas ✓ nas notas de semana</span>
        <div className="flex-1" /><button onClick={() => setPlan(true)} className="rounded-md border px-3 py-1 text-xs hover:bg-accent">+ Planejar ciclo</button>
      </div>

      <div className="grid gap-x-3" style={{ gridTemplateColumns: "100px repeat(3, minmax(0, 1fr))" }}>
        <div />
        {[1, 2, 3].map((t) => <div key={t} className="pb-2 pl-1.5 text-xs text-muted-foreground">{t}º trimestre</div>)}
        {anos.map((ano) => (
          <div key={ano} className="contents">
            <div className="border-t py-3.5"><div className="text-sm font-semibold">{ano}º ano</div></div>
            {[1, 2, 3].map((t) => (
              <div key={t} className="flex flex-col gap-2 border-t py-3">
                {ciclos.filter((c) => c.ano === ano && c.tri === t).map((c) => (
                  <button key={c.path} onClick={() => onCiclo(c)} title={c.name}
                    className="rounded-lg bg-muted p-2.5 text-left transition-colors hover:bg-accent">
                    <div className="text-xs font-medium leading-tight">{c.titulo}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {c.aulas.length ? `${c.aulas.length} aulas` : "sem tabela de aulas"}{c.habilidades.length ? ` · ${c.habilidades.join(", ")}` : " · sem habilidade"}
                    </div>
                    <Barra aulas={c.aulas} />
                    {situacao(progresso(c)) && (
                      <div className="mt-2 text-xs">
                        <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-white " + (situacao(progresso(c)) === "Concluído" ? "bg-ok" : "bg-primary")}>{situacao(progresso(c)) === "Concluído" && <CircleCheck aria-hidden className="h-3 w-3" />}{situacao(progresso(c))}</span>
                        <span className="ml-2 text-muted-foreground">{progresso(c).map((x) => `turma ${x.turma}: ${x.dadas} de ${x.total}`).join(" · ")}</span>
                      </div>
                    )}
                  </button>
                ))}
                {!ciclos.some((c) => c.ano === ano && c.tri === t) && <div className="rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground">A planejar</div>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <span className="text-muted-foreground">Etapas do ciclo:</span>
        {FASES.map((f) => <span key={f.id}><span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5" style={{ background: f.cor }} />{f.nome}</span>)}
      </div>

      <div className="mt-5 grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <div className="mb-1 text-xs text-muted-foreground">Ciclos sem habilidade BNCC</div>
          <div className="text-sm">{semHabilidade.length ? semHabilidade.map((c) => c.name.slice(0, 3)).join(" · ") : "Todos têm habilidade."}</div>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <div className="mb-1 text-xs text-muted-foreground">Ciclos sem título ou sem aulas</div>
          <div className="text-sm">{ciclos.filter((c) => c.vazio || !c.aulas.length).map((c) => c.name.slice(0, 3)).join(" · ") || "Nenhum."}</div>
        </div>
      </div>
    </div>
  );
}
