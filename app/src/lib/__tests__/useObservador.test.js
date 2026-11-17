// @vitest-environment jsdom
// Observador de arquivos (interface): `vault-mudou` recarrega a nota limpa e só avisa quando há edições pendentes.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

let ouvinte = null;
const disco = { "/v/A.md": "novo texto" };
const chamadas = [];
vi.mock("@/lib/api", () => ({
  isTauri: true,
  invoke: async (cmd, a = {}) => {
    chamadas.push(cmd);
    if (cmd === "read_note") return disco[a.path];
    if (cmd === "verificar_nota") return disco.__verificar ?? "igual";
    throw new Error("comando inesperado: " + cmd);
  },
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: async (_n, f) => { ouvinte = f; return () => { ouvinte = null; }; } }));
const { useObservador } = await import("../useObservador");

async function montar({ dirty = false } = {}) {
  const props = {
    cur: { current: "/v/A.md" }, dirty: { current: dirty }, refresh: vi.fn(), aplicarDoDisco: vi.fn(), manterMinha: vi.fn(), vaultRoot: "/v",
  };
  const r = renderHook(() => useObservador(props));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return { props, r };
}
const emitir = (lote) => act(async () => { ouvinte({ payload: lote }); await new Promise((ok) => setTimeout(ok, 300)); });

beforeEach(() => { ouvinte = null; chamadas.length = 0; delete disco.__verificar; });

describe("useObservador", () => {
  it("nota limpa: recarrega o texto do disco e atualiza a lista", async () => {
    const { props, r } = await montar();
    await emitir([{ path: "/v/A.md", tipo: "alterada" }]);
    expect(props.aplicarDoDisco).toHaveBeenCalledWith("novo texto");
    expect(props.refresh).toHaveBeenCalledTimes(1);
    expect(r.result.current.aviso).toBeNull();
  });

  it("nota suja: mostra a faixa e não lê nem altera o texto", async () => {
    const { props, r } = await montar({ dirty: true });
    await emitir([{ path: "/v/A.md", tipo: "alterada" }]);
    expect(props.aplicarDoDisco).not.toHaveBeenCalled();
    expect(chamadas).not.toContain("read_note");
    expect(r.result.current.aviso).toEqual({ tipo: "alterada" });
    // "Carregar a do disco" aplica o texto e some com a faixa
    await act(async () => { await r.result.current.carregarDoDisco(); });
    expect(props.aplicarDoDisco).toHaveBeenCalledWith("novo texto");
    expect(r.result.current.aviso).toBeNull();
  });

  it("'Manter a minha' libera o próximo salvamento e some com a faixa", async () => {
    const { props, r } = await montar({ dirty: true });
    await emitir([{ path: "/v/A.md", tipo: "alterada" }]);
    act(() => r.result.current.manter());
    expect(props.manterMinha).toHaveBeenCalled();
    expect(r.result.current.aviso).toBeNull();
  });

  it("mudança em outra nota só atualiza a lista", async () => {
    const { props, r } = await montar();
    await emitir([{ path: "/v/B.md", tipo: "criada" }]);
    expect(props.aplicarDoDisco).not.toHaveBeenCalled();
    expect(props.refresh).toHaveBeenCalledTimes(1);
    expect(r.result.current.aviso).toBeNull();
  });

  it("nota aberta removida: avisa sem fechar nada", async () => {
    const { props, r } = await montar();
    await emitir([{ path: "/v/A.md", tipo: "removida" }]);
    expect(r.result.current.aviso).toEqual({ tipo: "removida" });
    expect(props.aplicarDoDisco).not.toHaveBeenCalled();
  });

  it("ao ganhar o foco, confere a nota aberta e recarrega se mudou", async () => {
    const { props } = await montar();
    disco.__verificar = "alterada";
    await act(async () => { window.dispatchEvent(new Event("focus")); await new Promise((ok) => setTimeout(ok, 20)); });
    expect(props.aplicarDoDisco).toHaveBeenCalledWith("novo texto");
  });

  it("foco com a nota igual ao disco não faz nada", async () => {
    const { props } = await montar();
    await act(async () => { window.dispatchEvent(new Event("focus")); await new Promise((ok) => setTimeout(ok, 20)); });
    expect(props.aplicarDoDisco).not.toHaveBeenCalled();
  });
});
