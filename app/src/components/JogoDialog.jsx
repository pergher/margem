import { useMemo, useState } from "react";
import { TIPOS_JOGO, cacaPalavras, cartas, cruzadinha, guardarJogo, imprimirJogo, jogoEmHtml, lerLista, palavrasDaAula, pedidoDeDicas } from "@/lib/jogos";
import { Estado } from "@/components/ui/estado";
import { cn } from "@/lib/utils";

/** Gerar jogo a partir da aula: o professor edita a lista `palavra: dica` (o app sugere palavras da aula), vê a prévia e imprime ou guarda. */
export function JogoDialog({ items, aula, textoAula, onClose, onGuardado }) {
  const [tipo, setTipo] = useState("caca-palavras");
  const [lista, setLista] = useState(() => palavrasDaAula(textoAula).map((p) => `${p}: `).join("\n"));
  const [dificuldade, setDificuldade] = useState("medio");
  const [semente, setSemente] = useState(1);
  const [msg, setMsg] = useState("");
  const entradas = useMemo(() => lerLista(lista), [lista]);
  const info = TIPOS_JOGO.find((t) => t.id === tipo);
  const jogo = useMemo(() => {
    if (entradas.length < 3) return null;
    if (tipo === "caca-palavras") return cacaPalavras(entradas, { dificuldade, semente });
    if (tipo === "cruzadinha") return cruzadinha(entradas, { semente });
    return cartas(entradas, { semente });
  }, [entradas, tipo, dificuldade, semente]);
  const semDica = info.precisaDica ? entradas.filter((e) => !e.dica).map((e) => e.original) : [];
  const naoCouberam = jogo?.naoCouberam ?? [];
  const vazio = tipo === "cartas" ? !jogo?.cartas.length : tipo === "cruzadinha" ? !jogo?.horizontais.length : false;
  const titulo = `${aula} — ${info.nome.split(" (")[0].toLowerCase()}`;

  const copiar = () => navigator.clipboard?.writeText(pedidoDeDicas(aula, entradas.filter((e) => !e.dica).map((e) => e.original))).then(() => setMsg("Pedido copiado: cole no Claude e traga as dicas de volta para a lista."));
  const guardar = async () => { try { const p = await guardarJogo(items, { aula, tipo, lista }); setMsg("Lista guardada em Acervo/Oficinas."); onGuardado?.(p); } catch (e) { setMsg(`Não deu para guardar: ${e.message ?? e}`); } };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-6" onMouseDown={onClose}>
      <div role="dialog" aria-label="Gerar jogo" className="w-[min(980px,96vw)] rounded-xl border bg-background p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center"><h2 className="flex-1 font-serif text-2xl font-semibold">Gerar jogo</h2><button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Fechar</button></div>
        <p className="mb-4 text-xs text-muted-foreground">As palavras abaixo foram sugeridas a partir da aula “{aula}”. Apague, acrescente e escreva as dicas: o jogo é montado só com o que estiver na lista.</p>

        <div role="tablist" aria-label="Tipo de jogo" className="mb-4 flex flex-wrap gap-2">
          {TIPOS_JOGO.map((t) => (
            <button key={t.id} role="tab" aria-selected={tipo === t.id} onClick={() => setTipo(t.id)}
              className={cn("h-8 rounded-md border px-3 text-sm", tipo === t.id ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent")}>{t.nome}</button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium" htmlFor="lista-jogo">Palavras {info.precisaDica ? "e dicas" : "(dica opcional)"} — uma por linha, <code>palavra: dica</code></label>
            <textarea id="lista-jogo" value={lista} onChange={(e) => setLista(e.target.value)} rows={14} className="rounded-md border bg-background p-2 font-mono text-xs" />
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {tipo === "caca-palavras" && (
                <label>Nível <select value={dificuldade} onChange={(e) => setDificuldade(e.target.value)} className="h-7 rounded-md border bg-background px-1.5">
                  <option value="facil">Fácil (→ ↓)</option><option value="medio">Médio (+ diagonal)</option><option value="dificil">Difícil (todas)</option>
                </select></label>)}
              <button onClick={() => setSemente((n) => n + 1)} className="rounded-md border px-2 py-1 hover:bg-accent">Embaralhar</button>
              {info.precisaDica && <button onClick={copiar} className="rounded-md border px-2 py-1 hover:bg-accent">Pedir dicas ao Claude</button>}
            </div>
            {entradas.length < 3 && <Estado tipo="warn" className="text-xs">Escreva pelo menos 3 palavras.</Estado>}
            {semDica.length > 0 && <Estado tipo="warn" className="text-xs">Sem dica: {semDica.join(", ")}.</Estado>}
            {naoCouberam.length > 0 && <Estado tipo="warn" className="text-xs">Não couberam: {naoCouberam.join(", ")}. Tente “Embaralhar” ou mude as palavras.</Estado>}
          </div>

          <div className="min-w-0 overflow-auto rounded-md border bg-white p-3 text-black" aria-label="Prévia do jogo">
            {!jogo || vazio ? <p className="text-sm text-muted-foreground">A prévia aparece aqui quando a lista tiver o suficiente.</p>
              : <div className="jogo-previa" style={{ zoom: 0.75 }} dangerouslySetInnerHTML={{ __html: `<style>.jogo-previa .cp td{width:26px;height:26px;text-align:center;font:600 14px monospace}.jogo-previa .cz td{width:28px;height:28px;border:1px solid #000;position:relative;text-align:center;font:600 14px monospace}.jogo-previa .cz td.v{border:0}.jogo-previa .cz td i{position:absolute;left:2px;top:0;font:normal 9px sans-serif}.jogo-previa table{margin:0 auto;border-collapse:collapse}.jogo-previa .lista,.jogo-previa .dicas{columns:2;font-size:12px;margin-top:10px}.jogo-previa .cartas{display:grid;grid-template-columns:repeat(3,1fr)}.jogo-previa .carta{border:1px dashed #666;padding:14px;text-align:center}.jogo-previa .carta.palavra{font-weight:bold}.jogo-previa h1{font-size:16px}.jogo-previa p{margin:2px 0}</style>${jogoEmHtml(tipo, jogo, { titulo, professor: false })}` }} />}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <button disabled={!jogo || vazio} onClick={() => imprimirJogo(jogoEmHtml(tipo, jogo, { titulo }), titulo)} className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90 disabled:opacity-40">PDF / imprimir</button>
          {tipo !== "cartas" && <button disabled={!jogo || vazio} onClick={() => imprimirJogo(jogoEmHtml(tipo, jogo, { titulo, professor: true }), `${titulo} (gabarito)`)} className="rounded-md border px-3 py-1.5 hover:bg-accent disabled:opacity-40">Gabarito</button>}
          <button disabled={entradas.length === 0} onClick={guardar} className="rounded-md border px-3 py-1.5 hover:bg-accent disabled:opacity-40">Guardar a lista</button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
