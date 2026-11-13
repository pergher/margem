// Temas: cada família tem uma classe clara e uma escura (definidas em src/themes.css).
// Os escuros também levam a classe `dark` (usada pelo Tailwind e pelos callouts).
// Cada tema é uma classe de src/themes.css; o claro e o escuro são escolhidos de forma independente.
export const CLAROS = {
  "t-margem": "Margem", "t-latte": "Catppuccin Latte", "t-ghlight": "GitHub Light", "t-onelight": "One Light",
  "t-sollight": "Solarized Light", "t-gruvlight": "Gruvbox Light", "t-areia": "Areia", "t-flexoki": "Flexoki",
};
export const ESCUROS = {
  "t-margem-escuro": "Margem", "t-mocha": "Catppuccin Mocha", "t-frappe": "Catppuccin Frappé", "t-macchiato": "Catppuccin Macchiato",
  "t-ghdark": "GitHub Dark", "t-onedark": "One Dark", "t-soldark": "Solarized Dark", "t-gruvbox": "Gruvbox",
  "t-dracula": "Dracula", "t-nord": "Nord", "t-rose": "Rosé Pine", "t-tokyo": "Tokyo Night", "t-nightowl": "Night Owl",
  "t-monokai": "Monokai", "t-kanagawa": "Kanagawa", "t-everforest": "Everforest", "t-ayu": "Ayu Mirage",
  "t-vesper": "Vesper", "t-poimandres": "Poimandres", "t-synthwave": "Synthwave '84",
};
export const PADRAO_CLARO = "t-margem", PADRAO_ESCURO = "t-margem-escuro";

const TODAS = [...Object.keys(CLAROS), ...Object.keys(ESCUROS)];

/** Lê a escolha guardada; migra a escolha antiga por "família" (par claro/escuro) se for o caso. */
export function lerTemas() {
  const ler = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  let claro = ler("temaClaro"), escuro = ler("temaEscuro");
  const antiga = ler("temaFamilia") && FAMILIAS_ANTIGAS[ler("temaFamilia")];
  if (!claro && antiga) claro = antiga[0];
  if (!escuro && antiga) escuro = antiga[1];
  return { claro: CLAROS[claro] ? claro : PADRAO_CLARO, escuro: ESCUROS[escuro] ? escuro : PADRAO_ESCURO };
}
const FAMILIAS_ANTIGAS = {
  margem: ["t-margem", "t-margem-escuro"], catppuccin: ["t-latte", "t-mocha"], frappe: ["t-latte", "t-frappe"], macchiato: ["t-latte", "t-macchiato"],
  github: ["t-ghlight", "t-ghdark"], one: ["t-onelight", "t-onedark"], solarized: ["t-sollight", "t-soldark"], gruvbox: ["t-gruvlight", "t-gruvbox"],
  areia: ["t-areia", "t-gruvbox"], flexoki: ["t-flexoki", "t-kanagawa"], dracula: ["t-latte", "t-dracula"], nord: ["t-ghlight", "t-nord"],
  rosepine: ["t-flexoki", "t-rose"], tokyonight: ["t-onelight", "t-tokyo"], nightowl: ["t-ghlight", "t-nightowl"], monokai: ["t-areia", "t-monokai"],
  kanagawa: ["t-flexoki", "t-kanagawa"], everforest: ["t-flexoki", "t-everforest"], ayu: ["t-areia", "t-ayu"], vesper: ["t-ghlight", "t-vesper"],
  poimandres: ["t-ghlight", "t-poimandres"], synthwave: ["t-onelight", "t-synthwave"],
};

/** Aplica no <html> o tema do modo atual (os escuros também levam a classe `dark`). */
export function aplicarTema(claro, escuro, dark) {
  const raiz = document.documentElement;
  raiz.classList.remove("dark", ...TODAS);
  raiz.classList.add(dark ? escuro : claro);
  if (dark) raiz.classList.add("dark");
}

export const ESTILOS_CALLOUT = {
  preenchido: "Preenchido",
  barra: "Barra lateral",
  contorno: "Contorno",
  discreto: "Discreto",
};

/** Aplica o estilo dos callouts (atributo no <html>; o CSS troca as variáveis). */
export function aplicarEstiloCallout(estilo) {
  document.documentElement.dataset.callout = ESTILOS_CALLOUT[estilo] ? estilo : "preenchido";
}
