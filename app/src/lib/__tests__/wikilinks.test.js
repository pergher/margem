// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { CompletionContext } from "@codemirror/autocomplete";
import { filtrarNotas, fonteDeWikilinks, definirProvedorDeLinks } from "../wikilinks";

const notas = [
  { name: "Crônica", rel: "Acervo/Textos/Crônica.md" },
  { name: "Aula de crônica narrativa", rel: "Acervo/Aulas/Aula de crônica narrativa.md" },
  { name: "Conto", rel: "Acervo/Textos/Conto.md" },
  { name: "Adjetivo", rel: "Acervo/Gramática/Adjetivo.md" },
];

function abrir(texto) {
  const pos = texto.indexOf("|"), doc = texto.replace("|", "");
  const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor: pos } }), parent: document.body });
  const r = fonteDeWikilinks(new CompletionContext(view.state, pos, true));
  return { view, r };
}

describe("filtrarNotas", () => {
  it("ignora acento e maiúscula e ordena: igual, começa, palavra, contém", () => {
    expect(filtrarNotas(notas, "cronica").map((n) => n.name)).toEqual(["Crônica", "Aula de crônica narrativa"]);
    expect(filtrarNotas(notas, "NARR").map((n) => n.name)).toEqual(["Aula de crônica narrativa"]);
    expect(filtrarNotas(notas, "jet").map((n) => n.name)).toEqual(["Adjetivo"]);
  });
  it("sem texto lista tudo", () => expect(filtrarNotas(notas, "")).toHaveLength(4));
  it("sem resultado devolve vazio", () => expect(filtrarNotas(notas, "zzz")).toEqual([]));
});

describe("fonteDeWikilinks", () => {
  it("só abre depois de `[[`", () => {
    definirProvedorDeLinks({ notas: () => notas, criar: null });
    expect(abrir("texto cron|").r).toBeNull();
    expect(abrir("veja [cron|").r).toBeNull();
    expect(abrir("veja [[cron|").r).not.toBeNull();
  });
  it("não abre depois de `|`, `#` ou `]]`", () => {
    definirProvedorDeLinks({ notas: () => notas, criar: null });
    expect(abrir("[[Crônica|").r).not.toBeNull();
    expect(abrir("[[Crônica#tit|").r).toBeNull();
    expect(abrir("[[Crônica]] cron|").r).toBeNull();
  });
  it("insere o nome e fecha com `]]`", () => {
    definirProvedorDeLinks({ notas: () => notas, criar: null });
    const { view, r } = abrir("veja [[cron| fim");
    r.options[0].apply(view, r.options[0], r.from, 11);
    expect(view.state.doc.toString()).toBe("veja [[Crônica]] fim");
    expect(view.state.selection.main.head).toBe("veja [[Crônica]]".length);
  });
  it("não repete `]]` quando já existe depois do cursor", () => {
    definirProvedorDeLinks({ notas: () => notas, criar: null });
    const { view, r } = abrir("[[con|]]");
    r.options[0].apply(view, r.options[0], r.from, 5);
    expect(view.state.doc.toString()).toBe("[[Conto]]");
  });
  it("oferece Criar quando o nome não existe, e cria ao escolher", () => {
    const criar = vi.fn();
    definirProvedorDeLinks({ notas: () => notas, criar });
    const { view, r } = abrir("[[Nova ideia|");
    const op = r.options.at(-1);
    expect(op.label).toBe("Criar «Nova ideia»");
    op.apply(view, op, r.from, 12);
    expect(view.state.doc.toString()).toBe("[[Nova ideia]]");
    expect(criar).toHaveBeenCalledWith("Nova ideia");
  });
  it("não oferece Criar se já existe nota com esse nome (sem acento)", () => {
    definirProvedorDeLinks({ notas: () => notas, criar: vi.fn() });
    const { r } = abrir("[[cronica|");
    expect(r.options.some((o) => o.label.startsWith("Criar"))).toBe(false);
  });
});
