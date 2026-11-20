// Modo bandeja (Windows): com a opção ligada e o ícone criado, fechar a janela só a esconde (ver src-tauri/src/bandeja.rs).
// `bandejaPronta()` só vale depois que o Rust confirmou o ícone: sem ele, esconder a janela deixaria o app sem caminho de volta.
import { useEffect, useState } from "react";
import { invoke, isTauri } from "@/lib/api";

let pronta = false;
export const bandejaPronta = () => pronta;

/** Só o Windows tem o modo (no Linux a bandeja nem sempre aparece; no celular não existe). */
export const temBandeja = () => isTauri && typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);

/** Liga/desliga o ícone conforme `ligada`; devolve o texto do erro (vazio se tudo certo). */
export function useBandeja(ligada) {
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!temBandeja()) return;
    pronta = false;
    invoke("definir_bandeja", { ligada }).then(() => { pronta = ligada; setErro(""); }).catch((e) => setErro(String(e)));
  }, [ligada]);
  return erro;
}
