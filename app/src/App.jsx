import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@/lib/api";
import { BookOpen, HeartPulse, ArrowLeft, ArrowRight, CalendarCheck, CalendarDays, PenLine, FileCheck, FolderTree, ListTree, PanelLeft, Settings, Search, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileTree } from "@/components/FileTree";
import { Editor } from "@/components/Editor";
import { ResizeHandle } from "@/components/ResizeHandle";
import { Outline, headingsOf } from "@/components/Outline";
import { RightPanel } from "@/components/RightPanel";
import { setProp, lineStart } from "@/lib/frontmatter";
import { CommandPalette } from "@/components/CommandPalette";
import { SearchModal } from "@/components/SearchModal";
import { EntryDialog } from "@/components/EntryDialog";
import { AnoPage } from "@/components/AnoPage";
import { ProvaPage } from "@/components/ProvaPage";
import { ProvaDaNota } from "@/components/ProvaDaNota";
import { TextoDaNota } from "@/components/TextoDaNota";
import { CorrecaoPage } from "@/components/CorrecaoPage";
import { SemanaPage } from "@/components/SemanaPage";
import { SaudePage } from "@/components/SaudePage";
import { DiarioPage } from "@/components/DiarioPage";
import { CicloPage } from "@/components/CicloPage";
import { capturing } from "@/components/ShortcutsPage";
import { SettingsPage } from "@/components/SettingsPage";
import { CicloDaNota } from "@/components/CicloDaNota";
import { visaoDe } from "@/lib/visoes";
import { loadFromDisk, loadOverrides, effective, comboOf, pretty } from "@/lib/shortcuts";

function RailButton({ label, active, onClick, disabled, size = "lg", children }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={cn("flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
        size === "lg" ? "h-10 w-10" : "h-8 w-8", active && "bg-accent text-foreground")}>
      {children}
    </button>
  );
}

const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const AUTOSAVE_MS = 800;

export default function App() {
  const [items, setItems] = useState([]);
  const [dirs, setDirs] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [undo, setUndo] = useState(null);
  const [info, setInfo] = useState(null);
  const [propsText, setPropsText] = useState("");
  const [panelTab, setPanelTab] = useState(() => store.get("painel", "sumario"));
  const [current, setCurrent] = useState(null);
  const [status, setStatus] = useState("");
  const [words, setWords] = useState(0);
  const [headings, setHeadings] = useState([]);
  const [activeHeading, setActiveHeading] = useState(-1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [navTick, setNavTick] = useState(0);
  const [dark, setDark] = useState(() => store.get("tema", "light") === "dark");
  const [zoom, setZoom] = useState(() => store.get("zoom", 1));
  const [sideW, setSideW] = useState(() => store.get("sideW", 288));
  const [outlineW, setOutlineW] = useState(() => store.get("outlineW", 240));
  const [overrides, setOverrides] = useState(loadOverrides);
  const [page, setPage] = useState("semana");
  const [ciclo, setCiclo] = useState(null);
  const [textoAtiv, setTextoAtiv] = useState(null);
  const [showSide, setShowSide] = useState(() => store.get("side", true));
  const [showOutline, setShowOutline] = useState(() => store.get("outline", true));
  const ed = useRef(null);
  const cur = useRef(null);          // caminho aberto
  const dirty = useRef(false);
  const timer = useRef(null);
  const hist = useRef({ stack: [], idx: -1 });

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); store.set("tema", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { store.set("sideW", sideW); }, [sideW]);
  useEffect(() => { store.set("outlineW", outlineW); }, [outlineW]);
  useEffect(() => { store.set("outline", showOutline); }, [showOutline]);
  useEffect(() => { store.set("painel", panelTab); }, [panelTab]);
  useEffect(() => { store.set("side", showSide); }, [showSide]);
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * zoom}px`;
    store.set("zoom", zoom);
    ed.current?.remeasure();
  }, [zoom]);
  useEffect(() => { loadFromDisk().then((o) => o && setOverrides(o)); }, []);
  const refresh = useCallback(() => Promise.all([invoke("list_notes"), invoke("list_dirs")]).then(([n, d]) => { setItems(n); setDirs(d); }).catch((e) => setStatus(String(e))), []);
  useEffect(() => { refresh(); }, [refresh]);

  const refreshInfo = useCallback(async (path) => {
    try { const i = await invoke("note_info", { path }); if (path === cur.current) setInfo(i); } catch { /* nota sumiu ou ainda não existe */ }
  }, []);

  // ---------- salvar ----------
  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (!cur.current || !dirty.current) return;
    const path = cur.current, text = ed.current.getText();
    dirty.current = false;
    try { await invoke("save_note", { path, text }); refreshInfo(path); setHistTick((n) => n + 1); setStatus("Salvo às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })); }
    catch (e) { dirty.current = true; console.error("save_note falhou", path, e); setStatus("Erro ao salvar: " + e); }
  }, [refreshInfo]);
  useEffect(() => {
    const flush = () => { save(); };
    window.addEventListener("blur", flush);
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("blur", flush); window.removeEventListener("beforeunload", flush); };
  }, [save]);

  const onChange = (d) => {
    const text = d.toString();
    dirty.current = true; setStatus("Editando…");
    setWords(text.split(/\s+/).filter(Boolean).length);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { const t = ed.current.getText(); setHeadings(headingsOf(t)); setPropsText(t); save(); }, AUTOSAVE_MS);
  };

  // ---------- abrir / histórico ----------
  const load = async (path) => {
    setPage("editor");
    await save();
    const text = await invoke("read_note", { path });
    ed.current.setText(text);
    cur.current = path; dirty.current = false;
    setCurrent(path); setStatus(""); setActiveHeading(-1);
    setWords(text.split(/\s+/).filter(Boolean).length);
    setHeadings(headingsOf(text)); setPropsText(text); setInfo(null); refreshInfo(path);
  };
  const [histTick, setHistTick] = useState(0);
  // Depois de "Restaurar" o arquivo já foi gravado no disco: só atualiza o editor e os painéis.
  const restoreText = (text) => {
    ed.current.setText(text); dirty.current = false;
    setWords(text.split(/\s+/).filter(Boolean).length); setHeadings(headingsOf(text)); setPropsText(text);
    refreshInfo(cur.current); setHistTick((n) => n + 1); setStatus("Versão restaurada");
  };
  const open = async (path) => {
    setPage("editor");
    if (path === cur.current) return;
    const h = hist.current;
    h.stack = [...h.stack.slice(0, h.idx + 1), path]; h.idx = h.stack.length - 1;
    setNavTick((n) => n + 1);
    await load(path);
  };
  const go = async (delta) => {
    const h = hist.current, i = h.idx + delta;
    if (i < 0 || i >= h.stack.length) return;
    h.idx = i; setNavTick((n) => n + 1);
    await load(h.stack[i]);
  };
  const canBack = hist.current.idx > 0, canFwd = hist.current.idx < hist.current.stack.length - 1;
  const link = async (t) => {
    const p = await invoke("resolve_link", { target: t });
    p ? open(p) : setStatus(`Link não resolvido: ${t}`);
  };

  // ---------- gerenciar notas e pastas ----------
  const under = (p, base) => p === base || p.startsWith(base + "/");
  const remap = (from, to) => {
    const sub = (p) => (p && under(p, from) ? to + p.slice(from.length) : p);
    const h = hist.current; h.stack = h.stack.map(sub);
    if (cur.current) { cur.current = sub(cur.current); setCurrent(cur.current); }
  };
  const fail = (e) => setStatus("Erro: " + e);
  const createNote = (dir) => setDialog({ title: "Nova nota", input: true, okLabel: "Criar", onOk: async (name) => {
    const p = await invoke("create_note", { dir, name }); await refresh(); open(p);
  } });
  const createFolder = (dir) => setDialog({ title: "Nova pasta", input: true, okLabel: "Criar", onOk: async (name) => {
    await invoke("create_folder", { dir, name }); await refresh();
    setReveal({ key: (dir ? dir.slice(items[0]?.path.length - items[0]?.rel.length) + "/" : "") .replace(/^\//, "") + name + "/", n: Date.now() });
  } });
  const renameEntry = (t) => setDialog({ title: t.kind === "dir" ? "Renomear pasta" : "Renomear nota", input: true, initial: t.name, okLabel: "Renomear", onOk: async (name) => {
    if (name === t.name) return;
    await save();
    const r = await invoke("rename_entry", { path: t.path, name }); remap(t.path, r.path); await refresh();
    setStatus(t.kind === "note" ? `Renomeada; ${r.links} link(s) atualizado(s)` : "Pasta renomeada");
  } });
  const deleteEntry = (t) => setDialog({ title: "Excluir", message: `Mover “${t.name}” para a lixeira do vault (.lixeira)?`, okLabel: "Excluir", danger: true, onOk: async () => {
    await save();
    await invoke("delete_entry", { path: t.path });
    if (cur.current && under(cur.current, t.path)) { cur.current = null; dirty.current = false; ed.current.setText(""); setCurrent(null); setHeadings([]); setWords(0); }
    hist.current.stack = hist.current.stack.filter((p) => !under(p, t.path)); hist.current.idx = Math.min(hist.current.idx, hist.current.stack.length - 1);
    setNavTick((n) => n + 1);
    await refresh(); setStatus(`“${t.name}” movida para .lixeira`);
  } });
  const moveEntry = async (path, dir) => {
    try {
      await save();
      const r = await invoke("move_entry", { path, dir });
      if (r.path === path) return;
      const oldDir = path.slice(0, path.lastIndexOf("/"));
      remap(path, r.path); await refresh();
      setUndo({ from: r.path, dir: oldDir, nome: r.path.split("/").pop() });
      setStatus(`Movido: ${r.path.split("/").pop()}`);
    } catch (e) { fail(e); }
  };
  const undoMove = async () => {
    const u = undo; setUndo(null); if (!u) return;
    try { await save(); const r = await invoke("move_entry", { path: u.from, dir: u.dir }); remap(u.from, r.path); await refresh(); setStatus("Movimento desfeito"); } catch (e) { fail(e); }
  };

  // ---------- atalhos ----------
  const kb = useRef({});
  kb.current = { go, save, page, map: effective(overrides) };
  useEffect(() => {
    const zoomBy = (d) => setZoom((z) => clamp(Math.round((z + d) * 10) / 10, 0.7, 2));
    const run = {
      search: () => setSearchOpen(true),
      palette: () => setPaletteOpen(true),
      save: () => kb.current.save(),
      insertTable: () => { if (cur.current && kb.current.page === "editor") ed.current.insertTable(); },
      toggleSide: () => setShowSide((v) => !v),
      back: () => kb.current.go(-1),
      forward: () => kb.current.go(1),
      zoomIn: () => zoomBy(0.1),
      zoomOut: () => zoomBy(-0.1),
      zoomReset: () => setZoom(1),
    };
    const onKey = (e) => {
      if (capturing) return;
      const c = comboOf(e);
      if (!c) return;
      const id = Object.keys(kb.current.map).find((k) => kb.current.map[k] === c);
      if (!id) return;
      e.preventDefault(); e.stopPropagation();
      run[id]();
    };
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => clamp(Math.round((z + (e.deltaY < 0 ? 0.1 : -0.1)) * 10) / 10, 0.7, 2));
    };
    const onMouse = (e) => { if (e.button === 3) { e.preventDefault(); kb.current.go(-1); } else if (e.button === 4) { e.preventDefault(); kb.current.go(1); } };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mouseup", onMouse);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("wheel", onWheel); window.removeEventListener("mouseup", onMouse); };
  }, []);

  const keys = effective(overrides);
  const commands = [
    { id: "p-editor", label: "Ir para o editor", run: () => setPage("editor") },
    { id: "p-semana", label: "Ir para Esta semana", hint: "aula dar aula turma", run: () => setPage("semana") },
    { id: "p-ano", label: "Ir para Planejamento do ano", hint: "ciclo", run: () => setPage("ano") },
    { id: "p-diario", label: "Ir para Diário e alunos", hint: "ocorrência conselho", run: () => setPage("diario") },
    { id: "p-saude", label: "Ir para Saúde do vault", hint: "avisos validar problemas", run: () => setPage("saude") },
    { id: "p-correcao", label: "Ir para Correções", hint: "redações produções", run: () => setPage("correcao") },
    { id: "p-prova", label: "Ir para Montar prova", run: () => setPage("prova") },
    { id: "p-config", label: "Ir para Configurações", run: () => setPage("config") },
    { id: "buscar", label: "Buscar nota", keys: pretty(keys.search), run: () => setSearchOpen(true) },
    { id: "salvar", label: "Salvar agora", keys: pretty(keys.save), run: () => save() },
    { id: "tabela", label: "Inserir tabela", keys: pretty(keys.insertTable), run: () => { if (cur.current) { setPage("editor"); setTimeout(() => ed.current?.insertTable(), 50); } } },
    { id: "nota", label: "Nova nota", hint: "criar", run: () => createNote(items[0] ? items[0].path.slice(0, items[0].path.length - items[0].rel.length - 1) : "") },
    { id: "lado", label: "Ocultar/mostrar arquivos (coluna 1)", keys: pretty(keys.toggleSide), run: () => setShowSide((v) => !v) },
    { id: "painel", label: "Ocultar/mostrar painel lateral", run: () => setShowOutline((v) => !v) },
    { id: "tema", label: dark ? "Tema claro" : "Tema escuro", run: () => setDark((v) => !v) },
    { id: "voltar", label: "Voltar na navegação", keys: pretty(keys.back), run: () => go(-1) },
    { id: "avancar", label: "Avançar na navegação", keys: pretty(keys.forward), run: () => go(1) },
    { id: "zoom0", label: "Restaurar zoom", keys: pretty(keys.zoomReset), run: () => setZoom(1) },
  ];
  const rel = items.find((i) => i.path === current)?.rel;
  const visao = visaoDe(rel);
  const [prefVisao, setPrefVisao] = useState(() => store.get("visaoPorTipo", {}));
  const [verTick, setVerTick] = useState(0);
  const personalizada = !!visao && page === "editor" && prefVisao[visao.id] !== "markdown";
  const escolherVisao = (modo) => {
    const novo = { ...prefVisao, [visao.id]: modo }; setPrefVisao(novo); store.set("visaoPorTipo", novo);
    if (modo === "markdown" && cur.current) load(cur.current); // a tela pode ter gravado no disco: recarrega o editor
    else setVerTick((n) => n + 1);
  };
  const crumbs = rel ? rel.replace(/\.md$/, "").split("/") : [];
  const pick = async (path, line) => { setSearchOpen(false); await open(path); if (line) setTimeout(() => goLine(line), 50); };
  const goHeading = (pos, i) => { setActiveHeading(i); ed.current.goTo(pos); };
  const setProperty = (key, value) => {
    const t = setProp(ed.current.getText(), key, value);
    ed.current.replaceDoc(t); setPropsText(t);
  };
  const goLine = (line) => { ed.current.goTo(lineStart(ed.current.getText(), line)); };
  const outlineVisible = showOutline && !!current;

  return (
    <div className="flex h-full">
      <nav aria-label="Navegação" className="flex w-14 shrink-0 flex-col items-center gap-1.5 border-r bg-muted py-3">
        <RailButton label="Arquivos" active><FolderTree className="h-5 w-5" strokeWidth={1.6} /></RailButton>
        <RailButton label="Buscar" onClick={() => setSearchOpen(true)}><Search className="h-5 w-5" strokeWidth={1.6} /></RailButton>
        <RailButton label="Planejamento do ano" active={page === "ano" || page === "ciclo"} onClick={() => setPage(page === "ano" || page === "ciclo" ? "editor" : "ano")}><CalendarDays className="h-5 w-5" strokeWidth={1.6} /></RailButton>
        <RailButton label="Esta semana" active={page === "semana"} onClick={() => setPage(page === "semana" ? "editor" : "semana")}><CalendarCheck className="h-5 w-5" strokeWidth={1.6} /></RailButton>
        <RailButton label="Diário e alunos" active={page === "diario"} onClick={() => setPage(page === "diario" ? "editor" : "diario")}><BookOpen className="h-5 w-5" strokeWidth={1.6} /></RailButton>
        <RailButton label="Correções" active={page === "correcao"} onClick={() => setPage(page === "correcao" ? "editor" : "correcao")}><PenLine className="h-5 w-5" strokeWidth={1.6} /></RailButton>
        <RailButton label="Montar prova" active={page === "prova"} onClick={() => setPage(page === "prova" ? "editor" : "prova")}><FileCheck className="h-5 w-5" strokeWidth={1.6} /></RailButton>
        <div className="flex-1" />
        <RailButton label="Saúde do vault" active={page === "saude"} onClick={() => setPage(page === "saude" ? "editor" : "saude")}><HeartPulse className="h-5 w-5" strokeWidth={1.6} /></RailButton>
        <RailButton label="Configurações" active={page === "config"} onClick={() => setPage(page === "config" ? "editor" : "config")}><Settings className="h-5 w-5" strokeWidth={1.6} /></RailButton>
        <RailButton label={dark ? "Tema claro" : "Tema escuro"} onClick={() => setDark(!dark)}>
          {dark ? <Sun className="h-5 w-5" strokeWidth={1.6} /> : <Moon className="h-5 w-5" strokeWidth={1.6} />}
        </RailButton>
      </nav>

      {showSide && <aside style={{ width: sideW }} className="flex shrink-0 flex-col bg-muted/50">
        <div className="p-2.5">
          <button onClick={() => setSearchOpen(true)}
            className="flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-sm text-muted-foreground hover:border-primary/40">
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">Buscar nota…</span>
            <kbd className="text-[11px]">{pretty(keys.search).replace(/ /g, "")}</kbd>
          </button>
        </div>
        <ScrollArea className="flex-1 px-1.5 pb-2">
          <FileTree items={items} dirs={dirs} current={current} currentRel={rel} reveal={reveal} onOpen={open}
            onCreate={createNote} onCreateFolder={createFolder} onRename={renameEntry} onDelete={deleteEntry} onMove={moveEntry} />
        </ScrollArea>
      </aside>}
      {showSide && <ResizeHandle width={sideW} setWidth={setSideW} min={180} max={560} side="left" />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
          <RailButton size="sm" label={`Ocultar/mostrar arquivos (${pretty(keys.toggleSide)})`} active={showSide} onClick={() => setShowSide(!showSide)}><PanelLeft className="h-4 w-4" /></RailButton>
          <RailButton size="sm" label={`Voltar (${pretty(keys.back)})`} onClick={() => go(-1)} disabled={!canBack}><ArrowLeft className="h-4 w-4" /></RailButton>
          <RailButton size="sm" label={`Avançar (${pretty(keys.forward)})`} onClick={() => go(1)} disabled={!canFwd}><ArrowRight className="h-4 w-4" /></RailButton>
          <nav aria-label="Caminho" className="ml-2 flex min-w-0 items-center gap-1 truncate text-[13px] text-muted-foreground">
            {crumbs.length === 0 && <span>Selecione uma nota</span>}
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden>/</span>}
                  {last
                    ? <span className="font-medium text-foreground">{c}</span>
                    : <button title="Mostrar esta pasta na árvore" onClick={() => setReveal({ key: crumbs.slice(0, i + 1).join("/") + "/", n: Date.now() })}
                        className="rounded px-1 hover:bg-accent hover:text-foreground">{c}</button>}
                </span>
              );
            })}
          </nav>
          <div className="flex-1" />
          {visao && page === "editor" && (
            <div role="group" aria-label="Modo de exibição" className="flex overflow-hidden rounded-md border text-[13px]">
              <button onClick={() => escolherVisao("markdown")} className={cn("px-3 py-1", !personalizada ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent")}>1. Markdown</button>
              <button onClick={() => escolherVisao("personalizado")} className={cn("border-l px-3 py-1", personalizada ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent")}>2. {visao.nome}</button>
            </div>
          )}
          {info?.tipo === "texto" && current && page === "editor" && <button onClick={() => { setTextoAtiv(current); setPage("prova"); }} className="rounded-md border px-3 py-1 text-[13px] hover:bg-accent">Atividade a partir deste texto</button>}
          <RailButton size="sm" label="Painel lateral" active={outlineVisible} onClick={() => setShowOutline(!showOutline)}><ListTree className="h-4 w-4" /></RailButton>
        </header>

        {page === "config" && <SettingsPage overrides={overrides} setOverrides={setOverrides} items={items} onRefresh={refresh} />}
        {page === "ano" && <AnoPage items={items} onOpen={open} onRefresh={refresh} onCiclo={(c) => { setCiclo(c); setPage("ciclo"); }} />}
        {page === "prova" && <ProvaPage items={items} onOpen={open} onRefresh={refresh} textoInicial={textoAtiv} onUsouTexto={() => setTextoAtiv(null)} />}
        {page === "correcao" && <CorrecaoPage items={items} onOpen={open} />}
        {page === "semana" && <SemanaPage items={items} onOpen={open} onRefresh={refresh} />}
        {page === "diario" && <DiarioPage items={items} onOpen={open} onRefresh={refresh} />}
        {page === "saude" && <SaudePage items={items} onOpen={open} onRefresh={refresh} />}
        {page === "ciclo" && ciclo && <CicloPage ciclo={ciclo} items={items} onOpen={open} onAno={() => setPage("ano")} onChange={setCiclo} />}
        {personalizada && visao.id === "ciclo" && <CicloDaNota item={items.find((i) => i.path === current)} items={items} onOpen={open} tick={verTick} onAno={() => setPage("ano")} />}
        {personalizada && visao.id === "semana" && <SemanaPage items={items} onOpen={open} onRefresh={refresh} focoPath={current} />}
        {personalizada && visao.id === "prova" && <ProvaDaNota item={items.find((i) => i.path === current)} items={items} onOpen={open} tick={verTick} />}
        {personalizada && (visao.id === "diario" || visao.id === "aluno") && <DiarioPage items={items} onOpen={open} onRefresh={refresh} focoPath={current} />}
        {personalizada && visao.id === "texto" && <TextoDaNota item={items.find((i) => i.path === current)} onOpen={open} tick={verTick} onAtividade={() => { setTextoAtiv(current); setPage("prova"); }} />}
        {personalizada && visao.id === "correcao" && <CorrecaoPage items={items} onOpen={open} focoPath={current} />}
        <main className={cn("min-h-0 flex-1 overflow-auto", (page !== "editor" || personalizada) && "hidden")}>
          <Editor ref={ed} onChange={onChange} onSave={save} onLink={link} />
        </main>

        <footer className="flex h-[30px] shrink-0 items-center gap-5 border-t px-6 text-xs text-muted-foreground">
          <span>{status}</span>
          {undo && <button onClick={undoMove} className="text-primary hover:underline">Desfazer movimento</button>}
          <span className="flex-1" />
          {current && info?.issues.length > 0 && <button onClick={() => { setShowOutline(true); setPanelTab("links"); }} className="text-amber-600 hover:underline">{info.issues.length} aviso{info.issues.length > 1 ? "s" : ""}</button>}
          {current && <span>{words} palavras</span>}
          {zoom !== 1 && <button onClick={() => setZoom(1)} title={`Restaurar (${pretty(keys.zoomReset)})`} className="hover:text-foreground">{Math.round(zoom * 100)}%</button>}
          <span>Salva sozinho</span>
        </footer>
      </div>

      {outlineVisible && (
        <>
          <ResizeHandle width={outlineW} setWidth={setOutlineW} min={160} max={480} side="right" />
          <div style={{ width: outlineW }} className="shrink-0">
            <RightPanel tab={panelTab} setTab={setPanelTab} info={info} text={propsText} onSet={setProperty} onOpen={open} onGoLine={goLine} path={current} histTick={histTick} onRestore={restoreText}>
              <Outline headings={headings} active={activeHeading} onGo={(pos) => goHeading(pos, headings.findIndex((h) => h.pos === pos))} />
            </RightPanel>
          </div>
        </>
      )}

      {dialog && <EntryDialog {...dialog} onClose={() => { setDialog(null); ed.current?.focus(); }} />}
      {paletteOpen && <CommandPalette commands={commands} items={items} onOpenNote={open} onClose={() => { setPaletteOpen(false); ed.current?.focus(); }} />}
      {searchOpen && <SearchModal items={items} onPick={pick} onClose={() => { setSearchOpen(false); ed.current?.focus(); }} />}
    </div>
  );
}
