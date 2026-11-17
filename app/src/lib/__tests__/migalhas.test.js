import { describe, expect, it, vi } from "vitest";
import { migalhas, rotuloDaTela, secaoAtiva } from "../migalhas";

const base = { page: "editor", rel: null, inicioModo: "hoje", ciclo: null, ciclosPasta: "", gramaticaPasta: "", aulasPasta: "", recursosAba: "textos", recursosPasta: "" };
const mk = () => ({ secao: vi.fn(), aulas: vi.fn(), recursos: vi.fn(), setCiclosPasta: vi.fn(), setGramaticaPasta: vi.fn(), setPage: vi.fn() });
const textos = (m) => m.map((x) => x.t);

describe("rotuloDaTela", () => {
  it("a tela inicial tem o rótulo do modo", () => {
    expect(rotuloDaTela("semana", "hoje")).toBe("Hoje");
    expect(rotuloDaTela("semana", "ano")).toBe("Ano");
    expect(rotuloDaTela("saude", "hoje")).toBe("Saúde do vault");
    expect(rotuloDaTela("nao-existe", "hoje")).toBe("");
  });
});

describe("migalhas das listagens", () => {
  it("Aulas: raiz clicável e pastas sem o _ inicial, cada uma levando à própria listagem", () => {
    const ir = mk();
    const m = migalhas({ ...base, page: "aulas", aulasPasta: "_novas/Crase" }, ir);
    expect(textos(m)).toEqual(["Aulas", "novas", "Crase"]);
    m[2].ir(); expect(ir.aulas).toHaveBeenCalledWith("_novas/Crase");
    m[1].ir(); expect(ir.aulas).toHaveBeenCalledWith("_novas");
  });
  it("Recursos traduz Questoes e some na aba de montar prova", () => {
    expect(textos(migalhas({ ...base, page: "recursos", recursosPasta: "Questoes/6ano" }, mk()))).toEqual(["Recursos", "Questões", "6ano"]);
    expect(textos(migalhas({ ...base, page: "recursos", recursosAba: "montar" }, mk()))).toEqual(["Recursos"]);
  });
  it("tela de ciclo mostra o título do ciclo", () => {
    expect(textos(migalhas({ ...base, page: "ciclo", ciclo: { titulo: "Crase" } }, mk()))).toEqual(["Ciclos", "Crase"]);
    expect(textos(migalhas({ ...base, page: "ciclo" }, mk()))).toEqual(["Ciclos", "Ciclo"]);
  });
  it("telas simples mostram só o rótulo", () => {
    expect(textos(migalhas({ ...base, page: "config" }, mk()))).toEqual(["Configurações"]);
  });
});

describe("migalhas de uma nota aberta", () => {
  it("sem nota: vazio", () => { expect(migalhas(base, mk())).toEqual([]); });

  it("aula do acervo: começa em Aulas (sem Acervo) e as pastas levam à listagem", () => {
    const ir = mk();
    const m = migalhas({ ...base, rel: "Acervo/Aulas/Acentuacao/Crase.md" }, ir);
    expect(textos(m)).toEqual(["Aulas", "Acentuacao", "Crase"]);
    m[0].ir(); expect(ir.aulas).toHaveBeenCalledWith("");
    m[1].ir(); expect(ir.aulas).toHaveBeenCalledWith("Acentuacao");
    expect(m[2].ir).toBeUndefined(); // a própria nota não é link
  });

  it("gramática e recursos têm a raiz própria", () => {
    const ir = mk();
    const g = migalhas({ ...base, rel: "Acervo/Gramática/Crase/Regra.md" }, ir);
    expect(textos(g)).toEqual(["Gramática", "Crase", "Regra"]);
    g[1].ir(); expect(ir.setGramaticaPasta).toHaveBeenCalledWith("Crase"); expect(ir.setPage).toHaveBeenCalledWith("gramatica");
    const r = migalhas({ ...base, rel: "Acervo/Questoes/6ano/Banco.md" }, ir);
    expect(textos(r)).toEqual(["Questões", "6ano", "Banco"]);
    r[0].ir(); expect(ir.recursos).toHaveBeenCalledWith("Questoes");
  });

  it("ciclo do acervo: 'Ciclos' leva à tela Ciclos; semanas do ano têm tela própria", () => {
    const ir = mk();
    const c = migalhas({ ...base, rel: "Acervo/Ciclos/Crase.md" }, ir);
    expect(textos(c)).toEqual(["Ciclos", "Crase"]);
    c[0].ir(); expect(ir.secao).toHaveBeenCalledWith("ciclos");
    const s = migalhas({ ...base, rel: "Anos/2026/Semanas/Semana 1.md" }, ir);
    expect(textos(s)).toEqual(["Anos", "2026", "Semanas", "Semana 1"]);
    s[2].ir(); expect(ir.secao).toHaveBeenCalledWith("semana");
  });
});

describe("secaoAtiva", () => {
  it("pela tela", () => {
    expect(secaoAtiva("semana")).toBe("hoje");
    expect(secaoAtiva("ciclo")).toBe("ciclos");
    expect(secaoAtiva("outra")).toBeUndefined();
  });
  it("pela nota aberta no editor", () => {
    expect(secaoAtiva("editor", null)).toBeNull();
    expect(secaoAtiva("editor", "Acervo/Aulas/x.md")).toBe("aulas");
    expect(secaoAtiva("editor", "Acervo/Gramatica/x.md")).toBe("gramatica");
    expect(secaoAtiva("editor", "Acervo/Textos/x.md")).toBe("recursos");
    expect(secaoAtiva("editor", "Anos/2026/Provas/p.md")).toBe("recursos");
    expect(secaoAtiva("editor", "Anos/2026/Correcoes/c/x.md")).toBe("correcao");
    expect(secaoAtiva("editor", "Outra/x.md")).toBeNull();
  });
});
