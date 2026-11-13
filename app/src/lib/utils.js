import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...i) => twMerge(clsx(i));

/** Série (6 a 9) de uma turma: "71" → 7; "81 e 82" → 8. `null` se não der para saber. */
export function serieDeTurma(turma) {
  const m = /(?:^|\D)([6-9])\d(?:\D|$)/.exec(String(turma ?? ""));
  return m ? Number(m[1]) : null;
}
/** Valor do campo `ano` (série) para um conjunto de turmas: `7` ou `[6, 7]`; vazio se nenhuma turma for reconhecida. */
export function anoDeTurmas(turmas) {
  const s = [...new Set(turmas.map(serieDeTurma).filter(Boolean))].sort();
  return s.length === 0 ? "" : s.length === 1 ? String(s[0]) : `[${s.join(", ")}]`;
}
