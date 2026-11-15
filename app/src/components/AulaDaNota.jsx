import { useEffect, useMemo, useRef, useState } from "react";
import { html } from "@/lib/aulaHtml";
import { PainelGramatica } from "@/components/PainelGramatica";
import { invoke } from "@/lib/api";
import { parseAula, mermaidDe, secoesBrutas, trocarSecao, dadosDaAula } from "@/lib/aula";
import { acionarBotao } from "@/lib/blocoAcoes";
import { parseFm, setProp } from "@/lib/frontmatter";
import { lerCiclos } from "@/lib/ciclos";
import { ChevronDown, ChevronRight, Plus, Presentation } from "lucide-react";
import { Chips, Text } from "@/components/RightPanel";
import { Editor } from "@/components/Editor";
import { Carregando, Erro } from "@/components/ui/estado";
import { cn } from "@/lib/utils";

/** Cores do Mermaid tiradas das variáveis CSS do tema ativo (`--primary`, `--chart-*`…), para o mapa combinar com a interface. */
function variaveisMermaid() {
  const cs = getComputedStyle(document.documentElement);
  const c = (v, alt) => { const x = cs.getPropertyValue(v).trim(); return x ? `hsl(${x.replace(/\s+/g, ", ")})` : alt; };
  const escuro = document.documentElement.classList.contains("dark");
  // Os temas do shadcn trazem --chart-1..5; os demais caem em --primary, --ok, --warn, --err e --muted-foreground.
  const ramos = [["--chart-1", "--primary"], ["--chart-2", "--ok"], ["--chart-3", "--warn"], ["--chart-4", "--err"], ["--chart-5", "--muted-foreground"]]
    .map(([a, b]) => c(a, c(b, "#888")));
  const v = {
    darkMode: escuro, background: c("--background", "#fff"), fontFamily: cs.getPropertyValue("--font-sans").trim() || "inherit",
    primaryColor: c("--card", "#fff"), primaryTextColor: c("--foreground", "#222"), primaryBorderColor: c("--primary", "#888"),
    lineColor: c("--muted-foreground", "#888"), secondaryColor: c("--accent", "#eee"), tertiaryColor: c("--background", "#fff"),
    textColor: c("--foreground", "#222"), mainBkg: c("--card", "#fff"), nodeBorder: c("--primary", "#888"),
  };
  // Mindmap: cada ramo principal numa cor do tema, com o texto na cor de fundo (contraste).
  ramos.forEach((r, i) => { v[`cScale${i}`] = r; v[`cScaleLabel${i}`] = c("--background", "#fff"); });
  ramos.forEach((r, i) => { v[`cScale${i + 5}`] = ramos[(i + 2) % 5]; v[`cScaleLabel${i + 5}`] = c("--background", "#fff"); });
  return v;
}

export { html };

function Markdown({ md }) {
  const h = useMemo(() => html(md), [md]);
  return <div className="aula-md" onClick={(e) => { acionarBotao(e.target); }} dangerouslySetInnerHTML={{ __html: h }} />;
}

/** Mapa mental em Mermaid (carregado só quando a aba é aberta). Se o código falhar, mostra o texto-fonte. */
function Mindmap({ codigo }) {
  const [svg, setSvg] = useState(null), [erro, setErro] = useState("");
  const id = useRef("mm" + Math.random().toString(36).slice(2));
  useEffect(() => {
    let vivo = true; setSvg(null); setErro("");
    import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: variaveisMermaid() });
      const r = await mermaid.render(id.current + Math.random().toString(36).slice(2, 6), codigo);
      if (vivo) setSvg(r.svg);
    }).catch((e) => { if (vivo) setErro(String(e?.message ?? e)); });
    return () => { vivo = false; };
  }, [codigo]);
  if (erro) return <div><div className="mb-2 text-sm text-warn">Não deu para desenhar o mapa: {erro.split("\n")[0]}</div><pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">{codigo}</pre></div>;
  if (svg == null) return <Carregando className="p-0">Desenhando o mapa…</Carregando>;
  return <div className="overflow-auto rounded-xl border bg-background p-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
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
  useEffect(() => { ref.current?.setText(md); }, []); // só ao abrir: depois, quem manda é o editor
  return <div className="aula-ed"><Editor ref={ref} onChange={(doc) => onChange(doc.toString())} onSave={onSave} onLink={onLink} numeros={numeros} linhaInicial={linhaInicial} /></div>;
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

const STATUS = ["pendente", "andamento", "finalizado", "arquivado"];
const LISTAS = ["assuntos", "tags", "turmas", "habilidades"];

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
  if (!onRename) return <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">{nome}</h1>;
  return (
    <>
      {edit
        ? <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={() => fim(true)} aria-label={`Título d${rotulo === "aula" ? "a" : "o"} ${rotulo}`}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { e.preventDefault(); fim(false); } }}
            className="mt-1 w-full rounded-md border bg-background px-1.5 py-0.5 font-serif text-3xl font-semibold leading-tight" />
        : <h1 role="button" tabIndex={0} title={`Clique para renomear ${rotulo === "aula" ? "a" : "o"} ${rotulo}`} onClick={() => setEdit(true)} onKeyDown={(e) => e.key === "Enter" && setEdit(true)}
            className="mt-1 cursor-text rounded-sm font-serif text-3xl font-semibold leading-tight hover:bg-accent/60">{nome}</h1>}
      {erro && <div className="mt-1 text-xs text-err">{erro}</div>}
    </>
  );
}

/** Propriedades (frontmatter) da aula, editáveis aqui mesmo. */
function Propriedades({ texto, onSet, status }) {
  const fm = parseFm(texto), [novo, setNovo] = useState(null);
  const linhas = fm.entries.filter((e) => e.key !== "tipo");
  return (
    <div className="mt-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
        {linhas.map((e) => (
          <div key={e.key} className={LISTAS.includes(e.key) || e.items ? "sm:col-span-2" : undefined}>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{e.key}</div>
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
          </div>
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

function Dado({ nome, children, aviso }) {
  return <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-muted-foreground">{nome}</span><span className={cn("text-right font-medium", aviso && "text-warn")}>{children}</span></div>;
}

/** Quais ciclos citam esta aula (`[[nome]]` na tabela de aulas). */
function useCiclosDaAula(items, nome) {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    let vivo = true; setLista(null);
    if (!items?.length) return;
    const alvo = `[[${nome.toLowerCase()}`;
    lerCiclos(items).then(({ ciclos }) => {
      if (vivo) setLista(ciclos.map((c) => ({ nome: c.name, n: c.aulas.filter((x) => `${x.texto} ${x.recurso}`.toLowerCase().includes(alvo)).length })).filter((c) => c.n));
    }).catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [items, nome]);
  return lista;
}

/** Visão de uma aula do acervo: abas (objetivos, habilidades, conteúdo, mindmap, atividades) e as anotações na margem. */
export function AulaDaNota({ item, tick, onLink, textoInicial, numeros, onRename, info, items }) {
  const [t, setT] = useState(textoInicial ?? null), [erro, setErro] = useState(""), [aba, setAba] = useState(null);
  const [propsAbertas, setPropsAbertas] = useState(false), [vista, setVista] = useState(null);
  const [apresentar, setApresentar] = useState(() => { try { return localStorage.getItem("margem.aula.apresentacao") === "1"; } catch { return false; } });
  const rolagem = useRef(null);
  const [gram, setGram] = useState(null); // gramática aberta no painel lateral: { item, anchor }
  const gramaticas = (nome) => { const n = nome.split("/").pop().trim().toLowerCase(); return items?.find((i) => /^Acervo\/Gram[aá]tica\//.test(i.rel) && i.name.toLowerCase() === n) ?? null; };
  // `[[Crase]]` de uma gramática abre no painel; os demais links seguem o caminho de sempre.
  const aoLink = (alvo, ancora = "") => { const it = gramaticas(alvo); if (it) setGram({ item: it, anchor: ancora }); else onLink(alvo, ancora); };
  const ciclosDaAula = useCiclosDaAula(items, item.name);
  const texto = useRef(textoInicial ?? null), semLer = useRef(textoInicial != null), pend = useRef(null), timer = useRef(null), caminho = useRef(item.path);
  caminho.current = item.path;
  const gravar = async () => {
    clearTimeout(timer.current);
    const p = pend.current; if (!p || texto.current == null) return;
    pend.current = null;
    // várias seções podem estar pendentes (página única): de trás para frente, para um `##` novo não deslocar as demais
    let novo = texto.current;
    Object.keys(p.md).sort((x, y) => +y.slice(1) - +x.slice(1)).forEach((id) => { novo = trocarSecao(novo, id, p.md[id]); });
    texto.current = novo; setT(novo);
    try { await invoke("save_note", { path: p.path, text: novo }); } catch (e) { setErro(String(e)); }
  };
  const gravarRef = useRef(gravar); gravarRef.current = gravar;
  useEffect(() => () => { gravarRef.current(); }, [item.path]); // ao sair da nota, grava o que faltar
  useEffect(() => { if (semLer.current) { semLer.current = false; return; } /* o App já leu a nota: sem tela de "Lendo…" ao abrir */ setT(null); setErro(""); invoke("read_note", { path: item.path }).then((x) => { texto.current = x; setT(x); }).catch((e) => setErro(String(e))); }, [item.path, tick]);
  const mudarProp = async (chave, valor) => {
    await gravar();
    const novo = setProp(texto.current, chave, valor);
    texto.current = novo; setT(novo);
    try { await invoke("save_note", { path: caminho.current, text: novo }); } catch (e) { setErro(String(e)); }
  };
  const renomear = async (novoNome) => {
    await gravar();
    const velho = item.name, novoPath = await onRename(item.path, novoNome);
    try { // o "# Título" do corpo acompanha o nome do arquivo, se era igual
      const x = await invoke("read_note", { path: novoPath }), re = new RegExp(`^# ${velho.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
      if (re.test(x)) await invoke("save_note", { path: novoPath, text: x.replace(re, `# ${novoNome}`) });
    } catch { /* sem ajuste do título interno */ }
  };
  const editar = (id, md) => { pend.current = { path: caminho.current, md: { ...(pend.current?.path === caminho.current ? pend.current.md : {}), [id]: md } }; clearTimeout(timer.current); timer.current = setTimeout(gravar, 600); };
  const a = useMemo(() => (t == null ? null : parseAula(t)), [t]);
  useEffect(() => { setAba(null); setVista(null); }, [item.path]);
  const alternar = async () => { await gravar(); const v = !apresentar; setApresentar(v); try { localStorage.setItem("margem.aula.apresentacao", v ? "1" : "0"); } catch { /* sem armazenamento */ } };
  // Destaque da seção atual ao rolar: a última cujo topo já passou da barra fixa.
  const aoRolar = () => {
    const r = rolagem.current; if (!r || apresentar) return;
    const topo = r.getBoundingClientRect().top + 90, fim = r.scrollTop + r.clientHeight >= r.scrollHeight - 4;
    const els = [...r.querySelectorAll("[data-sec]")];
    const el = fim ? els[els.length - 1] : els.filter((e) => e.getBoundingClientRect().top <= topo).pop() ?? els[0];
    setVista(el?.dataset.sec ?? null);
  };
  const ir = async (x) => {
    await gravar();
    if (apresentar) { setAba(x.id); return; }
    setVista(x.id); rolagem.current?.querySelector(`[data-sec="${x.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  if (erro) return <Erro>{erro}</Erro>;
  if (!a) return <Carregando>Lendo a aula…</Carregando>;

  const abas = [...(a.intro ? [{ id: "intro", nome: "Introdução", md: a.intro }] : []), ...a.secoes];
  const brutas = secoesBrutas(texto.current ?? t);
  const padrao = abas.find((x) => x.tipo === "conteudo") ?? abas[0];
  const atual = apresentar ? (abas.find((x) => x.id === aba) ?? padrao) : (abas.find((x) => x.id === vista) ?? abas[0]);
  const chips = [a.meta.status, a.meta.ano && `${a.meta.ano}º ano`, a.meta.assuntos].filter(Boolean);
  const dados = dadosDaAula(a, t);
  const Seta = propsAbertas ? ChevronDown : ChevronRight;
  const mostradas = apresentar ? (atual ? [atual] : []) : abas;
  const secao = (x) => {
    const bruta = brutas.find((b) => b.id === x.id);
    return (
      <section key={x.id} data-sec={x.id} aria-label={x.nome} className="scroll-mt-16 pb-10 last:pb-4">
        {bruta ? (
          <>
            {x.tipo === "habilidades" && a.codigos.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{a.codigos.map((c) => <span key={c} className="rounded-full border px-2.5 py-0.5 font-mono text-xs">{c}</span>)}</div>}
            {mermaidDe(x.md) && <div className="mb-4"><QuandoVisivel altura={240}><Mindmap codigo={mermaidDe(x.md)} /></QuandoVisivel></div>}
            <EditorSecao key={`${item.path}:${x.id}:${brutas.length}`} md={bruta.md} onChange={(md) => editar(x.id, md)} onSave={gravar} onLink={aoLink} numeros={numeros} linhaInicial={bruta.linha0} />
          </>
        ) : <><p className="mb-2 text-xs text-muted-foreground">Este trecho (antes do primeiro ##) se edita no modo Markdown.</p><Markdown md={x.md} /></>}
      </section>
    );
  };
  return (
    <div className="flex min-h-0 flex-1">
    <div ref={rolagem} onScroll={aoRolar} className="min-h-0 min-w-0 flex-1 overflow-auto">
      <div className="px-8 pt-8">
        <div className="max-w-3xl">
          <div className="text-xs text-muted-foreground">Aula do acervo</div>
          <TituloEditavel nome={item.name} onRename={onRename ? renomear : null} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {chips.map((c) => <span key={c} className="rounded-full bg-accent px-2.5 py-0.5 text-xs">{c}</span>)}
            <button onClick={() => setPropsAbertas(!propsAbertas)} aria-expanded={propsAbertas} className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Seta className="h-3.5 w-3.5" />Propriedades</button>
          </div>
          {propsAbertas && <Propriedades texto={texto.current ?? t} onSet={mudarProp} status={info?.status?.length ? info.status : STATUS} />}
        </div>
      </div>
      {/* Sumário: chips que ficam presos no topo ao rolar; na página única levam à seção, na apresentação trocam a seção mostrada */}
      <nav aria-label="Sumário da aula" className="sticky top-0 z-10 bg-background/95 px-8 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-3xl">
          <Abas rotulo="Partes da aula" abas={abas} atual={atual} onSelect={ir} mt="mt-0"
            extra={<button onClick={alternar} aria-pressed={apresentar} title="Mostra uma seção por vez, para projetar" className={cn("mb-1 ml-auto flex h-7 items-center gap-1.5 rounded-md px-2 text-xs", apresentar ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}><Presentation className="h-3.5 w-3.5" />Apresentação</button>} />
        </div>
      </nav>
      {/* Aula (largura limitada para leitura) + Margem (o resto da largura) */}
      <div className="grid items-start gap-x-10 px-8 pb-8" style={{ gridTemplateColumns: gram ? "minmax(0, 1fr)" : "minmax(0, 48rem) minmax(15rem, 1fr)" }}>
        <div className="col-start-1 row-start-1 min-w-0 pt-6">
          {mostradas.map(secao)}
          {!atual && <p className="text-sm text-muted-foreground">Esta aula ainda não tem conteúdo.</p>}
        </div>
        <aside aria-label="Margem" className={cn("min-w-0 space-y-6 pt-6", gram ? "col-start-1 row-start-2" : "sticky top-16 col-start-2 row-start-1 max-h-[calc(100vh-5rem)] overflow-auto")}>
          <section className="flex flex-col gap-3 border-l-2 border-err pl-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Na margem</h2>
            {a.notas.length === 0
              ? <p className="text-sm text-muted-foreground">Sem anotações. Escreva uma em Markdown com <code>&gt; [!margem]</code>.</p>
              : a.notas.map((n, i) => <div key={i} className="text-sm"><Markdown md={n} /></div>)}
          </section>
          <section aria-label="Dados da aula" className="flex flex-col gap-1.5 border-l-2 border-border pl-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados da aula</h2>
            <Dado nome="Mindmap" aviso={!dados.mindmap}>{dados.mindmap ? "sim" : "não tem"}</Dado>
            <Dado nome="Objetivos">{dados.objetivos}</Dado>
            <Dado nome="Habilidades (BNCC)">{dados.habilidades}</Dado>
            <Dado nome="Atividades" aviso={!dados.atividades}>{dados.atividades}</Dado>
            <Dado nome="Conteúdo"><span className="whitespace-nowrap">{dados.palavras} palavras · ~{Math.max(1, Math.round(dados.palavras / 200))} min</span></Dado>
            {dados.imagens > 0 && <Dado nome="Imagens">{dados.imagens}</Dado>}
            {dados.links > 0 && <Dado nome="Links para notas">{dados.links}</Dado>}
            <div className="text-sm"><span className="text-muted-foreground">Usada em</span>
              {ciclosDaAula == null ? <span className="ml-2">…</span> : ciclosDaAula.length
                ? <ul className="mt-0.5 list-disc pl-5">{ciclosDaAula.map((c) => <li key={c.nome}>{c.nome}</li>)}</ul>
                : <span className="float-right font-medium text-warn">nenhum ciclo</span>}
            </div>
            {dados.faltam.length > 0 && <p className="mt-1 text-xs text-warn">Seções vazias: {dados.faltam.map((id) => ({ objetivos: "Objetivos", habilidades: "Habilidades", conteudo: "Conteúdo", atividades: "Atividades" })[id]).join(", ")}.</p>}
          </section>
        </aside>
      </div>
    </div>
    {gram && <PainelGramatica item={gram.item} anchor={gram.anchor} gramaticas={gramaticas} onNavegar={(it, anchor) => setGram({ item: it, anchor })} onAbrir={onLink} onFechar={() => setGram(null)} />}
    </div>
  );
}
