import { describe, it, expect } from "vitest";
import { cabecalhoCerca, parseExemplos, parseSintaxe, htmlBloco } from "../blocos";

describe("blocos", () => {
  it("lê a linha de abertura", () => {
    expect(cabecalhoCerca("```exemplo exercicio")).toEqual({ lang: "exemplo", opcoes: ["exercicio"] });
    expect(cabecalhoCerca("texto")).toBeNull();
  });
  it("agrupa exemplos por errado:", () => {
    const x = parseExemplos("errado: a\ncerto: b\nporquê: c\nerrado: d\ncerto: e");
    expect(x).toHaveLength(2);
    expect(x[0]).toEqual({ errado: "a", certo: "b", porque: "c" });
  });
  it("marca erro e acerto com escape", () => {
    const h = htmlBloco("exemplo", [], "errado: <b>[forão]{erro}\ncerto: [foram]{ok}");
    expect(h).toContain('<mark class="ex-erro">forão</mark>');
    expect(h).toContain('<mark class="ex-ok">foram</mark>');
    expect(h).toContain("&lt;b&gt;");
  });
  it("negrito e código no porquê", () => {
    expect(htmlBloco("exemplo", [], "errado: a\nporquê: o **a** e `b`")).toContain("<strong>a</strong> e <code>b</code>");
  });
  it("modo exercício esconde o certo", () => {
    const h = htmlBloco("exemplo", ["exercicio"], "errado: Eles [forão]{erro}\ncerto: Eles foram");
    expect(h).not.toContain("ex-certo");
    expect(h).toContain("Resposta:");
  });
  it("aninha grupos e separa camadas", () => {
    const n = parseSintaxe("[Os [alunos]{:subst}]{sujeito} [[leram]{verbo} o livro]{predicado}.");
    expect(n[0]).toMatchObject({ t: "g", rotulo: "sujeito", camada: "f" });
    expect(n[0].filhos[1]).toMatchObject({ camada: "k", rotulo: "subst" });
    expect(n[2].filhos[0].rotulo).toBe("verbo");
    expect(n.at(-1)).toEqual({ t: "txt", v: "." });
  });
  it("colchete sem rótulo fica como texto", () => {
    expect(parseSintaxe("[sem rótulo] aqui")).toEqual([{ t: "txt", v: "[sem rótulo] aqui" }]);
  });
  it("só oferece alternar camadas quando há mais de uma", () => {
    expect(htmlBloco("sintaxe", [], "[a]{sujeito}")).not.toContain("sx-camadas");
    expect(htmlBloco("sintaxe", [], "[[a]{:art} b]{sujeito}")).toContain("sx-camadas");
  });
  it("ignora outros idiomas e blocos vazios", () => {
    expect(htmlBloco("js", [], "x")).toBeNull();
    expect(htmlBloco("exemplo", [], "")).toBeNull();
  });
});
