import { useEffect, useState } from "react";
import { invoke } from "@/lib/api";
import { parseFm } from "@/lib/frontmatter";
import { Estado } from "@/components/ui/estado";

function Img({ alvo }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { invoke("read_embed", { target: alvo }).then((r) => setSrc(r?.kind === "image" ? r.data : null)).catch(() => setSrc(null)); }, [alvo]);
  return src ? <img src={src} alt={alvo} className="my-2 max-w-full rounded border bg-white" /> : <div className="text-xs text-muted-foreground">{alvo}: imagem não encontrada.</div>;
}
const inline = (l) => l.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/).map((x, i) => x.startsWith("**") ? <b key={i}>{x.slice(2, -2)}</b> : x.startsWith("[[") ? <span key={i} className="text-primary">{x.slice(2, -2).split("|").pop()}</span> : x);
/** Markdown simples para leitura: títulos, imagens embutidas, negrito e linhas. */
function Leitura({ texto }) {
  return texto.split("\n").map((l, i) => {
    const h = /^(#{1,4})\s+(.*)$/.exec(l), im = /^!\[\[([^\]|]+)/.exec(l.trim());
    if (h) return <h2 key={i} className="mb-1 mt-5 font-sans text-sm font-semibold uppercase tracking-wide text-muted-foreground">{h[2]}</h2>;
    if (im) return <Img key={i} alvo={im[1].trim()} />;
    return l.trim() ? <p key={i} className="my-1.5">{inline(l)}</p> : null;
  });
}

/** Visão de uma ficha `tipo: texto` (Acervo/Textos): metadados em cartão e o texto para leitura. */
export function TextoDaNota({ item, onOpen, onAtividade, tick }) {
  const [t, setT] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => { setT(null); setErro(""); invoke("read_note", { path: item.path }).then(setT).catch((e) => setErro(String(e))); }, [item.path, tick]);
  if (erro) return <Estado tipo="err" className="p-8 text-sm">{erro}</Estado>;
  if (t == null) return <div className="p-8 text-sm text-muted-foreground">Lendo o texto…</div>;
  const fm = parseFm(t);
  const g = (k) => fm.entries.find((e) => e.key === k);
  const val = (k) => g(k)?.value || (g(k)?.items ?? []).join(", ");
  const lista = (k) => g(k)?.items ?? (g(k)?.value ? [g(k).value] : []);
  const corpo = fm.has ? fm.lines.slice(fm.end + 1).join("\n").trim() : t.trim();
  const titulo = val("titulo") || item.name;
  const meta = [["Autor", val("autor")], ["Gênero", val("genero")], ["Publicação", val("publicacao")], ["Fonte", val("fonte")], ["Link", val("link")]].filter(([, v]) => v);
  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <div className="mx-auto max-w-[720px]">
        <div className="mb-1 flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Texto do acervo</span><div className="flex-1" />
          <button onClick={onAtividade} className="rounded-md border px-3 py-1 hover:bg-accent">Atividade a partir deste texto</button>
          <button onClick={() => onOpen(item.path)} className="text-xs text-primary hover:underline">abrir no editor</button>
        </div>
        <h1 className="font-serif text-3xl font-semibold">{titulo}</h1>
        <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
          {meta.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{v}</dd></div>)}
          {g("dominio_publico") && <div className="contents"><dt className="text-muted-foreground">Domínio público</dt><dd>{val("dominio_publico") === "true" ? "sim" : "não"}</dd></div>}
        </dl>
        {["foco", "conteudos"].map((k) => lista(k).length > 0 && (
          <div key={k} className="mt-3 flex flex-wrap items-center gap-1.5 text-xs"><span className="mr-1 text-muted-foreground">{k === "foco" ? "Foco" : "Conteúdos"}</span>
            {lista(k).map((x) => <span key={x} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">{x}</span>)}</div>))}
        {lista("alertas").length > 0 && <div className="mt-3 rounded-lg bg-warn/15 p-3 text-xs leading-relaxed"><div className="mb-0.5 font-semibold">Alertas</div>{lista("alertas").join(" · ")}</div>}
        <div className="mt-6 border-t pt-5 font-serif text-base leading-relaxed"><Leitura texto={corpo.replace(/^#\s+.*\n+/, "")} /></div>
      </div>
    </div>
  );
}
