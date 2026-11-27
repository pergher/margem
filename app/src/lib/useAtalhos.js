// Atalhos globais da janela: teclado (mapa de atalhos do usuário), Ctrl+roda para o zoom, botões voltar/avançar do mouse
// e Esc para sair do modo foco. Extraído de App.jsx sem mudar o comportamento.
import { useEffect, useRef } from "react";
import { clamp } from "@/lib/store";
import { capturing } from "@/components/ShortcutsPage";
import { comboOf, effective, handlers, ACTIONS } from "@/lib/shortcuts";

const passoZoom = (z, d) => clamp(Math.round((z + d) * 10) / 10, 0.7, 2);

export function useAtalhos({ compacto = false, overrides, go, save, page, cur, ed, foco, setSearchOpen, setPaletteOpen, setCapturaOpen, setShowSide, setFoco, setNumeros, setZoom, abrirIA }) {
  useEffect(() => {
    if (!foco) return;
    const esc = (e) => { if (e.key === "Escape" && !e.defaultPrevented) setFoco(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [foco, setFoco]);

  // Os ouvintes são registrados uma vez; o que muda a cada render (go, save, tela, mapa) é lido por esta ref.
  const kb = useRef({});
  kb.current = { go, save, page, abrirIA, compacto, map: effective(overrides) };
  useEffect(() => {
    const zoomBy = (d) => setZoom((z) => passoZoom(z, d));
    const run = {
      search: () => setSearchOpen(true),
      palette: () => setPaletteOpen(true),
      captura: () => setCapturaOpen(true),
      save: () => kb.current.save(),
      insertTable: () => { if (cur.current && kb.current.page === "editor") ed.current.insertTable(); },
      toggleSide: () => setShowSide((v) => !v),
      focus: () => setFoco((v) => !v),
      toggleNumeros: () => setNumeros((v) => !v),
      ia: () => kb.current.abrirIA?.(),
      back: () => kb.current.go(-1),
      forward: () => kb.current.go(1),
      zoomIn: () => zoomBy(0.1),
      zoomOut: () => zoomBy(-0.1),
      zoomReset: () => setZoom(1),
    };
    const onKey = (e) => {
      if (capturing || kb.current.compacto) return; // celular: sem atalhos de teclado
      const c = comboOf(e);
      if (!c) return;
      const id = Object.keys(kb.current.map).find((k) => kb.current.map[k] === c);
      if (!id) return;
      if (ACTIONS.find((a) => a.id === id)?.plain) { // tecla simples: só fora de campos de texto e com a tela registrada
        const t = e.target;
        if (t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName) || t?.closest?.("[data-sem-atalhos]")) return; // menus abertos usam as próprias teclas
        if (!handlers[id]) return;
        e.preventDefault(); e.stopPropagation();
        handlers[id]();
        return;
      }
      e.preventDefault(); e.stopPropagation();
      run[id]();
    };
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 0.1 : -0.1);
    };
    const onMouse = (e) => { if (e.button === 3) { e.preventDefault(); kb.current.go(-1); } else if (e.button === 4) { e.preventDefault(); kb.current.go(1); } };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mouseup", onMouse);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("wheel", onWheel); window.removeEventListener("mouseup", onMouse); };
  }, []);
}
