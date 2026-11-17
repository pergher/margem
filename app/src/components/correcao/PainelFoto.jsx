import { IconSearch as Search, IconZoomIn as ZoomIn, IconZoomOut as ZoomOut, IconRotateClockwise2 as RotateCw } from "@tabler/icons-react";
import { CAB } from "./estilos";
import { Foto } from "./Foto";

export function PainelFoto({ largura, a, zoom, setZoom, rot, setRot, lupa, setLupa }) {
  return (
        <section aria-label="Foto do manuscrito" style={{ width: largura, minWidth: 120 }} className="flex shrink flex-col bg-muted">
          <div className={CAB + " bg-background"}><span className="flex-1 truncate font-semibold">{a.foto ?? "Manuscrito"}</span>
            <button aria-label="Lupa" title="Lupa ao passar o mouse (foto sem girar)" onClick={() => setLupa(!lupa)} className={lupa ? "text-primary" : "text-muted-foreground hover:text-foreground"}><Search className="h-4 w-4" /></button>
            <button aria-label="Diminuir foto" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="text-muted-foreground hover:text-foreground"><ZoomOut className="h-4 w-4" /></button>
            <button aria-label="Aumentar foto" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="text-muted-foreground hover:text-foreground"><ZoomIn className="h-4 w-4" /></button>
            <button aria-label="Girar foto" onClick={() => setRot((r) => (r + 90) % 360)} className="text-muted-foreground hover:text-foreground"><RotateCw className="h-4 w-4" /></button></div>
          <div className="min-h-0 flex-1 overflow-auto p-4"><Foto nome={a.foto} zoom={zoom} rot={rot} lupa={lupa} /></div>
        </section>
  );
}
