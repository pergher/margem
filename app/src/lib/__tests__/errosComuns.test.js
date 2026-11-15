import { describe, it, expect } from "vitest";
import { errosComuns, blocoDeErros } from "../errosComuns";

const t1 = "Eles {forão|foram} ao mercado. Comprei {mais|mas} nada.";
const t2 = "Nós {forão|foram} cedo{p:|,} mas voltamos.";
const t3 = "Ela {chegou}.";

describe("errosComuns", () => {
  it("conta alunos distintos e ordena por frequência", () => {
    const e = errosComuns([t1, t2, t1 + " {forão|foram} de novo.", t3]);
    expect(e[0]).toMatchObject({ errado: "forão", certo: "foram", n: 3 });
    expect(e.map((x) => x.errado)).toContain("mais");
  });
  it("ignora pontuação e marca só o erro-alvo na frase", () => {
    const e = errosComuns([t2]);
    expect(e).toHaveLength(1);
    expect(e[0].errada).toBe("Nós [forão]{erro} cedo mas voltamos.");
    expect(e[0].certa).toBe("Nós [foram]{ok} cedo, mas voltamos.");
  });
  it("erro sem correção não tem frase certa", () => {
    const [e] = errosComuns([t3]);
    expect(e.certo).toBe("");
    expect(blocoDeErros([e])).not.toContain("certo:");
  });
  it("monta o bloco exemplo", () => {
    const b = blocoDeErros(errosComuns([t1]).slice(0, 1));
    expect(b.startsWith("```exemplo\nerrado: Eles [forão]{erro} ao mercado.")).toBe(true);
    expect(b).toContain("certo: Eles [foram]{ok} ao mercado.");
  });
});
