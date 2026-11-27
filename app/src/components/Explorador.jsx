import { useEffect, useMemo, useRef, useState } from "react";
import { IconArrowDown as ArrowDown, IconArrowUp as ArrowUp, IconCircleDot as CircleDot, IconChevronRight as ChevronRight, IconFileText as FileText, IconFilter as Filter, IconFolder as Folder, IconFolderSymlink as FolderInput, IconFolderOpen as FolderOpen, IconFolderPlus as FolderPlus, IconLayoutGrid as LayoutGrid, IconList as List, IconPencil as Pencil, IconSearch as Search, IconStar as Star, IconTag as Tag, IconTrash as Trash2, IconUpload as Upload, IconX as X } from "@tabler/icons-react";
import { Vazio } from "@/components/ui/estado";
import { cn } from "@/lib/utils";
import { useEhCompacto } from "@/lib/useCompacto";
import { LoteDialog, editavel } from "@/components/LoteDialog";
import { intervalo } from "@/lib/lote";

export const norm = (x) => String(x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const cmp = (a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true });
const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento: segue sem lembrar */ } };

export const Chip = ({ ativo, onClick, children, ...p }) => (
  <button type="button" onClick={onClick} aria-pressed={ativo} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors", ativo ? "border-primary bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")} {...p}>{children}</button>
);

/** Campo de nome no próprio lugar (como renomear no Windows): Enter confirma, Esc cancela, sair do campo confirma. */
function NomeEditavel({ valor, onOk, onCancel }) {
  const ref = useRef(null), feito = useRef(false);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const fim = (ok) => { if (feito.current) return; feito.current = true; if (ok) onOk(ref.current.value); else onCancel(); };
  return (
    <input ref={ref} defaultValue={valor} aria-label="Nome" draggable={false}
      onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); fim(true); } else if (e.key === "Escape") { e.preventDefault(); fim(false); } }}
      onBlur={() => fim(true)}
      className="min-w-0 flex-1 rounded border border-primary bg-background px-1.5 py-0.5 text-sm font-normal text-foreground outline-none ring-2 ring-primary/20" />
  );
}

/** Menu de contexto (botão direito). */
function MenuContexto({ x, y, itens, onClose }) {
  useEffect(() => {
    const fechar = () => onClose();
    const tecla = (e) => e.key === "Escape" && onClose();
    window.addEventListener("click", fechar); window.addEventListener("contextmenu", fechar); window.addEventListener("keydown", tecla); window.addEventListener("blur", fechar);
    return () => { window.removeEventListener("click", fechar); window.removeEventListener("contextmenu", fechar); window.removeEventListener("keydown", tecla); window.removeEventListener("blur", fechar); };
  }, [onClose]);
  return (
    <div role="menu" style={{ left: Math.min(x, window.innerWidth - 230), top: Math.min(y, window.innerHeight - itens.length * 36 - 16) }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      className="fixed z-50 w-56 rounded-lg border bg-background p-1 shadow-xl">
      {itens.map((it, i) => it === "-"
        ? <div key={i} role="separator" className="my-1 h-px bg-border" />
        : <button key={i} role="menuitem" onClick={() => { onClose(); it.fazer(); }} className={cn("flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm hover:bg-accent", it.perigo && "text-err")}>
          <it.Icone aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.7} /><span className="flex-1">{it.nome}</span>{it.atalho && <kbd className="text-xs text-muted-foreground">{it.atalho}</kbd>}
        </button>)}
    </div>
  );
}

/** Botão de filtros (ao lado de grade/lista): abre um painel com um grupo por filtro; o número mostra quantos estão ligados. */
function BotaoFiltros({ aberto, setAberto, ativos, grupos, onLimpar }) {
  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto(!aberto)} aria-haspopup="dialog" aria-expanded={aberto} aria-label={ativos ? `Filtros (${ativos} ligado${ativos === 1 ? "" : "s"})` : "Filtros"} title="Filtros"
        className={cn("flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border bg-background px-2.5 text-sm", ativos ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground", aberto && "bg-accent text-foreground")}>
        <Filter aria-hidden className="h-4 w-4" />{ativos > 0 && <span aria-hidden className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">{ativos}</span>}
      </button>
      {aberto && <>
        <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />
        <div role="dialog" aria-label="Filtros" className="absolute right-0 z-40 mt-1 flex max-h-[min(70vh,32rem)] w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 overflow-auto rounded-lg border bg-background p-3 shadow-xl">
          {grupos.map((g) => (
            <div key={g.id} role="group" aria-label={g.nome} className="flex flex-col gap-1.5">
              <span aria-hidden className="text-xs font-medium text-muted-foreground">{g.nome}</span>
              <div className="flex flex-wrap gap-1.5">{g.chips}</div>
            </div>))}
          {ativos > 0 && <button type="button" onClick={onLimpar} className="inline-flex h-8 items-center gap-1 self-start rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-3.5 w-3.5" />Limpar filtros</button>}
        </div>
      </>}
    </div>
  );
}

/** "Mover para…": escolhe a pasta de destino numa lista com todas as pastas de Aulas. */
function MoverDialog({ entrada, titulo, pastas, valida, onEscolher, onClose }) {
  useEffect(() => { const t = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", t); return () => window.removeEventListener("keydown", t); }, [onClose]);
  const lista = [{ rel: "", nome: titulo, nivel: 0 }, ...pastas.map((rel) => ({ rel, nome: rel.split("/").pop().replace(/^_/, ""), nivel: rel.split("/").length }))];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Mover para" onMouseDown={(e) => e.stopPropagation()} className="flex max-h-[70vh] w-[min(440px,92vw)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        <div className="flex items-center gap-2.5 border-b px-4 py-3"><FolderInput aria-hidden className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} /><h2 className="min-w-0 flex-1 truncate text-sm font-medium">Mover “{entrada.nome}” para…</h2><kbd className="rounded border px-1.5 text-xs text-muted-foreground">Esc</kbd></div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {lista.map((d) => {
            const ok = valida(d.rel);
            return (
              <button key={d.rel || "_"} disabled={!ok} onClick={() => onEscolher(d.rel)} style={{ paddingLeft: 10 + d.nivel * 18 }} className="flex h-9 w-full items-center gap-2.5 rounded-md pr-3 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">
                <Folder aria-hidden className="h-4 w-4 shrink-0 fill-current text-muted-foreground/60" strokeWidth={1.4} />
                <span className="min-w-0 flex-1 truncate">{d.nome}</span>{!ok && <span className="text-xs text-muted-foreground">{d.rel === entrada.dirPai ? "já está aqui" : "não pode"}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Explorador de arquivos reutilizável (Aulas, Questões, Correção): grade ou lista, busca, filtros, ordenação, pastas,
 * seleção (clique; Ctrl/Shift para várias; Esc ou clicar fora desmarca), abrir (duplo clique/Enter), renomear no lugar (F2),
 * mover (arrastar ou "Mover para…"), excluir, importar e Ctrl+Z (desfaz renomear, mover, status e tag).
 * Cada página só diz quais são os itens, filtros e colunas; o resto é igual em todas.
 *
 * Item: { id, path, nome, pasta ("" = raiz; relativa a `raiz.rel`), rel?, fixo?, pathAcao?, nomeEdit?, …campos próprios }
 *  - `fixo`: fica só na raiz e não se move (ex.: provas, provas antigas, em Anos/AAAA/Provas).
 *  - `pathAcao`/`nomeEdit`: caminho e nome usados para renomear/excluir quando o item é uma pasta-lote (ex.: correção).
 */
export function Explorador({
  chave, titulo, subtitulo, unidade = ["item", "itens"], buscaDica = "Buscar…", itens, pasta = "", setPasta = () => {},
  raiz = null, pastasRel = [], filtros = [], alternadores = [], favoritos = false, ordens = [], previa, faixa, meta, icone = () => FileText, colunas = [], colunaPasta = true,
  onOpen, onRename, onMove, onDelete, onAtualizar, onNovaPasta, onImportar, botoes, filtroNav, menuExtra, vazio, vazioPasta,
}) {
  const [q, setQ] = useState("");
  const [visao, setVisao] = useState(() => ler(`margem.${chave}.visao`, "lista"));
  const [ordem, setOrdem] = useState(() => ler(`margem.${chave}.ordem`, { por: "nome", desc: false }));
  const [sels, setSels] = useState(filtroNav?.sels ?? {});        // filtroId -> [opcaoId]
  const navVista = useRef(filtroNav?.n);
  useEffect(() => { if (filtroNav && filtroNav.n !== navVista.current) { navVista.current = filtroNav.n; setSels(filtroNav.sels); } }, [filtroNav?.n]); // clique no submenu do menu lateral
  const [tgl, setTgl] = useState([]);          // alternadores ligados
  const [soFav, setSoFav] = useState(false);
  const [favs, setFavs] = useState(() => ler(`margem.${chave}.fav`, []));
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);
  const [menu, setMenu] = useState(null);
  const [movendo, setMovendo] = useState(null);
  const [arrasto, setArrasto] = useState(null);
  const [alvo, setAlvo] = useState(null);
  const [erro, setErro] = useState("");
  const [marcados, setMarcados] = useState(() => new Set()); // seleção em lote (Ctrl/Shift+clique)
  const ancora = useRef(null);
  const [loteDlg, setLoteDlg] = useState(null), [loteMover, setLoteMover] = useState(false);
  const [aviso, setAviso] = useState(null); // { texto, desfazer? } depois de uma ação em lote ou de um Ctrl+Z
  const historico = useRef([]);             // o que o Ctrl+Z desfaz, a ação mais recente no fim: { texto, desfazer, paths? }
  const desfazendo = useRef(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 20000); return () => clearTimeout(t); }, [aviso]);
  const arquivoRef = useRef(null);

  useEffect(() => gravar(`margem.${chave}.visao`, visao), [visao]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => gravar(`margem.${chave}.ordem`, ordem), [ordem]); // eslint-disable-line react-hooks/exhaustive-deps
  const gravarFavs = (n) => { gravar(`margem.${chave}.fav`, n); return n; };
  const alternarFav = (rel) => setFavs((f) => gravarFavs(f.includes(rel) ? f.filter((x) => x !== rel) : [...f, rel]));
  const refavoritar = (de, para) => setFavs((f) => gravarFavs(f.map((x) => x === de ? para : x.startsWith(de + "/") ? para + x.slice(de.length) : x)));
  const temFav = favoritos;

  const todos = useMemo(() => itens.map((i) => ({ ...i, fav: temFav && !!i.rel && favs.includes(i.rel) })), [itens, favs, temFav]);
  const ordensTodas = [{ id: "nome", nome: "Nome", chave: (i) => i.nome }, ...ordens, ...(raiz && colunaPasta ? [{ id: "pasta", nome: "Pasta", chave: (i) => i.pasta || "\0" }] : [])];
  const compacto = useEhCompacto(); // celular: lista plana, sem pastas, um toque abre
  const filtrando = !!(q.trim() || Object.values(sels).some((v) => v.length) || tgl.length || soFav);
  const passa = (i) => {
    if (q.trim() && !norm(`${i.nome} ${i.pasta ?? ""} ${i.busca ?? ""}`).includes(norm(q.trim()))) return false;
    for (const f of filtros) { const s = sels[f.id] ?? []; if (s.length && !f.de(i).some((x) => s.includes(x))) return false; }
    for (const a of alternadores) if (tgl.includes(a.id) && !a.teste(i)) return false;
    if (soFav && !i.fav) return false;
    return true;
  };
  const ordenar = (lista) => {
    const d = ordem.desc ? -1 : 1, o = ordensTodas.find((x) => x.id === ordem.por) ?? ordensTodas[0];
    return [...lista].sort((a, b) => d * (cmp(o.chave(a), o.chave(b)) || cmp(a.nome, b.nome)));
  };

  const achatar = filtrando || compacto;
  const prefixo = pasta ? pasta + "/" : "";
  const absDe = (rel) => (raiz ? raiz.abs + (rel ? "/" + rel : "") : "");
  const todasPastas = pastasRel;
  const pastasAqui = achatar || !raiz ? [] : todasPastas.filter((r) => r.startsWith(prefixo) && !r.slice(prefixo.length).includes("/") && r.length > prefixo.length)
    .map((rel) => ({ tipo: "pasta", id: absDe(rel), path: absDe(rel), nome: rel.split("/").pop(), relPasta: rel, dirPai: pasta, n: todos.filter((a) => !a.fixo && (a.pasta === rel || a.pasta.startsWith(rel + "/"))).length }))
    .sort((a, b) => (ordem.por === "nome" && ordem.desc ? -1 : 1) * cmp(a.nome, b.nome));
  const arquivos = ordenar(achatar ? todos.filter(passa) : todos.filter((a) => (a.pasta ?? "") === pasta)).map((a) => ({ ...a, tipo: "item", dirPai: a.pasta ?? "" }));
  const entradas = [...pastasAqui, ...arquivos];
  useEffect(() => { setMarcados(new Set()); }, [pasta, q, sels, tgl, soFav]); // mudou a lista: a seleção em lote deixa de valer
  const limpar = () => { setQ(""); setSels({}); setTgl([]); setSoFav(false); };
  const alt = (id, v) => setSels((s) => { const l = s[id] ?? []; return { ...s, [id]: l.includes(v) ? l.filter((x) => x !== v) : [...l, v] }; });
  const trilha = pasta ? pasta.split("/") : [];
  const cabecalhoOrdem = (id) => ordem.por === id ? (ordem.desc ? <ArrowDown aria-hidden className="h-3 w-3" /> : <ArrowUp aria-hidden className="h-3 w-3" />) : null;
  const ordenarPor = (id) => setOrdem((o) => o.por === id ? { por: id, desc: !o.desc } : { por: id, desc: false });
  const temFiltros = filtros.length > 0 || alternadores.length > 0 || temFav;
  const filtrosLigados = Object.values(sels).reduce((n, v) => n + v.length, 0) + tgl.length + (soFav ? 1 : 0);
  const limparFiltros = () => { setSels({}); setTgl([]); setSoFav(false); };

  // ---------- ações ----------
  const falhou = (e) => setErro(String(e?.message ?? e).replace(/^Error:\s*/, ""));
  const movivel = (e) => e.tipo === "pasta" || !e.fixo;
  const podeMover = (e, dest) => !!raiz && e && movivel(e) && dest !== e.dirPai && !(e.tipo === "pasta" && (dest === e.relPasta || dest.startsWith(e.relPasta + "/")));
  const abrir = (e) => { if (e.tipo === "pasta") { setPasta(e.relPasta); setSel(null); } else onOpen(e); };
  const nomeDe = (e) => (e.tipo === "pasta" ? e.nome : e.nomeEdit ?? e.nome);
  const caminhoDe = (e) => (e.tipo === "pasta" ? e.path : e.pathAcao ?? e.path);
  const novaPasta = async () => {
    setErro(""); if (filtrando) limpar();
    const irmas = new Set(todasPastas.filter((r) => r.startsWith(prefixo) && !r.slice(prefixo.length).includes("/")).map((r) => norm(r.slice(prefixo.length))));
    let nome = "Nova pasta", k = 2; while (irmas.has(norm(nome))) nome = `Nova pasta (${k++})`;
    try { const p = await onNovaPasta(absDe(pasta), nome); setSel(p); setEdit({ id: p, valor: nome }); } catch (e) { falhou(e); }
  };
  const lembrar = (acao) => { historico.current = [...historico.current.slice(-49), acao]; };
  const desfazer = async (acao) => {
    if (!acao || desfazendo.current) return;
    desfazendo.current = true;
    historico.current = historico.current.filter((a) => a !== acao);
    try { await acao.desfazer(); await onAtualizar?.(acao.paths); setSel(null); setErro(""); setAviso({ texto: `Desfeito: ${acao.texto}` }); }
    catch (err) { setAviso(null); falhou(err); }
    finally { desfazendo.current = false; }
  };
  const confirmarNome = async (e, novo) => {
    setEdit(null);
    const v = novo.trim(), antigo = nomeDe(e);
    if (!v || v === antigo) return;
    try {
      const novoPath = await onRename(caminhoDe(e), v);
      let favorito = null; // [antes, depois]: o favorito acompanha o nome, na ida e na volta
      if (e.rel && temFav) favorito = [e.rel, e.rel.split("/").slice(0, -1).join("/") + "/" + v.replace(/\.md$/, "") + ".md"];
      if (e.tipo === "pasta" && raiz) { const dir = raiz.rel + "/" + (e.dirPai ? e.dirPai + "/" : ""); favorito = [dir + e.nome, dir + v]; }
      if (favorito) refavoritar(...favorito);
      lembrar({ texto: `renomear “${antigo}” para “${v}”`, desfazer: async () => { await onRename(novoPath, antigo); if (favorito) refavoritar(favorito[1], favorito[0]); } });
      setSel(novoPath); setErro("");
    } catch (err) { falhou(err); }
  };
  /** Move um item e devolve a função que o traz de volta (com os favoritos). */
  const moverUm = async (e, dest) => {
    const novo = await onMove(caminhoDe(e), absDe(dest));
    let favorito = null;
    if (e.rel && temFav) favorito = [e.rel, raiz.rel + "/" + (dest ? dest + "/" : "") + e.rel.split("/").pop()];
    if (e.tipo === "pasta") favorito = [raiz.rel + "/" + e.relPasta, raiz.rel + "/" + (dest ? dest + "/" : "") + e.nome];
    if (favorito) refavoritar(...favorito);
    return async () => { await onMove(novo, absDe(e.dirPai)); if (favorito) refavoritar(favorito[1], favorito[0]); };
  };
  const mover = async (e, dest) => {
    setMovendo(null); setArrasto(null); setAlvo(null);
    if (!podeMover(e, dest)) return;
    try { const voltar = await moverUm(e, dest); lembrar({ texto: `mover “${nomeDe(e)}”`, desfazer: voltar }); setSel(null); setErro(""); } catch (err) { falhou(err); }
  };
  // ---------- seleção e ações em lote ----------
  const marcadas = entradas.filter((e) => marcados.has(e.id));
  const marcar = (e, ev) => {
    const ids = entradas.map((x) => x.id);
    if (ev.shiftKey) setMarcados(new Set(intervalo(ids, ancora.current ?? sel, e.id)));
    else { // Ctrl/Cmd: liga e desliga; a nota só selecionada entra junto
      setMarcados((m) => { const n = new Set(m.size || !sel ? m : [sel]); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; });
      ancora.current = e.id;
    }
    setSel(e.id);
  };
  const soltarMarcas = () => { setMarcados(new Set()); ancora.current = null; };
  const moverLote = async (dest) => {
    setLoteMover(false);
    const voltas = [];
    try {
      for (const e of marcadas) if (podeMover(e, dest)) voltas.push(await moverUm(e, dest));
    } catch (err) { falhou(err); }
    if (!voltas.length) return;
    soltarMarcas(); setSel(null);
    const acao = { texto: `mover ${voltas.length} ${voltas.length === 1 ? "item" : "itens"}`, desfazer: async () => { for (const voltar of [...voltas].reverse()) await voltar(); } };
    lembrar(acao);
    setAviso({ texto: `${voltas.length} movida${voltas.length === 1 ? "" : "s"}`, desfazer: () => desfazer(acao) });
  };
  const excluir = (e) => onDelete(caminhoDe(e), nomeDe(e), e.tipo === "pasta" ? e.n : 0).then(() => { setSel(null); setErro(""); }).catch(falhou);
  const importar = async (arqs) => {
    setErro("");
    try { await onImportar([...arqs], pasta); } catch (e) { falhou(e); }
  };
  const podeRenomear = !!onRename, podeExcluir = !!onDelete;
  const podeExcluirLote = podeExcluir && !!onAtualizar;
  const itensStatusTag = (alvos, abrirDialogo) => (onAtualizar && alvos.some(editavel) ? [
    { nome: "Mudar status…", Icone: CircleDot, fazer: () => abrirDialogo("status") },
    { nome: "Adicionar tag…", Icone: Tag, fazer: () => abrirDialogo("tag") },
  ] : []);
  /** Menu do botão direito sobre várias marcadas. */
  const itensMenuLote = (alvos) => {
    const lista = [
      ...(raiz && alvos.some(movivel) ? [{ nome: `Mover ${alvos.length} itens para…`, Icone: FolderInput, fazer: () => setLoteMover(true) }] : []),
      ...itensStatusTag(alvos, setLoteDlg),
    ];
    if (podeExcluirLote) lista.push(...(lista.length ? ["-"] : []), { nome: `Excluir ${alvos.length} itens…`, atalho: "Del", Icone: Trash2, perigo: true, fazer: () => setLoteDlg("excluir") });
    return lista;
  };
  const itensMenu = (e) => [
    { nome: "Abrir", Icone: e.tipo === "pasta" ? FolderOpen : FileText, fazer: () => abrir(e) },
    ...(e.tipo === "item" && menuExtra ? menuExtra(e) : []),
    ...(podeRenomear ? [{ nome: "Renomear", atalho: "F2", Icone: Pencil, fazer: () => setEdit({ id: e.id, valor: nomeDe(e) }) }] : []),
    ...(raiz && movivel(e) ? [{ nome: "Mover para…", Icone: FolderInput, fazer: () => setMovendo(e) }] : []),
    ...itensStatusTag([e], (tipo) => { setMarcados(new Set([e.id])); setLoteDlg(tipo); }),
    ...(temFav && e.tipo === "item" && e.rel ? [{ nome: e.fav ? "Tirar dos favoritos" : "Marcar como favorita", Icone: Star, fazer: () => alternarFav(e.rel) }] : []),
    ...(podeExcluir ? ["-", { nome: "Excluir", atalho: "Del", Icone: Trash2, perigo: true, fazer: () => excluir(e) }] : []),
  ];
  const itensMenuFundo = () => [...(raiz && onNovaPasta ? [{ nome: "Nova pasta", Icone: FolderPlus, fazer: novaPasta }] : []), ...(onImportar ? [{ nome: "Importar arquivos .md…", Icone: Upload, fazer: () => arquivoRef.current?.click() }] : [])];

  // Esc, clique fora da lista e Ctrl+Z valem na tela toda, não só com o foco num item. Na fase de captura, para ler o estado
  // de antes de os menus e diálogos reagirem à mesma tecla.
  const janela = useRef({});
  janela.current = { compacto, sobreposto: !!(edit || menu || movendo || loteDlg || loteMover), filtrosAbertos, temSelecao: !!sel || marcados.size > 0, desfazer: () => desfazer(historico.current.at(-1)) };
  useEffect(() => {
    const tecla = (ev) => {
      const j = janela.current;
      if (j.compacto || j.sobreposto) return;
      if (ev.key === "Escape") {
        if (j.filtrosAbertos) { ev.preventDefault(); setFiltrosAbertos(false); }
        else if (j.temSelecao) { ev.preventDefault(); setSel(null); soltarMarcas(); }
      } else if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === "z") {
        if (ev.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target?.tagName)) return; // ali o Ctrl+Z desfaz o texto digitado
        if (!historico.current.length) return;
        ev.preventDefault(); j.desfazer();
      }
    };
    // Dentro da lista o clique é dos itens (e o vazio entre os cartões, do fundo); menus e diálogos agem sobre a seleção.
    const clique = (ev) => { if (!ev.target?.closest?.('[role="listbox"], [role="menu"], [role="dialog"]')) { setSel(null); soltarMarcas(); } };
    window.addEventListener("keydown", tecla, true); window.addEventListener("click", clique, true);
    return () => { window.removeEventListener("keydown", tecla, true); window.removeEventListener("click", clique, true); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function alvoDeSoltar(rel) {
    return {
      onDragOver: (ev) => { if (podeMover(arrasto, rel)) { ev.preventDefault(); ev.stopPropagation(); ev.dataTransfer.dropEffect = "move"; if (alvo !== rel) setAlvo(rel); } },
      onDragLeave: () => setAlvo((a) => (a === rel ? null : a)),
      onDrop: (ev) => { if (podeMover(arrasto, rel)) { ev.preventDefault(); ev.stopPropagation(); mover(arrasto, rel); } },
    };
  }
  const propsEntrada = (e) => ({
    role: "option", "aria-selected": sel === e.id || marcados.has(e.id), tabIndex: 0,
    draggable: !compacto && !!raiz && movivel(e) && edit?.id !== e.id,
    onClick: (ev) => {
      ev.stopPropagation();
      if (compacto) abrir(e);
      else if (ev.ctrlKey || ev.metaKey || ev.shiftKey) marcar(e, ev);
      else { soltarMarcas(); ancora.current = e.id; setSel(e.id); }
    },
    onDoubleClick: () => abrir(e),
    onContextMenu: (ev) => {
      if (compacto) return;
      ev.preventDefault(); ev.stopPropagation(); setSel(e.id);
      const varias = marcados.has(e.id) && marcadas.length > 1;
      if (!marcados.has(e.id)) soltarMarcas(); // botão direito fora das marcadas: vale só para este item
      const it = varias ? itensMenuLote(marcadas) : itensMenu(e);
      setMenu(it.length ? { x: ev.clientX, y: ev.clientY, itens: it } : null);
    },
    onKeyDown: (ev) => {
      if (edit) return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "a" && !compacto) { ev.preventDefault(); setMarcados(new Set(entradas.map((x) => x.id))); }
      else if (ev.key === "Delete" && marcados.size > 1 && podeExcluirLote) { ev.preventDefault(); setLoteDlg("excluir"); }
      else if (ev.key === "Enter") { ev.preventDefault(); abrir(e); }
      else if (ev.key === "F2" && podeRenomear) { ev.preventDefault(); setEdit({ id: e.id, valor: nomeDe(e) }); }
      else if (ev.key === "Delete" && podeExcluir) { ev.preventDefault(); excluir(e); }
    },
    onDragStart: (ev) => { ev.dataTransfer.setData("text/plain", e.path); ev.dataTransfer.effectAllowed = "move"; setArrasto(e); setSel(e.id); },
    onDragEnd: () => { setArrasto(null); setAlvo(null); },
    ...(e.tipo === "pasta" ? alvoDeSoltar(e.relPasta) : {}),
  });
  const destaque = (e) => (sel === e.id || marcados.has(e.id) ? "ring-2 ring-primary" : "") + (e.tipo === "pasta" && alvo === e.relPasta ? " bg-primary/10 ring-2 ring-primary" : "");
  const nomeEl = (e, cls) => edit?.id === e.id
    ? <NomeEditavel valor={edit.valor} onOk={(v) => confirmarNome(e, v)} onCancel={() => setEdit(null)} />
    : <span className={cls}>{e.nome.replace(/^_/, "")}</span>;
  const estrela = (e, cls) => (temFav && e.rel ? (
    <button onClick={(ev) => { ev.stopPropagation(); alternarFav(e.rel); }} onDoubleClick={(ev) => ev.stopPropagation()} aria-pressed={e.fav} aria-label={e.fav ? "Tirar dos favoritos" : "Marcar como favorita"} className={cls}><Star className={cn("h-4 w-4", e.fav && "fill-current text-warn")} /></button>
  ) : null);
  const fundo = {
    onClick: () => { setSel(null); soltarMarcas(); },
    onContextMenu: (ev) => { if (compacto) return; const it = itensMenuFundo(); if (!it.length) return; ev.preventDefault(); setMenu({ x: ev.clientX, y: ev.clientY, itens: it }); },
    onDragOver: (ev) => { if (onImportar && !arrasto && ev.dataTransfer?.types?.includes("Files")) ev.preventDefault(); },
    onDrop: (ev) => { if (onImportar && !arrasto && ev.dataTransfer?.files?.length) { ev.preventDefault(); importar(ev.dataTransfer.files); } },
  };
  const parar = { onClick: (e) => e.stopPropagation(), onContextMenu: (e) => e.stopPropagation() };
  const Ico = ({ item, cls }) => { const I = icone(item); return <I aria-hidden className={cls} strokeWidth={1.6} />; };
  const vazioTodo = !itens.length && !todasPastas.length;

  return (
    <div className="min-h-0 flex-1 overflow-auto" {...fundo}><div className={cn("flex min-h-full w-full flex-col gap-4", compacto ? "px-4 py-4" : "px-8 py-8")}>
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className={cn("font-serif font-semibold leading-tight", compacto ? "text-2xl" : "text-3xl")}>{titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitulo}{!compacto && <span className="ml-2 text-xs">· clique para selecionar, clique duas vezes para abrir</span>}</p>
        </div>
        {!compacto && raiz && onNovaPasta && <button onClick={(e) => { e.stopPropagation(); novaPasta(); }} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent"><FolderPlus className="h-4 w-4" />Nova pasta</button>}
        {!compacto && onImportar && <button onClick={(e) => { e.stopPropagation(); arquivoRef.current?.click(); }} title="Adiciona arquivos .md do computador a esta pasta (ou arraste-os para a página)" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent"><Upload className="h-4 w-4" />Importar</button>}
        {!compacto && <span className="contents" {...parar}>{botoes}</span>}
        {onImportar && <input ref={arquivoRef} type="file" accept=".md,text/markdown" multiple hidden onChange={(e) => { importar(e.target.files); e.target.value = ""; }} />}
      </header>

      {erro && <div role="alert" className="flex items-start gap-2 rounded-md border border-err/40 bg-err/10 px-3 py-2 text-sm text-err"><span className="flex-1">{erro}</span><button onClick={(e) => { e.stopPropagation(); setErro(""); }} aria-label="Fechar aviso"><X className="h-4 w-4" /></button></div>}

      {vazioTodo
        ? <Vazio titulo={vazio?.titulo ?? "Nada por aqui ainda"} acao={vazio?.acao}>{vazio?.texto}</Vazio>
        : <>
          <div className="flex flex-wrap items-center gap-2" {...parar}>
            <label className="flex h-11 min-w-0 flex-1 sm:min-w-[14rem] items-center gap-2 rounded-full border bg-background px-4 text-sm text-muted-foreground focus-within:border-primary">
              <Search aria-hidden className="h-4 w-4 shrink-0" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={buscaDica} aria-label="Buscar" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
              {q && <button onClick={() => setQ("")} aria-label="Limpar busca" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
            </label>
            <label className={cn("h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground", compacto ? "hidden" : "flex")}>
              Ordenar
              <select value={ordem.por} onChange={(e) => setOrdem((o) => ({ ...o, por: e.target.value }))} aria-label="Ordenar por" className="bg-transparent text-foreground outline-none">
                {ordensTodas.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              <button onClick={() => setOrdem((o) => ({ ...o, desc: !o.desc }))} aria-label={ordem.desc ? "Ordem decrescente" : "Ordem crescente"} className="text-foreground">{ordem.desc ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}</button>
            </label>
            <div role="group" aria-label="Forma de exibição" className={cn("h-10 items-center rounded-md border bg-background p-0.5", compacto ? "hidden" : "flex")}>
              {[["grade", LayoutGrid, "Grade"], ["lista", List, "Lista"]].map(([id, Icon, nome]) => (
                <button key={id} onClick={() => setVisao(id)} aria-pressed={visao === id} aria-label={nome} title={nome} className={cn("flex h-9 w-9 items-center justify-center rounded", visao === id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}><Icon className="h-4 w-4" /></button>
              ))}
            </div>
            {temFiltros && <BotaoFiltros aberto={filtrosAbertos} setAberto={setFiltrosAbertos} ativos={filtrosLigados} onLimpar={limparFiltros} grupos={[
              ...(temFav ? [{ id: "_fav", nome: "Favoritos", chips: <Chip ativo={soFav} onClick={() => setSoFav((v) => !v)}><Star aria-hidden className={cn("h-3.5 w-3.5", soFav && "fill-current")} />Favoritas</Chip> }] : []),
              ...filtros.map((f) => ({ id: f.id, nome: f.nome, chips: f.opcoes.map((o) => <Chip key={o.id} ativo={(sels[f.id] ?? []).includes(o.id)} onClick={() => alt(f.id, o.id)}>{o.cor && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: o.cor }} />}{o.ponto && <span aria-hidden className={cn("h-2 w-2 rounded-full", o.ponto)} />}{o.nome}</Chip>) })),
              ...(alternadores.length ? [{ id: "_outros", nome: "Outros", chips: alternadores.map((a) => <Chip key={a.id} ativo={tgl.includes(a.id)} onClick={() => setTgl((t) => t.includes(a.id) ? t.filter((x) => x !== a.id) : [...t, a.id])}>{a.Icone && <a.Icone aria-hidden className="h-3.5 w-3.5" />}{a.nome}</Chip>) }] : []),
            ]} />}
          </div>

          {!compacto && (raiz || filtrando) && (
            <nav aria-label="Pastas" className="flex min-h-8 flex-wrap items-center gap-1 text-sm" {...parar}>
              {filtrando
                ? <><span className="text-muted-foreground">{arquivos.length} {arquivos.length === 1 ? "resultado" : "resultados"}{raiz ? " em todas as pastas" : ""}</span>
                  <button onClick={limpar} className="ml-1 inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><X className="h-3.5 w-3.5" />Limpar filtros</button></>
                : <>
                  <button onClick={() => setPasta("")} {...alvoDeSoltar("")} className={cn("rounded px-1.5 py-1 hover:bg-accent", !pasta ? "font-medium text-foreground" : "text-muted-foreground", alvo === "" && "bg-primary/10 ring-2 ring-primary")}>{titulo}</button>
                  {trilha.map((seg, i) => {
                    const rel = trilha.slice(0, i + 1).join("/");
                    return (
                      <span key={i} className="flex items-center gap-1">
                        <ChevronRight aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
                        <button onClick={() => setPasta(rel)} {...alvoDeSoltar(rel)} className={cn("rounded px-1.5 py-1 hover:bg-accent", i === trilha.length - 1 ? "font-medium text-foreground" : "text-muted-foreground", alvo === rel && "bg-primary/10 ring-2 ring-primary")}>{seg.replace(/^_/, "")}</button>
                      </span>
                    );
                  })}
                </>}
            </nav>
          )}

          {entradas.length === 0
            ? <p className="py-6 text-sm text-muted-foreground">{filtrando ? <>Nada com esses filtros. <button onClick={limpar} className="text-primary underline">Limpar filtros</button></> : (vazioPasta ?? "Esta pasta está vazia.")}</p>
            : visao === "grade" && !compacto
              ? <div role="listbox" aria-label={titulo} className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
                {entradas.map((e) => e.tipo === "pasta" ? (
                  <div key={e.id} {...propsEntrada(e)} className={cn("flex cursor-default flex-col overflow-hidden rounded-xl border bg-card outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary", destaque(e), arrasto?.id === e.id && "opacity-50")}>
                    <div className="flex h-32 items-center justify-center border-b bg-muted/40"><Folder aria-hidden className="h-14 w-14 fill-current text-muted-foreground/40" strokeWidth={1.2} /></div>
                    <div className="flex items-center gap-2 px-3.5 pb-3 pt-2.5 text-sm font-medium"><Folder aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />{nomeEl(e, "min-w-0 flex-1 truncate")}<span className="text-xs font-normal text-muted-foreground">{e.n} {e.n === 1 ? unidade[0] : unidade[1]}</span></div>
                  </div>
                ) : (
                  <div key={e.id} {...propsEntrada(e)} className={cn("group relative flex cursor-default flex-col overflow-hidden rounded-xl border bg-card outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary", destaque(e), arrasto?.id === e.id && "opacity-50")}>
                    <div className="relative h-32 overflow-hidden border-b bg-muted/40 px-3.5 py-3">
                      {faixa && faixa(e).length > 0 && <div aria-hidden className="absolute inset-x-0 top-0 flex h-1">{faixa(e).map((c, k) => <span key={k} className="flex-1" style={{ background: c }} />)}</div>}
                      {previa ? previa(e) : null}
                      <div aria-hidden className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card/90 to-transparent" />
                    </div>
                    <div className="flex flex-col gap-1.5 px-3.5 pb-3 pt-2.5">
                      <span className="flex items-start gap-2 text-sm font-medium leading-snug"><Ico item={e} cls="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{nomeEl(e, "line-clamp-2")}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6">{meta ? meta(e) : null}</span>
                      {filtrando && raiz && e.pasta && <span className="flex items-center gap-1 pl-6 text-xs text-muted-foreground"><Folder aria-hidden className="h-3 w-3" />{e.pasta.replace(/\//g, " › ")}</span>}
                    </div>
                    {estrela(e, cn("absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground", e.fav ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"))}
                  </div>
                ))}
              </div>
              : <div role="listbox" aria-label={titulo} className="overflow-hidden rounded-xl border">
                <div aria-hidden className="hidden items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:flex">
                  <span className="w-6" />
                  <button onClick={(ev) => { ev.stopPropagation(); ordenarPor("nome"); }} className="flex min-w-0 flex-1 items-center gap-1 text-left hover:text-foreground">Nome {cabecalhoOrdem("nome")}</button>
                  {raiz && colunaPasta && <button onClick={(ev) => { ev.stopPropagation(); ordenarPor("pasta"); }} className="flex w-40 items-center gap-1 text-left hover:text-foreground">Pasta {cabecalhoOrdem("pasta")}</button>}
                  {colunas.map((c) => c.ordem
                    ? <button key={c.id} onClick={(ev) => { ev.stopPropagation(); ordenarPor(c.ordem); }} className={cn("flex items-center gap-1 text-left hover:text-foreground", c.w)}>{c.nome} {cabecalhoOrdem(c.ordem)}</button>
                    : <span key={c.id} className={cn("text-left", c.w)}>{c.nome}</span>)}
                </div>
                {entradas.map((e) => e.tipo === "pasta" ? (
                  <div key={e.id} {...propsEntrada(e)} className={cn("group flex min-h-11 cursor-default items-center gap-3 border-b px-3 text-sm outline-none last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent", (sel === e.id || marcados.has(e.id)) && "bg-accent", alvo === e.relPasta && "bg-primary/10 ring-2 ring-inset ring-primary", arrasto?.id === e.id && "opacity-50")}>
                    <span className="w-6" />
                    <Folder aria-hidden className="h-4 w-4 shrink-0 fill-current text-muted-foreground/60" strokeWidth={1.4} />
                    {nomeEl(e, "min-w-0 flex-1 truncate font-medium")}
                    {raiz && colunaPasta && <span className="hidden w-40 md:block" />}
                    {colunas.map((c, k) => <span key={c.id} className={cn("hidden text-xs text-muted-foreground md:block", c.w)}>{k === 0 ? `${e.n} ${e.n === 1 ? unidade[0] : unidade[1]}` : ""}</span>)}
                  </div>
                ) : (
                  <div key={e.id} {...propsEntrada(e)} className={cn("group flex min-h-11 cursor-default items-center gap-3 border-b px-3 text-sm outline-none last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent", (sel === e.id || marcados.has(e.id)) && "bg-accent", arrasto?.id === e.id && "opacity-50")}>
                    {temFav && e.rel ? estrela(e, cn("flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground", !e.fav && "opacity-0 focus-visible:opacity-100 group-hover:opacity-100")) : <span className="w-6" />}
                    <Ico item={e} cls="h-4 w-4 shrink-0 text-muted-foreground" />
                    {compacto && meta
                      ? <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">{nomeEl(e, "truncate")}<span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">{meta(e)}</span></span>
                      : nomeEl(e, "min-w-0 flex-1 truncate")}
                    {raiz && colunaPasta && <span className="hidden w-40 items-center gap-1 truncate text-xs text-muted-foreground md:flex">{e.pasta ? e.pasta.replace(/\//g, " › ").replace(/^_/, "") : "—"}</span>}
                    {colunas.map((c) => <span key={c.id} className={cn("hidden md:block", c.w)}>{c.render(e)}</span>)}
                  </div>
                ))}
              </div>}
        </>}
      <div className="flex-1" />
      {loteMover && <MoverDialog entrada={{ nome: `${marcadas.length} itens`, dirPai: "\0" }} titulo={titulo} pastas={todasPastas} valida={(rel) => marcadas.some((e) => podeMover(e, rel))} onEscolher={moverLote} onClose={() => setLoteMover(false)} />}
      {loteDlg && <LoteDialog tipo={loteDlg} alvos={marcadas} nomeDe={nomeDe} caminhoDe={caminhoDe} onClose={() => setLoteDlg(null)} onErro={(e) => { setLoteDlg(null); falhou(e); }}
        onFeito={async (r) => {
          setLoteDlg(null); soltarMarcas(); setSel(null); await onAtualizar?.(r.paths);
          if (!r.desfazer) { setAviso(r); return; } // exclusão: não tem volta por aqui
          const acao = { texto: r.texto, desfazer: r.desfazer, paths: r.paths };
          lembrar(acao); setAviso({ texto: r.texto, desfazer: () => desfazer(acao) });
        }} />}
      {aviso && <div role="status" className="fixed bottom-10 right-6 z-40 flex items-center gap-3 rounded-lg border bg-background px-4 py-2 text-sm shadow-lg">{aviso.texto}{aviso.desfazer && <button onClick={aviso.desfazer} className="font-medium text-primary hover:underline">Desfazer</button>}<button onClick={() => setAviso(null)} aria-label="Fechar o aviso" className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button></div>}
      {menu && <MenuContexto {...menu} onClose={() => setMenu(null)} />}
      {movendo && <MoverDialog entrada={movendo} titulo={titulo} pastas={todasPastas} valida={(rel) => podeMover(movendo, rel)} onEscolher={(rel) => mover(movendo, rel)} onClose={() => setMovendo(null)} />}
    </div></div>
  );
}
