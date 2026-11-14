// Pares de fontes (da tela "Pares de fontes" do artefato de design). Cada par define cinco papéis, aplicados como
// variáveis CSS no <html> (ver index.css): interface, texto das notas, títulos H1/H3, demais títulos e código.
// As fontes vêm empacotadas (@fontsource), então funcionam offline.
const SERIF = "'Source Serif 4 Variable', Georgia, serif", INTER = "'Inter Variable', system-ui, sans-serif", JB = "'JetBrains Mono Variable', monospace";
export const FONTES = {
  caloroso: { nome: "Caloroso, com personalidade", ui: INTER, texto: INTER, h1: "'Fraunces Variable', Georgia, serif", h: "'Fraunces Variable', Georgia, serif", mono: "'IBM Plex Mono', monospace", roles: "Títulos Fraunces · Texto Inter · Código IBM Plex Mono" },
  sobrio: { nome: "Sóbrio e clássico", ui: INTER, texto: SERIF, h1: SERIF, h: INTER, mono: JB, roles: "Títulos Source Serif 4 e Inter · Texto Source Serif 4 · Código JetBrains Mono" },
  leitura: { nome: "Foco em leitura", ui: "'Atkinson Hyperlegible', system-ui, sans-serif", texto: "'Atkinson Hyperlegible', system-ui, sans-serif", h1: "'Literata Variable', Georgia, serif", h: "'Literata Variable', Georgia, serif", mono: "'Fira Code Variable', monospace", roles: "Títulos Literata · Texto Atkinson Hyperlegible · Código Fira Code" },
  escolar: { nome: "Escolar acolhedor", ui: "'Nunito Variable', system-ui, sans-serif", texto: "'Nunito Variable', system-ui, sans-serif", h1: "'Lora Variable', Georgia, serif", h: "'Lora Variable', Georgia, serif", mono: "'Roboto Mono Variable', monospace", roles: "Títulos Lora · Texto Nunito · Código Roboto Mono" },
  moderno: { nome: "Moderno e amigável", ui: "'Manrope Variable', system-ui, sans-serif", texto: "'Manrope Variable', system-ui, sans-serif", h1: "'Bricolage Grotesque Variable', system-ui, sans-serif", h: "'Bricolage Grotesque Variable', system-ui, sans-serif", mono: "'Geist Mono Variable', monospace", roles: "Títulos Bricolage Grotesque · Texto Manrope · Código Geist Mono" },
};
export const PADRAO_FONTE = "caloroso";
/** Fonte guardada. Quem ainda não passou pelo novo padrão (Caloroso, com personalidade) é movido para ele uma vez; depois vale a escolha. */
export function fonteSalva() {
  try {
    if (!localStorage.getItem("fontePadrao2")) { localStorage.setItem("fontePadrao2", "1"); localStorage.setItem("fonte", JSON.stringify(PADRAO_FONTE)); }
    return JSON.parse(localStorage.getItem("fonte") || JSON.stringify(PADRAO_FONTE));
  } catch { return PADRAO_FONTE; }
}
export const TAMANHOS_TEXTO = { 16: "Pequeno", 17: "Padrão", 19: "Grande", 21: "Muito grande" };

export function aplicarFonte(id, tamanho = 17) {
  const f = FONTES[id] || FONTES[PADRAO_FONTE], s = document.documentElement.style;
  s.setProperty("--f-ui", f.ui); s.setProperty("--f-texto", f.texto); s.setProperty("--f-h1", f.h1); s.setProperty("--f-h", f.h); s.setProperty("--f-mono", f.mono);
  s.setProperty("--tamanho-texto", (TAMANHOS_TEXTO[tamanho] ? tamanho : 17) / 16 + "rem");
}
