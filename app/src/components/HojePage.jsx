import { useEffect, useState } from "react";
import { IconArrowRight as ArrowRight, IconCalendarEvent as Reuniao, IconFileText as FileText } from "@tabler/icons-react";
import { lerCiclos } from "@/lib/ciclos";
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
import { abreviar, atualizarAcao, dataIso, reunioesEmAberto } from "@/lib/diario";
import { AvancarReuniao } from "@/components/AvancarReuniao";

const tint = (cor, p = 14) => `color-mix(in srgb, ${cor} ${p}%, transparent)`;
const nomes = (r) => [...String(r ?? "").matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim());

/** Hoje, sem horário: a próxima aula de cada turma na semana atual, a correção em curso e os arquivos abertos há pouco. */
export function HojePage({ items, onOpen, onCorrecao, onSemana, onRefresh }) {
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

          <Reunioes items={items} onRefresh={onRefresh} />

          <section>
            <h2 className="mb-3 text-lg font-semibold">Documentos recentes</h2>
            {recentes.length === 0
              ? <p className="text-sm text-muted-foreground">Os arquivos que você abrir aparecem aqui.</p>
              : <div className="overflow-hidden rounded-xl border">{recentes.map((r) => <Recente key={r.path} r={r} onOpen={onOpen} />)}</div>}
          </section>
        </div>

        <ResizeHandle width={wAside} setWidth={setWAside} min={240} max={640} side="right" />
        <aside style={{ width: wAside, maxWidth: "45%" }} className="flex shrink-0 flex-col gap-4 self-start">
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
        </aside>
      </div>
    </div></div>
  );
}

const lerOcultar = () => { try { return JSON.parse(localStorage.getItem("margem.diario.ocultar") ?? "true") !== false; } catch { return true; } };
const quando = (a) => { const d = dataIso(a.data); return `${d.getDate()}/${d.getMonth() + 1}${a.hora ? `, ${a.hora}` : ""}`; };

/** Solicitações e agendamentos de reunião com responsáveis (vêm das ações "Agendar" nas fichas dos alunos). Some quando não há nenhum. */
function Reunioes({ items, onRefresh }) {
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [recarga, setRecarga] = useState(0);
  const ocultar = lerOcultar();
  useEffect(() => { let vivo = true; reunioesEmAberto(items).then((l) => vivo && setLista(l)).catch(() => {}); return () => { vivo = false; }; }, [items, recarga]);
  if (!lista.length) return null;
  const avancar = async (r, patch) => {
    try {
      await invoke("save_note", { path: r.path, text: atualizarAcao(await invoke("read_note", { path: r.path }), r.linha, patch) });
      setRecarga((x) => x + 1); await onRefresh?.();
    } catch (e) { toast(`Não deu para atualizar: ${e.message ?? e}`, { tipo: "err" }); }
  };
  return (
    <section aria-label="Reuniões com responsáveis">
      <h2 className="mb-3 text-lg font-semibold">Reuniões com responsáveis</h2>
      <div className="overflow-hidden rounded-xl border">
        {lista.map((r) => (
          <div key={`${r.path}#${r.linha}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-b-0">
            <Reuniao aria-hidden className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.7} />
            <div className="min-w-0 flex-1 basis-52">
              <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium">{ocultar ? abreviar(r.aluno) : r.aluno}<span className="text-xs font-normal text-muted-foreground">turma {r.turma}</span></div>
              {r.texto && <div className="truncate text-sm text-muted-foreground">{r.texto}</div>}
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", r.estado === "agendada" ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn")}>{r.estado === "agendada" ? `Agendada · ${quando(r)}` : `Solicitada em ${quando(r)}`}</span>
            <AvancarReuniao acao={r} onAvancar={(patch) => avancar(r, patch)} />
          </div>
        ))}
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
