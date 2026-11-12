import { useEffect, useState } from "react";
import { invoke } from "@/lib/api";
import { ChevronLeft, ChevronRight, Eye, EyeOff, ZoomIn, ZoomOut, RotateCw, Search, Star } from "lucide-react";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { listaCorrecoes, lerCorrecao, estatisticas, devolutiva, opcoesDe, fmt, num, gravarNota, aprovarTranscricao } from "@/lib/correcao";

// Marcas da transcrição e negrito/itálico simples.
function Inline({ s }) {
  return s.split(/(~~[^~]+~~|\^[^^]+\^|\[[^\]]*\?\]|\[ilegível\]|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((p, i) => {
    if (p.startsWith("~~")) return <s key={i} className="text-muted-foreground">{p.slice(2, -2)}</s>;
    if (p.startsWith("^")) return <sup key={i} className="rounded bg-primary/15 px-1 text-[13px] text-primary">{p.slice(1, -1)}</sup>;
    if (p === "[ilegível]") return <span key={i} className="rounded bg-red-100 px-1.5 text-red-800 dark:bg-red-950 dark:text-red-200">{p}</span>;
    if (/^\[.*\?\]$/.test(p)) return <span key={i} className="rounded bg-amber-100 px-1.5 text-amber-900 dark:bg-amber-950 dark:text-amber-200">{p}</span>;
    if (p.startsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

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
    if (nome) invoke("read_embed", { target: nome }).then((r) => setSrc(r?.kind === "image" ? r.data : null)).catch(() => setSrc(null));
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

export function CorrecaoPage({ items, onOpen, focoPath }) {
  const lotes = listaCorrecoes(items);
  const [lote, setLote] = useState(lotes.find((l) => l.path === focoPath)?.path ?? lotes[0]?.path ?? null);
  useEffect(() => { if (focoPath && lotes.some((l) => l.path === focoPath)) setLote(focoPath); }, [focoPath]);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [sel, setSel] = useState(0);        // índice original do aluno
  const [nomes, setNomes] = useState(false);
  const [vista, setVista] = useState("aluno");
  const [ordem, setOrdem] = useState("original");
  const [zoom, setZoom] = useState(1), [rot, setRot] = useState(0);
  const [aviso, setAviso] = useState("");
  const [lupa, setLupa] = useState(true);
  const [wLista, setWLista] = useWidth("correcao.lista", 208), [wFoto, setWFoto] = useWidth("correcao.foto", 300), [wAval, setWAval] = useWidth("correcao.avaliacao", 420);

  const carregar = () => { const it = lotes.find((l) => l.path === lote); return it ? lerCorrecao(it).then(setD).catch((e) => setErro(String(e))) : Promise.resolve(); };
  useEffect(() => { setD(null); setSel(0); carregar(); }, [lote, items.length]);
  useEffect(() => { setZoom(1); setRot(0); }, [sel, lote]);

  if (!lotes.length) return <div className="p-8 text-sm text-muted-foreground">Nenhuma correção com “Transcrições e devolutivas” em Anos/AAAA/Correcoes.</div>;
  if (erro) return <div className="p-8 text-sm text-destructive">Erro: {erro}</div>;
  if (!d) return <div className="p-8 text-sm text-muted-foreground">Lendo a correção…</div>;

  const est = estatisticas(d);
  const a = d.alunos[sel];
  const rotulo = (x) => (nomes ? x.nome : `Aluno ${String(x.n).padStart(2, "0")}`);
  const pend = est.marcas;
  const lista = d.alunos.map((x, i) => ({ x, i })).sort((p, q) => ordem === "nota-" ? (q.x.total ?? -1) - (p.x.total ?? -1) : ordem === "nota+" ? (p.x.total ?? 99) - (q.x.total ?? 99) : ordem === "pendencia" ? q.x.marcas - p.x.marcas || p.i - q.i : p.i - q.i);
  const pos = lista.findIndex((e) => e.i === sel);
  const go = (k) => { const e = lista[Math.max(0, Math.min(lista.length - 1, pos + k))]; setSel(e.i); };
  const [titulo, ...par] = a.texto.split(/\n\s*\n/);
  const dizer = (t) => { setAviso(t); setTimeout(() => setAviso(""), 2500); };
  const mudarNota = (c, v) => gravarNota(d.path, a.nome, c.nome, v).then(carregar).then(() => dizer("Nota gravada")).catch((e) => setErro(String(e)));
  const aprovar = () => aprovarTranscricao(d.path).then(carregar).then(() => dizer("Transcrição aprovada")).catch((e) => setErro(String(e)));
  const copiar = (t) => navigator.clipboard?.writeText(t).then(() => dizer("Devolutiva copiada"));
  const nomeArq = (x) => `Devolutiva ${nomes ? x.nome : "Aluno " + String(x.n).padStart(2, "0")}.md`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b px-4 text-[13px]">
        <select value={lote} onChange={(e) => setLote(e.target.value)} className="rounded-md border bg-background px-2 py-1">
          {lotes.map((l) => <option key={l.path} value={l.path}>{l.pasta}</option>)}
        </select>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">{d.status || "sem status"}</span>
        <button onClick={aprovar} disabled={d.transcricao === "aprovada" || est.marcas > 0} title={est.marcas > 0 ? `Ainda há ${est.marcas} marca(s) [?]/[ilegível] nos textos` : ""}
          className={"rounded-full border px-2.5 py-0.5 text-xs " + (d.transcricao === "aprovada" ? "text-green-700" : "hover:bg-accent disabled:opacity-40")}>
          {d.transcricao === "aprovada" ? "Transcrição aprovada ✓" : "Aprovar transcrição"}
        </button>
        <button onClick={() => setVista(vista === "aluno" ? "turma" : "aluno")} className="rounded-md border px-3 py-1 hover:bg-accent">{vista === "aluno" ? "Visão da turma" : "Voltar ao aluno"}</button>
        <span className="text-xs text-muted-foreground">{aviso}</span>
        <div className="flex-1" />
        {vista === "aluno" && <>
          <button aria-label="Aluno anterior" onClick={() => go(-1)} className="rounded-md border p-1 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
          <span>{rotulo(a)} · {pos + 1} de {d.alunos.length}</span>
          <button aria-label="Próximo aluno" onClick={() => go(1)} className="rounded-md border p-1 hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
        </>}
        <button onClick={() => onOpen(d.path)} className="rounded-md border px-3 py-1 hover:bg-accent">Abrir como nota</button>
      </div>

      {vista === "turma" ? <Turma d={d} est={est} rotulo={rotulo} nomes={nomes} setNomes={setNomes} onAluno={(i) => { setSel(i); setVista("aluno"); }} onTodas={() => baixar(`Devolutivas ${d.turma} - ${d.atividade}.md`, d.alunos.map((x) => devolutiva(d, x, nomes)).join("\n---\n\n"))} /> : (
      <div className="flex min-h-0 flex-1">
        <aside aria-label="Alunos" style={{ width: wLista }} className="shrink-0 overflow-auto">
          <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
            <span>{d.alunos.length} produções{pend ? ` · ${pend} marcas` : ""}</span>
            <button title={nomes ? "Ocultar nomes" : "Mostrar nomes"} onClick={() => setNomes(!nomes)} className="hover:text-foreground">{nomes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <div className="px-4 pb-2"><select value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar" className="w-full rounded border bg-background px-1 py-0.5 text-xs">
            <option value="original">ordem da lista</option><option value="nota-">maior nota</option><option value="nota+">menor nota</option><option value="pendencia">mais marcas</option></select></div>
          <ul className="px-2 text-[13px]">
            {lista.map(({ x, i }) => (
              <li key={x.n}>
                <button onClick={() => setSel(i)} className={"flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-accent " + (i === sel ? "bg-accent font-medium" : "")}>
                  <span aria-hidden className={"h-[7px] w-[7px] rounded-full " + (x.marcas ? "bg-amber-500" : "bg-green-600")} />
                  <span className="flex-1 truncate">{rotulo(x)}</span>
                  <span className={x.marcas ? "text-amber-700" : ""}>{x.marcas ? `${x.marcas} marcas` : fmt(x.total)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="px-4 py-3 text-[11px] text-muted-foreground">Nomes ocultos por padrão.</p>
        </aside>
        <ResizeHandle width={wLista} setWidth={setWLista} min={150} max={360} side="left" />

        <section aria-label="Foto do manuscrito" style={{ width: wFoto }} className="shrink-0 overflow-auto bg-muted p-4">
          <div className="mb-2 flex items-center gap-1 text-[13px] font-medium"><span className="flex-1 truncate">{a.foto ?? "Foto"}</span>
            <button aria-label="Lupa" title="Lupa ao passar o mouse (foto sem girar)" onClick={() => setLupa(!lupa)} className={lupa ? "text-primary" : "text-muted-foreground"}><Search className="h-4 w-4" /></button>
            <button aria-label="Diminuir foto" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut className="h-4 w-4" /></button>
            <button aria-label="Aumentar foto" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}><ZoomIn className="h-4 w-4" /></button>
            <button aria-label="Girar foto" onClick={() => setRot((r) => (r + 90) % 360)}><RotateCw className="h-4 w-4" /></button></div>
          <Foto nome={a.foto} zoom={zoom} rot={rot} lupa={lupa} />
        </section>
        <ResizeHandle width={wFoto} setWidth={setWFoto} min={200} max={700} side="left" />

        <section aria-label="Transcrição" className="min-w-0 flex-1 overflow-auto p-6">
          {/* largura definida pelas divisórias vizinhas */}
          <div className="mb-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span><span className="rounded bg-amber-100 px-1.5 text-amber-900">[palavra?]</span> incerta</span>
            <span><span className="rounded bg-red-100 px-1.5 text-red-800">[ilegível]</span></span>
            <span><s>riscado</s></span>
            <span><sup className="rounded bg-primary/15 px-1 text-primary">acrescentado</sup></span>
          </div>
          <div className="font-serif text-[17px] leading-[1.75]">
            <p className="mb-4 font-semibold"><Inline s={titulo} /></p>
            {par.map((p, i) => <p key={i} className="mb-4"><Inline s={p} /></p>)}
          </div>
        </section>

        <ResizeHandle width={wAval} setWidth={setWAval} min={300} max={640} side="right" />
        <section aria-label="Avaliação" style={{ width: wAval }} className="flex shrink-0 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b px-5 text-[13px] font-medium"><span className="flex-1">Avaliação</span>
            <button onClick={() => copiar(devolutiva(d, a, nomes))} className="text-xs font-normal text-primary hover:underline">copiar devolutiva</button>
            <button onClick={() => baixar(nomeArq(a), devolutiva(d, a, nomes))} className="text-xs font-normal text-primary hover:underline">baixar</button></div>
          <ul className="min-h-0 flex-1 overflow-auto px-5">
            {a.criterios.map((c) => (
              <li key={c.nome} className="border-b py-2.5">
                <div className="flex items-center gap-2 text-[14px]"><span className="flex-1 font-semibold">{c.nome}</span>
                  <Rating nome={c.nome} valor={num(c.nota)} opcoes={opcoesDe(d, c.nome)} onChange={(v) => mudarNota(c, v)} /></div>
                <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground"><Inline s={c.comentario} /></div>
              </li>
            ))}
          </ul>
          <div className="shrink-0 border-t bg-muted p-4">
            <div className="flex items-baseline justify-between"><span className="text-[15px] font-semibold">Nota final</span><span className="font-serif text-2xl font-semibold">{fmt(a.total)} <span className="text-sm font-normal text-muted-foreground">de {fmt(est.maximo)}</span></span></div>
            {est.divergentes.includes(a.n) && <div className="mt-1 text-xs text-amber-700">A “Nota final” do arquivo ({a.final}) difere da soma dos critérios.</div>}
          </div>
        </section>
      </div>)}
    </div>
  );
}

function Turma({ d, est, rotulo, nomes, setNomes, onAluno, onTodas }) {
  const maxF = Math.max(1, ...est.faixas.map((f) => f.n));
  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <div className="mb-1 flex items-baseline gap-3"><h1 className="font-serif text-3xl font-semibold">Visão da turma {d.turma}</h1><span className="text-[13px] text-muted-foreground">{d.atividade} · {d.mes}</span>
        <div className="flex-1" /><button onClick={() => setNomes(!nomes)} className="text-xs text-muted-foreground hover:text-foreground">{nomes ? "ocultar nomes" : "mostrar nomes"}</button>
        <button onClick={onTodas} className="rounded-md border px-3 py-1 text-[13px] hover:bg-accent">Baixar todas as devolutivas</button></div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Média", fmt(est.media)], ["Mediana", fmt(est.mediana)], ["Menor / maior", `${fmt(est.min)} / ${fmt(est.max)}`], [`Abaixo de ${fmt(d.media)}`, `${est.abaixo} de ${d.alunos.length}`], ["Pendências", est.marcas ? `${est.pendentes} produções (${est.marcas} marcas)` : "nenhuma"]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-muted p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="font-serif text-2xl font-semibold">{v}</div></div>))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div><div className="mb-2 text-[13px] font-semibold">Distribuição das notas (máximo {fmt(est.maximo)})</div>
          {est.faixas.map((f) => <div key={f.de} className="mb-1.5 flex items-center gap-2 text-[13px]"><span className="w-20 text-muted-foreground">{fmt(f.de)} a {fmt(f.ate)}</span><span className="h-4 rounded bg-primary/70" style={{ width: `${(f.n / maxF) * 60}%`, minWidth: f.n ? 6 : 0 }} /><span>{f.n}</span></div>)}</div>
        <div><div className="mb-2 text-[13px] font-semibold">Média por critério (cada um com seu máximo)</div>
          {est.porCriterio.map((c) => <div key={c.nome} className="mb-1.5 flex items-center gap-2 text-[13px]"><span className="w-48 truncate" title={c.nome}>{c.nome}</span><span className="h-3 rounded bg-primary/70" style={{ width: `${((c.media ?? 0) / (c.max || 1)) * 40}%`, minWidth: 4 }} /><span className="text-muted-foreground">{fmt(c.media)} / {fmt(c.max)}</span></div>)}</div>
      </div>
      <div className="mt-6"><div className="mb-2 text-[13px] font-semibold">Alunos</div>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">{d.alunos.map((x, i) => <button key={x.n} onClick={() => onAluno(i)} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-left text-[13px] hover:bg-accent"><span>{rotulo(x)}</span><span className={x.total != null && x.total < d.media ? "text-red-700" : ""}>{fmt(x.total)}{x.marcas ? ` · ${x.marcas}?` : ""}</span></button>)}</div></div>
      {est.divergentes.length > 0 && <div className="mt-4 text-xs text-amber-700">{est.divergentes.length} produção(ões) com “Nota final” diferente da soma dos critérios.</div>}
    </div>
  );
}

/** Nota por critério em forma de rating: estrelas pintadas até a nota; clicar na última pintada zera. */
function Rating({ nome, valor, opcoes, onChange }) {
  const min = opcoes[0] ?? 0, niveis = opcoes.filter((o) => o > min);
  return (
    <span role="radiogroup" aria-label={`Nota de ${nome}`} className="flex items-center gap-1">
      {niveis.map((o) => {
        const cheia = valor != null && o <= valor;
        return (
          <button key={o} role="radio" aria-checked={valor === o} title={fmt(o)} onClick={() => onChange(valor === o ? min : o)}
            className={"rounded p-0.5 " + (cheia ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-400")}>
            <Star className="h-5 w-5" fill={cheia ? "currentColor" : "none"} strokeWidth={1.5} />
          </button>
        );
      })}
      <span className="ml-1 w-9 text-right font-medium tabular-nums">{fmt(valor)}</span>
    </span>
  );
}
