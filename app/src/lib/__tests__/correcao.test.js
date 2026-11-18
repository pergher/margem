import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ invoke: async () => { throw new Error("sem Tauri"); } }));

const C = await import("../correcao");

const NOTA = `---
turma: 71
mês: março
atividade: Conto
status: andamento
---
Rubrica. Cada critério vale 0, 0,5 ou 1 ponto. Média: 6,5

## Ana
![[ana.jpg]]
### Texto
Ela {foze|fez} tudo [palavra?] {p:|,} bem.
### Avaliação
| Critério | Nota | Comentário |
| --- | --- | --- |
| Tema | 1 | ok \\| bom |
| Coesão | 0,5 | |
| **Nota final** | **1,5** | |

## Beto
### Texto
Texto.
### Avaliação
| Critério | Nota | Comentário |
| --- | --- | --- |
| Tema | 0 | |
| Coesão | | |
| **Nota final** | **0** | |
`;

describe("parseCorrecao", () => {
  const d = C.parseCorrecao(NOTA);

  it("lê cabeçalho e rubrica", () => {
    expect(d).toMatchObject({ turma: "71", mes: "março", atividade: "Conto", status: "andamento", media: 6.5, maxCriterio: 1 });
  });

  it("lê alunos, foto, notas e comentários com barra", () => {
    expect(d.alunos.map((a) => a.nome)).toEqual(["Ana", "Beto"]);
    expect(d.alunos[0].foto).toBe("ana.jpg");
    expect(d.alunos[0].criterios[0]).toEqual({ nome: "Tema", nota: "1", comentario: "ok | bom" });
    expect(d.alunos[0].total).toBe(1.5);
    expect(d.alunos[0].final).toBe("1,5");
  });

  it("conta marcas e erros do texto", () => {
    expect(d.alunos[0].marcas).toBe(1);
    expect(d.alunos[0].erros).toEqual({ orto: 1, pont: 1 });
    expect(C.contarErros("{a|b} {p:,|} {c}")).toEqual({ orto: 2, pont: 1 });
  });

  it("nota parcial soma só o que há; nada preenchido dá null", () => {
    expect(d.alunos[1].total).toBe(0);
    expect(C.parseCorrecao(NOTA.replace("| Tema | 0 |", "| Tema | |")).alunos[1].total).toBeNull();
  });

  it("pesos e níveis vêm do _dados.json", () => {
    const p = C.parseCorrecao(NOTA, { criterios: [{ nome: "Tema", peso: 2, descritores: { "1": "a", "0,5": "b", "0": "c" } }, { nome: "Coesão", peso: 1 }], gradacao: [0, 0.5, 1] });
    expect(p.pesos).toEqual({ Tema: 2, Coesão: 1 });
    expect(C.maxDe(p, "Tema")).toBe(2);
    expect(C.opcoesDe(p, "Tema")).toEqual([0, 1, 2]);
    expect(C.opcoesDe(p, "Coesão")).toEqual([0, 0.5, 1]);
  });

  it("sem _dados.json: de 0,5 em 0,5 até o máximo", () => {
    expect(C.opcoesDe(d, "Tema")).toEqual([0, 0.5, 1]);
  });
});

describe("números", () => {
  it("num e fmt", () => {
    expect(C.num("1,5")).toBe(1.5);
    expect(C.num("")).toBeNull();
    expect(C.fmt(1.5)).toBe("1,5");
    expect(C.fmt(null)).toBe("—");
  });
});

describe("estatisticas", () => {
  it("média, mediana, faixas e pendências", () => {
    const e = C.estatisticas(C.parseCorrecao(NOTA));
    expect(e.maximo).toBe(2);
    expect(e.media).toBe(0.75);
    expect(e.mediana).toBe(0.75);
    expect(e.faixas.reduce((s, f) => s + f.n, 0)).toBe(2);
    expect(e.abaixo).toBe(2);
    expect(e.pendentes).toBe(1);
    expect(e.divergentes).toEqual([]);
  });
});

describe("editarNota", () => {
  it("troca a nota e recalcula a nota final, mexendo só nisso", () => {
    const t = C.editarNota(NOTA, "Ana", "Coesão", 1);
    expect(t).toContain("| Coesão | 1 | |");
    expect(t).toContain("| **Nota final** | **2** | |");
    expect(t.replace(/^\| (Coesão|\*\*Nota final).*$/gm, "")).toBe(NOTA.replace(/^\| (Coesão|\*\*Nota final).*$/gm, "").replace("", ""));
  });

  it("não vaza para outro aluno e avisa quando não acha", () => {
    expect(C.editarNota(NOTA, "Ana", "Tema", 0.5)).toContain("| Tema | 0 | |");
    expect(() => C.editarNota(NOTA, "Zé", "Tema", 1)).toThrow(/aluno/);
    expect(() => C.editarNota(NOTA, "Ana", "Outro", 1)).toThrow(/critério/);
  });
});

describe("devolutiva", () => {
  it("monta o texto do aluno", () => {
    const d = C.parseCorrecao(NOTA);
    const t = C.devolutiva(d, d.alunos[0]);
    expect(t).toContain("# Ana — Conto (turma 71)");
    expect(t).toContain("**Nota: 1,5 de 2**");
  });
  it("identifica o aluno pela sigla", () => {
    const d = C.parseCorrecao(NOTA);
    expect(C.devolutiva(d, { ...d.alunos[0], nome: "Paulo Pergher" })).toContain("# PaPe — Conto");
  });
});

describe("enunciado", () => {
  it("cria a seção antes do primeiro aluno e não vira aluno", () => {
    const t = C.editarEnunciado(NOTA, "Escreva uma coluna.\n15 a 20 linhas.");
    expect(t).toContain("Rubrica. Cada critério vale 0, 0,5 ou 1 ponto. Média: 6,5\n\n## Enunciado\n\nEscreva uma coluna.\n15 a 20 linhas.\n\n## Ana");
    const d = C.parseCorrecao(t);
    expect(d.enunciado).toBe("Escreva uma coluna.\n15 a 20 linhas.");
    expect(d.alunos.map((a) => a.nome)).toEqual(["Ana", "Beto"]);
    expect(d.media).toBe(6.5);
  });
  it("troca e remove a seção existente", () => {
    const t1 = C.editarEnunciado(NOTA, "A");
    const t2 = C.editarEnunciado(t1, "B");
    expect(C.parseCorrecao(t2).enunciado).toBe("B");
    expect(t2.match(/## Enunciado/g)).toHaveLength(1);
    expect(C.editarEnunciado(t2, "")).toBe(NOTA);
  });
  it("sem enunciado devolve vazio", () => expect(C.parseCorrecao(NOTA).enunciado).toBe(""));
});
