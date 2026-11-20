import { describe, it, expect } from "vitest";
import { planejarStatus, planejarTag, intervalo, limparTag } from "../lote";

const nota = "---\ntipo: aula\nstatus: pendente\ntags: [crase]\n---\n# A\n";

describe("lote", () => {
  it("muda o status", () => {
    const p = planejarStatus(nota, "finalizado");
    expect(p.novo).toContain("status: finalizado");
    expect(p.rotulo).toBe("pendente → finalizado");
  });
  it("não mexe quando o status já é o mesmo ou não existe", () => {
    expect(planejarStatus(nota, "pendente").novo).toBeNull();
    expect(planejarStatus("# sem frontmatter\n", "pendente").novo).toBeNull();
  });
  it("acrescenta a tag sem repetir (ignora # e maiúsculas)", () => {
    expect(planejarTag(nota, "#verbos").novo).toContain("tags: [crase, verbos]");
    expect(planejarTag(nota, "Crase").novo).toBeNull();
    expect(planejarTag(nota, "  ").novo).toBeNull();
  });
  it("cria o campo tags e até o frontmatter, se faltar", () => {
    expect(planejarTag("---\ntipo: aula\n---\ncorpo\n", "x").novo).toContain("tags: [x]");
    expect(planejarTag("corpo\n", "x").novo.startsWith("---\ntags: [x]\n---\n")).toBe(true);
  });
  it("seleciona um intervalo em qualquer sentido", () => {
    const ids = ["a", "b", "c", "d"];
    expect(intervalo(ids, "b", "d")).toEqual(["b", "c", "d"]);
    expect(intervalo(ids, "c", "a")).toEqual(["a", "b", "c"]);
    expect(intervalo(ids, null, "c")).toEqual(["c"]);
  });
  it("limpa a tag", () => { expect(limparTag(" ##aula ")).toBe("aula"); });
});
