import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/api", () => ({ invoke: async () => null }));
const { comportamentosDe, dataDaSemana, registrosDoDiario, insereTags, acoesDoAluno, inserirAcao, marcarFeita, efeitoDaAcao, sinaisDoAluno, serieSemanal } = await import("../diario");

describe("comportamentosDe", () => {
  it("lê etiquetas e as tira do texto", () => {
    const r = comportamentosDe("#conversa #celular usou o celular na leitura");
    expect(r.cats).toEqual([{ id: "conversa", sugerida: false }, { id: "celular", sugerida: false }]);
    expect(r.texto).toBe("usou o celular na leitura");
  });
  it("sugere pelo texto quando não há etiqueta", () => {
    expect(comportamentosDe("conversa paralela durante a leitura").cats).toEqual([{ id: "conversa", sugerida: true }]);
    expect(comportamentosDe("saiu da sala duas vezes sem pedir").cats[0].id).toBe("andando");
    expect(comportamentosDe("ausente").cats).toEqual([]);
  });
  it("prefere o comportamento negativo ao positivo quando os dois aparecem", () => {
    expect(comportamentosDe("participou, mas conversou muito").cats.map((c) => c.id)).toEqual(["conversa"]);
  });
  it("não confunde discussão da aula com briga", () => {
    expect(comportamentosDe("participou muito da discussão").cats.map((c) => c.id)).toEqual(["positivo"]);
    expect(comportamentosDe("brigou com o colega no pátio").cats.map((c) => c.id)).toEqual(["briga"]);
    expect(comportamentosDe("esqueceu o caderno, copiou em folha avulsa").cats.map((c) => c.id)).toEqual(["produtividade"]);
  });
  it("insereTags escreve as etiquetas antes do texto", () => expect(insereTags(["briga"], "empurrou o colega")).toBe("#briga empurrou o colega"));
});

describe("dataDaSemana", () => {
  it("aceita data ISO e rótulo por extenso", () => {
    expect(dataDaSemana("2026-09-21", "2026")).toEqual(new Date(2026, 8, 21));
    expect(dataDaSemana("9 a 13 de Novembro", "2026")).toEqual(new Date(2026, 10, 9));
    expect(dataDaSemana("27 de Outubro a 31 de Outubro", "2026")).toEqual(new Date(2026, 9, 27));
    expect(dataDaSemana("semana de prova", "2026")).toBeNull();
    expect(dataDaSemana("30 de Março a 3 de Abril", "2026")).toEqual(new Date(2026, 2, 30));
  });
});

describe("registrosDoDiario", () => {
  const texto = "---\ntipo: diario\nsemana: 2026-09-21\ntranscricao: pendente\n---\n# D\n\n## Aula 1 — Adjetivos\n\nDado: lista de adjetivos.\n<!-- original: adj. lista -->\n- [[Marina Costa]] — entregou a lista completa.\n\n## Aula 2 — Verbete\n\nDado: escrita em duplas.\n- [[Ana Souza]] — #conversa falou o tempo todo\n";
  const r = registrosDoDiario(texto, { path: "/x.md", ano: "2026", turma: "61" });
  it("separa aulas e ocorrências, em ordem", () => {
    expect(r.filter((x) => x.tipo === "aula").map((x) => [x.n, x.tema, x.texto])).toEqual([[1, "Adjetivos", "lista de adjetivos."], [2, "Verbete", "escrita em duplas."]]);
    const o = r.filter((x) => x.tipo === "ocorrencia");
    expect(o.map((x) => [x.aluno, x.n, x.mes])).toEqual([["Marina Costa", 1, "2026-09"], ["Ana Souza", 2, "2026-09"]]);
    expect(o[1].cats[0]).toEqual({ id: "conversa", sugerida: false });
  });
});

describe("ações com o aluno", () => {
  const nota = "---\ntipo: aluno\n---\n# Diego\n\nObservações.\n";
  const a = { data: "2026-11-20", hora: "14h", tipo: "agendar", cat: "conversa", estado: "planejada", texto: "reunião sobre conversa" };
  it("cria a seção, lê de volta e marca como feita", () => {
    const t = inserirAcao(nota, a);
    expect(t).toContain("## Ações\n\n- 2026-11-20 14h — #agendar #conversa #planejada reunião sobre conversa");
    const [x] = acoesDoAluno(t);
    expect(x).toMatchObject({ data: "2026-11-20", hora: "14h", tipo: "agendar", cat: "conversa", estado: "planejada", texto: "reunião sobre conversa" });
    expect(acoesDoAluno(marcarFeita(t, x.linha))[0].estado).toBe("feita");
  });
  it("acrescenta ao fim da seção existente e ignora linhas de outras seções", () => {
    const t = inserirAcao(inserirAcao(nota, a) + "\n## Outra\n\n- 2026-01-01 — #conversar #feita fora\n", { ...a, tipo: "conversar", hora: "", estado: "feita", data: "2026-11-18" });
    expect(acoesDoAluno(t).map((x) => x.tipo)).toEqual(["agendar", "conversar"]);
  });
  const oc = (data, cat) => ({ data: new Date(data), cats: [{ id: cat, sugerida: false }] });
  const hoje = new Date(2026, 10, 18);
  it("compara ocorrências antes e depois da ação", () => {
    const ocs = [oc("2026-10-20T12:00", "briga"), oc("2026-10-27T12:00", "briga"), oc("2026-11-10T12:00", "briga")];
    expect(efeitoDaAcao({ data: "2026-10-28", estado: "feita", cat: "briga" }, ocs, hoje)).toMatchObject({ antes: 2, depois: 1, tendencia: "diminuiu" });
    expect(efeitoDaAcao({ data: "2026-11-17", estado: "feita", cat: "briga" }, ocs, hoje)).toBeNull();
    expect(efeitoDaAcao({ data: "2026-10-28", estado: "planejada", cat: "briga" }, ocs, hoje)).toBeNull();
  });
  it("dispara sinal com 3 ocorrências em 4 semanas e diz se há ação", () => {
    const ocs = ["2026-10-27", "2026-11-03", "2026-11-10"].map((d) => oc(`${d}T12:00`, "celular"));
    expect(sinaisDoAluno(ocs, [], hoje)).toEqual([expect.objectContaining({ cat: "celular", n: 3, planejada: null })]);
    const plan = { data: "2026-11-20", estado: "planejada", cat: "celular", tipo: "conversar" };
    expect(sinaisDoAluno(ocs, [plan], hoje)[0].planejada).toBe(plan);
    expect(sinaisDoAluno(ocs.slice(1), [], hoje)).toEqual([]);
  });
  it("serieSemanal devolve 6 semanas, a atual por último", () => {
    const s = serieSemanal([oc("2026-11-10T12:00", "conversa")], hoje, 6);
    expect(s).toHaveLength(6);
    expect(s[4].por).toEqual([{ cat: "conversa", n: 1 }]);
  });
});
