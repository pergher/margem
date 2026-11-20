// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const invoke = vi.fn();
vi.mock("@/lib/api", () => ({ isTauri: true, invoke: (...a) => invoke(...a) }));
const { useBandeja, bandejaPronta, temBandeja } = await import("../bandeja");
const ua = (v) => Object.defineProperty(navigator, "userAgent", { value: v, configurable: true });

afterEach(() => { invoke.mockReset(); });

describe("modo bandeja", () => {
  it("só existe no Windows", () => {
    ua("Mozilla/5.0 (X11; Linux x86_64)"); expect(temBandeja()).toBe(false);
    ua("Mozilla/5.0 (Windows NT 10.0)"); expect(temBandeja()).toBe(true);
  });
  it("só fica pronta depois de o Rust confirmar o ícone", async () => {
    ua("Mozilla/5.0 (Windows NT 10.0)");
    invoke.mockResolvedValue(undefined);
    const { result } = renderHook(({ l }) => useBandeja(l), { initialProps: { l: true } });
    await waitFor(() => expect(bandejaPronta()).toBe(true));
    expect(invoke).toHaveBeenCalledWith("definir_bandeja", { ligada: true });
    expect(result.current).toBe("");
  });
  it("se o ícone falha, não fica pronta (a janela não pode esconder) e mostra o erro", async () => {
    ua("Mozilla/5.0 (Windows NT 10.0)");
    invoke.mockRejectedValue("sem ícone");
    const { result } = renderHook(() => useBandeja(true));
    await waitFor(() => expect(result.current).toBe("sem ícone"));
    expect(bandejaPronta()).toBe(false);
  });
  it("desligar tira o ícone e a janela volta a fechar de verdade", async () => {
    ua("Mozilla/5.0 (Windows NT 10.0)");
    invoke.mockResolvedValue(undefined);
    const { rerender } = renderHook(({ l }) => useBandeja(l), { initialProps: { l: true } });
    await waitFor(() => expect(bandejaPronta()).toBe(true));
    rerender({ l: false });
    await waitFor(() => expect(bandejaPronta()).toBe(false));
    expect(invoke).toHaveBeenLastCalledWith("definir_bandeja", { ligada: false });
  });
});
