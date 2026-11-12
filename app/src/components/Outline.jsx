import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/** Cabeçalhos (#..######) do texto, ignorando frontmatter e blocos de código. */
export function headingsOf(text) {
  const out = [];
  const lines = text.split("\n");
  let pos = 0, fence = false, i = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, k) => k > 0 && l.trim() === "---");
    if (end > 0) { for (; i <= end; i++) pos += lines[i].length + 1; }
  }
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    else if (!fence) {
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(l);
      if (m) out.push({ level: m[1].length, title: m[2].replace(/[*_`]|\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1"), pos });
    }
    pos += l.length + 1;
  }
  return out;
}

export function Outline({ headings, active, onGo }) {
  const min = headings.length ? Math.min(...headings.map((h) => h.level)) : 1;
  return (
    <>
      <ScrollArea className="flex-1 px-2 py-2">
        {headings.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">Sem títulos.</p>}
        {headings.map((h, i) => (
          <button key={i} onClick={() => onGo(h.pos)} title={h.title} style={{ paddingLeft: 8 + (h.level - min) * 12 }}
            className={cn("block w-full truncate rounded-md py-1 pr-2 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground", h.level === min && "font-medium text-foreground/90", active === i && "bg-accent text-foreground")}>
            {h.title}
          </button>
        ))}
      </ScrollArea>
    </>
  );
}
