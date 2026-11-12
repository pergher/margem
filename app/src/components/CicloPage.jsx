import { useState } from "react";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { FASES, inserirAula, removerAula, salvarAulas } from "@/lib/ciclos";
import { ajustarSemanasAoCiclo } from "@/lib/semana";

const fase = Object.fromEntries(FASES.map((f) => [f.id, f]));
const norm = (s) => s.toLowerCase();

// Recurso da aula: [[links]] viram botões (âmbar se a nota não existe), o resto é texto.
function Recurso({ texto, nomes, onOpen, items }) {
  const partes = texto.split(/(\[\[[^\]]+\]\])/g).filter(Boolean);
  return partes.map((p, i) => {
    const m = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(p);
    if (!m) return <span key={i}>{p}</span>;
    const alvo = m[1].trim(), item = items.find((x) => norm(x.name) === norm(alvo));
    return item
      ? <button key={i} onClick={() => onOpen(item.path)} className="text-primary hover:underline">{alvo}</button>
      : <span key={i} title="Nota ainda não existe" className="text-amber-700">{alvo} (a criar)</span>;
  });
}

const resumo = (t) => t.replace(/\*\*/g, "").replace(/\[\[([^\]|]+)[^\]]*\]\]/g, "$1");

export function CicloPage({ ciclo: c, items, onOpen, onAno, onChange }) {
  const [wDados, setWDados] = useWidth("ciclo.dados", 340);
  const [novo, setNovo] = useState(null); // { pos, texto }
  const [erro, setErro] = useState("");
  const aplicar = (acao, ajuste) => salvarAulas(c, acao).then(async (x) => { if (ajuste) await ajustarSemanasAoCiclo(items, c.name, ajuste); setErro(""); setNovo(null); onChange(x); }).catch((e) => setErro(String(e.message ?? e)));
  const linhaNova = (
    <div className="flex items-center gap-2 border-b bg-primary/5 px-2.5 py-1.5 text-xs">
      <span className="w-[2.125rem] text-muted-foreground">{novo?.pos}</span>
      <input autoFocus value={novo?.texto ?? ""} onChange={(e) => setNovo({ ...novo, texto: e.target.value })} placeholder="Conteúdo da nova aula (ex.: **Exercícios**. Livro p. 210)"
        onKeyDown={(e) => { if (e.key === "Enter" && novo.texto.trim()) aplicar((t) => inserirAula(t, novo.pos, novo.texto.trim()), { inserirEm: novo.pos }); if (e.key === "Escape") setNovo(null); }}
        className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1" />
      <button disabled={!novo?.texto?.trim()} onClick={() => aplicar((t) => inserirAula(t, novo.pos, novo.texto.trim()), { inserirEm: novo.pos })} className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-40">Inserir</button>
      <button onClick={() => setNovo(null)} className="text-xs text-muted-foreground hover:underline">cancelar</button>
    </div>
  );
  const contagem = FASES.map((f) => ({ f, n: c.aulas.filter((a) => a.fase === f.id).length })).filter((x) => x.n);
  return (
    <div className="flex min-h-0 flex-1">
      <aside aria-label="Dados do ciclo" style={{ width: wDados }} className="shrink-0 overflow-auto p-6">
        <button onClick={onAno} className="mb-3 text-xs text-muted-foreground hover:text-foreground">← Planejamento {c.ano}º ano</button>
        <h1 className="mb-1.5 font-serif text-3xl font-semibold leading-tight">{c.titulo}</h1>
        <div className="mb-5 text-xs leading-relaxed text-muted-foreground">
          {c.ano}º ano · {c.tri}º trimestre · ciclo {c.ciclo}{c.sufixo ? ` · ${c.sufixo}` : ""}<br />{c.aulas.length} aulas
        </div>

        <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Conteúdos</div>
        <ul className="mb-5 list-disc pl-5 text-sm">{c.conteudos.length ? c.conteudos.map((x) => <li key={x}>{x}</li>) : <li className="list-none text-muted-foreground">—</li>}</ul>

        <div className="mb-2 text-xs font-semibold text-muted-foreground">Habilidades</div>
        {c.habTexto.length ? c.habTexto.map((h) => (
          <div key={h.codigo} className="mb-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{h.codigo}</span>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{h.texto}</div>
          </div>
        )) : <div className="mb-2 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">sem habilidade — a vincular</div>}

        <div className="mt-5 text-xs font-semibold text-muted-foreground">Etapas</div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {contagem.map(({ f, n }) => <span key={f.id} className="rounded-full border px-2 py-0.5"><span aria-hidden className="mr-1 inline-block h-2 w-2" style={{ background: f.cor }} />{f.nome} · {n}</span>)}
        </div>

        <button onClick={() => onOpen(c.path)} className="mt-6 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Abrir como nota</button>
      </aside>
      <ResizeHandle width={wDados} setWidth={setWDados} min={240} max={560} side="left" />

      <section aria-label="Sequência do ciclo" className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 px-6 pb-3 pt-4">
          <div className="mb-2 flex items-center gap-3 text-xs font-medium">Sequência do ciclo <span className="font-normal text-muted-foreground">· {c.aulas.length} aulas</span>
            <button onClick={() => setNovo({ pos: c.aulas.length + 1, texto: "" })} className="rounded-md border px-2 py-0.5 text-xs font-normal hover:bg-accent">+ Aula</button>
            {erro && <span className="text-xs font-normal text-destructive">{erro}</span>}
          </div>
          <div className="flex h-1.5 max-w-xl gap-0.5">{c.aulas.map((a) => <span key={a.n} style={{ flex: 1, background: fase[a.fase].cor }} />)}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
          <div className="grid gap-x-2.5 border-b px-2.5 py-1.5 text-xs text-muted-foreground" style={{ gridTemplateColumns: "34px 148px 1fr 1fr 64px" }}>
            <span>#</span><span>Etapa</span><span>Conteúdo</span><span>Recurso</span><span />
          </div>
          {c.aulas.map((a) => (
            <div key={a.n}>
            {novo?.pos === a.n && linhaNova}
            <div className="group grid items-start gap-x-2.5 border-b px-2.5 py-1.5 text-xs" style={{ gridTemplateColumns: "34px 148px 1fr 1fr 64px" }}>
              <span className="text-muted-foreground">{a.n}</span>
              <span><span className="rounded-md px-2 py-0.5 text-xs text-white" style={{ background: fase[a.fase].cor }}>{fase[a.fase].nome}</span></span>
              <span>{resumo(a.texto)}</span>
              <span><Recurso texto={a.recurso} items={items} onOpen={onOpen} /></span>
              <span className="flex justify-end gap-1 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                <button title={`Inserir uma aula antes da ${a.n} (as seguintes deslocam)`} aria-label={`Inserir antes da aula ${a.n}`} onClick={() => setNovo({ pos: a.n, texto: "" })} className="rounded px-1.5 text-muted-foreground hover:bg-accent">↧</button>
                <button title={`Remover a aula ${a.n} (as seguintes sobem)`} aria-label={`Remover a aula ${a.n}`} onClick={() => { if (window.confirm(`Remover a aula ${a.n}?\n\n${resumo(a.texto)}`)) aplicar((t) => removerAula(t, a.n), { removida: a.n }); }} className="rounded px-1.5 text-muted-foreground hover:bg-accent hover:text-destructive">✕</button>
              </span>
            </div>
            </div>
          ))}
          {novo?.pos === c.aulas.length + 1 && linhaNova}
          {!c.aulas.length && <div className="p-4 text-sm text-muted-foreground">Este plano ainda não tem a tabela “## Aulas”.</div>}
        </div>
      </section>
    </div>
  );
}
