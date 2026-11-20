// @vitest-environment jsdom
// Página de atalhos: o botão da captura rápida fora do app (só aparece no app do computador).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ isTauri: true, invoke: vi.fn() }));
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
});
