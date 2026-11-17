// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PropostaDialog } from "../PropostaDialog";

const proposta = { id: 1, nota: "/v/A.md", nova: null, resumo: "teste", texto_base: "# T\n\num\n\nmeio\nmeio\nmeio\nmeio\nmeio\n\nquatro", texto_novo: "# T\n\nUM\n\nmeio\nmeio\nmeio\nmeio\nmeio\n\nQUATRO" };

afterEach(cleanup);
describe("PropostaDialog", () => {
  it("aplica o texto final só com os trechos marcados", async () => {
    const onAplicar = vi.fn(async () => {}), onClose = vi.fn();
    render(<PropostaDialog proposta={proposta} onAplicar={onAplicar} onRecusar={vi.fn()} onClose={onClose} />);
    expect(screen.getByText("2 de 2 trecho(s) aceito(s)")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Aceitar trecho 1")); // desmarca o primeiro
    fireEvent.click(screen.getByText("Aplicar"));
    await waitFor(() => expect(onAplicar).toHaveBeenCalledWith("# T\n\num\n\nmeio\nmeio\nmeio\nmeio\nmeio\n\nQUATRO"));
    expect(onClose).toHaveBeenCalled();
  });
  it("aceitar tudo entrega o texto proposto; recusar não aplica", async () => {
    const onAplicar = vi.fn(async () => {}), onRecusar = vi.fn(async () => {});
    const { unmount } = render(<PropostaDialog proposta={proposta} onAplicar={onAplicar} onRecusar={onRecusar} onClose={() => {}} />);
    fireEvent.click(screen.getByText("Aplicar"));
    await waitFor(() => expect(onAplicar).toHaveBeenCalledWith(proposta.texto_novo));
    unmount();
    render(<PropostaDialog proposta={proposta} onAplicar={onAplicar} onRecusar={onRecusar} onClose={() => {}} />);
    fireEvent.click(screen.getByText("Recusar"));
    await waitFor(() => expect(onRecusar).toHaveBeenCalled());
    expect(onAplicar).toHaveBeenCalledTimes(1);
  });
  it("mostra o erro e não fecha quando aplicar falha", async () => {
    const onClose = vi.fn();
    render(<PropostaDialog proposta={proposta} onAplicar={async () => { throw "conflito: a nota mudou desde a proposta"; }} onClose={onClose} />);
    fireEvent.click(screen.getByText("Aplicar"));
    await screen.findByText(/conflito: a nota mudou/);
    expect(onClose).not.toHaveBeenCalled();
  });
});
