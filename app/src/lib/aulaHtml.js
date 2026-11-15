// Markdown da visão de aula → HTML (marked): callouts, blocos didáticos, sem HTML cru nem links perigosos.
import { marked } from "marked";
import { htmlBloco, cabecalhoCerca } from "@/lib/blocos";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const LABEL = { tip: "Dica", professor: "Dica para o professor", note: "Nota", abstract: "Resumo", info: "Informação", warning: "Atenção", attention: "Atenção", example: "Exemplo", question: "Pergunta", important: "Importante" };
// Links `javascript:`/`vbscript:`/`data:` do arquivo viram "#": um clique não pode executar código.
const perigoso = (u) => /^[\s\u0000-\u001f]*(javascript|vbscript|data):/i.test(u ?? "");
marked.use({
  walkTokens(t) { if ((t.type === "link" || t.type === "image") && perigoso(t.href)) t.href = "#"; },
  gfm: true,
  renderer: {
    html: ({ text }) => esc(text), // sem HTML cru vindo do arquivo
    code({ text, lang }) { // blocos didáticos (exemplo, sintaxe); outros idiomas seguem como código
      const c = cabecalhoCerca("```" + (lang ?? ""));
      return (c && htmlBloco(c.lang, c.opcoes, text)) || false;
    },
    blockquote(token) {
      const inner = this.parser.parse(token.tokens), m = /^<p>\[!([\w-]+)\][+-]?\s*/.exec(inner);
      return m ? `<div class="aula-callout aula-callout-${m[1].toLowerCase()}"><div class="aula-callout-t">${LABEL[m[1].toLowerCase()] ?? m[1]}</div>${inner.replace(m[0], "<p>")}</div>` : `<blockquote>${inner}</blockquote>`;
    },
  },
});
export const html = (md) => marked.parse(md.replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/!?\[\[([^\]]+)\]\]/g, "$1"));

