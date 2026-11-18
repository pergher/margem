import { useEffect, useRef, useState } from "react";
import { IconArrowLeft as ArrowLeft, IconChartBar as ChartColumn, IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight, IconCircleCheck as CircleCheck } from "@tabler/icons-react";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { abreviar } from "@/lib/diario";
import { listaCorrecoes, lerCorrecao, estatisticas, devolutiva, opcoesDe, num, gravarNota, aprovarTranscricao } from "@/lib/correcao";
import { Carregando, Erro, Vazio, useToast } from "@/components/ui/estado";
import { handlers } from "@/lib/shortcuts";
import { Button } from "@/components/ui/button";
import { corTurma } from "@/lib/cores";
import { baixar } from "./correcao/baixar";
import { PainelEnunciado } from "./correcao/PainelEnunciado";
import { Turma } from "./correcao/Turma";
import { ListaAlunos } from "./correcao/ListaAlunos";
import { PainelFoto } from "./correcao/PainelFoto";
import { Transcricao } from "./correcao/Transcricao";
import { Avaliacao } from "./correcao/Avaliacao";

export function CorrecaoPage({ items, onOpen, focoPath, onVoltar, vistaInicial }) {
  const lotes = listaCorrecoes(items);
  const [lote, setLote] = useState(lotes.find((l) => l.path === focoPath)?.path ?? lotes[0]?.path ?? null);
  useEffect(() => { if (focoPath && lotes.some((l) => l.path === focoPath)) setLote(focoPath); }, [focoPath, lotes.length]);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [sel, setSel] = useState(0);        // índice original do aluno
  const [vista, setVista] = useState(vistaInicial ?? "aluno");
  const [ordem, setOrdem] = useState("original");
  const [ver, setVer] = useState({ orto: true, pont: true, corr: false });
  const [zoom, setZoom] = useState(1), [rot, setRot] = useState(0);
  const toast = useToast();
  const [lupa, setLupa] = useState(true);
  const [wLista, setWLista] = useWidth("correcao.lista", 208), [wFoto, setWFoto] = useWidth("correcao.foto", 300), [wAval, setWAval] = useWidth("correcao.avaliacao", 420);

  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState(new Set()); // critérios com o comentário aberto
  const alternar = (n) => setAbertos((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const [crit, setCrit] = useState(0);       // critério ativo (atalhos 1–4)
  const ctl = useRef({});                     // ações atuais, lidas pelos atalhos de tela
  useEffect(() => {
    const ids = { corrNext: () => ctl.current.go?.(1), corrPrev: () => ctl.current.go?.(-1), corrCritNext: () => ctl.current.crit?.(1), corrCritPrev: () => ctl.current.crit?.(-1), corrNivel0: () => ctl.current.nivel?.(0) };
    [1, 2, 3, 4].forEach((n) => { ids["corrNivel" + n] = () => ctl.current.nivel?.(n); });
    Object.assign(handlers, ids);
    return () => { Object.keys(ids).forEach((k) => delete handlers[k]); };
  }, []);

  const carregar = () => { const it = lotes.find((l) => l.path === lote); return it ? lerCorrecao(it).then(setD).catch((e) => setErro(String(e))) : Promise.resolve(); };
  useEffect(() => { setD(null); setSel(0); carregar(); }, [lote, items.length]);
  useEffect(() => { setZoom(1); setRot(0); setCrit(0); }, [sel, lote]);

  if (!lotes.length) return <Vazio titulo="Nenhuma correção ainda">Os lotes ficam em Anos/AAAA/Correcoes, com a seção “Transcrições e devolutivas”.</Vazio>;
  if (erro) return <Erro>Erro: {erro}</Erro>;
  if (!d) return <Carregando>Lendo a correção…</Carregando>;

  const est = estatisticas(d);
  const turma = d.turma?.replace(/"/g, "") ?? "";
  const a = d.alunos[sel];
  const rotulo = (x) => abreviar(x.nome);
  const pend = est.marcas;
  const lista = d.alunos.map((x, i) => ({ x, i })).sort((p, q) => ordem === "nota-" ? (q.x.total ?? -1) - (p.x.total ?? -1) : ordem === "nota+" ? (p.x.total ?? 99) - (q.x.total ?? 99) : ordem === "pendencia" ? q.x.marcas - p.x.marcas || p.i - q.i : p.i - q.i);
  const q = busca.trim().toLowerCase();
  const visiveis = q ? lista.filter(({ x, i }) => i === sel || rotulo(x).toLowerCase().includes(q)) : lista; // o aluno aberto fica sempre na lista
  const pos = visiveis.findIndex((e) => e.i === sel);
  const go = (k) => { const e = visiveis[Math.max(0, Math.min(visiveis.length - 1, pos + k))]; if (e) setSel(e.i); };
  ctl.current.go = vista === "aluno" ? go : null;
  ctl.current.crit = (k) => setCrit((c) => Math.max(0, Math.min(a.criterios.length - 1, c + k)));
  ctl.current.nivel = (n) => {
    const c = a.criterios[crit]; if (!c) return;
    const ops = opcoesDe(d, c.nome), min = ops[0] ?? 0, v = n === 0 ? min : ops.filter((o) => o > min)[n - 1];
    if (v == null) return;
    mudarNota(c, num(c.nota) === v ? min : v);
  };
  const [titulo, ...par] = a.texto.split(/\n\s*\n/);
  const dizer = (t) => toast(t, { tipo: "ok", ms: 2500 });
  const mudarNota = (c, v) => gravarNota(d.path, a.nome, c.nome, v).then(carregar).then(() => dizer("Nota gravada")).catch((e) => setErro(String(e)));
  const aprovar = () => aprovarTranscricao(d.path).then(carregar).then(() => dizer("Transcrição aprovada")).catch((e) => setErro(String(e)));
  const copiar = (t) => navigator.clipboard?.writeText(t).then(() => dizer("Devolutiva copiada"));
  const nomeArq = (x) => `Devolutiva ${abreviar(x.nome)}.md`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-end gap-x-4 gap-y-2 border-b px-6 py-3">
        <div className="min-w-0 flex-1">
          {onVoltar && <button onClick={onVoltar} className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden className="h-3.5 w-3.5" />Todas as produções</button>}
          <h1 className="truncate font-serif text-2xl font-semibold leading-tight">{d.atividade || "Correção"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {turma && <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: corTurma(turma) }} />Turma {turma}</span>}
            {d.mes && <span>{d.mes}</span>}
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">{d.status || "sem status"}</span>
            {d.transcricao === "aprovada" && <span className="inline-flex items-center gap-1 text-ok"><CircleCheck aria-hidden className="h-3.5 w-3.5" />Transcrição aprovada</span>}
            {!onVoltar && <select value={lote} onChange={(e) => setLote(e.target.value)} aria-label="Lote de correção" className="h-7 rounded-lg border bg-background px-2 text-xs text-foreground">
              {lotes.map((l) => <option key={l.path} value={l.path}>{l.pasta}</option>)}
            </select>}
          </div>
        </div>
        {vista === "aluno" && (
          <div role="group" aria-label="Navegar entre alunos" className="flex h-9 items-center gap-1 rounded-lg border bg-background px-1 text-xs">
            <button aria-label="Aluno anterior" onClick={() => go(-1)} className="rounded p-1 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[8.5rem] text-center">{rotulo(a)} · {pos + 1} de {visiveis.length}</span>
            <button aria-label="Próximo aluno" onClick={() => go(1)} className="rounded p-1 hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {d.transcricao !== "aprovada" && <Button size="sm" variant="outline" onClick={aprovar} disabled={est.marcas > 0} title={est.marcas > 0 ? `Ainda há ${est.marcas} marca(s) [?]/[ilegível] nos textos` : ""}>Aprovar transcrição</Button>}
          <Button size="sm" variant={vista === "aluno" ? "default" : "outline"} onClick={() => setVista(vista === "aluno" ? "turma" : "aluno")}>{vista === "aluno" ? <ChartColumn aria-hidden className="h-4 w-4" /> : <ArrowLeft aria-hidden className="h-4 w-4" />}{vista === "aluno" ? "Visão da turma" : "Voltar para a correção"}</Button>
        </div>
      </header>
      <PainelEnunciado d={d} onSalvo={carregar} dizer={dizer} onErro={setErro} />

      {vista === "turma" ? <Turma d={d} est={est} rotulo={rotulo} onAluno={(i) => { setSel(i); setVista("aluno"); }} onTodas={() => baixar(`Devolutivas ${d.turma} - ${d.atividade}.md`, d.alunos.map((x) => devolutiva(d, x)).join("\n---\n\n"))} /> : (
      <div className="flex min-h-0 flex-1 overflow-x-auto"> {/* em janela estreita as colunas encolhem até o mínimo e, abaixo disso, rola de lado */}
        <ListaAlunos largura={wLista} d={d} pend={pend} ordem={ordem} setOrdem={setOrdem} visiveis={visiveis} sel={sel} setSel={setSel} rotulo={rotulo} />
        <ResizeHandle width={wLista} setWidth={setWLista} min={150} max={360} side="left" />

        <PainelFoto largura={wFoto} a={a} zoom={zoom} setZoom={setZoom} rot={rot} setRot={setRot} lupa={lupa} setLupa={setLupa} />
        <ResizeHandle width={wFoto} setWidth={setWFoto} min={200} max={700} side="left" />

        <Transcricao a={a} ver={ver} setVer={setVer} titulo={titulo} par={par} />

        <ResizeHandle width={wAval} setWidth={setWAval} min={300} max={640} side="right" />
        <Avaliacao largura={wAval} d={d} a={a} est={est} abertos={abertos} alternar={alternar} setCrit={setCrit} mudarNota={mudarNota} copiar={copiar} nomeArq={nomeArq} />
      </div>)}
    </div>
  );
}
