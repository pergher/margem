// Cor de cada ano (6º ao 9º) e de cada turma. A turma herda a cor do ano (o 1º dígito: "62" → 6º ano) com uma variação
// de tom por turma ("61" a cor-base, "62" mais clara, "63" mais escura…), para o 6º ano ser sempre "o azul".
// As cores vêm de variáveis CSS (--ano-6 … --ano-9 em index.css), com versão clara e escura.
const BASE = (ano) => `hsl(var(--ano-${/^[6-9]$/.test(String(ano)) ? ano : 0}))`;
const VARIACAO = [null, "white 24%", "black 22%", "white 44%", "black 40%"];

/** Cor do ano ("6" ou "6º"), como valor CSS. */
export const corAno = (ano) => BASE(String(ano).trim().charAt(0));

/** Cor da turma ("61", "72"…), como valor CSS. Turma sem ano reconhecível fica cinza. */
export function corTurma(turma) {
  const t = String(turma).trim(), base = BASE(t.charAt(0)), k = Number(t.slice(1).replace(/\D/g, "")) || 1;
  const v = VARIACAO[(k - 1) % VARIACAO.length];
  return v ? `color-mix(in oklab, ${base}, ${v})` : base;
}

export const anoDaTurma = (turma) => String(turma).trim().charAt(0);
