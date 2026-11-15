import { useEffect, useMemo, useState } from "react";
import { ListChecks, Network, Plus } from "lucide-react";
import { Explorador, cmp, norm } from "@/components/Explorador";
import { invoke } from "@/lib/api";
import { parseFm } from "@/lib/frontmatter";
import { corAno } from "@/lib/cores";
import { Anos } from "@/components/ui/Anos";
import { cn } from "@/lib/utils";


export const SITUACOES = [
  { id: "pendente", nome: "Pendente", ponto: "bg-muted-foreground/50" },
  { id: "andamento", nome: "Em andamento", ponto: "bg-warn" },
  { id: "finalizado", nome: "Finalizada", ponto: "bg-ok" },
];
const sit = (id) => SITUACOES.find((s) => s.id === id) ?? SITUACOES[0];
export const ANOS = ["6", "7", "8", "9"];
export const quando = (s) => (s ? new Date(s * 1000).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "—");

/** Metadados de uma aula, lidos do frontmatter e do corpo: ano(s), situação, assuntos, seções e um trecho para a prévia. */
export function metaDe(texto) {
  const fm = parseFm(texto);
  const val = (k) => fm.entries.find((e) => e.key === k);
  const lista = (k) => { const e = val(k); return e ? (e.items ?? (e.value ? [e.value] : [])).map(String).filter(Boolean) : []; };
  const corpo = (fm.has ? fm.lines.slice(fm.end + 1).join("\n") : texto);
  const titulos = [...corpo.matchAll(/^##\s+(.*)$/gm)].map((m) => norm(m[1]));
  const trecho = corpo.split("\n")
    .map((l) => l.replace(/^>\s*(\[![^\]]*\][+-]?\s*)?/, "").replace(/^#+\s.*$/, "").replace(/!?\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/<[^>]*>/g, "").replace(/[*_`=~]/g, "").replace(/^[-+]\s+/, "").trim())
    .filter((l) => l.length > 24 && !/^[-|:]+$/.test(l)).slice(0, 4).join(" ");
  return {
    anos: lista("ano"), situacao: (val("status")?.value || "pendente").trim(), assuntos: lista("assuntos"), tags: lista("tags"),
    mindmap: titulos.some((t) => /mindmap|mapa mental|esquema/.test(t)) || /```mermaid/.test(corpo),
    atividades: titulos.some((t) => /atividade/.test(t)),
    palavras: corpo.split(/\s+/).filter(Boolean).length, trecho: trecho.slice(0, 260),
  };
}

export function Situacao({ id, className }) {
  const s = sit(id);
  return <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}><span aria-hidden className={cn("h-2 w-2 rounded-full", s.ponto)} />{s.nome}</span>;
}


/** Aulas: os arquivos de Acervo/Aulas, no explorador comum (pastas, grade/lista, busca, filtros). */
export function AulasPage({ items, dirs, onOpen, onCreate, pasta, setPasta, onRefresh, onRename, onMove, onDelete, onNovaPasta }) {
  const [metas, setMetas] = useState({});
  const raizAbs = items[0] ? items[0].path.slice(0, items[0].path.length - items[0].rel.length) + "Acervo/Aulas" : "";
  const todas = useMemo(() => items.filter((i) => /^Acervo\/Aulas\/.+\.md$/.test(i.rel)).map((i) => { const p = i.rel.split("/"); return { ...i, pasta: p.slice(2, -1).join("/") }; }), [items]);
  // Todas as pastas de Aulas (inclusive as vazias, que só aparecem na lista de pastas).
  const pastasRel = useMemo(() => {
    const set = new Set();
    for (const d of dirs ?? []) if (d.startsWith("Acervo/Aulas/") && d.length > 13) set.add(d.slice(13).replace(/\/$/, ""));
    for (const a of todas) { const seg = a.pasta ? a.pasta.split("/") : []; seg.forEach((_, k) => set.add(seg.slice(0, k + 1).join("/"))); }
    return [...set].sort(cmp);
  }, [dirs, todas]);
  // Lê o cabeçalho e o corpo de cada aula uma vez.
  useEffect(() => {
    let vivo = true;
    const faltam = todas.filter((a) => !metas[a.path]);
    if (!faltam.length) return;
    (async () => {
      for (let i = 0; i < faltam.length && vivo; i += 12) {
        const lote = await Promise.all(faltam.slice(i, i + 12).map(async (a) => [a.path, metaDe(await invoke("read_note", { path: a.path }).catch(() => ""))]));
        if (vivo) setMetas((m) => ({ ...m, ...Object.fromEntries(lote) }));
      }
    })();
    return () => { vivo = false; };
  }, [todas]); // eslint-disable-line react-hooks/exhaustive-deps

  const vazia = { anos: [], situacao: "pendente", assuntos: [], tags: [], mindmap: false, atividades: false, palavras: 0, trecho: "" };
  const itens = useMemo(() => todas.map((a) => { const m = metas[a.path]; return { ...a, ...(m ?? vazia), carregada: !!m, id: a.path, nome: a.name, busca: m ? [...m.assuntos, ...m.tags, m.trecho].join(" ") : "" }; }), [todas, metas]); // eslint-disable-line react-hooks/exhaustive-deps
  const prontas = Object.keys(metas).length >= todas.length && todas.length > 0;
  const fin = itens.filter((a) => a.situacao === "finalizado").length, and = itens.filter((a) => a.situacao === "andamento").length;

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
      chave="aulas" titulo="Aulas" unidade={["aula", "aulas"]} buscaDica="Buscar por título, assunto ou trecho…"
      subtitulo={<>{todas.length} {todas.length === 1 ? "aula" : "aulas"}{prontas && <> · {fin} finalizadas · {and} em andamento</>}</>}
      itens={itens} pasta={pasta} setPasta={setPasta} raiz={{ rel: "Acervo/Aulas", abs: raizAbs }} pastasRel={pastasRel} favoritos
      filtros={[
        { id: "ano", opcoes: ANOS.map((a) => ({ id: a, nome: `${a}º ano`, cor: corAno(a) })), de: (i) => i.anos },
        { id: "sit", opcoes: SITUACOES.map((s) => ({ id: s.id, nome: s.nome, ponto: s.ponto })), de: (i) => [i.situacao] },
      ]}
      alternadores={[{ id: "mapa", nome: "Com mindmap", Icone: Network, teste: (i) => i.mindmap }]}
      ordens={[{ id: "ano", nome: "Ano", chave: (i) => i.anos[0] ?? "9z" }, { id: "situacao", nome: "Situação", chave: (i) => String(SITUACOES.findIndex((s) => s.id === i.situacao)) }, { id: "modificado", nome: "Modificado em", chave: (i) => String(i.modified ?? 0).padStart(12, "0") }]}
      faixa={(i) => i.anos.map(corAno)}
      previa={(i) => <p className="text-[11px] leading-relaxed text-muted-foreground">{i.carregada ? (i.trecho || "Aula ainda sem texto.") : "…"}</p>}
      meta={(i) => <><Situacao id={i.situacao} /><Anos anos={i.anos} />{i.mindmap && <Network aria-label="Tem mindmap" className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />}{i.atividades && <ListChecks aria-label="Tem atividades" className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />}</>}
      colunas={[
        { id: "ano", nome: "Ano", w: "w-20", ordem: "ano", render: (i) => (i.anos.length ? <Anos anos={i.anos} /> : <span className="text-xs text-muted-foreground">—</span>) },
        { id: "sit", nome: "Situação", w: "w-32", ordem: "situacao", render: (i) => <Situacao id={i.situacao} /> },
        { id: "mod", nome: "Modificado em", w: "w-36", ordem: "modificado", render: (i) => <span className="text-xs text-muted-foreground">{quando(i.modified)}</span> },
        { id: "sec", nome: "Seções", w: "w-14", render: (i) => <span className="flex items-center gap-1.5 text-muted-foreground">{i.mindmap && <Network aria-label="Tem mindmap" className="h-3.5 w-3.5" strokeWidth={1.6} />}{i.atividades && <ListChecks aria-label="Tem atividades" className="h-3.5 w-3.5" strokeWidth={1.6} />}</span> },
      ]}
      onOpen={(i) => onOpen(i.path)} onRename={onRename} onMove={onMove} onDelete={onDelete} onNovaPasta={onNovaPasta} onImportar={importar}
      botoes={<button onClick={onCreate} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />Nova aula</button>}
      vazio={{ titulo: "Nenhuma aula ainda", acao: { rotulo: "Criar a primeira aula", onClick: onCreate }, texto: "As aulas ficam em Acervo/Aulas, com as seções Objetivos, Habilidades, Conteúdo, Mindmap e Atividades." }}
      vazioPasta="Esta pasta está vazia. Crie uma aula, uma pasta ou arraste arquivos .md para cá."
    />
  );
}
