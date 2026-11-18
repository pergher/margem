import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/api", () => ({ invoke: vi.fn() }));
const { mensagemDaAcao } = await import("../mensagens");

const oc = (iso, cat, texto) => ({ data: new Date(`${iso}T12:00`), ord: new Date(`${iso}T12:00`).getTime(), aula: "Aula 2", texto, cats: [{ id: cat, sugerida: false }] });
const dados = { nome: "Maria Souza", turma: "61", hoje: new Date(2026, 10, 18), comentario: "", ocs: [oc("2026-11-03", "celular", "usou o celular"), oc("2026-11-10", "celular", "de novo"), oc("2026-10-01", "briga", "antiga")], acoes: [{ tipo: "conversar", estado: "feita", data: "2026-11-12" }] };

describe("mensagens prontas", () => {
  it("só há mensagem para informar, notificar e pedir agendamento", () => {
    expect(mensagemDaAcao("conversar", "feita", dados)).toBeNull();
    expect(mensagemDaAcao("diretoria", "feita", dados)).toBeNull();
    expect(mensagemDaAcao("agendar", "agendada", dados)).toBeNull();
    expect(mensagemDaAcao("agendar", "solicitada", dados).titulo).toMatch(/agendamento/i);
  });
  it("resume só as 4 últimas semanas e cita o que já foi feito", () => {
    const t = mensagemDaAcao("informar", "feita", { ...dados, comentario: "Peço atenção." }).texto;
    expect(t).toContain("Maria Souza, da turma 61");
    expect(t).toContain("uso de celular (2)");
    expect(t).not.toContain("antiga");
    expect(t).toContain("conversar com o aluno em 12/11");
    expect(t).toContain("Peço atenção.");
  });
  it("não inventa ocorrências quando não há", () => {
    expect(mensagemDaAcao("notificar", "feita", { ...dados, ocs: [] }).texto).toContain("conversar sobre o desempenho");
  });
});
