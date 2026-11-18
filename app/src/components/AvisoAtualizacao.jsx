import { useState } from "react";
import { instalarAtualizacao } from "@/lib/atualizar";

// Faixa no topo, em qualquer página, quando há versão nova. "Atualizar" salva a nota aberta, instala e volta para onde você estava.
export function AvisoAtualizacao({ versao, onDepois }) {
  const [progresso, setProgresso] = useState(null), [erro, setErro] = useState("");
  if (!versao) return null;
  const instalar = async () => {
    setErro(""); setProgresso(0);
    try { await instalarAtualizacao(setProgresso); } catch (e) { setProgresso(null); setErro(String(e?.message ?? e)); }
  };
  const btn = "font-medium underline-offset-2 hover:underline disabled:opacity-50";
  return (
    <div role="status" className="flex shrink-0 items-center gap-4 border-b bg-primary/10 px-6 py-2 text-sm">
      <span className="flex-1">
        {progresso == null ? <>Nova versão <b>{versao}</b> disponível.{erro && <span className="ml-2 text-err">Não deu certo: {erro}</span>}</>
          : progresso >= 1 ? "Atualizando… o Margem vai fechar e reabrir sozinho."
            : `Baixando a versão ${versao}… ${Math.round(progresso * 100)}%`}
      </span>
      {progresso == null && <>
        <button onClick={instalar} className={btn}>Atualizar</button>
        <button onClick={onDepois} className={btn}>Depois</button>
      </>}
    </div>
  );
}
