import { invoke } from "@/lib/api";

/**
 * Grava vários arquivos como uma operação só: lê todos os originais antes; se uma gravação falhar, devolve os já gravados
 * ao texto original (melhor esforço) e relança o erro. Quem chama deve ter calculado todos os textos antes (assim erro de
 * cálculo nunca deixa nada pela metade).
 * @param {{path: string, text: string}[]} escritas
 */
export async function gravarVarios(escritas) {
  const originais = [];
  for (const e of escritas) originais.push(await invoke("read_note", { path: e.path }));
  const feitas = [];
  try {
    for (const e of escritas) { await invoke("save_note", { path: e.path, text: e.text }); feitas.push(e.path); }
  } catch (erro) {
    const falhou = [];
    for (const path of feitas.reverse()) {
      try { await invoke("save_note", { path, text: originais[escritas.findIndex((x) => x.path === path)], force: true }); } catch { falhou.push(path); }
    }
    const msg = String(erro?.message ?? erro);
    throw new Error(falhou.length ? `${msg} (não consegui desfazer ${falhou.length} arquivo(s); veja o histórico de versões)` : `${msg} (nada foi alterado)`);
  }
}
