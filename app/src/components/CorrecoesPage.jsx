import { useEffect, useState } from "react";
import { ClipboardCheck, ChartColumn } from "lucide-react";
import { Explorador } from "@/components/Explorador";
import { corTurma } from "@/lib/cores";
import { listaCorrecoes, lerCorrecao, estatisticas, num } from "@/lib/correcao";
import { Carregando } from "@/components/ui/estado";

const finalizado = (s) => /^(finalizado|arquivado)$/i.test(s ?? "");
const MESES = ["janeiro", "fevereiro", "março", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SITUACOES = [{ id: "pendente", nome: "A corrigir", ponto: "bg-warn" }, { id: "feita", nome: "Já corrigidas", ponto: "bg-ok" }];
const rotuloAcao = (x) => (x.feita ? "Ver correção" : x.feitas ? "Continuar" : "Corrigir");

const fmt = (n) => n.toFixed(1).replace(".", ",");
/** Botão da ação do lote: "Corrigir"/"Continuar" são cheios (há trabalho a fazer); "Ver correção" é só contorno (já terminou). */
function BotaoAcao({ x, onClick, className = "" }) {
  const ver = x.feita;
  return <button onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`rounded-md px-2.5 py-0.5 text-xs ${ver ? "border border-border bg-transparent text-foreground hover:bg-accent" : x.feitas ? "border border-primary bg-primary/10 font-medium text-primary hover:bg-primary/20" : "bg-primary text-primary-foreground hover:opacity-90"} ${className}`}>{rotuloAcao(x)}</button>;
}

/** Atalho para a Visão da turma do lote (botão só com ícone, ao lado da ação principal). */
function BotaoTurma({ onClick }) {
  return <button onClick={(e) => { e.stopPropagation(); onClick(); }} title="Visão da turma" aria-label="Visão da turma"
    className="inline-flex h-6 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"><ChartColumn aria-hidden className="h-3.5 w-3.5" /></button>;
}

/** Correção: os lotes (uma pasta por atividade e turma), no explorador comum; daqui abre-se a tela de correção ou o arquivo. */
export function CorrecoesPage({ items, onCorrigir, onTurma, onOpen, onRename, onDelete }) {
  const [lista, setLista] = useState(undefined);
  useEffect(() => {
    let vivo = true;
    Promise.all(listaCorrecoes(items).map((it) => lerCorrecao(it).then((d) => ({ it, d })).catch(() => null)))
      .then((r) => vivo && setLista(r.filter(Boolean).map(({ it, d }) => {
        const turma = d.turma?.replace(/"/g, "") ?? "", feitas = d.alunos.filter((a) => a.criterios.length && a.criterios.every((c) => num(c.nota) != null)).length;
        const est = estatisticas(d);
        return {
          media: est.media, maximo: est.maximo,
          id: it.path, path: it.path, pathAcao: it.path.replace(/\/[^/]+$/, ""), rel: it.rel, nome: it.pasta, pasta: "", fixo: true,
          atividade: d.atividade, turma, mes: d.mes ?? "", letivo: it.rel.split("/")[1], total: d.alunos.length, feitas, feita: finalizado(d.status), aprovada: d.transcricao === "aprovada",
          busca: `${d.atividade ?? ""} ${turma} ${d.mes ?? ""} Turma ${turma}`,
        };
      })));
    return () => { vivo = false; };
  }, [items]);
  if (lista === undefined) return <Carregando>Lendo as correções…</Carregando>;

  const turmas = [...new Set(lista.map((x) => x.turma).filter(Boolean))].sort();
  const meses = [...new Set(lista.map((x) => x.mes).filter(Boolean))].sort((a, b) => MESES.indexOf(a.toLowerCase()) - MESES.indexOf(b.toLowerCase()));
  const letivos = [...new Set(lista.map((x) => x.letivo))].sort().reverse();
  const pend = lista.filter((x) => !x.feita).length;
  const pct = (x) => (x.total ? (x.feitas / x.total) * 100 : 0);

  return (
    <Explorador
      chave="correcoes" titulo="Correção" unidade={["lote", "lotes"]} buscaDica="Buscar por atividade, turma ou mês…"
      subtitulo={<>{pend} a corrigir · {lista.length - pend} já corrigidas</>}
      itens={lista}
      filtros={[
        { id: "sit", opcoes: SITUACOES, de: (x) => [x.feita ? "feita" : "pendente"] },
        ...(turmas.length > 1 ? [{ id: "turma", opcoes: turmas.map((t) => ({ id: t, nome: `Turma ${t}`, cor: corTurma(t) })), de: (x) => [x.turma] }] : []),
        ...(meses.length > 1 ? [{ id: "mes", opcoes: meses.map((m) => ({ id: m, nome: m })), de: (x) => [x.mes] }] : []),
        ...(letivos.length > 1 ? [{ id: "letivo", opcoes: letivos.map((l) => ({ id: l, nome: l })), de: (x) => [x.letivo] }] : []),
      ]}
      alternadores={[{ id: "aprovar", nome: "Transcrição a aprovar", Icone: ClipboardCheck, teste: (x) => !x.aprovada }]}
      ordens={[
        { id: "turma", nome: "Turma", chave: (x) => x.turma }, { id: "prog", nome: "Progresso", chave: (x) => String(Math.round(pct(x))).padStart(3, "0") },
        { id: "media", nome: "Média", chave: (x) => String(Math.round((x.media ?? -1) * 10) + 10).padStart(4, "0") },
        { id: "mes", nome: "Mês", chave: (x) => String(MESES.indexOf((x.mes ?? "").toLowerCase()) + 1).padStart(2, "0") },
      ]}
      faixa={(x) => (x.turma ? [corTurma(x.turma)] : [])}
      icone={() => ClipboardCheck}
      previa={(x) => (
        <div className="flex h-full flex-col justify-center gap-2">
          <div className="font-serif text-lg font-semibold leading-snug text-foreground/80">{x.atividade || "Sem título"}</div>
          <div className="text-xs text-muted-foreground">{x.feitas} de {x.total} com nota{x.aprovada ? "" : " · transcrição a aprovar"}</div>
          <div role="img" aria-label={`${x.feitas} de ${x.total} corrigidas`} className="h-1.5 rounded-full bg-background"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct(x)}%` }} /></div>
        </div>
      )}
      meta={(x) => <>
        {x.turma && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: corTurma(x.turma) }} />Turma {x.turma}</span>}
        {x.mes && <span className="text-xs text-muted-foreground">{x.mes}</span>}
        {x.media != null && <span className="text-xs text-muted-foreground" title="Média da atividade">Média <b className="text-foreground">{fmt(x.media)}</b></span>}
        <span className="inline-flex items-center gap-1.5"><BotaoAcao x={x} onClick={() => onCorrigir(x.path)} /><BotaoTurma onClick={() => onTurma(x.path)} /></span>
      </>}
      colunas={[
        { id: "turma", nome: "Turma", w: "w-24", ordem: "turma", render: (x) => (x.turma ? <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: corTurma(x.turma) }} />{x.turma}</span> : "—") },
        { id: "mes", nome: "Mês", w: "w-24", ordem: "mes", render: (x) => <span className="text-xs text-muted-foreground">{x.mes || "—"}</span> },
        { id: "prog", nome: "Progresso", w: "w-40", ordem: "prog", render: (x) => (
          <span className="flex items-center gap-2 text-xs text-muted-foreground"><span role="img" aria-label={`${x.feitas} de ${x.total} corrigidas`} className="h-1.5 w-16 rounded-full bg-muted"><span className="block h-1.5 rounded-full bg-primary" style={{ width: `${pct(x)}%` }} /></span>{x.feitas}/{x.total}</span>) },
        { id: "media", nome: "Média", w: "w-24", ordem: "media", render: (x) => <span className="text-xs text-muted-foreground" title="Média da atividade">{x.media != null ? <><b className="font-medium text-foreground">{fmt(x.media)}</b>{x.maximo ? ` / ${fmt(x.maximo).replace(",0", "")}` : ""}</> : "—"}</span> },
        { id: "acao", nome: "", w: "w-40", render: (x) => <span className="flex items-center gap-1.5"><BotaoAcao x={x} onClick={() => onCorrigir(x.path)} className="py-1" /><BotaoTurma onClick={() => onTurma(x.path)} /></span> },
      ]}
      menuExtra={(x) => [{ nome: rotuloAcao(x), Icone: ClipboardCheck, fazer: () => onCorrigir(x.path) }, { nome: "Visão da turma", Icone: ChartColumn, fazer: () => onTurma(x.path) }, { nome: "Abrir arquivo", Icone: ClipboardCheck, fazer: () => onOpen(x.path) }]}
      onOpen={(x) => onCorrigir(x.path)} onRename={onRename} onDelete={onDelete}
      vazio={{ titulo: "Nenhuma correção ainda", texto: "Os lotes ficam em Anos/AAAA/Correcoes, com a seção “Transcrições e devolutivas”." }}
    />
  );
}
