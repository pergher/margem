// @vitest-environment jsdom
// Aplicar uma proposta: nota aberta passa pelo editor (desfazer, autosave); nota fechada passa pelo Rust.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const chamadas = [];
vi.mock("@/lib/api", () => ({
  isTauri: false,
  invoke: async (cmd, a = {}) => {
    chamadas.push({ cmd, ...a });
    if (cmd === "listar_propostas") return [];
    if (cmd === "aplicar_proposta") return { path: a.id === 2 ? "/v/Nova.md" : "/v/B.md", nova: a.id === 2, versao: a.id === 2 ? null : "123" };
    return null;
  },
}));
const { usePropostas } = await import("../usePropostas");

function montar(textoDoEditor = "base") {
  const ed = { current: { texto: textoDoEditor, getText() { return this.texto; }, replaceDoc: vi.fn(function (t) { this.texto = t; }) } };
  const cur = { current: "/v/A.md" };
  const refresh = vi.fn(async () => {}), setStatus = vi.fn();
  const { result } = renderHook(() => usePropostas({ ed, cur, refresh, setStatus, vaultRoot: "/v" }));
  return { ed, cur, refresh, setStatus, result };
}
beforeEach(() => { chamadas.length = 0; });

describe("usePropostas", () => {
  it("nota aberta: troca o texto pelo editor (nada vai ao Rust) e Desfazer devolve a base", async () => {
    const m = montar();
    const p = { id: 1, nota: "/v/A.md", texto_base: "base", texto_novo: "NOVO" };
    await act(async () => { await m.result.current.aplicar(p, "NOVO"); });
    expect(m.ed.current.replaceDoc).toHaveBeenCalledWith("NOVO");
    expect(chamadas.map((c) => c.cmd)).not.toContain("aplicar_proposta");
    expect(chamadas.map((c) => c.cmd)).toContain("descartar_proposta");
    expect(m.result.current.desfazer.texto).toBe("Aplicado");
    await act(async () => { await m.result.current.desfazerAgora(); });
    expect(m.ed.current.replaceDoc).toHaveBeenLastCalledWith("base");
  });
  it("nota aberta que mudou desde a proposta: recusa e não toca no editor", async () => {
    const m = montar("outro texto");
    await expect(m.result.current.aplicar({ id: 1, nota: "/v/A.md", texto_base: "base", texto_novo: "NOVO" }, "NOVO")).rejects.toThrow(/mudou desde a proposta/);
    expect(m.ed.current.replaceDoc).not.toHaveBeenCalled();
  });
  it("nota fechada: aplica pelo Rust e Desfazer restaura a versão do histórico", async () => {
    const m = montar();
    await act(async () => { await m.result.current.aplicar({ id: 1, nota: "/v/B.md", texto_base: "x", texto_novo: "y" }, "y"); });
    expect(chamadas.find((c) => c.cmd === "aplicar_proposta")).toMatchObject({ id: 1, textoFinal: "y" });
    await act(async () => { await m.result.current.desfazerAgora(); });
    expect(chamadas.find((c) => c.cmd === "restore_version")).toMatchObject({ path: "/v/B.md", id: "123" });
  });
  it("nota nova: Desfazer manda para a lixeira", async () => {
    const m = montar();
    await act(async () => { await m.result.current.aplicar({ id: 2, nota: null, nova: { dir: "/v", nome: "Nova" }, texto_base: "", texto_novo: "# Nova" }, "# Nova"); });
    await act(async () => { await m.result.current.desfazerAgora(); });
    expect(chamadas.find((c) => c.cmd === "delete_entry")).toMatchObject({ path: "/v/Nova.md" });
  });
});
