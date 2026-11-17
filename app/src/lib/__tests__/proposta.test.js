import { describe, expect, it } from "vitest";
import { indicesDeMudanca, textoFinal, trechos } from "../proposta";

const base = "# T\n\num\ndois\n\ntres\nquatro\n\nfim";
const novo = "# T\n\nUM\ndois\n\ntres\nQUATRO\n\nfim";

describe("proposta: texto final por trecho", () => {
  it("separa as mudanças contínuas em trechos", () => {
    const segs = trechos(base, novo);
    const m = indicesDeMudanca(segs);
    expect(m).toHaveLength(2);
    expect(segs[m[0]]).toMatchObject({ removidas: ["um"], adicionadas: ["UM"] });
    expect(segs[m[1]]).toMatchObject({ removidas: ["quatro"], adicionadas: ["QUATRO"] });
  });
  it("aceitar tudo dá o texto proposto; nenhum, o texto base", () => {
    const segs = trechos(base, novo);
    expect(textoFinal(segs, new Set(indicesDeMudanca(segs)))).toBe(novo);
    expect(textoFinal(segs, new Set())).toBe(base);
  });
  it("aceitar só um trecho mistura os dois textos", () => {
    const segs = trechos(base, novo), [a, b] = indicesDeMudanca(segs);
    expect(textoFinal(segs, new Set([b]))).toBe("# T\n\num\ndois\n\ntres\nQUATRO\n\nfim");
    expect(textoFinal(segs, new Set([a]))).toBe("# T\n\nUM\ndois\n\ntres\nquatro\n\nfim");
  });
  it("lida com inserção, remoção e texto vazio", () => {
    for (const [x, y] of [["a\nb", "a\nx\nb"], ["a\nb\nc", "a\nc"], ["", "novo\ntexto"], ["a", ""]]) {
      const segs = trechos(x, y);
      expect(textoFinal(segs, new Set(indicesDeMudanca(segs)))).toBe(y);
      expect(textoFinal(segs, new Set())).toBe(x);
    }
  });
});
