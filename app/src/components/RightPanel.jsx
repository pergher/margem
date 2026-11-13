import { useEffect, useState } from "react";
import { AlertTriangle, ListTree, Link2, SlidersHorizontal, X, Plus, History } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { parseFm } from "@/lib/frontmatter";
import { invoke } from "@/lib/api";
import { diffLinhas } from "@/lib/diff";
import { Estado } from "@/components/ui/estado";

export const TABS = [["sumario", "Sumário", ListTree], ["props", "Propriedades", SlidersHorizontal], ["links", "Links", Link2], ["hist", "Histórico", History]];

function Chips({ items, onChange }) {
  const [v, setV] = useState("");
  const add = () => { const t = v.trim(); if (t && !items.includes(t)) onChange([...items, t]); setV(""); };
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <span key={it} className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs">
          {it}<button aria-label={`Remover ${it}`} onClick={() => onChange(items.filter((x) => x !== it))} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="+" aria-label="Adicionar item"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add}
        className="h-6 w-14 rounded-md bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground focus:w-24 focus:bg-background focus:ring-1 focus:ring-primary/40" />
    </div>
  );
}

function Text({ value, onCommit, warn }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => { if (v.trim() !== value) onCommit(v.trim()); };
  return <input value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={warn ? "pendente" : ""}
    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { setV(value); e.currentTarget.blur(); } }}
    className={cn("h-7 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-primary", warn && "border-warn/70 placeholder:text-warn")} />;
}

function Props({ text, info, onSet }) {
  const fm = parseFm(text);
  const have = new Set(fm.entries.map((e) => e.key));
  const missing = (info?.required ?? []).filter((k) => !have.has(k));
  const rows = [...fm.entries.map((e) => ({ key: e.key, items: e.items, value: e.value })), ...missing.map((k) => ({ key: k, items: null, value: "", missing: true }))];
  const [nk, setNk] = useState(null);
  const listy = (k) => ["turmas", "tags", "conteudos", "conteudos_excluidos", "foco", "alertas", "habilidades", "textos", "questoes", "feriados"].includes(k);
  return (
    <ScrollArea className="flex-1 px-3 py-2">
      {rows.length === 0 && <p className="py-1 text-sm text-muted-foreground">Este arquivo não tem propriedades.</p>}
      {rows.map((r) => (
        <div key={r.key} className="mb-2.5">
          <div className={cn("mb-1 text-xs uppercase tracking-wide text-muted-foreground", r.missing && "text-warn")}>{r.key}{r.missing && " · obrigatório"}</div>
          {r.items || listy(r.key)
            ? <Chips items={r.items ?? []} onChange={(it) => onSet(r.key, it)} />
            : r.key === "status"
              ? <select value={r.value} onChange={(e) => onSet("status", e.target.value)} className="h-7 w-full rounded-md border bg-background px-1.5 text-xs">
                  {!(info?.status ?? []).includes(r.value) && <option value={r.value}>{r.value || "—"}</option>}
                  {(info?.status ?? []).map((s) => <option key={s}>{s}</option>)}
                </select>
              : /^(true|false)$/.test(r.value)
                ? <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={r.value === "true"} onChange={(e) => onSet(r.key, e.target.checked ? "true" : "false")} />{r.value === "true" ? "sim" : "não"}</label>
                : <Text value={r.value} warn={r.missing || (!r.value && !r.items)} onCommit={(v) => onSet(r.key, v)} />}
        </div>
      ))}
      {nk === null
        ? <button onClick={() => setNk("")} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" />Propriedade</button>
        : <input autoFocus value={nk} onChange={(e) => setNk(e.target.value)} placeholder="nome da propriedade" onBlur={() => setNk(null)}
            onKeyDown={(e) => { if (e.key === "Enter" && /^[\w-]+$/.test(nk.trim())) { onSet(nk.trim(), ""); setNk(null); } else if (e.key === "Escape") setNk(null); }}
            className="h-7 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-primary" />}
    </ScrollArea>
  );
}

function Links({ info, onOpen, onGoLine }) {
  if (!info) return <p className="px-4 py-3 text-sm text-muted-foreground">Carregando…</p>;
  return (
    <ScrollArea className="flex-1 px-2 py-2">
      <h3 className="px-2 pb-1 text-xs uppercase tracking-wide text-muted-foreground">Avisos ({info.issues.length})</h3>
      {info.issues.length === 0 && <p className="px-2 pb-2 text-sm text-muted-foreground">Nenhum aviso.</p>}
      {info.issues.map((i, k) => (
        <button key={k} onClick={() => onGoLine(i.line)} className="mb-0.5 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent">
          <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", i.severity === "erro" ? "text-err" : "text-warn")} />
          <span><span className="text-muted-foreground">linha {i.line} · </span>{i.msg}</span>
        </button>
      ))}
      <h3 className="px-2 pb-1 pt-3 text-xs uppercase tracking-wide text-muted-foreground">Mencionada em ({info.backlinks.length})</h3>
      {info.backlinks.length === 0 && <p className="px-2 text-sm text-muted-foreground">Nenhum arquivo aponta para este.</p>}
      {info.backlinks.map((b) => (
        <button key={b.path} onClick={() => onOpen(b.path)} title={b.rel} className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-accent">
          <span className="truncate text-xs">{b.name}</span>
          <span className="truncate text-xs text-muted-foreground">{b.rel.split("/").slice(0, -1).join(" / ")}</span>
        </button>
      ))}
    </ScrollArea>
  );
}

const quando = (ts) => new Date(ts * 1000).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Versões antigas da nota (guardadas ao salvar, no máx. uma a cada 10 min). Clique = comparar com o texto atual; Restaurar guarda o atual antes.
function Historico({ path, text, onRestore, tick }) {
  const [vers, setVers] = useState(null);
  const [sel, setSel] = useState(null); // { id, texto }
  const [erro, setErro] = useState("");
  useEffect(() => { setSel(null); setErro(""); setVers(null); if (path) invoke("list_history", { path }).then(setVers).catch((e) => setErro(String(e))); }, [path, tick]);
  const abrir = (v) => invoke("read_version", { path, id: v.id }).then((t) => setSel({ id: v.id, ts: v.ts, texto: t })).catch((e) => setErro(String(e)));
  const restaurar = () => invoke("restore_version", { path, id: sel.id }).then((t) => { onRestore(t); setSel(null); }).catch((e) => setErro(String(e)));
  if (!path) return <p className="px-4 py-3 text-sm text-muted-foreground">Abra um arquivo.</p>;
  const linhas = sel ? diffLinhas(sel.texto, text) : [];
  const mudou = linhas.some((l) => l.t !== " ");
  return (
    <ScrollArea className="flex-1 px-2 py-2">
      {erro && <Estado tipo="err" className="px-2 pb-2 text-xs">{erro}</Estado>}
      {vers === null ? <p className="px-2 text-sm text-muted-foreground">Carregando…</p>
        : vers.length === 0 ? <p className="px-2 text-sm text-muted-foreground">Ainda não há versões antigas. A primeira aparece quando este arquivo for salvo com alterações.</p>
        : vers.map((v) => (
          <button key={v.id} onClick={() => abrir(v)} className={cn("flex w-full justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent", sel?.id === v.id && "bg-accent")}>
            <span>{quando(v.ts)}</span><span className="text-xs text-muted-foreground">{v.bytes} B</span>
          </button>))}
      {sel && (
        <div className="mt-3 border-t pt-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">{mudou ? `${quando(sel.ts)} → agora` : "Igual ao texto atual"}</span>
            <button onClick={restaurar} disabled={!mudou} className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-40">Restaurar</button>
          </div>
          <div className="overflow-hidden rounded-md border font-mono text-xs leading-snug">
            {linhas.map((l, i) => l.t === " " && !linhas.slice(Math.max(0, i - 2), i + 3).some((x) => x.t !== " ")
              ? (i === 0 || !(linhas[i - 1].t === " " && !linhas.slice(Math.max(0, i - 3), i + 2).some((x) => x.t !== " ")) ? <div key={i} className="px-2 text-muted-foreground">…</div> : null)
              : <div key={i} className={cn("whitespace-pre-wrap break-words px-2", l.t === "+" && "bg-ok/15", l.t === "-" && "bg-err/15 line-through decoration-err/40")}>{l.t === " " ? "  " : l.t + " "}{l.s || " "}</div>)}
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">Verde: está agora e não estava. Vermelho: estava na versão antiga.</p>
        </div>
      )}
    </ScrollArea>
  );
}

export function RightPanel({ tab, setTab, info, text, onSet, onOpen, onGoLine, path, onRestore, histTick, children }) {
  const n = info?.issues.length ?? 0;
  return (
    <aside aria-label="Painel" className="flex h-full flex-col bg-muted/50">
      <div role="tablist" className="flex min-h-[3.5rem] shrink-0 items-center gap-1 border-b px-2 py-2">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} title={label} onClick={() => setTab(id)}
            className={cn("relative flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground", tab === id ? "flex-1 bg-accent text-foreground" : "shrink-0")}>
            <Icon className="h-4 w-4" strokeWidth={1.7} />
            {tab === id && <span className="truncate">{label}</span>}
            {id === "links" && n > 0 && <span className="absolute right-1 top-0.5 rounded-full bg-warn px-1 text-[10px] leading-4 text-white">{n}</span>}
          </button>
        ))}
      </div>
      {tab === "sumario" && children}
      {tab === "props" && <Props text={text} info={info} onSet={onSet} />}
      {tab === "links" && <Links info={info} onOpen={onOpen} onGoLine={onGoLine} />}
      {tab === "hist" && <Historico path={path} text={text} onRestore={onRestore} tick={histTick} />}
    </aside>
  );
}
