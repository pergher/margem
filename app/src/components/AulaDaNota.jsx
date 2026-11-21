import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorView } from "@codemirror/view";
import { html } from "@/lib/aulaHtml";
import { PainelGramatica } from "@/components/PainelGramatica";
import { invoke } from "@/lib/api";
import { desenharMermaid, partirMermaid } from "@/lib/mermaid";
import { parseAula, secoesBrutas, trocarSecao, corpoBruto, trocarCorpo, acrescentarMemoria } from "@/lib/aula";
import { DaUltimaVez, NotaDestaVez } from "@/components/MemoriaDaAula";
import { JogoDialog } from "@/components/JogoDialog";
import { acionarBotao } from "@/lib/blocoAcoes";
import { parseFm, setProp } from "@/lib/frontmatter";
import { IconChevronDown as ChevronDown, IconPlus as Plus, IconNote as StickyNote, IconPencil as Pencil, IconCheck as Check, IconList as List, IconX as X } from "@tabler/icons-react";
import { lerSemanas, situacaoAula } from "@/lib/semana";
import { useEhCompacto } from "@/lib/useCompacto";
import { Chips, Text, Historico } from "@/components/RightPanel";
import { Editor } from "@/components/Editor";
import { Carregando, Erro, useToast } from "@/components/ui/estado";
import { cn } from "@/lib/utils";

export { html };

function Markdown({ md }) {
  const h = useMemo(() => html(md), [md]);
  return <div className="aula-md" onClick={(e) => { acionarBotao(e.target); }} dangerouslySetInnerHTML={{ __html: h }} />;
}

/** Mapa mental em Mermaid, no lugar do código (visão de leitura do celular). Se o código falhar, mostra o texto-fonte. */
function Mindmap({ codigo }) {
  const [svg, setSvg] = useState(null), [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true; setSvg(null); setErro("");
    desenharMermaid(codigo).then((r) => { if (vivo) setSvg(r); }).catch((e) => { if (vivo) setErro(String(e?.message ?? e)); });
    return () => { vivo = false; };
  }, [codigo]);
  if (erro) return <div><div className="mb-2 text-sm text-warn">Não deu para desenhar o mapa: {erro.split("\n")[0]}</div><pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">{codigo}</pre></div>;
  if (svg == null) return <Carregando className="p-0">Desenhando o mapa…</Carregando>;
  return <div className="overflow-auto rounded-xl border bg-background p-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Markdown da seção com o mapa mental no lugar do bloco ```mermaid (e não separado, acima do texto). */
function MarkdownComMapa({ md }) {
  return partirMermaid(md).map((p, i) => (p.tipo === "mermaid"
    ? <div key={i} className="my-4"><QuandoVisivel altura={240}><Mindmap codigo={p.codigo} /></QuandoVisivel></div>
    : <Markdown key={i} md={p.md} />));
}

/** Só monta os filhos quando o bloco chega perto da tela (o Mermaid de seções lá embaixo não pesa na abertura). */
function QuandoVisivel({ children, altura = 120 }) {
  const ref = useRef(null), [ver, setVer] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (ver || !ref.current) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVer(true); o.disconnect(); } }, { rootMargin: "300px" });
    o.observe(ref.current);
    return () => o.disconnect();
  }, [ver]);
  return ver ? children : <div ref={ref} style={{ minHeight: altura }} />;
}

/** Seção editável com o mesmo editor ao vivo do modo Markdown; `onChange(md)` recebe o corpo da seção. */
export function EditorSecao({ md, onChange, onSave, onLink, numeros, linhaInicial }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.setText(md, false); }, []); // só ao abrir: depois, quem manda é o editor
  return <div className="aula-ed"><Editor ref={ref} onChange={(doc) => onChange(doc.toString())} onSave={onSave} onLink={onLink} numeros={numeros} linhaInicial={linhaInicial} /></div>;
}

/** A nota inteira (depois do frontmatter) num editor ao vivo só, como no modo Markdown: a seleção atravessa os títulos. */
function EditorCorpo({ md, onChange, onSave, onLink, numeros, linhaInicial }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.setText(md, false); }, []); // só ao abrir: depois, quem manda é o editor
  return <div className="aula-ed aula-corpo"><Editor ref={ref} onChange={(doc) => onChange(doc.toString())} onSave={onSave} onLink={onLink} numeros={numeros} linhaInicial={linhaInicial} /></div>;
}

/** Abas minimalistas: texto com filete sob a ativa; a linha que corre sob todas separa o cabeçalho do editor. */
export function Abas({ rotulo, abas, atual, onSelect, extra, mt = "mt-5" }) {
  return (
    <div role="tablist" aria-label={rotulo} className={cn(mt, "flex flex-wrap items-end gap-x-1 border-b")}>
      {abas.map((x) => (
        <button key={x.id} role="tab" aria-selected={atual === x} onClick={() => onSelect(x)}
          className={cn("-mb-px flex h-9 items-center rounded-t-md border-b-2 px-3 text-sm transition-colors", atual === x ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>{x.nome}</button>
      ))}
      {extra}
    </div>
  );
}

export const STATUS = ["pendente", "andamento", "finalizado", "arquivado"];
const LISTAS = ["assuntos", "tags", "turmas", "habilidades"];

/** Teclado no topo da aula: ↑/↓ andam entre título, status e o primeiro editor (elementos `data-topo-aula`). */
function andarNoTopo(e, dir) {
  const topos = [...document.querySelectorAll("[data-topo-aula]")], i = topos.indexOf(e.currentTarget), prox = topos[i + dir];
  e.preventDefault();
  if (prox) { prox.focus(); return; }
  if (dir > 0) {
    const ed = document.querySelector(".aula-ed .cm-content"), v = ed && EditorView.findFromDOM(ed);
    if (v) { v.focus(); v.dispatch({ selection: { anchor: 0 }, scrollIntoView: true }); }
  }
}

/** Título que vira campo ao clicar (renomeia o arquivo); Enter grava, Esc cancela. */
export function TituloEditavel({ nome, onRename, rotulo = "aula" }) {
  const [edit, setEdit] = useState(false), [v, setV] = useState(nome), [erro, setErro] = useState("");
  useEffect(() => { setV(nome); setEdit(false); }, [nome]);
  const fim = async (grava) => {
    const novo = v.replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/\s+/g, " ").trim();
    setEdit(false);
    if (!grava || !novo || novo === nome) { setV(nome); return; }
    try { setErro(""); await onRename(novo); } catch (e) { setV(nome); setErro(String(e?.message ?? e)); }
  };
  if (!onRename) return <h1 className="mt-1 font-serif text-2xl font-semibold leading-tight md:text-3xl">{nome}</h1>;
  return (
    <>
      {edit
        ? <input autoFocus data-topo-aula value={v} onChange={(e) => setV(e.target.value)} onBlur={() => fim(true)} aria-label={`Título d${rotulo === "aula" ? "a" : "o"} ${rotulo}`}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { e.preventDefault(); fim(false); } else if (e.key === "ArrowDown") { const el = e.currentTarget; andarNoTopo(e, 1); el.blur(); } }}
            className="mt-1 w-full rounded-md border bg-background px-1.5 py-0.5 font-serif text-2xl font-semibold leading-tight md:text-3xl" />
        : <h1 role="button" tabIndex={0} data-topo-aula title={`Clique para renomear ${rotulo === "aula" ? "a" : "o"} ${rotulo}`} onClick={() => setEdit(true)}
            onKeyDown={(e) => { if (e.key === "Enter") setEdit(true); else if (e.key === "ArrowDown") andarNoTopo(e, 1); else if (e.key === "ArrowUp") andarNoTopo(e, -1); }}
            className="mt-1 cursor-text rounded-sm font-serif text-2xl font-semibold leading-tight md:text-3xl hover:bg-accent/60">{nome}</h1>}
      {erro && <div className="mt-1 text-xs text-err">{erro}</div>}
    </>
  );
}

/** Propriedades (frontmatter) da aula, editáveis aqui mesmo. */
export function Propriedades({ texto, onSet, status }) {
  const fm = parseFm(texto), [novo, setNovo] = useState(null);
  const linhas = fm.entries.filter((e) => e.key !== "tipo");
  return (
    <div>
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5">
        {linhas.map((e) => (
          <Fragment key={e.key}>
            <div className="pt-1 text-xs capitalize text-muted-foreground">{e.key}</div>
            {e.items || LISTAS.includes(e.key)
              ? <Chips items={e.items ?? []} onChange={(it) => onSet(e.key, it)} />
              : e.key === "status"
                ? <select value={e.value} onChange={(ev) => onSet("status", ev.target.value)} className="h-7 w-full rounded-md border bg-background px-1.5 text-xs">
                    {!status.includes(e.value) && <option value={e.value}>{e.value || "—"}</option>}
                    {status.map((x) => <option key={x}>{x}</option>)}
                  </select>
                : e.key === "ano"
                  ? <select value={e.value} onChange={(ev) => onSet("ano", ev.target.value)} className="h-7 w-full rounded-md border bg-background px-1.5 text-xs">
                      <option value="">—</option>{["6", "7", "8", "9"].map((x) => <option key={x} value={x}>{x}º ano</option>)}
                    </select>
                  : <Text value={e.value} onCommit={(v) => onSet(e.key, v)} />}
          </Fragment>
        ))}
      </div>
      {novo === null
        ? <button onClick={() => setNovo("")} className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" />Propriedade</button>
        : <input autoFocus value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="nome da propriedade" onBlur={() => setNovo(null)}
            onKeyDown={(e) => { if (e.key === "Enter" && /^[\w-]+$/.test(novo.trim()) && !fm.entries.some((x) => x.key === novo.trim())) { onSet(novo.trim(), LISTAS.includes(novo.trim()) ? [] : ""); setNovo(null); } else if (e.key === "Escape") setNovo(null); }}
            className="mt-3 h-7 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-primary" />}
    </div>
  );
}

export function Dado({ nome, children, aviso }) {
  return <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-muted-foreground">{nome}</span><span className={cn("text-right font-medium", aviso && "text-warn")}>{children}</span></div>;
}

/** Casca do painel lateral das visões personalizadas: abas Ficha e Conexões (com selo de avisos) e a área rolável. */
export function PainelShell({ rotulo, aba, setAba, avisos = 0, ficha, conexoes }) {
  return (
    <aside aria-label={rotulo} className="flex h-full w-80 shrink-0 flex-col border-l bg-muted/50">
      <div role="tablist" className="flex shrink-0 gap-1 border-b px-3 pt-2">
        {[["ficha", "Ficha"], ["conexoes", "Conexões"]].map(([id, nome]) => (
          <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
            className={cn("-mb-px h-9 border-b-2 px-3 text-sm", aba === id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {nome}{id === "conexoes" && avisos > 0 && <span className="ml-1.5 rounded-full bg-warn px-1.5 text-[10px] leading-4 text-white">{avisos}</span>}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4"><div className="space-y-6">{aba === "ficha" ? ficha : conexoes}</div></div>
    </aside>
  );
}

export const TituloPainel = ({ children }) => <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;

/** Avisos, menções (backlinks) e histórico: a parte "Conexões" comum a todas as visões. */
export function ConexoesComuns({ info, onOpen, path, texto, onRestore, histTick, nome }) {
  return (
    <>
      {info?.issues?.length > 0 && <section><TituloPainel>Avisos ({info.issues.length})</TituloPainel>
        <ul className="space-y-1 text-xs">{info.issues.map((i, k) => <li key={k}><span className="text-muted-foreground">linha {i.line} · </span>{i.msg}</li>)}</ul></section>}
      <section><TituloPainel>Mencionad{nome === "banco" ? "o" : "a"} em ({info?.backlinks?.length ?? 0})</TituloPainel>
        {!info?.backlinks?.length ? <p className="text-sm text-muted-foreground">Nenhum arquivo aponta para {nome === "banco" ? "este banco" : "esta aula"}.</p>
          : info.backlinks.map((b) => (
            <button key={b.path} onClick={() => onOpen(b.path)} title={b.rel} className="-mx-2 flex w-[calc(100%+1rem)] flex-col rounded-md px-2 py-1.5 text-left hover:bg-accent">
              <span className="truncate text-sm">{b.name}</span><span className="truncate text-xs text-muted-foreground">{b.rel.split("/").slice(0, -1).join(" / ")}</span>
            </button>))}
      </section>
      <section><TituloPainel>Histórico</TituloPainel>
        <div className="-mx-2 flex flex-col"><Historico path={path} text={texto} onRestore={onRestore} tick={histTick} /></div>
      </section>
    </>
  );
}

/** Visão de uma aula do acervo: abas (objetivos, habilidades, conteúdo, mindmap, atividades) e as anotações na margem. */
export function AulaDaNota({ item, tick, onLink, onOpen, textoInicial, numeros, onRename, info, items, onTexto, onGramatica }) {
  const [t, setT] = useState(textoInicial ?? null), [erro, setErro] = useState("");
  const [vista, setVista] = useState(null), [prog, setProg] = useState(0), [rev, setRev] = useState(0); // rev: muda quando o texto muda por fora do editor (memória) e ele precisa recomeçar
  const [jogo, setJogo] = useState(false);
  const compacto = useEhCompacto(), toast = useToast();
  const [recolhidas, setRecolhidas] = useState(() => new Set()), [editando, setEditando] = useState(null); // celular: seções recolhidas; só uma seção em edição
  const [gaveta, setGaveta] = useState(false), [anotando, setAnotando] = useState(false);
  const toque = useRef(null);
  const [slot, setSlot] = useState(null); // lugar, no cabeçalho do app, onde o sumário se junta aos breadcrumbs
  useEffect(() => { setSlot(document.getElementById("slot-ferramentas") ?? document.getElementById("slot-barra-aula")); });
  const rolagem = useRef(null);
  const [gram, setGram] = useState(null); // gramática aberta no painel lateral: { item, anchor }
  const gramaticas = (nome) => { const n = nome.split("/").pop().trim().toLowerCase(); return items?.find((i) => /^Acervo\/Gram[aá]tica\//.test(i.rel) && i.name.toLowerCase() === n) ?? null; };
  // `[[Crase]]` de uma gramática abre no painel; os demais links seguem o caminho de sempre.
  useEffect(() => { onGramatica?.(!!gram); return () => onGramatica?.(false); }, [gram, onGramatica]);
  const aoLink = (alvo, ancora = "") => { const it = gramaticas(alvo); if (it) setGram({ item: it, anchor: ancora }); else onLink(alvo, ancora); };
  const texto = useRef(textoInicial ?? null), semLer = useRef(textoInicial != null), pend = useRef(null), timer = useRef(null), caminho = useRef(item.path);
  caminho.current = item.path;
  const gravar = async () => {
    clearTimeout(timer.current);
    const p = pend.current; if (!p || texto.current == null) return;
    pend.current = null;
    let novo = texto.current;
    if (p.corpo != null) novo = trocarCorpo(novo, p.corpo); // computador: a nota inteira é um editor só
    // celular: várias seções podem estar pendentes; de trás para frente, para um `##` novo não deslocar as demais
    else Object.keys(p.md).sort((x, y) => +y.slice(1) - +x.slice(1)).forEach((id) => { novo = trocarSecao(novo, id, p.md[id]); });
    texto.current = novo; setT(novo);
    try { await invoke("save_note", { path: p.path, text: novo }); onTexto?.(novo); } catch (e) { setErro(String(e)); }
  };
  const gravarRef = useRef(gravar); gravarRef.current = gravar;
  useEffect(() => () => { gravarRef.current(); }, [item.path]); // ao sair da nota, grava o que faltar
  useEffect(() => { if (semLer.current) { semLer.current = false; return; } /* o App já leu a nota: sem tela de "Lendo…" ao abrir */ setT(null); setErro(""); invoke("read_note", { path: item.path }).then((x) => { texto.current = x; setT(x); }).catch((e) => setErro(String(e))); }, [item.path, tick]);
  const mudarProp = async (chave, valor) => {
    await gravar();
    const novo = setProp(texto.current, chave, valor);
    texto.current = novo; setT(novo);
    try { await invoke("save_note", { path: caminho.current, text: novo }); onTexto?.(novo); } catch (e) { setErro(String(e)); }
  };
  const adicionarMemoria = async (nota) => {
    await gravar();
    const d = new Date(), data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const novo = acrescentarMemoria(texto.current, { ...nota, data });
    if (novo === texto.current) return;
    await invoke("save_note", { path: caminho.current, text: novo }); onTexto?.(novo);
    texto.current = novo; setT(novo); setRev((n) => n + 1);
  };
  const renomear = async (novoNome) => {
    await gravar();
    const velho = item.name, novoPath = await onRename(item.path, novoNome);
    try { // o "# Título" do corpo acompanha o nome do arquivo, se era igual
      const x = await invoke("read_note", { path: novoPath }), re = new RegExp(`^# ${velho.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
      if (re.test(x)) await invoke("save_note", { path: novoPath, text: x.replace(re, `# ${novoNome}`) });
    } catch { /* sem ajuste do título interno */ }
  };
  const editarCorpo = (md) => { pend.current = { path: caminho.current, corpo: md }; clearTimeout(timer.current); timer.current = setTimeout(gravar, 600); };
  const editar = (id, md) => { pend.current = { path: caminho.current, md: { ...(pend.current?.path === caminho.current ? pend.current.md : {}), [id]: md } }; clearTimeout(timer.current); timer.current = setTimeout(gravar, 600); };
  const a = useMemo(() => (t == null ? null : parseAula(t)), [t]);
  useEffect(() => { setVista(null); setEditando(null); setRecolhidas(new Set()); setGaveta(false); setAnotando(false); }, [item.path]);
  // Destaque da seção atual ao rolar: a última cujo topo já passou da barra fixa.
  const aoRolar = () => {
    const r = rolagem.current; if (!r) return;
    setProg(r.scrollHeight > r.clientHeight ? r.scrollTop / (r.scrollHeight - r.clientHeight) : 0);
    const topo = r.getBoundingClientRect().top + 90, fim = r.scrollTop + r.clientHeight >= r.scrollHeight - 4;
    const els = [...r.querySelectorAll("[data-sec]")];
    const el = fim ? els[els.length - 1] : els.filter((e) => e.getBoundingClientRect().top <= topo).pop() ?? els[0];
    setVista(el?.dataset.sec ?? null);
  };
  const ir = async (x) => {
    await gravar();
    setVista(x.id); rolagem.current?.querySelector(`[data-sec="${x.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // "Dar aula ✓": marca como dada, na Semana, a próxima aula ainda sem situação que cita esta nota.
  const darAula = async () => {
    try {
      const alvo = `[[${item.name.toLowerCase()}`;
      for (const sem of [...await lerSemanas(items)].reverse()) {
        for (const t of sem.turmas) {
          const aula = t.aulas.find((x) => !x.situacao && `${x.texto} ${x.recurso}`.toLowerCase().includes(alvo));
          if (!aula) continue;
          await invoke("save_note", { path: sem.path, text: situacaoAula(await invoke("read_note", { path: sem.path }), t.turma, aula.n, "dada") });
          toast(`Aula dada: turma ${t.turma}.`, { tipo: "ok" });
          return;
        }
      }
      toast("Esta aula não está na Semana, ou já foi dada.", { tipo: "warn" });
    } catch (e) { toast(`Não deu para marcar: ${e.message ?? e}`, { tipo: "err" }); }
  };
  // Arrastar para a esquerda abre o sumário; para a direita fecha.
  const aoTocar = { onTouchStart: (e) => { toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
    onTouchEnd: (e) => { const t0 = toque.current; toque.current = null; if (!t0) return; const dx = e.changedTouches[0].clientX - t0.x, dy = e.changedTouches[0].clientY - t0.y;
      if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) setGaveta(dx < 0); } };
  if (erro) return <Erro>{erro}</Erro>;
  if (!a) return <Carregando>Lendo a aula…</Carregando>;

  const abas = [...(a.intro ? [{ id: "intro", nome: "Introdução", md: a.intro }] : []), ...a.secoes];
  const brutas = secoesBrutas(texto.current ?? t), corpo = corpoBruto(texto.current ?? t);
  const atual = abas.find((x) => x.id === vista) ?? abas[0];
  const notasDe = (x) => (x.id === "intro" ? a.introNotas : x.notas) ?? [];
  const largura = compacto ? "100%" : "44rem";
  const secaoCompacta = (x) => {
    const bruta = brutas.find((b) => b.id === x.id), notas = notasDe(x);
    const aberta = !recolhidas.has(x.id), emEdicao = editando === x.id && !!bruta;
    const alternar = () => setRecolhidas((r) => { const n = new Set(r); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; });
    return (
      <section key={x.id} data-sec={x.id} aria-label={x.nome} className="scroll-mt-4 border-b py-1 last:border-b-0">
        <div className="flex items-center">
          <button type="button" aria-expanded={aberta} onClick={alternar} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left font-serif text-lg font-semibold">
            <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !aberta && "-rotate-90")} />{x.nome}
          </button>
          {aberta && bruta && <button type="button" aria-pressed={emEdicao} aria-label={emEdicao ? `Concluir a edição de ${x.nome}` : `Editar ${x.nome}`} onClick={async () => { await gravar(); setEditando(emEdicao ? null : x.id); }}
            className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-accent", emEdicao ? "bg-primary/10 text-primary" : "text-muted-foreground")}>{emEdicao ? <Check className="h-5 w-5" /> : <Pencil className="h-5 w-5" strokeWidth={1.7} />}</button>}
        </div>
        {aberta && (
          <div className="min-w-0 pb-4">
            {x.tipo === "habilidades" && a.codigos.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{a.codigos.map((c) => <span key={c} className="rounded-full border px-2.5 py-0.5 font-mono text-xs">{c}</span>)}</div>}
            {emEdicao
              ? <EditorSecao key={`${item.path}:${x.id}:${brutas.length}`} md={bruta.md} onChange={(md) => editar(x.id, md)} onSave={gravar} onLink={aoLink} numeros={numeros} linhaInicial={bruta.linha0} />
              : <MarkdownComMapa md={x.md} />}
            {notas.length > 0 && <aside aria-label={`Na margem: ${x.nome}`} className="mt-3 flex flex-col gap-3">
              {notas.map((n, i) => <div key={i} className="border-l-2 border-err pl-3 text-sm text-muted-foreground"><Markdown md={n} /></div>)}
            </aside>}
          </div>
        )}
      </section>
    );
  };
  const statusLista = info?.status?.length ? info.status : STATUS;
  const meta = [a.meta.ano && `${a.meta.ano}º ano`, a.meta.assuntos].filter(Boolean);
  return (
    <div className="flex min-h-0 flex-1">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* O sumário do celular entra no cabeçalho do app; a linha fina abaixo mostra quanto da aula já foi lido */}
      {slot && compacto && createPortal(<><div className="flex-1" /><button type="button" aria-label="Sumário da aula" onClick={() => setGaveta(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"><List className="h-5 w-5" strokeWidth={1.7} /></button></>, slot)}
      <div role="progressbar" aria-label="Progresso de leitura" aria-valuenow={Math.round(prog * 100)} aria-valuemin={0} aria-valuemax={100} className="h-0.5 shrink-0 bg-border"><div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${prog * 100}%` }} /></div>
      <div ref={rolagem} onScroll={aoRolar} {...(compacto ? aoTocar : {})} className="min-h-0 min-w-0 flex-1 overflow-auto">
        <div className={compacto ? "px-4 pt-4" : "px-8 pt-8"}>
          <div className="mx-auto" style={{ maxWidth: largura }}>
            <div className="text-xs text-muted-foreground">Aula do acervo</div>
            <TituloEditavel nome={item.name} onRename={onRename ? renomear : null} />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-accent py-0.5 pl-2.5 pr-2 text-xs font-medium text-foreground hover:bg-accent/70 focus-within:ring-2 focus-within:ring-ring" title="Clique para mudar o status">
                <span className={cn("h-1.5 w-1.5 rounded-full", a.meta.status === "finalizado" ? "bg-ok" : a.meta.status ? "bg-warn" : "bg-muted-foreground")} />
                {a.meta.status || "sem status"}<ChevronDown className="h-3 w-3 text-muted-foreground" />
                <select aria-label="Status da aula" data-topo-aula value={a.meta.status} onChange={(e) => mudarProp("status", e.target.value)}
                  onKeyDown={(e) => { if (e.altKey) return; if (e.key === "ArrowDown") andarNoTopo(e, 1); else if (e.key === "ArrowUp") andarNoTopo(e, -1); }} className="absolute inset-0 cursor-pointer opacity-0">
                  {!statusLista.includes(a.meta.status) && <option value={a.meta.status}>{a.meta.status || "sem status"}</option>}
                  {statusLista.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
              {meta.map((m) => <span key={m}>{m}</span>)}
              {!compacto && <button onClick={() => setJogo(true)} className="font-medium text-primary hover:underline">Gerar jogo</button>}
            </div>
            <DaUltimaVez entradas={a.memoria} />
          </div>
        </div>
        <div className={cn("mx-auto pt-4", compacto ? "px-4 pb-6" : "px-8 pb-8")} style={{ maxWidth: compacto ? "100%" : `calc(${largura} + 4rem)` }}>
          {compacto ? abas.map(secaoCompacta) : <EditorCorpo key={`${item.path}:${rev}`} md={corpo.md} linhaInicial={corpo.ini} onChange={editarCorpo} onSave={gravar} onLink={aoLink} numeros={numeros} />}
          {compacto && !atual && <p className="text-sm text-muted-foreground">Esta aula ainda não tem conteúdo.</p>}
          {!compacto && <div className="mt-2"><NotaDestaVez key={item.path} onAdicionar={adicionarMemoria} /></div>}
        </div>
      </div>
      {compacto && (
        <div className="flex shrink-0 gap-2 border-t bg-background px-3 py-2">
          <button type="button" onClick={() => setAnotando(true)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium hover:bg-accent"><StickyNote aria-hidden className="h-5 w-5" strokeWidth={1.6} />Anotar</button>
          <button type="button" onClick={darAula} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90"><Check aria-hidden className="h-5 w-5" />Dar aula</button>
        </div>
      )}
      {compacto && anotando && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setAnotando(false)}>
          <div className="w-full rounded-t-2xl bg-background p-3 pb-6" onClick={(e) => e.stopPropagation()}>
            <NotaDestaVez key={item.path} aberto onFechar={() => setAnotando(false)} onAdicionar={adicionarMemoria} />
          </div>
        </div>
      )}
      {compacto && gaveta && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setGaveta(false)} {...aoTocar}>
          <nav aria-label="Sumário da aula" className="flex h-full w-72 max-w-[85%] flex-col bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex min-h-12 items-center justify-between border-b px-4"><span className="font-semibold">Nesta aula</span>
              <button type="button" aria-label="Fechar o sumário" onClick={() => setGaveta(false)} className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent"><X className="h-5 w-5" /></button></div>
            <ul className="min-h-0 flex-1 overflow-auto p-2">
              {abas.map((x) => (
                <li key={x.id}><button type="button" onClick={() => { setRecolhidas((r) => { const n = new Set(r); n.delete(x.id); return n; }); setGaveta(false); setTimeout(() => ir(x), 60); }}
                  className={cn("flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-accent", atual === x && "bg-primary/10 font-medium text-primary")}>{x.nome}</button></li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
    {jogo && <JogoDialog items={items} aula={item.name} textoAula={texto.current ?? t} onClose={() => setJogo(false)} />}
    {gram && <PainelGramatica item={gram.item} anchor={gram.anchor} gramaticas={gramaticas} onNavegar={(it, anchor) => setGram({ item: it, anchor })} onAbrir={onLink} onFechar={() => setGram(null)} />}
    </div>
  );
}
