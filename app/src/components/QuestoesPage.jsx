import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileText, Plus } from "lucide-react";
import { ProvaPage } from "@/components/ProvaPage";
import { Explorador, cmp } from "@/components/Explorador";
import { Anos } from "@/components/ui/Anos";
import { listaBancos, lerBanco } from "@/lib/prova";
import { invoke } from "@/lib/api";
import { corAno, corTurma } from "@/lib/cores";
import { Carregando } from "@/components/ui/estado";

export const listaProvas = (items) => items.filter((i) => /^Anos\/\d{4}\/Provas\/[^/]+\.md$/.test(i.rel));
const TIPOS = [{ id: "banco", nome: "Banco de questões" }, { id: "prova", nome: "Prova" }];
const ANOS = ["6", "7", "8", "9"];
const prop = (fm, k) => new RegExp(`^${k}:\\s*(.*)$`, "m").exec(fm)?.[1]?.trim().replace(/^"(.*)"$/, "$1") ?? "";

/** Questões: bancos de questões e provas já criadas, numa só listagem (filtro por tipo, ano…). "Montar prova" é um botão. */
export function QuestoesPage({ items, dirs, onOpen, onRefresh, aba, setAba, textoInicial, onUsouTexto, pasta, setPasta, onRename, onMove, onDelete, onNovaPasta }) {
  const [banco, setBanco] = useState(null);
  const [dados, setDados] = useState(undefined);
  const bancos = useMemo(() => listaBancos(items), [items]);
  const provas = useMemo(() => listaProvas(items), [items]);
  useEffect(() => {
    let vivo = true;
    Promise.all([
      ...bancos.map((it) => lerBanco(it).then((b) => ({ it, b })).catch(() => ({ it, b: null }))),
      ...provas.map((it) => invoke("read_note", { path: it.path }).then((t) => ({ it, fm: /^---\n([\s\S]*?)\n---/.exec(t)?.[1] ?? "", corpo: t.replace(/^---\n[\s\S]*?\n---\n?/, "") })).catch(() => ({ it, fm: "", corpo: "" }))),
    ]).then((r) => vivo && setDados(r));
    return () => { vivo = false; };
  }, [bancos, provas]);

  const base = items[0] ? items[0].path.slice(0, items[0].path.length - items[0].rel.length) + "Acervo/Questoes" : "";
  const pastasRel = useMemo(() => {
    const set = new Set();
    for (const d of dirs ?? []) if (d.startsWith("Acervo/Questoes/") && d.length > 16) set.add(d.slice(16).replace(/\/$/, ""));
    for (const b of bancos) { const seg = b.rel.split("/").slice(2, -1); seg.forEach((_, k) => set.add(seg.slice(0, k + 1).join("/"))); }
    return [...set].sort(cmp);
  }, [dirs, bancos]);

  const lista = useMemo(() => (dados ?? []).map((x) => {
    if (x.b !== undefined) { // banco
      const { it, b } = x, nq = b ? b.textos.reduce((s, t) => s + t.questoes.length, 0) + b.independentes.length : null;
      return { id: it.path, path: it.path, rel: it.rel, nome: b?.titulo?.trim() || it.name, nomeEdit: it.name, pasta: it.rel.split("/").slice(2, -1).join("/"), tipo_: "banco", anos: b?.ano ? [String(b.ano)] : [], nq, nTextos: b?.textos.length ?? 0, lido: !!b, busca: b ? b.textos.map((t) => t.titulo ?? "").join(" ") : "" };
    }
    const { it, fm, corpo } = x, turma = prop(fm, "turma"), letivo = it.rel.split("/")[1];
    return { id: it.path, path: it.path, rel: it.rel, nome: it.name, pasta: "", fixo: true, tipo_: "prova", turma, anos: /^[6-9]/.test(turma) ? [turma[0]] : [], letivo, data: prop(fm, "data"), valor: prop(fm, "valor"), nq: (prop(fm, "questoes").match(/\d+/g) ?? []).length, lido: true, busca: `${turma} ${letivo}`, trecho: corpo.replace(/[#*>\[\]]/g, "").trim().slice(0, 200) };
  }), [dados]);

  if (aba === "montar") {
    return (
      <ProvaPage items={items} onOpen={onOpen} onRefresh={onRefresh} textoInicial={textoInicial} onUsouTexto={onUsouTexto} bancoInicial={banco} onVoltar={() => setAba("bancos")} />
    );
  }
  if (dados === undefined) return <Carregando>Lendo os bancos e as provas…</Carregando>;
  const montar = (p) => { setBanco(p ?? null); setAba("montar"); };
  const letivos = [...new Set(lista.filter((i) => i.letivo).map((i) => i.letivo))].sort().reverse();
  const nb = lista.filter((i) => i.tipo_ === "banco").length, np = lista.length - nb;

  return (
    <Explorador
      chave="questoes" titulo="Questões" unidade={["item", "itens"]} buscaDica="Buscar banco ou prova…"
      subtitulo={<>{nb} {nb === 1 ? "banco" : "bancos"} · {np} {np === 1 ? "prova" : "provas"}</>}
      itens={lista} pasta={pasta} setPasta={setPasta} raiz={{ rel: "Acervo/Questoes", abs: base }} pastasRel={pastasRel}
      filtros={[
        { id: "tipo", opcoes: TIPOS.map((t) => ({ id: t.id, nome: t.nome === "Prova" ? "Provas" : "Bancos de questões" })), de: (i) => [i.tipo_] },
        { id: "ano", opcoes: ANOS.map((a) => ({ id: a, nome: `${a}º ano`, cor: corAno(a) })), de: (i) => i.anos },
        ...(letivos.length > 1 ? [{ id: "letivo", opcoes: letivos.map((l) => ({ id: l, nome: l })), de: (i) => (i.letivo ? [i.letivo] : []) }] : []),
      ]}
      ordens={[{ id: "ano", nome: "Ano", chave: (i) => i.anos[0] ?? "9z" }, { id: "tipo", nome: "Tipo", chave: (i) => i.tipo_ }, { id: "quant", nome: "Nº de questões", chave: (i) => String(1000 - (i.nq ?? 0)) }]}
      faixa={(i) => i.anos.map(corAno)}
      icone={(i) => (i.tipo_ === "prova" ? ClipboardList : FileText)}
      previa={(i) => i.tipo_ === "banco"
        ? <div className="flex h-full flex-col justify-center gap-0.5"><span className="font-serif text-4xl font-semibold text-foreground/80">{i.nq ?? "?"}</span><span className="text-xs text-muted-foreground">{i.lido ? `questões · ${i.nTextos} ${i.nTextos === 1 ? "texto-base" : "textos-base"}` : "não deu para ler este banco"}</span></div>
        : <div className="flex h-full flex-col justify-center gap-0.5"><span className="font-serif text-2xl font-semibold text-foreground/80">{i.turma ? `Turma ${i.turma}` : "Prova"}</span><span className="text-xs text-muted-foreground">{[i.data, i.nq ? `${i.nq} questões` : "", i.valor ? `valor ${i.valor}` : ""].filter(Boolean).join(" · ")}</span></div>}
      meta={(i) => <><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">{i.tipo_ === "prova" ? <><ClipboardList aria-hidden className="h-3.5 w-3.5" />Prova</> : <><FileText aria-hidden className="h-3.5 w-3.5" />Banco</>}</span><Anos anos={i.anos} />{i.turma && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: corTurma(i.turma) }} />{i.turma}</span>}</>}
      colunas={[
        { id: "tipo", nome: "Tipo", w: "w-36", ordem: "tipo", render: (i) => <span className="text-xs text-muted-foreground">{i.tipo_ === "prova" ? `Prova${i.letivo ? ` · ${i.letivo}` : ""}` : "Banco de questões"}</span> },
        { id: "ano", nome: "Ano", w: "w-20", ordem: "ano", render: (i) => (i.anos.length ? <Anos anos={i.anos} /> : <span className="text-xs text-muted-foreground">—</span>) },
        { id: "q", nome: "Questões", w: "w-24", ordem: "quant", render: (i) => <span className="text-xs text-muted-foreground">{i.nq ?? "—"}</span> },
      ]}
      menuExtra={(i) => (i.tipo_ === "banco" && i.lido ? [{ nome: "Montar prova com este banco", Icone: Plus, fazer: () => montar(i.path) }] : [])}
      onOpen={(i) => onOpen(i.path)} onRename={onRename} onMove={onMove} onDelete={onDelete} onNovaPasta={onNovaPasta}
      botoes={<button onClick={() => montar(null)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />Montar prova</button>}
      vazio={{ titulo: "Nenhum banco nem prova ainda", texto: "Os bancos ficam em Acervo/Questoes; as provas montadas, em Anos/AAAA/Provas.", acao: { rotulo: "Montar uma prova", onClick: () => montar(null) } }}
      vazioPasta="Esta pasta está vazia. Arraste bancos para cá."
    />
  );
}
