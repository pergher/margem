import { AlertTriangle, CircleAlert, CircleCheck } from "lucide-react";
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
