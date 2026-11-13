// Atualização automática (só no app): plugin updater do Tauri. No navegador não faz nada.
import { isTauri, invoke } from "@/lib/api";

let pendente = null;
let antes = null;

/** O App registra aqui o que fazer antes de instalar (salvar a nota e guardar onde o usuário estava). */
export function antesDeAtualizar(fn) { antes = fn; }

/** Procura uma versão nova. Devolve `{ version, notes }` ou `null`. */
export async function procurarAtualizacao() {
  if (!isTauri) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  const u = await check();
  pendente = u;
  return u ? { version: u.version, notes: u.body || "" } : null;
}

/** Baixa e instala a versão achada por `procurarAtualizacao`; `onProgresso(0..1)`; reinicia o app no fim.
 *  No Windows o instalador encerra o app durante `downloadAndInstall` (o `relaunch` abaixo só roda nos outros sistemas);
 *  por isso o estado é guardado ANTES e restaurado na abertura seguinte. */
export async function instalarAtualizacao(onProgresso) {
  if (!pendente) throw new Error("Procure a atualização antes.");
  let total = 0, baixado = 0;
  try { await antes?.(); } catch (e) { throw new Error("Não consegui salvar antes de atualizar: " + e); }
  await pendente.download((e) => {
    if (e.event === "Started") total = e.data.contentLength || 0;
    if (e.event === "Progress") { baixado += e.data.chunkLength; if (total) onProgresso?.(baixado / total); }
  });
  // Baixou: avisa o vigia que reabre o app depois do instalador (só faz algo no Windows) e instala.
  try { await invoke("agendar_reabertura"); } catch { /* sem vigia: o usuário abre pelo menu Iniciar */ }
  await pendente.install();
  onProgresso?.(1); // o Windows encerra o app logo depois; a tela já mostra o aviso de fechamento
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

export async function versaoDoApp() {
  if (!isTauri) return "navegador";
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}
