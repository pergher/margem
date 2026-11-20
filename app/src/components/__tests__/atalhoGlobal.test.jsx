// @vitest-environment jsdom
// Página de atalhos: o botão da captura rápida fora do app (só aparece no app do computador).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ isTauri: true, invoke: vi.fn() }));
const ua = (v) => Object.defineProperty(navigator, "userAgent", { value: v, configurable: true });
const { ShortcutsPage } = await import("../ShortcutsPage");

afterEach(cleanup);
const base = { overrides: {}, setOverrides: () => {} };

describe("ShortcutsPage — atalho global", () => {
  it("mostra a opção ligada e liga/desliga", () => {
    const setLigado = vi.fn();
    render(<ShortcutsPage {...base} atalhoGlobal={{ ligado: true, setLigado, erro: "" }} />);
    const caixa = screen.getByRole("checkbox");
    expect(caixa.checked).toBe(true);
    fireEvent.click(caixa);
    expect(setLigado).toHaveBeenCalledWith(false);
  });
  it("mostra o erro do sistema quando a combinação não pôde ser registrada", () => {
    render(<ShortcutsPage {...base} atalhoGlobal={{ ligado: true, setLigado: () => {}, erro: "combinação já usada" }} />);
    expect(screen.getByText(/Não deu para ativar: combinação já usada/)).toBeTruthy();
  });
  it("desligado, não mostra erro", () => {
    render(<ShortcutsPage {...base} atalhoGlobal={{ ligado: false, setLigado: () => {}, erro: "x" }} />);
    expect(screen.queryByText(/Não deu para ativar/)).toBeNull();
  });
  it("no Windows mostra a opção da bandeja e a liga", () => {
    ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    const setBandeja = vi.fn();
    render(<ShortcutsPage {...base} atalhoGlobal={{ ligado: true, setLigado: () => {}, erro: "", bandeja: false, setBandeja, erroBandeja: "" }} />);
    fireEvent.click(screen.getByLabelText(/Manter o Margem na bandeja/));
    expect(setBandeja).toHaveBeenCalledWith(true);
  });
  it("fora do Windows não oferece a bandeja", () => {
    ua("Mozilla/5.0 (X11; Linux x86_64)");
    render(<ShortcutsPage {...base} atalhoGlobal={{ ligado: true, setLigado: () => {}, erro: "", bandeja: false, setBandeja: () => {}, erroBandeja: "" }} />);
    expect(screen.queryByLabelText(/Manter o Margem na bandeja/)).toBeNull();
  });
});
