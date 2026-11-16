import { useEffect, useMemo, useRef, useState } from "react";
import { IconX as X, IconExternalLink as ExternalLink } from "@tabler/icons-react";
import { invoke } from "@/lib/api";
import { html } from "@/lib/aulaHtml";
import { parseGramatica } from "@/lib/gramatica";
import { acionarBotao } from "@/lib/blocoAcoes";
import { Carregando, Erro } from "@/components/ui/estado";

const sem = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
/** `[[Tópico]]` e `[[Tópico|texto]]` viram links `#gram:Tópico`, que o painel intercepta (o `html` comum só deixa o texto). */
const comLinks = (md) => md.replace(/(?<!!)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, alvo, txt) => `[${txt || alvo}](#gram:${encodeURIComponent(alvo.trim())})`);

/** Gramática à direita da aula: o professor consulta a regra sem sair do que está escrevendo. `anchor`: seção a destacar. */
export function PainelGramatica({ item, anchor, gramaticas, onNavegar, onAbrir, onFechar }) {
  const [texto, setTexto] = useState(null), [erro, setErro] = useState("");
  const corpo = useRef(null);
  useEffect(() => {
    let vivo = true; setTexto(null); setErro("");
    invoke("read_note", { path: item.path }).then((t) => { if (vivo) setTexto(t); }).catch((e) => { if (vivo) setErro(String(e?.message ?? e)); });
    return () => { vivo = false; };
  }, [item.path]);
  const g = useMemo(() => (texto == null ? null : parseGramatica(texto)), [texto]);
  useEffect(() => {
    if (!g || !anchor) { corpo.current?.scrollTo({ top: 0 }); return; }
    const alvo = [...(corpo.current?.querySelectorAll("[data-secao]") ?? [])].find((e) => sem(e.dataset.secao) === sem(anchor));
    alvo?.scrollIntoView({ block: "start" });
  }, [g, anchor, item.path]);
  const clique = (e) => {
    acionarBotao(e.target);
    const a = e.target.closest?.("a[href^='#gram:']");
    if (!a) return;
    e.preventDefault();
    const nome = decodeURIComponent(a.getAttribute("href").slice(6)), it = gramaticas(nome);
    it ? onNavegar(it, "") : onAbrir(nome);
  };
  return (
    <aside aria-label={`Gramática: ${item.name}`} className="flex w-[27rem] max-w-[45%] shrink-0 flex-col border-l bg-background">
      <header className="flex items-center gap-1 border-b px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Gramática</div>
          <h2 className="truncate font-serif text-xl font-semibold">{item.name}</h2>
        </div>
        <button onClick={() => onAbrir(item.name)} title="Abrir a nota" aria-label="Abrir a nota" className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><ExternalLink className="h-4 w-4" /></button>
        <button onClick={onFechar} title="Fechar" aria-label="Fechar painel" className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-4 w-4" /></button>
      </header>
      <div ref={corpo} onClick={clique} className="min-h-0 flex-1 overflow-auto px-4 py-3">
        {erro ? <Erro>{erro}</Erro> : !g ? <Carregando>Lendo a gramática…</Carregando> : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {g.anos.map((a) => <span key={a} className="rounded-full bg-accent px-2.5 py-0.5 text-xs">{a}º ano</span>)}
              {g.assuntos && <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">{g.assuntos}</span>}
            </div>
            {g.secoes.map((s) => (
              <section key={s.id} data-secao={s.nome} className={"mb-5 scroll-mt-2 " + (anchor && sem(anchor) === sem(s.nome) ? "rounded-lg bg-accent/40 p-2 -mx-2" : "")}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.nome}</h3>
                <div className="aula-md text-[0.95rem]" dangerouslySetInnerHTML={{ __html: html(comLinks(s.md)) }} />
              </section>
            ))}
            {g.avisos.length > 0 && <p className="text-xs text-warn">{g.avisos.join(" · ")}</p>}
          </>
        )}
      </div>
    </aside>
  );
}
