import { raizBarra } from "@/lib/raiz";
import { useEffect, useMemo, useState } from "react";
import { IconChevronDown as ChevronDown, IconClipboardList as ClipboardList, IconFileText as FileText, IconDeviceGamepad2 as Gamepad2, IconPlus as Plus, IconQuote as Quote } from "@tabler/icons-react";
import { ProvaPage } from "@/components/ProvaPage";
import { Explorador, cmp } from "@/components/Explorador";
import { Anos } from "@/components/ui/Anos";
import { listaBancos, lerBanco } from "@/lib/prova";
import { parseFm } from "@/lib/frontmatter";
import { invoke } from "@/lib/api";
import { corAno, corTurma } from "@/lib/cores";
import { Carregando } from "@/components/ui/estado";

export const listaProvas = (items) => items.filter((i) => /^Anos\/\d{4}\/Provas\/[^/]+\.md$/.test(i.rel));
export const listaTextos = (items) => items.filter((i) => /^Acervo\/Textos\/.*\.md$/.test(i.rel) && !/\/imagens\//.test(i.rel));
export const listaOficinas = (items) => items.filter((i) => /^Acervo\/Oficinas\/.*\.md$/.test(i.rel));
const RAIZ = "Acervo", PASTAS = ["Textos", "Questoes", "Oficinas"]; // as pastas do Acervo que são recursos
const TIPOS = [{ id: "texto", nome: "Textos", um: "Texto" }, { id: "banco", nome: "Bancos de questões", um: "Banco de questões" }, { id: "prova", nome: "Provas", um: "Prova" }, { id: "oficina", nome: "Oficinas", um: "Oficina" }];
const ICONES = { texto: Quote, banco: FileText, prova: ClipboardList, oficina: Gamepad2 };
const campo = (fm, ...ks) => { for (const k of ks) { const e = fm.entries.find((x) => x.key === k); const v = e?.value || (e?.items ?? []).join(", "); if (v) return v; } return ""; };
const trechoDe = (t, fm) => (fm.has ? fm.lines.slice(fm.entries.length ? fm.lines.findIndex((l, i) => i > 0 && l.trim() === "---") + 1 : 0) : t.split("\n")).join("\n").replace(/^#.*$/gm, "").replace(/!?\[\[[^\]]*\]\]|[*_`>#|-]/g, "").replace(/\s+/g, " ").trim().slice(0, 220);
const ANOS = ["6", "7", "8", "9"];
const prop = (fm, k) => new RegExp(`^${k}:\\s*(.*)$`, "m").exec(fm)?.[1]?.trim().replace(/^"(.*)"$/, "$1") ?? "";

const NOVOS = [
  { id: "texto", nome: "Novo texto", dica: "Ficha em Acervo/Textos", Icone: Quote },
  { id: "oficina", nome: "Nova oficina", dica: "Jogo ou dinâmica em Acervo/Oficinas", Icone: Gamepad2 },
  { id: "banco", nome: "Novo banco de questões", dica: "Questões sobre textos-base, em Acervo/Questoes", Icone: FileText },
  { id: "prova", nome: "Montar prova", dica: "Escolhe questões de um banco e gera a folha", Icone: ClipboardList },
];
/** Botão "Novo": abre um menu com os recursos que podem ser criados. */
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

/** Recursos: textos, bancos de questões, provas e oficinas do acervo, numa só listagem (filtro por tipo, ano, gênero…). "Montar prova" é um botão. */
export function RecursosPage({ items, dirs, onOpen, onRefresh, aba, setAba, textoInicial, onUsouTexto, pasta, setPasta, onRename, onMove, onDelete, onNovaPasta, onAtividade, onNovo }) {
  const [banco, setBanco] = useState(null);
  const [dados, setDados] = useState(undefined);
  const bancos = useMemo(() => listaBancos(items), [items]);
  const provas = useMemo(() => listaProvas(items), [items]);
  const textos = useMemo(() => listaTextos(items), [items]);
  const oficinas = useMemo(() => listaOficinas(items), [items]);
  useEffect(() => {
    let vivo = true;
    Promise.all([
      ...bancos.map((it) => lerBanco(it).then((b) => ({ it, b })).catch(() => ({ it, b: null }))),
      ...[...textos.map((it) => [it, "texto"]), ...oficinas.map((it) => [it, "oficina"])].map(([it, k]) => invoke("read_note", { path: it.path }).then((t) => ({ it, k, fm: parseFm(t), t })).catch(() => ({ it, k, fm: parseFm(""), t: "" }))),
      ...provas.map((it) => invoke("read_note", { path: it.path }).then((t) => ({ it, fm: /^---\n([\s\S]*?)\n---/.exec(t)?.[1] ?? "", corpo: t.replace(/^---\n[\s\S]*?\n---\n?/, "") })).catch(() => ({ it, fm: "", corpo: "" }))),
    ]).then((r) => vivo && setDados(r));
    return () => { vivo = false; };
  }, [bancos, provas, textos, oficinas]);

  const base = raizBarra(items) ? raizBarra(items) + RAIZ : "";
  const pastasRel = useMemo(() => {
    const set = new Set();
    const ok = (r) => PASTAS.includes(r.split("/")[0]) && r !== "Textos/imagens" && !r.startsWith("Textos/imagens/");
    for (const d of dirs ?? []) if (d.startsWith(RAIZ + "/") && d.length > RAIZ.length + 1) { const r = d.slice(RAIZ.length + 1).replace(/\/$/, ""); if (ok(r)) set.add(r); }
    for (const b of [...bancos, ...textos, ...oficinas]) { const seg = b.rel.split("/").slice(1, -1); seg.forEach((_, k) => set.add(seg.slice(0, k + 1).join("/"))); }
    return [...set].filter(ok).sort(cmp);
  }, [dirs, bancos, textos, oficinas]);

  const lista = useMemo(() => (dados ?? []).map((x) => {
    if (x.k === "texto" || x.k === "oficina") { // ficha de texto ou nota de oficina
      const { it, k, fm, t } = x, g = (...a) => campo(fm, ...a), pasta = it.rel.split("/").slice(1, -1).join("/");
      const anos = (g("ano", "anos").match(/[6-9]/g) ?? []).filter((a, i, arr) => arr.indexOf(a) === i);
      return { id: it.path, path: it.path, rel: it.rel, nome: g("titulo", "title") || it.name, nomeEdit: it.name, pasta, tipo_: k, anos, autor: g("autor", "author"), genero: g("genero"), foco: g("foco", "conteudo"), nq: null, lido: true, busca: [g("autor", "author"), g("genero"), g("tags"), g("conteudos", "conteudo")].join(" "), trecho: trechoDe(t, fm) };
    }
    if (x.b !== undefined) { // banco
      const { it, b } = x, nq = b ? b.textos.reduce((s, t) => s + t.questoes.length, 0) + b.independentes.length : null;
      return { id: it.path, path: it.path, rel: it.rel, nome: b?.titulo?.trim() || it.name, nomeEdit: it.name, pasta: it.rel.split("/").slice(1, -1).join("/"), tipo_: "banco", anos: b?.ano ? [String(b.ano)] : [], nq, nTextos: b?.textos.length ?? 0, lido: !!b, busca: b ? b.textos.map((t) => t.titulo ?? "").join(" ") : "" };
    }
    const { it, fm, corpo } = x, turma = prop(fm, "turma"), letivo = it.rel.split("/")[1];
    return { id: it.path, path: it.path, rel: it.rel, nome: it.name, pasta: "", fixo: true, tipo_: "prova", turma, anos: /^[6-9]/.test(turma) ? [turma[0]] : [], letivo, data: prop(fm, "data"), valor: prop(fm, "valor"), nq: (prop(fm, "questoes").match(/\d+/g) ?? []).length, lido: true, busca: `${turma} ${letivo}`, trecho: corpo.replace(/[#*>\[\]]/g, "").trim().slice(0, 200) };
  }), [dados]);

  if (aba === "montar") {
    return (
      <ProvaPage items={items} onOpen={onOpen} onRefresh={onRefresh} textoInicial={textoInicial} onUsouTexto={onUsouTexto} bancoInicial={banco} onVoltar={() => setAba("bancos")} />
    );
  }
  if (dados === undefined) return <Carregando>Lendo os recursos…</Carregando>;
  const montar = (p) => { setBanco(p ?? null); setAba("montar"); };
  const letivos = [...new Set(lista.filter((i) => i.letivo).map((i) => i.letivo))].sort().reverse();
  const n = (t) => lista.filter((i) => i.tipo_ === t).length;
  const generos = [...new Set(lista.map((i) => i.genero).filter(Boolean))].sort(cmp);
  const quant = (k, um, mais) => `${n(k)} ${n(k) === 1 ? um : mais}`;

  return (
    <Explorador
      chave="recursos" titulo="Recursos" unidade={["recurso", "recursos"]} buscaDica="Buscar texto, autor, banco, prova ou oficina…"
      subtitulo={<>{quant("texto", "texto", "textos")} · {quant("banco", "banco", "bancos")} · {quant("prova", "prova", "provas")} · {quant("oficina", "oficina", "oficinas")}</>}
      itens={lista} pasta={pasta} setPasta={setPasta} raiz={{ rel: RAIZ, abs: base }} pastasRel={pastasRel}
      filtros={[
        { id: "tipo", opcoes: TIPOS.map((t) => ({ id: t.id, nome: t.nome })), de: (i) => [i.tipo_] },
        { id: "ano", opcoes: ANOS.map((a) => ({ id: a, nome: `${a}º ano`, cor: corAno(a) })), de: (i) => i.anos },
        ...(generos.length ? [{ id: "genero", opcoes: generos.map((g) => ({ id: g, nome: g })), de: (i) => (i.genero ? [i.genero] : []) }] : []),
        ...(letivos.length > 1 ? [{ id: "letivo", opcoes: letivos.map((l) => ({ id: l, nome: l })), de: (i) => (i.letivo ? [i.letivo] : []) }] : []),
      ]}
      ordens={[{ id: "ano", nome: "Ano", chave: (i) => i.anos[0] ?? "9z" }, { id: "tipo", nome: "Tipo", chave: (i) => i.tipo_ }, { id: "quant", nome: "Nº de questões", chave: (i) => String(1000 - (i.nq ?? 0)) }]}
      faixa={(i) => i.anos.map(corAno)}
      icone={(i) => ICONES[i.tipo_] ?? FileText}
      previa={(i) => i.tipo_ === "banco"
        ? <div className="flex h-full flex-col justify-center gap-0.5"><span className="font-serif text-4xl font-semibold text-foreground/80">{i.nq ?? "?"}</span><span className="text-xs text-muted-foreground">{i.lido ? `questões · ${i.nTextos} ${i.nTextos === 1 ? "texto-base" : "textos-base"}` : "não deu para ler este banco"}</span></div>
        : i.tipo_ === "texto" || i.tipo_ === "oficina"
          ? <div className="flex h-full flex-col gap-1"><span className="text-xs font-medium text-foreground/80">{[i.autor, i.genero].filter(Boolean).join(" · ") || (i.tipo_ === "oficina" ? i.foco : "")}</span><p className="text-[11px] leading-relaxed text-muted-foreground">{i.trecho || "Sem texto ainda."}</p></div>
          : <div className="flex h-full flex-col justify-center gap-0.5"><span className="font-serif text-2xl font-semibold text-foreground/80">{i.turma ? `Turma ${i.turma}` : "Prova"}</span><span className="text-xs text-muted-foreground">{[i.data, i.nq ? `${i.nq} questões` : "", i.valor ? `valor ${i.valor}` : ""].filter(Boolean).join(" · ")}</span></div>}
      meta={(i) => <><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">{(() => { const I = ICONES[i.tipo_] ?? FileText; return <><I aria-hidden className="h-3.5 w-3.5" />{i.tipo_ === "banco" ? "Banco" : TIPOS.find((t) => t.id === i.tipo_)?.um}</>; })()}</span><Anos anos={i.anos} />{i.turma && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: corTurma(i.turma) }} />{i.turma}</span>}</>}
      colunas={[
        { id: "tipo", nome: "Tipo", w: "w-36", ordem: "tipo", render: (i) => <span className="text-xs text-muted-foreground">{i.tipo_ === "prova" ? `Prova${i.letivo ? ` · ${i.letivo}` : ""}` : TIPOS.find((t) => t.id === i.tipo_)?.um}</span> },
        { id: "ano", nome: "Ano", w: "w-20", ordem: "ano", render: (i) => (i.anos.length ? <Anos anos={i.anos} /> : <span className="text-xs text-muted-foreground">—</span>) },
        { id: "q", nome: "Questões", w: "w-24", ordem: "quant", render: (i) => <span className="text-xs text-muted-foreground">{i.tipo_ === "texto" || i.tipo_ === "oficina" ? "—" : i.nq ?? "—"}</span> },
      ]}
      menuExtra={(i) => (i.tipo_ === "banco" && i.lido ? [{ nome: "Montar prova com este banco", Icone: Plus, fazer: () => montar(i.path) }] : i.tipo_ === "texto" && onAtividade ? [{ nome: "Atividade a partir deste texto", Icone: Plus, fazer: () => onAtividade(i.path) }] : [])}
      onOpen={(i) => onOpen(i.path)} onRename={onRename} onMove={onMove} onDelete={onDelete} onNovaPasta={onNovaPasta}
      botoes={<BotaoNovo onEscolher={(id) => (id === "prova" ? montar(null) : onNovo?.(id))} />}
      vazio={{ titulo: "Nenhum recurso ainda", texto: "Os textos ficam em Acervo/Textos, os bancos em Acervo/Questoes, as oficinas em Acervo/Oficinas; as provas montadas, em Anos/AAAA/Provas.", acao: { rotulo: "Criar um texto", onClick: () => onNovo?.("texto") } }}
      vazioPasta="Esta pasta está vazia. Arraste recursos para cá."
    />
  );
}
