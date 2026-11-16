import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@/lib/api";
import { ArrowLeft, ArrowRight, ListOrdered, ListTree, PanelLeft, Search, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Menu } from "@/components/Menu";
import { Editor } from "@/components/Editor";
import { ResizeHandle } from "@/components/ResizeHandle";
import { Outline } from "@/components/Outline";
import { TocBarra } from "@/components/TocBarra";
import { RightPanel } from "@/components/RightPanel";
import { setProp, lineStart } from "@/lib/frontmatter";
import { CommandPalette } from "@/components/CommandPalette";
import { SearchModal } from "@/components/SearchModal";
import { EntryDialog } from "@/components/EntryDialog";
import { InicioPage } from "@/components/InicioPage";
import { RecursosPage } from "@/components/RecursosPage";
import { GramaticasPage } from "@/components/GramaticasPage";
import { AulasPage } from "@/components/AulasPage";
import { CiclosPage } from "@/components/CiclosPage";
import { CorrecoesPage } from "@/components/CorrecoesPage";
import { ProvaDaNota } from "@/components/ProvaDaNota";
import { ErrosComuns } from "@/components/ErrosComunsDialog";
import { AulaDaNota } from "@/components/AulaDaNota";
import { BancoDaNota } from "@/components/BancoDaNota";
import { CorrecaoPage } from "@/components/CorrecaoPage";
import { SemanaPage } from "@/components/SemanaPage";
import { SaudePage } from "@/components/SaudePage";
import { DiarioPage } from "@/components/DiarioPage";
import { CicloPage } from "@/components/CicloPage";
import { capturing } from "@/components/ShortcutsPage";
import { SettingsPage } from "@/components/SettingsPage";
import { EscolherVault } from "@/components/VaultGate";
import { store, clamp } from "@/lib/store";
import { useNotaAberta } from "@/lib/useNotaAberta";
import { usePreferencias } from "@/lib/usePreferencias";
import { useNavegacao } from "@/lib/useNavegacao";
import { criarAula } from "@/lib/aula";
import { criarCicloVazio } from "@/lib/ciclos";
import { criarGramatica } from "@/lib/gramatica";
import { RECURSOS, criarRecurso } from "@/lib/recursos";
import { lembrarRecente } from "@/lib/recentes";
import { procurarAtualizacao, antesDeAtualizar } from "@/lib/atualizar";
import { CicloDaNota } from "@/components/CicloDaNota";
import { visaoDe } from "@/lib/visoes";
const NOMES_REC = { Questoes: "Questões" };
import { loadFromDisk, loadOverrides, effective, comboOf, pretty, handlers, ACTIONS } from "@/lib/shortcuts";

function RailButton({ label, active, onClick, disabled, size = "lg", children }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={cn("flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
        size === "lg" ? "h-10 w-10" : "h-8 w-8", active && "bg-primary/10 text-primary hover:text-primary")}>
      {children}
    </button>
  );
}


export default function App() {
  const [items, setItems] = useState([]);
  const [dirs, setDirs] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [status, setStatus] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navTick, setNavTick] = useState(0);
  const [overrides, setOverrides] = useState(loadOverrides);
  const [foco, setFoco] = useState(false);
  const ed = useRef(null);
  const P = usePreferencias(() => ed.current?.remeasure());
  const { dark, setDark, temaClaro, setTemaClaro, temaEscuro, setTemaEscuro, estiloCallout, setEstiloCallout, fonte, setFonte, tamanhoTexto, setTamanhoTexto, destaques, setDestaques, numeros, setNumeros, forma, setForma, zoom, setZoom, outlineW, setOutlineW, showSide, setShowSide, showOutline, setShowOutline, panelTab, setPanelTab } = P;
  const { page, setPage, ciclo, setCiclo, inicioModo, setInicioModo, inicioModoRaw, aulasPasta, setAulasPasta, ciclosPasta, setCiclosPasta, gramaticaPasta, setGramaticaPasta, correcaoFoco, setCorrecaoFoco, correcaoVista, setCorrecaoVista, recursosAba, setRecursosAba, recursosPasta, setRecursosPasta, textoAtiv, setTextoAtiv, irAno, irMontarProva, irAulas, irRecursos, irSecao } = useNavegacao();
  const hist = useRef({ stack: [], idx: -1 });
  const { info, propsText, setPropsText, current, setCurrent, words, headings, activeHeading, setActiveHeading, histTick, cur, dirty, save, onChange, load, restoreText, refreshInfo } = useNotaAberta({ ed, setStatus, setPage, setItems });

  useEffect(() => { loadFromDisk().then((o) => o && setOverrides(o)); }, []);
  // undefined = verificando; null = nenhuma pasta escolhida (só no app); texto = pasta do vault
  const [vaultRoot, setVaultRoot] = useState(isTauri ? undefined : "navegador");
  useEffect(() => { if (isTauri) invoke("get_vault_root").then(setVaultRoot).catch(() => setVaultRoot(null)); }, []);
  // Procura atualização uma vez, em silêncio, pouco depois de abrir.
  useEffect(() => {
    if (!isTauri) return;
    const t = setTimeout(() => procurarAtualizacao().then((u) => u && setStatus(`Nova versão ${u.version} disponível: Configurações › Atualizações`)).catch(() => {}), 8000);
    return () => clearTimeout(t);
  }, []);
  const refresh = useCallback(() => Promise.all([invoke("list_notes"), invoke("list_dirs")]).then(([n, d]) => { setItems(n); setDirs(d); }).catch((e) => setStatus(String(e))), []);
  useEffect(() => { if (vaultRoot) refresh(); }, [refresh, vaultRoot]);


  // Atualização: salva a nota e guarda onde o usuário estava; ao reabrir, volta para lá.
  useEffect(() => {
    antesDeAtualizar(async () => {
      await save();
      store.set("reabrir", { page, path: cur.current });
    });
  });
  useEffect(() => {
    if (!vaultRoot) return;
    const r = store.get("reabrir", null);
    if (!r) return;
    try { localStorage.removeItem("reabrir"); } catch {}
    (async () => {
      try {
        if (r.path) await load(r.path);
        if (r.page && r.page !== "editor") setPage(r.page);
        setStatus("Atualizado. Você voltou de onde estava.");
      } catch { /* nota não existe mais: fica na tela inicial */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultRoot]);
  // Histórico de navegação: cada passo é uma nota ({ k: "nota", path }) ou uma tela do app ({ k: "pag", page, … }), para o
  // Voltar/Avançar também refazerem listagens (ex.: a pasta aberta em Aulas), não só arquivos.
  const chaveEntrada = (e) => e.k === "nota" ? "n:" + e.path : `p:${e.page}|${e.aulasPasta}|${e.inicioModo}|${e.correcaoFoco}|${e.recursosAba}|${e.recursosPasta}|${e.ciclo?.path ?? ""}`;
  const empurrar = (e) => {
    const h = hist.current;
    if (h.idx >= 0 && chaveEntrada(h.stack[h.idx]) === chaveEntrada(e)) return;
    h.stack = [...h.stack.slice(0, h.idx + 1), e]; h.idx = h.stack.length - 1;
    setNavTick((n) => n + 1);
  };
  const open = async (path) => {
    lembrarRecente(path);
    empurrar({ k: "nota", path });
    // Nota já aberta: se o arquivo mudou no disco e não há nada por salvar, recarrega; senão só volta ao editor.
    if (path === cur.current && (dirty.current || await invoke("read_note", { path }).then((t) => t === ed.current.getText()).catch(() => true))) { setPage("editor"); return; }
    await load(path);
  };
  const go = async (delta) => {
    const h = hist.current, i = h.idx + delta;
    if (i < 0 || i >= h.stack.length) return;
    h.idx = i; setNavTick((n) => n + 1);
    const e = h.stack[i];
    if (e.k === "nota") await load(e.path);
    else { setAulasPasta(e.aulasPasta); inicioModoRaw(e.inicioModo); setCorrecaoFoco(e.correcaoFoco); setRecursosAba(e.recursosAba); setRecursosPasta(e.recursosPasta ?? ""); setCiclo(e.ciclo); await save(); setPage(e.page); }
  };
  // Toda mudança de tela (ou de pasta em Aulas, aba, etc.) vira um passo do histórico.
  useEffect(() => {
    if (page === "editor") return;
    empurrar({ k: "pag", page, aulasPasta, inicioModo, correcaoFoco, recursosAba, recursosPasta, ciclo });
  }, [page, aulasPasta, inicioModo, correcaoFoco, recursosAba, recursosPasta, ciclo]); // eslint-disable-line react-hooks/exhaustive-deps
  const canBack = hist.current.idx > 0, canFwd = hist.current.idx < hist.current.stack.length - 1;
  const link = async (t) => {
    const p = await invoke("resolve_link", { target: t });
    p ? open(p) : setStatus(`Link não resolvido: ${t}`);
  };

  // ---------- gerenciar notas e pastas ----------
  const under = (p, base) => p === base || p.startsWith(base + "/");
  const remap = (from, to) => {
    const sub = (p) => (p && under(p, from) ? to + p.slice(from.length) : p);
    const h = hist.current; h.stack = h.stack.map((e) => e.k === "nota" ? { ...e, path: sub(e.path) } : { ...e, correcaoFoco: sub(e.correcaoFoco) });
    if (cur.current) { cur.current = sub(cur.current); setCurrent(cur.current); }
  };
  const fail = (e) => setStatus("Erro: " + e);
  // Pastas e arquivos de Aulas (a página chama estas funções e mostra o erro, se houver).
  const criarPastaEm = async (dir, name) => { const p = await invoke("create_folder", { dir, name }); await refresh(); return p; };
  const moverEntrada = async (path, dir) => { await save(); const r = await invoke("move_entry", { path, dir }); remap(path, r.path); await refresh(); setStatus("Movida"); return r.path; };
  const excluirEntrada = (path, nome, n) => new Promise((ok) => setDialog({
    title: "Excluir", danger: true, okLabel: "Excluir",
    message: `Excluir “${nome}”${n ? ` e as ${n} aulas dentro dela` : ""}? Vai para a pasta .lixeira do vault e pode ser recuperada de lá.`,
    onOk: async () => { await invoke("delete_entry", { path }); await refresh(); setStatus("Excluída"); ok(); },
  }));
  const novaAula = (pasta = "") => setDialog({ title: "Nova aula", input: true, okLabel: "Criar", onOk: async (name) => {
    const p = await criarAula(items, { titulo: name, turma: "", pasta: typeof pasta === "string" ? pasta : "" }); await refresh(); open(p);
  } });
  const novoCiclo = (pasta = "") => setDialog({ title: "Novo ciclo", input: true, okLabel: "Criar", onOk: async (name) => {
    const p = await criarCicloVazio(items, name, typeof pasta === "string" ? pasta : ""); await refresh(); open(p);
  } });
  const novaGramatica = (pasta = "") => setDialog({ title: "Nova gramática", input: true, okLabel: "Criar", onOk: async (name) => {
    const p = await criarGramatica(items, { topico: name, pasta: typeof pasta === "string" ? pasta : "" }); await refresh(); open(p);
  } });
  const novoRecurso = (tipo) => setDialog({ title: RECURSOS[tipo].dialogo, input: true, okLabel: "Criar", onOk: async (name) => {
    const sub = recursosPasta.split("/")[0] === RECURSOS[tipo].pasta ? recursosPasta.split("/").slice(1).join("/") : ""; // dentro da pasta do tipo, cria na subpasta aberta
    const p = await criarRecurso(items, tipo, { nome: name, pasta: sub }); await refresh(); open(p);
  } });
  const createNote = (dir) => setDialog({ title: "Novo arquivo", input: true, okLabel: "Criar", onOk: async (name) => {
    const p = await invoke("create_note", { dir, name }); await refresh(); open(p);
  } });
  // Renomeia a nota aberta numa tela personalizada (ex.: trocar o título do ciclo) e devolve o novo caminho.
  const renomearNota = async (path, name) => {
    await save();
    const r = await invoke("rename_entry", { path, name }); remap(path, r.path); await refresh();
    setStatus(`Renomeada; ${r.links} link(s) atualizado(s)`);
    return r.path;
  };
  useEffect(() => {
    if (!foco) return;
    const esc = (e) => { if (e.key === "Escape" && !e.defaultPrevented) setFoco(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [foco]);

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
      focus: () => setFoco((v) => !v),
      toggleNumeros: () => setNumeros((v) => !v),
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
      if (ACTIONS.find((a) => a.id === id)?.plain) { // tecla simples: só fora de campos de texto e com a tela registrada
        const t = e.target;
        if (t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName)) return;
        if (!handlers[id]) return;
        e.preventDefault(); e.stopPropagation();
        handlers[id]();
        return;
      }
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
    { id: "p-hoje", label: "Ir para Hoje", hint: "dia início", run: () => irSecao("hoje") },
    { id: "p-semana", label: "Ir para a Semana", hint: "aula dar aula turma", run: () => { setInicioModo("semana"); setPage("semana"); } },
    { id: "p-ano", label: "Ir para o Ano", hint: "ciclo", run: irAno },
    { id: "p-diario", label: "Ir para Diário e alunos", hint: "ocorrência conselho", run: () => setPage("diario") },
    { id: "p-saude", label: "Ir para Saúde do vault", hint: "avisos validar problemas", run: () => setPage("saude") },
    { id: "p-ciclos", label: "Ir para Ciclos", hint: "lista novo", run: () => irSecao("ciclos") },
    { id: "p-aulas", label: "Ir para Aulas", hint: "acervo planos", run: () => irSecao("aulas") },
    { id: "p-gramatica", label: "Ir para Gramática", hint: "regra tópico referência", run: () => irSecao("gramatica") },
    { id: "p-recursos", label: "Ir para Recursos", hint: "textos banco questões provas oficinas acervo", run: () => irSecao("recursos") },
    { id: "p-correcao", label: "Ir para Produções", hint: "redações correção trabalhos", run: () => irSecao("correcao") },
    { id: "p-prova", label: "Ir para Montar prova", run: irMontarProva },
    { id: "p-nova-aula", label: "Nova aula", hint: "criar modelo", run: () => novaAula() },
    { id: "p-novo-texto", label: "Novo texto", hint: "criar ficha acervo recurso", run: () => novoRecurso("texto") },
    { id: "p-nova-oficina", label: "Nova oficina", hint: "criar jogo dinâmica recurso", run: () => novoRecurso("oficina") },
    { id: "p-novo-banco", label: "Novo banco de questões", hint: "criar questões recurso", run: () => novoRecurso("banco") },
    { id: "p-nova-gramatica", label: "Nova gramática", hint: "criar modelo tópico", run: () => novaGramatica() },
    { id: "p-config", label: "Ir para Configurações", run: () => setPage("config") },
    { id: "buscar", label: "Buscar arquivo", keys: pretty(keys.search), run: () => setSearchOpen(true) },
    { id: "salvar", label: "Salvar agora", keys: pretty(keys.save), run: () => save() },
    { id: "tabela", label: "Inserir tabela", keys: pretty(keys.insertTable), run: () => { if (cur.current) { setPage("editor"); setTimeout(() => ed.current?.insertTable(), 50); } } },
    { id: "nota", label: "Novo arquivo", hint: "criar", run: () => createNote(items[0] ? items[0].path.slice(0, items[0].path.length - items[0].rel.length - 1) : "") },
    { id: "numeros", label: "Mostrar/ocultar a numeração das linhas", keys: pretty(keys.toggleNumeros), run: () => setNumeros((v) => !v) },
    { id: "foco", label: "Modo foco (esconde menus e barras)", keys: pretty(keys.focus), run: () => setFoco((v) => !v) },
    { id: "lado", label: "Reduzir/ampliar o menu lateral", keys: pretty(keys.toggleSide), run: () => setShowSide((v) => !v) },
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
  // "editar" na lista do diário: abre a nota em Markdown (a visão personalizada do diário é só a lista)
  const abrirMarkdown = async (path) => {
    const novo = { ...prefVisao, diario: "markdown" }; setPrefVisao(novo); store.set("visaoPorTipo", novo);
    await open(path); setPage("editor");
  };
  const ROTULOS = { semana: { hoje: "Hoje", semana: "Semana", ano: "Ano" }[inicioModo] ?? "Hoje", ciclos: "Ciclos", aulas: "Aulas", gramatica: "Gramática", recursos: "Recursos", correcao: "Produções", diario: "Diário", saude: "Saúde do vault", config: "Configurações" };
  // Caminho no topo: cada item é { t: texto, ir?: função }. Em Aulas (e numa aula aberta) as pastas são clicáveis e levam à listagem delas.
  const crumbs = page === "ciclos" ? [{ t: "Ciclos", ir: () => irSecao("ciclos") }, ...(ciclosPasta ? ciclosPasta.split("/") : []).map((t, i, a) => ({ t, ir: () => setCiclosPasta(a.slice(0, i + 1).join("/")) }))]
    : page === "gramatica" ? [{ t: "Gramática", ir: () => irSecao("gramatica") }, ...(gramaticaPasta ? gramaticaPasta.split("/") : []).map((t, i, a) => ({ t, ir: () => setGramaticaPasta(a.slice(0, i + 1).join("/")) }))]
    : page === "aulas" ? [{ t: "Aulas", ir: () => irAulas("") }, ...(aulasPasta ? aulasPasta.split("/") : []).map((t, i, a) => ({ t: t.replace(/^_/, ""), ir: () => irAulas(a.slice(0, i + 1).join("/")) }))]
    : page === "recursos" && recursosAba !== "montar" ? [{ t: "Recursos", ir: () => irRecursos("") }, ...(recursosPasta ? recursosPasta.split("/") : []).map((t, i, a) => ({ t: NOMES_REC[t] ?? t.replace(/^_/, ""), ir: () => irRecursos(a.slice(0, i + 1).join("/")) }))]
    : page === "ciclo" ? [{ t: "Ciclos", ir: () => irSecao("ciclos") }, { t: ciclo?.titulo ?? "Ciclo" }]
    : page !== "editor" ? [ROTULOS[page] ?? ""].filter(Boolean).map((t) => ({ t }))
    : !rel ? []
    : rel.replace(/\.md$/, "").split("/").map((t, i, a) => {
      if (/^Acervo\/Aulas\//.test(rel)) { // aula: o caminho começa em "Aulas" (sem "Acervo"); as pastas levam à listagem delas
        if (i === 0) return null;
        if (i === 1) return { t, ir: () => irAulas("") };
        if (i < a.length - 1) return { t, ir: () => irAulas(a.slice(2, i + 1).join("/")) };
      }
      if (/^Acervo\/Gram[aá]tica\//.test(rel)) { // gramática: o caminho começa em "Gramática"; as pastas levam à listagem delas
        if (i === 0) return null;
        if (i === 1) return { t: "Gramática", ir: () => { setGramaticaPasta(""); setPage("gramatica"); } };
        if (i < a.length - 1) return { t, ir: () => { setGramaticaPasta(a.slice(2, i + 1).join("/")); setPage("gramatica"); } };
      }
      if (/^Acervo\/(Questoes|Textos|Oficinas)\//.test(rel)) { // recurso: o caminho começa em "Recursos"; as pastas levam à listagem delas
        if (i === 0) return null;
        if (i === 1) return { t: NOMES_REC[t] ?? t, ir: () => irRecursos(t) };
        if (i < a.length - 1) return { t, ir: () => irRecursos(a.slice(1, i + 1).join("/")) };
      }
      if (/^Acervo\//.test(rel)) { // demais pastas do Acervo: sem "Acervo"; "Ciclos" leva à tela Ciclos
        if (i === 0) return null;
        if (i === 1 && t === "Ciclos") return { t, ir: () => irSecao("ciclos") };
      }
      if (/^Anos\//.test(rel) && i === 2) { // seções do ano que têm tela própria
        const tela = { Semanas: "semana", Correcoes: "correcao", Diario: "diario", Diarios: "diario" }[t];
        if (tela) return { t, ir: () => irSecao(tela) };
      }
      return { t };
    }).filter(Boolean);
    const secao = page === "editor"
    ? (!rel ? null : /^Acervo\/Aulas\//.test(rel) ? "aulas" : /^Acervo\/Gram[aá]tica\//.test(rel) ? "gramatica" : /^Acervo\/(Questoes|Textos|Oficinas)\/|\/Provas\//.test(rel) ? "recursos" : /\/Correcoes\//.test(rel) ? "correcao" : null)
    : ({ semana: "hoje", ciclo: "ciclos", ciclos: "ciclos", aulas: "aulas", gramatica: "gramatica", recursos: "recursos", correcao: "correcao", diario: "diario", saude: "saude", config: "config" })[page];
  const pick = async (path, line) => { setSearchOpen(false); await open(path); if (line) setTimeout(() => goLine(line), 50); };
  const progRef = useRef(null);
  const aoRolarTexto = (e) => {
    const m = e.target; if (!m.classList?.contains("cm-scroller")) return;
    const t = m.scrollHeight - m.clientHeight;
    if (progRef.current) progRef.current.style.transform = `scaleX(${t > 0 ? Math.min(1, m.scrollTop / t) : 0})`;
    const pos = ed.current?.posNoTopo(e.currentTarget.getBoundingClientRect().top + 24);
    if (pos != null && headings.length) { let k = -1; headings.forEach((h, i) => { if (h.pos <= pos) k = i; }); if (k !== activeHeading) setActiveHeading(k); }
  };
  const goHeading = (pos, i) => { setActiveHeading(i); ed.current.goTo(pos); };
  const setProperty = (key, value) => {
    const t = setProp(ed.current.getText(), key, value);
    ed.current.replaceDoc(t); setPropsText(t);
  };
  const goLine = (line) => { ed.current.goTo(lineStart(ed.current.getText(), line)); };
  const temPainel = page === "editor" && !!current; // o painel lateral só existe com uma nota aberta no editor
  const outlineVisible = showOutline && temPainel && !foco;

  if (vaultRoot === undefined) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Abrindo…</div>;
  if (vaultRoot === null) return <EscolherVault onDone={setVaultRoot} />;

  return (
    <div className="flex h-full">
      {!foco && <Menu ativo={secao === "hoje" ? inicioModo : secao} onGo={irSecao} dark={dark} setDark={setDark} compacto={!showSide} />}

      <div className="flex min-w-0 flex-1 flex-col">
        {foco && <button onClick={() => setFoco(false)} title={`Sair do modo foco (Esc ou ${pretty(keys.focus)})`} className="fixed right-3 top-3 z-20 rounded-md border bg-background/80 px-2 py-1 text-xs text-muted-foreground opacity-40 hover:opacity-100">Sair do foco (Esc)</button>}
        {!foco && <header className="flex min-h-[3.5rem] shrink-0 items-center gap-2 border-b px-4 py-2">
          <RailButton size="sm" label={`Reduzir/ampliar o menu (${pretty(keys.toggleSide)})`} active={showSide} onClick={() => setShowSide(!showSide)}><PanelLeft className="h-4 w-4" /></RailButton>
          <RailButton size="sm" label={`Voltar (${pretty(keys.back)})`} onClick={() => go(-1)} disabled={!canBack}><ArrowLeft className="h-4 w-4" /></RailButton>
          <RailButton size="sm" label={`Avançar (${pretty(keys.forward)})`} onClick={() => go(1)} disabled={!canFwd}><ArrowRight className="h-4 w-4" /></RailButton>
          <nav aria-label="Caminho" className="ml-2 flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
            {crumbs.length === 0 && <span>Selecione um arquivo</span>}
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden>/</span>}
                  {c.ir && !last ? <button onClick={c.ir} className="rounded px-1 hover:bg-accent hover:text-foreground">{c.t}</button> : <span className={last ? "font-medium text-foreground" : undefined}>{c.t}</span>}
                </span>
              );
            })}
          </nav>
          <div id="slot-barra-aula" className="flex min-w-0 flex-1 items-center gap-2 pl-3">{page === "editor" && !personalizada && current && <TocBarra headings={headings} active={activeHeading} onGo={(pos) => goHeading(pos, headings.findIndex((h) => h.pos === pos))} />}</div>
          {visao && page === "editor" && (
            <div role="group" aria-label="Modo de exibição" className="flex overflow-hidden rounded-md border text-xs">
              <button onClick={() => escolherVisao("markdown")} className={cn("px-3 py-1", !personalizada ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent")}>Editar</button>
              <button onClick={() => escolherVisao("personalizado")} className={cn("border-l px-3 py-1", personalizada ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent")}>Ver</button>
            </div>
          )}
          <RailButton size="sm" label="Buscar" onClick={() => setSearchOpen(true)}><Search className="h-4 w-4" /></RailButton>
          <RailButton size="sm" label={`Modo foco (${pretty(keys.focus)})`} onClick={() => setFoco(true)}><Maximize2 className="h-4 w-4" /></RailButton>
          {temPainel && <RailButton size="sm" label={`${numeros ? "Ocultar" : "Mostrar"} a numeração das linhas (${pretty(keys.toggleNumeros)})`} active={numeros} onClick={() => setNumeros(!numeros)}><ListOrdered className="h-4 w-4" /></RailButton>}
          {temPainel && <RailButton size="sm" label="Painel lateral" active={outlineVisible} onClick={() => setShowOutline(!showOutline)}><ListTree className="h-4 w-4" /></RailButton>}
        </header>}

        {page === "config" && <SettingsPage tema={{ temaClaro, setTemaClaro, temaEscuro, setTemaEscuro, dark, setDark, estiloCallout, setEstiloCallout, fonte, setFonte, tamanhoTexto, setTamanhoTexto, forma, setForma, destaques, setDestaques }} overrides={overrides} setOverrides={setOverrides} items={items} onRefresh={refresh} />}
        {page === "ciclos" && <CiclosPage items={items} dirs={dirs} pasta={ciclosPasta} setPasta={setCiclosPasta} onRename={renomearNota} onMove={moverEntrada} onDelete={excluirEntrada} onNovaPasta={criarPastaEm} onCiclo={(c) => { const rel = items.find((i) => i.path === c.path)?.rel; if (visaoDe(rel)?.id === "ciclo") open(c.path); else { setCiclo(c); setPage("ciclo"); } }} onCreate={() => novoCiclo(ciclosPasta)} />}
        {page === "aulas" && <AulasPage items={items} dirs={dirs} onOpen={open} onCreate={() => novaAula(aulasPasta)} pasta={aulasPasta} setPasta={setAulasPasta} onRefresh={refresh} onRename={renomearNota} onMove={moverEntrada} onDelete={excluirEntrada} onNovaPasta={criarPastaEm} />}
        {page === "gramatica" && <GramaticasPage items={items} dirs={dirs} onOpen={open} onCreate={() => novaGramatica(gramaticaPasta)} pasta={gramaticaPasta} setPasta={setGramaticaPasta} onRefresh={refresh} onRename={renomearNota} onMove={moverEntrada} onDelete={excluirEntrada} onNovaPasta={criarPastaEm} />}
        {page === "recursos" && <RecursosPage onNovo={novoRecurso} onAtividade={(p) => { setTextoAtiv(p); irMontarProva(); }} items={items} dirs={dirs} onOpen={open} onRefresh={refresh} aba={recursosAba} setAba={setRecursosAba} pasta={recursosPasta} setPasta={setRecursosPasta} onRename={renomearNota} onMove={moverEntrada} onDelete={excluirEntrada} onNovaPasta={criarPastaEm} textoInicial={textoAtiv} onUsouTexto={() => setTextoAtiv(null)} />}
        {page === "correcao" && (correcaoFoco
          ? <CorrecaoPage items={items} onOpen={open} focoPath={correcaoFoco} vistaInicial={correcaoVista} onVoltar={() => { setCorrecaoFoco(null); setCorrecaoVista("aluno"); }} />
          : <CorrecoesPage items={items} onCorrigir={(p) => { setCorrecaoVista("aluno"); setCorrecaoFoco(p); }} onTurma={(p) => { setCorrecaoVista("turma"); setCorrecaoFoco(p); }} onOpen={open} onRename={renomearNota} onDelete={excluirEntrada} />)}
        {page === "semana" && <InicioPage items={items} onOpen={open} onRefresh={refresh} modo={inicioModo} setModo={setInicioModo} onCorrecao={(p) => { setCorrecaoVista("aluno"); setCorrecaoFoco(p); setPage("correcao"); }} onCiclo={(c) => { const rel = items.find((i) => i.path === c.path)?.rel; if (visaoDe(rel)?.id === "ciclo") open(c.path); else { setCiclo(c); setPage("ciclo"); } }} />}
        {page === "diario" && <DiarioPage items={items} onOpen={open} onMarkdown={abrirMarkdown} onRefresh={refresh} />}
        {page === "saude" && <SaudePage items={items} onOpen={open} onRefresh={refresh} />}
        {page === "ciclo" && ciclo && <CicloPage ciclo={ciclo} items={items} onOpen={open} onAno={() => irSecao("ciclos")} onChange={setCiclo} onRename={renomearNota} />}
        {personalizada && visao.id === "ciclo" && <CicloDaNota item={items.find((i) => i.path === current)} items={items} onOpen={open} tick={verTick} onAno={() => irSecao("ciclos")} onRename={renomearNota} />}
        {personalizada && visao.id === "semana" && <SemanaPage items={items} onOpen={open} onRefresh={refresh} focoPath={current} />}
        {personalizada && visao.id === "prova" && <ProvaDaNota item={items.find((i) => i.path === current)} items={items} onOpen={open} tick={verTick} />}
        {personalizada && (visao.id === "diario" || visao.id === "aluno") && <DiarioPage items={items} onOpen={open} onMarkdown={abrirMarkdown} onRefresh={refresh} focoPath={current} />}
        {personalizada && visao.id === "aula" && <AulaDaNota key={current} item={items.find((i) => i.path === current)} items={items} info={info} tick={verTick} onLink={link} onOpen={open} painel={outlineVisible} setPainel={setShowOutline} onRestore={restoreText} histTick={histTick} textoInicial={ed.current?.getText()} numeros={numeros} onRename={renomearNota} />}
        {personalizada && visao.id === "banco" && <BancoDaNota key={current} item={items.find((i) => i.path === current)} items={items} info={info} tick={verTick} onLink={link} onOpen={open} painel={outlineVisible} setPainel={setShowOutline} onRestore={restoreText} histTick={histTick} numeros={numeros} onRename={renomearNota} />}
        {personalizada && visao.id === "correcao" && <CorrecaoPage items={items} onOpen={open} focoPath={current} />}
        <ErrosComuns items={items} />
        {page === "editor" && !personalizada && current && <div role="progressbar" aria-label="Progresso de leitura" aria-valuemin={0} aria-valuemax={100} className="h-0.5 shrink-0 bg-border"><div ref={progRef} className="h-full origin-left bg-primary" style={{ transform: "scaleX(0)" }} /></div>}
        <main onScrollCapture={aoRolarTexto} className={cn("min-h-0 flex-1 overflow-auto", (page !== "editor" || personalizada) && "hidden")}>
          <Editor ref={ed} titulo={(current || "").split(/[\\/]/).pop().replace(/\.md$/i, "")} onChange={onChange} onSave={save} onLink={link} numeros={numeros} />
        </main>

        {!foco && <footer className="flex h-[1.875rem] shrink-0 items-center gap-5 border-t px-6 text-xs text-muted-foreground">
          <span className={/^Erro/.test(status) ? "font-medium text-err" : undefined}>{status}</span>
          <span className="flex-1" />
          {current && info?.issues.length > 0 && <button onClick={() => { setShowOutline(true); setPanelTab("links"); }} className="text-warn hover:underline">{info.issues.length} aviso{info.issues.length > 1 ? "s" : ""}</button>}
          {current && <span>{words} palavras</span>}
          {zoom !== 1 && <button onClick={() => setZoom(1)} title={`Restaurar (${pretty(keys.zoomReset)})`} className="hover:text-foreground">{Math.round(zoom * 100)}%</button>}
          <span>Salva sozinho</span>
        </footer>}
      </div>

      {outlineVisible && !(personalizada && (visao.id === "aula" || visao.id === "banco")) && (
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
