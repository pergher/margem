import { useState } from "react";
import { SINAIS } from "@/lib/aula";
import { Inline } from "@/components/ui/Inline";
import { cn } from "@/lib/utils";

const TURMA_KEY = "margem.memoria.turma";
const rotuloData = (d) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "");
const resumo = (e) => [rotuloData(e.data), e.turma, e.sinal].filter(Boolean).join(" · ");

/** "Da última vez": aparece só se a aula já tem notas na seção `## Memória`; recolhida, sem contador nem aviso. */
export function DaUltimaVez({ entradas }) {
  const [aberto, setAberto] = useState(false);
  if (!entradas?.length) return null;
  const ultima = entradas[entradas.length - 1];
  return (
    <div aria-label="Da última vez" className="mt-3 max-w-[44rem] rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
      <button onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex w-full items-baseline gap-2 text-left hover:text-foreground">
        <span className="shrink-0 text-xs font-medium">Da última vez{resumo(ultima) && ` (${resumo(ultima)})`}</span>
        {!aberto && ultima.texto && <span className="min-w-0 flex-1 truncate"><Inline texto={ultima.texto} /></span>}
      </button>
      {aberto && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {[...entradas].reverse().map((e, i) => (
            <li key={i}><span className="text-xs">{resumo(e)}{resumo(e) && e.texto && " — "}</span>{e.texto && <Inline texto={e.texto} />}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Link discreto no fim da aula. Nunca é pedido: abre um campo opcional (turma, sinal e texto) e grava em `## Memória`. */
export function NotaDestaVez({ onAdicionar, aberto: abertoFora, onFechar }) { // `aberto`/`onFechar`: controlada de fora (celular)
  const [abertoI, setAbertoI] = useState(false);
  const aberto = abertoFora ?? abertoI, setAberto = (v) => { setAbertoI(v); if (!v) onFechar?.(); };
  const [texto, setTexto] = useState(""), [sinal, setSinal] = useState("");
  const [turma, setTurma] = useState(() => { try { return localStorage.getItem(TURMA_KEY) ?? ""; } catch { return ""; } });
  const [erro, setErro] = useState("");
  const fechar = () => { setAberto(false); setTexto(""); setSinal(""); setErro(""); };
  const guardar = async () => {
    if (!texto.trim() && !sinal) return fechar();
    try { await onAdicionar({ texto, sinal, turma }); try { localStorage.setItem(TURMA_KEY, turma.trim()); } catch { /* sem armazenamento */ } fechar(); }
    catch (e) { setErro(String(e?.message ?? e)); }
  };
  if (!aberto) return <button onClick={() => setAberto(true)} className="text-xs text-muted-foreground/80 hover:text-foreground">+ nota desta vez</button>;
  return (
    <div aria-label="Nota desta vez" className="flex max-w-[44rem] flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={turma} onChange={(e) => setTurma(e.target.value)} placeholder="turma" aria-label="Turma (opcional)" className="h-7 w-20 rounded-md border bg-background px-2 text-xs" />
        {SINAIS.map((s) => (
          <button key={s} aria-pressed={sinal === s} onClick={() => setSinal(sinal === s ? "" : s)}
            className={cn("h-7 rounded-md border px-2.5 text-xs", sinal === s ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}>{s}</button>
        ))}
      </div>
      <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que vale lembrar (opcional)" aria-label="Nota"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardar(); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); } }}
        className="h-8 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary" />
      <div className="flex items-center gap-3 text-xs">
        <button onClick={guardar} className="rounded-md bg-primary px-3 py-1 text-primary-foreground hover:opacity-90">Guardar</button>
        <button onClick={fechar} className="text-muted-foreground hover:text-foreground">Cancelar</button>
        {erro && <span className="text-err">{erro}</span>}
      </div>
    </div>
  );
}
