import { IconInfoCircle as Info } from "@tabler/icons-react";
import { CAB } from "./estilos";
import { Inline, Marca } from "./Inline";

export function Transcricao({ a, ver, setVer, titulo, par }) {
  return (
        <section aria-label="Transcrição" className="flex min-w-[260px] flex-1 flex-col">
          <div className={CAB}><span className="font-semibold">Transcrição</span>
            <span className="group relative">
              <button aria-label="Como marcar a transcrição" className="rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:text-foreground"><Info className="h-4 w-4" /></button>
              <div role="tooltip" className="invisible absolute left-0 top-full z-20 mt-1 w-72 space-y-2 rounded-lg border bg-background p-3 text-xs text-foreground shadow-lg group-focus-within:visible group-hover:visible">
                <p>Use <code>{"{errado|certo}"}</code> e <code>{"{p:|,}"}</code> na transcrição.</p>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                  <span><span className="rounded bg-warn/15 px-1.5 text-warn">[palavra?]</span> incerta</span>
                  <span className="rounded bg-err/15 px-1.5 text-err">[ilegível]</span>
                  <s>riscado</s>
                  <sup className="rounded bg-primary/15 px-1 text-primary">acrescentado</sup>
                </p>
              </div>
            </span>
                        <span className="ml-auto flex items-center"><Marca on={ver.orto} onClick={() => setVer({ ...ver, orto: !ver.orto })} nome="Ortografia" n={a.erros.orto}><span aria-hidden className="underline decoration-red-500 decoration-wavy decoration-1 underline-offset-4">ab</span><span className="hidden xl:inline">ortografia</span></Marca>
            <Marca on={ver.pont} onClick={() => setVer({ ...ver, pont: !ver.pont })} nome="Pontuação" n={a.erros.pont}><span aria-hidden className="rounded bg-sky-100 px-1 text-sky-900 dark:bg-sky-950 dark:text-sky-100">,</span><span className="hidden xl:inline">pontuação</span></Marca></span>
</div>
          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
            <div className="font-serif text-base leading-[1.75]">
              <p className="mb-4 font-semibold"><Inline s={titulo} ver={ver} /></p>
              {par.map((p, i) => <p key={i} className="mb-4"><Inline s={p} ver={ver} /></p>)}
            </div>
          </div>
        </section>
  );
}
