// Arquivos abertos há pouco, para a tela Hoje. Guardados no navegador/app (não vão para o vault).
const CHAVE = "recentes", MAX = 8;
export function lerRecentes() {
  try { const v = JSON.parse(localStorage.getItem(CHAVE)); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function lembrarRecente(path) {
  try { localStorage.setItem(CHAVE, JSON.stringify([{ path, ts: Date.now() }, ...lerRecentes().filter((r) => r.path !== path)].slice(0, MAX))); } catch { /* sem armazenamento */ }
}
/** "há 10 min", "há 3 h", "ontem", "há 4 dias". */
export function haQuanto(ts, agora = Date.now()) {
  const min = Math.max(0, Math.round((agora - ts) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/** Tipo de um arquivo pelo caminho no vault: nome, ícone e a cor que o identifica (as cores dos anos servem de paleta). */
export function tipoDeRel(rel = "") {
  if (/^Acervo\/Aulas\//.test(rel)) return { id: "aula", nome: "Aula", cor: "hsl(var(--primary))" };
  if (/^Acervo\/Questoes\//.test(rel)) return { id: "banco", nome: "Banco de questões", cor: "hsl(var(--ano-7))" };
  if (/\/Provas\//.test(rel)) return { id: "prova", nome: "Prova", cor: "hsl(var(--ano-7))" };
  if (/\/Correcoes\//.test(rel)) return { id: "correcao", nome: "Correção", cor: "hsl(var(--ano-8))" };
  if (/\/Semanas\//.test(rel)) return { id: "semana", nome: "Semana", cor: "hsl(var(--ano-6))" };
  if (/^Acervo\/Ciclos\//.test(rel) || /\/Planejamento\//.test(rel)) return { id: "ciclo", nome: "Ciclo", cor: "hsl(var(--ano-6))" };
  if (/^Acervo\/Textos\//.test(rel)) return { id: "texto", nome: "Texto", cor: "hsl(var(--ano-9))" };
  if (/\/(Diarios|Alunos)\//.test(rel)) return { id: "diario", nome: "Diário", cor: "hsl(var(--warn))" };
  return { id: "nota", nome: "Nota", cor: "hsl(var(--ano-0))" };
}
