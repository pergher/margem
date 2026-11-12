import { useEffect, useRef, useState } from "react";
import { lerConfigProva, gravarConfigProva } from "@/lib/configProva";

/**
 * Configuração das provas lida da nota do vault; `mudar` atualiza a tela na hora e grava na nota depois de uma pausa
 * (e ao sair da tela). `cfg` é `null` enquanto lê. `onCriada` avisa quando a nota foi criada agora (a lista de notas muda).
 */
export function useConfigProva(items, onCriada) {
  const [cfg, setCfg] = useState(null);
  const [erro, setErro] = useState("");
  const it = useRef(items); it.current = items;
  const cb = useRef(onCriada); cb.current = onCriada;
  const pendente = useRef(null), timer = useRef(null);

  const gravar = async () => {
    const novo = pendente.current;
    if (!novo) return;
    pendente.current = null; clearTimeout(timer.current);
    try {
      const r = await gravarConfigProva(it.current, novo);
      setErro("");
      setCfg((c) => (c ? { ...c, logoArquivo: r.config.logoArquivo, logoNova: pendente.current ? c.logoNova : false } : c));
      if (r.criada) cb.current?.();
    } catch (e) { setErro(String(e?.message ?? e)); }
  };
  const mudar = (novo) => { setCfg(novo); pendente.current = novo; clearTimeout(timer.current); timer.current = setTimeout(gravar, 600); };

  const pronto = items.length > 0;
  useEffect(() => { if (pronto) lerConfigProva(it.current).then(setCfg).catch((e) => setErro(String(e?.message ?? e))); }, [pronto]);
  useEffect(() => () => { gravar(); }, []);
  return { cfg, mudar, erro, setErro };
}
