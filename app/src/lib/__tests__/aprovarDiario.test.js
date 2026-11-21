import { beforeEach, describe, expect, it, vi } from "vitest";

const chamadas = [];
let achada = true;
const TEXTO = "---\ntipo: diario\nturma: \"71\"\ntranscricao: aguardando-revisao\nfoto: Foto diario 71 - S1.jpg\n---\n# Diário\n";
vi.mock("@/lib/api", () => ({
  invoke: async (cmd, a) => {
    chamadas.push([cmd, a]);
    if (cmd === "read_note") return TEXTO;
    if (cmd === "read_embed") return achada ? { kind: "image" } : null;
    return null;
  },
}));

import { aprovarDiario } from "@/lib/diario";

const P = "/v/Anos/2026/Diarios/71/Diario 71 - S1.md";
const gravado = () => chamadas.find(([c]) => c === "save_note")[1].text;

describe("aprovar a transcrição", () => {
  beforeEach(() => { chamadas.length = 0; achada = true; });

  it("sem apagar: só muda o estado e mantém a foto", async () => {
    await aprovarDiario(P);
    expect(chamadas.some(([c]) => c === "apagar_foto_diario")).toBe(false);
    expect(gravado()).toContain("transcricao: aprovada");
    expect(gravado()).toContain("foto: Foto diario 71 - S1.jpg");
  });

  it("apagando: remove o arquivo da pasta Fotos e tira o foto: do diário", async () => {
    await aprovarDiario(P, { apagarFoto: true });
    expect(chamadas.find(([c]) => c === "apagar_foto_diario")[1].path).toBe("/v/Anos/2026/Diarios/71/Fotos/Foto diario 71 - S1.jpg");
    expect(gravado()).toContain("transcricao: aprovada");
    expect(gravado()).not.toContain("foto:");
    // o arquivo é apagado antes de a nota ser gravada
    expect(chamadas.findIndex(([c]) => c === "apagar_foto_diario")).toBeLessThan(chamadas.findIndex(([c]) => c === "save_note"));
  });

  it("foto que já não existe: aprova e tira o foto: sem tentar apagar", async () => {
    achada = false;
    await aprovarDiario(P, { apagarFoto: true });
    expect(chamadas.some(([c]) => c === "apagar_foto_diario")).toBe(false);
    expect(gravado()).not.toContain("foto:");
  });
});
