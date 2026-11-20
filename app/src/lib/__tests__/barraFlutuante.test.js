import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { alternarEnvolver, alternarLinhas, inserirLink, BOTOES } from "../barraFlutuante";

// View mínima: os comandos só usam `state`, `dispatch` e `focus` (sem DOM).
function criarView(doc, anchor, head) {
  const v = { state: EditorState.create({ doc, selection: { anchor, head } }), dispatch(tr) { v.state = tr.state ?? v.state.update(tr).state; }, focus() {} };
  return v;
}
// `[` e `]` marcam a seleção no texto de entrada e de saída.
function rodar(cmd, texto) {
  const a = texto.indexOf("["), b = texto.indexOf("]") - 1;
  const doc = texto.replace("[", "").replace("]", "");
  const view = criarView(doc, a, b);
  cmd(view);
  const d = view.state.doc.toString(), s = view.state.selection.main;
  return d.slice(0, s.from) + "[" + d.slice(s.from, s.to) + "]" + d.slice(s.to);
}
const run = (id) => BOTOES.find((b) => b.id === id).run;

describe("negrito e itálico", () => {
  it("envolve e desenvolve a seleção", () => {
    expect(rodar(run("negrito"), "uma [palavra] só")).toBe("uma **[palavra]** só");
    expect(rodar(run("negrito"), "uma **[palavra]** só")).toBe("uma [palavra] só");
    expect(rodar(run("negrito"), "uma [**palavra**] só")).toBe("uma [palavra] só");
  });
  it("itálico não confunde com negrito", () => {
    expect(rodar(run("italico"), "uma [palavra] só")).toBe("uma *[palavra]* só");
    expect(rodar(run("italico"), "uma *[palavra]* só")).toBe("uma [palavra] só");
    expect(rodar(run("italico"), "uma **[palavra]** só")).toBe("uma ***[palavra]*** só");
  });
  it("destaque usa <mark> e código usa crase", () => {
    expect(rodar(run("destaque"), "x [y] z")).toBe("x <mark>[y]</mark> z");
    expect(rodar(run("destaque"), "x <mark>[y]</mark> z")).toBe("x [y] z");
    expect(rodar(run("codigo"), "x [y] z")).toBe("x `[y]` z");
  });
  it("sem seleção não faz nada", () => {
    expect(rodar(run("negrito"), "x [] y")).toBe("x [] y");
  });
});

describe("link", () => {
  it("texto comum vira [texto](endereço) com o endereço selecionado", () => {
    expect(rodar(inserirLink, "veja [a aula] hoje")).toBe("veja [a aula](" + "[endereço]" + ") hoje");
  });
  it("endereço colado vira o destino e o cursor vai ao texto", () => {
    const view = criarView("veja https://a.org hoje", 5, 18);
    inserirLink(view);
    expect(view.state.doc.toString()).toBe("veja [](https://a.org) hoje");
    expect(view.state.selection.main.head).toBe(6);
  });
});

describe("prefixos de linha", () => {
  it("título: põe, troca o nível e tira", () => {
    const r = (c, t) => { const v = criarView(t, 0, t.length); c(v); return v.state.doc.toString(); };
    expect(r(run("h2"), "Aula")).toBe("## Aula");
    expect(r(run("h2"), "## Aula")).toBe("Aula");
    expect(r(run("h3"), "## Aula")).toBe("### Aula");
    expect(r(run("h2"), "### Aula")).toBe("## Aula");
  });
  it("várias linhas: lista e citação, ignorando linhas em branco", () => {
    const r = (c, t) => { const v = criarView(t, 0, t.length); c(v); return v.state.doc.toString(); };
    expect(r(run("lista"), "a\n\nb")).toBe("- a\n\n- b");
    expect(r(run("lista"), "- a\n- b")).toBe("a\nb");
    expect(r(run("lista"), "1. a\nb")).toBe("- a\n- b");
    expect(r(run("citacao"), "a\nb")).toBe("> a\n> b");
    expect(r(run("citacao"), "> a\n> b")).toBe("a\nb");
  });
  it("só linhas em branco: não age", () => {
    const v = criarView("\n\n", 0, 2);
    expect(alternarLinhas(v, { tira: /^> ?/, poe: "> " })).toBe(false);
  });
});
