import { useEffect, useState } from "react";
import { IconChevronLeft as ChevronLeft, IconChevronRight as ChevronRight, IconPlus as Plus, IconX as X, IconArrowBarToUp as ArrowUpToLine } from "@tabler/icons-react";
import { FASES, lerCiclos } from "@/lib/ciclos";
import { SITUACOES, situacaoAula, lerSemana, lerSemanas, semanaNova, importarLegado, cicloDaTurma, proximasDoCiclo, criarSemana, proximaSegunda, segundaDe, rotuloDe, nomeSemana, removerAulaSemana, adicionarAvulsa, promoverAvulsa, adicionarDoCiclo } from "@/lib/semana";
import { corTurma } from "@/lib/cores";
import { lerTurmas, gravarTurmas, turmasDeTexto } from "@/lib/turmas";
import { invoke } from "@/lib/api";
import { Estado, Carregando } from "@/components/ui/estado";

const fase = Object.fromEntries(FASES.map((f) => [f.id, f]));
import { SituacaoAula } from "@/components/ui/SituacaoAula";
import { Inline } from "@/components/ui/Inline";
const limpa = (t) => t.replace(/\*\*/g, "");
const nomes = (r) => [...r.matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim());

/** Semana: por turma, N espaços (4 por padrão). Cada espaço recebe uma aula do ciclo (com sugestões) ou um texto livre. */
// Última leitura: ao voltar para a tela ela aparece na hora (sem "Lendo…") e é atualizada por baixo.
let ultima = null;
export function SemanaPage({ items, onOpen, onRefresh, focoPath }) {
  const [dados, setDados] = useState(focoPath ? undefined : ultima?.dados); // { semanas, legado, ciclos, ano, cfg }
  const [idx, setIdx] = useState(focoPath ? -1 : ultima?.idx ?? -1);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState(""); // "" = todas as turmas
  // O ano da Semana é o do calendário (independe da tela Ano): na virada passa sozinho a usar as turmas do ano novo.
  const carregar = (irParaUltima) => lerCiclos(items, String(new Date().getFullYear())).then(async (c) => {
    const ano = c.anoLetivo;
    const [semanas, legado, cfg] = await Promise.all([lerSemanas(items), lerSemana(items).catch(() => null), lerTurmas(items, ano)]);
    setDados({ semanas, legado, ciclos: c.ciclos, ano, cfg });
    setIdx((i) => { const f = focoPath ? semanas.findIndex((x) => x.path === focoPath) : -1; return f >= 0 ? f : irParaUltima || i < 0 || i >= semanas.length ? semanas.length - 1 : i; });
  }).catch((e) => setErro(String(e)));
  useEffect(() => { carregar(false); }, [items, focoPath]);
  useEffect(() => { if (dados && !focoPath) ultima = { dados, idx }; }, [dados, idx, focoPath]);
  const existe = (n) => items.find((i) => i.name.toLowerCase() === n.toLowerCase());
  const falha = (e) => setErro(String(e?.message ?? e));

  if (erro) return <Estado tipo="err" className="p-8 text-sm">Erro: {erro} <button className="ml-2 underline" onClick={() => { setErro(""); carregar(false); }}>tentar de novo</button></Estado>;
  if (dados === undefined) return <Carregando>Lendo a semana…</Carregando>;

  const { semanas, legado, ciclos, ano, cfg } = dados;
  // Turmas: as do arquivo do ano; sem ele, as que já aparecem nas semanas.
  const turmasSemana = [...new Set(semanas.flatMap((s) => s.turmas.map((t) => t.turma)))].sort();
  const turmas = cfg.turmas.length ? cfg.turmas : turmasSemana;
  const mexer = (fn) => fn().then(() => carregar(false)).catch(falha);

  const nova = async (seg = proximaSegunda(semanas)) => {
    try {
      await criarSemana(items, { ano: String(seg.getFullYear()), seg, rotulo: rotuloDe(seg), turmas: semanaNova({ semanas, turmas }) });
      setIdx(-1); await onRefresh(); // items muda e a tela recarrega na última semana
    } catch (e) { falha(e); }
  };

  if (!turmas.length) return <DefinirTurmas ano={ano} onOk={(lista) => mexer(async () => { await gravarTurmas(items, ano, { turmas: lista, aulas: cfg.aulas }); await onRefresh(); })} />;
  if (!semanas.length) return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <h1 className="font-serif text-3xl font-semibold">Esta semana</h1>
      <p className="mt-2 max-w-xl text-xs text-muted-foreground">Ainda não há nenhuma semana em Anos/{ano}/Semanas. Turmas: {turmas.join(", ")}.</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={() => nova(segundaDe())} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />Criar a semana de {rotuloDe(segundaDe())}</button>
        {legado && <button onClick={() => importarLegado(items, legado, ano).then(() => onRefresh()).catch(falha)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent">Importar do Planejamento antigo</button>}
      </div>
      {legado && <p className="mt-3 max-w-xl text-xs text-muted-foreground">Importar cria uma nota de histórico com o ciclo de cada turma e as aulas já marcadas ✓ em Planejamento.md; depois disso o Planejamento.md não é mais lido.</p>}
    </div>
  );

  const s = semanas[Math.max(0, idx)];
  const ehUltima = semanas.indexOf(s) === semanas.length - 1;
  const situar = (turma, n, sit) => mexer(async () => { const t = await invoke("read_note", { path: s.path }); await invoke("save_note", { path: s.path, text: situacaoAula(t, turma, n, sit) }); });
  const cicloDe = (turma) => { const nome = cicloDaTurma(semanas, turma); return nome ? ciclos.find((c) => c.name.toLowerCase() === nome.toLowerCase()) : null; };
  const colunas = [...turmas, ...s.turmas.map((t) => t.turma).filter((t) => !turmas.includes(t))].map((turma) => s.turmas.find((t) => t.turma === turma) ?? { turma, aulas: [] });
  const todas = colunas.flatMap((t) => t.aulas), dadas = todas.filter((a) => a.dada).length, porDar = todas.filter((a) => !a.situacao).length, adiadas = todas.filter((a) => a.situacao === "pulada").length;
  const segAtual = segundaDe();
  // A semana mostrada nem sempre é a de hoje (aos sábados a "atual" já é a que vem): dizer qual é.
  const dSemana = /(\d{4})-(\d{2})-(\d{2})/.exec(s.name), hoje0 = new Date(new Date().setHours(0, 0, 0, 0));
  const dias = dSemana ? Math.round((new Date(+dSemana[1], +dSemana[2] - 1, +dSemana[3]) - hoje0) / 864e5) : null;
  const rotuloTempo = dias == null ? "" : dias > 7 ? "Semana futura" : dias > 0 ? "Próxima semana" : dias >= -6 ? "Esta semana" : "Semana passada";
  const faltaAtual = ehUltima && !focoPath && !items.some((i) => i.name === nomeSemana(segAtual)) && proximaSegunda(semanas).getTime() === segAtual.getTime();

  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <div className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-2">
        <header>
          <div className="text-xs text-muted-foreground">{rotuloTempo}</div>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="font-serif text-3xl font-semibold leading-tight">Semana de {s.rotulo || s.name}</h1>
            <div className="flex items-center">
              <button disabled={idx <= 0} onClick={() => setIdx(idx - 1)} className="rounded p-1 hover:bg-accent disabled:opacity-30" aria-label="Semana anterior"><ChevronLeft className="h-5 w-5" /></button>
              <button disabled={ehUltima} onClick={() => setIdx(idx + 1)} className="rounded p-1 hover:bg-accent disabled:opacity-30" aria-label="Próxima semana"><ChevronRight className="h-5 w-5" /></button>
            </div>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{dadas} {dadas === 1 ? "aula dada" : "aulas dadas"} · {porDar} por dar{adiadas > 0 && ` · ${adiadas} ${adiadas === 1 ? "adiada" : "adiadas"}`}</p>
        </header>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
        <button onClick={() => onOpen(s.path)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent">Abrir nota</button>
        {ehUltima && !faltaAtual && <button onClick={() => nova()} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />Semana seguinte</button>}
        </div>
      </div>
      {faltaAtual && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-xs">
          <span className="flex-1">A semana de <b>{rotuloDe(segAtual)}</b> ainda não existe. Ela nasce com as aulas não dadas da semana anterior e espaços vazios para o resto.</span>
          <button onClick={() => nova(segAtual)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" />Criar esta semana</button>
        </div>
      )}

      {colunas.length > 1 && (
        <div role="group" aria-label="Filtrar por turma" className="mt-4 flex flex-wrap items-center gap-1.5">
          {[{ turma: "", nome: "Todas" }, ...colunas.map((c) => ({ turma: c.turma, nome: `Turma ${c.turma}` }))].map((o) => (
            <button key={o.turma} type="button" aria-pressed={filtro === o.turma} onClick={() => setFiltro(o.turma)}
              className={"inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm " + (filtro === o.turma ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              {o.turma && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: corTurma(o.turma) }} />}{o.nome}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4 pb-2">
        {colunas.filter((t) => !filtro || t.turma === filtro).map((t) => {
          const ciclo0 = t.cicloNome ?? cicloDaTurma(semanas, t.turma);
          const vazios = Math.max(0, cfg.aulas - t.aulas.length);
          const sugestoes = proximasDoCiclo({ ciclos, semanas, turma: t.turma, nomeCiclo: ciclo0, qtd: vazios });
          return (
          <div key={t.turma} className="w-full rounded-xl border bg-background p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2"><span className="flex items-center gap-2 font-serif text-xl font-semibold"><span aria-hidden className="h-3 w-3 rounded-full" style={{ background: corTurma(t.turma) }} />Turma {t.turma}</span>
              <span className="flex items-center gap-1.5">
                {vazios > 0 && sugestoes.length > 0 && <button title={`Preencher os espaços vazios com as próximas aulas de ${ciclo0}`} onClick={() => mexer(async () => { for (const a of sugestoes) await adicionarDoCiclo(s.path, t.turma, a); })} className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent">Preencher</button>}
              </span></div>
            <div className="flex flex-col divide-y">
              {t.aulas.map((a) => (
                <div key={a.n} className={"flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5 " + (a.situacao === "dada" ? "opacity-70" : a.situacao === "pulada" ? "opacity-75" : a.situacao === "descartada" ? "opacity-60" : "")}>
                  <div className="min-w-[16rem] flex-1">
                    <span className="block truncate text-xs text-muted-foreground" title={a.cicloNome ? undefined : "aula escrita por você"}>{a.cicloNome ? `${a.cicloNome.replace(/^\d{3}\s*-\s*/, "").replace(/\s*-\s*(PR|PT|TG)$/, "")} · aula ${a.cicloN ?? "?"}` : "aula escrita por você"}</span>
                    <div className={"text-sm font-medium leading-snug " + (a.situacao === "descartada" ? "line-through" : "")}>{a.cicloNome && <><span style={{ color: fase[a.fase].cor }}>{fase[a.fase].nome}</span> · </>}<Inline texto={a.texto} /></div>
                    {a.recurso && <div className="mt-0.5 text-xs">{nomes(a.recurso).length ? nomes(a.recurso).map((n) => existe(n)
                      ? <button key={n} onClick={() => onOpen(existe(n).path)} className="mr-2 text-primary hover:underline">{n}</button>
                      : <span key={n} className="mr-2 text-warn">{n} (a criar)</span>) : <span className="text-muted-foreground">{a.recurso}</span>}</div>}
                  </div>
                  <SituacaoAula compacto situacao={a.situacao} onChange={(sit) => situar(t.turma, a.n, sit)} />
                  <span className="flex w-10 shrink-0 items-center justify-end gap-1.5 text-muted-foreground">
                    {!a.cicloNome && cicloDe(t.turma) && <button title={`Promover a aula do ciclo ${cicloDe(t.turma).name}`} onClick={() => mexer(() => promoverAvulsa(s.path, t.turma, a.n, cicloDe(t.turma)))} className="hover:text-foreground"><ArrowUpToLine className="h-4 w-4" /></button>}
                    {!a.dada && <button title="Esvaziar este espaço" onClick={() => mexer(() => removerAulaSemana(s.path, t.turma, a.n))} className="hover:text-err"><X className="h-4 w-4" /></button>}
                  </span>
                </div>
              ))}
              {Array.from({ length: vazios }, (_, k) => (
                <Espaco key={k} n={t.aulas.length + k + 1} turma={t.turma} ciclos={ciclos} semanas={semanas} cicloInicial={ciclo0}
                  onCiclo={(a) => mexer(() => adicionarDoCiclo(s.path, t.turma, a))} onTexto={(texto) => mexer(() => adicionarAvulsa(s.path, t.turma, texto))} />
              ))}
            </div>
          </div>
        ); })}
      </div>
    </div>
  );
}

/** Primeira vez: pede as turmas do ano e grava `Anos/AAAA/Turmas AAAA.md`. */
function DefinirTurmas({ ano, onOk }) {
  const [txt, setTxt] = useState("");
  const lista = turmasDeTexto(txt);
  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <h1 className="font-serif text-3xl font-semibold">Quais são as suas turmas em {ano}?</h1>
      <p className="mt-2 max-w-xl text-xs text-muted-foreground">Cada turma ganha 4 espaços de aula por semana. Você pode mudar isso depois em Configurações → Turmas do ano.</p>
      <div className="mt-4 flex items-center gap-2">
        <input autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lista.length && onOk(lista)} placeholder="ex.: 61, 62, 71, 81" className="w-72 rounded-md border bg-background px-3 py-1.5 text-sm" />
        <button disabled={!lista.length} onClick={() => onOk(lista)} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-40">Salvar</button>
      </div>
    </div>
  );
}

/** Pacote da aula: o que ela é, os recursos, o contexto do ciclo (aulas vizinhas, conteúdos, habilidades) e as aulas já dadas da turma. */

/** Espaço vazio da semana: um clique abre as sugestões do ciclo (e um campo para escrever qualquer coisa). */
function Espaco({ n, turma, ciclos, semanas, cicloInicial, onCiclo, onTexto }) {
  const [aberto, setAberto] = useState(false), [texto, setTexto] = useState(""), [ciclo, setCiclo] = useState(cicloInicial ?? "");
  if (!aberto) return <button onClick={() => setAberto(true)} className="flex min-h-11 w-full items-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" />Aula {n} — adicionar</button>;
  const sugestoes = proximasDoCiclo({ ciclos, semanas, turma, nomeCiclo: ciclo, qtd: 5 });
  const fechar = () => { setAberto(false); setTexto(""); };
  const escrever = () => { if (texto.trim()) { onTexto(texto.trim()); fechar(); } };
  return (
    <div className="my-2 flex flex-col gap-2 rounded-lg border border-primary/40 p-3 text-xs">
      <div className="flex items-center gap-2"><span className="text-muted-foreground">Sugestões de</span>
        <select value={ciclo} onChange={(e) => setCiclo(e.target.value)} aria-label="Ciclo das sugestões" className="min-w-0 flex-1 rounded border bg-background px-1 py-1">
          <option value="">(escolha um ciclo)</option>{(ciclos.some((c) => String(c.ano) === turma[0]) ? ciclos.filter((c) => String(c.ano) === turma[0] || c.ano == null || c.name === ciclo) : ciclos).map((c) => <option key={c.path} value={c.name}>{c.name}</option>)}</select></div>
      {sugestoes.map((a) => (
        <button key={a.cicloN} onClick={() => { onCiclo(a); fechar(); }} className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left hover:bg-accent">
          <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span><span className="text-muted-foreground">aula {a.cicloN} · </span>{limpa(a.texto)}</span>
        </button>
      ))}
      {ciclo && !sugestoes.length && <div className="text-muted-foreground">Todas as aulas deste ciclo já estão em alguma semana.</div>}
      <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") escrever(); if (e.key === "Escape") fechar(); }} placeholder="Ou escreva o que será a aula (Enter)" className="rounded border bg-background px-2 py-1.5 outline-none" />
      <div className="flex gap-3"><button onClick={escrever} disabled={!texto.trim()} className="text-primary hover:underline disabled:opacity-40">Adicionar texto</button><button onClick={fechar} className="text-muted-foreground hover:underline">Cancelar</button></div>
    </div>
  );
}
