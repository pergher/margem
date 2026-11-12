// Tipos de nota que têm tela própria ("visão personalizada"). A nota aberta é reconhecida pelo caminho.
export const VISOES = [
  { id: "ciclo", nome: "Ciclo", casa: (rel) => /^Anos\/\d{4}\/Planejamento\/\d{3}\b/.test(rel) },
  { id: "semana", nome: "Semana", casa: (rel) => /^Anos\/\d{4}\/Semanas\/[^/]+\.md$/.test(rel) },
  { id: "correcao", nome: "Correção", casa: (rel) => /^Anos\/\d{4}\/Correcoes\/[^/]+\/Transcrições e devolutivas\.md$/.test(rel) },
  { id: "prova", nome: "Prova", casa: (rel) => /^Anos\/\d{4}\/Provas\/[^/]+\.md$/.test(rel) },
  { id: "diario", nome: "Diário", casa: (rel) => /^Anos\/\d{4}\/Diarios\/[^/]+\/[^/]+\.md$/.test(rel) },
  { id: "aluno", nome: "Aluno", casa: (rel) => /^Anos\/\d{4}\/Alunos\/[^/]+\/[^/]+\.md$/.test(rel) },
  { id: "texto", nome: "Texto", casa: (rel) => /^Acervo\/Textos\/[^/]+\.md$/.test(rel) },
];
export const visaoDe = (rel) => (rel ? VISOES.find((v) => v.casa(rel)) ?? null : null);
