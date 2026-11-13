/** Marca do Margem: página com a linha de margem do caderno. Usa as cores do tema. */
export function Logo({ className = "h-8 w-8", titulo = "Margem" }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={titulo} className={className}>
      <rect width="64" height="64" rx="14" className="fill-primary" />
      <rect x="17" y="12" width="30" height="40" rx="3" fill="#f9f7f2" />
      <rect x="21" y="12" width="2.5" height="40" fill="#c8574e" />
      <g fill="#7a9a9a"><rect x="28" y="20" width="14" height="3" rx="1.5" /><rect x="28" y="27" width="14" height="3" rx="1.5" /><rect x="28" y="34" width="9" height="3" rx="1.5" /><rect x="28" y="41" width="12" height="3" rx="1.5" /></g>
    </svg>
  );
}
