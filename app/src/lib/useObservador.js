// Observador de arquivos (lado da interface): o Rust avisa com `vault-mudou` quando algo muda no vault por fora do Margem.
// Atualiza a árvore e, se a nota aberta mudou, recarrega (sem edições pendentes) ou mostra uma faixa (com edições pendentes).
// No navegador (sem Tauri) não faz nada.
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@/lib/api";

const REFRESH_MS = 250;

/** `aviso`: null | { tipo: "alterada" | "removida" }. */
export function useObservador({ cur, dirty, refresh, aplicarDoDisco, manterMinha, vaultRoot }) {
  const [aviso, setAviso] = useState(null);
  const tela = useRef({});
  tela.current = { refresh, aplicarDoDisco };
  const timerRefresh = useRef(null);

  // A nota aberta mudou no disco: sem edições pendentes recarrega; com edições, só avisa (o texto do usuário não é tocado).
  const naNotaAberta = useCallback(async (tipo) => {
    const path = cur.current;
    if (!path) return;
    if (tipo === "removida") { setAviso({ tipo: "removida" }); return; }
    if (dirty.current) { setAviso({ tipo: "alterada" }); return; }
    try {
      const texto = await invoke("read_note", { path });
      if (path !== cur.current) return;                       // trocou de nota durante a leitura
      if (dirty.current) { setAviso({ tipo: "alterada" }); return; } // começou a digitar durante a leitura
      tela.current.aplicarDoDisco(texto); setAviso(null);
    } catch { setAviso({ tipo: "removida" }); }
  }, [cur, dirty]);

  useEffect(() => {
    if (!isTauri || !vaultRoot) return;
    let desfazer = null, vivo = true;
    import("@tauri-apps/api/event").then(({ listen }) => listen("vault-mudou", (e) => {
      const lote = e.payload ?? [];
      clearTimeout(timerRefresh.current);
      timerRefresh.current = setTimeout(() => tela.current.refresh?.(), REFRESH_MS);
      const minha = lote.find((m) => m.path === cur.current);
      if (minha) naNotaAberta(minha.tipo);
    })).then((f) => { if (vivo) desfazer = f; else f?.(); });
    return () => { vivo = false; desfazer?.(); clearTimeout(timerRefresh.current); };
  }, [vaultRoot, naNotaAberta, cur]);

  // Reserva (o watcher pode falhar em pasta sincronizada): ao ganhar o foco, confere a nota aberta.
  useEffect(() => {
    if (!isTauri || !vaultRoot) return;
    const aoFocar = async () => {
      const path = cur.current;
      if (!path) return;
      try { const r = await invoke("verificar_nota", { path }); if (path === cur.current && r !== "igual") naNotaAberta(r); } catch { /* fora do vault ou ilegível */ }
    };
    window.addEventListener("focus", aoFocar);
    return () => window.removeEventListener("focus", aoFocar);
  }, [vaultRoot, naNotaAberta, cur]);

  const carregarDoDisco = useCallback(async () => {
    const path = cur.current;
    if (!path) return;
    try { const t = await invoke("read_note", { path }); if (path === cur.current) { tela.current.aplicarDoDisco(t); setAviso(null); } }
    catch { setAviso({ tipo: "removida" }); }
  }, [cur]);
  const manter = useCallback(() => { manterMinha(); setAviso(null); }, [manterMinha]);
  const dispensar = useCallback(() => setAviso(null), []);

  return { aviso, setAviso, carregarDoDisco, manter, dispensar };
}
