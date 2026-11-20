import { describe, it, expect } from "vitest";
import { instanciar, textoDeFabrica, secoesFaltando, modelosDoTipo, TIPOS_MODELO } from "../modelos";
import { modeloAula } from "../aula";
import { modeloGramatica } from "../gramatica";
import { RECURSOS } from "../recursos";

describe("modelos", () => {
  it("o modelo de fábrica gera a mesma nota que o código antigo", () => {
    expect(instanciar(textoDeFabrica("aula"), { titulo: "Crase", ano: "7" })).toBe(modeloAula({ ano: "7", titulo: "Crase" }));
    expect(instanciar(textoDeFabrica("gramatica"), { titulo: "Crase", ano: ["7", "8"] })).toBe(modeloGramatica({ topico: "Crase", ano: ["7", "8"] }));
    for (const t of ["texto", "oficina", "banco"]) expect(instanciar(textoDeFabrica(t), { titulo: "Meu nome" })).toBe(RECURSOS[t].modelo("Meu nome"));
  });
  it("a nota-modelo não conta como aula: tipo configuracao + modelo_de", () => {
    const m = textoDeFabrica("aula");
    expect(m).toContain("tipo: configuracao\nmodelo_de: aula");
    expect(instanciar(m, { titulo: "X" })).toContain("tipo: aula");
    expect(instanciar(m, { titulo: "X" })).not.toContain("configuracao");
  });
  it("título com caracteres especiais vai entre aspas no frontmatter e sem parênteses no Mermaid", () => {
    const t = instanciar(textoDeFabrica("gramatica"), { titulo: "Uso de: porque (e por que)" });
    expect(t).toContain('topico: "Uso de: porque (e por que)"');
    expect(instanciar(textoDeFabrica("aula"), { titulo: "A (B)" })).toContain("root((A B))");
  });
  it("marcadores {{data}} e {{ano}}", () => {
    const t = instanciar("---\ntipo: configuracao\nmodelo_de: aula\nfeita: {{data}}\n---\n# {{titulo}} {{ano}}\n", { titulo: "A", ano: "6" });
    expect(t).toMatch(/feita: \d{4}-\d{2}-\d{2}/);
    expect(t).toContain("# A 6");
  });
  it("aponta seção obrigatória que falta, ignorando maiúsculas, acento e plural", () => {
    expect(secoesFaltando("## objetivo\n## Conteudo\n```\n## Atividades\n```\n", "aula")).toEqual(["Habilidades", "Atividades"]);
    expect(secoesFaltando(textoDeFabrica("gramatica"), "gramatica")).toEqual([]);
  });
  it("o padrão (nome igual ao tipo) vem primeiro", () => {
    const ms = [{ tipo: "aula", name: "Aula - Leitura", path: "b" }, { tipo: "aula", name: "Aula", path: "a" }, { tipo: "texto", name: "Texto", path: "c" }];
    expect(modelosDoTipo(ms, "aula").map((m) => m.path)).toEqual(["a", "b"]);
    expect(Object.keys(TIPOS_MODELO)).toContain("banco");
  });
});
