import { describe, expect, it, vi } from "vitest";

const arquivos = {};
let falharEm = null;
vi.mock("@/lib/api", () => ({
  invoke: async (cmd, a) => {
    if (cmd === "read_note") return arquivos[a.path];
    if (cmd === "save_note") { if (a.path === falharEm && !a.force) throw new Error("disco cheio"); arquivos[a.path] = a.text; return null; }
    throw new Error(cmd);
  },
}));
const { gravarVarios } = await import("../transacao");

describe("gravarVarios", () => {
  it("grava todos", async () => {
    Object.assign(arquivos, { a: "1", b: "2" }); falharEm = null;
    await gravarVarios([{ path: "a", text: "A" }, { path: "b", text: "B" }]);
    expect(arquivos).toMatchObject({ a: "A", b: "B" });
  });

  it("se uma falha, devolve as já gravadas ao original", async () => {
    Object.assign(arquivos, { a: "1", b: "2" }); falharEm = "b";
    await expect(gravarVarios([{ path: "a", text: "A" }, { path: "b", text: "B" }])).rejects.toThrow(/nada foi alterado/);
    expect(arquivos).toMatchObject({ a: "1", b: "2" });
  });
});
