import { describe, expect, it } from "vitest";
import { decidirCompacto } from "../useCompacto";

describe("decidirCompacto", () => {
  it("automático: compacto só abaixo de 768 px", () => {
    expect(decidirCompacto("auto", 767)).toBe(true);
    expect(decidirCompacto("auto", 768)).toBe(false);
    expect(decidirCompacto(undefined, 400)).toBe(true);
  });
  it("forçar ligado ou desligado ignora a largura", () => {
    expect(decidirCompacto("sim", 1920)).toBe(true);
    expect(decidirCompacto("nao", 360)).toBe(false);
  });
});
