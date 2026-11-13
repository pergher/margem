// Forma e densidade (da tela "Forma e densidade" do artefato de design): cantos e espaçamento da interface.
// Aplicadas no <html>: `--r-md`/`--r-lg` alimentam os raios do Tailwind; `--densidade` escala o rem (e com ele o espaçamento).
export const FORMAS = {
  tecnico: { nome: "Reto e compacto", spec: "Cantos 0 · espaço justo", md: "0px", lg: "0px", dens: 0.9 },
  compacto: { nome: "Suave e compacto", spec: "Cantos 4 a 6 · espaço justo", md: "0.25rem", lg: "0.375rem", dens: 0.92 },
  padrao: { nome: "Suave e confortável", spec: "Cantos 8 a 12 · espaço padrão", md: "0.5rem", lg: "0.75rem", dens: 1 },
  arredondado: { nome: "Arredondado", spec: "Cantos 12 a 18 · espaço padrão", md: "0.875rem", lg: "1.125rem", dens: 1 },
  arejado: { nome: "Arejado e leve", spec: "Cantos 14 a 20 · espaço amplo", md: "0.875rem", lg: "1.25rem", dens: 1.08 },
};
export const PADRAO_FORMA = "padrao";

export function aplicarForma(id) {
  const f = FORMAS[id] || FORMAS[PADRAO_FORMA], s = document.documentElement.style;
  s.setProperty("--r-md", f.md); s.setProperty("--r-lg", f.lg); s.setProperty("--densidade", String(f.dens));
}
