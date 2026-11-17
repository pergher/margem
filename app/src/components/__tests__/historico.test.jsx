// @vitest-environment jsdom
// Painel Histórico: listar versões, comparar com o texto atual e restaurar (o app guarda o texto atual antes, para desfazer).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const chamadas = [];
const versoes = { 111: "# A\n\nversão antiga", 222: "# A\n\ntexto atual" };
vi.mock("@/lib/api", () => ({
  invoke: async (cmd, a) => {
    chamadas.push({ cmd, ...a });
    if (cmd === "list_history") return [{ id: "222", ts: 1700000100, bytes: 15 }, { id: "111", ts: 1700000000, bytes: 18 }];
    if (cmd === "read_version") return versoes[a.id];
    if (cmd === "restore_version") return versoes[a.id];
    throw new Error("comando inesperado: " + cmd);
  },
}));
const { Historico } = await import("../RightPanel");

beforeEach(() => {
  chamadas.length = 0;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }; // o ScrollArea do Radix usa
});
afterEach(cleanup);

const abrir = async (onRestore = vi.fn()) => {
  render(<Historico path="/v/A.md" text={"# A\n\ntexto atual"} onRestore={onRestore} tick={0} />);
  const itens = await screen.findAllByText(/B$/);
  return { onRestore, itens };
};

describe("Histórico", () => {
  it("sem arquivo aberto pede para abrir um", () => {
    render(<Historico path={null} text="" onRestore={() => {}} tick={0} />);
    expect(screen.getByText("Abra um arquivo.")).toBeTruthy();
    expect(chamadas).toHaveLength(0);
  });

  it("lista as versões do arquivo", async () => {
    const { itens } = await abrir();
    expect(chamadas[0]).toMatchObject({ cmd: "list_history", path: "/v/A.md" });
    expect(itens.map((i) => i.textContent)).toEqual(["15 B", "18 B"]);
  });

  it("clicar numa versão mostra a diferença e Restaurar devolve o texto antigo", async () => {
    const { onRestore, itens } = await abrir();
    fireEvent.click(itens[1].closest("button")); // versão 111
    await screen.findByText(/→ agora/);
    expect(screen.getByText(/^- versão antiga/)).toBeTruthy(); // linha removida (vermelho)
    expect(screen.getByText(/^\+ texto atual/)).toBeTruthy();   // linha adicionada (verde)
    fireEvent.click(screen.getByText("Restaurar"));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith("# A\n\nversão antiga"));
    expect(chamadas.at(-1)).toMatchObject({ cmd: "restore_version", path: "/v/A.md", id: "111" });
  });

  it("versão igual ao texto atual não pode ser restaurada", async () => {
    const { itens } = await abrir();
    fireEvent.click(itens[0].closest("button")); // versão 222 = texto atual
    await screen.findByText("Igual ao texto atual");
    expect(screen.getByText("Restaurar").disabled).toBe(true);
  });
});
