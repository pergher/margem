import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { indentarItem, recuarItem, enterNaLista, lerItem } from "../listas";

// `|` marca o cursor. Devolve o texto (com `|` no cursor) depois do comando.
function rodar(cmd, texto) {
  const pos = texto.indexOf("|");
  let estado = EditorState.create({ doc: texto.replace("|", ""), selection: { anchor: pos }, extensions: [markdown({ extensions: [GFM] })] });
  const alvo = { get state() { return estado; }, dispatch(tr) { estado = tr.state; } };
  const tratou = cmd(alvo);
  const d = estado.doc.toString(), c = estado.selection.main.head;
  return { tratou, texto: d.slice(0, c) + "|" + d.slice(c) };
}

describe("lerItem", () => {
  it("reconhece marcadores, números e tarefas", () => {
    expect(lerItem("- a")).toMatchObject({ indent: 0, larg: 2, ordenado: false });
    expect(lerItem("   12. a")).toMatchObject({ indent: 3, larg: 4, ordenado: true, numero: 12 });
    expect(lerItem("- [ ] a")).not.toBeNull();
    expect(lerItem("texto")).toBeNull();
    expect(lerItem("-sem espaço")).toBeNull();
  });
});

describe("Tab", () => {
  it("indenta o item pela largura do marcador do irmão de cima", () => {
    expect(rodar(indentarItem, "- a\n- b|").texto).toBe("- a\n  - b|");
    expect(rodar(indentarItem, "1. a\n2. b|").texto).toBe("1. a\n   1. b|");
  });
  it("o primeiro item não indenta, mas o Tab é consumido", () => {
    const r = rodar(indentarItem, "- a|\n- b");
    expect(r.tratou).toBe(true);
    expect(r.texto).toBe("- a|\n- b");
  });
  it("não pula dois níveis", () => {
    expect(rodar(indentarItem, "- a\n  - b\n  - c|").texto).toBe("- a\n  - b\n    - c|");
    expect(rodar(indentarItem, "- a\n  - b\n- c|").texto).toBe("- a\n  - b\n  - c|");
  });
  it("renumera: o item que desce vira 1 e os de baixo fecham a fila", () => {
    expect(rodar(indentarItem, "1. a\n2. b\n3. c|\n4. d").texto).toBe("1. a\n2. b\n   1. c|\n3. d");
  });
  it("fora de lista deixa passar", () => {
    expect(rodar(indentarItem, "texto|").tratou).toBe(false);
  });
  it("não mexe no frontmatter", () => {
    expect(rodar(indentarItem, "---\nfoco:\n  - a\n  - b|\n---\n").tratou).toBe(false);
  });
  it("tarefa também indenta", () => {
    expect(rodar(indentarItem, "- [ ] a\n- [ ] b|").texto).toBe("- [ ] a\n  - [ ] b|");
  });
});

describe("Shift+Tab", () => {
  it("volta ao recuo do pai e renumera", () => {
    expect(rodar(recuarItem, "1. a\n   1. b|\n   2. c").texto).toBe("1. a\n2. b|\n   1. c");
  });
  it("no nível 0 não faz nada", () => {
    expect(rodar(recuarItem, "- a|").texto).toBe("- a|");
  });
  it("de dois níveis, sobe um", () => {
    expect(rodar(recuarItem, "- a\n  - b\n    - c|").texto).toBe("- a\n  - b\n  - c|");
  });
});

describe("Enter", () => {
  it("continua a lista e renumera os seguintes", () => {
    expect(rodar(enterNaLista, "1. a|\n2. b").texto).toBe("1. a\n2. |\n3. b");
  });
  it("lista de marcadores continua sem mexer em números", () => {
    expect(rodar(enterNaLista, "- a|").texto).toBe("- a\n- |");
  });
  it("fora de lista deixa o Enter normal", () => {
    expect(rodar(enterNaLista, "texto|").tratou).toBe(false);
  });
});
