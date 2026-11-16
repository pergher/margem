// Pasta raiz do vault. O App a informa ao abrir; sem ela (testes, navegador) deduz da primeira nota.
// Com o vault vazio não há nota para deduzir, por isso a raiz informada é a fonte principal.
let raizInformada = "";
export const definirRaiz = (r) => { if (r && r !== "navegador") raizInformada = String(r).replace(/\/+$/, ""); };

/** Raiz sem barra no fim. */
export const raizDe = (items) => raizInformada || (items?.[0] ? items[0].path.slice(0, items[0].path.length - items[0].rel.length).replace(/\/$/, "") : "");
/** Raiz com barra no fim. */
export const raizBarra = (items) => { const r = raizDe(items); return r ? r + "/" : ""; };
