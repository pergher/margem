// Estilo dos ícones (da tela "Estilos de ícones" do artefato de design). Em teste: Traço fino e Duotone suave.
// Aplicado como `data-icones` no <html>; as regras ficam em index.css e valem para todos os ícones do lucide.
export const ICONES = {
  padrao: { nome: "Padrão (atual)", nota: "Traço de 1,6 a 2 px, como estava" },
  fino: { nome: "Traço fino", nota: "Parecido com Phosphor Light · traço de 1,25 px" },
  duotone: { nome: "Duotone suave", nota: "Parecido com Phosphor Duotone · traço de 1,75 px e miolo com 18% de cor" },
};
export const PADRAO_ICONES = "padrao";
export function aplicarIcones(id) {
  document.documentElement.dataset.icones = ICONES[id] ? id : PADRAO_ICONES;
}
