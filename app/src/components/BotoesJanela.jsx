import { useEffect, useState } from "react";
import { IconMinus as Minus, IconSquare as Square, IconCopy as Copy, IconX as X } from "@tabler/icons-react";
import { isTauri } from "@/lib/api";
import { cn } from "@/lib/utils";

// A janela não tem moldura nativa (decorations: false): estes são os botões dela. Só no desktop.
export const temBotoesJanela = isTauri && typeof navigator !== "undefined" && !/Android/i.test(navigator.userAgent);

function Botao({ label, onClick, perigo, children }) {
  return (
    <button aria-label={label} title={label} onClick={onClick}
      className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors", perigo ? "hover:bg-err hover:text-white" : "hover:bg-accent hover:text-foreground")}>
      {children}
    </button>
  );
}

export default function BotoesJanela() {
  const [janela, setJanela] = useState(null);
  const [maxi, setMaxi] = useState(false);
  useEffect(() => {
    if (!temBotoesJanela) return;
    let fim = () => {};
    let vivo = true;
    import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      if (!vivo) return;
      const w = getCurrentWindow();
      setJanela(w);
      setMaxi(await w.isMaximized());
      fim = await w.onResized(async () => setMaxi(await w.isMaximized()));
    }).catch(() => {});
    return () => { vivo = false; fim(); };
  }, []);
  if (!temBotoesJanela || !janela) return null;
  return (
    <div className="ml-1 flex items-center gap-1">
      <Botao label="Minimizar" onClick={() => janela.minimize()}><Minus className="h-4 w-4" /></Botao>
      <Botao label={maxi ? "Restaurar" : "Maximizar"} onClick={() => janela.toggleMaximize()}>{maxi ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}</Botao>
      <Botao label="Fechar" perigo onClick={() => janela.close()}><X className="h-4 w-4" /></Botao>
    </div>
  );
}
