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
