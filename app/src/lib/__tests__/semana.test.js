import { describe, expect, it, vi } from "vitest";

const arquivos = {};
vi.mock("@/lib/api", () => ({
  invoke: async (cmd, a) => { if (cmd === "read_note") return arquivos[a.path]; if (cmd === "save_note") { arquivos[a.path] = a.text; return null; } throw new Error(cmd); },
}));

const { removerAulaSemana, adicionarAvulsa, adicionarDoCiclo, promoverAvulsa, ajustarSemanasAoCiclo, parseSemanaNota, renderSemana } = await import("../semana");

const NOTA = `---
tipo: semana
ano: 7
rotulo: 3 a 7 de Novembro
revisado: sim
---
# Semana — 3 a 7 de Novembro

Anotação livre do professor: lembrar da reunião.

### 71

Ciclo: [[231 - Crase]]

| Aula | Recurso | Ciclo |
|---|---|---|
| **Crase** ✓ | [[Slides]] | [[231 - Crase]] 1 |
| Exercícios | | [[231 - Crase]] 2 |
| Aula avulsa |  |  |

Observação sobre a 71.

### 72

| Aula | Recurso | Ciclo |
|---|---|---|
| Poema |  |  |
`;
const P = "/v/Anos/2026/Semanas/Semana 2026-11-03.md";
const com = (t) => { arquivos[P] = t; };

describe("edição da Semana preserva o que não foi tocado", () => {
  it("remover uma aula mexe só na linha removida", async () => {
    com(NOTA);
    await removerAulaSemana(P, "71", 2);
    expect(arquivos[P]).toBe(NOTA.replace("| Exercícios | | [[231 - Crase]] 2 |\n", ""));
  });

  it("adicionar avulsa mantém frontmatter extra, texto livre e linhas intactas", async () => {
    com(NOTA);
    await adicionarAvulsa(P, "72", "Revisão", "[[Slides]]");
    const t = arquivos[P];
    expect(t).toBe(NOTA.replace("| Poema |  |  |\n", "| Poema |  |  |\n| Revisão | [[Slides]] |  |\n"));
    expect(t).toContain("revisado: sim");
    expect(t).toContain("Anotação livre do professor");
    expect(t).toContain("Observação sobre a 71.");
  });

  it("turma nova vira bloco novo no fim", async () => {
    com(NOTA);
    await adicionarAvulsa(P, "81", "Conto");
    const t = arquivos[P];
    expect(t.startsWith(NOTA.trimEnd())).toBe(true);
    expect(parseSemanaNota(t).turmas.map((x) => x.turma)).toEqual(["71", "72", "81"]);
  });

  it("adicionar aula do ciclo grava a ligação só na linha nova", async () => {
    com(NOTA);
    await adicionarDoCiclo(P, "71", { texto: "Prova", recurso: "", cicloNome: "231 - Crase", cicloN: 3 });
    expect(arquivos[P]).toBe(NOTA.replace("| Aula avulsa |  |  |\n", "| Aula avulsa |  |  |\n| Prova |  | [[231 - Crase]] 3 |\n"));
  });

  it("ajustar semanas ao ciclo reescreve só as linhas afetadas", async () => {
    com(NOTA);
    await ajustarSemanasAoCiclo([{ rel: "Anos/2026/Semanas/Semana 2026-11-03.md", path: P }], "231 - Crase", { inserirEm: 2 });
    expect(arquivos[P]).toBe(NOTA.replace("| Exercícios | | [[231 - Crase]] 2 |", "| Exercícios |  | [[231 - Crase]] 3 |")); // só a linha alterada é regerada
  });

  it("promover avulsa liga só a linha promovida e acrescenta ao ciclo", async () => {
    com(NOTA);
    const C = "/v/Ciclos/231 - Crase.md";
    arquivos[C] = "---\ntipo: ciclo\nano: 7\n---\n## Aulas\n\n| # | Conteúdo | Recurso |\n| --- | --- | --- |\n| 1 | Crase |  |\n| 2 | Exercícios |  |\n";
    await promoverAvulsa(P, "71", 3, { path: C, name: "231 - Crase" });
    expect(arquivos[P]).toBe(NOTA.replace("| Aula avulsa |  |  |", "| Aula avulsa |  | [[231 - Crase]] 3 |"));
    expect(arquivos[C]).toContain("Aula avulsa");
  });

  it("recusa editar tabela interrompida por texto, sem alterar a nota", async () => {
    const quebrada = NOTA.replace("| Exercícios | | [[231 - Crase]] 2 |\n", "| Exercícios | | [[231 - Crase]] 2 |\ntexto no meio\n");
    com(quebrada);
    await expect(removerAulaSemana(P, "71", 1)).rejects.toThrow(/texto no meio/);
    expect(arquivos[P]).toBe(quebrada);
  });

  it("nota gerada pelo app continua lida igual (ida e volta)", () => {
    const s = parseSemanaNota(NOTA);
    expect(parseSemanaNota(renderSemana(s)).turmas).toEqual(s.turmas);
  });
});
