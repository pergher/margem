// Caminho no topo da janela ("migalhas") e a seção do menu que fica ativa. Funções puras, extraídas de App.jsx.
// Cada migalha é { t: texto, ir?: função }; em Documentos e Ciclos as pastas são clicáveis e levam à listagem delas.

export const NOMES_PASTA = { Questoes: "Questões" };

/** Rótulo da tela quando ela não é uma nota nem uma listagem com pastas. */
export const NOMES_ABA = { semana: "Semana", plano: "Planejamento", prod: "Produções", diario: "Diário", fechamento: "Fechamento" };
export const rotuloDaTela = (page) => ({
  inicio: "Hoje", ano: "Semana", documentos: "Documentos", saude: "Saúde do vault", config: "Configurações",
})[page] ?? "";

/**
 * `estado`: { page, rel (caminho da nota aberta no vault), anoAba, ciclo, documentosPasta, documentosAba }.
 * `ir`: { secao(nome), documentos(pasta), ano(aba) }.
 */
export function migalhas({ page, rel, anoAba, ciclo, documentosPasta, documentosAba }, ir) {
  const pastas = (pasta) => (pasta ? pasta.split("/") : []);
  if (page === "documentos" && documentosAba !== "montar") return [{ t: "Documentos", ir: () => ir.documentos("") }, ...pastas(documentosPasta).map((t, i, a) => ({ t: NOMES_PASTA[t] ?? t.replace(/^_/, ""), ir: () => ir.documentos(a.slice(0, i + 1).join("/")) }))];
  if (page === "ciclo") return [{ t: "Ciclos", ir: () => ir.secao("ciclos") }, { t: ciclo?.titulo ?? "Ciclo" }];
  if (page === "ano") return anoAba && anoAba !== "semana" ? [{ t: "Semana" }, { t: NOMES_ABA[anoAba] ?? NOMES_ABA.semana }] : [{ t: "Semana" }];
  if (page !== "editor") return [rotuloDaTela(page)].filter(Boolean).map((t) => ({ t }));
  if (!rel) return [];
  return rel.replace(/\.md$/, "").split("/").map((t, i, a) => {
    if (/^Acervo\//.test(rel)) { // documentos do Acervo: o caminho começa em "Documentos" (sem "Acervo")
      if (i === 0) return { t: "Documentos", ir: () => ir.documentos("") };
      if (i < a.length - 1) return { t: NOMES_PASTA[t] ?? t, ir: () => ir.documentos(a.slice(1, i + 1).join("/")) };
    }
    if (/^Anos\//.test(rel) && i === 2) { // seções do ano que têm tela própria
      const aba = { Semanas: "semana", Planejamento: "plano", Correcoes: "prod", Diario: "diario", Diarios: "diario" }[t];
      if (aba) return { t, ir: () => ir.ano(aba) };
    }
    return { t };
  }).filter(Boolean);
}

/** Seção do menu lateral que fica destacada para a tela (ou a nota aberta). */
export function secaoAtiva(page, rel) {
  if (page === "editor") {
    if (!rel) return null;
    if (/^Acervo\//.test(rel) || /\/Provas\//.test(rel)) return "documentos";
    if (/^Anos\//.test(rel)) return "ano";
    return null;
  }
  return ({ inicio: "hoje", ano: "ano", ciclo: "documentos", ciclos: "ciclos", documentos: "documentos", saude: "saude", config: "config" })[page];
}
