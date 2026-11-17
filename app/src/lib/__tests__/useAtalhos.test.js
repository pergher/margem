// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ invoke: async () => null, isTauri: false }));
vi.mock("@/components/ShortcutsPage", () => ({ capturing: false }));
const { useAtalhos } = await import("../useAtalhos");
const { handlers } = await import("../shortcuts");

function montar(extra = {}) {
  const p = {
    overrides: {}, go: vi.fn(), save: vi.fn(), page: "editor", cur: { current: "/v/A.md" }, ed: { current: { insertTable: vi.fn() } }, foco: false,
    setSearchOpen: vi.fn(), setPaletteOpen: vi.fn(), setShowSide: vi.fn(), setFoco: vi.fn(), setNumeros: vi.fn(), setZoom: vi.fn(), ...extra,
  };
  const r = renderHook((props) => useAtalhos(props), { initialProps: p });
  return { p, ...r };
}
const tecla = (init, alvo = window) => { const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }); alvo.dispatchEvent(e); return e; };
afterEach(() => { cleanup(); for (const k of Object.keys(handlers)) delete handlers[k]; });

describe("useAtalhos", () => {
  it("Ctrl+S salva, Ctrl+K busca, Ctrl+P abre a paleta, e o navegador não age", () => {
    const { p } = montar();
    expect(tecla({ key: "s", ctrlKey: true }).defaultPrevented).toBe(true);
    tecla({ key: "k", ctrlKey: true }); tecla({ key: "p", ctrlKey: true });
    expect(p.save).toHaveBeenCalledTimes(1);
    expect(p.setSearchOpen).toHaveBeenCalledWith(true);
    expect(p.setPaletteOpen).toHaveBeenCalledWith(true);
  });

  it("Alt+setas voltam e avançam usando o `go` mais recente (sem reinstalar os ouvintes)", () => {
    const { p, rerender } = montar();
    const go2 = vi.fn();
    rerender({ ...p, go: go2 });
    tecla({ key: "ArrowLeft", altKey: true }); tecla({ key: "ArrowRight", altKey: true });
    expect(go2.mock.calls).toEqual([[-1], [1]]);
    expect(p.go).not.toHaveBeenCalled();
  });

  it("Ctrl+Alt+T só insere tabela no editor com nota aberta", () => {
    const a = montar();
    tecla({ key: "t", ctrlKey: true, altKey: true });
    expect(a.p.ed.current.insertTable).toHaveBeenCalledTimes(1);
    a.unmount();
    const b = montar({ page: "semana" });
    tecla({ key: "t", ctrlKey: true, altKey: true });
    expect(b.p.ed.current.insertTable).not.toHaveBeenCalled();
  });

  it("zoom: Ctrl+= aumenta em passos de 0,1, respeitando os limites, e Ctrl+0 restaura", () => {
    const { p } = montar();
    tecla({ key: "=", ctrlKey: true });
    const aumenta = p.setZoom.mock.calls[0][0];
    expect(aumenta(1)).toBe(1.1);
    expect(aumenta(2)).toBe(2);
    tecla({ key: "-", ctrlKey: true });
    expect(p.setZoom.mock.calls[1][0](0.7)).toBe(0.7);
    tecla({ key: "0", ctrlKey: true });
    expect(p.setZoom).toHaveBeenLastCalledWith(1);
  });

  it("tecla simples só vale fora de campos de texto e com a tela registrada", () => {
    const j = vi.fn(); handlers.corrNext = j;
    montar();
    tecla({ key: "j" });
    expect(j).toHaveBeenCalledTimes(1);
    const campo = document.createElement("input"); document.body.append(campo);
    tecla({ key: "j" }, campo);
    expect(j).toHaveBeenCalledTimes(1);
    delete handlers.corrNext;
    expect(tecla({ key: "k" }).defaultPrevented).toBe(false); // sem handler: deixa passar
  });

  it("Esc sai do modo foco só enquanto ele está ligado", () => {
    const off = montar({ foco: false });
    tecla({ key: "Escape" });
    expect(off.p.setFoco).not.toHaveBeenCalled();
    const on = montar({ foco: true });
    tecla({ key: "Escape" });
    expect(on.p.setFoco).toHaveBeenCalledWith(false);
  });

  it("depois de desmontar, nenhum atalho age", () => {
    const { p, unmount } = montar();
    unmount();
    tecla({ key: "s", ctrlKey: true });
    expect(p.save).not.toHaveBeenCalled();
  });
});
