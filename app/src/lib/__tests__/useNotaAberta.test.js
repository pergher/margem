// @vitest-environment jsdom
// Fluxo de abrir, editar e salvar a nota: salvamento, autosave, conflito (sobrescrever / carregar o disco) e erro de disco.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const disco = {};          // caminho -> texto "no disco"
const chamadas = [];       // registro dos comandos Tauri
let conflitos = [];        // mensagens de erro a lançar nas próximas gravações sem `force`
let falhaDeDisco = null;
vi.mock("@/lib/api", () => ({
  isTauri: false,
  invoke: async (cmd, a = {}) => {
    chamadas.push({ cmd, ...a });
    if (cmd === "read_note") return disco[a.path];
    if (cmd === "note_info") return { issues: [], backlinks: [] };
    if (cmd === "save_note") {
      // o Tauri rejeita com a própria string do erro, não com um Error
      if (!a.force && falhaDeDisco) throw falhaDeDisco;
      if (!a.force && conflitos.length) throw conflitos.shift();
      disco[a.path] = a.text; return null;
    }
    throw new Error("comando inesperado: " + cmd);
  },
}));
vi.mock("@/components/Outline", () => ({ headingsOf: (t) => t.split("\n").filter((l) => l.startsWith("#")) }));
const { useNotaAberta } = await import("../useNotaAberta");

function montar() {
  const editor = { texto: "", getText() { return this.texto; }, setText(t) { this.texto = t; } };
  const ed = { current: editor };
  const status = [];
  const { result } = renderHook(() => useNotaAberta({ ed, setStatus: (s) => status.push(s), setPage: () => {}, setItems: undefined }));
  return { editor, status, result, ultimo: () => status[status.length - 1] };
}
const gravacoes = () => chamadas.filter((c) => c.cmd === "save_note");

beforeEach(() => {
  for (const k of Object.keys(disco)) delete disco[k];
  chamadas.length = 0; conflitos = []; falhaDeDisco = null;
  disco["/v/A.md"] = "# A\n\ntexto";
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

/** Abre a nota e simula a digitação de `novo`. */
async function abrirEEditar(m, novo) {
  await act(async () => { await m.result.current.load("/v/A.md"); });
  m.editor.texto = novo;
  act(() => m.result.current.onChange({ toString: () => novo }));
}

describe("abrir e salvar", () => {
  it("abrir lê a nota, mostra no editor e deixa o estado limpo", async () => {
    const m = montar();
    await act(async () => { await m.result.current.load("/v/A.md"); });
    expect(m.editor.texto).toBe("# A\n\ntexto");
    expect(m.result.current.current).toBe("/v/A.md");
    expect(m.result.current.dirty.current).toBe(false);
    expect(m.result.current.words).toBe(3);
  });

  it("editar e salvar grava o texto e mostra 'Salvo às'", async () => {
    const m = montar();
    await abrirEEditar(m, "# A\n\nnovo texto");
    expect(m.ultimo()).toBe("Editando…");
    await act(async () => { await m.result.current.save(); });
    expect(disco["/v/A.md"]).toBe("# A\n\nnovo texto");
    expect(m.ultimo()).toMatch(/^Salvo às /);
    expect(m.result.current.dirty.current).toBe(false);
  });

  it("sem alteração, salvar não chama o disco", async () => {
    const m = montar();
    await act(async () => { await m.result.current.load("/v/A.md"); });
    await act(async () => { await m.result.current.save(); });
    expect(gravacoes()).toHaveLength(0);
  });

  it("o autosave grava sozinho depois de 800 ms", async () => {
    vi.useFakeTimers();
    const m = montar();
    await abrirEEditar(m, "# A\n\nauto");
    expect(gravacoes()).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(gravacoes()).toHaveLength(1);
    expect(disco["/v/A.md"]).toBe("# A\n\nauto");
  });

  it("erro de disco mantém a nota como não salva e avisa", async () => {
    const m = montar();
    await abrirEEditar(m, "# A\n\nx");
    falhaDeDisco = "disco cheio";
    vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => { await m.result.current.save(); });
    expect(m.ultimo()).toContain("Erro ao salvar");
    expect(m.result.current.dirty.current).toBe(true);
    expect(disco["/v/A.md"]).toBe("# A\n\ntexto");
  });
});

describe("conflito com o disco", () => {
  const MSG = "conflito: o arquivo foi alterado fora do Margem desde a última leitura";

  it("OK sobrescreve com `force` e o que estava no editor vence", async () => {
    const m = montar();
    await abrirEEditar(m, "# A\n\nminha versão");
    conflitos = [MSG];
    const conf = vi.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => { await m.result.current.save(); });
    expect(conf.mock.calls[0][0]).toContain("alterada fora do Margem");
    expect(gravacoes().map((g) => !!g.force)).toEqual([false, true]);
    expect(disco["/v/A.md"]).toBe("# A\n\nminha versão");
    expect(m.ultimo()).toMatch(/^Salvo às /);
  });

  it("Cancelar carrega a versão do disco e descarta o que foi digitado", async () => {
    const m = montar();
    await abrirEEditar(m, "# A\n\nminha versão");
    disco["/v/A.md"] = "# A\n\nversão do drive";
    conflitos = [MSG];
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await act(async () => { await m.result.current.save(); });
    expect(gravacoes()).toHaveLength(1); // nenhuma gravação forçada
    expect(m.editor.texto).toBe("# A\n\nversão do drive");
    expect(m.ultimo()).toBe("Carregada a versão do disco");
    expect(m.result.current.dirty.current).toBe(false);
  });

  it("conflito detectado no segundo momento (durante a gravação) tem mensagem própria", async () => {
    const m = montar();
    await abrirEEditar(m, "# A\n\nx");
    conflitos = ["conflito: o arquivo foi alterado durante a gravação (sincronizador?); nada foi gravado"];
    const conf = vi.spyOn(window, "confirm").mockReturnValue(false);
    await act(async () => { await m.result.current.save(); });
    expect(conf.mock.calls[0][0]).toContain("no exato momento de salvar");
  });
});
