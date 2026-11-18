import { useEffect, useMemo, useState } from "react";
import { IconBuildingCommunity as Diretoria, IconCalendarEvent as Agendar, IconCopy as Copy, IconMailForward as Notificar, IconMessageCircle as Conversar, IconSpeakerphone as Informar } from "@tabler/icons-react";
import { invoke } from "@/lib/api";
import { cn } from "@/lib/utils";
import { rotuloDe } from "@/lib/semana";
import { CATEGORIAS, abreviar, ESTADOS_AGENDA, NEGATIVOS, TIPOS_ACAO, acoesDoAluno, atualizarAcao, criarAluno, dataIso, efeitoDaAcao, inserirAcao, naJanela, nomeEstado, pendente, periodoDe, PERIODOS, serieDoPeriodo, sinaisDoAluno, tipoAcao } from "@/lib/diario";
import { mensagemDaAcao } from "@/lib/mensagens";
import { AvancarReuniao } from "@/components/AvancarReuniao";
import { Chip } from "@/components/Explorador";
import { Estado, useToast } from "@/components/ui/estado";

const lerPeriodo = () => { try { const v = localStorage.getItem("margem.diario.periodo"); return PERIODOS.some((p) => p.id === v) ? v : "semanas"; } catch { return "semanas"; } };

// Cores só para distinguir os comportamentos nos gráficos (os pontos do resto da página indicam gravidade).
const COR = { conversa: "#d4a017", produtividade: "#7e6bc4", espelho: "#3a8fb7", andando: "#e07b39", briga: "#c23b3b", celular: "#5b7083", positivo: "#3f9a62" };
const ICONE = { conversar: Conversar, diretoria: Diretoria, agendar: Agendar, notificar: Notificar, informar: Informar };
const nomeCat = (id) => CATEGORIAS.find((c) => c.id === id)?.nome ?? "Sem categoria";
const minusculaMes = (s) => s.replace(/ de ([A-Za-zçÇ]+)/g, (x) => x.toLowerCase());
const rotuloSemana = (r) => (r.data ? minusculaMes(rotuloDe(r.data)) : r.semana || "Sem data");
const curto = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dataBr = (iso, hora) => { const d = dataIso(iso); return `${curto(d)}/${String(d.getFullYear()).slice(2)}${hora ? `, ${hora}` : ""}`; };
const Ponto = ({ id, className }) => <span aria-hidden className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ background: COR[id] ?? "#999" }} />;
const entrada = "h-9 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary";

/**
 * Aba "Alunos" do Diário: lista de alunos da turma (com sinais) e, ao lado, a ficha do aluno escolhido
 * com comportamentos, linha do tempo semanal e ações (conversar, encaminhar, agendar, notificar e informar à direção).
 */
export function DiarioAlunos({ regs, alunos, items, ano, turmas, turmaInicial, alunoInicial, onOpen, onRefresh }) {
  const [turma, setTurma] = useState(turmaInicial || turmas[0] || "");
  const [sel, setSel] = useState(alunoInicial || "");
  const [filtro, setFiltro] = useState(null);
  const [compor, setCompor] = useState(null); // { tipo }
  const [acoesPor, setAcoesPor] = useState({}); // nome -> ações lidas da nota do aluno
  const [periodoId, setPeriodoId] = useState(lerPeriodo);
  const [recarga, setRecarga] = useState(0);
  const [erro, setErro] = useState("");
  const hoje = useMemo(() => new Date(), []);
  const periodo = useMemo(() => periodoDe(periodoId, hoje), [periodoId, hoje]);
  const escolherPeriodo = (id) => { setPeriodoId(id); try { localStorage.setItem("margem.diario.periodo", id); } catch { /* sem armazenamento */ } };

  const fichas = useMemo(() => alunos.filter((a) => a.turma === turma), [alunos, turma]);
  const ocsTurma = useMemo(() => regs.filter((r) => r.tipo === "ocorrencia" && r.turma === turma && r.aluno), [regs, turma]);
  const nomes = useMemo(() => [...new Set([...fichas.map((a) => a.name), ...ocsTurma.map((r) => r.aluno)])], [fichas, ocsTurma]);

  const chave = fichas.map((f) => f.path).join("|");
  useEffect(() => {
    let vivo = true;
    Promise.all(fichas.map(async (f) => [f.name, acoesDoAluno(await invoke("read_note", { path: f.path }))]))
      .then((l) => vivo && setAcoesPor(Object.fromEntries(l))).catch((e) => setErro(String(e?.message ?? e)));
    return () => { vivo = false; };
  }, [chave, recarga]);

  const resumos = useMemo(() => nomes.map((n) => {
    const ocs = ocsTurma.filter((r) => r.aluno === n), sin = sinaisDoAluno(ocs, acoesPor[n] ?? [], hoje);
    const tot = {};
    for (const o of ocs.filter((x) => naJanela(x, periodo))) for (const c of o.cats) tot[c.id] = (tot[c.id] ?? 0) + 1;
    return { n, ocs, sin, tot, negativos: NEGATIVOS.reduce((s, c) => s + (tot[c] ?? 0), 0) };
  }).sort((a, b) => b.sin.length - a.sin.length || b.negativos - a.negativos || a.n.localeCompare(b.n, "pt-BR")), [nomes, ocsTurma, acoesPor, hoje, periodo]);

  useEffect(() => { if (!sel || !nomes.includes(sel)) setSel(resumos[0]?.n ?? ""); }, [turma, nomes]);
  useEffect(() => { setFiltro(null); setCompor(null); }, [sel, turma]);

  const atual = resumos.find((r) => r.n === sel);
  const ficha = fichas.find((f) => f.name === sel);

  const gravar = async (fn) => {
    setErro("");
    try { await fn(); setRecarga((x) => x + 1); await onRefresh(); } catch (e) { setErro(String(e?.message ?? e)); throw e; }
  };
  const registrarAcao = (a) => gravar(async () => {
    const path = ficha?.path ?? await criarAluno(items, { ano, turma, nome: sel });
    await invoke("save_note", { path, text: inserirAcao(await invoke("read_note", { path }), a) });
    setCompor(null);
  });
  const avancar = (linha, patch) => gravar(async () => {
    await invoke("save_note", { path: ficha.path, text: atualizarAcao(await invoke("read_note", { path: ficha.path }), linha, patch) });
  });

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[18.5rem_minmax(0,1fr)]">
      <aside aria-label="Alunos da turma" className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-2 border-b px-3.5 py-3">
          {turmas.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">Turma
              <select value={turma} onChange={(e) => setTurma(e.target.value)} className="h-8 flex-1 rounded-md border bg-background px-2 text-sm text-foreground outline-none">{turmas.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            </label>
          )}
          <span className="text-xs text-muted-foreground">Contagens no período do gráfico · quem pede atenção vem primeiro</span>
        </div>
        {resumos.length === 0 && <p className="px-3.5 py-4 text-sm text-muted-foreground">Nenhum aluno nesta turma ainda.</p>}
        {resumos.map((r) => (
          <button key={r.n} onClick={() => setSel(r.n)} aria-current={r.n === sel} className={cn("flex w-full flex-col gap-1 border-b border-l-[3px] px-3.5 py-2.5 text-left last:border-b-0 hover:bg-accent/60", r.n === sel ? "border-l-primary bg-accent/60" : "border-l-transparent")}>
            <span className="flex items-center gap-2 text-sm font-medium">{abreviar(r.n)}
              {r.sin.length > 0 && <span className="ml-auto rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">{r.sin.length} {r.sin.length === 1 ? "sinal" : "sinais"}</span>}
            </span>
            <span className="flex min-h-[1.125rem] flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
              {CATEGORIAS.filter((c) => r.tot[c.id]).map((c) => <span key={c.id} className="inline-flex items-center gap-1" title={c.nome}><Ponto id={c.id} className="!h-2 !w-2" />{r.tot[c.id]}</span>)}
              {!Object.keys(r.tot).length && "Sem ocorrências"}
            </span>
          </button>
        ))}
      </aside>

      {atual ? (
        <Ficha key={`${turma}/${atual.n}`} periodo={periodo} periodoId={periodoId} onPeriodo={escolherPeriodo} r={atual} acoes={acoesPor[atual.n] ?? []} hoje={hoje} nome={abreviar(atual.n)} filtro={filtro} setFiltro={setFiltro}
          compor={compor} setCompor={setCompor} temFicha={!!ficha} onFicha={() => onOpen(ficha.path)} onRegistrar={registrarAcao} onAvancar={avancar} erro={erro} limparErro={() => setErro("")} />
      ) : <p className="py-6 text-sm text-muted-foreground">Escolha um aluno.</p>}
    </div>
  );
}

function Ficha({ periodo, periodoId, onPeriodo, r, acoes, hoje, nome, filtro, setFiltro, compor, setCompor, temFicha, onFicha, onRegistrar, onAvancar, erro, limparErro }) {
  const { sin } = r;
  const ocs = useMemo(() => r.ocs.filter((o) => naJanela(o, periodo)), [r.ocs, periodo]);
  const serie = useMemo(() => serieDoPeriodo(ocs, periodo), [ocs, periodo]);
  const maxTotal = Math.max(1, ...serie.map((b) => b.por.reduce((t, x) => t + x.n, 0)));
  const unidade = Math.min(20, 100 / maxTotal);
  const titulo = PERIODOS.find((p) => p.id === periodo.tipo).titulo;
  const total = {};
  for (const o of ocs) for (const c of o.cats) total[c.id] = (total[c.id] ?? 0) + 1;
  const cats = CATEGORIAS.filter((c) => total[c.id]).sort((a, b) => (a.id === "positivo") - (b.id === "positivo") || total[b.id] - total[a.id]);
  const ordenadas = [...acoes].sort((a, b) => b.data.localeCompare(a.data));
  const resumo = () => [
    ...ocs.filter((o) => !o.cats.every((c) => c.id === "positivo")).sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)).map((o) => `${rotuloSemana(o)} (${o.aula}): ${o.texto}`),
    ...ordenadas.slice().reverse().map((a) => `${dataBr(a.data, a.hora)} — ${tipoAcao(a.tipo).longo} (${nomeEstado(a.estado)})${a.texto ? `: ${a.texto}` : ""}`),
  ].join("\n");

  return (
    <section aria-label={`Ficha de ${nome}`} className="flex flex-col gap-6 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-serif text-2xl font-semibold leading-tight">{nome}</h2>
        <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">Turma {r.ocs[0]?.turma}</span>
        <span className="ml-auto flex flex-wrap gap-3 text-xs">
          <button onClick={() => navigator.clipboard?.writeText(resumo())} className="inline-flex items-center gap-1.5 text-primary hover:underline"><Copy className="h-3.5 w-3.5" />Copiar resumo (Conselho de Classe)</button>
          {temFicha && <button onClick={onFicha} className="text-primary hover:underline">Abrir ficha</button>}
        </span>
      </div>

      {erro && <Estado tipo="err" className="text-sm">Erro: {erro} <button className="underline" onClick={limparErro}>ok</button></Estado>}

      {sin.length > 0 && (
        <Bloco titulo="Sinais">
          <div className="flex flex-col gap-2">
            {sin.map((s) => (
              <div key={s.cat} className="flex items-start gap-2.5 rounded-lg border border-warn/45 bg-warn/10 px-3 py-2.5 text-sm">
                <Ponto id={s.cat} className="mt-1.5" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{nomeCat(s.cat)}: {s.n} ocorrências em 4 semanas</div>
                  <div className="text-[13px] text-muted-foreground">
                    {s.planejada ? `Ação em andamento: ${tipoAcao(s.planejada.tipo).longo.toLowerCase()} (${dataBr(s.planejada.data, s.planejada.hora)}).${s.semMelhora ? " A ação anterior não trouxe melhora." : ""}`
                      : s.semMelhora ? `Já houve ${s.feitas === 1 ? "uma ação" : `${s.feitas} ações`} sem melhora. Próximo passo possível: encaminhar à direção ou agendar com os responsáveis.`
                        : "Ainda sem ação planejada."}
                  </div>
                </div>
                {!s.planejada && <button onClick={() => setCompor({ tipo: "conversar", cat: s.cat })} className="shrink-0 rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-accent">Registrar ação</button>}
              </div>
            ))}
          </div>
        </Bloco>
      )}

      <Bloco titulo={titulo} dica={`${periodo.rotulo} · cada cor é um comportamento; ▲ marca uma ação`} lado={
          <div className="flex flex-wrap items-center gap-2 normal-case tracking-normal">
          <div role="group" aria-label="Período" className="inline-flex gap-0.5 rounded-lg border bg-background p-0.5 normal-case tracking-normal">
            {PERIODOS.map((p) => <button key={p.id} aria-pressed={periodoId === p.id} onClick={() => onPeriodo(p.id)} className={cn("rounded-md px-3 py-1 text-xs font-medium", periodoId === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{p.nome}</button>)}
          </div>
          </div>}>
        <div className="grid items-end gap-2 border-b px-1" style={{ height: 118, gridTemplateColumns: `repeat(${serie.length}, minmax(0, 1fr))` }}>
          {serie.map((w) => (
            <div key={w.rotulo + w.ini.getTime()} className="flex h-full flex-col-reverse items-center justify-start gap-0.5">
              {w.por.length ? w.por.map((p) => <div key={p.cat} title={`${nomeCat(p.cat)}: ${p.n}`} className="grid w-[min(34px,80%)] place-items-center overflow-hidden rounded text-[11px] font-semibold leading-none text-white" style={{ background: COR[p.cat], height: Math.max(12, p.n * unidade) }}>{p.n}</div>)
                : <div className="h-[3px] w-[min(34px,80%)] rounded bg-border" />}
            </div>
          ))}
        </div>
        <div className="grid gap-2 px-1 pt-1.5 text-center text-[11px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${serie.length}, minmax(0, 1fr))` }}>
          {serie.map((w, k) => (
            <span key={w.rotulo + w.ini.getTime()} title={periodo.tipo === "semanas" ? "Semana inteira: as ocorrências guardam a semana, não o dia" : undefined} className={k === periodo.atual ? "font-semibold text-foreground" : k > periodo.atual && periodo.atual >= 0 ? "opacity-50" : ""}>{w.rotulo}
              {acoes.filter((a) => { const d = dataIso(a.data); return d >= w.ini && d < w.fim; }).map((a, i) => <span key={i} title={tipoAcao(a.tipo).nome}> ▲</span>)}
            </span>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Por comportamento" dica={periodo.rotulo.toLowerCase()}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por comportamento">
          {cats.map((c) => <Chip key={c.id} ativo={filtro === c.id} onClick={() => setFiltro(filtro === c.id ? null : c.id)}><Ponto id={c.id} className="!h-2 !w-2" />{c.nome}<b className="font-medium text-foreground">{total[c.id]}</b></Chip>)}
          {!cats.length && <span className="text-sm text-muted-foreground">Nenhuma ocorrência registrada.</span>}
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          {cats.filter((c) => !filtro || c.id === filtro).map((c) => {
            const l = ocs.filter((o) => o.cats.some((x) => x.id === c.id)).sort((a, b) => b.ord - a.ord);
            return (
              <div key={c.id} className="overflow-hidden rounded-lg border">
                <div className="flex items-center gap-2 border-b bg-background px-3 py-2 text-sm font-medium"><Ponto id={c.id} />{c.nome}<span className="font-normal text-muted-foreground">{l.length}</span></div>
                {l.map((o) => (
                  <div key={o.id} className="flex flex-col gap-0.5 border-b px-3 py-2 text-sm last:border-b-0 sm:flex-row sm:gap-3">
                    <span className="shrink-0 pt-0.5 text-xs text-muted-foreground sm:w-44">{rotuloSemana(o)} · {o.aula}</span>
                    <span>{o.texto || <span className="text-muted-foreground">sem anotação</span>}{o.cats.find((x) => x.id === c.id)?.sugerida && <span className="ml-2 text-xs text-muted-foreground">(sugerido)</span>}</span>
                  </div>
                ))}
              </div>
            );
          })}
          {ocs.some((o) => !o.cats.length) && !filtro && (
            <div className="overflow-hidden rounded-lg border">
              <div className="flex items-center gap-2 border-b bg-background px-3 py-2 text-sm font-medium"><Ponto id="" />Sem categoria</div>
              {ocs.filter((o) => !o.cats.length).sort((a, b) => b.ord - a.ord).map((o) => (
                <div key={o.id} className="flex flex-col gap-0.5 border-b px-3 py-2 text-sm last:border-b-0 sm:flex-row sm:gap-3"><span className="shrink-0 pt-0.5 text-xs text-muted-foreground sm:w-44">{rotuloSemana(o)} · {o.aula}</span><span>{o.texto}</span></div>
              ))}
            </div>
          )}
        </div>
      </Bloco>

      <Bloco titulo="Ações">
        <div className="mb-3 flex flex-wrap gap-2">
          {TIPOS_ACAO.map((t) => { const I = ICONE[t.id]; return (
            <button key={t.id} aria-pressed={compor?.tipo === t.id} onClick={() => setCompor(compor?.tipo === t.id ? null : { tipo: t.id })} className={cn("inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent", compor?.tipo === t.id && "border-primary bg-primary/10")}><I aria-hidden className="h-4 w-4" />{t.nome}</button>
          ); })}
        </div>
        {compor && <FormAcao key={compor.tipo + (compor.cat ?? "")} compor={compor} ocs={r.ocs} acoes={acoes} nomeReal={r.n} turma={r.ocs[0]?.turma} hoje={hoje} onCancel={() => setCompor(null)} onOk={onRegistrar} />}
        {ordenadas.length === 0 && !compor && <p className="py-2 text-sm text-muted-foreground">Nenhuma ação registrada para este aluno.</p>}
        {ordenadas.map((a) => {
          const I = ICONE[a.tipo], e = efeitoDaAcao(a, r.ocs, hoje);
          return (
            <div key={a.linha} className="mb-2 flex gap-3 rounded-lg border p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><I aria-hidden className="h-4 w-4" /></span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-medium">{tipoAcao(a.tipo).longo}
                  {(a.tipo === "agendar" || pendente(a)) && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", pendente(a) ? "bg-warn/15 text-warn" : "bg-ok/15 text-ok")}>{nomeEstado(a.estado)}</span>}
                  <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">{a.cat && <><Ponto id={a.cat} className="!h-2 !w-2" />{nomeCat(a.cat)} · </>}{dataBr(a.data, a.hora)}</span>
                </div>
                {a.texto && <p className="text-sm">{a.texto}</p>}
                {!pendente(a) && a.cat && (
                  <div className={cn("border-l-[3px] pl-2.5 text-[13px] text-muted-foreground", e?.tendencia === "diminuiu" ? "border-ok" : e?.tendencia === "aumentou" ? "border-err" : "border-border")}>
                    {e ? <>Depois desta ação, {nomeCat(a.cat).toLowerCase()} <b className="text-foreground">{e.tendencia === "igual" ? "sem mudança" : e.tendencia}</b>: {e.antes} {e.antes === 1 ? "ocorrência" : "ocorrências"} nas 2 semanas anteriores, {e.depois} {e.semanas === 2 ? "nas 2 seguintes" : "na semana seguinte"}.</> : "Ainda sem semanas depois desta ação para comparar."}
                  </div>
                )}
                {pendente(a) && <div><AvancarReuniao acao={a} onAvancar={(patch) => onAvancar(a.linha, patch)} /></div>}
              </div>
            </div>
          );
        })}
      </Bloco>
    </section>
  );
}

const Bloco = ({ titulo, dica, lado, children }) => (
  <div>
    <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}{dica && <span className="font-normal normal-case tracking-normal">· {dica}</span>}</h3>
      {lado && <div className="ml-auto">{lado}</div>}
    </div>
    {children}
  </div>
);

const Campo = ({ nome, children, cheio }) => <label className={cn("flex flex-col gap-1", cheio && "sm:col-span-2")}><span className="text-xs font-medium text-muted-foreground">{nome}</span>{children}</label>;

// Cada ação pede só o que importa: conversar → comentário (com ou sem comportamento); encaminhar e informar → comentário opcional;
// agendar → estado (solicitada/agendada/realizada) e hora; notificar → comentário. Todas têm data.
function FormAcao({ compor, ocs, acoes, nomeReal, turma, hoje, onCancel, onOk }) {
  const toast = useToast();
  const { tipo } = compor, agenda = tipo === "agendar", conversa = tipo === "conversar", obrigatorio = conversa || tipo === "notificar";
  const [cat, setCat] = useState(compor.cat ?? "");
  const [data, setData] = useState(hojeIso()), [hora, setHora] = useState(""), [texto, setTexto] = useState("");
  const [estado, setEstado] = useState("solicitada"), [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setSalvando(true);
    const h = hora ? (/^(\d{1,2}):00$/.test(hora) ? `${+hora.split(":")[0]}h` : `${+hora.split(":")[0]}h${hora.split(":")[1]}`) : "";
    try { await onOk({ data, hora: agenda ? h : "", tipo, cat, estado: agenda ? estado : "feita", texto: texto.trim() }); } catch { setSalvando(false); }
  };
  const msg = mensagemDaAcao(tipo, estado, { nome: nomeReal, turma, ocs, acoes, comentario: texto, hoje });
  const copiar = async () => { try { await navigator.clipboard.writeText(msg.texto); toast("Mensagem copiada.", { tipo: "ok" }); } catch { toast("Não deu para copiar.", { tipo: "err" }); } };
  return (
    <div className="mb-3 grid gap-3 rounded-lg border border-primary p-3.5 sm:grid-cols-2">
      <h4 className="text-sm font-medium sm:col-span-2">{tipoAcao(tipo).longo}</h4>
      {conversa && (
        <Campo nome="Tipo de registro">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={entrada}>
            <option value="">Comentário normal</option>
            {CATEGORIAS.filter((c) => NEGATIVOS.includes(c.id)).map((c) => <option key={c.id} value={c.id}>#{c.tag} · {c.nome}</option>)}
          </select>
        </Campo>
      )}
      {!conversa && cat && <p className="text-xs text-muted-foreground sm:col-span-2">Sobre: <b className="font-medium text-foreground">{nomeCat(cat)}</b></p>}
      {agenda && <Campo nome="Estado"><select value={estado} onChange={(e) => setEstado(e.target.value)} className={entrada}>{ESTADOS_AGENDA.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Campo>}
      <Campo nome={agenda ? (estado === "solicitada" ? "Data da solicitação" : estado === "agendada" ? "Data da reunião" : "Data da reunião realizada") : "Data"}><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={entrada} /></Campo>
      {agenda && estado !== "solicitada" && <Campo nome="Hora (opcional)"><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={entrada} /></Campo>}
      <Campo nome={obrigatorio ? "Comentário" : "Comentário (opcional)"} cheio>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={conversa ? 3 : 2} placeholder={conversa ? "O que foi conversado com o aluno" : tipo === "notificar" ? "O que foi comunicado aos responsáveis" : agenda ? "Assunto da reunião" : "Observações"} className="rounded-md border bg-background p-2.5 text-sm outline-none focus:border-primary" />
      </Campo>
      {msg && (
        <details className="rounded-md border bg-background sm:col-span-2" open>
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">{msg.titulo} · sugestão para copiar e enviar por outro app</summary>
          <pre className="whitespace-pre-wrap border-t px-3 py-2.5 font-sans text-[13px] leading-relaxed">{msg.texto}</pre>
          <div className="flex justify-end border-t px-3 py-1.5"><button type="button" onClick={copiar} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><Copy className="h-3.5 w-3.5" />Copiar mensagem</button></div>
        </details>
      )}
      <div className="flex justify-end gap-3 sm:col-span-2">
        <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={salvar} disabled={!data || salvando || (obrigatorio && !texto.trim())} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-40">{salvando ? "Salvando…" : "Registrar"}</button>
      </div>
    </div>
  );
}
