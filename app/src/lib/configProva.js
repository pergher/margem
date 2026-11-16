// Configuração das provas (cabeçalho, logo, colunas, linhas por folha), guardada numa nota do vault:
// `_sistema/Configuração das provas.md` (`tipo: configuracao`); a logo é um arquivo em `_sistema/anexos/`.
// Se a nota ainda não existe, vale o que estava guardado no navegador (versão antiga); gravar cria a nota.
import { raizDe, raizBarra } from "@/lib/raiz";
import { invoke } from "@/lib/api";
import { parseFm, setProp } from "@/lib/frontmatter";

const K = "vault.configProva"; // legado (localStorage)
const K_LINHAS = "provaLinhas"; // legado
export const NOME = "Configuração das provas";
export const PADRAO = { escola: "", linha2: "", logo: "", logoArquivo: "", logoNova: false, duasColunas: false, limiteLinhas: 0 };

const raiz = (items) => raizDe(items);
const caminho = (items) => `${raiz(items)}/_sistema/${NOME}.md`;

function legado() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(K) ?? "{}"); } catch { /* sem legado */ }
  let limiteLinhas = 0;
  try { limiteLinhas = Number(localStorage.getItem(K_LINHAS)) || 0; } catch { /* sem legado */ }
  return { ...PADRAO, escola: c.escola ?? "", linha2: c.linha2 ?? "", duasColunas: !!c.duasColunas, limiteLinhas, logo: c.logo ?? "", logoNova: !!c.logo };
}

export async function lerConfigProva(items) {
  let texto;
  try { texto = await invoke("read_note", { path: caminho(items) }); } catch { return legado(); }
  const fm = parseFm(texto);
  const get = (k) => fm.entries.find((e) => e.key === k)?.value ?? "";
  const logoArquivo = get("logo");
  let logo = "";
  if (logoArquivo) { try { const r = await invoke("read_embed", { target: logoArquivo, inline: true }); if (r?.kind === "image") logo = r.data; } catch { /* logo sumiu: segue sem */ } }
  return { escola: get("escola"), linha2: get("linha2"), logo, logoArquivo, logoNova: false, duasColunas: get("duas_colunas") === "true", limiteLinhas: Number(get("limite_linhas")) || 0 };
}

const bytesDe = (dataUrl) => Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));

/** Grava a nota (criando-a se preciso) e, se a logo é nova, o arquivo da imagem. Devolve a configuração já gravada e se a nota foi criada agora. */
export async function gravarConfigProva(items, c) {
  const dirSis = `${raiz(items)}/_sistema`, path = caminho(items);
  let texto = null, criada = false;
  try { texto = await invoke("read_note", { path }); } catch {
    try { await invoke("create_folder", { dir: raiz(items), name: "_sistema" }); } catch { /* já existe */ }
    await invoke("create_note", { dir: dirSis, name: NOME });
    texto = `---\ntipo: configuracao\n---\n# ${NOME}\n\nEscola, logo e layout das provas. Edite em Configurações → Cabeçalho das provas.\n`;
    criada = true;
  }
  let logoArquivo = c.logoArquivo;
  if (!c.logo) logoArquivo = "";
  else if (c.logoNova) {
    const ext = /^data:image\/png/.test(c.logo) ? "png" : "jpg";
    try { await invoke("create_folder", { dir: dirSis, name: "anexos" }); } catch { /* já existe */ }
    logoArquivo = `logo-escola.${ext}`;
    await invoke("save_attachment", { dir: `${dirSis}/anexos`, name: logoArquivo, data: Array.from(bytesDe(c.logo)) });
  }
  let t = texto;
  const campo = (k, v) => { t = setProp(t, k, v); };
  campo("escola", c.escola); campo("linha2", c.linha2 || undefined); campo("logo", logoArquivo || undefined);
  campo("duas_colunas", c.duasColunas ? "true" : "false"); campo("limite_linhas", c.limiteLinhas ? String(c.limiteLinhas) : undefined);
  if (!parseFm(t).entries.some((e) => e.key === "tipo")) t = setProp(t, "tipo", "configuracao");
  await invoke("save_note", { path, text: t });
  return { criada, config: { ...c, logoArquivo, logoNova: false } };
}

/** Lê um arquivo de imagem escolhido no disco e devolve um data URL (limite de 600 KB). */
export function lerLogo(file) {
  return new Promise((ok, erro) => {
    if (!/^image\/(png|jpe?g)$/.test(file.type)) return erro(new Error("Use uma imagem PNG ou JPG."));
    if (file.size > 600 * 1024) return erro(new Error("Imagem grande demais (máximo 600 KB)."));
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => erro(new Error("Não consegui ler a imagem."));
    r.readAsDataURL(file);
  });
}
