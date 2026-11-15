import { useEffect, useMemo, useState } from "react";
import { listaCorrecoes, lerCorrecao } from "@/lib/correcao";
import { errosComuns, blocoDeErros } from "@/lib/errosComuns";
import { Estado } from "@/components/ui/estado";

/** Escuta o menu `/` do editor ("margem:erros-comuns") e abre o diálogo; precisa estar montado uma vez, no App. */
export function ErrosComuns({ items }) {
  const [pedido, setPedido] = useState(null);
  useEffect(() => {
    const abrir = (e) => setPedido(e.detail);
    window.addEventListener("margem:erros-comuns", abrir);
    return () => window.removeEventListener("margem:erros-comuns", abrir);
  }, []);
  return pedido ? <ErrosComunsDialog items={items} onClose={() => setPedido(null)} onInserir={(t) => { pedido.inserir(t); setPedido(null); }} /> : null;
}

export function ErrosComunsDialog({ items, onClose, onInserir }) {
  const correcoes = useMemo(() => listaCorrecoes(items), [items]);
  const [path, setPath] = useState(""), [dados, setDados] = useState(null), [msg, setMsg] = useState("");
  const [marcados, setMarcados] = useState(new Set()), [texto, setTexto] = useState(""), [editado, setEditado] = useState(false);
  useEffect(() => {
    setDados(null); setMsg(""); setMarcados(new Set()); setEditado(false);
    const it = correcoes.find((c) => c.path === path); if (!it) return;
    lerCorrecao(it).then((d) => {
      const erros = errosComuns(d.alunos.map((a) => a.texto));
      setDados({ erros, alunos: d.alunos.length });
      setMarcados(new Set(erros.slice(0, 5).map((_, i) => i)));
    }).catch((e) => setMsg(String(e?.message ?? e)));
  }, [path]);
  useEffect(() => { if (dados && !editado) setTexto(dados.erros.length ? blocoDeErros(dados.erros.filter((_, i) => marcados.has(i))) : ""); }, [dados, marcados, editado]);
  const alternar = (i) => { setEditado(false); setMarcados((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; }); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-6" onMouseDown={onClose}>
      <div role="dialog" aria-label="Erros comuns da turma" className="w-[min(760px,96vw)] rounded-xl border bg-background p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center"><h2 className="flex-1 font-serif text-2xl font-semibold">Erros comuns da turma</h2><button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">fechar</button></div>
        <p className="mb-3 text-xs text-muted-foreground">Usa os erros de ortografia marcados nas transcrições de uma correção. Só entram as frases, sem nomes; confira o texto abaixo antes de inserir, pois o aluno pode ter escrito um nome na frase.</p>
        <select value={path} onChange={(e) => setPath(e.target.value)} aria-label="Correção" className="mb-3 w-full rounded border bg-background px-2 py-1.5 text-sm">
          <option value="">Escolha a correção…</option>
          {correcoes.map((c) => <option key={c.path} value={c.path}>{c.pasta}</option>)}
        </select>
        {msg && <Estado tipo="warn" className="mb-2 text-xs">{msg}</Estado>}
        {dados && !dados.erros.length && <p className="text-sm text-muted-foreground">Nenhum erro de ortografia marcado nesta correção (marque com {"{errado|certo}"} na transcrição).</p>}
        {dados?.erros.length > 0 && (
          <>
            <ul className="mb-3 max-h-56 overflow-auto rounded border text-sm">
              {dados.erros.map((e, i) => (
                <li key={i}><label className="flex cursor-pointer items-baseline gap-2 px-3 py-1.5 hover:bg-accent">
                  <input type="checkbox" checked={marcados.has(i)} onChange={() => alternar(i)} />
                  <span className="flex-1"><span className="text-err">{e.errado}</span>{e.certo && <> → <span className="text-ok">{e.certo}</span></>}</span>
                  <span className="text-xs text-muted-foreground">{e.n} de {dados.alunos} alunos</span>
                </label></li>
              ))}
            </ul>
            <div className="mb-1 text-xs font-medium">Bloco que será inserido (pode editar)</div>
            <textarea value={texto} onChange={(e) => { setEditado(true); setTexto(e.target.value); }} className="h-40 w-full rounded border bg-background p-2 font-mono text-xs" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm">Cancelar</button>
              <button disabled={!texto.trim()} onClick={() => onInserir(texto.trim())} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">Inserir no texto</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
