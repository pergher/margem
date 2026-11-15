import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseGramatica, modeloGramatica } from "../gramatica";
import { htmlBloco, cabecalhoCerca } from "../blocos";

const dir = path.resolve(__dirname, "../../../../docs/modelos/Gramática");
const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

describe("gramática", () => {
  it("o modelo novo é válido e traz as cinco seções", () => {
    const g = parseGramatica(modeloGramatica({ topico: "Crase", ano: ["8", "9"] }));
    expect(g.avisos).toEqual([]);
    expect(g.anos).toEqual(["8", "9"]);
    expect(g.secoes.map((s) => s.tipo)).toEqual(["regra", "exemplos", "excecoes", "teste", "veja"]);
    expect(g.faltam).toEqual([]); // o modelo já traz texto na Regra e o bloco exemplo
  });
  it("aponta tipo errado, ano fora de 6–9 e seção desconhecida", () => {
    const g = parseGramatica("---\ntipo: aula\ntopico: X\nano: 5\n---\n# X\n\n## Regra\n\nok\n\n## Outra\n\nx\n");
    expect(g.avisos.join("|")).toMatch(/tipo deve ser gramatica/);
    expect(g.avisos.join("|")).toMatch(/ano deve ser/);
    expect(g.avisos.join("|")).toMatch(/seção desconhecida: Outra/);
    expect(g.faltam).toEqual(["Exemplos"]);
  });
  it("há arquivos fictícios", () => expect(arquivos.length).toBeGreaterThanOrEqual(4));
  for (const f of arquivos) {
    it(`${f} segue o modelo`, () => {
      const t = fs.readFileSync(path.join(dir, f), "utf8"), g = parseGramatica(t);
      expect(g.avisos).toEqual([]);
      expect(g.faltam).toEqual([]);
      expect(g.topico).toBe(f.replace(/\.md$/, ""));
      // links "Veja também" apontam para outras gramáticas do conjunto
      for (const l of g.links) expect(arquivos).toContain(l + ".md");
      // todo bloco exemplo/sintaxe do arquivo é desenhável
      for (const m of t.matchAll(/```(exemplo|sintaxe)([^\n]*)\n([\s\S]*?)```/g)) {
        const c = cabecalhoCerca("```" + m[1] + m[2]);
        expect(htmlBloco(c.lang, c.opcoes, m[3]), `bloco ${m[1]} em ${f}`).toBeTruthy();
      }
    });
  }
});
