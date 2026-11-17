// Histórico de navegação (Voltar/Avançar): cada passo é uma nota ({ k: "nota", path }) ou uma tela do app ({ k: "pag", page, … }),
// para o Voltar/Avançar também refazerem listagens (ex.: a pasta aberta em Aulas), não só arquivos. Extraído de App.jsx.
import { useEffect, useRef, useState } from "react";
import { invoke } from "@/lib/api";
import { lembrarRecente } from "@/lib/recentes";

export const chaveEntrada = (e) => e.k === "nota" ? "n:" + e.path : `p:${e.page}|${e.aulasPasta}|${e.inicioModo}|${e.correcaoFoco}|${e.recursosAba}|${e.recursosPasta}|${e.ciclo?.path ?? ""}`;
const under = (p, base) => p === base || p.startsWith(base + "/");

/**
 * `nav`: estado da navegação entre telas (de useNavegacao) e seus setters; `nota`: { cur, dirty, load, save, setCurrent } de useNotaAberta;
 * `ed`: ref do Editor. Devolve { open, go, canBack, canFwd, remap }.
 */
export function useHistoricoNavegacao({ page, setPage, nav, nota, ed }) {
  const { aulasPasta, inicioModo, correcaoFoco, recursosAba, recursosPasta, ciclo, setAulasPasta, inicioModoRaw, setCorrecaoFoco, setRecursosAba, setRecursosPasta, setCiclo } = nav;
  const { cur, dirty, load, save, setCurrent } = nota;
  const hist = useRef({ stack: [], idx: -1 });
  const [, setNavTick] = useState(0); // só para redesenhar os botões Voltar/Avançar

  const empurrar = (e) => {
    const h = hist.current;
    if (h.idx >= 0 && chaveEntrada(h.stack[h.idx]) === chaveEntrada(e)) return;
    h.stack = [...h.stack.slice(0, h.idx + 1), e]; h.idx = h.stack.length - 1;
    setNavTick((n) => n + 1);
  };
  const open = async (path) => {
    lembrarRecente(path);
    empurrar({ k: "nota", path });
    // Nota já aberta: se o arquivo mudou no disco e não há nada por salvar, recarrega; senão só volta ao editor.
    if (path === cur.current && (dirty.current || await invoke("read_note", { path }).then((t) => t === ed.current.getText()).catch(() => true))) { setPage("editor"); return; }
    await load(path);
  };
  const go = async (delta) => {
    const h = hist.current, i = h.idx + delta;
    if (i < 0 || i >= h.stack.length) return;
    h.idx = i; setNavTick((n) => n + 1);
    const e = h.stack[i];
    if (e.k === "nota") await load(e.path);
    else { setAulasPasta(e.aulasPasta); inicioModoRaw(e.inicioModo); setCorrecaoFoco(e.correcaoFoco); setRecursosAba(e.recursosAba); setRecursosPasta(e.recursosPasta ?? ""); setCiclo(e.ciclo); await save(); setPage(e.page); }
  };
  // Toda mudança de tela (ou de pasta em Aulas, aba, etc.) vira um passo do histórico.
  useEffect(() => {
    if (page === "editor") return;
    empurrar({ k: "pag", page, aulasPasta, inicioModo, correcaoFoco, recursosAba, recursosPasta, ciclo });
  }, [page, aulasPasta, inicioModo, correcaoFoco, recursosAba, recursosPasta, ciclo]);
  // Renomear/mover: o histórico e a nota aberta passam a apontar para o caminho novo.
  const remap = (from, to) => {
    const sub = (p) => (p && under(p, from) ? to + p.slice(from.length) : p);
    const h = hist.current; h.stack = h.stack.map((e) => e.k === "nota" ? { ...e, path: sub(e.path) } : { ...e, correcaoFoco: sub(e.correcaoFoco) });
    if (cur.current) { cur.current = sub(cur.current); setCurrent(cur.current); }
  };
  return { open, go, remap, canBack: hist.current.idx > 0, canFwd: hist.current.idx < hist.current.stack.length - 1 };
}
