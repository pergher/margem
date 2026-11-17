import { useEffect, useMemo, useState } from "react";
import { IconBook2 as BookOpen, IconClipboardCheck as ClipboardCheck, IconCopy as Copy, IconEye as Eye, IconEyeOff as EyeOff, IconPencil as Pencil, IconPlus as Plus, IconSearch as Search, IconUser as User, IconUserPlus as UserPlus, IconX as X } from "@tabler/icons-react";
import { invoke } from "@/lib/api";
import { cn } from "@/lib/utils";
import { corTurma } from "@/lib/cores";
import { lerSemanas, rotuloDe } from "@/lib/semana";
import { CATEGORIAS, OUTRO, aulasDoDiario, criarAluno, criarDiario, dataDaSemana, insereTags, inserirOcorrencia, mudarEstado, listarAlunos, listarDiarios, nomeDoMes, registrosDoDiario, turmasDe } from "@/lib/diario";
import { Chip, norm } from "@/components/Explorador";
import { Carregando, Estado, Vazio } from "@/components/ui/estado";

const ler = (k, p) => { try { return JSON.parse(localStorage.getItem(k)) ?? p; } catch { return p; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento: segue sem lembrar */ } };

// "Paulo Pergher" -> "Pa. Pe." (duas letras do primeiro e do último nome)
const abreviar = (nome) => { const p = nome.trim().split(/\s+/); return (p.length > 1 ? [p[0], p[p.length - 1]] : p).map((x) => x.slice(0, 2) + ".").join(" "); };
const minusculaMes = (s) => s.replace(/ de ([A-Za-zçÇ]+)/g, (x) => x.toLowerCase());
const rotuloSemana = (r) => (r.data ? minusculaMes(rotuloDe(r.data)) : r.semana || "Sem data");
const cat = (id) => (id === "outro" ? OUTRO : CATEGORIAS.find((c) => c.id === id));
const catsDe = (r) => (r.tipo !== "ocorrencia" ? [] : r.cats.length ? r.cats.map((c) => c.id) : ["outro"]);
const alterna = (set, v) => (set.includes(v) ? set.filter((x) => x !== v) : [...set, v]);

const Grupo = ({ nome, children }) => (
  <div className="flex flex-wrap items-center gap-2"><span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">{nome}</span>{children}</div>
);

export function DiarioPage({ items, onOpen, onMarkdown, onRefresh, focoPath, turmaGlobal }) { // turmaGlobal: filtro vindo da página Ano ("" = todas)
  // focoPath: abre já filtrado pela nota de diário ou de aluno escolhida (visão personalizada da nota).
  const foco = focoPath ? items.find((i) => i.path === focoPath) : null;
  const diarios = useMemo(() => listarDiarios(items), [items]);
  const alunos = useMemo(() => listarAlunos(items), [items]);
  const [semanas, setSemanas] = useState([]);
  const [regs, setRegs] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [erro, setErro] = useState("");
  const [ocultar, setOcultar] = useState(() => ler("margem.diario.ocultar", true)); // nomes de alunos abreviados (Pa. Pe.)
  const [dialogo, setDialogo] = useState(null); // "registrar" | "diario" | "aluno"
  // filtros
  const [q, setQ] = useState("");
  const [tipos, setTipos] = useState([]);
  const [turmasLocal, setTurmas] = useState([]);
  const turmas = turmaGlobal ? [turmaGlobal] : turmasLocal;
  const [cats, setCats] = useState([]);
  const [meses, setMeses] = useState([]);
  const [aluno, setAluno] = useState("");
  const [aprovar, setAprovar] = useState(false);
  const [soDiario, setSoDiario] = useState(null);
  const [agrupar, setAgrupar] = useState("semana");

  useEffect(() => gravar("margem.diario.ocultar", ocultar), [ocultar]);
  useEffect(() => { lerSemanas(items).then(setSemanas).catch(() => {}); }, [items]);
  useEffect(() => {
    if (!foco) return;
    if (/^Anos\/\d{4}\/Alunos\//.test(foco.rel)) { setAluno(foco.name); setTurmas([foco.rel.split("/")[3]]); setAgrupar("aluno"); }
    else { setSoDiario(foco.path); setTurmas([foco.rel.split("/")[3]]); }
  }, [focoPath]);  

  const chave = diarios.map((d) => d.path).join("|");
  useEffect(() => {
    let vivo = true;
    Promise.all(diarios.map(async (d) => registrosDoDiario(await invoke("read_note", { path: d.path }), d)))
      .then((l) => vivo && setRegs(l.flat())).catch((e) => setErro(String(e?.message ?? e)));
    return () => { vivo = false; };
  }, [chave, recarga]);  

  const ano = items.map((i) => /^Anos\/(\d{4})\//.exec(i.rel)?.[1]).filter(Boolean).sort().pop() ?? String(new Date().getFullYear());
  const todasTurmas = useMemo(() => [...new Set([...diarios.map((d) => d.turma), ...alunos.map((a) => a.turma), ...semanas.flatMap((s) => s.turmas.flatMap((t) => turmasDe(t.turma)))])].sort(), [diarios, alunos, semanas]);
  const nomes = useMemo(() => [...new Set([...alunos.map((a) => a.name), ...(regs ?? []).filter((r) => r.aluno).map((r) => r.aluno)])].sort((a, b) => a.localeCompare(b, "pt-BR")), [alunos, regs]);
  const mostrar = (n) => (ocultar ? abreviar(n) : n);
  const mesesTodos = useMemo(() => [...new Set((regs ?? []).map((r) => r.mes).filter(Boolean))].sort().reverse(), [regs]);
  const algumFiltro = !!(q.trim() || tipos.length || turmas.length || cats.length || meses.length || aluno || aprovar || soDiario);
  const limpar = () => { setQ(""); setTipos([]); setTurmas([]); setCats([]); setMeses([]); setAluno(""); setAprovar(false); setSoDiario(null); };

  // Filtra tudo, menos (opcionalmente) as categorias: assim cada chip de comportamento mostra quantos teria.
  const passa = (r, comCats = true) => {
    if (tipos.length && !tipos.includes(r.tipo)) return false;
    if (turmas.length && !turmas.includes(r.turma)) return false;
    if (meses.length && !meses.includes(r.mes)) return false;
    if (soDiario && r.diario !== soDiario) return false;
    if (aluno && r.aluno !== aluno) return false;
    if (aprovar && r.transcricao === "aprovada") return false;
    if (comCats && cats.length && !catsDe(r).some((c) => cats.includes(c))) return false;
    if (q.trim() && !norm(`${r.aluno ?? ""} ${r.tema} ${r.texto} ${r.aula} ${r.turma}`).includes(norm(q.trim()))) return false;
    return true;
  };
  const lista = useMemo(() => (regs ?? []).filter((r) => passa(r)).sort((a, b) => b.ord - a.ord), [regs, q, tipos, turmas, cats, meses, aluno, aprovar, soDiario]);  
  const contagem = useMemo(() => {
    const c = {};
    for (const r of regs ?? []) if (r.tipo === "ocorrencia" && passa(r, false)) for (const id of catsDe(r)) c[id] = (c[id] ?? 0) + 1;
    return c;
  }, [regs, q, tipos, turmas, meses, aluno, aprovar, soDiario]);  

  const nAulas = lista.filter((r) => r.tipo === "aula").length, nOcs = lista.length - nAulas;
  const grupos = useMemo(() => {
    const m = new Map();
    for (const r of lista) {
      if (agrupar === "aluno" && r.tipo !== "ocorrencia") continue;
      const k = agrupar === "aluno" ? r.aluno : `${r.mes}|${rotuloSemana(r)}`;
      if (!m.has(k)) m.set(k, { k, titulo: agrupar === "aluno" ? r.aluno : rotuloSemana(r), itens: [] });
      m.get(k).itens.push(r);
    }
    const g = [...m.values()];
    for (const x of g) x.itens.sort((a, b) => (agrupar === "aluno" ? 0 : a.turma.localeCompare(b.turma)) || a.ord - b.ord);
    return agrupar === "aluno" ? g.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")) : g;
  }, [lista, agrupar]);
  const fichaDe = (n) => alunos.find((a) => a.name === n);
  const editar = onMarkdown ?? onOpen;
  const resumo = () => lista.filter((r) => r.tipo === "ocorrencia").map((r) => `${rotuloSemana(r)} (${r.aula}): ${r.texto}`).join("\n");

  const aprovarDiario = async (path) => {
    try { await invoke("save_note", { path, text: mudarEstado(await invoke("read_note", { path }), "aprovada") }); setRecarga((x) => x + 1); await onRefresh(); }
    catch (e) { setErro(String(e?.message ?? e)); }
  };
  const gravarOcorrencia = async ({ diario, n, nome, ids, texto, turma }) => {
    if (!alunos.some((a) => a.name === nome && a.turma === turma)) await criarAluno(items, { ano, turma, nome });
    const t = await invoke("read_note", { path: diario });
    await invoke("save_note", { path: diario, text: inserirOcorrencia(t, n, nome, insereTags(ids, texto)) });
    setRecarga((x) => x + 1); await onRefresh();
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className="flex min-h-full w-full flex-col gap-4 px-8 py-8">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <h1 className="font-serif text-3xl font-semibold leading-tight">Diário</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {regs ? <>{regs.filter((r) => r.tipo === "aula").length} aulas · {regs.filter((r) => r.tipo === "ocorrencia").length} ocorrências de alunos</> : "Lendo os diários…"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Dados sensíveis: o Claude só vê o que você enviar na conversa.</p>
        </div>
        <button onClick={() => setDialogo("aluno")} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent"><UserPlus className="h-4 w-4" />Novo aluno</button>
        <button onClick={() => setDialogo("diario")} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent"><Plus className="h-4 w-4" />Novo diário</button>
        <button onClick={() => setDialogo("registrar")} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />Registrar ocorrência</button>
      </header>

      {erro && <Estado tipo="err" className="text-sm">Erro: {erro} <button className="underline" onClick={() => setErro("")}>ok</button></Estado>}

      {regs === null ? <Carregando>Lendo os diários…</Carregando>
        : !diarios.length && !alunos.length ? <Vazio titulo="Nenhum diário ainda" acao={{ rotulo: "Criar o primeiro diário", onClick: () => setDialogo("diario") }}>Cada semana tem um diário por turma, com uma seção por aula e as ocorrências dos alunos.</Vazio>
        : <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 min-w-[14rem] flex-1 items-center gap-2 rounded-full border bg-background px-4 text-sm text-muted-foreground focus-within:border-primary">
              <Search aria-hidden className="h-4 w-4 shrink-0" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por aluno, tema ou texto…" aria-label="Buscar" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
              {q && <button onClick={() => setQ("")} aria-label="Limpar busca" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
            </label>
            <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground">
              Aluno
              <select value={aluno} onChange={(e) => setAluno(e.target.value)} aria-label="Filtrar por aluno" className="max-w-[10rem] bg-transparent text-foreground outline-none">
                <option value="">Todos</option>
                {nomes.map((n) => <option key={n} value={n}>{mostrar(n)}</option>)}
              </select>
            </label>
            <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground">
              Agrupar por
              <select value={agrupar} onChange={(e) => setAgrupar(e.target.value)} aria-label="Agrupar por" className="bg-transparent text-foreground outline-none">
                <option value="semana">Semana</option><option value="aluno">Aluno</option>
              </select>
            </label>
            <button onClick={() => setOcultar((v) => !v)} aria-pressed={ocultar} title="Abrevia os nomes dos alunos (Pa. Pe.)" className="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:text-foreground">
              {ocultar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{ocultar ? "Nomes ocultos" : "Nomes visíveis"}
            </button>
          </div>

          <div className="flex flex-col gap-2" role="group" aria-label="Filtros">
            <Grupo nome="Mostrar">
              <Chip ativo={tipos.includes("aula")} onClick={() => setTipos((v) => alterna(v, "aula"))}><BookOpen aria-hidden className="h-3.5 w-3.5" />Aulas</Chip>
              <Chip ativo={tipos.includes("ocorrencia")} onClick={() => setTipos((v) => alterna(v, "ocorrencia"))}><User aria-hidden className="h-3.5 w-3.5" />Alunos</Chip>
              <span aria-hidden className="mx-1 h-5 w-px bg-border" />
              <Chip ativo={aprovar} onClick={() => setAprovar((v) => !v)}><ClipboardCheck aria-hidden className="h-3.5 w-3.5" />Transcrição a aprovar</Chip>
              {soDiario && <Chip ativo onClick={() => setSoDiario(null)}>Só o diário aberto <X aria-hidden className="h-3 w-3" /></Chip>}
            </Grupo>
            {turmaGlobal === undefined && todasTurmas.length > 1 && <Grupo nome="Turma">{todasTurmas.map((t) => <Chip key={t} ativo={turmas.includes(t)} onClick={() => setTurmas((v) => alterna(v, t))}><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: corTurma(t) }} />{t}</Chip>)}</Grupo>}
            <Grupo nome="Comportamento">
              {[...CATEGORIAS, OUTRO].map((c) => (
                <Chip key={c.id} ativo={cats.includes(c.id)} onClick={() => setCats((v) => alterna(v, c.id))}>
                  <span aria-hidden className={cn("h-2 w-2 rounded-full", c.ponto)} />{c.nome}<span className="text-muted-foreground">{contagem[c.id] ?? 0}</span>
                </Chip>
              ))}
            </Grupo>
            {mesesTodos.length > 1 && <Grupo nome="Mês">{mesesTodos.map((m) => <Chip key={m} ativo={meses.includes(m)} onClick={() => setMeses((v) => alterna(v, m))}>{nomeDoMes(m)}</Chip>)}</Grupo>}
          </div>

          <div className="flex min-h-8 flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{nAulas} {nAulas === 1 ? "aula" : "aulas"} · {nOcs} {nOcs === 1 ? "ocorrência" : "ocorrências"}{algumFiltro && " com esses filtros"}</span>
            {algumFiltro && <button onClick={limpar} className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs hover:text-foreground"><X className="h-3.5 w-3.5" />Limpar filtros</button>}
            {nOcs > 0 && <button onClick={() => navigator.clipboard?.writeText(resumo())} className="ml-auto inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><Copy className="h-3.5 w-3.5" />Copiar ocorrências (Conselho de Classe)</button>}
          </div>

          {aluno && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <h2 className="font-serif text-xl font-semibold">{mostrar(aluno)}</h2>
              {fichaDe(aluno) && <button onClick={() => onOpen(fichaDe(aluno).path)} className="text-xs text-primary hover:underline">abrir ficha</button>}
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {[...CATEGORIAS, OUTRO].filter((c) => contagem[c.id]).map((c) => <span key={c.id} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("h-2 w-2 rounded-full", c.ponto)} />{c.nome} <b className="font-medium text-foreground">{contagem[c.id]}</b></span>)}
              </span>
            </div>
          )}

          {grupos.length === 0
            ? <p className="py-6 text-sm text-muted-foreground">{algumFiltro ? <>Nada com esses filtros. <button onClick={limpar} className="text-primary underline">Limpar filtros</button></> : "Nenhum registro ainda."}</p>
            : grupos.map((g) => (
              <section key={g.k} aria-label={g.titulo} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
                  <h2 className="text-sm font-medium">{agrupar === "aluno" ? mostrar(g.titulo) : g.titulo}<span className="ml-2 text-xs font-normal text-muted-foreground">{g.itens.length}</span></h2>
                  {agrupar !== "aluno" && [...new Map(g.itens.filter((r) => r.transcricao !== "aprovada").map((r) => [r.diario, r.turma]))].map(([path, turma]) => (
                    <span key={path} className="inline-flex items-center gap-2 rounded-full border border-warn/50 py-0.5 pl-2.5 pr-1 text-xs text-warn">
                      Turma {turma}: transcrição a aprovar
                      <button onClick={() => aprovarDiario(path)} title="Marca a transcrição desta semana como conferida" className="rounded-full bg-warn/15 px-2 py-0.5 font-medium hover:bg-warn/25">Aprovar</button>
                    </span>
                  ))}
                </div>
                <div className="overflow-hidden rounded-xl border">
                  {g.itens.map((r) => <Linha key={r.id} r={r} nome={r.aluno && mostrar(r.aluno)} porAluno={agrupar === "aluno"} onEditar={() => editar(r.diario)} />)}
                </div>
              </section>
            ))}
        </>}

      {dialogo === "aluno" && <NovoAluno turmas={todasTurmas} turmaInicial={turmas[0]} onClose={() => setDialogo(null)} onOk={async (turma, nome) => { await criarAluno(items, { ano, turma, nome }); await onRefresh(); setDialogo(null); }} />}
      {dialogo === "diario" && <NovoDiario turmas={todasTurmas} turmaInicial={turmas[0]} semanas={semanas} diarios={diarios} onClose={() => setDialogo(null)}
        onOk={async (turma, semana, aulas, foto) => { const p = await criarDiario(items, { ano, turma, semana, aulas, foto }); setDialogo(null); await onRefresh(); editar(p); }} />}
      {dialogo === "registrar" && <Registrar turmas={todasTurmas} turmaInicial={turmas[0]} diarios={diarios} alunos={alunos} onClose={() => setDialogo(null)}
        onOk={async (d) => { await gravarOcorrencia(d); setDialogo(null); }} />}
    </div></div>
  );
}

/** Uma linha da lista: aula (o que foi trabalhado) ou ocorrência de aluno (com os comportamentos). */
function Linha({ r, nome, porAluno, onEditar }) {
  const aula = r.tipo === "aula";
  return (
    <div className="group flex min-h-11 items-start gap-3 border-b px-3 py-2.5 text-sm last:border-b-0 hover:bg-accent/60">
      {aula ? <BookOpen aria-label="Aula" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} /> : <User aria-label="Aluno" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {aula ? <span className="font-medium">{r.aula}{r.tema && <> · {r.tema}</>}</span>
            : <>
              {!porAluno && <span className="font-medium">{nome}</span>}
              {(r.cats.length ? r.cats : []).map((c) => { const k = cat(c.id); return (
                <span key={c.id} title={c.sugerida ? "Sugerido pelo texto; escreva #" + k.tag + " na linha para fixar" : "Etiqueta no diário"} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground", c.sugerida && "border-dashed")}>
                  <span aria-hidden className={cn("h-2 w-2 rounded-full", k.ponto)} />{k.nome}{c.sugerida && <span className="sr-only"> (sugerido)</span>}
                </span>); })}
            </>}
        </div>
        {r.texto && <p className={cn("mt-0.5 leading-relaxed", aula ? "text-muted-foreground" : "")}>{r.texto}</p>}
      </div>
      <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground md:inline-flex">
        {(porAluno || aula) && <span>{r.aula}</span>}{porAluno && <span>· {r.data ? minusculaMes(rotuloDe(r.data)) : r.semana}</span>}
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: corTurma(r.turma) }} />{r.turma}</span>
      </span>
      <button onClick={onEditar} aria-label="Editar o diário em Markdown" title="Editar o diário (Markdown)" className="shrink-0 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"><Pencil className="h-4 w-4" /></button>
    </div>
  );
}

/** Caixa de diálogo comum (mesmo desenho do "Mover para…"). */
function Caixa({ titulo, onClose, children }) {
  useEffect(() => { const t = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", t); return () => window.removeEventListener("keydown", t); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[10vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label={titulo} onMouseDown={(e) => e.stopPropagation()} className="flex max-h-[80vh] w-[min(520px,92vw)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        <div className="flex items-center gap-2.5 border-b px-4 py-3"><h2 className="min-w-0 flex-1 truncate text-sm font-medium">{titulo}</h2><kbd className="rounded border px-1.5 text-xs text-muted-foreground">Esc</kbd></div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4 text-sm">{children}</div>
      </div>
    </div>
  );
}
const Campo = ({ nome, children }) => <label className="flex flex-col gap-1"><span className="text-xs font-medium text-muted-foreground">{nome}</span>{children}</label>;
const entrada = "h-9 rounded-md border bg-background px-2.5 text-sm outline-none focus:border-primary";
const Botoes = ({ ok, rotulo, desabilitado, onClose }) => (
  <div className="flex justify-end gap-3 pt-1"><button onClick={onClose} className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">Cancelar</button>
    <button onClick={ok} disabled={desabilitado} className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-40">{rotulo}</button></div>
);

function Registrar({ turmas, turmaInicial, diarios, alunos, onClose, onOk }) {
  const [turma, setTurma] = useState(turmaInicial ?? turmas[0] ?? "");
  const dosDiarios = diarios.filter((d) => d.turma === turma).slice().reverse();
  const [diario, setDiario] = useState(""), [n, setN] = useState(1), [nome, setNome] = useState(""), [ids, setIds] = useState([]), [texto, setTexto] = useState(""), [aulas, setAulas] = useState([]), [erro, setErro] = useState(""), [salvando, setSalvando] = useState(false);
  useEffect(() => { setDiario(dosDiarios[0]?.path ?? ""); setNome(""); }, [turma]);  
  useEffect(() => {
    let vivo = true;
    if (!diario) { setAulas([]); return; }
    invoke("read_note", { path: diario }).then((t) => { if (!vivo) return; const a = aulasDoDiario(t); setAulas(a); setN(Math.min(n, a.length) || 1); }).catch(() => {});
    return () => { vivo = false; };
  }, [diario]);  
  const deTurma = alunos.filter((a) => a.turma === turma);
  const [novo, setNovo] = useState("");
  const alvo = (novo.trim() || nome).trim();
  const salvar = async () => { setSalvando(true); setErro(""); try { await onOk({ diario, n, nome: alvo, ids, texto: texto.trim(), turma }); } catch (e) { setErro(String(e?.message ?? e)); setSalvando(false); } };
  return (
    <Caixa titulo="Registrar ocorrência" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Campo nome="Turma"><select value={turma} onChange={(e) => setTurma(e.target.value)} className={entrada}>{turmas.map((t) => <option key={t} value={t}>Turma {t}</option>)}</select></Campo>
        <Campo nome="Diário (semana)"><select value={diario} onChange={(e) => setDiario(e.target.value)} className={entrada}>{dosDiarios.map((d) => { const r = d.name.replace(/^Diario \S+ - /, ""), dt = dataDaSemana(r, d.ano); return <option key={d.path} value={d.path}>{dt ? minusculaMes(rotuloDe(dt)) : r}</option>; })}{!dosDiarios.length && <option value="">Nenhum diário desta turma</option>}</select></Campo>
      </div>
      <Campo nome="Aula"><select value={n} onChange={(e) => setN(Number(e.target.value))} className={entrada}>{aulas.map((a, i) => <option key={i} value={i + 1}>{a.titulo}</option>)}{!aulas.length && <option value={1}>Fim da nota</option>}</select></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo nome="Aluno"><select value={nome} onChange={(e) => { setNome(e.target.value); setNovo(""); }} className={entrada}><option value="">Escolher…</option>{deTurma.map((a) => <option key={a.path} value={a.name}>{a.name}</option>)}</select></Campo>
        <Campo nome="ou aluno novo"><input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nome completo" className={entrada} /></Campo>
      </div>
      <div className="flex flex-col gap-1.5"><span className="text-xs font-medium text-muted-foreground">Comportamento</span>
        <div className="flex flex-wrap gap-2">{CATEGORIAS.map((c) => <Chip key={c.id} ativo={ids.includes(c.id)} onClick={() => setIds((v) => alterna(v, c.id))}><span aria-hidden className={cn("h-2 w-2 rounded-full", c.ponto)} />{c.nome}</Chip>)}</div></div>
      <Campo nome="O que aconteceu"><textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Ex.: conversou durante a leitura; chamado a atenção duas vezes." className="rounded-md border bg-background p-2.5 text-sm outline-none focus:border-primary" /></Campo>
      {erro && <Estado tipo="err">{erro}</Estado>}
      <Botoes ok={salvar} rotulo={salvando ? "Salvando…" : "Registrar"} desabilitado={!diario || !alvo || (!texto.trim() && !ids.length) || salvando} onClose={onClose} />
    </Caixa>
  );
}

function NovoAluno({ turmas, turmaInicial, onClose, onOk }) {
  const [turma, setTurma] = useState(turmaInicial ?? turmas[0] ?? ""), [nome, setNome] = useState(""), [erro, setErro] = useState("");
  const salvar = async () => { try { await onOk(turma.trim(), nome.trim()); } catch (e) { setErro(String(e?.message ?? e)); } };
  return (
    <Caixa titulo="Novo aluno" onClose={onClose}>
      <Campo nome="Turma"><input list="turmas-diario" value={turma} onChange={(e) => setTurma(e.target.value)} className={entrada} /><datalist id="turmas-diario">{turmas.map((t) => <option key={t} value={t} />)}</datalist></Campo>
      <Campo nome="Nome"><input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && nome.trim() && turma.trim() && salvar()} className={entrada} /></Campo>
      {erro && <Estado tipo="err">{erro}</Estado>}
      <Botoes ok={salvar} rotulo="Criar" desabilitado={!nome.trim() || !turma.trim()} onClose={onClose} />
    </Caixa>
  );
}

function NovoDiario({ turmas, turmaInicial, semanas, diarios, onClose, onOk }) {
  const [turma, setTurma] = useState(turmaInicial ?? turmas[0] ?? ""), [i, setI] = useState(semanas.length - 1), [foto, setFoto] = useState(""), [erro, setErro] = useState("");
  const s = semanas[i];
  const aulas = (s?.turmas.filter((t) => turmasDe(t.turma).includes(turma)).flatMap((t) => t.aulas) ?? []).map((a) => a.texto.replace(/\*\*/g, ""));
  const ja = s && diarios.some((d) => d.name === `Diario ${turma} - ${s.rotulo}`);
  const salvar = async () => { try { await onOk(turma, s.rotulo || s.name, aulas, foto.trim()); } catch (e) { setErro(String(e?.message ?? e)); } };
  return (
    <Caixa titulo="Novo diário" onClose={onClose}>
      {!semanas.length ? <div className="text-muted-foreground">Crie antes uma semana na tela Semana: o diário usa as aulas dela.</div> : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo nome="Turma"><select value={turma} onChange={(e) => setTurma(e.target.value)} className={entrada}>{turmas.map((t) => <option key={t} value={t}>Turma {t}</option>)}</select></Campo>
            <Campo nome="Semana"><select value={i} onChange={(e) => setI(Number(e.target.value))} className={entrada}>{semanas.map((x, k) => <option key={x.path} value={k}>{x.rotulo || x.name}</option>)}</select></Campo>
          </div>
          <div className="text-xs text-muted-foreground">{aulas.length ? `${aulas.length} aula(s) desta turma na semana, já copiadas do planejamento.` : "Esta turma não tem aulas na semana; o diário começa vazio."}</div>
          <Campo nome="Foto do caderno (opcional)"><input value={foto} onChange={(e) => setFoto(e.target.value)} placeholder="nome-do-arquivo.jpg" className={entrada} /></Campo>
          {ja && <Estado tipo="warn" className="text-xs">já existe um diário desta turma para esta semana</Estado>}
          {erro && <Estado tipo="err">{erro}</Estado>}
        </>
      )}
      <Botoes ok={salvar} rotulo="Criar" desabilitado={!s || ja || !turma} onClose={onClose} />
    </Caixa>
  );
}
