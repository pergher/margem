// Propostas de alteração pendentes (Etapa L): lista (evento `proposta-nova`), aplicar, recusar e desfazer.
// Nota aberta: o texto entra pelo editor (`replaceDoc`: desfazer, autosave e histórico já funcionam). Nota fechada ou nova: pelo Rust.
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@/lib/api";

export function usePropostas({ ed, cur, refresh, setStatus, vaultRoot }) {
  const [lista, setLista] = useState([]);
  const [desfazer, setDesfazer] = useState(null); // { texto, fn } — o aviso "Aplicado · Desfazer"
  const tela = useRef({});
  tela.current = { refresh, setStatus };

  const recarregar = useCallback(() => invoke("listar_propostas").then(setLista).catch(() => {}), []);
  useEffect(() => {
    if (!vaultRoot) return;
    recarregar();
    if (!isTauri) return;
    let off = null, vivo = true;
    import("@tauri-apps/api/event").then(({ listen }) => listen("proposta-nova", recarregar)).then((f) => { if (vivo) off = f; else f?.(); });
    return () => { vivo = false; off?.(); };
  }, [vaultRoot, recarregar]);

  const aviso = (texto, fn) => setDesfazer({ texto, fn });

  const aplicar = useCallback(async (p, texto) => {
    if (p.nota && p.nota === cur.current) {
      if (ed.current.getText() !== p.texto_base) throw new Error("A nota mudou desde a proposta. Descarte esta proposta e peça de novo.");
      ed.current.replaceDoc(texto);
      await invoke("descartar_proposta", { id: p.id });
      aviso("Aplicado", async () => { ed.current.replaceDoc(p.texto_base); });
    } else {
      const r = await invoke("aplicar_proposta", { id: p.id, textoFinal: texto });
      if (r.nova) aviso("Nota criada", async () => { await invoke("delete_entry", { path: r.path }); await tela.current.refresh(); });
      else if (r.versao) aviso("Aplicado", async () => { await invoke("restore_version", { path: r.path, id: r.versao }); await tela.current.refresh(); });
      await tela.current.refresh();
    }
    await recarregar();
  }, [ed, cur, recarregar]);

  const recusar = useCallback(async (p) => { await invoke("descartar_proposta", { id: p.id }); await recarregar(); }, [recarregar]);

  const desfazerAgora = useCallback(async () => {
    const d = desfazer; setDesfazer(null);
    try { await d?.fn(); tela.current.setStatus("Desfeito"); } catch (e) { tela.current.setStatus("Erro ao desfazer: " + e); }
  }, [desfazer]);

  return { lista, aplicar, recusar, recarregar, desfazer, desfazerAgora, dispensarDesfazer: () => setDesfazer(null) };
}
