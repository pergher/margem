import { IconEye as Eye, IconEyeOff as EyeOff, IconAlertTriangle as AlertTriangle, IconCircleCheck as CircleCheck } from "@tabler/icons-react";
import { fmt } from "@/lib/correcao";
import { CAB, campo } from "./estilos";

export function ListaAlunos({ largura, d, pend, nomes, setNomes, ordem, setOrdem, visiveis, sel, setSel, rotulo }) {
  return (
        <aside aria-label="Alunos" style={{ width: largura, minWidth: 130 }} className="flex shrink flex-col">
          <div className={CAB}>
            <span className="min-w-0 flex-1 truncate font-semibold">{d.alunos.length} produções{pend ? <span className="font-normal text-warn"> · {pend} marcas</span> : ""}</span>
            <button title={nomes ? "Ocultar nomes" : "Mostrar nomes"} aria-label={nomes ? "Ocultar nomes" : "Mostrar nomes"} onClick={() => setNomes(!nomes)} className="text-muted-foreground hover:text-foreground">{nomes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <div className="space-y-2 p-3">
            <select value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar" className={campo}>
              <option value="original">Ordem da lista</option><option value="nota-">Maior nota</option><option value="nota+">Menor nota</option><option value="pendencia">Mais marcas</option></select>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto px-2 pb-2 text-xs">
            {!visiveis.length && <li className="px-2 py-2 text-muted-foreground">Nenhum aluno encontrado.</li>}
            {visiveis.map(({ x, i }) => (
              <li key={x.n}>
                <button onClick={() => setSel(i)} className={"flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-accent/60 " + (i === sel ? "bg-accent font-medium" : "")}>
                  {x.marcas ? <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0 text-warn" /> : <CircleCheck aria-hidden className="h-3.5 w-3.5 shrink-0 text-ok" />}
                  <span className="flex-1 truncate">{rotulo(x)}</span>
                  <span className={x.marcas ? "text-warn" : ""}>{x.marcas ? `${x.marcas} marcas` : fmt(x.total)}</span>
                </button>
              </li>
            ))}
          </ul>
          {!nomes && <p className="shrink-0 border-t px-4 py-2 text-xs text-muted-foreground">Nomes ocultos por padrão.</p>}
        </aside>
  );
}
