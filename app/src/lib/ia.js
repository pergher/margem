// Painel de IA (Etapa M): envoltório dos comandos `ia_*` do Rust. A chave nunca passa por aqui: só entra (guardar) e nunca sai.
// Fora do Tauri (navegador) tudo responde "disponível só no app".
import { invoke, isTauri } from "@/lib/api";

export const iaDisponivel = isTauri;
const novoId = () => (globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random()));
export { novoId };

/** Envia a pergunta e chama `onEvento` para cada evento do stream ({ tipo: texto | ferramenta | proposta | uso | aviso | erro | fim, ... }). */
export async function iaEnviar(conversaId, texto, contexto, onEvento) {
  if (!isTauri) throw "A IA está disponível só no app.";
  const { Channel } = await import("@tauri-apps/api/core");
  const canal = new Channel();
  canal.onmessage = onEvento;
  return invoke("ia_enviar", { conversaId, texto, contexto, canal });
}
export const iaCancelar = (conversaId) => invoke("ia_cancelar", { conversaId });
export const iaLimpar = (conversaId) => invoke("ia_limpar", { conversaId });
export const iaConfigLer = () => invoke("ia_config_ler");
export const iaConfigGravar = (config) => invoke("ia_config_gravar", { config });
export const iaTemChave = (provedor) => invoke("ia_tem_chave", { provedor });
export const iaGuardarChave = (provedor, chave) => invoke("ia_guardar_chave", { provedor, chave });
export const iaApagarChave = (provedor) => invoke("ia_apagar_chave", { provedor });
export const iaTestar = () => invoke("ia_testar");
export const iaPrevia = (contexto) => invoke("ia_previa_contexto", { contexto });

/**
 * Aplica um evento do stream à lista de mensagens (a última é a resposta da IA em andamento). Puro, para testar.
 * Itens da resposta: texto, ferramenta, proposta, aviso, erro.
 */
export function aplicarEvento(msgs, ev) {
  if (ev.tipo === "uso" || ev.tipo === "fim") return msgs;
  const i = msgs.length - 1;
  if (i < 0 || msgs[i].papel !== "ia") return msgs;
  const itens = [...msgs[i].itens];
  const ult = itens[itens.length - 1];
  if (ev.tipo === "texto") {
    if (ult?.tipo === "texto") itens[itens.length - 1] = { ...ult, texto: ult.texto + ev.texto };
    else itens.push({ tipo: "texto", texto: ev.texto });
  } else if (ev.tipo === "ferramenta") itens.push({ tipo: "ferramenta", resumo: ev.resumo });
  else if (ev.tipo === "proposta") itens.push({ tipo: "proposta", id: ev.id, resumo: ev.resumo, nota: ev.nota, nova: ev.nova });
  else if (ev.tipo === "aviso") itens.push({ tipo: "aviso", msg: ev.msg });
  else if (ev.tipo === "erro") itens.push({ tipo: "erro", msg: ev.msg });
  else return msgs;
  return [...msgs.slice(0, i), { ...msgs[i], itens }];
}
