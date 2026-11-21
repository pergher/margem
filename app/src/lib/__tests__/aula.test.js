import { describe, it, expect } from "vitest";
import { parseAula, secoesBrutas, trocarSecao, corpoBruto, trocarCorpo } from "@/lib/aula";

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

describe("trocarSecao: Enter antes do primeiro título", () => {
  const txt = "---\ntipo: aula\n---\n# T\n\n## Objetivos\n\n- a\n\n## Conteúdo\n\ntexto\n";
  const md = (t, id) => secoesBrutas(t).find((s) => s.id === id).md;

  it("Enter no começo de `## Objetivos` abre espaço e não duplica o título", () => {
    const novo = trocarSecao(txt, "s0", "\n" + md(txt, "s0"));
    expect(novo.match(/^## Objetivos$/gm)).toHaveLength(1);
    expect(novo).toContain("# T\n\n\n## Objetivos");
    expect(md(novo, "intro")).toBe("# T\n"); // o espaço extra aparece no fim da introdução
  });

  it("Enter no fim da introdução deixa a linha em branco no arquivo", () => {
    const novo = trocarSecao(txt, "intro", md(txt, "intro") + "\n");
    expect(novo).toContain("# T\n\n\n## Objetivos");
    expect(md(novo, "intro")).toBe("# T\n");
  });

  it("sem edição o texto não muda", () => {
    expect(trocarSecao(txt, "intro", md(txt, "intro"))).toBe(txt);
    expect(trocarSecao(txt, "s0", md(txt, "s0"))).toBe(txt);
  });
});

describe("corpoBruto / trocarCorpo: o corpo é tudo depois do frontmatter", () => {
  const txt = "---\ntipo: aula\n---\n\n\n# T\n\n## Objetivos\n\n- a\n";
  it("mantém as linhas em branco antes do primeiro título", () => {
    const c = corpoBruto(txt);
    expect(c.ini).toBe(3);
    expect(c.md.startsWith("\n\n# T")).toBe(true);
  });
  it("gravar sem editar não muda o arquivo, e editar preserva o frontmatter e o espaço", () => {
    expect(trocarCorpo(txt, corpoBruto(txt).md)).toBe(txt);
    expect(trocarCorpo(txt, "\n\n\n# T\n")).toBe("---\ntipo: aula\n---\n\n\n\n# T\n");
  });
});
