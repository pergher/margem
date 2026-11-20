import { useEffect, useState } from "react";
import { IconRotateClockwise as RotateCcw } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ACTIONS, comboOf, conflict, effective, hasModifier, pretty, saveOverrides } from "@/lib/shortcuts";
import { Estado } from "@/components/ui/estado";
import { isTauri } from "@/lib/api";
import { temBandeja } from "@/lib/bandeja";

export let capturing = false; // lido pelo tratador global de teclas, para não disparar ações durante a captura

export function ShortcutsPage({ overrides, setOverrides, atalhoGlobal }) {
  const [rec, setRec] = useState(null);   // id da ação em captura
  const [msg, setMsg] = useState(null);
  const map = effective(overrides);

  const apply = (o) => { setOverrides(o); saveOverrides(o); };
  const setCombo = (id, combo) => {
    const def = ACTIONS.find((a) => a.id === id).def;
    const o = { ...overrides };
    if (combo === def) delete o[id]; else o[id] = combo;
    apply(o);
  };

  useEffect(() => {
    capturing = !!rec;
    if (!rec) return;
    const onKey = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === "Escape") { setRec(null); setMsg(null); return; }
      const c = comboOf(e);
      if (!c) return;
      if (!hasModifier(c) && !ACTIONS.find((a) => a.id === rec).plain) { setMsg({ id: rec, text: "Use Ctrl ou Alt junto com a tecla." }); return; }
      const other = conflict(map, rec, c);
      if (other) { setMsg({ id: rec, text: `Já usado em “${other.label}”.` }); return; }
      setCombo(rec, c); setRec(null); setMsg(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); capturing = false; };
  }, [rec, overrides]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="w-full px-8 py-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold">Atalhos de teclado</h1>
            <p className="mt-1 text-sm text-muted-foreground">Clique numa combinação e pressione a nova. Esc cancela.</p>
          </div>
          <button onClick={() => { apply({}); setMsg(null); setRec(null); }} disabled={!Object.keys(overrides).length}
            className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40">Restaurar todos</button>
        </div>
        {isTauri && atalhoGlobal && (
          <div className="mt-6 rounded-xl border px-4 py-3">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={atalhoGlobal.ligado} onChange={(e) => atalhoGlobal.setLigado(e.target.checked)} />
              <span>
                <span className="font-medium">Captura rápida também fora do Margem</span>
                <span className="block text-xs text-muted-foreground">Com o app aberto em segundo plano ou minimizado, o atalho “Captura rápida” (abaixo) traz a janela e abre a anotação. Funciona no Windows; no Linux com Wayland o sistema não permite. Se outro programa já usa a combinação, troque-a abaixo.</span>
              </span>
            </label>
            {atalhoGlobal.ligado && atalhoGlobal.erro && <Estado tipo="warn" className="mt-2 text-xs">Não deu para ativar: {atalhoGlobal.erro}</Estado>}
            {temBandeja() && (
              <label className="mt-3 flex items-start gap-3 border-t pt-3 text-sm">
                <input type="checkbox" className="mt-1" checked={!!atalhoGlobal.bandeja} onChange={(e) => atalhoGlobal.setBandeja(e.target.checked)} />
                <span>
                  <span className="font-medium">Manter o Margem na bandeja ao fechar a janela</span>
                  <span className="block text-xs text-muted-foreground">Fechar a janela só a esconde; o app continua rodando perto do relógio e o atalho acima segue valendo. Clique no ícone para abrir, ou use o menu dele para sair de vez.</span>
                  {atalhoGlobal.bandeja && atalhoGlobal.erroBandeja && <Estado tipo="warn" className="mt-1 text-xs">Não deu para ativar: {atalhoGlobal.erroBandeja}</Estado>}
                </span>
              </label>
            )}
          </div>
        )}
        <ul className="mt-6 divide-y rounded-xl border">
          {ACTIONS.map((a) => {
            const changed = map[a.id] !== a.def;
            return (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{a.label}</div>
                  {msg?.id === a.id && <Estado tipo="warn" className="mt-0.5 text-xs">{msg.text}</Estado>}
                </div>
                <button onClick={() => { setRec(rec === a.id ? null : a.id); setMsg(null); }}
                  className={cn("min-w-[9rem] rounded-md border px-3 py-1.5 text-center font-mono text-xs hover:border-primary/50", rec === a.id && "border-primary bg-accent")}>
                  {rec === a.id ? "Pressione…" : pretty(map[a.id])}
                </button>
                <button title="Restaurar o padrão" aria-label="Restaurar o padrão" disabled={!changed} onClick={() => setCombo(a.id, a.def)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-0"><RotateCcw className="h-3.5 w-3.5" /></button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">Ctrl + roda do mouse (zoom) e os botões laterais do mouse (voltar/avançar) são fixos.</p>
      </div>
    </div>
  );
}
