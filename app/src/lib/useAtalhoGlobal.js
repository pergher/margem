// Atalho global da captura rápida (só no app do computador): registra a combinação no sistema (comando `definir_atalho_global`,
// ver src-tauri/src/atalho_global.rs) e abre a captura quando o Rust avisa (`margem://captura`), mesmo com o app em segundo plano.
import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@/lib/api";
import { hasModifier } from "@/lib/shortcuts";

/** Combinação do app ("Ctrl+Alt+M") → a que vale como atalho global, ou `null` (sem Ctrl/Alt, uma tecla solta tomaria a digitação de tudo). */
export const combinacaoGlobal = (combo) => (combo && hasModifier(combo) ? combo : null);

/** Devolve o texto do erro do sistema (vazio se está tudo certo): combinação já usada por outro programa, Wayland etc. */
export function useAtalhoGlobal({ combo, ligado, aoDisparar }) {
  const [erro, setErro] = useState("");
  const cb = useRef(aoDisparar);
  cb.current = aoDisparar;

  useEffect(() => {
    if (!isTauri) return;
    let vivo = true, desligar = null;
    import("@tauri-apps/api/event").then(({ listen }) => listen("margem://captura", () => cb.current())).then((f) => { if (vivo) desligar = f; else f(); }).catch(() => {});
    return () => { vivo = false; desligar?.(); };
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    invoke("definir_atalho_global", { atalho: ligado ? combinacaoGlobal(combo) : null }).then(() => setErro("")).catch((e) => setErro(String(e)));
  }, [combo, ligado]);

  return erro;
}
