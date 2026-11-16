import { raizBarra } from "@/lib/raiz";
import { useEffect, useMemo, useState } from "react";
import { IconPlus as Plus } from "@tabler/icons-react";
import { Explorador, cmp } from "@/components/Explorador";
import { quando } from "@/components/AulasPage";
import { FASES, lerCiclos } from "@/lib/ciclos";

const RAIZ = "Acervo/Ciclos";
const cor = Object.fromEntries(FASES.map((f) => [f.id, f.cor]));
const noAno = (c) => (c?.incluido ? `${c.ano}º ano · ${c.tri}º tri` : "Fora de um ano");

function Barra({ aulas }) {
  if (!aulas?.length) return <div className="h-[5px] rounded bg-border" />;
  return <div className="flex h-[5px] gap-0.5">{aulas.map((a) => <span key={a.n} style={{ flex: 1, background: cor[a.fase] }} />)}</div>;
}

/** Ciclos: os arquivos de Acervo/Ciclos (atemporais), no explorador comum; mostra onde cada um está no Planejamento do ano. */
export function CiclosPage({ items, dirs, onCiclo, onCreate, pasta, setPasta, onRename, onMove, onDelete, onNovaPasta }) {
  const [lidos, setLidos] = useState({}); // path -> ciclo lido (aulas, habilidades, ano/trimestre)
  useEffect(() => {
    let vivo = true;
    lerCiclos(items).then((d) => { if (vivo) setLidos(Object.fromEntries(d.ciclos.map((c) => [c.path, c]))); }).catch(() => {});
    return () => { vivo = false; };
  }, [items]);
  const raizAbs = raizBarra(items) ? raizBarra(items) + RAIZ : "";
  const todos = useMemo(() => items.filter((i) => i.rel.startsWith(RAIZ + "/") && i.rel.endsWith(".md")).map((i) => ({ ...i, pasta: i.rel.split("/").slice(2, -1).join("/") })), [items]);
  const pastasRel = useMemo(() => {
    const set = new Set();
    for (const d of dirs ?? []) if (d.startsWith(RAIZ + "/") && d.length > RAIZ.length + 1) set.add(d.slice(RAIZ.length + 1).replace(/\/$/, ""));
    for (const a of todos) { const seg = a.pasta ? a.pasta.split("/") : []; seg.forEach((_, k) => set.add(seg.slice(0, k + 1).join("/"))); }
    return [...set].sort(cmp);
  }, [dirs, todos]);
  const lista = useMemo(() => todos.map((a) => {
    const c = lidos[a.path];
    return { ...a, ciclo: c, carregado: !!c, id: a.path, nome: a.name, aulas: c?.aulas ?? [], habilidades: c?.habilidades ?? [], estado: noAno(c), ordemAno: c?.incluido ? c.ano * 10 + c.tri : 99, busca: c ? [...c.habilidades, ...c.conteudos].join(" ") : "" };
  }), [todos, lidos]);
  const prontos = todos.length > 0 && todos.every((a) => lidos[a.path]);
  const incluidos = lista.filter((c) => c.ciclo?.incluido).length;

  return (
    <Explorador
      chave="ciclos" titulo="Ciclos" unidade={["ciclo", "ciclos"]} buscaDica="Buscar por título, habilidade ou conteúdo…"
      subtitulo={<>{todos.length} {todos.length === 1 ? "ciclo" : "ciclos"}{prontos && <> · {incluidos} em algum ano · {todos.length - incluidos} fora de um ano</>}</>}
      itens={lista} pasta={pasta} setPasta={setPasta} raiz={{ rel: RAIZ, abs: raizAbs }} pastasRel={pastasRel} favoritos
      filtros={[
        { id: "ano", opcoes: [6, 7, 8, 9].map((a) => ({ id: String(a), nome: `${a}º ano` })), de: (i) => (i.ciclo?.incluido ? [String(i.ciclo.ano)] : []) },
        { id: "uso", opcoes: [{ id: "dentro", nome: "Em um ano" }, { id: "fora", nome: "Fora de um ano" }], de: (i) => (i.carregado ? [i.ciclo.incluido ? "dentro" : "fora"] : []) },
      ]}
      ordens={[{ id: "ano", nome: "Ano e trimestre", chave: (i) => String(i.ordemAno).padStart(3, "0") }, { id: "modificado", nome: "Modificado em", chave: (i) => String(i.modified ?? 0).padStart(12, "0") }]}
      previa={(i) => <><div className="mb-1.5"><Barra aulas={i.aulas} /></div><p className="text-[11px] leading-relaxed text-muted-foreground">{i.carregado ? `${i.aulas.length ? `${i.aulas.length} aulas` : "Sem tabela de aulas"}${i.habilidades.length ? ` · ${i.habilidades.join(", ")}` : " · sem habilidade"}` : "…"}</p></>}
      meta={(i) => <span className="text-xs text-muted-foreground">{i.carregado ? i.estado : "…"}</span>}
      colunas={[
        { id: "uso", nome: "No ano", w: "w-36", ordem: "ano", render: (i) => <span className="text-xs text-muted-foreground">{i.carregado ? i.estado : "…"}</span> },
        { id: "aulas", nome: "Aulas", w: "w-32", render: (i) => (i.carregado ? <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-16"><Barra aulas={i.aulas} /></span>{i.aulas.length}</span> : <span className="text-xs text-muted-foreground">…</span>) },
        { id: "hab", nome: "Habilidades", w: "w-40", render: (i) => <span className="truncate text-xs text-muted-foreground" title={i.habilidades.join(", ")}>{i.carregado ? (i.habilidades.join(", ") || "—") : "…"}</span> },
        { id: "mod", nome: "Modificado em", w: "w-36", ordem: "modificado", render: (i) => <span className="text-xs text-muted-foreground">{quando(i.modified)}</span> },
      ]}
      onOpen={(i) => onCiclo(i.ciclo ?? { path: i.path })} onRename={onRename} onMove={onMove} onDelete={onDelete} onNovaPasta={onNovaPasta}
      botoes={<button onClick={onCreate} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />Novo ciclo</button>}
      vazio={{ titulo: "Nenhum ciclo ainda", acao: { rotulo: "Criar o primeiro ciclo", onClick: onCreate }, texto: "Os ciclos ficam em Acervo/Ciclos: cada um com 16 aulas, Conteúdos e Habilidades. O Ano escolhe quais usar." }}
      vazioPasta="Esta pasta está vazia. Crie um ciclo ou uma pasta."
    />
  );
}
