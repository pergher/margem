// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const lidas = [];
vi.mock("@/lib/api", () => ({ invoke: async (cmd, a) => { lidas.push(a.path); return "texto"; }, isTauri: false }));
vi.mock("@/lib/recentes", () => ({ lembrarRecente: vi.fn() }));
const { useHistoricoNavegacao, chaveEntrada } = await import("../useHistoricoNavegacao");

function montar(page = "editor") {
  const nav = { aulasPasta: "", inicioModo: "hoje", correcaoFoco: null, recursosAba: "textos", recursosPasta: "", ciclo: null,
    setAulasPasta: vi.fn(), inicioModoRaw: vi.fn(), setCorrecaoFoco: vi.fn(), setRecursosAba: vi.fn(), setRecursosPasta: vi.fn(), setCiclo: vi.fn() };
  const nota = { cur: { current: null }, dirty: { current: false }, save: vi.fn(async () => {}), setCurrent: vi.fn() };
  nota.load = vi.fn(async (p) => { nota.cur.current = p; });
  const setPage = vi.fn();
  const ed = { current: { getText: () => "texto" } };
  const r = renderHook((props) => useHistoricoNavegacao(props), { initialProps: { page, setPage, nav, nota, ed } });
  return { nav, nota, setPage, ...r };
}

describe("chaveEntrada", () => {
  it("duas visitas iguais têm a mesma chave", () => {
    expect(chaveEntrada({ k: "nota", path: "/a" })).toBe(chaveEntrada({ k: "nota", path: "/a" }));
    expect(chaveEntrada({ k: "pag", page: "aulas", aulasPasta: "x" })).not.toBe(chaveEntrada({ k: "pag", page: "aulas", aulasPasta: "y" }));
  });
});

describe("useHistoricoNavegacao", () => {
  it("abrir notas empilha; voltar e avançar recarregam a nota certa", async () => {
    const m = montar();
    await act(async () => { await m.result.current.open("/v/A.md"); });
    await act(async () => { await m.result.current.open("/v/B.md"); });
    expect(m.result.current.canBack).toBe(true);
    expect(m.result.current.canFwd).toBe(false);
    await act(async () => { await m.result.current.go(-1); });
    expect(m.nota.load).toHaveBeenLastCalledWith("/v/A.md");
    expect(m.result.current.canFwd).toBe(true);
    await act(async () => { await m.result.current.go(1); });
    expect(m.nota.load).toHaveBeenLastCalledWith("/v/B.md");
    await act(async () => { await m.result.current.go(1); }); // além do fim: nada acontece
    expect(m.nota.load).toHaveBeenCalledTimes(4); // 2 aberturas + voltar + avançar
  });

  it("abrir a mesma nota de novo não duplica o passo", async () => {
    const m = montar();
    await act(async () => { await m.result.current.open("/v/A.md"); });
    await act(async () => { await m.result.current.open("/v/A.md"); });
    expect(m.result.current.canBack).toBe(false);
  });

  it("nota já aberta e sem mudanças no disco só volta ao editor, sem recarregar", async () => {
    const m = montar();
    m.nota.cur.current = "/v/A.md";
    await act(async () => { await m.result.current.open("/v/A.md"); });
    expect(m.setPage).toHaveBeenCalledWith("editor");
    expect(m.nota.load).not.toHaveBeenCalled();
  });

  it("mudar de tela vira um passo; voltar restaura a pasta e salva antes", async () => {
    const m = montar("aulas");
    await act(async () => { await m.result.current.open("/v/A.md"); });
    m.rerender({ page: "aulas", setPage: m.setPage, nav: { ...m.nav, aulasPasta: "Crase" }, nota: m.nota, ed: { current: { getText: () => "" } } });
    expect(m.result.current.canBack).toBe(true);
    await act(async () => { await m.result.current.go(-1); });
    expect(m.nota.load).toHaveBeenCalled(); // voltou para a nota A
  });

  it("remap atualiza o histórico e a nota aberta depois de renomear/mover", async () => {
    const m = montar();
    await act(async () => { await m.result.current.open("/v/pasta/A.md"); });
    await act(async () => { await m.result.current.open("/v/B.md"); });
    m.nota.cur.current = "/v/pasta/A.md";
    act(() => m.result.current.remap("/v/pasta", "/v/nova"));
    expect(m.nota.cur.current).toBe("/v/nova/A.md");
    expect(m.nota.setCurrent).toHaveBeenCalledWith("/v/nova/A.md");
    await act(async () => { await m.result.current.go(-1); });
    expect(m.nota.load).toHaveBeenLastCalledWith("/v/nova/A.md");
  });
});
