// Mostra o texto atual × o proposto (diff por linhas, somente leitura) e deixa aceitar tudo, aceitar por trecho ou recusar.
// Não usa o editor com pré-visualização ao vivo: a decoração de Markdown esconderia a sintaxe e confundiria o diff.
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { indicesDeMudanca, textoFinal, trechos } from "@/lib/proposta";

const CONTEXTO = 2; // linhas iguais mostradas em volta de cada mudança

function Igual({ linhas, primeiro, ultimo }) {
  const ini = primeiro ? 0 : CONTEXTO, fim = ultimo ? 0 : CONTEXTO;
  if (linhas.length <= ini + fim + 1) return linhas.map((s, i) => <Linha key={i} s={s} />);
  return <>
    {linhas.slice(0, ini).map((s, i) => <Linha key={"a" + i} s={s} />)}
    <div className="px-4 py-0.5 text-xs text-muted-foreground">⋯ {linhas.length - ini - fim} linhas iguais</div>
    {linhas.slice(linhas.length - fim).map((s, i) => <Linha key={"b" + i} s={s} />)}
  </>;
}
const Linha = ({ s, t }) => (
  <div className={cn("whitespace-pre-wrap break-words px-4 font-mono text-[13px] leading-6", t === "+" && "bg-ok/10", t === "-" && "bg-err/10 line-through decoration-err/40")}>
    <span className="mr-2 inline-block w-3 select-none text-muted-foreground">{t ?? ""}</span>{s || " "}
  </div>
);

/** `proposta`: { id, nota, nova, texto_base, texto_novo, resumo }. `onAplicar(texto)` pode lançar erro de texto. */
export function PropostaDialog({ proposta, posicao, onAplicar, onRecusar, onClose, onTrocar, titulo = "Proposta de alteração", rotuloAplicar = "Aplicar", rotuloRecusar = "Recusar" }) {
  const segs = useMemo(() => trechos(proposta.texto_base, proposta.texto_novo), [proposta]);
  const mudancas = useMemo(() => indicesDeMudanca(segs), [segs]);
  const [aceitos, setAceitos] = useState(() => new Set(mudancas));
  const [erro, setErro] = useState("");
  useEffect(() => { setAceitos(new Set(mudancas)); setErro(""); }, [mudancas]);
  const alternar = (i) => setAceitos((a) => { const n = new Set(a); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const aplicar = async () => { try { await onAplicar(textoFinal(segs, aceitos)); onClose(); } catch (e) { setErro(String(e?.message ?? e)); } };
  const recusar = async () => { try { await onRecusar?.(); onClose(); } catch (e) { setErro(String(e?.message ?? e)); } };
  const key = (e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
  const nome = proposta.nova ? `Nota nova: ${proposta.nova.nome}` : (proposta.nota || "").split("/").pop();
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[6vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label={titulo} onKeyDown={key} onMouseDown={(e) => e.stopPropagation()} className="flex max-h-[84vh] w-[min(860px,94vw)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-medium">{titulo}</h2>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{nome}{proposta.resumo ? ` · ${proposta.resumo}` : ""}</span>
          {posicao && posicao.total > 1 && <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <button aria-label="Proposta anterior" onClick={() => onTrocar(-1)} className="rounded px-1.5 hover:bg-accent">‹</button>
            {posicao.indice + 1} de {posicao.total}
            <button aria-label="Próxima proposta" onClick={() => onTrocar(1)} className="rounded px-1.5 hover:bg-accent">›</button></span>}
          <kbd className="rounded border px-1.5 text-xs text-muted-foreground">Esc</kbd>
        </div>
        <div className="min-h-0 flex-1 overflow-auto py-2" data-testid="diff">
          {mudancas.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">Sem diferenças.</p>}
          {segs.map((s, i) => s.tipo === "igual"
            ? <Igual key={i} linhas={s.linhas} primeiro={i === 0} ultimo={i === segs.length - 1} />
            : <div key={i} className={cn("my-1 border-y", !aceitos.has(i) && "opacity-50")}>
              <label className="flex items-center gap-2 bg-muted/50 px-4 py-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={aceitos.has(i)} onChange={() => alternar(i)} aria-label={`Aceitar trecho ${mudancas.indexOf(i) + 1}`} />
                Aceitar este trecho ({mudancas.indexOf(i) + 1} de {mudancas.length})
              </label>
              {s.removidas.map((l, k) => <Linha key={"r" + k} s={l} t="-" />)}
              {s.adicionadas.map((l, k) => <Linha key={"n" + k} s={l} t="+" />)}
            </div>)}
        </div>
        {erro && <p role="alert" className="border-t bg-err/10 px-4 py-2 text-sm text-err">{erro}</p>}
        <div className="flex items-center gap-2 border-t bg-muted/50 px-4 py-3">
          <span className="flex-1 text-xs text-muted-foreground">{aceitos.size} de {mudancas.length} trecho(s) aceito(s)</span>
          <button onClick={recusar} className="h-8 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">{rotuloRecusar}</button>
          <button onClick={aplicar} disabled={aceitos.size === 0} className="h-8 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40">{rotuloAplicar}</button>
        </div>
      </div>
    </div>
  );
}
