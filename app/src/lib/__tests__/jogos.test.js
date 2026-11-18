import { describe, it, expect } from "vitest";
import { cacaPalavras, cartas, cruzadinha, jogoEmHtml, lerLista, normalizar, palavrasDaAula } from "../jogos";

const lista = lerLista("- oxítona: palavra com sílaba tônica no fim\nparoxítona — penúltima sílaba\nproparoxítona: antepenúltima\nacento\nsílaba: parte da palavra\nTônica");

describe("lista de palavras", () => {
  it("lê palavra e dica, normaliza e tira repetidas e curtas", () => {
    expect(lista.map((e) => e.palavra)).toEqual(["OXITONA", "PAROXITONA", "PROPAROXITONA", "ACENTO", "SILABA", "TONICA"]);
    expect(lista[0].dica).toBe("palavra com sílaba tônica no fim");
    expect(lista[3].dica).toBe("");
    expect(lerLista("acento: \nfrase:").map((e) => [e.original, e.dica])).toEqual([["acento", ""], ["frase", ""]]);
    expect(lerLista("a: x\nab\ncoração\nCORAÇÃO").map((e) => e.palavra)).toEqual(["CORACAO"]);
  });
  it("normalizar", () => expect(normalizar("Açúcar-ão")).toBe("ACUCARAO"));
});

describe("palavrasDaAula", () => {
  it("põe o negrito primeiro e ignora palavras comuns", () => {
    const t = "---\ntipo: aula\n---\n# T\n\nA **oxítona** é uma palavra. Toda palavra tem sílaba; a sílaba tônica da palavra. Sílaba sílaba sílaba.";
    const r = palavrasDaAula(t);
    expect(r[0]).toBe("oxítona");
    expect(r).toContain("sílaba");
    expect(r).not.toContain("palavra");
  });
});

describe("caça-palavras", () => {
  it("coloca todas as palavras nas posições indicadas e preenche o resto", () => {
    const r = cacaPalavras(lista, { dificuldade: "dificil", semente: 3 });
    expect(r.naoCouberam).toEqual([]);
    expect(r.grade.every((l) => l.length === r.tamanho && l.every((x) => /^[A-Z]$/.test(x)))).toBe(true);
    for (const p of r.colocadas) for (let i = 0; i < p.palavra.length; i++) expect(r.grade[p.r + p.dr * i][p.c + p.dc * i]).toBe(p.palavra[i]);
  });
  it("no nível fácil só usa → e ↓, e a mesma semente repete o resultado", () => {
    const a = cacaPalavras(lista, { dificuldade: "facil", semente: 5 }), b = cacaPalavras(lista, { dificuldade: "facil", semente: 5 });
    expect(a.colocadas.every((p) => p.dr >= 0 && p.dc >= 0 && p.dr + p.dc === 1)).toBe(true);
    expect(a.grade).toEqual(b.grade);
  });
  it("palavra maior que o tamanho pedido amplia a grade", () => {
    expect(cacaPalavras(lerLista("proparoxitona"), { semente: 1 }).tamanho).toBeGreaterThanOrEqual(13);
  });
});

describe("cruzadinha", () => {
  it("cruza as palavras: cada uma lê-se inteira na grade e tem número", () => {
    const r = cruzadinha(lista, { semente: 2 });
    const todas = [...r.horizontais, ...r.verticais];
    expect(todas.length + r.naoCouberam.length).toBe(lista.length);
    expect(todas.length).toBeGreaterThanOrEqual(4);
    for (const h of r.horizontais) {
      const i = r.numeros.findIndex((l) => l.includes(h.n)), j = r.numeros[i].indexOf(h.n);
      expect(r.grade[i].slice(j, j + h.tamanho).join("")).toBe(h.palavra);
    }
    for (const v of r.verticais) {
      const i = r.numeros.findIndex((l) => l.includes(v.n)), j = r.numeros[i].indexOf(v.n);
      expect(r.grade.slice(i, i + v.tamanho).map((l) => l[j]).join("")).toBe(v.palavra);
    }
  });
  it("não deixa palavras coladas lado a lado sem cruzar", () => {
    const r = cruzadinha(lista, { semente: 4 });
    // toda sequência de 2+ letras seguidas, em linha ou coluna, é uma das palavras
    const palavras = new Set([...r.horizontais, ...r.verticais].map((x) => x.palavra));
    const corridas = [];
    const lerCorridas = (linhas) => linhas.forEach((l) => (l.map((x) => x || " ").join("").match(/[A-Z]{2,}/g) ?? []).forEach((c) => corridas.push(c)));
    lerCorridas(r.grade);
    lerCorridas(r.grade[0].map((_, j) => r.grade.map((l) => l[j])));
    expect(corridas.every((c) => palavras.has(c))).toBe(true);
  });
  it("sem palavras devolve grade vazia", () => expect(cruzadinha([]).linhas).toBe(0));
});

describe("cartas e impressão", () => {
  it("faz dois cartões por palavra com dica e avisa as sem dica", () => {
    const r = cartas(lista, { semente: 1 });
    expect(r.cartas).toHaveLength(8);
    expect(r.semDica).toEqual(["acento", "Tônica"]);
  });
  it("o gabarito mostra letras; a folha do aluno não", () => {
    const r = cruzadinha(lista, { semente: 2 });
    expect(jogoEmHtml("cruzadinha", r, { titulo: "T", professor: true })).toContain(">" + r.grade.flat().find(Boolean) + "<");
    expect(jogoEmHtml("cruzadinha", r, { titulo: "T" })).toContain("Nome:");
    const cp = cacaPalavras(lista, { semente: 1 });
    expect(jogoEmHtml("caca-palavras", cp, { professor: true })).toContain('class="ac"');
    expect(jogoEmHtml("caca-palavras", cp, {})).not.toContain('class="ac"');
  });
});
