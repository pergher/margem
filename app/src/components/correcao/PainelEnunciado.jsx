import { useEffect, useState } from "react";
import { IconChevronDown as ChevronDown, IconCopy as Copy, IconPencil as Pencil, IconPlus as Plus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { gravarEnunciado } from "@/lib/correcao";

/** Enunciado da atividade (seção `## Enunciado` da nota): recolhido por padrão, editável e copiável para colar no pedido à IA. */
export function PainelEnunciado({ d, onSalvo, dizer, onErro }) {
  const [aberto, setAberto] = useState(false), [edit, setEdit] = useState(false), [txt, setTxt] = useState("");
  useEffect(() => { setEdit(false); }, [d.path]);
  const salvar = () => gravarEnunciado(d.path, txt).then(onSalvo).then(() => { setEdit(false); dizer("Enunciado gravado"); }).catch((e) => onErro(String(e?.message ?? e)));
  const comecar = () => { setTxt(d.enunciado); setEdit(true); setAberto(true); };
  const copiar = () => navigator.clipboard?.writeText(d.enunciado).then(() => dizer("Enunciado copiado"));
  return (
    <section aria-label="Enunciado" className="shrink-0 border-b bg-muted/30 px-6 py-2 text-sm">
      <div className="flex items-center gap-2">
        <button onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
          <ChevronDown aria-hidden className={"h-3.5 w-3.5 transition-transform " + (aberto ? "" : "-rotate-90")} />Enunciado
        </button>
        {!d.enunciado && !edit && <button onClick={comecar} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Plus aria-hidden className="h-3 w-3" />Adicionar enunciado</button>}
        {d.enunciado && !aberto && <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{d.enunciado.replace(/\s+/g, " ")}</span>}
        {d.enunciado && !edit && <span className="ml-auto flex shrink-0 items-center gap-1">
          <button onClick={copiar} title="Copiar o enunciado" aria-label="Copiar o enunciado" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Copy aria-hidden className="h-3.5 w-3.5" /></button>
          <button onClick={comecar} title="Editar o enunciado" aria-label="Editar o enunciado" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil aria-hidden className="h-3.5 w-3.5" /></button>
        </span>}
      </div>
      {aberto && edit && (
        <div className="mt-2">
          <textarea autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} aria-label="Texto do enunciado" placeholder="O que foi pedido aos alunos: gênero, tema, extensão, estrutura, material de apoio…" className="h-40 w-full resize-y rounded-lg border bg-background p-2 text-sm outline-none focus-visible:border-primary" />
          <div className="mt-2 flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setEdit(false)}>Cancelar</Button><Button size="sm" onClick={salvar}>Salvar</Button></div>
        </div>
      )}
      {aberto && !edit && d.enunciado && <div className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap leading-relaxed">{d.enunciado}</div>}
    </section>
  );
}
