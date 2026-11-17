import { useEffect, useState } from "react";
import { invoke, srcDeImagem } from "@/lib/api";

export function Foto({ nome, zoom, rot, lupa }) {
  const [src, setSrc] = useState(null);
  const [mira, setMira] = useState(null); // posição do mouse na imagem (0–1)
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    if (!aberta) return;
    const esc = (e) => { if (e.key === "Escape") { e.preventDefault(); setAberta(false); } };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberta]);
  useEffect(() => {
    setSrc(null);
    if (nome) invoke("read_embed", { target: nome }).then((r) => setSrc(srcDeImagem(r))).catch(() => setSrc(null));
  }, [nome]);
  if (!nome) return <div className="p-4 text-xs text-muted-foreground">Sem foto.</div>;
  if (!src) return <div className="p-4 text-xs text-muted-foreground">{nome}: imagem não encontrada.</div>;
  const ativa = lupa && rot === 0;
  const mover = (e) => { const r = e.currentTarget.getBoundingClientRect(); setMira({ w: r.width, h: r.height, px: e.clientX - r.left, py: e.clientY - r.top }); };
  const L = 360, Z = 3; // diâmetro da lupa e aumento
  return (
    <div className="relative" style={{ width: `${zoom * 100}%`, maxWidth: "none", margin: rot % 180 ? `${zoom * 20}% 0` : 0, cursor: ativa ? "none" : undefined }}
      onMouseMove={ativa ? mover : undefined} onMouseLeave={() => setMira(null)} onClick={() => setAberta(true)} title="Clique para ampliar">
      <img src={src} alt={nome} style={{ width: "100%", transform: `rotate(${rot}deg)` }} className="block rounded bg-white shadow" draggable={false} />
      {ativa && mira && (
        <div aria-hidden className="pointer-events-none absolute rounded-full border-2 border-primary shadow-xl"
          style={{ width: L, height: L, left: mira.px - L / 2, top: mira.py - L / 2, backgroundImage: `url(${src})`, backgroundRepeat: "no-repeat",
            backgroundSize: `${mira.w * Z}px ${mira.h * Z}px`, backgroundPosition: `${L / 2 - mira.px * Z}px ${L / 2 - mira.py * Z}px` }} />
      )}
      {aberta && (
        <div role="dialog" aria-label={`Foto ${nome} ampliada`} onClick={(e) => { e.stopPropagation(); setAberta(false); }} className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4">
          <img src={src} alt={nome} className="max-h-full max-w-full rounded bg-white object-contain shadow-2xl" />
          <span className="absolute right-4 top-3 text-xs text-white/70">Esc ou clique para fechar</span>
        </div>
      )}
    </div>
  );
}
