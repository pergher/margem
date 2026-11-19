// Modo compacto (celular): a mesma interface, em uma coluna e com barra inferior.
// Preferência "modoCompacto": "auto" (padrão: abaixo de 768 px), "sim" (sempre) ou "nao" (nunca).
import { createContext, useContext, useEffect, useState } from "react";
import { store } from "@/lib/store";

export const LARGURA_COMPACTA = 768;

/** Decide se a interface fica compacta, dado o modo escolhido e a largura da janela. */
export function decidirCompacto(modo, largura) {
  if (modo === "sim") return true;
  if (modo === "nao") return false;
  return largura < LARGURA_COMPACTA;
}

export function useCompacto() {
  const [modo, setModo] = useState(() => store.get("modoCompacto", "auto"));
  const [largura, setLargura] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  useEffect(() => {
    const aoRedimensionar = () => setLargura(window.innerWidth);
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);
  useEffect(() => { store.set("modoCompacto", modo); }, [modo]);
  const compacto = decidirCompacto(modo, largura);
  useEffect(() => { document.documentElement.dataset.compacto = compacto ? "sim" : "nao"; }, [compacto]);
  useTeclado(compacto);
  return { compacto, modo, setModo };
}

/** Teclado virtual: o WebView do Android encolhe só a viewport visual. Ajusta a altura da raiz a ela
 *  (`--vv-altura`), marca `data-teclado` (esconde a barra inferior e o botão flutuante) e traz o campo
 *  focado para a área visível. */
function useTeclado(compacto) {
  useEffect(() => {
    const raiz = document.documentElement;
    const vv = window.visualViewport;
    if (!compacto || !vv) { raiz.style.removeProperty("--vv-altura"); delete raiz.dataset.teclado; return undefined; }
    const ajustar = () => {
      const aberto = window.innerHeight - vv.height > 120;
      if (aberto) raiz.style.setProperty("--vv-altura", `${vv.height}px`); else raiz.style.removeProperty("--vv-altura");
      raiz.dataset.teclado = aberto ? "sim" : "nao";
    };
    const aoFocar = (e) => {
      const alvo = e.target;
      if (alvo?.matches?.("input, textarea, [contenteditable='true'], .cm-content")) setTimeout(() => alvo.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    };
    vv.addEventListener("resize", ajustar);
    document.addEventListener("focusin", aoFocar);
    ajustar();
    return () => { vv.removeEventListener("resize", ajustar); document.removeEventListener("focusin", aoFocar); raiz.style.removeProperty("--vv-altura"); delete raiz.dataset.teclado; };
  }, [compacto]);
}

/** App.jsx provê o valor; as telas leem com `useEhCompacto()` em vez de receber a propriedade. */
export const CompactoContext = createContext(false);
export const useEhCompacto = () => useContext(CompactoContext);
