// Cores do negrito e do itálico (valem no editor, na visão de Aula e nos embeds). Valor = qualquer cor CSS;
// as opções prontas usam as cores do tema ativo, então acompanham claro/escuro.
export const DESTAQUES_PADRAO = { negrito: "hsl(var(--primary))", italico: "hsl(var(--ok))" };
export const OPCOES_COR = [
  { nome: "Sem cor", valor: "hsl(var(--foreground))" },
  { nome: "Primária", valor: "hsl(var(--primary))" },
  { nome: "Verde", valor: "hsl(var(--ok))" },
  { nome: "Âmbar", valor: "hsl(var(--warn))" },
  { nome: "Vermelha", valor: "hsl(var(--err))" },
];

export function aplicarDestaques(d) {
  const r = document.documentElement.style, v = { ...DESTAQUES_PADRAO, ...d };
  r.setProperty("--cor-negrito", v.negrito);
  r.setProperty("--cor-italico", v.italico);
}
