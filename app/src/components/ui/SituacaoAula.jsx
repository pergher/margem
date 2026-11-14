import { Check, CornerDownRight, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

/** As três situações de uma aula (a mesma lista em Hoje e na Semana). `id` é o que fica gravado na nota. */
export const OPCOES = [
  { id: "dada", Icone: Check, nome: "Dada", dica: "Dei a aula", cor: "text-ok bg-ok/10 border-ok/40" },
  { id: "pulada", Icone: CornerDownRight, nome: "Adiada", dica: "Não dei; darei depois", cor: "text-warn bg-warn/10 border-warn/40" },
  { id: "descartada", Icone: Ban, nome: "Descartada", dica: "Não darei mais (sai do ciclo)", cor: "text-foreground bg-muted border-foreground/30" },
];

/**
 * Escolha da situação da aula. A opção escolhida fica marcada (cor, nome e aria-pressed); clicar nela de novo desfaz.
 * `discreto`: sem escolha, só aparece quando `.group` pai recebe o mouse/foco; com escolha, a marcada fica sempre visível.
 */
export function SituacaoAula({ situacao, onChange, discreto = false, className }) {
  return (
    <div role="group" aria-label="Situação da aula" className={cn("flex items-center gap-1.5", className)}>
      {OPCOES.map(({ id, Icone, nome, dica, cor }) => {
        const marcada = situacao === id;
        return (
          <button key={id} type="button" aria-pressed={marcada} title={marcada ? `${nome} — clique para desfazer` : dica} onClick={() => onChange(marcada ? null : id)}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
              marcada ? cn("font-semibold", cor) : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
              !marcada && discreto && "opacity-0 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100",
              !marcada && situacao && discreto && "group-hover:opacity-100")}>
            <Icone aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.9} />{(marcada || !discreto) && nome}
          </button>
        );
      })}
    </div>
  );
}
