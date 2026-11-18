import { describe, it, expect } from "vitest";
import { acrescentar, alternar, lerTarefas, limparFeitas } from "../caixa";

describe("caixa de entrada", () => {
  it("acrescenta ao fim sem tocar no resto", () => {
    expect(acrescentar("# Caixa\n\n- [ ] a\n", "b")).toBe("# Caixa\n\n- [ ] a\n- [ ] b\n");
    expect(acrescentar("# Caixa", "b")).toBe("# Caixa\n- [ ] b\n");
  });
  it("ignora texto vazio e junta quebras de linha", () => {
    expect(acrescentar("x\n", "   ")).toBe("x\n");
    expect(acrescentar("x\n", "a\nb")).toBe("x\n- [ ] a b\n");
  });
  it("lê só as tarefas", () => {
    expect(lerTarefas("# T\ntexto\n- [ ] a\n- [x] b\n* [X] c")).toEqual([
      { linha: 2, feito: false, texto: "a" }, { linha: 3, feito: true, texto: "b" }, { linha: 4, feito: true, texto: "c" }]);
  });
  it("alterna só se a linha ainda é a mesma tarefa", () => {
    expect(alternar("- [ ] a\n- [ ] b\n", 1, "b")).toBe("- [ ] a\n- [x] b\n");
    expect(alternar("- [x] a\n", 0, "a")).toBe("- [ ] a\n");
    expect(alternar("- [ ] a\n", 0, "outra")).toBe("- [ ] a\n"); // arquivo mudou por fora
  });
  it("limpa as feitas", () => {
    expect(limparFeitas("t\n- [x] a\n- [ ] b\n")).toBe("t\n- [ ] b\n");
  });
});
