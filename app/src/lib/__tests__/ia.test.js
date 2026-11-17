// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { aplicarEvento } from "../ia";
import { ACOES, acoesPara } from "../iaAcoes";

describe("aplicarEvento", () => {
  const base = [{ papel: "usuario", itens: [{ tipo: "texto", texto: "oi" }] }, { papel: "ia", itens: [] }];
  it("junta pedaços de texto seguidos e separa o que vem depois de uma ferramenta", () => {
    let m = aplicarEvento(base, { tipo: "texto", texto: "Vou " });
    m = aplicarEvento(m, { tipo: "texto", texto: "buscar." });
    m = aplicarEvento(m, { tipo: "ferramenta", nome: "search_notes", resumo: "Buscou notas: \"x\"" });
    m = aplicarEvento(m, { tipo: "texto", texto: "Achei." });
    m = aplicarEvento(m, { tipo: "proposta", id: 3, resumo: "mais apoio", nota: "/v/A.md", nova: null });
    expect(m[1].itens.map((i) => i.tipo)).toEqual(["texto", "ferramenta", "texto", "proposta"]);
    expect(m[1].itens[0].texto).toBe("Vou buscar.");
    expect(m[1].itens[3]).toMatchObject({ id: 3, resumo: "mais apoio" });
    expect(base[1].itens).toHaveLength(0); // não altera o estado anterior
  });
  it("uso e fim não mexem nas mensagens; erro e aviso viram itens", () => {
    expect(aplicarEvento(base, { tipo: "uso", tokens_in: 1, tokens_out: 2 })).toBe(base);
    expect(aplicarEvento(base, { tipo: "fim", motivo: "fim" })).toBe(base);
    expect(aplicarEvento(base, { tipo: "erro", msg: "falhou" })[1].itens[0]).toEqual({ tipo: "erro", msg: "falhou" });
    expect(aplicarEvento(base, { tipo: "aviso", msg: "nota protegida" })[1].itens[0].tipo).toBe("aviso");
  });
});

describe("ações rápidas", () => {
  it("aula e banco ganham as ações de adaptação; a da seleção vale para qualquer tipo", () => {
    expect(acoesPara("aula").map((a) => a.id)).toEqual(["mais-apoio", "simplificar", "cinco-questoes", "adaptar-selecao"]);
    expect(acoesPara("texto").map((a) => a.id)).toEqual(["adaptar-selecao"]);
    expect(ACOES.every((a) => a.prompt.includes("propor_edicao"))).toBe(true);
  });
});

describe("useIA", () => {
  it("manda a nota aberta só quando 'incluir' está ligado e acumula a resposta", async () => {
    const enviados = [];
    vi.resetModules();
    vi.doMock("@/lib/ia", async (orig) => ({
      ...(await orig()),
      iaEnviar: async (id, texto, contexto, onEvento) => { enviados.push({ texto, contexto }); onEvento({ tipo: "texto", texto: "ola" }); onEvento({ tipo: "uso", tokens_in: 5, tokens_out: 2 }); },
      iaCancelar: async () => {}, iaLimpar: async () => {},
    }));
    const { useIA } = await import("../useIA");
    const { result } = renderHook(() => useIA({ getContexto: () => ({ path: "/v/A.md", texto: "t", selecao: "" }) }));
    await act(async () => { await result.current.enviar("pergunta", { incluirNota: true }); });
    await act(async () => { await result.current.enviar("outra", { incluirNota: false }); });
    expect(enviados[0].contexto).toMatchObject({ path: "/v/A.md" });
    expect(enviados[1].contexto).toBeNull();
    expect(result.current.msgs[1].itens[0].texto).toBe("ola");
    expect(result.current.uso).toEqual({ entrada: 5, saida: 2 });
    expect(result.current.ocupado).toBe(false);
    act(() => result.current.nova());
    expect(result.current.msgs).toEqual([]);
    vi.doUnmock("@/lib/ia");
  });
});
