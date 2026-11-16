import { raizBarra } from "@/lib/raiz";
import { useEffect, useMemo, useState } from "react";
import { IconPlus as Plus } from "@tabler/icons-react";
import { Explorador, cmp } from "@/components/Explorador";
import { SITUACOES, ANOS, Situacao, quando } from "@/components/AulasPage";
import { invoke } from "@/lib/api";
import { parseGramatica } from "@/lib/gramatica";
import { corAno } from "@/lib/cores";
import { Anos } from "@/components/ui/Anos";

const RAIZ = "Acervo/Gramática";
const metaDe = (texto) => {
  const g = parseGramatica(texto), regra = g.secoes.find((s) => s.tipo === "regra")?.md ?? "";
  return { anos: g.anos, situacao: g.status || "pendente", assuntos: g.assuntos.split(",").map((x) => x.trim()).filter(Boolean), exemplos: (texto.match(/^```exemplo/gm) ?? []).length, avisos: g.avisos.length + g.faltam.length, trecho: regra.replace(/[*_`>#\-]/g, "").replace(/\s+/g, " ").trim().slice(0, 260) };
};

/** Gramática: os arquivos de Acervo/Gramática (referência por tópico), no explorador comum. */
export function GramaticasPage({ items, dirs, onOpen, onCreate, pasta, setPasta, onRefresh, onRename, onMove, onDelete, onNovaPasta }) {
  const [metas, setMetas] = useState({});
  const raizAbs = raizBarra(items) ? raizBarra(items) + RAIZ : "";
  const todas = useMemo(() => items.filter((i) => i.rel.startsWith(RAIZ + "/") && i.rel.endsWith(".md")).map((i) => ({ ...i, pasta: i.rel.split("/").slice(2, -1).join("/") })), [items]);
  const pastasRel = useMemo(() => {
    const set = new Set();
    for (const d of dirs ?? []) if (d.startsWith(RAIZ + "/") && d.length > RAIZ.length + 1) set.add(d.slice(RAIZ.length + 1).replace(/\/$/, ""));
    for (const a of todas) { const seg = a.pasta ? a.pasta.split("/") : []; seg.forEach((_, k) => set.add(seg.slice(0, k + 1).join("/"))); }
    return [...set].sort(cmp);
  }, [dirs, todas]);
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
  }, [todas]);

  const vazia = { anos: [], situacao: "pendente", assuntos: [], exemplos: 0, avisos: 0, trecho: "" };
  const lista = useMemo(() => todas.map((a) => { const m = metas[a.path]; return { ...a, ...(m ?? vazia), carregada: !!m, id: a.path, nome: a.name, busca: m ? [...m.assuntos, m.trecho].join(" ") : "" }; }), [todas, metas]);
  const fin = lista.filter((a) => a.situacao === "finalizado").length;

  return (
    <Explorador
      chave="gramatica" titulo="Gramática" unidade={["tópico", "tópicos"]} buscaDica="Buscar por tópico, assunto ou trecho da regra…"
      subtitulo={<>{todas.length} {todas.length === 1 ? "tópico" : "tópicos"}{Object.keys(metas).length >= todas.length && todas.length > 0 && <> · {fin} finalizados</>}</>}
      itens={lista} pasta={pasta} setPasta={setPasta} raiz={{ rel: RAIZ, abs: raizAbs }} pastasRel={pastasRel} favoritos
      filtros={[
        { id: "ano", opcoes: ANOS.map((a) => ({ id: a, nome: `${a}º ano`, cor: corAno(a) })), de: (i) => i.anos },
        { id: "sit", opcoes: SITUACOES.map((s) => ({ id: s.id, nome: s.nome, ponto: s.ponto })), de: (i) => [i.situacao] },
      ]}
      ordens={[{ id: "ano", nome: "Ano", chave: (i) => i.anos[0] ?? "9z" }, { id: "situacao", nome: "Situação", chave: (i) => String(SITUACOES.findIndex((s) => s.id === i.situacao)) }, { id: "modificado", nome: "Modificado em", chave: (i) => String(i.modified ?? 0).padStart(12, "0") }]}
      faixa={(i) => i.anos.map(corAno)}
      previa={(i) => <p className="text-[11px] leading-relaxed text-muted-foreground">{i.carregada ? (i.trecho || "Sem regra ainda.") : "…"}</p>}
      meta={(i) => <><Situacao id={i.situacao} /><Anos anos={i.anos} /></>}
      colunas={[
        { id: "ano", nome: "Ano", w: "w-24", ordem: "ano", render: (i) => (i.anos.length ? <Anos anos={i.anos} /> : <span className="text-xs text-muted-foreground">—</span>) },
        { id: "sit", nome: "Situação", w: "w-32", ordem: "situacao", render: (i) => <Situacao id={i.situacao} /> },
        { id: "ex", nome: "Exemplos", w: "w-20", render: (i) => <span className="text-xs text-muted-foreground">{i.carregada ? i.exemplos : "…"}</span> },
        { id: "mod", nome: "Modificado em", w: "w-36", ordem: "modificado", render: (i) => <span className="text-xs text-muted-foreground">{quando(i.modified)}</span> },
      ]}
      onOpen={(i) => onOpen(i.path)} onRename={onRename} onMove={onMove} onDelete={onDelete} onNovaPasta={onNovaPasta}
      botoes={<button onClick={onCreate} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />Nova gramática</button>}
      vazio={{ titulo: "Nenhuma gramática ainda", acao: { rotulo: "Criar a primeira gramática", onClick: onCreate }, texto: "As gramáticas ficam em Acervo/Gramática, um arquivo por tópico, com as seções Regra, Exemplos, Exceções e dúvidas, Como testar e Veja também." }}
      vazioPasta="Esta pasta está vazia. Crie uma gramática ou uma pasta."
    />
  );
}
