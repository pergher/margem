import { describe, it, expect } from "vitest";
import { acrescentarItem, alternarItem, itensDoTri, removerItem, triSugerido } from "../fechamento";

describe("itens do fechamento", () => {
  const base = "---\ntipo: configuracao\n---\n# Fechamento 2026\n\n## 1º trimestre\n\n- [x] Lançar notas\n- [ ] Entregar relatório\n\n## 2º trimestre\n\n- [ ] Conselho\n";
  it("lê só os itens do trimestre pedido", () => {
    expect(itensDoTri(base, 1)).toEqual([{ linha: 7, feito: true, texto: "Lançar notas" }, { linha: 8, feito: false, texto: "Entregar relatório" }]);
    expect(itensDoTri(base, 2).map((i) => i.texto)).toEqual(["Conselho"]);
    expect(itensDoTri(base, 3)).toEqual([]);
  });
  it("acrescenta no fim da seção certa, sem tocar nas outras", () => {
    expect(acrescentarItem(base, 1, "Nova")).toBe(base.replace("- [ ] Entregar relatório\n", "- [ ] Entregar relatório\n- [ ] Nova\n"));
    expect(acrescentarItem(base, 2, "Outra")).toBe(base + "- [ ] Outra\n");
  });
  it("cria a seção do trimestre se faltar; vazio não muda nada", () => {
    expect(acrescentarItem(base, 3, "Feira")).toBe(base + "\n## 3º trimestre\n\n- [ ] Feira\n");
    expect(acrescentarItem(base, 3, "  ")).toBe(base);
  });
  it("alterna e remove só se a linha ainda é o mesmo item", () => {
    expect(alternarItem(base, 8, "Entregar relatório")).toContain("- [x] Entregar relatório");
    expect(alternarItem(base, 8, "outro")).toBe(base);
    expect(removerItem(base, 8, "Entregar relatório")).not.toContain("Entregar relatório");
    expect(removerItem(base, 8, "outro")).toBe(base);
  });
});

describe("trimestre sugerido", () => {
  const c = (tri) => ({ incluido: true, tri, name: "C" + tri, aulas: [{}, {}] });
  const sem = (dadas) => [{ turmas: [{ turma: "61", cicloNome: "C1", aulas: Array.from({ length: dadas }, (_, i) => ({ cicloNome: "C1", cicloN: i + 1, dada: true })) }] }];
  it("é o primeiro com ciclo em andamento", () => expect(triSugerido([c(1)], sem(1))).toBe(1));
  it("sem ciclo aberto, vai pelo mês", () => {
    expect(triSugerido([], [], new Date(2026, 2, 10))).toBe(1);
    expect(triSugerido([], [], new Date(2026, 6, 10))).toBe(2);
    expect(triSugerido([], [], new Date(2026, 10, 18))).toBe(3);
  });
});
