import { useEffect, useRef, useState } from "react";
import { IconAlertTriangle as AlertTriangle, IconCircleCheck as CircleCheck, IconChevronDown as ChevronDown } from "@tabler/icons-react";
import { fmt } from "@/lib/correcao";
import { campo } from "./estilos";

/** O meio da navegação entre alunos: mostra o aluno aberto e, ao clicar, a lista da turma para escolher outro. */
export function SeletorAluno({ total, pend, ordem, setOrdem, lista, sel, setSel, rotulo }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null), gatilho = useRef(null), painel = useRef(null);
  const pos = lista.findIndex((e) => e.i === sel), nome = rotulo(lista[pos].x);
  const fechar = () => { setAberto(false); gatilho.current?.focus(); };
  useEffect(() => {
    if (!aberto) return;
    painel.current?.querySelector("[aria-current]")?.focus(); // abre já no aluno atual (e rola até ele)
    const fora = (e) => { if (!ref.current?.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  const teclas = (e) => {
    if (!aberto) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); return; }
    const passo = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    const itens = [...painel.current.querySelectorAll("li button")], i = itens.indexOf(e.target);
    if (!passo || i < 0) return;
    e.preventDefault();
    itens[Math.max(0, Math.min(itens.length - 1, i + passo))].focus();
  };
  return (
    <div ref={ref} className="relative" onKeyDown={teclas} data-sem-atalhos={aberto ? "" : undefined}>
      <button ref={gatilho} type="button" onClick={() => setAberto(!aberto)} aria-haspopup="dialog" aria-expanded={aberto} title="Escolher aluno"
        aria-label={`Escolher aluno: ${nome}, ${pos + 1} de ${lista.length}`}
        className="flex h-7 min-w-[10rem] items-center justify-center gap-1.5 rounded px-2 hover:bg-accent">
        {nome} · {pos + 1} de {lista.length}<ChevronDown aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {aberto && (
        <div ref={painel} role="dialog" aria-label="Alunos" className="absolute left-1/2 top-full z-30 mt-2 flex max-h-[min(28rem,65vh)] w-72 -translate-x-1/2 flex-col rounded-lg border bg-background shadow-lg">
          <div className="space-y-2 border-b p-3">
            <div className="font-semibold">{total} produções{pend ? <span className="font-normal text-warn"> · {pend} marcas</span> : ""}</div>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar" className={campo}>
              <option value="original">Ordem da lista</option><option value="nota-">Maior nota</option><option value="nota+">Menor nota</option><option value="pendencia">Mais marcas</option></select>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto p-2">
            {lista.map(({ x, i }) => (
              <li key={x.n}>
                <button type="button" onClick={() => { setSel(i); fechar(); }} aria-current={i === sel ? "true" : undefined}
                  className={"flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-accent/60 " + (i === sel ? "bg-accent font-medium" : "")}>
                  {x.marcas ? <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0 text-warn" /> : <CircleCheck aria-hidden className="h-3.5 w-3.5 shrink-0 text-ok" />}
                  <span className="flex-1 truncate">{rotulo(x)}</span>
                  <span className={x.marcas ? "text-warn" : ""}>{x.marcas ? `${x.marcas} marcas` : fmt(x.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
