// Preferências de aparência e de layout (tema, fonte, zoom, painéis). Cada uma vem do localStorage e é gravada de volta ao mudar.
// Fora do App.jsx para que ele cuide só de nota aberta, navegação e atalhos.
import { useEffect, useRef, useState } from "react";
import { aplicarTema, aplicarEstiloCallout, lerTemas } from "@/lib/temas";
import { aplicarFonte, fonteSalva } from "@/lib/fontes";
import { aplicarForma } from "@/lib/forma";
import { DESTAQUES_PADRAO, aplicarDestaques } from "@/lib/destaques";
import { store } from "@/lib/store";

/** Estado + efeito de uma preferência simples: lê `chave` do armazenamento e grava a cada mudança (e aplica `aplicar`, se houver). */
function usePref(chave, padrao, aplicar) {
  const [v, setV] = useState(() => store.get(chave, padrao));
  useEffect(() => { aplicar?.(v); store.set(chave, v); }, [v]);
  return [v, setV];
}

/** `aoMudarZoom` roda depois que o zoom muda (o editor precisa remedir). */
export function usePreferencias(aoMudarZoom) {
  const [dark, setDark] = useState(() => store.get("tema", "light") === "dark");
  const [temaClaro, setTemaClaro] = useState(() => lerTemas().claro);
  const [temaEscuro, setTemaEscuro] = useState(() => lerTemas().escuro);
  useEffect(() => { aplicarTema(temaClaro, temaEscuro, dark); store.set("tema", dark ? "dark" : "light"); store.set("temaClaro", temaClaro); store.set("temaEscuro", temaEscuro); }, [dark, temaClaro, temaEscuro]);

  const [fonte, setFonte] = useState(fonteSalva);
  const [tamanhoTexto, setTamanhoTexto] = usePref("tamanhoTexto", 17);
  useEffect(() => { aplicarFonte(fonte, tamanhoTexto); store.set("fonte", fonte); }, [fonte, tamanhoTexto]);

  const [estiloCallout, setEstiloCallout] = usePref("estiloCallout", "preenchido", aplicarEstiloCallout);
  const [forma, setForma] = usePref("forma", "padrao", aplicarForma);
  const [numeros, setNumeros] = usePref("numeros", false);
  const [outlineW, setOutlineW] = usePref("outlineW", 240);
  const [showOutline, setShowOutline] = usePref("outline", true);
  const [panelTab, setPanelTab] = usePref("painel", "sumario");
  const [showSide, setShowSide] = usePref("side", true);
  const [bandeja, setBandeja] = usePref("bandeja", false); // fechar a janela mantém o app na bandeja (Windows)
  const [atalhoGlobal, setAtalhoGlobal] = usePref("atalhoGlobal", true); // captura rápida também fora do app (computador)

  const [destaques, setDestaques] = useState(() => ({ ...DESTAQUES_PADRAO, ...store.get("destaques", {}) }));
  useEffect(() => { aplicarDestaques(destaques); store.set("destaques", destaques); }, [destaques]);

  const [zoom, setZoom] = useState(() => store.get("zoom", 1));
  const aoZoom = useRef(aoMudarZoom);
  aoZoom.current = aoMudarZoom;
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * zoom}px`;
    store.set("zoom", zoom);
    aoZoom.current?.();
  }, [zoom]);

  return {
    dark, setDark, temaClaro, setTemaClaro, temaEscuro, setTemaEscuro, fonte, setFonte, tamanhoTexto, setTamanhoTexto,
    estiloCallout, setEstiloCallout, forma, setForma, numeros, setNumeros, destaques, setDestaques,
    zoom, setZoom, outlineW, setOutlineW, showOutline, setShowOutline, panelTab, setPanelTab, showSide, setShowSide, atalhoGlobal, setAtalhoGlobal, bandeja, setBandeja,
  };
}
