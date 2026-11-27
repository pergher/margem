// @vitest-environment jsdom
// Listagem (Explorador): desmarcar com Esc e clique fora, ações no botão direito, Ctrl+Z e botão de filtros.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act, within } from "@testing-library/react";
import { Explorador } from "@/components/Explorador";

const itens = [
  { id: "/v/A.md", path: "/v/A.md", nome: "Alfa", pasta: "", tipo_: "aula" },
  { id: "/v/B.md", path: "/v/B.md", nome: "Beta", pasta: "", tipo_: "texto" },
  { id: "/v/C.md", path: "/v/C.md", nome: "Gama", pasta: "", tipo_: "texto" },
];
const montar = (props = {}) => render(
  <Explorador chave="teste" titulo="Documentos" itens={itens} onOpen={() => {}} onAtualizar={() => {}} onDelete={() => Promise.resolve()}
    filtros={[{ id: "tipo", nome: "Tipo", opcoes: [{ id: "aula", nome: "Aula" }, { id: "texto", nome: "Texto" }], de: (i) => [i.tipo_] }]} {...props} />,
);
const opcao = (nome) => lista().getByRole("option", { name: new RegExp(nome) });
const lista = () => within(screen.getByRole("listbox"));
const marcadas = () => lista().queryAllByRole("option", { selected: true }).length;
const marcarDuas = () => { fireEvent.click(opcao("Alfa")); fireEvent.click(opcao("Beta"), { ctrlKey: true }); };

afterEach(() => { cleanup(); localStorage.clear(); });

describe("Explorador: seleção", () => {
  it("clicar fora da lista desmarca; Esc também, mesmo com o foco fora dos itens", () => {
    montar();
    marcarDuas(); expect(marcadas()).toBe(2);
    fireEvent.click(screen.getByRole("heading", { name: "Documentos" })); expect(marcadas()).toBe(0);
    marcarDuas(); fireEvent.click(screen.getByLabelText("Buscar")); expect(marcadas()).toBe(0);
    marcarDuas(); fireEvent.keyDown(document.body, { key: "Escape" }); expect(marcadas()).toBe(0);
  });

  it("sem barra de ações; o botão direito sobre as marcadas traz as ações em lote e mantém a seleção", () => {
    montar();
    marcarDuas();
    expect(screen.queryByRole("toolbar")).toBeNull();
    fireEvent.contextMenu(opcao("Beta"));
    expect(screen.getByRole("menuitem", { name: /Excluir 2 itens/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Mudar status/ })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" }); // fecha só o menu
    expect(screen.queryByRole("menu")).toBeNull(); expect(marcadas()).toBe(2);
    fireEvent.contextMenu(opcao("Gama")); // fora das marcadas: só este item
    expect(marcadas()).toBe(1);
    expect(screen.getByRole("menuitem", { name: /^Excluir/ }).textContent).not.toMatch(/itens/);
  });
});

describe("Explorador: Ctrl+Z", () => {
  it("devolve o nome antigo; dentro de um campo de texto não faz nada", async () => {
    const onRename = vi.fn(async (_p, nome) => `/v/${nome}.md`);
    montar({ onRename });
    fireEvent.keyDown(opcao("Alfa"), { key: "F2" });
    const campo = screen.getByLabelText("Nome");
    fireEvent.change(campo, { target: { value: "Delta" } });
    await act(async () => { fireEvent.keyDown(campo, { key: "Enter" }); });
    await act(async () => { fireEvent.keyDown(screen.getByLabelText("Buscar"), { key: "z", ctrlKey: true }); });
    expect(onRename).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.keyDown(document.body, { key: "z", ctrlKey: true }); });
    expect(onRename).toHaveBeenLastCalledWith("/v/Delta.md", "Alfa");
    expect(screen.getByRole("status").textContent).toMatch(/Desfeito: renomear/);
    await act(async () => { fireEvent.keyDown(document.body, { key: "z", ctrlKey: true }); });
    expect(onRename).toHaveBeenCalledTimes(2);
  });
});

describe("Explorador: filtros", () => {
  it("ficam no botão de filtros, que conta os ligados; Esc fecha o painel", () => {
    montar();
    expect(screen.queryByRole("button", { name: "Aula" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    fireEvent.click(screen.getByRole("button", { name: "Texto" }));
    expect(lista().getAllByRole("option")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Filtros (1 ligado)" })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/ }));
    expect(lista().getAllByRole("option")).toHaveLength(3);
  });
});
