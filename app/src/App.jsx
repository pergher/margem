import { definirProvedorDeLinks } from "@/lib/wikilinks";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@/lib/api";
import { IconArrowLeft as ArrowLeft, IconArrowRight as ArrowRight, IconListNumbers as ListOrdered, IconListTree as ListTree, IconLayoutSidebar as PanelLeft, IconSearch as Search, IconMaximize as Maximize2, IconPlus as Plus, IconSettings as Engrenagem } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { definirRaiz, raizDe } from "@/lib/raiz";
import { Carregando } from "@/components/ui/estado";
import { Menu } from "@/components/Menu";
import BotoesJanela, { temBotoesJanela } from "@/components/BotoesJanela";
import { BarraInferior } from "@/components/BarraInferior";
import { useCompacto, CompactoContext } from "@/lib/useCompacto";
import { definirTabelasEditaveis } from "@/lib/livePreview";
import { Editor } from "@/components/Editor";
import { ResizeHandle } from "@/components/ResizeHandle";
import { Outline, headingsOf } from "@/components/Outline";
import { definirAssunto, assuntoDe } from "@/lib/bancoEdit";
import { RightPanel } from "@/components/RightPanel";
import { setProp, lineStart } from "@/lib/frontmatter";
import { CommandPalette } from "@/components/CommandPalette";
import { SearchModal } from "@/components/SearchModal";
import { CapturaDialog } from "@/components/CapturaDialog";
import { EntryDialog } from "@/components/EntryDialog";
import { HojePage } from "@/components/HojePage";
import { AnoAbas } from "@/components/AnoAbas";
import { DocumentosPage } from "@/components/DocumentosPage";
import { subDaPasta } from "@/lib/documentos";
import { ProvaDaNota } from "@/components/ProvaDaNota";
import { ErrosComuns } from "@/components/ErrosComunsDialog";
import { AulaDaNota } from "@/components/AulaDaNota";
import { BancoDaNota } from "@/components/BancoDaNota";
import { CorrecaoPage } from "@/components/CorrecaoPage";
import { SemanaPage } from "@/components/SemanaPage";
import { SaudePage } from "@/components/SaudePage";
import { DiarioPage } from "@/components/DiarioPage";
import { CicloPage } from "@/components/CicloPage";
import { SettingsPage } from "@/components/SettingsPage";
import { EscolherVault, VaultAusente, VaultSemAcesso } from "@/components/VaultGate";
import { store } from "@/lib/store";
import { useNotaAberta } from "@/lib/useNotaAberta";
import { useObservador } from "@/lib/useObservador";
import { AvisoMudouFora } from "@/components/AvisoMudouFora";
import { AvisoAtualizacao } from "@/components/AvisoAtualizacao";
import { usePropostas } from "@/lib/usePropostas";
import { PropostaDialog } from "@/components/PropostaDialog";
import { BarraRevisao } from "@/components/BarraRevisao";
import { useIA } from "@/lib/useIA";
import { PainelIA } from "@/components/PainelIA";
import { usePreferencias } from "@/lib/usePreferencias";
import { useAtalhoGlobal } from "@/lib/useAtalhoGlobal";
import { useBandeja } from "@/lib/bandeja";
import { useNavegacao } from "@/lib/useNavegacao";
import { useHistoricoNavegacao } from "@/lib/useHistoricoNavegacao";
import { useAtalhos } from "@/lib/useAtalhos";
import { criarAula } from "@/lib/aula";
import { lerModelos, modelosDoTipo } from "@/lib/modelos";
import { criarCicloVazio } from "@/lib/ciclos";
import { criarGramatica } from "@/lib/gramatica";
import { RECURSOS, criarRecurso } from "@/lib/recursos";
import { procurarAtualizacao, antesDeAtualizar } from "@/lib/atualizar";
import { CicloDaNota } from "@/components/CicloDaNota";
import { visaoDe } from "@/lib/visoes";
import { migalhas, secaoAtiva } from "@/lib/migalhas";
import { loadFromDisk, loadOverrides, effective, pretty } from "@/lib/shortcuts";

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
  const [carregado, setCarregado] = useState(false); // a primeira leitura do vault terminou (mesmo que ele esteja vazio)
  const [dirs, setDirs] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [status, setStatus] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [capturaOpen, setCapturaOpen] = useState(false);
  const [caixaTick, setCaixaTick] = useState(0); // muda a cada captura, para o Hoje reler a caixa
  const [overrides, setOverrides] = useState(loadOverrides);
  const [foco, setFoco] = useState(false);
  const ed = useRef(null);
  const P = usePreferencias(() => ed.current?.remeasure());
  const { compacto, modo: modoTela, setModo: setModoTela } = useCompacto();
  definirTabelasEditaveis(!compacto); // antes dos editores montarem // celular: sem menu lateral nem painel direito, com barra inferior
  const { dark, setDark, temaClaro, setTemaClaro, temaEscuro, setTemaEscuro, estiloCallout, setEstiloCallout, fonte, setFonte, tamanhoTexto, setTamanhoTexto, destaques, setDestaques, numeros, setNumeros, forma, setForma, zoom, setZoom, outlineW, setOutlineW, showSide, setShowSide, showOutline, setShowOutline, panelTab, setPanelTab } = P;
  const { page, setPage, ciclo, setCiclo, anoAba, setAnoAba, documentosPasta, setDocumentosPasta, correcaoFoco, setCorrecaoFoco, correcaoVista, setCorrecaoVista, documentosAba, setDocumentosAba, textoAtiv, setTextoAtiv, documentosTipo, irAno, irMontarProva, irDocumentos, irSecao } = useNavegacao();
  const { info, propsText, setPropsText, current, setCurrent, words, headings, activeHeading, setActiveHeading, histTick, cur, dirty, save, onChange, load, restoreText, sincronizarTexto, refreshInfo, aplicarDoDisco, manterMinha } = useNotaAberta({ ed, setStatus, setPage, setItems });

  useEffect(() => { loadFromDisk().then((o) => o && setOverrides(o)); }, []);
  // undefined = verificando; null = nenhuma pasta escolhida (só no app); texto = pasta do vault
  const [vaultRoot, setVaultRoot] = useState(isTauri ? undefined : "navegador");
  definirRaiz(vaultRoot); // antes dos filhos: as telas montam caminhos a partir dela, inclusive com o vault vazio
  useEffect(() => { if (isTauri) invoke("get_vault_root").then(setVaultRoot).catch(() => setVaultRoot(null)); }, []);
  // Pasta movida/apagada/desconectada: confere ao abrir e sempre que a janela volta ao foco.
  const [vaultAusente, setVaultAusente] = useState(null);
  const [semAcesso, setSemAcesso] = useState(false);
  const conferirVault = useCallback(() => { if (isTauri) { invoke("vault_ausente").then(setVaultAusente).catch(() => {}); invoke("vault_sem_acesso").then(setSemAcesso).catch(() => {}); } }, []);
  useEffect(() => { conferirVault(); window.addEventListener("focus", conferirVault); return () => window.removeEventListener("focus", conferirVault); }, [conferirVault, vaultRoot]);
  // Procura atualização pouco depois de abrir, a cada 2 horas e quando a janela volta ao foco (no máx. a cada 30 min).
  // O aviso fica numa faixa no topo; "Depois" a esconde até a próxima verificação.
  const [novaVersao, setNovaVersao] = useState(null);
  const ultimaBusca = useRef(0);
  useEffect(() => {
    if (!isTauri) return;
    const procurar = (minimo) => {
      if (Date.now() - ultimaBusca.current < minimo) return;
      ultimaBusca.current = Date.now();
      procurarAtualizacao().then((u) => setNovaVersao(u ? u.version : null)).catch(() => {});
    };
    const t = setTimeout(() => procurar(0), 8000), i = setInterval(() => procurar(0), 2 * 3600e3), f = () => procurar(30 * 60e3);
    window.addEventListener("focus", f);
    return () => { clearTimeout(t); clearInterval(i); window.removeEventListener("focus", f); };
  }, []);
  const refresh = useCallback(() => Promise.all([invoke("list_notes"), invoke("list_dirs")]).then(([n, d]) => { setItems(n); setDirs(d); setCarregado(true); }).catch((e) => { setStatus(String(e)); setCarregado(true); }), []);
  useEffect(() => { if (vaultRoot) refresh(); }, [refresh, vaultRoot]);
  // Autocompletar de `[[`: notas do vault; "Criar «nome»" cria a nota na pasta da nota aberta.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    definirProvedorDeLinks({
      notas: () => itemsRef.current,
      titulos: async (nome) => {
        const alvo = nome.toLowerCase(), it = itemsRef.current.find((i) => i.name.toLowerCase() === alvo);
        return it ? headingsOf(await invoke("read_note", { path: it.path })).map((h) => h.title) : [];
      },
      criar: (nome) => {
        const dir = (cur.current || "").replace(/[\\/][^\\/]*$/, "");
        if (!dir) return;
        invoke("create_note", { dir, name: nome }).then(() => { setStatus(`Nota criada: ${nome}`); return refresh(); }).catch((e) => setStatus("Erro: " + e));
      },
    });
  }, [refresh]);
  const obs = useObservador({ cur, dirty, refresh, aplicarDoDisco, manterMinha, vaultRoot });
  const props = usePropostas({ ed, cur, refresh, setStatus, vaultRoot });
  const getContextoIA = () => (cur.current && ed.current ? { path: cur.current, texto: ed.current.getText(), selecao: ed.current.getSelection() || window.getSelection()?.toString() || "" } : null);
  const ia = useIA({ getContexto: getContextoIA });
  const [propostaVista, setPropostaVista] = useState(null); // id da proposta aberta no diálogo, ou "disco" (editor × disco)
  const [difDisco, setDifDisco] = useState(null);
  const verDiferencas = async () => {
    try { const disco = await invoke("ler_do_disco", { path: cur.current }); setDifDisco({ id: 0, nota: cur.current, nova: null, texto_base: ed.current.getText(), texto_novo: disco, resumo: "o que está no editor × o que está no disco" }); setPropostaVista("disco"); }
    catch (e) { setStatus("Erro: " + e); }
  };
  useEffect(() => { obs.setAviso(null); }, [current]);


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
  const { open, go, remap, canBack, canFwd } = useHistoricoNavegacao({
    page, setPage, ed,
    nav: { documentosPasta, anoAba, correcaoFoco, documentosAba, ciclo, setDocumentosPasta, setAnoAba, setCorrecaoFoco, setDocumentosAba, setCiclo },
    nota: { cur, dirty, load, save, setCurrent },
  });
  const link = async (t) => {
    const p = await invoke("resolve_link", { target: t });
    p ? open(p) : setStatus(`Link não resolvido: ${t}`);
  };

  // ---------- gerenciar notas e pastas ----------
  const fail = (e) => setStatus("Erro: " + e);
  // Pastas e arquivos de Aulas (a página chama estas funções e mostra o erro, se houver).
  // Vaults anteriores à pasta Gramática: cria Acervo/Gramática uma vez, para ela já existir.
  const gramaticaFeita = useRef(false);
  useEffect(() => {
    if (!carregado || gramaticaFeita.current || !dirs.some((d) => d.startsWith("Acervo/"))) return;
    gramaticaFeita.current = true;
    if (!dirs.some((d) => d.replace(/\/$/, "") === "Acervo/Gramática")) invoke("create_folder", { dir: `${raizDe(items)}/Acervo`, name: "Gramática" }).then(refresh).catch(() => {});
  }, [carregado, dirs]);
  const criarPastaEm = async (dir, name) => { const p = await invoke("create_folder", { dir, name }); await refresh(); return p; };
  const moverEntrada = async (path, dir) => { await save(); const r = await invoke("move_entry", { path, dir }); remap(path, r.path); await refresh(); setStatus("Movida"); return r.path; };
  const excluirEntrada = (path, nome, n) => new Promise((ok) => setDialog({
    title: "Excluir", danger: true, okLabel: "Excluir",
    message: `Excluir “${nome}”${n ? ` e as ${n} aulas dentro dela` : ""}? Vai para a pasta .lixeira do vault e pode ser recuperada de lá.`,
    onOk: async () => { await invoke("delete_entry", { path }); await refresh(); setStatus("Excluída"); ok(); },
  }));
  // Modelos do tipo, para o diálogo de criação oferecer a escolha quando há mais de um (senão, null).
  const opcoesModelo = async (tipo) => { try { const m = modelosDoTipo(await lerModelos(items), tipo); return m.length > 1 ? m.map((x) => ({ id: x.path, nome: x.name })) : null; } catch { return null; } };
  const novaAula = async (pasta = "") => setDialog({ title: "Nova aula", input: true, okLabel: "Criar", opcoes: await opcoesModelo("aula"), onOk: async (name, modelo) => {
    const p = await criarAula(items, { titulo: name, turma: "", pasta: typeof pasta === "string" ? pasta : "", modelo }); await refresh(); open(p);
  } });
  const novoCiclo = (pasta = "") => setDialog({ title: "Novo ciclo", input: true, okLabel: "Criar", onOk: async (name) => {
    const p = await criarCicloVazio(items, name, typeof pasta === "string" ? pasta : ""); await refresh(); open(p);
  } });
  const novaGramatica = async (pasta = "") => setDialog({ title: "Nova gramática", input: true, okLabel: "Criar", opcoes: await opcoesModelo("gramatica"), onOk: async (name, modelo) => {
    const p = await criarGramatica(items, { topico: name, pasta: typeof pasta === "string" ? pasta : "", modelo }); await refresh(); open(p);
  } });
  const novoRecurso = async (tipo) => setDialog({ title: RECURSOS[tipo].dialogo, input: true, okLabel: "Criar", opcoes: await opcoesModelo(tipo), onOk: async (name, modelo) => {
    const sub = subDaPasta(documentosPasta, RECURSOS[tipo].pasta); // dentro da pasta do tipo, cria na subpasta aberta
    const p = await criarRecurso(items, tipo, { nome: name, pasta: sub, modelo }); await refresh(); open(p);
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
  useAtalhos({ compacto, overrides, go, save, page, cur, ed, foco, setSearchOpen, setPaletteOpen, setCapturaOpen, setShowSide, setFoco, setNumeros, setZoom, abrirIA: () => { setShowOutline(true); setPanelTab("ia"); } });

  const keys = effective(overrides);
  const erroBandeja = useBandeja(P.bandeja && !compacto);
  const erroAtalhoGlobal = useAtalhoGlobal({ combo: keys.captura, ligado: P.atalhoGlobal && !compacto, aoDisparar: () => setCapturaOpen(true) });
  const commands = [
    { id: "p-editor", label: "Ir para o editor", run: () => setPage("editor") },
    { id: "p-hoje", label: "Ir para Hoje", hint: "dia início", run: () => irSecao("hoje") },
    { id: "p-semana", label: "Ir para a Semana", hint: "aula dar aula turma ano", run: () => irAno("semana") },
    { id: "p-ano", label: "Ir para o Ano", hint: "ciclo planejamento trimestre", run: () => irAno("plano") },
    { id: "p-fechamento", label: "Ir para o Fechamento do trimestre", hint: "pendências fechar trimestre notas conselho", run: () => irAno("fechamento") },
    { id: "p-diario", label: "Ir para Diário e alunos", hint: "ocorrência conselho", run: () => irAno("diario") },
    { id: "p-saude", label: "Ir para Saúde do vault", hint: "avisos validar problemas", run: () => setPage("saude") },
    { id: "p-ciclos", label: "Ir para Ciclos", hint: "lista novo", run: () => irSecao("ciclos") },
    { id: "p-documentos", label: "Ir para Documentos", hint: "acervo aulas gramática textos banco questões provas oficinas recursos", run: () => irSecao("documentos") },
    { id: "p-correcao", label: "Ir para Produções", hint: "redações correção trabalhos", run: () => irSecao("correcao") },
    { id: "p-prova", label: "Ir para Montar prova", run: irMontarProva },
    { id: "p-nova-aula", label: "Nova aula", hint: "criar modelo", run: () => novaAula() },
    { id: "p-novo-texto", label: "Novo texto", hint: "criar ficha acervo recurso", run: () => novoRecurso("texto") },
    { id: "p-nova-oficina", label: "Nova oficina", hint: "criar jogo dinâmica recurso", run: () => novoRecurso("oficina") },
    { id: "p-novo-banco", label: "Novo banco de questões", hint: "criar questões recurso", run: () => novoRecurso("banco") },
    { id: "p-nova-gramatica", label: "Nova gramática", hint: "criar modelo tópico", run: () => novaGramatica() },
    { id: "p-config", label: "Ir para Configurações", run: () => setPage("config") },
    { id: "buscar", label: "Buscar arquivo", keys: pretty(keys.search), run: () => setSearchOpen(true) },
    { id: "captura", label: "Captura rápida", hint: "caixa de entrada anotar tarefa ideia", keys: pretty(keys.captura), run: () => setCapturaOpen(true) },
    { id: "salvar", label: "Salvar agora", keys: pretty(keys.save), run: () => save() },
    { id: "tabela", label: "Inserir tabela", keys: pretty(keys.insertTable), run: () => { if (cur.current) { setPage("editor"); setTimeout(() => ed.current?.insertTable(), 50); } } },
    { id: "nota", label: "Novo arquivo", hint: "criar", run: () => createNote(raizDe(items)) },
    { id: "numeros", label: "Mostrar/ocultar a numeração das linhas", keys: pretty(keys.toggleNumeros), run: () => setNumeros((v) => !v) },
    { id: "foco", label: "Modo foco (esconde menus e barras)", keys: pretty(keys.focus), run: () => setFoco((v) => !v) },
    { id: "ia", label: "Abrir o painel de IA", keys: pretty(keys.ia), run: () => { setShowOutline(true); setPanelTab("ia"); } },
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
  const [verTick, setVerTick] = useState(0), [gramAberta, setGramAberta] = useState(false);
  const personalizada = !!visao && page === "editor" && prefVisao[visao.id] !== "markdown";
  // Revisão de uma proposta da IA dentro da própria nota (lib/revisao.js). Nota nova não tem texto antigo: segue no diálogo.
  const [revisao, setRevisao] = useState(null);
  const revisaoId = useRef(null);
  useEffect(() => { revisaoId.current = null; setRevisao(null); }, [current]);
  const descartarRevisada = (id) => invoke("descartar_proposta", { id }).then(() => props.recarregar()).catch((e) => setStatus("Erro: " + (e?.message ?? e)));
  const aoRevisar = (r) => {
    setRevisao(r.ativa ? { ...r, id: revisaoId.current } : null);
    if (!r.ativa && r.motivo === "concluida" && revisaoId.current != null) {
      const id = revisaoId.current; revisaoId.current = null;
      descartarRevisada(id);
      setStatus(r.aceitos ? `Revisão concluída: ${r.aceitos} de ${r.total} alteração(ões) aceita(s)` : "Proposta recusada");
    }
  };
  const revisarProposta = async (id) => {
    let p;
    try { p = (await invoke("listar_propostas")).find((x) => x.id === id); } catch (e) { setStatus("Erro: " + (e?.message ?? e)); return; }
    if (!p) return;
    if (p.nova || !p.nota) { setPropostaVista(id); return; }
    const v = visaoDe(items.find((i) => i.path === p.nota)?.rel);
    const estavaPersonalizada = v && prefVisao[v.id] !== "markdown";
    if (estavaPersonalizada) { const novo = { ...prefVisao, [v.id]: "markdown" }; setPrefVisao(novo); store.set("visaoPorTipo", novo); }
    setPage("editor");
    if (cur.current !== p.nota) await open(p.nota); else if (estavaPersonalizada) await load(p.nota); // a tela da visão pode ter gravado no disco
    setTimeout(() => { // espera a troca de nota/visão assentar (o efeito de `current` zera a revisão)
      revisaoId.current = id;
      const n = ed.current?.revisar(p.texto_novo);
      if (!n) { revisaoId.current = null; descartarRevisada(id); setStatus("Esta proposta já está aplicada ou não muda nada nesta nota."); }
    }, 80);
  };
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
  const crumbs = migalhas({ page, rel, anoAba, ciclo, documentosPasta, documentosAba },
    { secao: irSecao, documentos: irDocumentos, ano: irAno });
  const secao = secaoAtiva(page, rel);
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
  const notaPropria = personalizada && (visao.id === "aula" || visao.id === "banco"); // Aula e Banco gravam a nota por conta própria
  const setProperty = async (key, value) => {
    if (notaPropria) { // a tela tem o próprio texto: grava no disco e manda ela reler
      let t = setProp(propsText, key, value);
      if (visao.id === "banco" && key === "ano") t = definirAssunto(t, assuntoDe(t), value);
      try { await invoke("save_note", { path: current, text: t }); } catch (e) { setStatus("Erro ao salvar: " + e); return; }
      sincronizarTexto(t); setVerTick((n) => n + 1); return;
    }
    const t = setProp(ed.current.getText(), key, value);
    ed.current.replaceDoc(t); setPropsText(t);
  };
  const restaurarNota = (t) => { restoreText(t); if (notaPropria) setVerTick((n) => n + 1); };
  const goLine = (line) => { ed.current.goTo(lineStart(ed.current.getText(), line)); };
  const temPainel = page === "editor" && !!current; // o painel lateral só existe com uma nota aberta no editor
  const outlineVisible = showOutline && temPainel && !foco && !compacto;
  const ativoMenu = secao === "documentos" && documentosTipo.tipo ? "documentos:" + documentosTipo.tipo : secao === "ano" && page === "ano" ? "ano:" + anoAba : secao;

  if (vaultRoot === undefined) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Abrindo…</div>;
  if (vaultRoot === null) return <EscolherVault onDone={setVaultRoot} />;
  if (semAcesso && !vaultAusente) return <VaultSemAcesso onTentar={conferirVault} />;
  if (vaultAusente) return <VaultAusente caminho={vaultAusente} onTentar={conferirVault} onDone={(r) => { setVaultAusente(null); setVaultRoot(r); refresh(); }} />;

  return (
    <CompactoContext.Provider value={compacto}>
    <div className={cn("flex h-full", compacto && "flex-col")}>
      {!foco && !compacto && <Menu ativo={ativoMenu} onGo={irSecao} dark={dark} setDark={setDark} compacto={!showSide} />}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {foco &&<button onClick={() => setFoco(false)} title={`Sair do modo foco (Esc ou ${pretty(keys.focus)})`} className="fixed right-3 top-3 z-20 rounded-md border bg-background/80 px-2 py-1 text-xs text-muted-foreground opacity-40 hover:opacity-100">Sair do foco (Esc)</button>}
        {!foco && <header data-tauri-drag-region={temBotoesJanela || undefined} className={cn("flex shrink-0 items-center gap-2 border-b py-2", compacto ? "min-h-12 px-2" : "min-h-[3.5rem] px-4")}>
          {!compacto && <RailButton size="sm" label={`Reduzir/ampliar o menu (${pretty(keys.toggleSide)})`} active={showSide} onClick={() => setShowSide(!showSide)}><PanelLeft className="h-4 w-4" /></RailButton>}
          <RailButton size="sm" label={compacto ? "Voltar" : `Voltar (${pretty(keys.back)})`} onClick={() => go(-1)} disabled={!canBack}><ArrowLeft className="h-4 w-4" /></RailButton>
          <RailButton size="sm" label={compacto ? "Avançar" : `Avançar (${pretty(keys.forward)})`} onClick={() => go(1)} disabled={!canFwd}><ArrowRight className="h-4 w-4" /></RailButton>
          <nav aria-label="Caminho" data-tauri-drag-region={temBotoesJanela || undefined} className="ml-2 flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground max-md:text-sm">
            {crumbs.length === 0 && <span>Selecione um arquivo</span>}
            {(compacto ? crumbs.slice(-1) : crumbs).map((c, i, lista) => {
              const last = i === lista.length - 1;
              return (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden>/</span>}
                  {c.ir && !last ? <button onClick={c.ir} className="rounded px-1 hover:bg-accent hover:text-foreground">{c.t}</button> : <span className={last ? "font-medium text-foreground" : undefined}>{c.t}</span>}
                </span>
              );
            })}
          </nav>
          <div id={compacto ? "slot-barra-aula" : undefined} data-tauri-drag-region={temBotoesJanela || undefined} className="flex min-w-0 flex-1 items-center gap-2 pl-3" />
          <RailButton size="sm" label="Buscar" onClick={() => setSearchOpen(true)}><Search className="h-4 w-4" /></RailButton>
          {compacto && <RailButton size="sm" label="Configurações" active={page === "config"} onClick={() => setPage("config")}><Engrenagem className="h-4 w-4" /></RailButton>}
          {!compacto && <RailButton size="sm" label={`Modo foco (${pretty(keys.focus)})`} onClick={() => setFoco(true)}><Maximize2 className="h-4 w-4" /></RailButton>}
          <BotoesJanela />
        </header>}
        {!compacto && <AvisoAtualizacao versao={novaVersao} onDepois={() => setNovaVersao(null)} />}
        <div className="flex min-h-0 flex-1">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {!foco && !compacto && temPainel && <div className="absolute right-6 top-3 z-10 flex items-center gap-1 rounded-lg bg-background/85 p-0.5 backdrop-blur-sm">
          <div id="slot-ferramentas" className="flex items-center gap-1" />
          {visao && page === "editor" && !compacto && (
            <div role="group" aria-label="Modo de exibição" className="flex overflow-hidden rounded-md border text-xs">
              <button onClick={() => escolherVisao("markdown")} className={cn("px-3 py-1", !personalizada ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent")}>Editar</button>
              <button onClick={() => escolherVisao("personalizado")} className={cn("border-l px-3 py-1", personalizada ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent")}>Ver</button>
            </div>
          )}
          {temPainel && !compacto && <RailButton size="sm" label={`${numeros ? "Ocultar" : "Mostrar"} a numeração das linhas (${pretty(keys.toggleNumeros)})`} active={numeros} onClick={() => setNumeros(!numeros)}><ListOrdered className="h-4 w-4" /></RailButton>}
          {temPainel && !compacto && <RailButton size="sm" label="Painel lateral" active={outlineVisible} onClick={() => setShowOutline(!showOutline)}><ListTree className="h-4 w-4" /></RailButton>}
        </div>}

        {page === "config" && <SettingsPage tema={{ temaClaro, setTemaClaro, temaEscuro, setTemaEscuro, dark, setDark, estiloCallout, setEstiloCallout, fonte, setFonte, tamanhoTexto, setTamanhoTexto, forma, setForma, destaques, setDestaques }} overrides={overrides} setOverrides={setOverrides} items={items} onRefresh={refresh} onOpen={open} modoCompacto={{ modo: modoTela, setModo: setModoTela }} atalhoGlobal={{ ligado: P.atalhoGlobal, setLigado: P.setAtalhoGlobal, erro: erroAtalhoGlobal, bandeja: P.bandeja, setBandeja: P.setBandeja, erroBandeja }} />}
        {!carregado && page !== "config" && page !== "editor" && !personalizada && <Carregando>Lendo o vault…</Carregando>}
        {(carregado || page === "config" || (page === "editor" && !personalizada)) && <>
        {page === "documentos" && <DocumentosPage filtroNav={documentosTipo} items={items} dirs={dirs} onOpen={open} onRefresh={refresh} onNovo={(id) => (id === "ciclo" ? novoCiclo(subDaPasta(documentosPasta, "Ciclos")) : id === "aula" ? novaAula(subDaPasta(documentosPasta, "Aulas")) : id === "gramatica" ? novaGramatica(subDaPasta(documentosPasta, "Gramática")) : novoRecurso(id))} onAtividade={(p) => { setTextoAtiv(p); irMontarProva(); }} aba={documentosAba} setAba={setDocumentosAba} pasta={documentosPasta} setPasta={setDocumentosPasta} onRename={renomearNota} onMove={moverEntrada} onDelete={excluirEntrada} onNovaPasta={criarPastaEm} textoInicial={textoAtiv} onUsouTexto={() => setTextoAtiv(null)} />}
        {page === "inicio" && <HojePage items={items} caixaTick={caixaTick} onCapturar={() => setCapturaOpen(true)} onFechamento={() => irAno("fechamento")} onOpen={open} onRefresh={refresh} onCorrecao={(p) => { setCorrecaoVista("aluno"); setCorrecaoFoco(p); irAno("prod"); }} onSemana={() => irAno("semana")} onDiario={() => irAno("diario")} onSaude={() => setPage("saude")} />}
        {page === "ano" && <AnoAbas aba={anoAba} setAba={setAnoAba} items={items} onOpen={open} onRefresh={refresh} onMarkdown={abrirMarkdown} onRename={renomearNota} onDelete={excluirEntrada} onCiclo={(c) => { const rel = items.find((i) => i.path === c.path)?.rel; if (visaoDe(rel)?.id === "ciclo") open(c.path); else { setCiclo(c); setPage("ciclo"); } }}
          correcao={{ foco: correcaoFoco, vista: correcaoVista, corrigir: (p) => { setCorrecaoVista("aluno"); setCorrecaoFoco(p); }, turma: (p) => { setCorrecaoVista("turma"); setCorrecaoFoco(p); }, voltar: () => { setCorrecaoFoco(null); setCorrecaoVista("aluno"); } }} />}
        {page === "saude" && <SaudePage items={items} onOpen={open} onRefresh={refresh} />}
        {page === "ciclo" && ciclo && <CicloPage ciclo={ciclo} items={items} onOpen={open} onAno={() => irSecao("ciclos")} onChange={setCiclo} onRename={renomearNota} />}
        {personalizada && visao.id === "ciclo" && <CicloDaNota item={items.find((i) => i.path === current)} items={items} onOpen={open} tick={verTick} onAno={() => irSecao("ciclos")} onRename={renomearNota} />}
        {personalizada && visao.id === "semana" && <SemanaPage items={items} onOpen={open} onRefresh={refresh} focoPath={current} />}
        {personalizada && visao.id === "prova" && <ProvaDaNota item={items.find((i) => i.path === current)} items={items} onOpen={open} tick={verTick} />}
        {personalizada && (visao.id === "diario" || visao.id === "aluno") && <DiarioPage items={items} onOpen={open} onMarkdown={abrirMarkdown} onRefresh={refresh} focoPath={current} />}
        {personalizada && visao.id === "aula" && <AulaDaNota key={current} item={items.find((i) => i.path === current)} items={items} info={info} tick={verTick} onLink={link} onOpen={open} onTexto={sincronizarTexto} onGramatica={setGramAberta} textoInicial={ed.current?.getText()} numeros={numeros} onRename={renomearNota} />}
        {personalizada && visao.id === "banco" && <BancoDaNota key={current} item={items.find((i) => i.path === current)} items={items} info={info} tick={verTick} onLink={link} onOpen={open} onTexto={sincronizarTexto} numeros={numeros} onRename={renomearNota} />}
        {personalizada && visao.id === "correcao" && <CorrecaoPage items={items} onOpen={open} focoPath={current} />}
        </>}
        <ErrosComuns items={items} />
        {page === "editor" && current && <AvisoMudouFora aviso={obs.aviso} onCarregar={obs.carregarDoDisco} onManter={obs.manter} onDispensar={obs.dispensar} onDiferencas={verDiferencas} />}
        {page === "editor" && !personalizada && current && <div role="progressbar" aria-label="Progresso de leitura" aria-valuemin={0} aria-valuemax={100} className="h-0.5 shrink-0 bg-border"><div ref={progRef} className="h-full origin-left bg-primary" style={{ transform: "scaleX(0)" }} /></div>}
        {page === "editor" && !personalizada && revisao?.ativa && <BarraRevisao r={revisao} resumo={props.lista.find((p) => p.id === revisao.id)?.resumo}
          onIr={(d) => ed.current?.revisaoIr(d)} onModo={(m) => ed.current?.revisaoModo(m)} onAceitarTudo={() => ed.current?.revisaoAceitarTudo()}
          onRecusarTudo={() => ed.current?.revisaoRecusarTudo()} onSair={() => { revisaoId.current = null; ed.current?.revisaoEncerrar(); }} />}
        <main onScrollCapture={aoRolarTexto} className={cn("min-h-0 flex-1 overflow-auto", (page !== "editor" || personalizada) && "hidden")}>
          <Editor ref={ed} titulo={(current || "").split(/[\\/]/).pop().replace(/\.md$/i, "")} onChange={onChange} onSave={save} onLink={link} onRename={(n) => current && renomearNota(current, n).catch((e) => setStatus("Erro: " + (e?.message ?? e)))} onRevisao={aoRevisar} numeros={numeros} />
        </main>
        </div>
        {outlineVisible && !(personalizada && visao.id === "aula" && gramAberta) && (
          <>
            <ResizeHandle width={outlineW} setWidth={setOutlineW} min={160} max={480} side="right" />
            <div style={{ width: outlineW }} className="shrink-0">
              <RightPanel tab={panelTab} setTab={setPanelTab} info={info} text={propsText} onSet={setProperty} onOpen={open} onGoLine={goLine} path={current} histTick={histTick} onRestore={restaurarNota}
                painelIA={<PainelIA ia={ia} texto={propsText} getContexto={getContextoIA} onAbrirConfig={() => setPage("config")} onVerProposta={async (id) => { await props.recarregar(); await revisarProposta(id); }} />}>
                <Outline headings={headings} active={activeHeading} onGo={(pos) => goHeading(pos, headings.findIndex((h) => h.pos === pos))} />
              </RightPanel>
            </div>
          </>
        )}
        </div>

        {props.desfazer && <div role="status" className="fixed bottom-10 right-6 z-40 max-md:bottom-20 max-md:right-3 flex items-center gap-3 rounded-lg border bg-background px-4 py-2 text-sm shadow-lg">
          {props.desfazer.texto}<button onClick={props.desfazerAgora} className="font-medium text-primary hover:underline">Desfazer</button>
          <button aria-label="Fechar aviso" onClick={props.dispensarDesfazer} className="text-muted-foreground hover:text-foreground">×</button></div>}
        {!foco && compacto && status && <div role="status" className={cn("shrink-0 border-t px-3 py-1.5 text-xs", /^Erro/.test(status) ? "font-medium text-err" : "text-muted-foreground")}>{status}</div>}
        {!foco && !compacto && <footer className="flex h-[1.875rem] shrink-0 items-center gap-5 border-t px-6 text-xs text-muted-foreground">
          <span className={/^Erro/.test(status) ? "font-medium text-err" : undefined}>{status}</span>
          <span className="flex-1" />
          {current && info?.issues.length > 0 && <button onClick={() => { setShowOutline(true); setPanelTab("links"); }} className="text-warn hover:underline">{info.issues.length} aviso{info.issues.length > 1 ? "s" : ""}</button>}
          {import.meta.env.DEV && current && <button onClick={() => invoke("propor_teste", { path: current }).then(() => props.recarregar()).catch((e) => setStatus("Erro: " + e))} className="hover:text-foreground">Propor (teste)</button>}
          {isTauri && <button onClick={() => { setShowOutline(true); setPanelTab("ia"); }} title={`Painel de IA (${pretty(keys.ia)})`} className="hover:text-foreground">IA</button>}
          {props.lista.length > 0 && <button onClick={() => revisarProposta(props.lista[0].id)} className="font-medium text-primary hover:underline">{props.lista.length} proposta{props.lista.length > 1 ? "s" : ""}</button>}
          {current && <span>{words} palavras</span>}
          {zoom !== 1 && <button onClick={() => setZoom(1)} title={`Restaurar (${pretty(keys.zoomReset)})`} className="hover:text-foreground">{Math.round(zoom * 100)}%</button>}
          <span>Salva sozinho</span>
        </footer>}
        {propostaVista === "disco" && difDisco && <PropostaDialog proposta={difDisco} titulo="Diferenças com o disco" rotuloAplicar="Usar os trechos marcados" rotuloRecusar="Fechar"
          onClose={() => { setPropostaVista(null); setDifDisco(null); }}
          onAplicar={async (t) => { ed.current.replaceDoc(t); manterMinha(); obs.dispensar(); setStatus("Mesclada com a versão do disco"); }} />}
        {propostaVista && propostaVista !== "disco" && (() => {
          const i = props.lista.findIndex((p) => p.id === propostaVista);
          if (i < 0) return null;
          const p = props.lista[i];
          return <PropostaDialog key={p.id} proposta={p} posicao={{ indice: i, total: props.lista.length }} onClose={() => setPropostaVista(null)}
            onTrocar={(d) => setPropostaVista(props.lista[(i + d + props.lista.length) % props.lista.length].id)}
            onAplicar={(t) => props.aplicar(p, t)} onRecusar={() => props.recusar(p)} />;
        })()}
      </div>

      {compacto && !foco && !(personalizada && visao?.id === "aula") && !capturaOpen && (
        <button type="button" aria-label="Anotar" title="Anotar na Caixa de entrada" onClick={() => setCapturaOpen(true)}
          className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90"><Plus aria-hidden className="h-6 w-6" strokeWidth={2} /></button>
      )}
      {compacto && !foco && <BarraInferior ativo={ativoMenu} onGo={irSecao} />}

      {dialog && <EntryDialog {...dialog} onClose={() => { setDialog(null); ed.current?.focus(); }} />}
      {paletteOpen && <CommandPalette commands={commands} items={items} onOpenNote={open} onClose={() => { setPaletteOpen(false); ed.current?.focus(); }} />}
      {capturaOpen && <CapturaDialog items={items} onClose={() => { setCapturaOpen(false); ed.current?.focus(); }} onGuardada={() => { setCaixaTick((n) => n + 1); setStatus("Anotado na Caixa de entrada"); refresh?.(); }} onErro={(e) => setStatus(`Não deu para anotar: ${e.message ?? e}`)} />}
      {searchOpen && <SearchModal items={items} onPick={pick} onClose={() => { setSearchOpen(false); ed.current?.focus(); }} />}
    </div>
    </CompactoContext.Provider>
  );
}
