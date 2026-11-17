// Conversa do painel de IA: só em memória (estado do React); o Rust guarda o histórico da conversa também só em memória.
import { useCallback, useRef, useState } from "react";
import { aplicarEvento, iaCancelar, iaEnviar, iaLimpar, novoId } from "@/lib/ia";

export function useIA({ getContexto }) {
  const [msgs, setMsgs] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [uso, setUso] = useState(null);
  const conversa = useRef(novoId());
  const tela = useRef({});
  tela.current = { getContexto };

  const enviar = useCallback(async (texto, { incluirNota = true } = {}) => {
    if (!texto.trim()) return;
    setMsgs((m) => [...m, { papel: "usuario", itens: [{ tipo: "texto", texto }] }, { papel: "ia", itens: [] }]);
    setOcupado(true);
    try {
      await iaEnviar(conversa.current, texto, incluirNota ? tela.current.getContexto() : null, (ev) => {
        if (ev.tipo === "uso") setUso({ entrada: ev.tokens_in, saida: ev.tokens_out });
        else setMsgs((m) => aplicarEvento(m, ev));
      });
    } catch (e) { setMsgs((m) => aplicarEvento(m, { tipo: "erro", msg: String(e?.message ?? e) })); }
    finally { setOcupado(false); }
  }, []);

  const parar = useCallback(() => { iaCancelar(conversa.current).catch(() => {}); }, []);
  const nova = useCallback(() => {
    iaLimpar(conversa.current).catch(() => {});
    conversa.current = novoId(); setMsgs([]); setUso(null);
  }, []);

  return { msgs, ocupado, uso, enviar, parar, nova };
}
