import { ERRO } from "@/lib/correcao";

// Marcas da transcrição, erros do aluno e negrito/itálico simples.
// `ver` (só na transcrição) liga os erros: { orto, pont, corr } — sem ele as chaves ficam como texto.
export function Inline({ s, ver }) {
  const partes = s.split(/(\{[^{}]*\}|~~[^~]+~~|\^[^^]+\^|\[[^\]]*\?\]|\[ilegível\]|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return partes.map((p, i) => {
    const e = ver && p.startsWith("{") ? ERRO.exec(p) : null;
    if (e) {
      const pont = !!e[1], antes = e[2], certo = e[3];
      if (pont ? !ver.pont : !ver.orto) return <span key={i}>{antes}</span>;
      const dica = (pont ? "Pontuação" : "Ortografia") + (certo != null ? (certo ? ` → ${certo}` : " → remover") : "");
      const corr = ver.corr && certo ? <span className="ml-0.5 rounded bg-ok/15 px-1 text-xs text-ok">{certo}</span> : null;
      if (!pont) return <span key={i} title={dica} className="underline decoration-red-500 decoration-wavy decoration-2 underline-offset-4">{antes}{corr}</span>;
      if (!antes) return <span key={i} title={dica} className="mx-px rounded bg-sky-200 px-1 text-sky-900 dark:bg-sky-900 dark:text-sky-100">{certo ? (ver.corr ? certo : "▲") : "▲"}</span>;
      return <span key={i} title={dica} className="rounded bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100">{antes}{corr}</span>;
    }
    if (p.startsWith("~~")) return <s key={i} className="text-muted-foreground">{p.slice(2, -2)}</s>;
    if (p.startsWith("^")) return <sup key={i} className="rounded bg-primary/15 px-1 text-xs text-primary">{p.slice(1, -1)}</sup>;
    if (p === "[ilegível]") return <span key={i} className="rounded bg-err/15 px-1.5 text-err">{p}</span>;
    if (/^\[.*\?\]$/.test(p)) return <span key={i} className="rounded bg-warn/15 px-1.5 text-warn">{p}</span>;
    if (p.startsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

// Liga/desliga uma marca de erro no texto: amostra da marca + contagem, sem rótulo longo (o nome vai no title).
export function Marca({ on, onClick, nome, n, children }) {
  return (
    <button onClick={onClick} aria-pressed={on} aria-label={`${nome}: ${n}`} title={`${nome}: ${n} erro(s) marcados (clique para ${on ? "ocultar" : "mostrar"} no texto)`}
      className={"flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs tabular-nums hover:bg-accent/60 " + (on ? "text-foreground" : "text-muted-foreground opacity-50")}>
      {children}{n}
    </button>
  );
}
