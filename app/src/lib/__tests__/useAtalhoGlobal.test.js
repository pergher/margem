import { describe, it, expect } from "vitest";
import { combinacaoGlobal } from "../useAtalhoGlobal";

describe("combinacaoGlobal", () => {
  it("aceita combinações com Ctrl ou Alt", () => {
    expect(combinacaoGlobal("Ctrl+Alt+M")).toBe("Ctrl+Alt+M");
    expect(combinacaoGlobal("Alt+Space")).toBe("Alt+Space");
  });
  it("recusa tecla solta ou só com Shift, que tomaria a digitação de todos os programas", () => {
    expect(combinacaoGlobal("J")).toBeNull();
    expect(combinacaoGlobal("Shift+M")).toBeNull();
    expect(combinacaoGlobal("")).toBeNull();
    expect(combinacaoGlobal(undefined)).toBeNull();
  });
});
