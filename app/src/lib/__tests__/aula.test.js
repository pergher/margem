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

import { acrescentarMemoria, lerMemoria } from "@/lib/aula";

describe("Memória da aula", () => {
  const base = "---\ntipo: aula\n---\n# T\n\n## Objetivos\n\n- a\n\n## Conteúdo\n\ntexto\n";
  it("não vira aba e começa sem notas", () => {
    const a = parseAula(base);
    expect(a.memoria).toEqual([]);
  });
  it("cria a seção no fim e lê de volta", () => {
    const t = acrescentarMemoria(base, { data: "2026-11-18", turma: "72", sinal: "ajustar", texto: "pouco tempo" });
    expect(t).toBe(base + "\n## Memória\n\n- 2026-11-18 · 72 · ajustar — pouco tempo\n");
    const a = parseAula(t);
    expect(a.memoria).toEqual([{ data: "2026-11-18", turma: "72", sinal: "ajustar", texto: "pouco tempo" }]);
    expect(a.secoes.map((s) => s.nome)).toEqual(["Objetivos", "Conteúdo"]);
  });
  it("acrescenta na seção existente, mesmo com outra seção depois", () => {
    const com = base + "\n## Memória\n\n- 2026-11-10 — antes\n\n## Extra\n\nx\n";
    const t = acrescentarMemoria(com, { data: "2026-11-18", texto: "depois" });
    expect(t).toBe(base + "\n## Memória\n\n- 2026-11-10 — antes\n- 2026-11-18 — depois\n\n## Extra\n\nx\n");
    expect(parseAula(t).memoria.map((m) => m.texto)).toEqual(["antes", "depois"]);
    expect(parseAula(t).secoes.map((s) => s.id)).toEqual(["s0", "s1", "s3"]); // os ids seguem a posição no arquivo
  });
  it("só o sinal já vale; nota vazia não muda nada", () => {
    expect(acrescentarMemoria(base, { data: "2026-11-18", sinal: "funcionou" })).toContain("- 2026-11-18 · funcionou\n");
    expect(acrescentarMemoria(base, { data: "2026-11-18", texto: "  " })).toBe(base);
  });
  it("lê linhas soltas, sem data", () => {
    expect(lerMemoria("## Memória\n\n- bom\n")).toEqual([{ data: "", turma: "", sinal: "", texto: "bom" }]);
  });
});
