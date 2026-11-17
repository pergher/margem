// Caminho no topo da janela ("migalhas") e a seção do menu que fica ativa. Funções puras, extraídas de App.jsx.
// Cada migalha é { t: texto, ir?: função }; em Aulas, Gramática e Recursos as pastas são clicáveis e levam à listagem delas.

export const NOMES_REC = { Questoes: "Questões" };

/** Rótulo da tela quando ela não é uma nota nem uma listagem com pastas. */
export const rotuloDaTela = (page, inicioModo) => ({
  semana: { hoje: "Hoje", semana: "Semana", ano: "Ano" }[inicioModo] ?? "Hoje",
  ciclos: "Ciclos", aulas: "Aulas", gramatica: "Gramática", recursos: "Recursos", correcao: "Produções", diario: "Diário", saude: "Saúde do vault", config: "Configurações",
})[page] ?? "";

/**
 * `estado`: { page, rel (caminho da nota aberta no vault), inicioModo, ciclo, ciclosPasta, gramaticaPasta, aulasPasta, recursosAba, recursosPasta }.
 * `ir`: { secao(nome), aulas(pasta), recursos(pasta), setCiclosPasta, setGramaticaPasta, setPage }.
 */
export function migalhas({ page, rel, inicioModo, ciclo, ciclosPasta, gramaticaPasta, aulasPasta, recursosAba, recursosPasta }, ir) {
  const pastas = (pasta) => (pasta ? pasta.split("/") : []);
  if (page === "ciclos") return [{ t: "Ciclos", ir: () => ir.secao("ciclos") }, ...pastas(ciclosPasta).map((t, i, a) => ({ t, ir: () => ir.setCiclosPasta(a.slice(0, i + 1).join("/")) }))];
  if (page === "gramatica") return [{ t: "Gramática", ir: () => ir.secao("gramatica") }, ...pastas(gramaticaPasta).map((t, i, a) => ({ t, ir: () => ir.setGramaticaPasta(a.slice(0, i + 1).join("/")) }))];
  if (page === "aulas") return [{ t: "Aulas", ir: () => ir.aulas("") }, ...pastas(aulasPasta).map((t, i, a) => ({ t: t.replace(/^_/, ""), ir: () => ir.aulas(a.slice(0, i + 1).join("/")) }))];
  if (page === "recursos" && recursosAba !== "montar") return [{ t: "Recursos", ir: () => ir.recursos("") }, ...pastas(recursosPasta).map((t, i, a) => ({ t: NOMES_REC[t] ?? t.replace(/^_/, ""), ir: () => ir.recursos(a.slice(0, i + 1).join("/")) }))];
  if (page === "ciclo") return [{ t: "Ciclos", ir: () => ir.secao("ciclos") }, { t: ciclo?.titulo ?? "Ciclo" }];
  if (page !== "editor") return [rotuloDaTela(page, inicioModo)].filter(Boolean).map((t) => ({ t }));
  if (!rel) return [];
  return rel.replace(/\.md$/, "").split("/").map((t, i, a) => {
    if (/^Acervo\/Aulas\//.test(rel)) { // aula: o caminho começa em "Aulas" (sem "Acervo")
      if (i === 0) return null;
      if (i === 1) return { t, ir: () => ir.aulas("") };
      if (i < a.length - 1) return { t, ir: () => ir.aulas(a.slice(2, i + 1).join("/")) };
    }
    if (/^Acervo\/Gram[aá]tica\//.test(rel)) { // gramática: o caminho começa em "Gramática"
      if (i === 0) return null;
      if (i === 1) return { t: "Gramática", ir: () => { ir.setGramaticaPasta(""); ir.setPage("gramatica"); } };
      if (i < a.length - 1) return { t, ir: () => { ir.setGramaticaPasta(a.slice(2, i + 1).join("/")); ir.setPage("gramatica"); } };
    }
    if (/^Acervo\/(Questoes|Textos|Oficinas)\//.test(rel)) { // recurso: o caminho começa em "Recursos"
      if (i === 0) return null;
      if (i === 1) return { t: NOMES_REC[t] ?? t, ir: () => ir.recursos(t) };
      if (i < a.length - 1) return { t, ir: () => ir.recursos(a.slice(1, i + 1).join("/")) };
    }
    if (/^Acervo\//.test(rel)) { // demais pastas do Acervo: sem "Acervo"; "Ciclos" leva à tela Ciclos
      if (i === 0) return null;
      if (i === 1 && t === "Ciclos") return { t, ir: () => ir.secao("ciclos") };
    }
    if (/^Anos\//.test(rel) && i === 2) { // seções do ano que têm tela própria
      const tela = { Semanas: "semana", Correcoes: "correcao", Diario: "diario", Diarios: "diario" }[t];
      if (tela) return { t, ir: () => ir.secao(tela) };
    }
    return { t };
  }).filter(Boolean);
}

/** Seção do menu lateral que fica destacada para a tela (ou a nota aberta). */
export function secaoAtiva(page, rel) {
  if (page === "editor") {
    if (!rel) return null;
    if (/^Acervo\/Aulas\//.test(rel)) return "aulas";
    if (/^Acervo\/Gram[aá]tica\//.test(rel)) return "gramatica";
    if (/^Acervo\/(Questoes|Textos|Oficinas)\/|\/Provas\//.test(rel)) return "recursos";
    if (/\/Correcoes\//.test(rel)) return "correcao";
    return null;
  }
  return ({ semana: "hoje", ciclo: "ciclos", ciclos: "ciclos", aulas: "aulas", gramatica: "gramatica", recursos: "recursos", correcao: "correcao", diario: "diario", saude: "saude", config: "config" })[page];
}
