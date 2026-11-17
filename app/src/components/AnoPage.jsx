import { IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight, IconCircleCheck as CircleCheck, IconGripVertical as Grip, IconPlus as Plus, IconTrash as Trash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { PlanejarCicloDialog } from "@/components/PlanejarCicloDialog";
import { FASES, anosLetivos, criarProximoAno, lerCiclos, incluirCicloNoAno, tirarCicloDoAno, moverCicloNoAno } from "@/lib/ciclos";
import { lerSemanas, segundaDe } from "@/lib/semana";
import { lerTurmas, turmasDeTexto, sugerirTurmasDoProximoAno, AULAS_PADRAO } from "@/lib/turmas";
import { corTurma } from "@/lib/cores";
import { Estado, Carregando, Erro, Vazio } from "@/components/ui/estado";

const cor = Object.fromEntries(FASES.map((f) => [f.id, f.cor]));

function Barra({ aulas }) {
  if (!aulas.length) return <div className="mt-2 h-3 rounded-sm bg-border" />;
  return (
    <div className="mt-2 flex h-3 gap-0.5">
      {aulas.map((a) => <span key={a.n} title={`Aula ${a.n}: ${FASES.find((f) => f.id === a.fase).nome}`} className="rounded-sm" style={{ flex: 1, background: cor[a.fase] }} />)}
    </div>
  );
}

// Progresso do ciclo em anel: vazio → cheio; verde e com ✓ quando concluído.
function Rosca({ dadas, total, concluido }) {
  const r = 7, circ = 2 * Math.PI * r, f = total ? Math.min(1, dadas / total) : 0;
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 -rotate-90" role="img" aria-label={concluido ? "Concluído" : `Em andamento: ${dadas} de ${total} aulas`}>
      <title>{concluido ? "Concluído" : `Em andamento: ${dadas} de ${total} aulas`}</title>
      <circle cx="10" cy="10" r={r} fill="none" strokeWidth="2.5" className="stroke-border" style={{ strokeWidth: 2.5 }} />
      <circle cx="10" cy="10" r={r} fill="none" strokeLinecap="round" className={concluido ? "stroke-ok" : "stroke-primary"} style={{ strokeWidth: 2.5 }} strokeDasharray={`${circ * f} ${circ}`} />
    </svg>
  );
}

// Aulas do ciclo em círculos, na cor da etapa; as que caem na semana atual ganham um anel.
function Aulas({ aulas, semana }) {
  return (
    <div className="flex flex-wrap gap-1" aria-label="Aulas do ciclo">
      {aulas.map((a) => {
        const ativa = semana.has(a.n);
        return <span key={a.n} title={`Aula ${a.n}: ${FASES.find((f) => f.id === a.fase).nome}${ativa ? " · nesta semana" : ""}`}
          className={"h-3 w-3 rounded-full " + (ativa ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : "")} style={{ background: cor[a.fase] }} />;
      })}
    </div>
  );
}

let ultimo = null; // última leitura: a tela reaparece na hora e é atualizada por baixo
function LinhaFora({ c, onCiclo, onIncluir, fixo = false }) {
  const [ano, setAno] = useState(6), [tri, setTri] = useState(1);
  const sel = "rounded-md border bg-background px-1.5 py-1 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-accent/50">
      <button onClick={() => onCiclo(c)} title={c.name} className="min-w-[14rem] flex-1 text-left hover:underline">
        <span className="block text-sm font-medium leading-snug">{c.titulo}</span>
        <span className="block text-xs text-muted-foreground">{c.aulas.length ? `${c.aulas.length} aulas` : "sem tabela de aulas"}{c.habilidades.length ? ` · ${c.habilidades.join(", ")}` : " · sem habilidade"}</span>
      </button>
      <span className="w-64 shrink-0"><Barra aulas={c.aulas} /></span>
      <span className="flex shrink-0 items-center gap-1.5">
        {!fixo && <>
        <select aria-label={`Ano escolar de ${c.titulo}`} value={ano} onChange={(e) => setAno(Number(e.target.value))} className={sel}>{[6, 7, 8, 9].map((a) => <option key={a} value={a}>{a}º ano</option>)}</select>
        <select aria-label={`Trimestre de ${c.titulo}`} value={tri} onChange={(e) => setTri(Number(e.target.value))} className={sel}>{[1, 2, 3].map((t) => <option key={t} value={t}>{t}º tri</option>)}</select>
        </>}
        <button onClick={() => onIncluir({ ano, tri })} className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent">Incluir</button>
      </span>
    </div>
  );
}

export function AnoPage({ items, onOpen, onCiclo, onRefresh, turmaGlobal }) { // turmaGlobal: filtro vindo da página Ano ("" = todas)
  const [plan, setPlan] = useState(false);
  const [dados, setDados] = useState(ultimo);
  const [erro, setErro] = useState("");
  const [filtroLocal, setFiltro] = useState(""); // "" = todas as turmas
  const filtro = turmaGlobal ?? filtroLocal;
  const [tick, setTick] = useState(0); // força reler depois de mexer no Planejamento
  const [arrasto, setArrasto] = useState(null); // ciclo sendo arrastado
  const [alvo, setAlvo] = useState(null); // onde vai cair: "path" de uma linha (entra antes dela) ou "fim:ano:tri"
  const [incl, setIncl] = useState(null); // turma para a qual se está incluindo planejamento
  const [novo, setNovo] = useState(null); // diálogo "Criar próximo ano": { txt (turmas), aulas }
  const [anoSel, setAnoSel] = useState(null); // ano letivo mostrado (independente da Semana); null = o mais recente
  useEffect(() => { lerCiclos(items, anoSel).then(async (c) => {
    const [semanas, cfg] = await Promise.all([lerSemanas(items).catch(() => []), lerTurmas(items, c.anoLetivo ?? String(new Date().getFullYear())).catch(() => ({ turmas: [] }))]);
    ultimo = { ...c, semanas, turmasCfg: cfg.turmas }; setDados(ultimo);
  }).catch((e) => setErro(String(e))); }, [items, tick, anoSel]);

  if (erro) return <Erro>Erro: {erro}</Erro>;
  if (!dados) return <Carregando>Lendo os planos…</Carregando>;
  const { anoLetivo, ciclos } = dados;
  const anosTodos = anosLetivos(items), idxAno = anosTodos.indexOf(anoLetivo), ehUltimoAno = idxAno === anosTodos.length - 1;
  const abrirNovoAno = async () => {
    const cfg = await lerTurmas(items, anoLetivo).catch(() => ({ turmas: [], aulas: AULAS_PADRAO }));
    const base = cfg.turmas.length ? cfg.turmas : [...new Set((dados.semanas ?? []).flatMap((sm) => sm.turmas.map((t) => t.turma)))].sort();
    setNovo({ txt: sugerirTurmasDoProximoAno(base).join(", "), aulas: cfg.aulas });
  };
  const novoAno = async () => { try { const n = await criarProximoAno(items, { turmas: turmasDeTexto(novo.txt), aulas: novo.aulas }); setNovo(null); setAnoSel(n); setFiltro(""); onRefresh?.(); setTick((t) => t + 1); } catch (e) { setErro(String(e?.message ?? e)); } };
  const navAno = (
    <span className="inline-flex items-center gap-1 align-middle">
      <button disabled={idxAno <= 0} onClick={() => { setAnoSel(anosTodos[idxAno - 1]); setFiltro(""); }} className="rounded p-1 hover:bg-accent disabled:opacity-30" aria-label="Ano anterior"><ChevronLeft className="h-5 w-5" /></button>
      <button disabled={ehUltimoAno} onClick={() => { setAnoSel(anosTodos[idxAno + 1]); setFiltro(""); }} className="rounded p-1 hover:bg-accent disabled:opacity-30" aria-label="Próximo ano"><ChevronRight className="h-5 w-5" /></button>
    </span>
  );
  const dialogoAno = novo && (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-6" onMouseDown={() => setNovo(null)}>
      <div role="dialog" aria-label={`Criar ${Number(anoLetivo) + 1}`} className="w-[min(520px,96vw)] rounded-xl border bg-background p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-2xl font-semibold">Criar {Number(anoLetivo) + 1}</h2>
        <p className="mt-1 text-xs text-muted-foreground">O ano nasce com o planejamento vazio e o andamento zerado: os ciclos recomeçam, mesmo os que ficaram pela metade. Cada turma sugerida sobe um ano escolar e as do 9º ano saem; acrescente as turmas novas do 6º ano e corrija o que precisar.</p>
        <label className="mt-4 block text-sm font-medium" htmlFor="turmas-novo">Turmas de {Number(anoLetivo) + 1}</label>
        <input id="turmas-novo" autoFocus value={novo.txt} onChange={(e) => setNovo({ ...novo, txt: e.target.value })} placeholder="ex.: 61, 62, 71" className="mt-1 w-full rounded border bg-background px-2 py-1.5 text-sm" />
        <label className="mt-3 flex items-center gap-2 text-sm">Aulas por semana, por turma <input type="number" min={1} max={12} value={novo.aulas} onChange={(e) => setNovo({ ...novo, aulas: Number(e.target.value) || AULAS_PADRAO })} className="w-14 rounded border bg-background px-1" /></label>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setNovo(null)} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Cancelar</button>
          <button onClick={novoAno} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90">Criar {Number(anoLetivo) + 1}</button>
        </div>
      </div>
    </div>
  );
  const dialogo = <>{dialogoAno}{plan && <PlanejarCicloDialog items={items} anoLetivo={anoLetivo} onClose={() => setPlan(false)} onCriado={(p) => { setPlan(false); setTick((t) => t + 1); onRefresh?.(); onOpen?.(p); }} />}</>;
  if (!ciclos.length) return <><div className="px-8 pt-8"><h1 className="font-serif text-3xl font-semibold">Ano <span className="text-muted-foreground">{anoLetivo}</span> {navAno}</h1></div><Vazio titulo="Nenhum plano de ciclo ainda" acao={{ rotulo: "Planejar ciclo", onClick: () => setPlan(true) }}>Os planos ficam em Anos/AAAA/Planejamento. Crie o primeiro para ver o ano aqui.</Vazio>{dialogo}</>;
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
  const seg = segundaDe(), chave = `${seg.getFullYear()}-${String(seg.getMonth() + 1).padStart(2, "0")}-${String(seg.getDate()).padStart(2, "0")}`;
  const semanaAtual = (dados.semanas ?? []).find((sm) => (sm.name ?? "").includes(chave)) ?? (dados.semanas ?? [])[(dados.semanas ?? []).length - 1];
  const aulasDaSemana = (c) => new Set((semanaAtual?.turmas ?? []).flatMap((t) => t.aulas).filter((a) => a.cicloNome?.toLowerCase() === c.name.toLowerCase() && a.cicloN && a.situacao !== "descartada").map((a) => a.cicloN));
  const situacao = (p) => !p.length ? null : p.every((x) => x.dadas >= x.total) ? "Concluído" : "Em andamento";
  // Filtro de turma: os ciclos do ano escolar da turma (61 → 6º ano) e os que ela já usa nas semanas.
  const visiveis = ciclos.filter((c) => c.incluido && (!filtro || String(c.ano) === filtro[0] || progresso(c).some((p) => p.turma === filtro)));
  const fora = ciclos.filter((c) => !c.incluido);
  const seriesTurmas = (filtro ? [filtro] : turmas).map((t) => Number(t[0])).filter((n) => n >= 6 && n <= 9);
  const anos = [...new Set([...visiveis.map((c) => c.ano), ...seriesTurmas])].filter(Boolean).sort((a, b) => a - b);
  const semHabilidade = ciclos.filter((c) => !c.habilidades.length);
  const semTitulo = ciclos.filter((c) => c.vazio);
  const semAulas = ciclos.filter((c) => !c.aulas.length);
  const tirar = (c) => tirarCicloDoAno(items, c, anoLetivo).then(() => { setTick((t) => t + 1); onRefresh?.(); }).catch((e) => setErro(String(e?.message ?? e)));
  const soltar = (ano, tri, antes) => {
    const c = arrasto; setArrasto(null); setAlvo(null);
    if (!c || (antes && antes.path === c.path)) return;
    moverCicloNoAno(items, c, anoLetivo, { ano, tri, antesDe: antes?.name ?? null }).then(() => { setTick((t) => t + 1); onRefresh?.(); }).catch((e) => setErro(String(e?.message ?? e)));
  };
  const Lista = ({ lista, vazio }) => lista.length
    ? <div className="flex flex-wrap gap-1.5">{lista.map((c) => <button key={c.path} onClick={() => onCiclo(c)} title={c.name} className="max-w-full truncate rounded-md border px-2 py-0.5 text-xs hover:bg-accent">{c.incluido ? c.titulo : c.name}</button>)}</div>
    : <div className="text-xs text-muted-foreground">{vazio}</div>;
  const Bloco = ({ titulo, children }) => <section className="border-t pt-4 first:border-t-0 first:pt-0"><h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h2>{children}</section>;

  const incluir = (c, pos) => incluirCicloNoAno(items, c, anoLetivo, pos).then(() => { setIncl(null); setTick((n) => n + 1); onRefresh?.(); }).catch((e) => setErro(String(e?.message ?? e)));
  const dialogoIncluir = incl && (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-6" onMouseDown={() => setIncl(null)}>
      <div role="dialog" aria-label={`Incluir ciclo no ${incl.ano}º ano, ${incl.tri}º trimestre`} className="w-[min(720px,96vw)] rounded-xl border bg-background p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center"><h2 className="flex-1 font-serif text-2xl font-semibold">Incluir ciclo · {incl.ano}º ano, {incl.tri}º trimestre</h2><button onClick={() => setIncl(null)} className="text-sm text-muted-foreground hover:text-foreground">fechar</button></div>
        <p className="mt-1 text-xs text-muted-foreground">Ciclos do Acervo que o Planejamento {anoLetivo} ainda não usa. Clique em Incluir para pôr o ciclo neste trimestre.</p>
        <div className="-mx-5 mt-3 flex max-h-[60vh] flex-col divide-y overflow-auto border-t">
          {fora.map((c) => <LinhaFora key={c.path} c={c} fixo onCiclo={(x) => { setIncl(null); onCiclo(x); }} onIncluir={() => incluir(c, { ano: incl.ano, tri: incl.tri })} />)}
          {!fora.length && <div className="px-5 py-6 text-sm text-muted-foreground">Todos os ciclos do Acervo já estão no ano. Use “Planejar ciclo” para criar outro.</div>}
        </div>
        <div className="mt-4 flex justify-end"><button onClick={() => { setIncl(null); setPlan(true); }} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Planejar novo ciclo…</button></div>
      </div>
    </div>
  );
  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      {dialogo}{dialogoIncluir}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <header>
          <h1 className="font-serif text-3xl font-semibold leading-tight">Ano <span className="text-muted-foreground">{anoLetivo}</span> {navAno}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ciclos.length - fora.length} ciclos no ano{fora.length > 0 && ` · ${fora.length} fora de um ano`} · posição por trimestre, sem datas; o andamento vem das aulas ✓ nas notas de semana</p>
        </header>
        <div className="flex-1" />{ehUltimoAno && <button onClick={abrirNovoAno} title="Cria o planejamento do ano seguinte, vazio" className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-accent"><Plus className="h-4 w-4" />Criar {Number(anoLetivo) + 1}</button>}<button onClick={() => setPlan(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />Planejar ciclo</button>
      </div>

      {turmaGlobal === undefined && turmas.length > 1 && (
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
          {!filtro && !visiveis.length && fora.length > 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">O planejamento de {anoLetivo} está vazio. Inclua ciclos abaixo, em “Fora de um ano”, ou use “Planejar ciclo”.</div>}
          {!visiveis.length && !fora.length && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum ciclo para a turma {filtro}.</div>}
          {anos.map((ano) => (
            <section key={ano} className="rounded-xl border bg-background p-4">
              <h2 className="mb-1 font-serif text-xl font-semibold">{ano}º ano</h2>
              {[1, 2, 3].map((t) => {
                const lista = visiveis.filter((c) => c.ano === ano && c.tri === t);
                return (
                  <div key={t} className={"-mx-4 border-t px-4 first:border-t-0 " + (alvo === `fim:${ano}:${t}` ? "bg-accent/40" : "")}
                    onDragOver={(e) => { if (arrasto) { e.preventDefault(); setAlvo(`fim:${ano}:${t}`); } }} onDrop={(e) => { e.preventDefault(); soltar(ano, t, null); }}>
                    <div className="flex items-center pb-1 pt-3"><span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t}º trimestre</span><button onClick={() => setIncl({ ano, tri: t })} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" />Incluir ciclo</button></div>
                    <div className="flex flex-col divide-y">
                      {lista.map((c, idx) => {
                        const prog = progresso(c), sit = situacao(prog);
                        return (
                          <div key={c.path} className={"group -mx-4 flex items-center gap-2 px-4 transition-colors hover:bg-accent/50 " + (arrasto?.path === c.path ? "opacity-40 " : "") + (alvo === c.path ? "shadow-[inset_0_2px_0_0_hsl(var(--primary))]" : "")}
                            draggable={!c.legado} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.name); setArrasto(c); }} onDragEnd={() => { setArrasto(null); setAlvo(null); }}
                            onDragOver={(e) => { if (arrasto && arrasto.path !== c.path) { e.preventDefault(); e.stopPropagation(); setAlvo(c.path); } }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); soltar(ano, t, c); }}>
                          {!c.legado && <Grip aria-hidden title="Arraste para mudar a ordem ou o trimestre" className="-ml-2 h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60" />}
                          <button onClick={() => onCiclo(c)} title={c.name} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 text-left !bg-transparent">
                            <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{idx + 1}</span>
                            <span className="flex w-5 shrink-0 justify-center">{sit && <Rosca dadas={prog.reduce((t, x) => t + x.dadas, 0)} total={prog.reduce((t, x) => t + x.total, 0)} concluido={sit === "Concluído"} />}</span>
                            <span className="min-w-[14rem] flex-1">
                              <span className="block text-sm font-medium leading-snug">{c.titulo}</span>
                              <span className="block text-xs text-muted-foreground">{c.aulas.length ? `${c.aulas.length} aulas` : "sem tabela de aulas"}{c.habilidades.length ? ` · ${c.habilidades.join(", ")}` : " · sem habilidade"}</span>
                            </span>
                            {sit === "Em andamento" && <span className="w-64 shrink-0"><Aulas aulas={c.aulas} semana={aulasDaSemana(c)} /></span>}
                          </button>
                          {!c.legado && <button onClick={() => tirar(c)} title="Tirar do ano (o ciclo continua no Acervo)" aria-label={`Tirar ${c.titulo} do ano`} className="mr-1 inline-flex shrink-0 items-center rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-err focus-visible:opacity-100 group-hover:opacity-100"><Trash aria-hidden className="h-4 w-4" /></button>}
                          </div>
                        );
                      })}
                      {!lista.length && <div className="py-2.5 text-xs text-muted-foreground">A planejar · use “Incluir ciclo”</div>}
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
              <div className="-mx-4 flex flex-col divide-y">
                {fora.map((c) => <LinhaFora key={c.path} c={c} onCiclo={onCiclo} onIncluir={(pos) => incluir(c, pos)} />)}
              </div>
            </section>
          )}
        </div>

        <aside aria-label="Legenda e pendências" className="flex w-full shrink-0 flex-col gap-4 rounded-xl border bg-background p-4 lg:sticky lg:top-0 lg:w-72">
          <Bloco titulo="Etapas do ciclo">
            <div className="flex flex-col gap-1 text-xs">{FASES.map((f) => <span key={f.id} className="flex items-center gap-2"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: f.cor }} />{f.nome}</span>)}</div>
          </Bloco>
          <Bloco titulo="Sem habilidade BNCC"><Lista lista={semHabilidade} vazio="Todos têm habilidade." /></Bloco>
          <Bloco titulo="Sem aulas"><Lista lista={semAulas} vazio="Todos têm aulas." /></Bloco>
          <Bloco titulo="Sem título"><Lista lista={semTitulo} vazio="Todos têm título." /></Bloco>
        </aside>
      </div>
    </div>
  );
}
