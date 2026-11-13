import { Fragment } from "react";

const RE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|(?<![\w])_[^_\s][^_]*_(?![\w])|`[^`]+`|~~[^~]+~~)/g;

/** Texto de uma linha com Markdown inline (negrito, itálico, código, riscado); [[links]] viram só o nome. */
export function Inline({ texto }) {
  const limpo = String(texto ?? "").replace(/!?\[\[([^\]|]*\|)?([^\]]+)\]\]/g, "$2");
  return <>{limpo.split(RE).map((p, i) => {
    if (!p) return null;
    if (/^(\*\*|__)[\s\S]+\1$/.test(p)) return <strong key={i}><Inline texto={p.slice(2, -2)} /></strong>;
    if (/^~~[\s\S]+~~$/.test(p)) return <del key={i}><Inline texto={p.slice(2, -2)} /></del>;
    if (/^`[\s\S]+`$/.test(p)) return <code key={i} className="rounded bg-muted px-1 text-[0.9em]">{p.slice(1, -1)}</code>;
    if (/^([*_])[\s\S]+\1$/.test(p)) return <em key={i}><Inline texto={p.slice(1, -1)} /></em>;
    return <Fragment key={i}>{p}</Fragment>;
  })}</>;
}
