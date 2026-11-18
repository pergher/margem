// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { aceitarTrecho, aceitarTudo, criarItens, estadoRevisao, iniciarRevisao, irPara, mudancaDe, recusarTrecho, recusarTudo, revisaoCampo } from "../revisao";

// o jsdom não mede texto; o CodeMirror mede de forma assíncrona depois de criar a vista
const vazio = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
Range.prototype.getClientRects ??= () => [];
Range.prototype.getBoundingClientRect ??= () => vazio;
const view = (doc) => new EditorView({ parent: document.body, state: EditorState.create({ doc, extensions: [revisaoCampo] }) });
const texto = (v) => v.state.doc.toString();

describe("revisão de proposta no editor", () => {
  it("acha os trechos e as posições", () => {
    const v = view("a\nb\nc\nd");
    const itens = criarItens(v.state.doc, "a\nB\nc\nd\ne");
    expect(itens.map((i) => [i.rem, i.add])).toEqual([[["b"], ["B"]], [[], ["e"]]]);
    expect(itens[0].from).toBe(2); expect(itens[0].to).toBe(3);
    expect(itens[1].fimDoc).toBe(true);
  });

  it("aceitar tudo dá o texto proposto e conclui", () => {
    const v = view("um\ndois\ntrês\nquatro");
    const novo = "UM\ndois\nquatro\ncinco";
    expect(iniciarRevisao(v, novo)).toBeGreaterThan(0);
    expect(v.state.readOnly).toBe(true);
    aceitarTudo(v);
    expect(texto(v)).toBe(novo);
    const e = estadoRevisao(v); expect(e.itens).toHaveLength(0); expect(e.motivo).toBe("concluida"); expect(e.aceitos).toBe(e.total);
    expect(v.state.readOnly).toBe(false);
  });

  it("recusar tudo não muda a nota", () => {
    const v = view("um\ndois\ntrês");
    iniciarRevisao(v, "um\nX\ntrês\nmais");
    recusarTudo(v);
    expect(texto(v)).toBe("um\ndois\ntrês");
    expect(estadoRevisao(v).motivo).toBe("concluida"); expect(estadoRevisao(v).aceitos).toBe(0);
  });

  it("aceita um trecho e recusa outro; as posições do resto acompanham a edição", () => {
    const v = view("a\nb\nc\nd\ne\nf");
    iniciarRevisao(v, "a\nB1\nB2\nB3\nc\nd\nE\nf");
    const [t1, t2] = estadoRevisao(v).itens;
    aceitarTrecho(v, t1.id); // cresce 1 linha → o segundo trecho se desloca
    expect(texto(v)).toBe("a\nB1\nB2\nB3\nc\nd\ne\nf");
    const resto = estadoRevisao(v).itens;
    expect(resto).toHaveLength(1);
    expect(v.state.sliceDoc(resto[0].from, resto[0].to)).toBe("e");
    recusarTrecho(v, t2.id);
    expect(texto(v)).toBe("a\nB1\nB2\nB3\nc\nd\ne\nf");
    expect(estadoRevisao(v).motivo).toBe("concluida");
  });

  it("remoção pura e inserção no começo", () => {
    const v = view("x\ny\nz");
    iniciarRevisao(v, "w\nx\nz");
    aceitarTudo(v);
    expect(texto(v)).toBe("w\nx\nz");
    const u = view("x\ny");
    iniciarRevisao(u, "x");
    aceitarTudo(u); expect(texto(u)).toBe("x");
    const t = view("x\ny");
    iniciarRevisao(t, "y");
    aceitarTudo(t); expect(texto(t)).toBe("y");
  });

  it("proposta igual ao texto: nada para revisar", () => {
    const v = view("igual");
    expect(iniciarRevisao(v, "igual")).toBe(0);
    expect(estadoRevisao(v).motivo).toBe("vazia");
  });

  it("edição externa durante a revisão cancela (as posições deixariam de valer)", () => {
    const v = view("a\nb\nc");
    iniciarRevisao(v, "a\nB\nc");
    v.dispatch({ changes: { from: 0, insert: "zzz" } });
    expect(estadoRevisao(v).itens).toHaveLength(0);
    expect(estadoRevisao(v).motivo).toBe("cancelada");
  });

  it("navegar entre trechos dá a volta", () => {
    const v = view("a\nb\nc\nd\ne");
    iniciarRevisao(v, "A\nb\nC\nd\nE");
    expect(estadoRevisao(v).atual).toBe(0);
    irPara(v, -1); expect(estadoRevisao(v).atual).toBe(2);
    irPara(v, 1); expect(estadoRevisao(v).atual).toBe(0);
  });

  it("os blocos aparecem no DOM, com o texto removido e o novo", () => {
    const v = view("a\nb\nc");
    iniciarRevisao(v, "a\nB\nc");
    const bloco = v.dom.querySelector(".cm-rev");
    expect(bloco?.textContent).toContain("Aceitar"); expect(bloco?.textContent).toContain("b"); expect(bloco?.textContent).toContain("B");
  });
});
