// Preferências simples no localStorage (a leitura nunca lança: sem armazenamento vale o padrão).
export const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
