import { describe, it, expect } from "vitest";
import { parseAula } from "@/lib/aula";

describe("parseAula: margem por seção", () => {
  const txt = "---\ntipo: aula\n---\n# T\n\n## Objetivos\n\n- a\n\n> [!margem] nota 1\n> mais\n\n## Conteúdo\n\ntexto\n\n> [!margem] nota 2\n";
  it("liga cada anotação à seção em que está e a tira do corpo", () => {
    const a = parseAula(txt);
    expect(a.secoes[0].notas).toEqual(["nota 1\nmais"]);
    expect(a.secoes[1].notas).toEqual(["nota 2"]);
    expect(a.secoes[0].md).not.toMatch(/margem/);
    expect(a.notas).toHaveLength(2);
  });
});
