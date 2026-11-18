// @vitest-environment jsdom
// CorrecaoPage dividida em painéis (lista, foto, transcrição, avaliação) e visão da turma: renderiza com uma nota real,
// troca de aluno, muda uma nota e abre a visão da turma.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const NOTA = `---
turma: 71
mês: março
atividade: Conto
status: andamento
---
Rubrica. Cada critério vale 0, 0,5 ou 1 ponto. Média: 6,5

## Ana
### Texto
Ela {foze|fez} tudo [palavra?] {p:|,} bem.
### Avaliação
| Critério | Nota | Comentário |
| --- | --- | --- |
| Tema | 1 | ok |
| Coesão | 0,5 | |
| **Nota final** | **1,5** | |

## Beto
### Texto
Texto do Beto.
### Avaliação
| Critério | Nota | Comentário |
| --- | --- | --- |
| Tema | 0 | |
| Coesão | | |
| **Nota final** | **0** | |
`;
const chamadas = [];
vi.mock("@/lib/api", () => ({
  isTauri: false, srcDeImagem: () => null,
  invoke: async (cmd, a) => {
    chamadas.push({ cmd, ...a });
    if (cmd === "read_note") return NOTA;
    if (cmd === "read_sidecar") return null;
    if (cmd === "save_note") return null;
    throw new Error("comando inesperado: " + cmd);
  },
}));
const { CorrecaoPage } = await import("../CorrecaoPage");

const items = [{ path: "/v/Anos/2026/Correcoes/71-Conto/Transcrições e devolutivas.md", rel: "Anos/2026/Correcoes/71-Conto/Transcrições e devolutivas.md", name: "Transcrições e devolutivas" }];

beforeEach(() => { chamadas.length = 0; globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }; });
afterEach(cleanup);

const abrir = async (props = {}) => {
  render(<CorrecaoPage items={items} onOpen={() => {}} focoPath={items[0].path} {...props} />);
  await screen.findByLabelText("Alunos");
};

describe("CorrecaoPage", () => {
  it("sem lotes mostra o estado vazio", () => {
    render(<CorrecaoPage items={[]} onOpen={() => {}} />);
    expect(screen.getByText("Nenhuma correção ainda")).toBeTruthy();
  });

  it("mostra o cabeçalho, a lista de alunos, a transcrição e a avaliação", async () => {
    await abrir();
    expect(screen.getByRole("heading", { name: "Conto" })).toBeTruthy();
    const lista = within(screen.getByLabelText("Alunos"));
    expect(lista.getByText("Ana")).toBeTruthy();
    expect(lista.getByText("Beto")).toBeTruthy();
    const transc = within(screen.getByLabelText("Transcrição"));
    expect(transc.getByText("tudo", { exact: false })).toBeTruthy();
    const aval = within(screen.getByLabelText("Avaliação"));
    expect(aval.getByText("Tema")).toBeTruthy();
    expect(aval.getByText("Coesão")).toBeTruthy();
    expect(screen.getByLabelText("Foto do manuscrito")).toBeTruthy();
  });

  it("não oferece botão para mostrar nomes", async () => {
    await abrir();
    expect(screen.queryByLabelText("Mostrar nomes")).toBeNull();
  });

  it("escolher outro aluno troca a transcrição", async () => {
    await abrir();
    fireEvent.click(within(screen.getByLabelText("Alunos")).getByText("Beto"));
    expect(within(screen.getByLabelText("Transcrição")).getByText("Texto do Beto.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Aluno anterior"));
    expect(within(screen.getByLabelText("Transcrição")).queryByText("Texto do Beto.")).toBeNull();
  });

  it("mudar a nota de um critério grava a nota na nota do lote", async () => {
    await abrir();
    const tema = screen.getByRole("radiogroup", { name: "Nota de Tema" });
    fireEvent.click(within(tema).getByRole("radio", { name: "0,5" }));
    await waitFor(() => expect(chamadas.some((c) => c.cmd === "save_note")).toBe(true));
    const salvo = chamadas.find((c) => c.cmd === "save_note");
    expect(salvo.path).toBe(items[0].path);
    expect(salvo.text).toMatch(/\| Tema \| 0,5 \|/);
  });

  it("a visão da turma mostra as estatísticas e volta para a correção", async () => {
    render(<CorrecaoPage items={items} onOpen={() => {}} focoPath={items[0].path} vistaInicial="turma" />);
    expect(await screen.findByText(/Visão da turma/)).toBeTruthy();
    expect(screen.getByText("Média")).toBeTruthy();
    expect(screen.getByText("Distribuição das notas")).toBeTruthy();
    expect(screen.getByText("Média por critério")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Voltar para a correção/ }));
    expect(await screen.findByLabelText("Alunos")).toBeTruthy();
  });
});
