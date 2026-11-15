import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ invoke: async () => { throw new Error("sem Tauri"); } }));

const C = await import("../ciclos");

const aulas = (n) => Array.from({ length: n }, (_, i) => `| ${i + 1} | Aula ${i + 1} | [[R${i + 1}]] |`).join("\n");
const PLANO = `---
tipo: ciclo
sufixo: PR
---
# Narrativa

## Habilidades
(EF69LP01) Analisar textos.

## Conteúdos
- Narrador
- Tempo

## Aulas
| N | Conteúdo | Recurso |
| --- | --- | --- |
${aulas(3)}

## Fim
texto
`;

describe("faseDaAula", () => {
  it("classifica pelo texto, ignorando acentos", () => {
    expect(C.faseDaAula("Prova do ciclo")).toBe("avaliar");
    expect(C.faseDaAula("Correção da prova")).toBe("corrigir");
    expect(C.faseDaAula("Revisão")).toBe("revisar");
    expect(C.faseDaAula("Leitura do conto")).toBe("ler");
    expect(C.faseDaAula("Exercícios de fixação")).toBe("exercitar");
    expect(C.faseDaAula("Conversa livre")).toBe("explicar");
  });
});

describe("parseCiclo", () => {
  it("lê aulas, habilidades, conteúdos e sufixo", () => {
    const c = C.parseCiclo({ name: "Narrativa", path: "/v/Acervo/Ciclos/Narrativa.md", rel: "Acervo/Ciclos/Narrativa.md" }, PLANO);
    expect(c.aulas).toHaveLength(3);
    expect(c.aulas[1]).toMatchObject({ n: 2, texto: "Aula 2", recurso: "[[R2]]" });
    expect(c.habilidades).toEqual(["EF69LP01"]);
    expect(c.habTexto[0]).toEqual({ codigo: "EF69LP01", texto: "Analisar textos." });
    expect(c.conteudos).toEqual(["Narrador", "Tempo"]);
    expect(c.sufixo).toBe("PR");
    expect(c.incluido).toBe(false);
  });

  it("formato antigo: ano, trimestre e ciclo vêm do nome", () => {
    const c = C.parseCiclo({ name: "712 - Conto - PR", path: "/p", rel: "Anos/2026/Planejamento/712 - Conto - PR.md" }, PLANO);
    expect(c).toMatchObject({ legado: true, ano: 7, tri: 1, ciclo: 2, titulo: "Conto", sufixo: "PR", incluido: true });
  });

  it("barra escapada na célula não quebra a coluna", () => {
    const t = "## Aulas\n| 1 | a \\| b | x |\n";
    const c = C.parseCiclo({ name: "X", path: "/p", rel: "Acervo/Ciclos/X.md" }, t);
    expect(c.aulas[0].texto).toBe("a | b");
  });
});

describe("planejamento do ano", () => {
  const PLAN = "# P\n\n| Ano | Trimestre | Ordem | Ciclo |\n| --- | --- | --- | --- |\n| 6 | 1 | 1 | [[Conto]] |\n| 6 | 1 | 2 | [[Fábula]] |\n";

  it("lê as linhas", () => {
    expect(C.lerLinhasPlanejamento(PLAN)).toEqual({ conto: { ano: 6, tri: 1, ciclo: 1 }, "fábula": { ano: 6, tri: 1, ciclo: 2 } });
  });

  it("inclui com a ordem seguinte e cria a tabela se faltar", () => {
    const t = C.incluirNoPlanejamento(PLAN, "Crônica", { ano: 6, tri: 1 });
    expect(t).toContain("| 6 | 1 | 3 | [[Crônica]] |");
    expect(C.lerLinhasPlanejamento(t)["crônica"]).toEqual({ ano: 6, tri: 1, ciclo: 3 });
    const novo = C.incluirNoPlanejamento("# P\n", "Conto", { ano: 7, tri: 2 });
    expect(novo).toContain("| Ano | Trimestre | Ordem | Ciclo |");
    expect(C.lerLinhasPlanejamento(novo).conto).toEqual({ ano: 7, tri: 2, ciclo: 1 });
  });

  it("tira só a linha do ciclo", () => {
    const t = C.tirarDoPlanejamento(PLAN, "Conto");
    expect(t).not.toContain("[[Conto]]");
    expect(t).toContain("[[Fábula]]");
  });
});

describe("edição da tabela de aulas", () => {
  const nums = (t) => [...t.matchAll(/^\| (\d+) \| ([^|]*?) \|/gm)].map((m) => `${m[1]}:${m[2]}`);

  it("insere e renumera", () => {
    expect(nums(C.inserirAula(PLANO, 2, "Nova"))).toEqual(["1:Aula 1", "2:Nova", "3:Aula 2", "4:Aula 3"]);
  });

  it("move e renumera", () => {
    expect(nums(C.moverAula(PLANO, 1, 3))).toEqual(["1:Aula 2", "2:Aula 3", "3:Aula 1"]);
  });

  it("remove e renumera", () => {
    expect(nums(C.removerAula(PLANO, 2))).toEqual(["1:Aula 1", "2:Aula 3"]);
  });

  it("edita célula sem mexer no resto; escapa barra", () => {
    const t = C.editarCelula(PLANO, 2, 2, "Outra | coisa");
    expect(t).toContain("| 2 | Outra \\| coisa | [[R2]] |");
    expect(t.replace(/^\| 2 .*$/m, "")).toBe(PLANO.replace(/^\| 2 .*$/m, ""));
  });

  it("recusa nota sem a seção Aulas", () => {
    expect(() => C.removerAula("# x\n", 1)).toThrow(/Aulas/);
  });

  it("troca e cria seções", () => {
    const t = C.salvarConteudos(PLANO, ["Só um"]);
    expect(t).toContain("## Conteúdos\n- Só um\n\n## Aulas");
    expect(t).toContain("(EF69LP01)");
    const sem = C.salvarConteudos("# x\n\n## Aulas\n| 1 | a | |\n", ["A"]);
    expect(sem.indexOf("## Conteúdos")).toBeLessThan(sem.indexOf("## Aulas"));
  });
});

describe("nomeComTitulo", () => {
  it("tira caracteres proibidos no nome do arquivo", () => {
    expect(C.nomeComTitulo({ legado: false }, " A/B: c ")).toBe("A B c");
    expect(C.nomeComTitulo({ legado: true, ano: 7, tri: 1, ciclo: 2, sufixo: "PR" }, "Conto")).toBe("712 - Conto - PR");
  });
});
