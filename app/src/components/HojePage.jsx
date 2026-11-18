import { useEffect, useState } from "react";
import { IconArrowRight as ArrowRight, IconAlertTriangle as Alerta, IconInfoCircle as Info, IconHeartbeat as Saude, IconNotebook as Caderno, IconCalendarEvent as Reuniao, IconFileText as FileText } from "@tabler/icons-react";
import { anosLetivos, lerCiclos } from "@/lib/ciclos";
import { lerSemanas, segundaDe, rotuloDe, situacaoAula } from "@/lib/semana";
import { listaCorrecoes, lerCorrecao, num } from "@/lib/correcao";
import { lerRecentes, haQuanto, tipoDeRel } from "@/lib/recentes";
import { corTurma } from "@/lib/cores";
import { invoke } from "@/lib/api";
import { metaDe } from "@/lib/documentos";
import { Anos } from "@/components/ui/Anos";
import { criarAula } from "@/lib/aula";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { SituacaoAula } from "@/components/ui/SituacaoAula";
import { Inline } from "@/components/ui/Inline";
import { Estado, Carregando, Vazio, Erro, useToast } from "@/components/ui/estado";
import { cn } from "@/lib/utils";
import { CATEGORIAS, abreviar, alunosEmAlerta, atualizarAcao, dataIso, diariosParaRever, reunioesEmAberto } from "@/lib/diario";
import { AvancarReuniao } from "@/components/AvancarReuniao";
import { pendenciasDoFechamento, triSugerido } from "@/lib/fechamento";
import { alternar, caminhoCaixa, gravarCaixa, lerCaixa, lerTarefas, limparFeitas } from "@/lib/caixa";

const tint = (cor, p = 14) => `color-mix(in srgb, ${cor} ${p}%, transparent)`;
const nomes = (r) => [...String(r ?? "").matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim());

/** Hoje, sem horário: a próxima aula de cada turma na semana atual, a correção em curso e os arquivos abertos há pouco. */
export function HojePage({ items, caixaTick, onCapturar, onFechamento, onOpen, onCorrecao, onSemana, onDiario, onSaude, onRefresh }) {
  const toast = useToast();
  const [wAside, setWAside] = useWidth("hoje.lateral", 340);
  const criar = async (aula, turma) => {
    try { const p = await criarAula(items, { titulo: aula.texto, turma }); await onRefresh?.(); toast("Aula criada com o modelo.", { tipo: "ok" }); onOpen(p); }
    catch (e) { toast(`Não deu para criar a aula: ${e.message ?? e}`, { tipo: "err" }); }
  };
  const [semanas, setSemanas] = useState(undefined);
  const [lote, setLote] = useState(undefined); // undefined = lendo; null = nenhum em curso
  const [erro, setErro] = useState("");
  useEffect(() => { lerSemanas(items).then(setSemanas).catch((e) => setErro(String(e))); }, [items]);
  // Situação da aula: grava só a marca na nota da semana. A aula marcada continua no cartão (com a escolha à mostra)
  // até o professor passar para a próxima; ao reabrir a tela, vale a primeira aula ainda sem situação.
  const [foco, setFoco] = useState({}); // turma -> n da aula em foco
  const situar = async (path, turma, n, sit) => {
    try {
      const antes = await invoke("read_note", { path });
      await invoke("save_note", { path, text: situacaoAula(antes, turma, n, sit) });
      setFoco((f) => ({ ...f, [turma]: n }));
      setSemanas(await lerSemanas(items));
    } catch (e) { toast(`Não deu para registrar: ${e.message ?? e}`, { tipo: "err" }); }
  };
  useEffect(() => {
    let vivo = true;
    Promise.all(listaCorrecoes(items).map((it) => lerCorrecao(it).then((d) => ({ it, d })).catch(() => null))).then((r) => {
      if (!vivo) return;
      const emCurso = r.filter((x) => x && !/^(finalizado|arquivado)$/i.test(x.d.status ?? ""));
      const x = emCurso[0];
      setLote(x ? { path: x.it.path, nome: x.d.atividade || x.it.pasta, turma: x.d.turma?.replace(/"/g, ""), total: x.d.alunos.length, feitas: x.d.alunos.filter((a) => a.criterios.length && a.criterios.every((c) => num(c.nota) != null)).length } : null);
    });
    return () => { vivo = false; };
  }, [items]);

  if (erro) return <Erro>Erro: {erro}</Erro>;
  if (semanas === undefined) return <Carregando>Lendo a semana…</Carregando>;

  const existe = (n) => items.find((i) => i.name.toLowerCase() === n.toLowerCase());
  // Semana atual: a que tem o nome da segunda-feira de hoje; senão, a mais recente.
  const seg = segundaDe(), chave = `${seg.getFullYear()}-${String(seg.getMonth() + 1).padStart(2, "0")}-${String(seg.getDate()).padStart(2, "0")}`;
  const semana = semanas.find((s) => (s.name ?? "").includes(chave)) ?? semanas[semanas.length - 1];
  const todas = semana?.turmas.flatMap((t) => t.aulas) ?? [];
  const dadas = todas.filter((a) => a.dada).length, porDar = todas.filter((a) => !a.situacao).length, adiadas = todas.filter((a) => a.situacao === "pulada").length;

  const recentes = lerRecentes().map((r) => ({ ...r, it: items.find((i) => i.path === r.path) })).filter((r) => r.it).slice(0, 6);
  const pct = todas.length ? (dadas / todas.length) * 100 : 0;

  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className="flex w-full flex-col gap-8 px-8 py-8">
      <header>
        <div className="text-xs text-muted-foreground">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">{semana ? `Semana de ${semana.rotulo || rotuloDe(seg)}` : "Hoje"}</h1>
        {semana && <p className="mt-1 text-sm text-muted-foreground">{dadas} {dadas === 1 ? "aula dada" : "aulas dadas"} · {porDar} por dar{adiadas > 0 && ` · ${adiadas} ${adiadas === 1 ? "adiada" : "adiadas"}`}</p>}
      </header>

      <div className="flex items-stretch gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Próximas aulas</h2>
            {!semana
              ? <Vazio titulo="Ainda não há semana" acao={{ rotulo: "Ir para a Semana", onClick: onSemana }}>Crie a semana atual para ver aqui a próxima aula de cada turma.</Vazio>
              : <div className="flex flex-col gap-2.5">
                {semana.turmas.map((t) => {
                  const pendente = t.aulas.find((a) => !a.situacao), aula = t.aulas.find((a) => a.n === foco[t.turma]) ?? pendente, resolvida = !!aula?.situacao;
                  const alvos = aula ? [...new Set([...nomes(aula.recurso), ...nomes(aula.texto)])] : [];
                  const prontos = alvos.map(existe).filter(Boolean);
                  const pronto = alvos.length > 0 && prontos.length === alvos.length;
                  const cor = corTurma(t.turma);
                  return (
                    <div key={t.turma} className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-4">
                      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cor }} />
                      <div className="min-w-0 flex-1 basis-52">
                        <div className="font-semibold">{t.turma}{t.cicloNome && <span title={t.cicloNome} className="ml-2 text-xs font-normal text-muted-foreground">ciclo {/^\d{3}/.exec(t.cicloNome)?.[0] ?? t.cicloNome}</span>}</div>
                        <div className={cn("truncate text-sm", aula ? (resolvida ? cn("text-muted-foreground/70", aula.situacao === "descartada" && "line-through") : "text-muted-foreground") : "text-ok")}>{aula ? <Inline texto={aula.texto} /> : t.aulas.length ? "Todas as aulas da semana foram resolvidas." : "Sem aulas nesta semana."}</div>
                      </div>
                      {aula && <SituacaoAula discreto situacao={aula.situacao} onChange={(sit) => situar(semana.path, t.turma, aula.n, sit)} />}
                      {aula && !resolvida && <Estado tipo={pronto ? "ok" : "warn"} inline className="text-xs font-semibold">{pronto ? "Aula pronta" : "Sem aula"}</Estado>}
                      {resolvida && pendente && <button onClick={() => setFoco((f) => { const { [t.turma]: _, ...resto } = f; return resto; })} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent">Próxima aula<ArrowRight aria-hidden className="h-4 w-4" /></button>}
                      {aula && !resolvida && (pronto
                        ? <button onClick={() => onOpen(prontos[0].path)} className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent">Abrir plano</button>
                        : <button onClick={() => criar(aula, t.turma)} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90">Criar aula</button>)}
                    </div>
                  );
                })}
              </div>}
          </section>

          <EmAlerta items={items} onOpen={onOpen} onDiario={onDiario} />

          <section>
            <h2 className="mb-3 text-lg font-semibold">Documentos recentes</h2>
            {recentes.length === 0
              ? <p className="text-sm text-muted-foreground">Os arquivos que você abrir aparecem aqui.</p>
              : <div className="overflow-hidden rounded-xl border">{recentes.map((r) => <Recente key={r.path} r={r} onOpen={onOpen} />)}</div>}
          </section>
        </div>

        <ResizeHandle width={wAside} setWidth={setWAside} min={240} max={640} side="right" />
        <aside style={{ width: wAside, maxWidth: "45%" }} className="flex shrink-0 flex-col gap-4 self-start">
          <Caixa items={items} tick={caixaTick} onCapturar={onCapturar} onOpen={onOpen} />
          <LinhaFechamento items={items} onClick={onFechamento} />
          <section className="flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Para corrigir</h2>
            {lote === undefined ? <span className="text-sm text-muted-foreground">Lendo…</span>
              : lote === null ? <p className="text-sm text-muted-foreground">Nenhuma correção em curso.</p>
              : <>
                <div className="font-semibold">{lote.nome}{lote.turma && <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: corTurma(lote.turma) }} />{lote.turma}</span>}</div>
                <div role="img" aria-label={`${lote.feitas} de ${lote.total} corrigidas`} className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${lote.total ? (lote.feitas / lote.total) * 100 : 0}%` }} /></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>{lote.feitas} de {lote.total} corrigidas</span><span>faltam {lote.total - lote.feitas}</span></div>
                <button onClick={() => onCorrecao(lote.path)} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90">Continuar correção</button>
              </>}
          </section>
          <Reunioes items={items} onRefresh={onRefresh} />
          <Pendencias items={items} onDiario={onDiario} onSaude={onSaude} />
        </aside>
      </div>
    </div></div>
  );
}

/** Uma linha discreta que só aparece quando há algo em aberto no trimestre; leva à aba Fechamento do Ano. */
function LinhaFechamento({ items, onClick }) {
  const [r, setR] = useState(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { ciclos } = await lerCiclos(items), tri = triSugerido(ciclos, await lerSemanas(items).catch(() => []));
      const d = await pendenciasDoFechamento(items, tri, { ano: String(anosLetivos(items).pop() ?? new Date().getFullYear()) });
      if (vivo) setR({ tri, total: d.total });
    })().catch(() => {});
    return () => { vivo = false; };
  }, [items]);
  if (!r || r.total === 0) return null;
  return <button onClick={onClick} className="flex items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
    <span>Fechamento do {r.tri}º trimestre: {r.total} {r.total === 1 ? "coisa em aberto" : "coisas em aberto"}</span><ArrowRight aria-hidden className="h-4 w-4" /></button>;
}

/** Caixa de entrada (arquivo .md com tarefas anotadas pela captura rápida). Some quando está vazia e nunca cobra nada. */
function Caixa({ items, tick, onCapturar, onOpen }) {
  const toast = useToast();
  const [texto, setTexto] = useState("");
  const [recarga, setRecarga] = useState(0);
  useEffect(() => { let vivo = true; lerCaixa(items).then((t) => vivo && setTexto(t)); return () => { vivo = false; }; }, [items, tick, recarga]);
  const tarefas = lerTarefas(texto);
  const mudar = async (fn) => { try { await gravarCaixa(items, fn); setRecarga((x) => x + 1); } catch (e) { toast(`Não deu para atualizar a caixa: ${e.message ?? e}`, { tipo: "err" }); } };
  const pendentes = tarefas.filter((t) => !t.feito), feitas = tarefas.length - pendentes.length;
  return (
    <section aria-label="Caixa de entrada" className="flex flex-col gap-2 rounded-xl border p-4">
      <h2 className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caixa de entrada
        <button onClick={onCapturar} className="rounded-md border bg-background px-2 py-0.5 text-xs font-normal normal-case tracking-normal text-foreground hover:bg-accent">+ Anotar</button>
      </h2>
      {tarefas.length === 0 ? <p className="text-sm text-muted-foreground">Nada anotado. Ctrl+Shift+N guarda uma ideia ou tarefa em qualquer tela.</p>
        : <ul className="flex flex-col gap-1">
          {tarefas.map((t) => (
            <li key={t.linha}>
              <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent">
                <input type="checkbox" checked={t.feito} onChange={() => mudar((x) => alternar(x, t.linha, t.texto))} className="mt-1" />
                <span className={cn("min-w-0 flex-1 break-words", t.feito && "text-muted-foreground line-through")}>{t.texto}</span>
              </label>
            </li>
          ))}
        </ul>}
      {(feitas > 0 || tarefas.length > 0) && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <button onClick={() => onOpen(caminhoCaixa(items))} className="hover:text-foreground">Abrir arquivo</button>
          {feitas > 0 && <button onClick={() => mudar(limparFeitas)} className="hover:text-foreground">Limpar {feitas} {feitas === 1 ? "feita" : "feitas"}</button>}
        </div>)}
    </section>
  );
}

const quando = (a) => { const d = dataIso(a.data); return `${d.getDate()}/${d.getMonth() + 1}${a.hora ? `, ${a.hora}` : ""}`; };

/** Solicitações e agendamentos de reunião com responsáveis (vêm das ações "Agendar" nas fichas dos alunos). */
function Reunioes({ items, onRefresh }) {
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [recarga, setRecarga] = useState(0);
  useEffect(() => { let vivo = true; reunioesEmAberto(items).then((l) => vivo && setLista(l)).catch(() => {}); return () => { vivo = false; }; }, [items, recarga]);
  const avancar = async (r, patch) => {
    try {
      await invoke("save_note", { path: r.path, text: atualizarAcao(await invoke("read_note", { path: r.path }), r.linha, patch) });
      setRecarga((x) => x + 1); await onRefresh?.();
    } catch (e) { toast(`Não deu para atualizar: ${e.message ?? e}`, { tipo: "err" }); }
  };
  return (
    <section aria-label="Reuniões com responsáveis">
      <h2 className="mb-3 text-lg font-semibold">Reuniões com responsáveis</h2>
      {lista.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma reunião solicitada ou agendada.</p> : <div className="overflow-hidden rounded-xl border">
        {lista.map((r) => (
          <div key={`${r.path}#${r.linha}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-b-0">
            <Reuniao aria-hidden className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.7} />
            <div className="min-w-0 flex-1 basis-52">
              <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium">{abreviar(r.aluno)}<span className="text-xs font-normal text-muted-foreground">turma {r.turma}</span></div>
              {r.texto && <div className="line-clamp-2 text-sm text-muted-foreground">{r.texto}</div>}
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", r.estado === "agendada" ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn")}>{r.estado === "agendada" ? `Agendada · ${quando(r)}` : `Solicitada em ${quando(r)}`}</span>
            <AvancarReuniao acao={r} onAvancar={(patch) => avancar(r, patch)} />
          </div>
        ))}
      </div>}
    </section>
  );
}

/** Alunos com comportamento negativo recorrente (3+ em 4 semanas) sem ação planejada, ou com ação que não trouxe melhora. */
function EmAlerta({ items, onOpen, onDiario }) {
  const [lista, setLista] = useState([]);
  useEffect(() => { let vivo = true; alunosEmAlerta(items).then((l) => vivo && setLista(l)).catch(() => {}); return () => { vivo = false; }; }, [items]);
  const nome = (id) => CATEGORIAS.find((c) => c.id === id)?.nome ?? id;
  return (
    <section aria-label="Alunos em alerta">
      <h2 className="mb-3 flex items-center justify-between gap-1 text-lg font-semibold">Alunos em alerta
        <span className="group relative">
          <button aria-label="Como o alerta é calculado" className="rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:text-foreground"><Info aria-hidden className="h-4 w-4" /></button>
          <span role="tooltip" className="invisible absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border bg-background p-3 text-xs font-normal text-foreground shadow-lg group-focus-within:visible group-hover:visible">Três ou mais ocorrências do mesmo comportamento nas últimas 4 semanas, sem ação planejada.</span>
        </span>
      </h2>
      {lista.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum aluno em alerta.</p> : <div className="overflow-hidden rounded-xl border">
        {lista.map((a) => (
          <button key={`${a.turma}|${a.aluno}`} onClick={() => (a.path ? onOpen(a.path) : onDiario?.())} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 text-left last:border-b-0 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            <Alerta aria-hidden className="h-4 w-4 shrink-0 text-warn" strokeWidth={1.7} />
            <div className="min-w-0 flex-1 basis-52">
              <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium">{abreviar(a.aluno)}<span className="text-xs font-normal text-muted-foreground">turma {a.turma}</span></div>
              <div className="truncate text-sm text-muted-foreground">{a.sinais.map((x) => `${nome(x.cat)} (${x.n})`).join(" · ")}</div>
            </div>
            <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">{a.sinais.every((x) => x.motivo === "sem-melhora") ? "Ação sem melhora" : a.sinais.some((x) => x.motivo === "sem-melhora") ? "Sem ação / sem melhora" : "Sem ação"}</span>
          </button>
        ))}
      </div>}
    </section>
  );
}

/** Duas linhas compactas: diários por transcrever/revisar e avisos da Saúde do vault (sem os de nível "info"). */
function Pendencias({ items, onDiario, onSaude }) {
  const [d, setD] = useState(undefined), [avisos, setAvisos] = useState(undefined); // undefined = lendo; null = indisponível
  useEffect(() => {
    let vivo = true;
    diariosParaRever(items).then((r) => vivo && setD(r)).catch(() => vivo && setD(null));
    invoke("vault_health").then((l) => vivo && setAvisos(l.filter((x) => x.severity !== "info").length)).catch(() => vivo && setAvisos(null));
    return () => { vivo = false; };
  }, [items]);
  const diarios = d === undefined ? "Lendo…" : d === null ? "Não deu para ler" : !d.pendente && !d.revisao ? "Nenhum diário por revisar"
    : [d.revisao && `${d.revisao} aguardando revisão`, d.pendente && `${d.pendente} sem transcrição`].filter(Boolean).join(" · ");
  const saude = avisos === undefined ? "Lendo…" : avisos === null ? "Não deu para verificar" : avisos === 0 ? "Tudo certo" : `${avisos} ${avisos === 1 ? "aviso" : "avisos"}`;
  const linha = (Icone, rotulo, texto, ok, onClick) => (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left last:border-b-0 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
      <Icone aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.7} />
      <span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">{rotulo}</span><span className={cn("block text-sm", ok ? "text-muted-foreground" : "font-medium")}>{texto}</span></span>
      <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
  return (
    <section aria-label="Pendências">
      <h2 className="mb-3 text-lg font-semibold">Pendências</h2>
      <div className="overflow-hidden rounded-xl border">
        {linha(Caderno, "Diário", diarios, d && !d.pendente && !d.revisao, onDiario)}
        {linha(Saude, "Saúde do vault", saude, avisos === 0, onSaude)}
      </div>
    </section>
  );
}

/** Documento recente em linha de lista: ícone do tipo, nome, anos, tipo e quando abriu. */
function Recente({ r, onOpen }) {
  const tipo = tipoDeRel(r.it.rel);
  const [m, setM] = useState(null);
  useEffect(() => { let vivo = true; invoke("read_note", { path: r.path }).then((t) => vivo && setM(metaDe(t))).catch(() => {}); return () => { vivo = false; }; }, [r.path]);
  return (
    <button onClick={() => onOpen(r.path)} className="flex min-h-12 w-full items-center gap-3 border-b px-4 text-left last:border-b-0 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
      <FileText aria-hidden className="h-4 w-4 shrink-0" style={{ color: tipo.cor }} strokeWidth={1.7} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.it.name}</span>
      {m && <Anos anos={m.anos} />}
      <span className="hidden w-32 shrink-0 text-xs text-muted-foreground sm:block">{tipo.nome}</span>
      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{haQuanto(r.ts)}</span>
    </button>
  );
}
