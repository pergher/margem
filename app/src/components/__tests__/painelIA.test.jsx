// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const P = (id, o = {}) => ({ id, tipo: "openai-compat", rotulo: id, modelo: "m", suporta_ferramentas: true, exige_chave: true, local: false, ...o });
let config = { ativa: true, aceitou_aviso: true, provedor: "anthropic", max_tokens: 1000, provedores: [P("anthropic", { rotulo: "Claude" }), P("openai", { rotulo: "OpenAI" }), P("local", { rotulo: "Local (Ollama)", exige_chave: false, local: true, suporta_ferramentas: false })] };
const gravados = [];
let chaves = { anthropic: true, openai: false, local: false };
vi.mock("@/lib/ia", () => ({
  iaDisponivel: true,
  iaConfigLer: async () => config,
  iaTemChave: async (id) => chaves[id],
  iaConfigGravar: async (c) => { gravados.push(c); },
  iaPrevia: async (c) => (c ? { texto: "[Contexto do Margem] Nota aberta: A", aviso: null } : { texto: null, aviso: null }),
}));
const { PainelIA } = await import("../PainelIA");
afterEach(cleanup);

const iaCom = (msgs, extra = {}) => ({ msgs, ocupado: false, uso: null, enviar: vi.fn(), parar: vi.fn(), nova: vi.fn(), ...extra });
const aula = "---\ntipo: aula\n---\n# A";
const ctx = { path: "/v/A.md", texto: aula, selecao: "" };

describe("PainelIA", () => {
  it("mostra texto, ferramentas, avisos e o cartão de proposta, que abre as diferenças", async () => {
    const msgs = [
      { papel: "usuario", itens: [{ tipo: "texto", texto: "Adapte" }] },
      { papel: "ia", itens: [
        { tipo: "ferramenta", resumo: "Buscou notas: \"anáfora\"" }, { tipo: "texto", texto: "Pronto, propus." },
        { tipo: "proposta", id: 7, resumo: "Mais apoio", nota: "/v/A.md", nova: null }, { tipo: "aviso", msg: "Esta nota tem dados de alunos" },
      ] },
    ];
    const onVer = vi.fn();
    render(<PainelIA ia={iaCom(msgs, { uso: { entrada: 12, saida: 3 } })} texto={aula} getContexto={() => ctx} onVerProposta={onVer} onAbrirConfig={() => {}} />);
    await screen.findByText("Pronto, propus.");
    expect(screen.getByText(/Buscou notas/)).toBeTruthy();
    expect(screen.getByText(/Esta nota tem dados de alunos/)).toBeTruthy();
    expect(screen.getByText("12 entrada · 3 saída (tokens)")).toBeTruthy();
    fireEvent.click(screen.getByText("Ver diferenças"));
    expect(onVer).toHaveBeenCalledWith(7);
  });

  it("ação rápida de aula envia o prompt; a da seleção avisa quando nada está selecionado", async () => {
    const ia = iaCom([]);
    render(<PainelIA ia={ia} texto={aula} getContexto={() => ctx} onVerProposta={() => {}} onAbrirConfig={() => {}} />);
    fireEvent.click(await screen.findByText("Adaptar com mais apoio"));
    expect(ia.enviar).toHaveBeenCalledTimes(1);
    expect(ia.enviar.mock.calls[0][0]).toContain("propor_edicao");
    expect(ia.enviar.mock.calls[0][1]).toEqual({ incluirNota: true });
    fireEvent.click(screen.getByText("Adaptar a seleção"));
    expect(await screen.findByText(/Selecione um trecho/)).toBeTruthy();
    expect(ia.enviar).toHaveBeenCalledTimes(1);
  });

  it("'Incluir a nota aberta' desmarcado não manda a nota, e 'Ver o que foi enviado' mostra o contexto", async () => {
    const ia = iaCom([]);
    render(<PainelIA ia={ia} texto={aula} getContexto={() => ctx} onVerProposta={() => {}} onAbrirConfig={() => {}} />);
    fireEvent.click(await screen.findByText("Ver o que foi enviado"));
    expect(await screen.findByText(/Contexto do Margem/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Incluir a nota aberta"));
    fireEvent.change(screen.getByLabelText("Pergunta para a IA"), { target: { value: "o que é crase?" } });
    fireEvent.click(screen.getByText("Enviar"));
    expect(ia.enviar).toHaveBeenCalledWith("o que é crase?", { incluirNota: false });
  });

  it("ocupado mostra Parar; desligada ou sem chave explica e leva às configurações", async () => {
    const ia = iaCom([{ papel: "usuario", itens: [{ tipo: "texto", texto: "x" }] }, { papel: "ia", itens: [] }], { ocupado: true });
    const { unmount } = render(<PainelIA ia={ia} texto={aula} getContexto={() => ctx} onVerProposta={() => {}} onAbrirConfig={() => {}} />);
    fireEvent.click(await screen.findByText("Parar"));
    expect(ia.parar).toHaveBeenCalled();
    unmount();
    chaves = { ...chaves, anthropic: false };
    const abrir = vi.fn();
    render(<PainelIA ia={iaCom([])} texto={aula} getContexto={() => ctx} onVerProposta={() => {}} onAbrirConfig={abrir} />);
    await waitFor(() => screen.getByText("A IA está desligada."));
    fireEvent.click(screen.getByText("Abrir Configurações"));
    expect(abrir).toHaveBeenCalled();
    chaves = { ...chaves, anthropic: true };
  });

  it("seletor de provedor: sem chave fica desabilitado; trocar grava e começa conversa nova; local mostra 'nada sai do computador'", async () => {
    const ia = iaCom([]);
    render(<PainelIA ia={ia} texto={aula} getContexto={() => ctx} onVerProposta={() => {}} onAbrirConfig={() => {}} />);
    const sel = await screen.findByLabelText("Provedor de IA");
    expect(screen.getByRole("option", { name: /OpenAI.*sem chave/ }).disabled).toBe(true);
    const local = screen.getByRole("option", { name: /Local \(Ollama\)/ });
    expect(local.disabled).toBe(false); // o local não exige chave
    fireEvent.change(sel, { target: { value: "local" } });
    await screen.findByText(/Nada sai do computador/);
    expect(screen.getByText(/Sem ferramentas/)).toBeTruthy();
    expect(gravados.at(-1).provedor).toBe("local");
    expect(ia.nova).toHaveBeenCalled();
  });
});
