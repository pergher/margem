// A nota aberta no editor: texto, painéis derivados (sumário, propriedades, palavras), salvamento automático com detecção de
// conflito, e o fechamento seguro da janela. `ed` é a ref do Editor; `setStatus`/`setPage` vêm do App.
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@/lib/api";
import { headingsOf } from "@/components/Outline";

const AUTOSAVE_MS = 800;

export function useNotaAberta({ ed, setStatus, setPage, setItems }) {
  const [info, setInfo] = useState(null);
  const [propsText, setPropsText] = useState("");
  const [current, setCurrent] = useState(null);
  const [words, setWords] = useState(0);
  const [headings, setHeadings] = useState([]);
  const [activeHeading, setActiveHeading] = useState(-1);
  const [histTick, setHistTick] = useState(0);
  const cur = useRef(null);          // caminho aberto
  const dirty = useRef(false);
  const timer = useRef(null);

  const refreshInfo = useCallback(async (path) => {
    try { const i = await invoke("note_info", { path }); if (path === cur.current) setInfo(i); } catch { /* nota sumiu ou ainda não existe */ }
  }, []);

  // ---------- salvar ----------
  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (!cur.current || !dirty.current) return;
    const path = cur.current, text = ed.current.getText();
    dirty.current = false;
    const salvou = () => { setItems?.((its) => its.map((i) => (i.path === path ? { ...i, modified: Math.floor(Date.now() / 1000) } : i))); refreshInfo(path); setHistTick((n) => n + 1); setStatus("Salvo às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })); };
    try { await invoke("save_note", { path, text }); salvou(); }
    catch (e) {
      if (!String(e).startsWith("conflito:")) { dirty.current = true; console.error("save_note falhou", path, e); setStatus("Erro ao salvar: " + e); return; }
      // O arquivo mudou fora do Margem (Drive, Obsidian, Claude). Nada foi gravado: o usuário decide.
      const sobrescrever = window.confirm("Esta nota foi alterada fora do Margem desde que você a abriu.\n\nOK: sobrescrever com o que está no editor (a versão do disco vai para o histórico).\nCancelar: carregar a versão do disco (o que você digitou desde então será descartado).");
      try {
        if (sobrescrever) { await invoke("save_note", { path, text, force: true }); salvou(); }
        else if (path === cur.current) { const t = await invoke("read_note", { path }); restoreText(t); setStatus("Carregada a versão do disco"); }
      } catch (e2) { dirty.current = true; setStatus("Erro ao salvar: " + e2); }
    }
  }, [refreshInfo]);
  useEffect(() => {
    const flush = () => { save(); };
    window.addEventListener("blur", flush);
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("blur", flush); window.removeEventListener("beforeunload", flush); };
  }, [save]);

  // Fechar a janela: espera a gravação terminar (o beforeunload não espera uma chamada assíncrona ao disco).
  useEffect(() => {
    if (!isTauri) return;
    let desfazer = null, vivo = true;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      const w = getCurrentWindow();
      w.onCloseRequested(async (e) => {
        e.preventDefault();
        await save();
        if (dirty.current && !window.confirm("Não foi possível salvar a nota aberta. Fechar mesmo assim e perder o que foi digitado?")) return;
        await w.destroy();
      }).then((f) => { if (vivo) desfazer = f; else f(); });
    });
    return () => { vivo = false; desfazer?.(); };
  }, [save]);

  const onChange = (d) => {
    const text = d.toString();
    dirty.current = true; setStatus("Editando…");
    setWords(text.split(/\s+/).filter(Boolean).length);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { const t = ed.current.getText(); setHeadings(headingsOf(t)); setPropsText(t); save(); }, AUTOSAVE_MS);
  };

  // ---------- abrir / histórico ----------
  // Só troca a tela depois de ler a nota (página e nota entram juntas): senão aparece antes o editor vazio ou a nota anterior.
  const load = async (path) => {
    await save();
    const text = await invoke("read_note", { path });
    ed.current.setText(text);
    cur.current = path; dirty.current = false;
    setCurrent(path); setStatus(""); setActiveHeading(-1);
    setWords(text.split(/\s+/).filter(Boolean).length);
    setHeadings(headingsOf(text)); setPropsText(text); setInfo(null); refreshInfo(path);
    setPage("editor");
  };
  // Depois de "Restaurar" o arquivo já foi gravado no disco: só atualiza o editor e os painéis.
  const restoreText = (text) => {
    ed.current.setText(text); dirty.current = false;
    setWords(text.split(/\s+/).filter(Boolean).length); setHeadings(headingsOf(text)); setPropsText(text);
    refreshInfo(cur.current); setHistTick((n) => n + 1); setStatus("Versão restaurada");
  };

  return { info, propsText, setPropsText, current, setCurrent, words, headings, activeHeading, setActiveHeading, histTick, cur, dirty, save, onChange, load, restoreText, refreshInfo };
}
