import { useEffect, useMemo, useRef, useState } from "react";
import { IconeDoTipo } from "@/lib/tiposNota";
import { IconSearch as Search, IconListSearch as TextSearch } from "@tabler/icons-react";
import { invoke } from "@/lib/api";
import { cn } from "@/lib/utils";
import { visaoDe } from "@/lib/visoes";
import { useEhCompacto } from "@/lib/useCompacto";

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Telas que o celular não tem (pedem o editor completo): a busca não as oferece no modo compacto.
const SO_NO_COMPUTADOR = new Set(["correcao", "banco"]);

export function SearchModal({ items, onPick, onClose }) {
  const compacto = useEhCompacto();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const list = useRef(null);
  const [hits, setHits] = useState([]);
  useEffect(() => {
    setHits([]);
    if (norm(q).trim().length < 3) return;
    let alive = true;
    const t = setTimeout(() => invoke("search_text", { query: q, limit: 40 }).then((h) => alive && setHits(h)).catch(() => {}), 220);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);
  const byName = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return items
      .map((it) => ({ it, n: norm(it.name), r: norm(it.rel) }))
      .filter((x) => terms.every((t) => x.r.includes(t)))
      .map((x) => ({ ...x, score: x.n === norm(q).trim() ? -2 : x.n.startsWith(norm(q).trim()) ? -1 : terms.every((t) => x.n.startsWith(t) || x.n.includes(" " + t)) ? 0 : terms.every((t) => x.n.includes(t)) ? 1 : 2 }))
      .sort((a, b) => a.score - b.score || a.it.name.localeCompare(b.it.name, "pt-BR", { numeric: true }))
      .slice(0, 60).map((x) => x.it);
  }, [q, items]);
  const nameSet = new Set(byName.map((i) => i.path));
  const textHits = hits.filter((h) => !nameSet.has(h.path) || h.count > 0).slice(0, 25);
  const results = [...byName.map((it) => ({ it })), ...textHits.map((h) => ({ it: h, text: h }))]
    .filter(({ it }) => !compacto || !SO_NO_COMPUTADOR.has(visaoDe(it.rel)?.id));
  useEffect(() => setIdx(0), [q]);
  useEffect(() => { list.current?.children[idx]?.scrollIntoView({ block: "nearest" }); }, [idx]);

  const key = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[idx]) { e.preventDefault(); onPick(results[idx].it.path, results[idx].text?.line); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Buscar arquivo" className="w-[min(640px,92vw)] overflow-hidden rounded-xl border bg-background shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="Buscar pelo nome, pasta ou texto…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <kbd className="rounded border px-1.5 text-xs text-muted-foreground">Esc</kbd>
        </div>
        <div ref={list} className="max-h-[50vh] overflow-auto p-1.5">
          {q.trim() && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum arquivo encontrado.</p>}
          {!q.trim() && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Digite para buscar no nome e no texto (3+ letras). ↑ ↓ navegam, Enter abre.</p>}
          {results.map(({ it, text }, i) => (
            <div key={(text ? "t:" : "n:") + it.path}>
              {text && !results[i - 1]?.text && <div className="px-3 pb-1 pt-2 text-xs uppercase tracking-wide text-muted-foreground">No texto dos arquivos</div>}
              <button onClick={() => onPick(it.path, text?.line)} onMouseMove={() => setIdx(i)}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left", i === idx && "bg-accent")}>
                {text ? <TextSearch className="h-4 w-4 shrink-0 text-muted-foreground" /> : <IconeDoTipo tipo={it.rel} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{it.name}</span>
                  {text && <span className="block truncate text-xs text-muted-foreground">linha {text.line} · {text.snippet}</span>}
                </span>
                <span className="ml-auto max-w-[40%] truncate pl-3 text-xs text-muted-foreground">{it.rel.split("/").slice(0, -1).join(" / ")}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
