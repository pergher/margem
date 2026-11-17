// @vitest-environment jsdom
// livePreview.js com um EditorState/EditorView reais do CodeMirror: dado um texto e a posição do cursor,
// confere o que fica oculto, o que é revelado na linha do cursor e quais classes de decoração existem.
import { describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";

vi.mock("@/lib/api", () => ({ invoke: async () => null, srcDeImagem: (p) => p }));
const { livePreview, frontmatterEnd } = await import("../livePreview");

/** Cria o editor; `foco` simula o editor focado (sem foco o cursor não revela a fonte). */
function editor(doc, cursor = doc.length, foco = true) {
  const parent = document.createElement("div");
  document.body.append(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc, selection: { anchor: cursor }, extensions: [markdown({ extensions: [GFM] }), livePreview] }),
  });
  Object.defineProperty(view, "hasFocus", { get: () => foco });
  view.dispatch({ selection: { anchor: cursor } }); // recalcula as decorações já com o foco simulado
  return view;
}
const texto = (v) => v.contentDOM.textContent;
const tem = (v, sel) => v.contentDOM.querySelector(sel);

describe("frontmatterEnd", () => {
  it("acha o fim do frontmatter ou devolve 0", () => {
    const d = EditorState.create({ doc: "---\ntipo: aula\n---\n# T" }).doc;
    expect(frontmatterEnd(d)).toBe(d.line(3).to);
    expect(frontmatterEnd(EditorState.create({ doc: "# T\n---\n" }).doc)).toBe(0);
    expect(frontmatterEnd(EditorState.create({ doc: "---\nsem fim" }).doc)).toBe(0);
  });
});

/** Texto de uma linha (1-based) como o usuário a vê: marcadores ocultos não aparecem. */
const linha = (v, n) => v.contentDOM.querySelectorAll(".cm-line")[n - 1]?.textContent;
const fim = (doc, trecho) => doc.indexOf(trecho) + trecho.length;

describe("títulos", () => {
  const doc = "# Título\n\ntexto";
  it("decora o título e oculta o # fora da linha do cursor", () => {
    const v = editor(doc, doc.length);
    expect(tem(v, ".cm-h.cm-h1")).toBeTruthy();
    expect(linha(v, 1)).toBe("Título");
  });
  it("mostra o # quando o cursor está na linha do título", () => {
    const v = editor(doc, 3);
    expect(linha(v, 1)).toBe("# Título");
  });
  it("sem foco no editor nada é revelado", () => {
    const v = editor(doc, 3, false);
    expect(linha(v, 1)).toBe("Título");
  });
  it("os níveis viram classes diferentes", () => {
    const v = editor("## Dois\n\n### Três\n\nx");
    expect(tem(v, ".cm-h2")).toBeTruthy();
    expect(tem(v, ".cm-h3")).toBeTruthy();
  });
});

describe("ênfase, código e riscado", () => {
  const doc = "um **negrito** e *itálico* e `cod` e ~~x~~";
  it("oculta todos os marcadores com o cursor longe", () => {
    const v = editor(doc + "\n\nfora", doc.length + 4);
    expect(linha(v, 1)).toBe("um negrito e itálico e cod e x");
    for (const c of [".cm-strong", ".cm-em", ".cm-icode", ".cm-strike"]) expect(tem(v, c)).toBeTruthy();
  });
  it("revela só o trecho em que o cursor está", () => {
    const v = editor(doc, fim(doc, "negrito"));
    expect(linha(v, 1)).toBe("um **negrito** e itálico e cod e x");
  });
});

describe("callout", () => {
  const doc = "> [!tip] Dica\n> com **negrito** e *itálico*\n\nfim";
  it("vira callout com título e mantém negrito e itálico dentro", () => {
    const v = editor(doc, doc.length);
    expect(v.contentDOM.querySelectorAll(".cm-callout-tip").length).toBe(2);
    expect(tem(v, ".cm-callout-first")).toBeTruthy();
    expect(tem(v, ".cm-callout-last")).toBeTruthy();
    expect(tem(v, ".cm-callout-title").textContent).toBe("Dica");
    expect(tem(v, ".cm-callout .cm-strong").textContent).toBe("negrito");
    expect(tem(v, ".cm-callout .cm-em").textContent).toBe("itálico");
    expect(linha(v, 2)).toBe("com negrito e itálico"); // o > some
  });
  it("com o cursor na primeira linha mostra a fonte `> [!tip]`", () => {
    const v = editor(doc, 5);
    expect(linha(v, 1)).toBe("> [!tip] Dica");
    expect(tem(v, ".cm-callout-title")).toBeNull();
  });
  it("citação simples (sem [!tipo]) não é callout", () => {
    const v = editor("> só uma citação\n\nfim");
    expect(tem(v, ".cm-quote")).toBeTruthy();
    expect(tem(v, ".cm-callout")).toBeNull();
  });
});

describe("listas, tarefas, regra e tabela", () => {
  it("lista vira bolinha e tarefa vira checkbox (marcada leva .cm-done)", () => {
    const v = editor("- item\n- [x] feito\n- [ ] aberto\n\nfim");
    expect(tem(v, ".cm-bullet").textContent).toBe("•");
    const caixas = [...v.contentDOM.querySelectorAll("input.cm-check")];
    expect(caixas.map((c) => c.checked)).toEqual([true, false]);
    expect(tem(v, ".cm-done").textContent).toBe(" feito");
  });
  it("---  vira linha horizontal, exceto com o cursor nela", () => {
    expect(tem(editor("a\n\n---\n\nb"), "hr.cm-hr")).toBeTruthy();
    expect(tem(editor("a\n\n---\n\nb", 4), "hr.cm-hr")).toBeNull();
  });
  it("tabela vira <table> com cabeçalho e linhas", () => {
    const v = editor("| a | b |\n|---|---|\n| 1 | 2 |\n\nfim");
    const th = [...v.contentDOM.querySelectorAll("th")].map((x) => x.textContent);
    const td = [...v.contentDOM.querySelectorAll("td")].map((x) => x.textContent);
    expect(th).toEqual(["a", "b"]);
    expect(td).toEqual(["1", "2"]);
  });
});

describe("wikilinks e frontmatter", () => {
  it("[[Nota|alias]] mostra o alias e guarda o alvo", () => {
    const v = editor("ver [[Nota|alias]] aqui\n\nfim");
    const a = tem(v, ".cm-wikilink");
    expect(a.textContent).toBe("alias");
    expect(a.dataset.target).toBe("Nota");
    expect(linha(v, 1)).toBe("ver alias aqui");
  });
  it("com o cursor no link a fonte aparece como wikilink cru", () => {
    const doc = "ver [[Nota|alias]] aqui";
    const v = editor(doc, fim(doc, "[[Nota"));
    expect(tem(v, ".cm-wikilink-raw")).toBeTruthy();
    expect(linha(v, 1)).toBe(doc);
  });
  it("o frontmatter vira cartão de propriedades e não é decorado como Markdown", () => {
    const v = editor("---\ntipo: aula\n---\n\n# T\n\nx");
    expect(tem(v, ".cm-props-card .cm-prop-k").textContent).toBe("Tipo:");
    expect(tem(v, ".cm-props-card .cm-prop-v").textContent).toBe("aula");
  });
});
