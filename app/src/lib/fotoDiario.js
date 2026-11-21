// Foto da página do caderno: reduz no próprio app e guarda em Anos/AAAA/Diarios/<turma>/Fotos/.
// O diário aponta para ela pelo nome (`foto: nome.jpg`); os embeds resolvem por nome em todo o vault, então o nome é único por turma e semana.
import { invoke } from "@/lib/api";
import { raizDe } from "@/lib/raiz";

const LADO_MAX = 2000;      // pixels no maior lado: letra à mão ainda legível, arquivo leve para sincronizar
const QUALIDADE = 0.82;
const LIMITE = 2_000_000;   // o `save_attachment` recusa mais que isso

/** Nome do arquivo da foto de um diário; só letras, números, espaço e hífen. */
export const nomeDaFoto = (turma, semana) =>
  `Foto diario ${turma} - ${String(semana).replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim()}.jpg`;

/** Lê o arquivo como imagem e devolve JPEG reduzido (Uint8Array). Recusa o que o navegador não abre (por exemplo HEIC). */
export async function reduzirFoto(arquivo) {
  if (!arquivo || !/^image\//.test(arquivo.type ?? "")) throw new Error("Escolha uma imagem (JPG ou PNG).");
  let bmp;
  try { bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" }); }
  catch { throw new Error("Não consegui abrir esta imagem. Se for HEIC (iPhone), exporte como JPG."); }
  const k = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); // PNG com transparência vira fundo branco
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  for (const q of [QUALIDADE, 0.7, 0.55]) {
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= LIMITE) return new Uint8Array(await blob.arrayBuffer());
  }
  throw new Error("A imagem ficou grande demais mesmo reduzida.");
}

/** Reduz e grava a foto; devolve o nome do arquivo para o `foto:` do diário. */
export async function guardarFotoDiario(items, { ano, turma, semana, arquivo }) {
  const bytes = await reduzirFoto(arquivo), nome = nomeDaFoto(turma, semana);
  const base = `${raizDe(items)}/Anos/${ano}/Diarios/${turma}`;
  await invoke("save_attachment", { dir: `${base}/Fotos`, name: nome, data: Array.from(bytes) });
  return nome;
}
