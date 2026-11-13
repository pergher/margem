import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

function buildTree(items, dirs) {
  const root = { dirs: new Map(), files: [] };
  for (const d of dirs) {
    let node = root;
    for (const part of d.split("/").filter(Boolean)) {
      if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] });
      node = node.dirs.get(part);
    }
  }
  for (const it of items) {
    const parts = it.rel.split("/");
    let node = root;
    for (const d of parts.slice(0, -1)) {
      if (!node.dirs.has(d)) node.dirs.set(d, { dirs: new Map(), files: [] });
      node = node.dirs.get(d);
    }
    node.files.push(it);
  }
  return root;
}

const byName = (a, b) => a.localeCompare(b, "pt-BR", { numeric: true });

function Node({ node, depth, open, toggle, current, onOpen, prefix, hl, dnd, menu, root }) {
  const pad = { paddingLeft: 8 + depth * 14 };
  return (
    <>
      {[...node.dirs.keys()].sort(byName).map((d) => {
        const key = prefix + d + "/";
        const isOpen = open.has(key);
        return (
          <div key={key}>
            <button onClick={() => toggle(key)} style={pad} data-key={key}
              draggable onDragStart={dnd.start(root + key.slice(0, -1))} onDragEnd={dnd.end}
              onDragOver={dnd.over(key)} onDragLeave={dnd.leave} onDrop={dnd.drop(root + key.slice(0, -1))}
              onContextMenu={menu({ kind: "dir", path: root + key.slice(0, -1), name: d })}
              className={cn("flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm hover:bg-accent", (hl === key || dnd.over_ === key) && "bg-accent ring-1 ring-primary/40")}>
              <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen && "rotate-90")} />
              {isOpen ? <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="truncate">{d}</span>
            </button>
            {isOpen && <Node {...{ open, toggle, current, onOpen, hl, dnd, menu, root }} node={node.dirs.get(d)} depth={depth + 1} prefix={key} />}
          </div>
        );
      })}
      {node.files.sort((a, b) => byName(a.name, b.name)).map((f) => (
        <button key={f.path} onClick={() => onOpen(f.path)} title={f.rel} data-path={f.path} style={{ paddingLeft: 8 + depth * 14 + 18 }}
          draggable onDragStart={dnd.start(f.path)} onDragEnd={dnd.end}
          onContextMenu={menu({ kind: "note", path: f.path, name: f.name })}
          className={cn("flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm hover:bg-accent", current === f.path && "bg-accent font-medium")}>
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{f.name}</span>
        </button>
      ))}
    </>
  );
}

const ancestors = (rel) => { const p = rel.split("/").slice(0, -1); return p.map((_, i) => p.slice(0, i + 1).join("/") + "/"); };

/** `reveal` = { key: "Pasta/Sub/", n } expande e destaca a pasta; `currentRel` expande a pasta da nota aberta. */
export function FileTree({ items, dirs = [], current, currentRel, reveal, onOpen, onCreate, onCreateFolder, onRename, onDelete, onMove }) {
  const [open, setOpen] = useState(() => new Set());
  const [hl, setHl] = useState(null);
  const tree = useMemo(() => buildTree(items, dirs), [items, dirs]);
  const root = useMemo(() => (items[0] ? items[0].path.slice(0, -items[0].rel.length) : ""), [items]);
  const [menuAt, setMenuAt] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const dragging = useRef(null);
  const expandT = useRef(null);
  const menu = (target) => (e) => { e.preventDefault(); e.stopPropagation(); setMenuAt({ x: e.clientX, y: e.clientY, target }); };
  const dnd = {
    over_: overKey,
    start: (path) => (e) => { dragging.current = path; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", path); },
    end: () => { dragging.current = null; setOverKey(null); clearTimeout(expandT.current); },
    over: (key) => (e) => {
      if (!dragging.current) return;
      e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move";
      if (overKey !== key) { setOverKey(key); clearTimeout(expandT.current); expandT.current = setTimeout(() => setOpen((s) => new Set([...s, key])), 700); }
    },
    leave: () => { clearTimeout(expandT.current); setOverKey(null); },
    drop: (dirPath) => (e) => {
      e.preventDefault(); e.stopPropagation();
      const p = dragging.current; dnd.end();
      if (p) onMove(p, dirPath);
    },
  };
  useEffect(() => {
    if (!menuAt) return;
    const close = () => setMenuAt(null);
    const esc = (e) => e.key === "Escape" && close();
    window.addEventListener("mousedown", close); window.addEventListener("keydown", esc); window.addEventListener("blur", close);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); window.removeEventListener("blur", close); };
  }, [menuAt]);
  const toggle = (k) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const scrollTo = (sel) => setTimeout(() => document.querySelector(sel)?.scrollIntoView({ block: "nearest" }), 30);

  useEffect(() => {
    if (!currentRel) return;
    setOpen((s) => new Set([...s, ...ancestors(currentRel)]));
    scrollTo(`[data-path="${CSS.escape(current)}"]`);
  }, [currentRel]);
  useEffect(() => {
    if (!reveal) return;
    setOpen((s) => new Set([...s, ...ancestors(reveal.key + "x"), reveal.key]));
    setHl(reveal.key);
    scrollTo(`[data-key="${CSS.escape(reveal.key)}"]`);
    const t = setTimeout(() => setHl(null), 2500);
    return () => clearTimeout(t);
  }, [reveal]);

  const t = menuAt?.target;
  const dirOf = t ? (t.kind === "dir" ? t.path : t.path.slice(0, t.path.lastIndexOf("/"))) : root.replace(/\/$/, "");
  const entries = t ? [
    ["Novo arquivo aqui", () => onCreate(dirOf)],
    ["Nova pasta aqui", () => onCreateFolder(dirOf)],
    ["Renomear…", () => onRename(t)],
    ["Excluir", () => onDelete(t), true],
  ] : [["Novo arquivo na raiz", () => onCreate(root.replace(/\/$/, ""))], ["Nova pasta na raiz", () => onCreateFolder(root.replace(/\/$/, ""))]];
  return (
    <div className="min-h-[60vh]" onContextMenu={menu(null)}
      onDragOver={dnd.over("")} onDragLeave={dnd.leave} onDrop={dnd.drop(root.replace(/\/$/, ""))}>
      <Node node={tree} depth={0} open={open} toggle={toggle} current={current} onOpen={onOpen} prefix="" hl={hl} dnd={dnd} menu={menu} root={root} />
      {menuAt && (
        <div role="menu" style={{ left: menuAt.x, top: menuAt.y }} onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-50 min-w-44 rounded-md border bg-background p-1 text-sm shadow-lg">
          {entries.map(([label, fn, danger]) => (
            <button key={label} role="menuitem" onClick={() => { setMenuAt(null); fn(); }}
              className={cn("block w-full rounded px-3 py-1.5 text-left hover:bg-accent", danger && "text-err")}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
