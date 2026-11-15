import { describe, expect, it } from "vitest";
import { parseFm, setProp, formatLine, lineStart } from "../frontmatter";

const NOTA = `---
tipo: aula
ano: 7
turmas: ["71", "72"]
objetivos:
  - ler
  - "escrever: bem"
---
# Corpo
`;

describe("frontmatter", () => {
  it("lê escalares, listas em linha e listas em bloco", () => {
    const fm = parseFm(NOTA);
    const get = (k) => fm.entries.find((e) => e.key === k);
    expect(get("tipo").value).toBe("aula");
    expect(get("turmas").items).toEqual(["71", "72"]);
    expect(get("objetivos").items).toEqual(["ler", "escrever: bem"]);
    expect(get("objetivos").to - get("objetivos").from).toBe(2);
  });

  it("nota sem frontmatter", () => {
    expect(parseFm("# só corpo\n").has).toBe(false);
  });

  it("troca uma propriedade sem mexer no resto", () => {
    const t = setProp(NOTA, "ano", "8");
    expect(t).toBe(NOTA.replace("ano: 7", "ano: 8"));
  });

  it("troca uma lista em bloco por lista em linha", () => {
    const t = setProp(NOTA, "objetivos", ["a", "b"]);
    expect(t).toContain("objetivos: [a, b]");
    expect(t).not.toContain("  - ler");
    expect(t.endsWith("---\n# Corpo\n")).toBe(true);
  });

  it("cria no fim do frontmatter, ou o frontmatter inteiro", () => {
    expect(setProp(NOTA, "status", "pendente")).toContain('"71", "72"]\nobjetivos:');
    expect(setProp(NOTA, "status", "pendente").split("\n")[7]).toBe("status: pendente");
    expect(setProp("# x\n", "tipo", "aula")).toBe("---\ntipo: aula\n---\n# x\n");
  });

  it("remove com undefined; remover o que não existe não altera", () => {
    expect(setProp(NOTA, "ano", undefined)).not.toContain("ano:");
    expect(setProp("# x\n", "ano", undefined)).toBe("# x\n");
  });

  it("põe aspas quando preciso", () => {
    expect(formatLine("t", "a: b")).toBe('t: "a: b"');
    expect(formatLine("t", ["71", "x y", "a,b"])).toBe('t: ["71", x y, "a,b"]');
    expect(formatLine("t", "")).toBe("t:");
  });

  it("lineStart devolve o deslocamento da linha", () => {
    expect(lineStart("a\nbb\nc", 3)).toBe(5);
    expect(lineStart("a\nbb", 9)).toBe(4);
  });
});
