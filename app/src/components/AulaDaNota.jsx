import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { invoke } from "@/lib/api";
import { parseAula, mermaidDe, secoesBrutas, trocarSecao } from "@/lib/aula";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
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

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const LABEL = { tip: "Dica", professor: "Dica para o professor", note: "Nota", abstract: "Resumo", info: "Informação", warning: "Atenção", attention: "Atenção", example: "Exemplo", question: "Pergunta", important: "Importante" };
marked.use({
  gfm: true,
  renderer: {
    html: ({ text }) => esc(text), // sem HTML cru vindo do arquivo
    blockquote(token) {
      const inner = this.parser.parse(token.tokens), m = /^<p>\[!([\w-]+)\][+-]?\s*/.exec(inner);
      return m ? `<div class="aula-callout aula-callout-${m[1].toLowerCase()}"><div class="aula-callout-t">${LABEL[m[1].toLowerCase()] ?? m[1]}</div>${inner.replace(m[0], "<p>")}</div>` : `<blockquote>${inner}</blockquote>`;
    },
  },
});
const html = (md) => marked.parse(md.replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/!?\[\[([^\]]+)\]\]/g, "$1"));

function Markdown({ md }) {
  const h = useMemo(() => html(md), [md]);
  return <div className="aula-md" dangerouslySetInnerHTML={{ __html: h }} />;
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

/** Seção editável com o mesmo editor ao vivo do modo Markdown; `onChange(md)` recebe o corpo da seção. */
function EditorSecao({ md, onChange, onSave, onLink }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.setText(md); }, []); // só ao abrir: depois, quem manda é o editor
  return <div className="aula-ed"><Editor ref={ref} onChange={(doc) => onChange(doc.toString())} onSave={onSave} onLink={onLink} /></div>;
}

/** Visão de uma aula do acervo: abas (objetivos, habilidades, conteúdo, mindmap, atividades) e as anotações na margem. */
export function AulaDaNota({ item, tick, onLink }) {
  const [t, setT] = useState(null), [erro, setErro] = useState(""), [aba, setAba] = useState(null);
  const [wMargem, setWMargem] = useWidth("aula.margem", 300);
  const texto = useRef(null), pend = useRef(null), timer = useRef(null), caminho = useRef(item.path);
  caminho.current = item.path;
  const gravar = async () => {
    clearTimeout(timer.current);
    const p = pend.current; if (!p || texto.current == null) return;
    pend.current = null;
    const novo = trocarSecao(texto.current, p.id, p.md);
    texto.current = novo; setT(novo);
    try { await invoke("save_note", { path: p.path, text: novo }); } catch (e) { setErro(String(e)); }
  };
  const gravarRef = useRef(gravar); gravarRef.current = gravar;
  useEffect(() => () => { gravarRef.current(); }, [item.path]); // ao sair da nota, grava o que faltar
  useEffect(() => { setT(null); setErro(""); invoke("read_note", { path: item.path }).then((x) => { texto.current = x; setT(x); }).catch((e) => setErro(String(e))); }, [item.path, tick]);
  const editar = (id, md) => { pend.current = { id, md, path: caminho.current }; clearTimeout(timer.current); timer.current = setTimeout(gravar, 600); };
  const a = useMemo(() => (t == null ? null : parseAula(t)), [t]);
  useEffect(() => { setAba(null); }, [item.path]);
  if (erro) return <Erro>{erro}</Erro>;
  if (!a) return <Carregando>Lendo a aula…</Carregando>;

  const abas = [...a.secoes, ...(a.outras.length ? [{ id: "outras", nome: a.secoes.length ? "Outras seções" : "Texto", md: a.outras.map((o) => `## ${o.nome}\n\n${o.md}`).join("\n\n") }] : [])];
  const atual = abas.find((x) => x.id === aba) ?? abas.find((x) => x.id === "conteudo") ?? abas[0];
  const chips = [a.meta.status, a.meta.ano && `${a.meta.ano}º ano`, a.meta.assuntos].filter(Boolean);
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex max-w-[1400px] items-stretch gap-4 px-8 py-8">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">Aula do acervo</div>
          <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">{item.name}</h1>
          {chips.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{chips.map((c) => <span key={c} className="rounded-full bg-accent px-2.5 py-0.5 text-xs">{c}</span>)}</div>}
          {abas.length > 1 && (
            <div role="tablist" aria-label="Partes da aula" className="mt-5 flex flex-wrap gap-1 border-b">
              {abas.map((x) => (
                <button key={x.id} role="tab" aria-selected={atual === x} onClick={async () => { await gravar(); setAba(x.id); }}
                  className={cn("-mb-px border-b-2 px-3 py-2 text-sm", atual === x ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>{x.nome}</button>
              ))}
            </div>
          )}
          <div className="mt-5">
            {atual && secoesBrutas(t).some((x) => x.id === atual.id) && atual.id !== "mindmap" && (
              <>
                {atual.id === "habilidades" && a.codigos.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{a.codigos.map((c) => <span key={c} className="rounded-full border px-2.5 py-0.5 font-mono text-xs">{c}</span>)}</div>}
                <EditorSecao key={`${item.path}:${atual.id}`} md={secoesBrutas(texto.current ?? t).find((x) => x.id === atual.id).md} onChange={(md) => editar(atual.id, md)} onSave={gravar} onLink={onLink} />
              </>)}
            {atual && atual.id === "mindmap" && secoesBrutas(t).some((x) => x.id === "mindmap") && (
              <>
                {mermaidDe(atual.md) && <div className="mb-4"><Mindmap codigo={mermaidDe(atual.md)} /></div>}
                <EditorSecao key={`${item.path}:mindmap`} md={secoesBrutas(texto.current ?? t).find((x) => x.id === "mindmap").md} onChange={(md) => editar("mindmap", md)} onSave={gravar} onLink={onLink} />
              </>)}
            {atual && !secoesBrutas(t).some((x) => x.id === atual.id) && atual.id !== "outras" && <Markdown md={atual.md || "_Seção vazia._"} />}
            {atual && atual.id === "outras" && <><p className="mb-2 text-xs text-muted-foreground">Estas seções se editam no modo Markdown.</p><Markdown md={atual.md} /></>}
            {!atual && <p className="text-sm text-muted-foreground">Esta aula ainda não tem conteúdo.</p>}
          </div>
        </div>
        <ResizeHandle width={wMargem} setWidth={setWMargem} min={200} max={560} side="right" />
        <aside style={{ width: wMargem, maxWidth: "45%" }} className="shrink-0">
          <section className="flex flex-col gap-3 border-l-2 border-err pl-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Na margem</h2>
            {a.notas.length === 0
              ? <p className="text-sm text-muted-foreground">Sem anotações. Escreva uma em Markdown com <code>&gt; [!margem]</code>.</p>
              : a.notas.map((n, i) => <div key={i} className="whitespace-pre-line text-sm">{n}</div>)}
          </section>
        </aside>
      </div>
    </div>
  );
}
