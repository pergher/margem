import { useState, useCallback } from "react";

/** Largura de coluna guardada no navegador (por chave). */
export function useWidth(key, padrao) {
  const k = "vault.largura." + key;
  const [w, setW] = useState(() => {
    try { const v = Number(localStorage.getItem(k)); return v > 0 ? v : padrao; } catch { return padrao; }
  });
  const set = useCallback((v) => { setW(v); try { localStorage.setItem(k, String(v)); } catch { /* sem armazenamento */ } }, [k]);
  return [w, set];
}
