import { useEffect, useMemo, useState } from "react";
import { listarTextos, lerFicha, proximosNumeros, montarPedido, gravarNoBanco } from "@/lib/atividade";
import { Estado } from "@/components/ui/estado";

export function AtividadeDialog({ items, banco, textoInicial, onClose, onDone }) {
  const textos = useMemo(() => listarTextos(items), [items]);
  const [path, setPath] = useState(textoInicial ?? "");
  const [filtro, setFiltro] = useState("");
  const [ficha, setFicha] = useState(null);
  const [nInterp, setNI] = useState(4), [nCont, setNC] = useState(4);
  const [questoes, setQ] = useState(""), [gab, setG] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { setFicha(null); const it = textos.find((t) => t.path === path); if (it) lerFicha(it).then(setFicha).catch((e) => setMsg(String(e))); }, [path]);
  const nums = proximosNumeros(banco);
  const lista = textos.filter((t) => t.name.toLowerCase().includes(filtro.toLowerCase())).slice(0, 80);
  const pedido = ficha ? montarPedido({ ficha, banco, nInterp, nCont, nums }) : "";
  const jaTem = ficha && banco.textos.some((t) => t.titulo.toLowerCase() === ficha.titulo.toLowerCase());

  const copiar = () => navigator.clipboard?.writeText(pedido).then(() => setMsg("Pedido copiado: cole no Claude"));
  const inserir = async () => {
    try { const n = await gravarNoBanco(banco, { ficha, nums, questoes, gabarito: gab }); onDone(n); }
    catch (e) { setMsg(String(e.message ?? e)); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-6" onMouseDown={onClose}>
      <div role="dialog" aria-label="Atividade a partir de um texto" className="w-[min(860px,96vw)] rounded-xl border bg-background p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center"><h2 className="flex-1 font-serif text-2xl font-semibold">Atividade a partir de um texto</h2><button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">fechar</button></div>
        <p className="mb-4 text-xs text-muted-foreground">O app não escreve as questões: ele monta o pedido para o Claude (com o texto, os alertas e o formato do banco “{banco.titulo.slice(0, 50)}…”) e, depois, confere e insere o que você colar. Será o Texto {nums.texto}, a partir da questão {nums.questao}.</p>

        <div className="mb-4 grid gap-4 md:grid-cols-[260px_1fr]">
          <div>
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar texto" aria-label="Buscar texto" className="mb-2 w-full rounded border bg-background px-2 py-1 text-sm" />
            <div className="max-h-56 overflow-auto rounded border text-xs">
              {lista.map((t) => <button key={t.path} onClick={() => setPath(t.path)} className={"block w-full truncate px-2 py-1 text-left hover:bg-accent " + (t.path === path ? "bg-accent font-medium" : "")}>{t.name}</button>)}
            </div>
          </div>
          <div className="min-w-0 text-sm">
            {!ficha ? <div className="text-muted-foreground">Escolha uma ficha de texto.</div> : (
              <>
                <div className="font-serif text-lg font-semibold">{ficha.titulo}</div>
                <div className="text-xs text-muted-foreground">{ficha.autor} · {ficha.genero}{ficha.foco.length ? ` · foco: ${ficha.foco.join(", ")}` : ""}</div>
                {ficha.alertas.length > 0 && <Estado tipo="warn" className="mt-1 text-xs">Alertas: {ficha.alertas.join(", ")}</Estado>}
                {jaTem && <Estado tipo="warn" className="mt-1 text-xs">Este texto já está no banco.</Estado>}
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <label>Interpretação <input type="number" min={0} max={8} value={nInterp} onChange={(e) => setNI(Number(e.target.value))} className="w-14 rounded border bg-background px-1" /></label>
                  <label>Conteúdo <input type="number" min={0} max={8} value={nCont} onChange={(e) => setNC(Number(e.target.value))} className="w-14 rounded border bg-background px-1" /></label>
                  <button onClick={copiar} className="rounded-md bg-primary px-3 py-1 text-primary-foreground">Copiar pedido para o Claude</button>
                </div>
                <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs text-muted-foreground">{pedido.slice(0, 700)}…</pre>
              </>
            )}
          </div>
        </div>

        {ficha && (
          <>
            <div className="mb-1 text-xs font-medium">Cole aqui as questões que o Claude devolveu</div>
            <textarea value={questoes} onChange={(e) => setQ(e.target.value)} placeholder={"### Questões sobre o Texto " + nums.texto + "\n\n#### Questão " + nums.questao + " · Interpretação · Dissertativa\n…"} className="mb-3 h-40 w-full rounded border bg-background p-2 font-mono text-xs" />
            <div className="mb-1 text-xs font-medium">Gabarito (opcional; linhas “- **N:** …”)</div>
            <textarea value={gab} onChange={(e) => setG(e.target.value)} className="mb-3 h-20 w-full rounded border bg-background p-2 font-mono text-xs" />
            <div className="flex items-center gap-3"><button onClick={inserir} disabled={!questoes.trim()} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-40">Conferir e inserir no banco</button>
              <span className="text-xs text-muted-foreground">{msg}</span></div>
          </>
        )}
        {!ficha && msg && <div className="text-xs text-muted-foreground">{msg}</div>}
      </div>
    </div>
  );
}
