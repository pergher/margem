/** Marca do Margem: os colchetes [ ] do markdown, com o ponto como marca de anotação. Usa as cores do tema. */
export function Logo({ className = "h-8 w-8", titulo = "Margem" }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={titulo} className={className}>
      <rect width="64" height="64" rx="14" className="fill-primary" />
      <path d="M26 15h-8v34h8 M38 15h8v34h-8" fill="none" stroke="#f9f7f2" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="4.5" fill="#f08a7e" />
    </svg>
  );
}
