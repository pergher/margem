import { useRef } from "react";

/** Divisória arrastável. `side` indica de que lado do handle está o painel redimensionado. */
export function ResizeHandle({ width, setWidth, min, max, side = "left" }) {
  const drag = useRef(null);
  const down = (e) => {
    e.preventDefault();
    drag.current = { x: e.clientX, w: width };
    const move = (ev) => {
      const d = ev.clientX - drag.current.x;
      setWidth(Math.max(min, Math.min(max, drag.current.w + (side === "left" ? d : -d))));
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); document.body.style.cursor = ""; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    document.body.style.cursor = "col-resize";
  };
  return (
    <div role="separator" aria-orientation="vertical" onMouseDown={down} onDoubleClick={() => setWidth(Math.round((min + max) / 2.4))}
      className="group relative z-10 -mx-[3px] w-[6px] shrink-0 cursor-col-resize">
      <div className="mx-auto h-full w-px bg-border transition-colors group-hover:w-[3px] group-hover:bg-primary/50" />
    </div>
  );
}
