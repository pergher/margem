// Markdown das respostas da IA → HTML. Reaproveita o conversor da visão de aula (sem HTML cru, links `javascript:` neutros) e
// endurece para texto que vem de fora: imagens viram o texto alternativo (uma imagem remota poderia vazar dados num pedido de
// rede) e links viram texto sublinhado (um clique não pode levar o app para fora da página).
import { html } from "@/lib/aulaHtml";

export function htmlIA(md) {
  return html(md ?? "")
    .replace(/<img\b[^>]*?\balt="([^"]*)"[^>]*>/gi, "$1")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<a\b[^>]*>/gi, '<span class="ia-link">').replace(/<\/a>/gi, "</span>");
}
