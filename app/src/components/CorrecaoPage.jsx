import { useEffect, useRef, useState } from "react";
import { invoke, srcDeImagem } from "@/lib/api";
import { ArrowLeft, ChartColumn, Info, ChevronLeft, ChevronRight, Eye, EyeOff, ZoomIn, ZoomOut, RotateCw, Search, AlertTriangle, CircleCheck, Download, ArrowRight } from "lucide-react";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { ERRO, listaCorrecoes, lerCorrecao, estatisticas, devolutiva, opcoesDe, fmt, num, gravarNota, aprovarTranscricao } from "@/lib/correcao";
import { Estado, Carregando, Erro, Vazio, useToast } from "@/components/ui/estado";
import { handlers } from "@/lib/shortcuts";
import { Button } from "@/components/ui/button";
import { corTurma } from "@/lib/cores";

// Marcas da transcrição, erros do aluno e negrito/itálico simples.
// `ver` (só na transcrição) liga os erros: { orto, pont, corr } — sem ele as chaves ficam como texto.
function Inline({ s, ver }) {
  const partes = s.split(/(\{[^{}]*\}|~~[^~]+~~|\^[^^]+\^|\[[^\]]*\?\]|\[ilegível\]|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return partes.map((p, i) => {
    const e = ver && p.startsWith("{") ? ERRO.exec(p) : null;
    if (e) {
      const pont = !!e[1], antes = e[2], certo = e[3];
      if (pont ? !ver.pont : !ver.orto) return <span key={i}>{antes}</span>;
      const dica = (pont ? "Pontuação" : "Ortografia") + (certo != null ? (certo ? ` → ${certo}` : " → remover") : "");
      const corr = ver.corr && certo ? <span className="ml-0.5 rounded bg-ok/15 px-1 text-xs text-ok">{certo}</span> : null;
      if (!pont) return <span key={i} title={dica} className="underline decoration-red-500 decoration-wavy decoration-2 underline-offset-4">{antes}{corr}</span>;
      if (!antes) return <span key={i} title={dica} className="mx-px rounded bg-sky-200 px-1 text-sky-900 dark:bg-sky-900 dark:text-sky-100">{certo ? (ver.corr ? certo : "▲") : "▲"}</span>;
      return <span key={i} title={dica} className="rounded bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100">{antes}{corr}</span>;
    }
    if (p.startsWith("~~")) return <s key={i} className="text-muted-foreground">{p.slice(2, -2)}</s>;
    if (p.startsWith("^")) return <sup key={i} className="rounded bg-primary/15 px-1 text-xs text-primary">{p.slice(1, -1)}</sup>;
    if (p === "[ilegível]") return <span key={i} className="rounded bg-err/15 px-1.5 text-err">{p}</span>;
    if (/^\[.*\?\]$/.test(p)) return <span key={i} className="rounded bg-warn/15 px-1.5 text-warn">{p}</span>;
    if (p.startsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

// Liga/desliga uma marca de erro no texto: amostra da marca + contagem, sem rótulo longo (o nome vai no title).
function Marca({ on, onClick, nome, n, children }) {
  return (
    <button onClick={onClick} aria-pressed={on} aria-label={`${nome}: ${n}`} title={`${nome}: ${n} erro(s) marcados (clique para ${on ? "ocultar" : "mostrar"} no texto)`}
      className={"flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs tabular-nums hover:bg-accent/60 " + (on ? "text-foreground" : "text-muted-foreground opacity-50")}>
      {children}{n}
    </button>
  );
}

// Cabeçalho de painel: a mesma faixa de 40 px nos quatro painéis da bancada.
const CAB = "flex h-10 shrink-0 items-center gap-2 border-b px-4 text-xs";
const campo = "h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus-visible:border-primary";

function Foto({ nome, zoom, rot, lupa }) {
  const [src, setSrc] = useState(null);
  const [mira, setMira] = useState(null); // posição do mouse na imagem (0–1)
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    if (!aberta) return;
    const esc = (e) => { if (e.key === "Escape") { e.preventDefault(); setAberta(false); } };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberta]);
  useEffect(() => {
    setSrc(null);
    if (nome) invoke("read_embed", { target: nome }).then((r) => setSrc(srcDeImagem(r))).catch(() => setSrc(null));
  }, [nome]);
  if (!nome) return <div className="p-4 text-xs text-muted-foreground">Sem foto.</div>;
  if (!src) return <div className="p-4 text-xs text-muted-foreground">{nome}: imagem não encontrada.</div>;
  const ativa = lupa && rot === 0;
  const mover = (e) => { const r = e.currentTarget.getBoundingClientRect(); setMira({ w: r.width, h: r.height, px: e.clientX - r.left, py: e.clientY - r.top }); };
  const L = 360, Z = 3; // diâmetro da lupa e aumento
  return (
    <div className="relative" style={{ width: `${zoom * 100}%`, maxWidth: "none", margin: rot % 180 ? `${zoom * 20}% 0` : 0, cursor: ativa ? "none" : undefined }}
      onMouseMove={ativa ? mover : undefined} onMouseLeave={() => setMira(null)} onClick={() => setAberta(true)} title="Clique para ampliar">
      <img src={src} alt={nome} style={{ width: "100%", transform: `rotate(${rot}deg)` }} className="block rounded bg-white shadow" draggable={false} />
      {ativa && mira && (
        <div aria-hidden className="pointer-events-none absolute rounded-full border-2 border-primary shadow-xl"
          style={{ width: L, height: L, left: mira.px - L / 2, top: mira.py - L / 2, backgroundImage: `url(${src})`, backgroundRepeat: "no-repeat",
            backgroundSize: `${mira.w * Z}px ${mira.h * Z}px`, backgroundPosition: `${L / 2 - mira.px * Z}px ${L / 2 - mira.py * Z}px` }} />
      )}
      {aberta && (
        <div role="dialog" aria-label={`Foto ${nome} ampliada`} onClick={(e) => { e.stopPropagation(); setAberta(false); }} className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4">
          <img src={src} alt={nome} className="max-h-full max-w-full rounded bg-white object-contain shadow-2xl" />
          <span className="absolute right-4 top-3 text-xs text-white/70">Esc ou clique para fechar</span>
        </div>
      )}
    </div>
  );
}

const baixar = (nome, texto) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: "text/markdown;charset=utf-8" }));
  a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export function CorrecaoPage({ items, onOpen, focoPath, onVoltar, vistaInicial }) {
  const lotes = listaCorrecoes(items);
  const [lote, setLote] = useState(lotes.find((l) => l.path === focoPath)?.path ?? lotes[0]?.path ?? null);
  useEffect(() => { if (focoPath && lotes.some((l) => l.path === focoPath)) setLote(focoPath); }, [focoPath]);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [sel, setSel] = useState(0);        // índice original do aluno
  const [nomes, setNomes] = useState(false);
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
  const rotulo = (x) => (nomes ? x.nome : `Aluno ${String(x.n).padStart(2, "0")}`);
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
  const nomeArq = (x) => `Devolutiva ${nomes ? x.nome : "Aluno " + String(x.n).padStart(2, "0")}.md`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-end gap-x-4 gap-y-2 border-b px-6 py-3">
        <div className="min-w-0 flex-1">
          {onVoltar && <button onClick={onVoltar} className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden className="h-3.5 w-3.5" />Todas as correções</button>}
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

      {vista === "turma" ? <Turma d={d} est={est} rotulo={rotulo} nomes={nomes} setNomes={setNomes} onAluno={(i) => { setSel(i); setVista("aluno"); }} onTodas={() => baixar(`Devolutivas ${d.turma} - ${d.atividade}.md`, d.alunos.map((x) => devolutiva(d, x, nomes)).join("\n---\n\n"))} /> : (
      <div className="flex min-h-0 flex-1 overflow-x-auto"> {/* em janela estreita as colunas encolhem até o mínimo e, abaixo disso, rola de lado */}
        <aside aria-label="Alunos" style={{ width: wLista, minWidth: 130 }} className="flex shrink flex-col">
          <div className={CAB}>
            <span className="min-w-0 flex-1 truncate font-semibold">{d.alunos.length} produções{pend ? <span className="font-normal text-warn"> · {pend} marcas</span> : ""}</span>
            <button title={nomes ? "Ocultar nomes" : "Mostrar nomes"} aria-label={nomes ? "Ocultar nomes" : "Mostrar nomes"} onClick={() => setNomes(!nomes)} className="text-muted-foreground hover:text-foreground">{nomes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <div className="space-y-2 p-3">
            <select value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar" className={campo}>
              <option value="original">Ordem da lista</option><option value="nota-">Maior nota</option><option value="nota+">Menor nota</option><option value="pendencia">Mais marcas</option></select>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto px-2 pb-2 text-xs">
            {!visiveis.length && <li className="px-2 py-2 text-muted-foreground">Nenhum aluno encontrado.</li>}
            {visiveis.map(({ x, i }) => (
              <li key={x.n}>
                <button onClick={() => setSel(i)} className={"flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-accent/60 " + (i === sel ? "bg-accent font-medium" : "")}>
                  {x.marcas ? <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0 text-warn" /> : <CircleCheck aria-hidden className="h-3.5 w-3.5 shrink-0 text-ok" />}
                  <span className="flex-1 truncate">{rotulo(x)}</span>
                  <span className={x.marcas ? "text-warn" : ""}>{x.marcas ? `${x.marcas} marcas` : fmt(x.total)}</span>
                </button>
              </li>
            ))}
          </ul>
          {!nomes && <p className="shrink-0 border-t px-4 py-2 text-xs text-muted-foreground">Nomes ocultos por padrão.</p>}
        </aside>
        <ResizeHandle width={wLista} setWidth={setWLista} min={150} max={360} side="left" />

        <section aria-label="Foto do manuscrito" style={{ width: wFoto, minWidth: 120 }} className="flex shrink flex-col bg-muted">
          <div className={CAB + " bg-background"}><span className="flex-1 truncate font-semibold">{a.foto ?? "Manuscrito"}</span>
            <button aria-label="Lupa" title="Lupa ao passar o mouse (foto sem girar)" onClick={() => setLupa(!lupa)} className={lupa ? "text-primary" : "text-muted-foreground hover:text-foreground"}><Search className="h-4 w-4" /></button>
            <button aria-label="Diminuir foto" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="text-muted-foreground hover:text-foreground"><ZoomOut className="h-4 w-4" /></button>
            <button aria-label="Aumentar foto" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="text-muted-foreground hover:text-foreground"><ZoomIn className="h-4 w-4" /></button>
            <button aria-label="Girar foto" onClick={() => setRot((r) => (r + 90) % 360)} className="text-muted-foreground hover:text-foreground"><RotateCw className="h-4 w-4" /></button></div>
          <div className="min-h-0 flex-1 overflow-auto p-4"><Foto nome={a.foto} zoom={zoom} rot={rot} lupa={lupa} /></div>
        </section>
        <ResizeHandle width={wFoto} setWidth={setWFoto} min={200} max={700} side="left" />

        <section aria-label="Transcrição" className="flex min-w-[260px] flex-1 flex-col">
          <div className={CAB}><span className="font-semibold">Transcrição</span>
            <span className="group relative">
              <button aria-label="Como marcar a transcrição" className="rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:text-foreground"><Info className="h-4 w-4" /></button>
              <div role="tooltip" className="invisible absolute left-0 top-full z-20 mt-1 w-72 space-y-2 rounded-lg border bg-background p-3 text-xs text-foreground shadow-lg group-focus-within:visible group-hover:visible">
                <p>Use <code>{"{errado|certo}"}</code> e <code>{"{p:|,}"}</code> na transcrição.</p>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                  <span><span className="rounded bg-warn/15 px-1.5 text-warn">[palavra?]</span> incerta</span>
                  <span className="rounded bg-err/15 px-1.5 text-err">[ilegível]</span>
                  <s>riscado</s>
                  <sup className="rounded bg-primary/15 px-1 text-primary">acrescentado</sup>
                </p>
              </div>
            </span>
                        <span className="ml-auto flex items-center"><Marca on={ver.orto} onClick={() => setVer({ ...ver, orto: !ver.orto })} nome="Ortografia" n={a.erros.orto}><span aria-hidden className="underline decoration-red-500 decoration-wavy decoration-1 underline-offset-4">ab</span><span className="hidden xl:inline">ortografia</span></Marca>
            <Marca on={ver.pont} onClick={() => setVer({ ...ver, pont: !ver.pont })} nome="Pontuação" n={a.erros.pont}><span aria-hidden className="rounded bg-sky-100 px-1 text-sky-900 dark:bg-sky-950 dark:text-sky-100">,</span><span className="hidden xl:inline">pontuação</span></Marca></span>
</div>
          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
            <div className="font-serif text-base leading-[1.75]">
              <p className="mb-4 font-semibold"><Inline s={titulo} ver={ver} /></p>
              {par.map((p, i) => <p key={i} className="mb-4"><Inline s={p} ver={ver} /></p>)}
            </div>
          </div>
        </section>

        <ResizeHandle width={wAval} setWidth={setWAval} min={300} max={640} side="right" />
        <section aria-label="Avaliação" style={{ width: wAval, minWidth: 280 }} className="flex shrink flex-col">
          <div className={CAB + " gap-x-3"}><span className="flex-1 font-semibold">Avaliação</span>
            <button onClick={() => copiar(devolutiva(d, a, nomes))} className="text-xs font-normal text-primary hover:underline">copiar devolutiva</button>
            <button onClick={() => baixar(nomeArq(a), devolutiva(d, a, nomes))} className="text-xs font-normal text-primary hover:underline">baixar</button></div>
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
      </div>)}
    </div>
  );
}

/** Comentário de uma linha: só pontos positivos e pontos de atenção (a nota e a variação já aparecem na linha). */
function resumo(x, cs) {
  if (x.total == null) return "Ainda sem nota.";
  const ok = cs.filter((c) => c.v != null).map((c) => ({ ...c, f: c.v / c.max }));
  const fortes = ok.filter((c) => c.f >= 0.75).sort((p, q) => q.f - p.f).slice(0, 2), fracos = ok.filter((c) => c.f < 0.5).sort((p, q) => p.f - q.f).slice(0, 2);
  const partes = [];
  if (fortes.length) partes.push("Pontos positivos: " + fortes.map((c) => c.nome).join(" e "));
  if (fracos.length) partes.push("a melhorar: " + fracos.map((c) => c.nome).join(" e "));
  if (!partes.length) return "Desempenho regular em todos os critérios.";
  return partes.join(" · ") + ".";
}

/** Variação frente à média da turma, como numa cotação: ▲ verde acima, ▼ vermelho abaixo. */
function Variacao({ dif }) {
  if (dif == null) return <span className="w-16 shrink-0" />;
  const v = Math.round(dif * 10) / 10, sobe = v > 0, igual = v === 0;
  return (
    <span title={igual ? "Na média da turma" : `${fmt(Math.abs(v))} ${sobe ? "acima" : "abaixo"} da média da turma`}
      className={"inline-flex w-16 shrink-0 items-center justify-end gap-1 text-xs font-medium tabular-nums " + (igual ? "text-muted-foreground" : sobe ? "text-ok" : "text-err")}>
      <span aria-hidden className="text-[9px]">{igual ? "▬" : sobe ? "▲" : "▼"}</span>
      <span className="sr-only">{igual ? "na média" : sobe ? "acima da média" : "abaixo da média"}</span>{igual ? "0" : (sobe ? "+" : "−") + fmt(Math.abs(v))}
    </span>
  );
}

function Turma({ d, est, rotulo, nomes, setNomes, onAluno, onTodas }) {
  const [ordem, setOrdem] = useState("original");
  const [abertos, setAbertos] = useState(new Set());
  const [filtro, setFiltro] = useState("todos");
  const alternar = (i) => setAbertos((s) => { const t = new Set(s); t.has(i) ? t.delete(i) : t.add(i); return t; });
  const n = d.alunos.length, corrigidas = n - est.semNota;
  const maxF = Math.max(1, ...est.faixas.map((f) => f.n));
  const aproveitamento = est.media != null && est.maximo ? (est.media / est.maximo) * 100 : null;
  const comMedia = est.porCriterio.filter((c) => c.media != null);
  const fraco = comMedia.length > 1 ? comMedia.reduce((p, c) => (c.media / (c.max || 1) < p.media / (p.max || 1) ? c : p)) : null;
  const filtros = [
    { id: "todos", nome: "Todos", teste: () => true },
    { id: "abaixo", nome: "Abaixo da média", dica: "Nota menor que a média da turma", teste: (x) => x.total != null && est.media != null && x.total < est.media },
    { id: "acima", nome: "Acima da média", dica: "Nota maior que a média da turma", teste: (x) => x.total != null && est.media != null && x.total > est.media },
    { id: "corte", nome: `Abaixo de ${fmt(d.media)}`, dica: "Abaixo da nota de corte da rubrica", teste: (x) => x.total != null && x.total < d.media },
    { id: "zero", nome: "Critério zerado", dica: "Tirou zero em pelo menos um critério", teste: (x) => x.criterios.some((c) => num(c.nota) === 0) },
    { id: "marcas", nome: "Com marcas", dica: "Transcrição com [?] ou [ilegível] pendentes", teste: (x) => x.marcas > 0 },
    { id: "semnota", nome: "Sem nota", dica: "Ainda sem nota", teste: (x) => x.total == null },
  ].map((f) => ({ ...f, n: d.alunos.filter(f.teste).length })).filter((f) => f.id === "todos" || f.id === filtro || f.n > 0);
  const lista = d.alunos.map((x, i) => ({ x, i })).sort((p, q) => ordem === "nota-" ? (q.x.total ?? -1) - (p.x.total ?? -1) : ordem === "nota+" ? (p.x.total ?? 99) - (q.x.total ?? 99) : p.i - q.i).filter(({ x }) => filtros.find((f) => f.id === filtro).teste(x));
  const cartoes = [
    { k: "Média", v: fmt(est.media), sub: aproveitamento != null ? `${Math.round(aproveitamento)}% de ${fmt(est.maximo)}` : "", barra: aproveitamento },
    { k: "Mediana", v: fmt(est.mediana), sub: `${corrigidas} de ${n} com nota` },
    { k: "Menor e maior", v: `${fmt(est.min)} · ${fmt(est.max)}`, sub: est.min != null ? `amplitude de ${fmt(est.max - est.min)}` : "" },
    { k: `Abaixo de ${fmt(d.media)}`, v: `${est.abaixo} de ${n}`, tom: est.abaixo ? "warn" : "ok", sub: est.abaixo ? "precisam de atenção" : "ninguém abaixo da média" },
    { k: "Pendências", v: est.marcas ? `${est.pendentes}` : "Nenhuma", tom: est.marcas ? "warn" : "ok", sub: est.marcas ? `produções · ${est.marcas} ${est.marcas === 1 ? "marca" : "marcas"} na transcrição` : "transcrições sem marcas" },
  ];
  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className="flex w-full flex-col gap-8 px-8 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">Visão da turma <span className="font-normal text-muted-foreground">· {n} produções</span></h2>
        <Button size="sm" variant="outline" onClick={() => setNomes(!nomes)}>{nomes ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}{nomes ? "Ocultar nomes" : "Mostrar nomes"}</Button>
        <Button size="sm" variant="outline" onClick={onTodas}><Download aria-hidden className="h-4 w-4" />Baixar todas as devolutivas</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cartoes.map((c) => (
          <div key={c.k} className="rounded-xl border p-4">
            <div className="text-xs text-muted-foreground">{c.k}</div>
            <div className={"mt-1 font-serif text-2xl font-semibold " + (c.tom === "warn" ? "text-warn" : c.tom === "ok" ? "text-ok" : "")}>{c.v}</div>
            {c.barra != null && <div role="img" aria-label={`${Math.round(c.barra)}% do máximo`} className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${c.barra}%` }} /></div>}
            {c.sub && <div className="mt-1.5 text-xs text-muted-foreground">{c.sub}</div>}
          </div>))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border p-5">
          <h3 className="text-sm font-semibold">Distribuição das notas</h3>
          <p className="mb-4 text-xs text-muted-foreground">Quantos alunos em cada faixa de 1 ponto (de 0 a 1, de 1 a 2…) · máximo {fmt(est.maximo)}</p>
          <div className="flex h-40 items-end gap-1.5">
            {est.faixas.map((f, k) => {
              const baixo = f.ate <= d.media, ult = k === est.faixas.length - 1;
              const quem = d.alunos.filter((x) => x.total != null && (x.total >= f.de && (ult ? x.total <= f.ate : x.total < f.ate)));
              const pos = k < 3 ? "left-0" : k > est.faixas.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <div key={f.de} tabIndex={f.n ? 0 : undefined} aria-label={`${fmt(f.de)} a ${fmt(f.ate)}: ${f.n}${quem.length ? " — " + quem.map(rotulo).join(", ") : ""}`}
                  className="group relative flex h-full flex-1 flex-col justify-end gap-1.5 rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="text-xs font-medium tabular-nums">{f.n}</span>
                  <div className={"rounded-t-md transition-opacity group-hover:opacity-80 " + (baixo ? "bg-warn/70" : "bg-primary/70")} style={{ height: `${(f.n / maxF) * 100}%`, minHeight: f.n ? 6 : 2, opacity: f.n ? undefined : 0.25 }} />
                  {quem.length > 0 && (
                    <div role="tooltip" className={"pointer-events-none invisible absolute bottom-full z-20 mb-1 w-44 rounded-lg border bg-background p-2.5 text-left text-xs shadow-lg group-focus-visible:visible group-hover:visible " + pos}>
                      <div className="mb-1 font-semibold">{fmt(f.de)} a {fmt(f.ate)} · {f.n} {f.n === 1 ? "aluno" : "alunos"}</div>
                      <ul className="space-y-0.5">
                        {quem.slice(0, 12).map((x) => <li key={x.n} className="flex justify-between gap-2"><span className="truncate">{rotulo(x)}</span><span className="tabular-nums text-muted-foreground">{fmt(x.total)}</span></li>)}
                        {quem.length > 12 && <li className="text-muted-foreground">+ {quem.length - 12}</li>}
                      </ul>
                    </div>)}
                </div>);
            })}
          </div>
          <div aria-hidden className="mt-1.5 flex gap-1.5 border-t pt-1.5">{est.faixas.map((f) => <span key={f.de} className="flex-1 text-center text-xs text-muted-foreground tabular-nums">{fmt(f.de)}</span>)}</div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-warn/70" />faixa abaixo da média ({fmt(d.media)})</p>
        </section>

        <section className="rounded-xl border p-5">
          <h3 className="text-sm font-semibold">Média por critério</h3>
          <p className="mb-4 text-xs text-muted-foreground">Quanto a turma tirou em cada critério, em relação ao máximo dele</p>
          <ul className="space-y-3.5">
            {est.porCriterio.map((c) => {
              const p = c.media != null ? (c.media / (c.max || 1)) * 100 : 0, ehFraco = fraco?.nome === c.nome;
              return (
                <li key={c.nome}>
                  <div className="mb-1 flex items-baseline gap-2 text-sm"><span className="min-w-0 flex-1 truncate" title={c.nome}>{c.nome}</span>
                    {ehFraco && <Estado tipo="warn" inline className="text-xs font-semibold">mais fraco</Estado>}
                    <span className="text-xs tabular-nums text-muted-foreground">{fmt(c.media)} / {fmt(c.max)} · {Math.round(p)}%</span></div>
                  <div role="img" aria-label={`${Math.round(p)}% do máximo`} className="h-2 rounded-full bg-muted"><div className={"h-2 rounded-full " + (ehFraco ? "bg-warn" : "bg-primary")} style={{ width: `${p}%`, minWidth: c.media ? 4 : 0 }} /></div>
                </li>);
            })}
          </ul>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="mr-auto text-lg font-semibold">Alunos</h3>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar alunos" className="h-8 rounded-lg border bg-background px-2 text-xs">
            <option value="original">Ordem da lista</option><option value="nota-">Maior nota</option><option value="nota+">Menor nota</option></select>
        </div>
        <div role="group" aria-label="Filtrar alunos" className="mb-3 flex flex-wrap gap-2">
          {filtros.map((f) => (
            <button key={f.id} onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id} title={f.dica}
              className={"inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs " + (filtro === f.id ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-accent")}>
              {f.nome}<span className="tabular-nums text-muted-foreground">{f.n}</span>
            </button>))}
        </div>
        {lista.length === 0 && <p className="rounded-xl border p-4 text-sm text-muted-foreground">Nenhum aluno neste filtro.</p>}
        <div className={"rounded-xl border " + (lista.length ? "" : "hidden")}>
          {lista.map(({ x, i }) => {
            const baixo = x.total != null && x.total < d.media, aberto = abertos.has(i);
            const cs = est.porCriterio.map((c, k) => ({ nome: c.nome.replace(/\s*\(.*\)/, ""), cheio: c.nome, max: c.max || 1, v: num(x.criterios[k]?.nota), turma: c.media, com: (x.criterios[k]?.comentario ?? "").replace(/[*~^_{}|]/g, "").trim() }));
            return (
              <div key={x.n} className="group/linha border-b first:rounded-t-xl last:rounded-b-xl last:border-b-0">
                <div className="flex items-center gap-2 rounded-[inherit] pr-3 hover:bg-accent/50">
                  <button onClick={() => alternar(i)} aria-expanded={aberto} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 pl-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                    <ChevronRight aria-hidden className={"h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform " + (aberto ? "rotate-90" : "")} />
                    <span className="w-24 shrink-0 truncate font-medium sm:w-28">{rotulo(x)}</span>
                    <span role="img" aria-label={cs.map((c) => `${c.nome}: ${c.v == null ? "sem nota" : `${fmt(c.v)} de ${fmt(c.max)}`}`).join("; ")} className="hidden min-w-0 flex-1 items-center gap-1 sm:flex">
                      {cs.map((c, k) => { const f = c.v == null ? null : c.v / c.max, pos = k < 2 ? "left-0" : k > cs.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"; return (
                        <span key={c.nome} className="group/crit relative flex h-5 min-w-2 flex-1 items-center">
                          <span className={"h-2 w-full rounded-md " + (f == null ? "border border-muted-foreground/40" : "bg-primary")} style={f != null ? { opacity: 0.12 + 0.88 * f } : undefined} />
                          <span role="tooltip" className={"pointer-events-none absolute top-full z-30 mt-1 hidden w-60 rounded-lg border bg-background p-2.5 text-left text-xs font-normal shadow-lg group-hover/crit:block " + pos}>
                            <span className="block font-semibold">{c.cheio}</span>
                            <span className="mt-0.5 block tabular-nums">{c.v == null ? "Sem nota" : <>{fmt(c.v)} de {fmt(c.max)} · {Math.round(f * 100)}%</>}</span>
                            {c.turma != null && <span className="block tabular-nums text-muted-foreground">Média da turma: {fmt(c.turma)}</span>}
                            {c.com && <span className="mt-1.5 block line-clamp-3 border-t pt-1.5 text-muted-foreground">{c.com}</span>}
                          </span>
                        </span>); })}
                    </span>
                    {x.marcas > 0 && <Estado tipo="warn" inline className="text-xs">{x.marcas} {x.marcas === 1 ? "marca" : "marcas"}</Estado>}
                    <span className={"w-10 shrink-0 text-right font-serif text-base font-semibold tabular-nums " + (baixo ? "text-err" : "")}>{fmt(x.total)}</span>
                    <Variacao dif={x.total != null && est.media != null ? x.total - est.media : null} />
                  </button>
                  <Button size="sm" variant="outline" className="opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within/linha:opacity-100 group-hover/linha:opacity-100" onClick={() => onAluno(i)} title={`Abrir a correção de ${rotulo(x)}`}>Corrigir<ArrowRight aria-hidden className="h-4 w-4" /></Button>
                </div>
                {aberto && <p className="rounded-b-[inherit] border-t bg-muted/40 px-4 py-2.5 pl-10 text-sm text-foreground/85">{resumo(x, cs)}</p>}
              </div>);
          })}
        </div>
      </section>
      {est.divergentes.length > 0 && <Estado tipo="warn" className="text-xs">{est.divergentes.length} {est.divergentes.length === 1 ? "produção com" : "produções com"} “Nota final” diferente da soma dos critérios.</Estado>}
    </div></div>
  );
}

/** Nota por critério: uma fileira de níveis (0, 0,5, 1…); o escolhido fica preenchido; clicar nele de novo zera. */
function Rating({ nome, valor, opcoes, onChange }) {
  const min = opcoes[0] ?? 0, max = opcoes[opcoes.length - 1] ?? 1;
  // vermelho (mínimo) → verde (máximo), pelo matiz
  const cor = (o) => `hsl(${Math.round(((o - min) / ((max - min) || 1)) * 125)} 50% 36%)`;
  return (
    <div role="radiogroup" aria-label={`Nota de ${nome}`} onClick={(e) => e.stopPropagation()} className="flex h-7 shrink-0 overflow-hidden rounded-md border bg-background">
      {opcoes.map((o) => {
        const on = valor === o;
        return (
          <button key={o} role="radio" aria-checked={on} onClick={() => onChange(on ? min : o)} style={on ? { background: cor(o) } : undefined}
            className={"min-w-8 border-r px-1.5 text-xs tabular-nums last:border-r-0 " + (on ? "font-medium text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
            {fmt(o)}
          </button>
        );
      })}
    </div>
  );
}
