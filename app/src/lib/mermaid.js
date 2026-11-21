// Desenho de diagramas Mermaid (mapa mental) com as cores do tema ativo. Usado na visão da aula e no editor (bloco ```mermaid).

/** Cores do Mermaid tiradas das variáveis CSS do tema ativo (`--primary`, `--chart-*`…), para o mapa combinar com a interface. */
export function variaveisMermaid() {
  const cs = getComputedStyle(document.documentElement);
  const c = (v, alt) => { const x = cs.getPropertyValue(v).trim(); return x ? `hsl(${x.replace(/\s+/g, ", ")})` : alt; };
  const escuro = document.documentElement.classList.contains("dark");
  // Os temas do shadcn trazem --chart-1..5; os demais caem em --primary, --ok, --warn, --err e --muted-foreground.
  const ramos = [["--chart-1", "--primary"], ["--chart-2", "--ok"], ["--chart-3", "--warn"], ["--chart-4", "--err"], ["--chart-5", "--muted-foreground"]]
    .map(([a, b]) => c(a, c(b, "#888")));
  const v = {
    darkMode: escuro, background: c("--background", "#fff"), fontFamily: cs.getPropertyValue("--font-sans").trim() || "inherit",
    primaryColor: c("--card", "#fff"), primaryTextColor: c("--foreground", "#222"), primaryBorderColor: c("--primary", "#888"),
    lineColor: c("--muted-foreground", "#888"), secondaryColor: c("--accent", "#eee"), tertiaryColor: c("--background", "#fff"),
    textColor: c("--foreground", "#222"), mainBkg: c("--card", "#fff"), nodeBorder: c("--primary", "#888"),
  };
  // Mindmap: cada ramo principal numa cor do tema, com o texto na cor de fundo (contraste).
  ramos.forEach((r, i) => { v[`cScale${i}`] = r; v[`cScaleLabel${i}`] = c("--background", "#fff"); });
  ramos.forEach((r, i) => { v[`cScale${i + 5}`] = ramos[(i + 2) % 5]; v[`cScaleLabel${i + 5}`] = c("--background", "#fff"); });
  return v;
}

/** Muda quando o tema (claro/escuro, cores) muda: quem guarda o desenho refaz. */
export const assinaturaTema = () => JSON.stringify(variaveisMermaid());

const cache = new Map();
let contador = 0;

/** Desenha o código e devolve o SVG (texto). Guarda o resultado por código e tema; rejeita se o código for inválido. */
export function desenharMermaid(codigo) {
  const chave = assinaturaTema() + "\n" + codigo;
  if (!cache.has(chave)) {
    const p = import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: variaveisMermaid() });
      return (await mermaid.render("mm" + ++contador + Math.random().toString(36).slice(2, 6), codigo)).svg;
    });
    p.catch(() => cache.delete(chave));
    cache.set(chave, p);
    if (cache.size > 40) cache.delete(cache.keys().next().value);
  }
  return cache.get(chave);
}

/** Parte o Markdown nos trechos de texto e nos blocos ```mermaid, na ordem em que aparecem. */
export function partirMermaid(md) {
  const partes = [];
  let i = 0;
  for (const m of md.matchAll(/```mermaid[^\n]*\n([\s\S]*?)```/g)) {
    if (m.index > i) partes.push({ tipo: "md", md: md.slice(i, m.index) });
    partes.push({ tipo: "mermaid", codigo: m[1].trim() });
    i = m.index + m[0].length;
  }
  if (i < md.length) partes.push({ tipo: "md", md: md.slice(i) });
  return partes;
}
