// Autocompletar do editor: `/` no começo de uma linha (blocos) e `[[` (notas, em lib/wikilinks.js).
// Menu `/`: no começo de uma linha, `/` abre a lista de blocos para inserir (exemplo, sintaxe, callout, mapa, erros da turma).
import { autocompletion, snippet } from "@codemirror/autocomplete";
import { fonteDeWikilinks } from "@/lib/wikilinks";

const bloco = (rotulo, detalhe, modelo) => ({ label: rotulo, detail: detalhe, apply: snippet(modelo) });

const OPCOES = [
  bloco("/exemplo", "errado, certo e porquê", "```exemplo\nerrado: ${}\ncerto: ${}\nporquê: ${}\n```\n"),
  bloco("/exemplo-exercicio", "só o errado, com resposta", "```exemplo exercicio\nerrado: ${}\ncerto: ${}\n```\n"),
  bloco("/sintaxe", "análise com rótulos sob os trechos", "```sintaxe\n[${Os alunos}]{sujeito} [${leram o livro}]{predicado}.\n```\n"),
  bloco("/sintaxe-exercicio", "só a frase, com linha de análise", "```sintaxe exercicio\n${}\n```\n"),
  bloco("/margem", "anotação na coluna Na margem", "> [!margem] ${}\n> ${}\n"),
  bloco("/dica", "caixa de dica", "> [!tip] ${Dica}\n> ${}\n"),
  bloco("/mindmap", "mapa mental (Mermaid)", "```mermaid\nmindmap\n  root((${Tema}))\n    ${Ideia 1}\n    Ideia 2\n```\n"),
  {
    label: "/erros-comuns", detail: "frases dos erros mais comuns de uma turma",
    // Abre o diálogo (montado no App); ele devolve o bloco pronto, depois de o professor conferir as frases.
    apply(view, _c, from, to) {
      view.dispatch({ changes: { from, to, insert: "" } });
      window.dispatchEvent(new CustomEvent("margem:erros-comuns", { detail: { inserir: (texto) => { const h = Math.min(view.state.selection.main.head, view.state.doc.length); view.dispatch({ changes: { from: h, insert: texto + "\n" }, selection: { anchor: h + texto.length + 1 } }); view.focus(); } } }));
    },
  },
];

const fonte = (ctx) => {
  const m = ctx.matchBefore(/\/[\p{L}-]*/u);
  if (!m || (ctx.state.doc.lineAt(m.from).text.slice(0, m.from - ctx.state.doc.lineAt(m.from).from).trim() !== "")) return null;
  return { from: m.from, options: OPCOES, validFor: /^\/[\p{L}-]*$/u };
};

export const menuBarra = autocompletion({ override: [fonte, fonteDeWikilinks], icons: false, defaultKeymap: true });
