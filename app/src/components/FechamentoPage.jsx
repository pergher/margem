import { useEffect, useState } from "react";
import { anosLetivos, lerCiclos } from "@/lib/ciclos";
import { lerSemanas } from "@/lib/semana";
import { TRIMESTRES, acrescentarItem, alternarItem, gravarFechamento, pendenciasDoFechamento, removerItem, triSugerido } from "@/lib/fechamento";
import { abreviar, CATEGORIAS } from "@/lib/diario";
import { corTurma } from "@/lib/cores";
import { store } from "@/lib/store";
import { Carregando, Erro, Estado, useToast } from "@/components/ui/estado";
import { cn } from "@/lib/utils";
import { useEhCompacto } from "@/lib/useCompacto";

const Cartao = ({ titulo, vazio, nada, children }) => (
  <section className="rounded-xl border p-4">
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h2>
    {nada ? <Estado tipo="ok" className="text-sm text-muted-foreground">{vazio}</Estado> : children}
  </section>
);
const Linha = ({ onClick, children, direita }) => onClick === null ? (
  <div className="flex w-full items-center gap-3 border-b px-1 py-2 text-sm last:border-b-0">
    <span className="min-w-0 flex-1">{children}</span>{direita && <span className="shrink-0 text-xs text-muted-foreground">{direita}</span>}
  </div>
) : (
  <button onClick={onClick} className="flex w-full items-center gap-3 border-b px-1 py-2 text-left text-sm last:border-b-0 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
    <span className="min-w-0 flex-1">{children}</span>{direita && <span className="shrink-0 text-xs text-muted-foreground">{direita}</span>}
  </button>
);
const Turma = ({ t }) => t ? <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: corTurma(t) }} />{t}</span> : null;

/** Fechamento do trimestre: o que ainda está em aberto (automático) e uma lista própria. Só informa, nunca cobra. */
export function FechamentoPage({ items, turmaGlobal = "", onOpen, onCorrigir, onDiario, onRefresh }) {
  const toast = useToast();
  const compacto = useEhCompacto(); // celular: só leitura
  const ano = String(anosLetivos(items).pop() ?? new Date().getFullYear());
  const [tri, setTri] = useState(() => store.get("fechamentoTri", 0));
  const [dados, setDados] = useState(null), [erro, setErro] = useState(""), [recarga, setRecarga] = useState(0);
  const [novo, setNovo] = useState("");
  useEffect(() => {
    let vivo = true;
    (async () => {
      let t = tri;
      if (!t) { const { ciclos } = await lerCiclos(items); t = triSugerido(ciclos, await lerSemanas(items).catch(() => [])); }
      const d = await pendenciasDoFechamento(items, t, { turma: turmaGlobal, ano });
      if (vivo) { setDados({ ...d, tri: t }); setErro(""); }
    })().catch((e) => vivo && setErro(String(e?.message ?? e)));
    return () => { vivo = false; };
  }, [items, tri, turmaGlobal, ano, recarga]);

  const escolher = (t) => { setTri(t); store.set("fechamentoTri", t); };
  const mudar = async (fn) => { try { await gravarFechamento(items, ano, fn); setRecarga((n) => n + 1); onRefresh?.(); } catch (e) { toast(`Não deu para atualizar: ${e.message ?? e}`, { tipo: "err" }); } };
  const adicionar = async () => { const t = novo.trim(); if (!t) return; await mudar((x) => acrescentarItem(x, dados.tri, t)); setNovo(""); };

  if (erro) return <Erro>Erro: {erro}</Erro>;
  if (!dados) return <Carregando>Juntando o que está em aberto…</Carregando>;
  const nome = (id) => CATEGORIAS.find((c) => c.id === id)?.nome ?? id;
  const { correcoes, ciclos, diarios, reunioes, alertas, manuais, total } = dados;
  const diarioN = diarios.pendente + diarios.revisao;

  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className={cn("mx-auto flex max-w-4xl flex-col gap-4", compacto ? "px-4 py-4" : "px-8 py-8")}>
      <header className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-semibold leading-tight md:text-3xl">Fechamento do {dados.tri}º trimestre</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total === 0 ? "Tudo em dia." : `${total} ${total === 1 ? "coisa em aberto" : "coisas em aberto"}${turmaGlobal ? ` na turma ${turmaGlobal}` : ""}.`}</p>
        </div>
        <div role="group" aria-label="Trimestre" className="flex gap-1.5">
          {TRIMESTRES.map((t) => (
            <button key={t} aria-pressed={dados.tri === t} onClick={() => escolher(t)}
              className={cn("rounded-full border px-3.5 py-1 text-sm", compacto && "min-h-11 min-w-11", dados.tri === t ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{t}º</button>
          ))}
        </div>
      </header>

      <Cartao titulo="Produções a corrigir" vazio="Nenhum lote em aberto." nada={correcoes.length === 0}>
        {correcoes.length > 0 && correcoes.map((c) => (
          <Linha key={c.path} onClick={compacto ? null : () => onCorrigir?.(c.path)} direita={`${c.feitas} de ${c.total} corrigidas`}>{c.nome}<Turma t={c.turma} /></Linha>))}
      </Cartao>

      <Cartao titulo={`Ciclos do ${dados.tri}º trimestre`} vazio="Nenhum ciclo com aulas por dar." nada={ciclos.length === 0}>
        {ciclos.length > 0 && ciclos.map((c) => (
          <Linha key={c.path} onClick={() => onOpen?.(c.path)} direita={c.prog.filter((p) => p.dadas < p.total).map((p) => `${p.turma}: ${p.dadas}/${p.total}`).join(" · ")}>{c.nome}</Linha>))}
      </Cartao>

      <Cartao titulo="Diário e alunos" vazio="Nada em aberto no diário." nada={diarioN === 0 && reunioes.length === 0 && alertas.length === 0}>
        {(diarioN > 0 || reunioes.length > 0 || alertas.length > 0) && <>
          {diarioN > 0 && <Linha onClick={() => onDiario?.()} direita={`${diarios.pendente} por transcrever · ${diarios.revisao} por revisar`}>Diários de classe</Linha>}
          {reunioes.map((r) => <Linha key={`${r.path}#${r.linha}`} onClick={() => onOpen?.(r.path)} direita={r.estado === "agendada" ? "agendada" : "solicitada"}>Reunião com responsáveis de {abreviar(r.aluno)}<Turma t={r.turma} /></Linha>)}
          {alertas.map((a) => <Linha key={`${a.turma}|${a.aluno}`} onClick={() => (a.path ? onOpen?.(a.path) : onDiario?.())} direita={a.sinais.map((x) => nome(x.cat)).join(" · ")}>{abreviar(a.aluno)} em alerta<Turma t={a.turma} /></Linha>)}
        </>}
      </Cartao>

      <section className="rounded-xl border p-4" aria-label={`Meus itens do ${dados.tri}º trimestre`}>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meus itens</h2>
        {manuais.length > 0 && <ul className="mb-2 flex flex-col">
          {manuais.map((m) => (
            <li key={m.linha} className="group flex items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent">
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                <input type="checkbox" disabled={compacto} checked={m.feito} onChange={() => mudar((x) => alternarItem(x, m.linha, m.texto))} className="mt-1" />
                <span className={cn("min-w-0 flex-1 break-words", m.feito && "text-muted-foreground line-through")}>{m.texto}</span>
              </label>
              <button aria-label={`Apagar “${m.texto}”`} onClick={() => mudar((x) => removerItem(x, m.linha, m.texto))} className="invisible shrink-0 text-xs text-muted-foreground hover:text-foreground group-hover:visible focus-visible:visible">apagar</button>
            </li>))}
        </ul>}
        {!compacto && <input value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
          placeholder="+ Acrescentar (ex.: lançar notas na SED)" aria-label="Novo item" className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-primary" />}
      </section>
    </div></div>
  );
}
