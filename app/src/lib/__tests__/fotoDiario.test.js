import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn(async () => "ok");
vi.mock("@/lib/api", () => ({ invoke: (...a) => invoke(...a) }));

import { nomeDaFoto, reduzirFoto, guardarFotoDiario } from "@/lib/fotoDiario";

describe("foto do diário", () => {
  it("nomeia pela turma e semana, sem caracteres proibidos", () => {
    expect(nomeDaFoto("71", "9 a 13 de Novembro")).toBe("Foto diario 71 - 9 a 13 de Novembro.jpg");
    expect(nomeDaFoto("71", "2026/11:09")).toBe("Foto diario 71 - 2026 11 09.jpg");
  });

  it("recusa o que não é imagem, sem gravar nada", async () => {
    await expect(reduzirFoto(new File(["x"], "a.pdf", { type: "application/pdf" }))).rejects.toThrow(/imagem/);
    await expect(guardarFotoDiario([], { ano: 2026, turma: "71", semana: "s", arquivo: null })).rejects.toThrow(/imagem/);
    expect(invoke).not.toHaveBeenCalled();
  });
});
