// Conformidade com o núcleo Rust: lê os mesmos casos de `tests/fixtures/conformidade/casos.json` que
// `tests/conformidade.rs`. Se o JavaScript e o Rust passarem a entender o vault de jeitos diferentes, um dos dois quebra.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ invoke: async () => null, isTauri: false }));
const { parseCiclo } = await import("../ciclos");
const { parseSemanaNota } = await import("../semana");
const { parseFm } = await import("../frontmatter");

const casos = JSON.parse(readFileSync(new URL("../../../../tests/fixtures/conformidade/casos.json", import.meta.url), "utf8"));
const SITUACAO = { dada: "dada", pulada: "adiada", descartada: "descartada" }; // o JS chama "adiada" de "pulada"

const projetar = {
  ciclo: (t) => ({ aulas: parseCiclo({ path: "/v/Acervo/Ciclos/X.md", name: "X", rel: "Acervo/Ciclos/X.md" }, t).aulas.map(({ n, texto, recurso }) => ({ n, texto, recurso })) }),
  semana: (t) => {
    const s = parseSemanaNota(t);
    return { rotulo: s.rotulo, turmas: s.turmas.map((x) => ({ turma: x.turma, ciclo: x.cicloNome, aulas: x.aulas.map((a) => ({
      n: a.n, texto: a.texto, recurso: a.recurso, ciclo: a.cicloNome, ciclo_n: a.cicloN, situacao: a.situacao ? SITUACAO[a.situacao] : null,
    })) })) };
  },
  frontmatter: (t) => ({ campos: Object.fromEntries(parseFm(t).entries.map((e) => [e.key, e.items ?? e.value])) }),
};

describe("conformidade com o núcleo Rust", () => {
  for (const c of casos) it(c.nome, () => expect(projetar[c.tipo](c.entrada)).toEqual(c.esperado));
});
