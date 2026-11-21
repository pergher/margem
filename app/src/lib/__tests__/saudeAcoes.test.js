import { describe, it, expect } from "vitest";
import { planejar, valorCorrigido, tipoSugerido } from "../saudeAcoes";

const nota = (fm, corpo = "# T\n") => `---\n${fm}\n---\n${corpo}`;
const it0 = { rel: "Acervo/Aulas/Crase.md", name: "Crase" };

describe("valorCorrigido", () => {
  it("normaliza status por sinônimo, sem acento e maiúscula", () => {
    expect(valorCorrigido("status", "Em andamento")).toBe("andamento");
    expect(valorCorrigido("status", "Concluído")).toBe("finalizado");
    expect(valorCorrigido("status", "Não iniciado")).toBe("pendente");
    expect(valorCorrigido("status", "talvez")).toBeNull();
  });
  it("ano e trimestre aceitam 7º, 7º ano e 1º trim.", () => {
    expect(valorCorrigido("ano", "7º")).toBe("7");
    expect(valorCorrigido("ano", "8º ano")).toBe("8");
    expect(valorCorrigido("ano", "10")).toBeNull();
    expect(valorCorrigido("trimestre", "2º")).toBe("2");
    expect(valorCorrigido("trimestre", "4")).toBeNull();
  });
  it("turma só com dois dígitos; transcricao por sinônimo", () => {
    expect(valorCorrigido("turma", "61")).toBe("61");
    expect(valorCorrigido("turma", "6A")).toBeNull();
    expect(valorCorrigido("transcricao", "Aprovado")).toBe("aprovada");
    expect(valorCorrigido("transcricao", "revisar")).toBe("aguardando-revisao");
  });
});

describe("planejar", () => {
  it("sem-tipo e tipo-desconhecido: pega o tipo da pasta", () => {
    const p = planejar({ code: "sem-tipo", msg: "" }, it0, nota("ano: 7"));
    expect(p.novo).toContain("tipo: aula");
    expect(planejar({ code: "tipo-desconhecido", msg: "" }, it0, nota("tipo: aulinha")).novo).toContain("tipo: aula");
    expect(planejar({ code: "tipo-desconhecido", msg: "" }, it0, nota("tipo: aula"))).toBeNull(); // nada a mudar
    expect(planejar({ code: "sem-tipo", msg: "" }, { rel: "Solta.md", name: "Solta" }, nota("ano: 7"))).toBeNull(); // pasta não indica o tipo
  });
  it("campo-obsoleto: tira turmas (em linha ou em lista de várias linhas)", () => {
    const x = { code: "campo-obsoleto", msg: "`turmas` não pertence mais à aula" };
    expect(planejar(x, it0, nota('tipo: aula\nturmas: ["61"]\nano: 7')).novo).toBe(nota("tipo: aula\nano: 7"));
    expect(planejar(x, it0, nota("tipo: aula\nturmas:\n  - \"61\"\n  - \"62\"\nano: 7")).novo).toBe(nota("tipo: aula\nano: 7"));
  });
  it("marca-pendente: transcrição aprovada volta a aguardar revisão", () => {
    const x = { code: "marca-pendente", msg: "[x?] sem decisão" };
    expect(planejar(x, it0, nota("tipo: correcao\ntranscricao: aprovada")).novo).toContain("transcricao: aguardando-revisao");
    expect(planejar(x, it0, nota("tipo: correcao\ntranscricao: pendente"))).toBeNull();
  });
  it("valor-invalido: status, ano, turma (sempre entre aspas) e turmas como número", () => {
    expect(planejar({ code: "valor-invalido", msg: 'status String("Em andamento") fora' }, it0, nota("status: Em andamento")).novo).toContain("status: andamento");
    expect(planejar({ code: "valor-invalido", msg: "ano x deve ser" }, it0, nota('ano: "7º"')).novo).toContain("ano: 7");
    const ano = (t) => planejar({ code: "valor-invalido", msg: "ano x deve ser" }, it0, nota(t));
    expect(ano("ano: [7º, 6º]").novo).toContain("ano: [6, 7]"); // lista com valores fora do formato
    expect(ano('ano: "6, 7"').novo).toContain("ano: [6, 7]"); // texto com vários anos
    expect(ano("ano: [6, 6º]").novo).toContain("ano: 6"); // repetição some
    expect(ano("ano: [6, 10]")).toBeNull(); // sem correção segura
    expect(planejar({ code: "valor-invalido", msg: "turma x deve ser" }, it0, nota("turma: 61")).novo).toContain('turma: "61"');
    expect(planejar({ code: "valor-invalido", msg: "turmas deve ser" }, it0, nota("turmas: [61, 62]")).novo).toContain('turmas: ["61", "62"]');
    expect(planejar({ code: "valor-invalido", msg: "status x fora" }, it0, nota("status: talvez"))).toBeNull(); // sem correção segura
  });
  it("outros códigos não têm correção automática", () => {
    expect(planejar({ code: "link-quebrado", msg: "[[x]]" }, it0, nota("tipo: aula"))).toBeNull();
  });
});

describe("tipoSugerido", () => {
  it("segue a pasta", () => {
    expect(tipoSugerido("Anos/2026/Correcoes/61-Marco.md", "61-Marco")).toBe("correcao");
    expect(tipoSugerido("Anos/2026/Planejamento/001 Ciclo.md", "001 Ciclo")).toBe("ciclo");
  });
});
