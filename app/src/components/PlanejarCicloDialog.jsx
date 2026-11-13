import { useMemo, useState } from "react";
import { recursosDoAcervo, montarPedido, lerProposta, criarCiclo, nomeCiclo } from "@/lib/planejar";

const num = "w-14 rounded border bg-background px-1";

export function PlanejarCicloDialog({ items, onClose, onCriado }) {
  const [d, setD] = useState({ ano: 7, tri: 1, ciclo: 1, titulo: "", sufixo: "", nAulas: 16, tema: "" });
  const [colado, setColado] = useState("");
  const [prop, setProp] = useState(null);
  const [msg, setMsg] = useState("");
  const rec = useMemo(() => recursosDoAcervo(items), [items]);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });
  const copiar = () => navigator.clipboard?.writeText(montarPedido(d, rec)).then(() => setMsg("Pedido copiado: cole no Claude"));
  const conferir = () => { try { setProp(lerProposta(colado, items)); setMsg(""); } catch (e) { setMsg(String(e.message ?? e)); } };
  const marca = (campo, i) => setProp({ ...prop, [campo]: prop[campo].map((x, k) => (k === i ? { ...x, ok: !x.ok } : x)) });
  const criar = async () => { try { onCriado(await criarCiclo(items, d, prop)); } catch (e) { setMsg(String(e.message ?? e)); } };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-6" onMouseDown={onClose}>
      <div role="dialog" aria-label="Planejar ciclo" className="w-[min(860px,96vw)] rounded-xl border bg-background p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center"><h2 className="flex-1 font-serif text-2xl font-semibold">Planejar ciclo com o Claude</h2><button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">fechar</button></div>
        <p className="mb-4 text-xs text-muted-foreground">O app não escreve o plano: ele monta o pedido (com as aulas e textos do seu acervo) e, depois, deixa você aceitar linha a linha o que o Claude propuser. Nada é gravado antes de “Criar ciclo”.</p>

        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <label>Ano <input type="number" min={6} max={9} value={d.ano} onChange={set("ano")} className={num} /></label>
          <label>Trimestre <input type="number" min={1} max={3} value={d.tri} onChange={set("tri")} className={num} /></label>
          <label>Ciclo <input type="number" min={1} max={9} value={d.ciclo} onChange={set("ciclo")} className={num} /></label>
          <label>Aulas <input type="number" min={4} max={30} value={d.nAulas} onChange={set("nAulas")} className={num} /></label>
          <label>Turma <select value={d.sufixo} onChange={set("sufixo")} className="rounded border bg-background px-1"><option value="">—</option><option>PR</option><option>PT</option><option>TG</option></select></label>
        </div>
        <input value={d.titulo} onChange={set("titulo")} placeholder="Título do ciclo (ex.: Transitividade, preposições e crase)" aria-label="Título do ciclo" className="mb-2 w-full rounded border bg-background px-2 py-1 text-sm" />
        <textarea value={d.tema} onChange={set("tema")} placeholder="Tema e observações (opcional)" aria-label="Tema e observações" className="mb-2 h-14 w-full rounded border bg-background p-2 text-sm" />
        <div className="mb-4 flex items-center gap-3"><button onClick={copiar} disabled={!d.titulo.trim()} className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-40">Copiar pedido para o Claude</button>
          <span className="text-xs text-muted-foreground">{rec.aulas.length} aulas e {rec.textos.length} textos do acervo entram no pedido. Arquivo: {d.titulo.trim() ? nomeCiclo(d) + ".md" : "—"}</span></div>

        <div className="mb-1 text-xs font-medium">Cole aqui a proposta do Claude</div>
        <textarea value={colado} onChange={(e) => setColado(e.target.value)} placeholder={"## Conteúdos\n…\n## Habilidades\n…\n## Aulas\n| # | Conteúdo | Recurso |"} className="mb-2 h-36 w-full rounded border bg-background p-2 font-mono text-xs" />
        <button onClick={conferir} disabled={!colado.trim()} className="mb-3 rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:opacity-40">Conferir proposta</button>

        {prop && (
          <div className="mb-3 rounded border p-3 text-xs">
            <div className="mb-1 font-medium">Aceite ou tire cada linha</div>
            {prop.conteudos.map((c, i) => <label key={"c" + i} className="flex gap-2"><input type="checkbox" checked={c.ok} onChange={() => marca("conteudos", i)} /><span className="text-xs text-muted-foreground">conteúdo</span> {c.texto}</label>)}
            {prop.habilidades.map((h, i) => <label key={"h" + i} className="flex gap-2"><input type="checkbox" checked={h.ok} onChange={() => marca("habilidades", i)} /><span className="text-xs text-muted-foreground">habilidade</span> {h.codigo} {h.texto}</label>)}
            <div className="mt-1">
              {prop.aulas.map((a, i) => <label key={"a" + i} className={"flex gap-2 " + (a.ok ? "" : "opacity-50 line-through")}><input type="checkbox" checked={a.ok} onChange={() => marca("aulas", i)} />
                <span className="w-6 text-right text-xs text-muted-foreground">{prop.aulas.slice(0, i + 1).filter((x) => x.ok).length}</span>
                <span className="min-w-0 flex-1">{a.conteudo}</span>
                {a.recurso && <span className={"text-xs " + (a.recursoExiste ? "text-muted-foreground" : "text-warn")}>{a.recurso}{a.recursoExiste ? "" : " (não existe no vault: vira texto)"}</span>}</label>)}
            </div>
            <button onClick={criar} className="mt-3 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground">Criar ciclo {nomeCiclo(d)}</button>
          </div>
        )}
        {msg && <div className="text-xs text-muted-foreground">{msg}</div>}
      </div>
    </div>
  );
}
