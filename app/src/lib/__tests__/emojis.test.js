// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { CompletionContext } from "@codemirror/autocomplete";
import { buscarEmojis, fonteDeEmoji } from "../emojis";

function abrir(texto) {
  const pos = texto.indexOf("|"), doc = texto.replace("|", "");
  const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor: pos }, extensions: [markdown()] }), parent: document.body });
  return { view, r: fonteDeEmoji(new CompletionContext(view.state, pos, true)) };
}

describe("buscarEmojis", () => {
  it("acha por nome em português, sem acento, e em inglês", () => {
    expect(buscarEmojis("coracao")[0].emoji).toBe("❤️");
    expect(buscarEmojis("CORAÇÃO").length).toBeGreaterThan(3);
    expect(buscarEmojis("thumbsup")[0].emoji).toBe("👍");
    expect(buscarEmojis("professor")[0].emoji).toMatch(/🧑‍🏫|👨‍🏫/u);
  });
  it("exige 2 letras e devolve vazio sem resultado", () => {
    expect(buscarEmojis("c")).toEqual([]);
    expect(buscarEmojis("zzzzqq")).toEqual([]);
  });
});

describe("fonteDeEmoji", () => {
  it("abre com `:` + 2 letras no começo da linha ou depois de espaço", () => {
    expect(abrir(":co|").r).not.toBeNull();
    expect(abrir("oi :sor|").r).not.toBeNull();
    expect(abrir("oi (:sor|").r).not.toBeNull();
  });
  it("não pega horário, endereço nem `chave:valor`", () => {
    expect(abrir("às 10:30|").r).toBeNull();
    expect(abrir("https://exemplo.org|").r).toBeNull();
    expect(abrir("foco:pendente|").r).toBeNull();
    expect(abrir("oi :s|").r).toBeNull();
  });
  it("não abre dentro de código", () => {
    expect(abrir("`um :sor|`").r).toBeNull();
    expect(abrir("```\n:sor|\n```").r).toBeNull();
  });
  it("escolher insere o emoji no lugar do `:texto`", () => {
    const { view, r } = abrir("oi :coracao| fim");
    r.options[0].apply(view, r.options[0], r.from, 11);
    expect(view.state.doc.toString()).toBe("oi ❤️ fim");
  });
});
