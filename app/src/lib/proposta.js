// Propostas de alteração: divide o diff por linhas em trechos (igual / mudança) e monta o texto final a partir das escolhas.
import { diffLinhas } from "@/lib/diff";

/** [{ tipo: "igual", linhas } | { tipo: "mudanca", removidas, adicionadas }] — uma "mudança" é uma sequência contínua de -/+. */
export function trechos(base, novo) {
  const out = [];
  for (const { t, s } of diffLinhas(base, novo)) {
    const ult = out[out.length - 1];
    if (t === " ") { if (ult?.tipo === "igual") ult.linhas.push(s); else out.push({ tipo: "igual", linhas: [s] }); }
    else {
      const m = ult?.tipo === "mudanca" ? ult : out[out.push({ tipo: "mudanca", removidas: [], adicionadas: [] }) - 1];
      (t === "-" ? m.removidas : m.adicionadas).push(s);
    }
  }
  return out;
}

/** `aceitos`: conjunto com os índices (em `segs`) das mudanças aceitas. Aceitar todas dá o texto proposto; nenhuma, o texto base. */
export function textoFinal(segs, aceitos) {
  const linhas = [];
  segs.forEach((s, i) => {
    if (s.tipo === "igual") linhas.push(...s.linhas);
    else linhas.push(...(aceitos.has(i) ? s.adicionadas : s.removidas));
  });
  return linhas.join("\n");
}

export const indicesDeMudanca = (segs) => segs.flatMap((s, i) => (s.tipo === "mudanca" ? [i] : []));
