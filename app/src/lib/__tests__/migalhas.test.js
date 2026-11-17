import { describe, expect, it, vi } from "vitest";
import { migalhas, rotuloDaTela, secaoAtiva } from "../migalhas";

const base = { page: "editor", rel: null, anoAba: "semana", ciclo: null, documentosPasta: "", documentosAba: "" };
const mk = () => ({ secao: vi.fn(), documentos: vi.fn(), ano: vi.fn() });
const textos = (m) => m.map((x) => x.t);

describe("rotuloDaTela", () => {
  it("cada tela tem o seu rótulo", () => {
    expect(rotuloDaTela("inicio")).toBe("Hoje");
    expect(rotuloDaTela("saude")).toBe("Saúde do vault");
    expect(rotuloDaTela("nao-existe")).toBe("");
  });
});

describe("migalhas das listagens", () => {
  it("Documentos: raiz clicável, pastas sem o _ inicial e Questoes traduzida, cada uma levando à própria listagem", () => {
    const ir = mk();
    const m = migalhas({ ...base, page: "documentos", documentosPasta: "Aulas/_novas/Crase" }, ir);
    expect(textos(m)).toEqual(["Documentos", "Aulas", "novas", "Crase"]);
    m[3].ir(); expect(ir.documentos).toHaveBeenCalledWith("Aulas/_novas/Crase");
    m[2].ir(); expect(ir.documentos).toHaveBeenCalledWith("Aulas/_novas");
    expect(textos(migalhas({ ...base, page: "documentos", documentosPasta: "Questoes/6ano" }, mk()))).toEqual(["Documentos", "Questões", "6ano"]);
  });
  it("na tela de montar prova, só o rótulo Documentos", () => {
    expect(textos(migalhas({ ...base, page: "documentos", documentosAba: "montar" }, mk()))).toEqual(["Documentos"]);
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

  it("documento do acervo: começa em Documentos (sem Acervo) e as pastas levam à listagem", () => {
    const ir = mk();
    const m = migalhas({ ...base, rel: "Acervo/Aulas/Acentuacao/Crase.md" }, ir);
    expect(textos(m)).toEqual(["Documentos", "Aulas", "Acentuacao", "Crase"]);
    m[0].ir(); expect(ir.documentos).toHaveBeenCalledWith("");
    m[1].ir(); expect(ir.documentos).toHaveBeenCalledWith("Aulas");
    m[2].ir(); expect(ir.documentos).toHaveBeenCalledWith("Aulas/Acentuacao");
    expect(m[3].ir).toBeUndefined(); // a própria nota não é link
    const r = migalhas({ ...base, rel: "Acervo/Questoes/6ano/Banco.md" }, ir);
    expect(textos(r)).toEqual(["Documentos", "Questões", "6ano", "Banco"]);
    r[1].ir(); expect(ir.documentos).toHaveBeenCalledWith("Questoes");
  });

  it("ciclo do acervo é um documento; as seções do ano levam às abas do Ano", () => {
    const ir = mk();
    const c = migalhas({ ...base, rel: "Acervo/Ciclos/Crase.md" }, ir);
    expect(textos(c)).toEqual(["Documentos", "Ciclos", "Crase"]);
    c[1].ir(); expect(ir.documentos).toHaveBeenCalledWith("Ciclos");
    const s = migalhas({ ...base, rel: "Anos/2026/Semanas/Semana 1.md" }, ir);
    expect(textos(s)).toEqual(["Anos", "2026", "Semanas", "Semana 1"]);
    s[2].ir(); expect(ir.ano).toHaveBeenCalledWith("semana");
    const p = migalhas({ ...base, rel: "Anos/2026/Correcoes/c/x.md" }, ir);
    p[2].ir(); expect(ir.ano).toHaveBeenCalledWith("prod");
  });
  it("a página Ano mostra a aba aberta", () => {
    expect(textos(migalhas({ ...base, page: "ano", anoAba: "diario" }, mk()))).toEqual(["Ano", "Diário"]);
    expect(textos(migalhas({ ...base, page: "ano", anoAba: "plano" }, mk()))).toEqual(["Ano", "Planejamento"]);
  });
});

describe("secaoAtiva", () => {
  it("pela tela", () => {
    expect(secaoAtiva("inicio")).toBe("hoje");
    expect(secaoAtiva("ano")).toBe("ano");
    expect(secaoAtiva("ciclo")).toBe("documentos");
    expect(secaoAtiva("outra")).toBeUndefined();
  });
  it("pela nota aberta no editor", () => {
    expect(secaoAtiva("editor", null)).toBeNull();
    expect(secaoAtiva("editor", "Acervo/Aulas/x.md")).toBe("documentos");
    expect(secaoAtiva("editor", "Acervo/Gramatica/x.md")).toBe("documentos");
    expect(secaoAtiva("editor", "Acervo/Textos/x.md")).toBe("documentos");
    expect(secaoAtiva("editor", "Acervo/Ciclos/x.md")).toBe("documentos");
    expect(secaoAtiva("editor", "Anos/2026/Provas/p.md")).toBe("documentos");
    expect(secaoAtiva("editor", "Anos/2026/Correcoes/c/x.md")).toBe("ano");
    expect(secaoAtiva("editor", "Anos/2026/Semanas/s.md")).toBe("ano");
    expect(secaoAtiva("editor", "Outra/x.md")).toBeNull();
  });
});
