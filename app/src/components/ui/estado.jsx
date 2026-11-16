import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { IconAlertTriangle as AlertTriangle, IconAlertCircle as CircleAlert, IconCircleCheck as CircleCheck, IconInbox as Inbox, IconLoader2 as Loader2, IconX as X } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// Estado fixo da interface (certo / atenção / erro): sempre cor + ícone + texto, nunca só cor.
const T = {
  ok: { Icon: CircleCheck, cor: "text-ok" },
  warn: { Icon: AlertTriangle, cor: "text-warn" },
  err: { Icon: CircleAlert, cor: "text-err" },
};

export function Estado({ tipo = "warn", inline, className, children }) {
  const { Icon, cor } = T[tipo];
  const Tag = inline ? "span" : "div";
  return (
    <Tag role={tipo === "err" ? "alert" : undefined} className={cn(inline ? "inline-flex" : "flex", "items-start gap-1.5", cor, className)}>
      <Icon aria-hidden className="mt-[3px] h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </Tag>
  );
}

/** Página ou painel carregando: ícone girando + texto, anunciado a leitores de tela. */
export function Carregando({ children = "Carregando…", className }) {
  return (
    <div role="status" className={cn("flex items-center gap-2 p-8 text-sm text-muted-foreground", className)}>
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.8} />{children}
    </div>
  );
}

/** Nada para mostrar ainda: diz o que falta e oferece o primeiro passo (`acao` = botão opcional). */
export function Vazio({ titulo, children, acao, className }) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center gap-2 p-10 text-center", className)}>
      <Inbox aria-hidden className="h-8 w-8 text-muted-foreground" strokeWidth={1.4} />
      <div className="text-sm font-semibold">{titulo}</div>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
      {acao && <button onClick={acao.onClick} className="mt-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">{acao.rotulo}</button>}
    </div>
  );
}

/** Erro de página: borda e ícone do estado "erro" + ação opcional ("Procurar o arquivo"). */
export function Erro({ children, acao, className }) {
  return (
    <div role="alert" className={cn("m-8 flex items-start gap-3 rounded-xl border border-err/40 bg-err/10 p-4 text-sm", className)}>
      <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-err" strokeWidth={2} />
      <div className="min-w-0 flex-1 text-err">{children}</div>
      {acao && <button onClick={acao.onClick} className="shrink-0 rounded-md border px-3 py-1 text-foreground hover:bg-accent">{acao.rotulo}</button>}
    </div>
  );
}

const ToastCtx = createContext(() => {});
/** `const toast = useToast(); toast("Salvo.", { tipo: "ok", acao: { rotulo: "Abrir pasta", onClick } })` */
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef(null);
  const mostrar = useCallback((texto, { tipo = "ok", acao, ms = 5000 } = {}) => {
    clearTimeout(timer.current);
    setT({ texto, tipo, acao });
    timer.current = setTimeout(() => setT(null), tipo === "err" ? Math.max(ms, 8000) : ms);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-10 z-50 flex justify-center px-4">
        {t && (
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border bg-background px-4 py-2.5 text-sm shadow-lg">
            <Estado tipo={t.tipo} inline>{t.texto}</Estado>
            {t.acao && <button onClick={() => { t.acao.onClick(); setT(null); }} className="shrink-0 rounded-md border px-2.5 py-1 text-xs hover:bg-accent">{t.acao.rotulo}</button>}
            <button aria-label="Fechar aviso" onClick={() => setT(null)} className="shrink-0 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}
