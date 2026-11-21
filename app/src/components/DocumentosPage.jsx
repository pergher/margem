import { raizBarra } from "@/lib/raiz";
import { useEffect, useMemo, useState } from "react";
import { IconBook as BookText, IconBookmarks as BookMarked, IconChevronDown as ChevronDown, IconClipboardList as ClipboardList, IconDeviceGamepad2 as Gamepad2, IconQuote as Quote, IconRepeat as Repeat2, IconFileText as FileText, IconListCheck as ListChecks, IconNetwork as Network, IconPlus as Plus } from "@tabler/icons-react";
import { iconeComoComponente } from "@/lib/tiposNota";
import { ProvaPage } from "@/components/ProvaPage";
import { Explorador, cmp } from "@/components/Explorador";
import { Anos } from "@/components/ui/Anos";
import { Carregando } from "@/components/ui/estado";
import { listaBancos, lerBanco } from "@/lib/prova";
import { invoke } from "@/lib/api";
import { corAno, corTurma } from "@/lib/cores";
import { cn } from "@/lib/utils";
import { ANOS, SITUACOES, TIPOS, ehDoAcervo, ehProvaLegada, metaDe, metaFicha, metaGramatica, metaProva, quando, tipoDe } from "@/lib/documentos";

const RAIZ = "Acervo";
const tipoNome = (id) => TIPOS.find((t) => t.id === id)?.um ?? "Documento";
// um componente de ícone (na cor do tipo) por tipo de documento, criado uma vez só
const ICONES = Object.fromEntries(TIPOS.map((t) => [t.id, iconeComoComponente(t.id === "doc" ? "nota" : t.id)]));
const tipoIcone = (id) => ICONES[id] ?? ICONES.doc;
const sit = (id) => SITUACOES.find((s) => s.id === id) ?? SITUACOES[0];
const FILTROS_FIXOS = ["aula", "gramatica", "texto", "ciclo"];
const TEM_SITUACAO = ["aula", "gramatica"];

export function Situacao({ id, className }) {
  const s = sit(id);
  return <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}><span aria-hidden className={cn("h-2 w-2 rounded-full", s.ponto)} />{s.nome}</span>;
}

const NOVOS = [
  { id: "aula", nome: "Nova aula", dica: "Plano de aula em Acervo/Aulas", Icone: BookText },
  { id: "gramatica", nome: "Nova gramática", dica: "Tópico de referência em Acervo/Gramática", Icone: BookMarked },
  { id: "texto", nome: "Novo texto", dica: "Ficha em Acervo/Textos", Icone: Quote },
  { id: "oficina", nome: "Nova oficina", dica: "Jogo ou dinâmica em Acervo/Oficinas", Icone: Gamepad2 },
  { id: "ciclo", nome: "Novo ciclo", dica: "Sequência de 16 aulas, em Acervo/Ciclos", Icone: Repeat2 },
  { id: "banco", nome: "Novo banco de questões", dica: "Questões sobre textos-base, em Acervo/Questoes", Icone: FileText },
  { id: "prova", nome: "Montar prova", dica: "Escolhe questões de um banco e gera a folha", Icone: ClipboardList },
];
/** Botão "Novo": abre um menu com os documentos que podem ser criados. */
function BotaoNovo({ onEscolher }) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => { if (!aberto) return; const f = (e) => { if (e.key === "Escape") setAberto(false); }; window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [aberto]);
  return (
    <div className="relative">
      <button onClick={(e) => { e.stopPropagation(); setAberto(!aberto); }} aria-haspopup="menu" aria-expanded={aberto} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />Novo<ChevronDown className="h-4 w-4" /></button>
      {aberto && <>
        <div className="fixed inset-0 z-40" onMouseDown={() => setAberto(false)} />
        <div role="menu" className="absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-lg border bg-background p-1 shadow-lg">
          {NOVOS.map(({ id, nome, dica, Icone }) => (
            <button key={id} role="menuitem" onClick={() => { setAberto(false); onEscolher(id); }} className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-accent">
              <Icone aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
              <span className="flex flex-col"><span className="text-sm">{nome}</span><span className="text-xs text-muted-foreground">{dica}</span></span>
            </button>))}
        </div>
      </>}
    </div>
  );
}

/** Lê um documento e devolve os campos extras da listagem, conforme o tipo. */
async function lerMeta(a) {
  if (a.tipo_ === "banco") {
    const b = await lerBanco(a).catch(() => null);
    return { lido: !!b, titulo: b?.titulo?.trim() ?? "", anos: b?.ano ? [String(b.ano)] : [], nq: b ? b.textos.reduce((s, t) => s + t.questoes.length, 0) + b.independentes.length : null, nTextos: b?.textos.length ?? 0, busca: b ? b.textos.map((t) => t.titulo ?? "").join(" ") : "" };
  }
  const texto = await invoke("read_note", { path: a.path }).catch(() => "");
  const m = a.tipo_ === "aula" ? metaDe(texto) : a.tipo_ === "gramatica" ? metaGramatica(texto) : a.tipo_ === "prova" ? metaProva(texto) : metaFicha(texto);
  return { lido: true, ...m, busca: [...(m.assuntos ?? []), ...(m.tags ?? []), m.trecho, m.busca ?? ""].join(" ") };
}

/** Documentos: toda a pasta Acervo (aulas, gramática, textos, bancos, oficinas, ciclos e qualquer outro .md) e as provas, numa só lista. */
export function DocumentosPage({ filtroNav, items, dirs, onOpen, onRefresh, aba, setAba, textoInicial, onUsouTexto, pasta, setPasta, onRename, onMove, onDelete, onNovaPasta, onAtividade, onNovo }) {
  const [banco, setBanco] = useState(null);
  const [metas, setMetas] = useState({});
  const todos = useMemo(() => [
    ...items.filter((i) => ehDoAcervo(i.rel)).map((i) => ({ ...i, tipo_: tipoDe(i.rel), pasta: i.rel.split("/").slice(1, -1).join("/") })),
    ...items.filter((i) => ehProvaLegada(i.rel)).map((i) => ({ ...i, tipo_: "prova", pasta: "", fixo: true, letivo: i.rel.split("/")[1] })),
  ], [items]);
  const raizAbs = raizBarra(items) ? raizBarra(items) + RAIZ : "";

  const pastasRel = useMemo(() => {
    const set = new Set();
    const ok = (r) => r !== "" && !r.split("/").includes("imagens");
    for (const d of dirs ?? []) if (d.startsWith(RAIZ + "/") && d.length > RAIZ.length + 1) { const r = d.slice(RAIZ.length + 1).replace(/\/$/, ""); if (ok(r)) set.add(r); }
    for (const a of todos) { if (a.fixo) continue; const seg = a.pasta ? a.pasta.split("/") : []; seg.forEach((_, k) => set.add(seg.slice(0, k + 1).join("/"))); }
    return [...set].filter(ok).sort(cmp);
  }, [dirs, todos]);

  // Lê cada documento uma vez (em lotes), para os filtros, a prévia e as colunas.
  useEffect(() => {
    let vivo = true;
    const faltam = todos.filter((a) => !metas[a.path]);
    if (!faltam.length) return;
    (async () => {
      for (let i = 0; i < faltam.length && vivo; i += 12) {
        const lote = await Promise.all(faltam.slice(i, i + 12).map(async (a) => [a.path, await lerMeta(a)]));
        if (vivo) setMetas((m) => ({ ...m, ...Object.fromEntries(lote) }));
      }
    })();
    return () => { vivo = false; };
  }, [todos]);

  const lista = useMemo(() => todos.map((a) => {
    const m = metas[a.path];
    return { ...a, anos: [], situacao: "", nq: null, ...(m ?? {}), carregado: !!m, id: a.path, nome: m?.titulo || a.name, nomeEdit: a.name, busca: m?.busca ?? "" };
  }), [todos, metas]);

  if (aba === "montar") {
    return <ProvaPage items={items} onOpen={onOpen} onRefresh={onRefresh} textoInicial={textoInicial} onUsouTexto={onUsouTexto} bancoInicial={banco} onVoltar={() => setAba("")} />;
  }
  const montar = (p) => { setBanco(p ?? null); setAba("montar"); };
  const n = (t) => todos.filter((i) => i.tipo_ === t).length;
  const generos = [...new Set(lista.map((i) => i.genero).filter(Boolean))].sort(cmp);
  const letivos = [...new Set(lista.filter((i) => i.letivo).map((i) => i.letivo))].sort().reverse();
  const tiposPresentes = TIPOS.filter((t) => n(t.id) > 0 || FILTROS_FIXOS.includes(t.id)); // os tipos principais têm filtro mesmo sem documentos
  const resumo = tiposPresentes.filter((t) => n(t.id) > 0).map((t) => `${n(t.id)} ${t.nome.toLowerCase()}`).join(" · ");

  const importar = async (arquivos, pastaAtual) => {
    const md = arquivos.filter((f) => /\.md$/i.test(f.name));
    if (!md.length) throw new Error("Só dá para importar arquivos .md.");
    const falhas = [];
    for (const f of md) {
      try { const path = await invoke("create_note", { dir: raizAbs + (pastaAtual ? "/" + pastaAtual : ""), name: f.name.replace(/\.md$/i, "") }); await invoke("save_note", { path, text: await f.text() }); }
      catch (e) { falhas.push(`${f.name}: ${String(e?.message ?? e)}`); }
    }
    await onRefresh(); if (falhas.length) throw new Error(falhas.join(" · "));
  };

  return (
    <Explorador
      filtroNav={filtroNav && { n: filtroNav.n, sels: filtroNav.tipo ? { tipo: [filtroNav.tipo] } : {} }}
      chave="documentos" titulo="Documentos" unidade={["documento", "documentos"]} buscaDica="Buscar por título, assunto, autor ou trecho…"
      subtitulo={<>{todos.length} {todos.length === 1 ? "documento" : "documentos"}{resumo && <> · {resumo}</>}</>}
      itens={lista} pasta={pasta} setPasta={setPasta} raiz={{ rel: RAIZ, abs: raizAbs }} pastasRel={pastasRel} colunaPasta={false} favoritos
      filtros={[
        { id: "tipo", opcoes: tiposPresentes.map((t) => ({ id: t.id, nome: t.nome })), de: (i) => [i.tipo_] },
        { id: "ano", opcoes: ANOS.map((a) => ({ id: a, nome: `${a}º ano`, cor: corAno(a) })), de: (i) => i.anos },
        { id: "sit", opcoes: SITUACOES.map((s) => ({ id: s.id, nome: s.nome, ponto: s.ponto })), de: (i) => (TEM_SITUACAO.includes(i.tipo_) ? [i.situacao || "pendente"] : []) },
        ...(generos.length ? [{ id: "genero", opcoes: generos.map((g) => ({ id: g, nome: g })), de: (i) => (i.genero ? [i.genero] : []) }] : []),
        ...(letivos.length > 1 ? [{ id: "letivo", opcoes: letivos.map((l) => ({ id: l, nome: l })), de: (i) => (i.letivo ? [i.letivo] : []) }] : []),
      ]}
      alternadores={[{ id: "mapa", nome: "Com mindmap", Icone: Network, teste: (i) => i.mindmap }]}
      ordens={[
        { id: "tipo", nome: "Tipo", chave: (i) => String(TIPOS.findIndex((t) => t.id === i.tipo_)) },
        { id: "ano", nome: "Ano", chave: (i) => i.anos[0] ?? "9z" },
        { id: "situacao", nome: "Situação", chave: (i) => String(SITUACOES.findIndex((s) => s.id === i.situacao)) },
        { id: "modificado", nome: "Modificado em", chave: (i) => String(i.modified ?? 0).padStart(12, "0") },
        { id: "quant", nome: "Nº de questões", chave: (i) => String(1000 - (i.nq ?? 0)) },
      ]}
      faixa={(i) => i.anos.map(corAno)}
      icone={(i) => tipoIcone(i.tipo_)}
      previa={(i) => {
        if (!i.carregado) return <p className="text-[11px] text-muted-foreground">…</p>;
        if (i.tipo_ === "banco") return <div className="flex h-full flex-col justify-center gap-0.5"><span className="font-serif text-4xl font-semibold text-foreground/80">{i.nq ?? "?"}</span><span className="text-xs text-muted-foreground">{i.lido ? `questões · ${i.nTextos} ${i.nTextos === 1 ? "texto-base" : "textos-base"}` : "não deu para ler este banco"}</span></div>;
        if (i.tipo_ === "prova") return <div className="flex h-full flex-col justify-center gap-0.5"><span className="font-serif text-2xl font-semibold text-foreground/80">{i.turma ? `Turma ${i.turma}` : "Prova"}</span><span className="text-xs text-muted-foreground">{[i.data, i.nq ? `${i.nq} questões` : "", i.valor ? `valor ${i.valor}` : ""].filter(Boolean).join(" · ")}</span></div>;
        if (i.tipo_ === "texto" || i.tipo_ === "oficina") return <div className="flex h-full flex-col gap-1"><span className="text-xs font-medium text-foreground/80">{[i.autor, i.genero].filter(Boolean).join(" · ") || (i.tipo_ === "oficina" ? i.foco : "")}</span><p className="text-[11px] leading-relaxed text-muted-foreground">{i.trecho || "Sem texto ainda."}</p></div>;
        return <p className="text-[11px] leading-relaxed text-muted-foreground">{i.trecho || "Ainda sem texto."}</p>;
      }}
      meta={(i) => { const I = tipoIcone(i.tipo_); return <>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><I aria-hidden className="h-3.5 w-3.5" />{tipoNome(i.tipo_)}</span>
        {TEM_SITUACAO.includes(i.tipo_) && <Situacao id={i.situacao || "pendente"} />}
        <Anos anos={i.anos} />
        {i.turma && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: corTurma(i.turma) }} />{i.turma}</span>}
        {i.mindmap && <Network aria-label="Tem mindmap" className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />}
        {i.atividades && <ListChecks aria-label="Tem atividades" className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />}
      </>; }}
      colunas={[
        { id: "tipo", nome: "Tipo", w: "w-28", ordem: "tipo", render: (i) => <span className="text-xs text-muted-foreground">{i.tipo_ === "prova" && i.letivo ? `Prova · ${i.letivo}` : tipoNome(i.tipo_)}</span> },
        { id: "ano", nome: "Ano", w: "w-20", ordem: "ano", render: (i) => (i.anos.length ? <Anos anos={i.anos} /> : <span className="text-xs text-muted-foreground">—</span>) },
        { id: "sit", nome: "Situação", w: "w-28", ordem: "situacao", render: (i) => (TEM_SITUACAO.includes(i.tipo_) ? <Situacao id={i.situacao || "pendente"} /> : <span className="text-xs text-muted-foreground">—</span>) },
        { id: "mod", nome: "Modificado em", w: "w-36", ordem: "modificado", render: (i) => <span className="text-xs text-muted-foreground">{quando(i.modified)}</span> },
      ]}
      menuExtra={(i) => (i.tipo_ === "banco" && i.lido ? [{ nome: "Montar prova com este banco", Icone: Plus, fazer: () => montar(i.path) }] : i.tipo_ === "texto" && onAtividade ? [{ nome: "Atividade a partir deste texto", Icone: Plus, fazer: () => onAtividade(i.path) }] : [])}
      onOpen={(i) => onOpen(i.path)} onRename={onRename} onMove={onMove} onDelete={onDelete} onAtualizar={(paths) => { if (paths?.length) setMetas((m) => { const n = { ...m }; paths.forEach((x) => delete n[x]); return n; }); return onRefresh(); }} onNovaPasta={onNovaPasta} onImportar={importar}
      botoes={<BotaoNovo onEscolher={(id) => (id === "prova" ? montar(null) : onNovo?.(id))} />}
      vazio={{ titulo: "Nenhum documento ainda", texto: "Tudo o que está na pasta Acervo aparece aqui: aulas, gramática, textos, bancos de questões, oficinas e ciclos. As provas montadas (Acervo/Provas) também.", acao: { rotulo: "Criar uma aula", onClick: () => onNovo?.("aula") } }}
      vazioPasta="Esta pasta está vazia. Crie um documento, uma pasta ou arraste arquivos .md para cá."
    />
  );
}
