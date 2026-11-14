import { CircleCheck, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { PlanejarCicloDialog } from "@/components/PlanejarCicloDialog";
import { FASES, lerCiclos, incluirCicloNoAno } from "@/lib/ciclos";
import { lerSemanas } from "@/lib/semana";
import { lerTurmas } from "@/lib/turmas";
import { corTurma } from "@/lib/cores";
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

let ultimo = null; // última leitura: a tela reaparece na hora e é atualizada por baixo
function LinhaFora({ c, onCiclo, onIncluir }) {
  const [ano, setAno] = useState(6), [tri, setTri] = useState(1);
  const sel = "rounded-md border bg-background px-1.5 py-1 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5">
      <button onClick={() => onCiclo(c)} title={c.name} className="min-w-[14rem] flex-1 text-left hover:underline">
        <span className="block text-sm font-medium leading-snug">{c.titulo}</span>
        <span className="block text-xs text-muted-foreground">{c.aulas.length ? `${c.aulas.length} aulas` : "sem tabela de aulas"}{c.habilidades.length ? ` · ${c.habilidades.join(", ")}` : " · sem habilidade"}</span>
      </button>
      <span className="w-40 shrink-0"><Barra aulas={c.aulas} /></span>
      <span className="flex shrink-0 items-center gap-1.5">
        <select aria-label={`Ano escolar de ${c.titulo}`} value={ano} onChange={(e) => setAno(Number(e.target.value))} className={sel}>{[6, 7, 8, 9].map((a) => <option key={a} value={a}>{a}º ano</option>)}</select>
        <select aria-label={`Trimestre de ${c.titulo}`} value={tri} onChange={(e) => setTri(Number(e.target.value))} className={sel}>{[1, 2, 3].map((t) => <option key={t} value={t}>{t}º tri</option>)}</select>
        <button onClick={() => onIncluir({ ano, tri })} className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent">Incluir</button>
      </span>
    </div>
  );
}

export function AnoPage({ items, onOpen, onCiclo, onRefresh }) {
  const [plan, setPlan] = useState(false);
  const [dados, setDados] = useState(ultimo);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState(""); // "" = todas as turmas
  const [tick, setTick] = useState(0); // força reler depois de mexer no Planejamento
  useEffect(() => { if (!items.length) return; lerCiclos(items).then(async (c) => {
    const [semanas, cfg] = await Promise.all([lerSemanas(items).catch(() => []), lerTurmas(items, c.anoLetivo ?? String(new Date().getFullYear())).catch(() => ({ turmas: [] }))]);
    ultimo = { ...c, semanas, turmasCfg: cfg.turmas }; setDados(ultimo);
  }).catch((e) => setErro(String(e))); }, [items, tick]);

  if (erro) return <Erro>Erro: {erro}</Erro>;
  if (!dados || !items.length) return <Carregando>Lendo os planos…</Carregando>;
  const { anoLetivo, ciclos } = dados;
  const dialogo = plan && <PlanejarCicloDialog items={items} anoLetivo={anoLetivo} onClose={() => setPlan(false)} onCriado={(p) => { setPlan(false); setTick((t) => t + 1); onRefresh?.(); onOpen?.(p); }} />;
  if (!ciclos.length) return <><Vazio titulo="Nenhum plano de ciclo ainda" acao={{ rotulo: "Planejar ciclo", onClick: () => setPlan(true) }}>Os planos ficam em Anos/AAAA/Planejamento. Crie o primeiro para ver o ano aqui.</Vazio>{dialogo}</>;
  // Turmas: as do arquivo do ano; sem ele, as que aparecem nas semanas.
  const turmas = dados.turmasCfg?.length ? dados.turmasCfg : [...new Set((dados.semanas ?? []).flatMap((sm) => sm.turmas.map((t) => t.turma)))].sort();
  // Progresso vem das notas de semana (✓ = aula dada); só ciclos ligados a uma turma têm situação.
  const progresso = (c) => {
    const nome = c.name.toLowerCase(), por = {}, fora = {}; // fora: aulas descartadas por turma (saem do total)
    for (const sm of dados.semanas ?? []) for (const t of sm.turmas) {
      if (t.cicloNome?.toLowerCase() === nome) por[t.turma] ??= { dadas: new Set(), total: c.aulas.length };
      for (const a of t.aulas) if (a.cicloNome?.toLowerCase() === nome && a.cicloN) {
        const x = (por[t.turma] ??= { dadas: new Set(), total: c.aulas.length });
        if (a.dada) x.dadas.add(a.cicloN);
        if (a.situacao === "descartada") (fora[t.turma] ??= new Set()).add(a.cicloN);
      }
    }
    return Object.entries(por).map(([turma, x]) => ({ turma, dadas: x.dadas.size, total: Math.max(x.total, c.aulas.length) - (fora[turma]?.size ?? 0) }));
  };
  const situacao = (p) => !p.length ? null : p.every((x) => x.dadas >= x.total) ? "Concluído" : "Em andamento";
  // Filtro de turma: os ciclos do ano escolar da turma (61 → 6º ano) e os que ela já usa nas semanas.
  const visiveis = ciclos.filter((c) => c.incluido && (!filtro || String(c.ano) === filtro[0] || progresso(c).some((p) => p.turma === filtro)));
  const fora = ciclos.filter((c) => !c.incluido);
  const anos = [...new Set(visiveis.filter((c) => c.incluido).map((c) => c.ano))];
  const semHabilidade = ciclos.filter((c) => !c.habilidades.length);
  const semTitulo = ciclos.filter((c) => c.vazio);
  const semAulas = ciclos.filter((c) => !c.aulas.length);
  const codigos = {}; for (const c of ciclos) (codigos[`${c.ano}${c.tri}${c.ciclo}`] ??= []).push(c);
  const repetidos = Object.entries(codigos).filter(([, l]) => l.length > 1);
  const Lista = ({ lista, vazio }) => lista.length
    ? <div className="flex flex-wrap gap-1.5">{lista.map((c) => <button key={c.path} onClick={() => onCiclo(c)} title={c.name} className="rounded-md border px-2 py-0.5 text-xs hover:bg-accent">{c.incluido ? `${c.ano}${c.tri}${c.ciclo}` : c.name}</button>)}</div>
    : <div className="text-xs text-muted-foreground">{vazio}</div>;
  const Bloco = ({ titulo, children }) => <section className="border-t pt-4 first:border-t-0 first:pt-0"><h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h2>{children}</section>;

  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      {dialogo}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <header>
          <div className="text-xs text-muted-foreground">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">Planejamento {anoLetivo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ciclos.length - fora.length} ciclos no ano{fora.length > 0 && ` · ${fora.length} fora de um ano`} · posição por trimestre, sem datas; o andamento vem das aulas ✓ nas notas de semana</p>
        </header>
        <div className="flex-1" /><button onClick={() => setPlan(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />Planejar ciclo</button>
      </div>

      {turmas.length > 1 && (
        <div role="group" aria-label="Filtrar por turma" className="mb-6 flex flex-wrap items-center gap-1.5">
          {[{ turma: "", nome: "Todas" }, ...turmas.map((t) => ({ turma: t, nome: `Turma ${t}` }))].map((o) => (
            <button key={o.turma} type="button" aria-pressed={filtro === o.turma} onClick={() => setFiltro(o.turma)}
              className={"inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm " + (filtro === o.turma ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              {o.turma && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: corTurma(o.turma) }} />}{o.nome}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {!visiveis.length && !fora.length && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum ciclo para a turma {filtro}.</div>}
          {anos.map((ano) => (
            <section key={ano} className="rounded-xl border bg-background p-4">
              <h2 className="mb-1 font-serif text-xl font-semibold">{ano}º ano</h2>
              {[1, 2, 3].map((t) => {
                const lista = visiveis.filter((c) => c.ano === ano && c.tri === t);
                return (
                  <div key={t} className="border-t first:border-t-0">
                    <div className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t}º trimestre</div>
                    <div className="flex flex-col divide-y">
                      {lista.map((c) => {
                        const prog = progresso(c).filter((x) => !filtro || x.turma === filtro), sit = situacao(prog);
                        return (
                          <button key={c.path} onClick={() => onCiclo(c)} title={c.name} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5 text-left transition-colors hover:bg-accent/50">
                            <span className="w-9 shrink-0 text-xs tabular-nums text-muted-foreground">{c.ano}{c.tri}{c.ciclo}</span>
                            <span className="min-w-[14rem] flex-1">
                              <span className="block text-sm font-medium leading-snug">{c.titulo}</span>
                              <span className="block text-xs text-muted-foreground">{c.aulas.length ? `${c.aulas.length} aulas` : "sem tabela de aulas"}{c.habilidades.length ? ` · ${c.habilidades.join(", ")}` : " · sem habilidade"}</span>
                            </span>
                            <span className="w-40 shrink-0"><Barra aulas={c.aulas} /></span>
                            <span className="w-44 shrink-0 text-xs">
                              {sit ? <><span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-white " + (sit === "Concluído" ? "bg-ok" : "bg-primary")}>{sit === "Concluído" && <CircleCheck aria-hidden className="h-3 w-3" />}{sit}</span>
                                <span className="mt-0.5 block text-muted-foreground">{prog.map((x) => `turma ${x.turma}: ${x.dadas} de ${x.total}`).join(" · ")}</span></> : <span className="text-muted-foreground">sem turma</span>}
                            </span>
                          </button>
                        );
                      })}
                      {!lista.length && <div className="py-2.5 text-xs text-muted-foreground">A planejar</div>}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
          {fora.length > 0 && (
            <section className="rounded-xl border border-dashed bg-background p-4">
              <h2 className="font-serif text-xl font-semibold">Fora de um ano</h2>
              <p className="mb-1 text-xs text-muted-foreground">Ciclos do Acervo que o Planejamento {anoLetivo} não usa. Um ciclo é atemporal: inclua-o no ano quando for aplicá-lo.</p>
              <div className="flex flex-col divide-y">
                {fora.map((c) => <LinhaFora key={c.path} c={c} onCiclo={onCiclo} onIncluir={(pos) => incluirCicloNoAno(items, c, anoLetivo, pos).then(() => setTick((t) => t + 1)).catch((e) => setErro(String(e?.message ?? e)))} />)}
              </div>
            </section>
          )}
        </div>

        <aside aria-label="Legenda e pendências" className="flex w-full shrink-0 flex-col gap-4 rounded-xl border bg-background p-4 lg:sticky lg:top-0 lg:w-72">
          <Bloco titulo="Etapas do ciclo">
            <div className="flex flex-col gap-1 text-xs">{FASES.map((f) => <span key={f.id} className="flex items-center gap-2"><span aria-hidden className="inline-block h-2.5 w-2.5" style={{ background: f.cor }} />{f.nome}</span>)}</div>
          </Bloco>
          <Bloco titulo="Sem habilidade BNCC"><Lista lista={semHabilidade} vazio="Todos têm habilidade." /></Bloco>
          <Bloco titulo="Sem aulas"><Lista lista={semAulas} vazio="Todos têm aulas." /></Bloco>
          <Bloco titulo="Sem título"><Lista lista={semTitulo} vazio="Todos têm título." /></Bloco>
          <Bloco titulo="Outros problemas">
            {repetidos.length
              ? <ul className="flex flex-col gap-1 text-xs">{repetidos.map(([cod, l]) => <li key={cod}>Código {cod} repetido em {l.length} ciclos</li>)}</ul>
              : <div className="text-xs text-muted-foreground">Nenhum.</div>}
          </Bloco>
        </aside>
      </div>
    </div>
  );
}
