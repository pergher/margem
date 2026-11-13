import { Fragment, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, ArrowUpToLine } from "lucide-react";
import { FASES, lerCiclos } from "@/lib/ciclos";
import { SITUACOES, situacaoAula, lerSemana, lerSemanas, semanaNova, importarLegado, cicloDaTurma, proximasDoCiclo, criarSemana, proximaSegunda, segundaDe, rotuloDe, nomeSemana, removerAulaSemana, adicionarAvulsa, promoverAvulsa, adicionarDoCiclo } from "@/lib/semana";
import { lerTurmas, gravarTurmas, turmasDeTexto } from "@/lib/turmas";
import { invoke } from "@/lib/api";
import { Estado, Carregando } from "@/components/ui/estado";

const fase = Object.fromEntries(FASES.map((f) => [f.id, f]));
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { Inline } from "@/components/ui/Inline";
const limpa = (t) => t.replace(/\*\*/g, "");
const nomes = (r) => [...r.matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim());

/** Semana: por turma, N espaços (4 por padrão). Cada espaço recebe uma aula do ciclo (com sugestões) ou um texto livre. */
export function SemanaPage({ items, onOpen, onRefresh, focoPath }) {
  const [dados, setDados] = useState(undefined); // { semanas, legado, ciclos, ano, cfg }
  const [idx, setIdx] = useState(-1);
  const [wCol, setWCol] = useWidth("semana.coluna", 380);
  const [erro, setErro] = useState("");
  const [preparo, setPreparo] = useState(null); // { turma, aula } aberto no painel "Preparar aula"
  const carregar = (irParaUltima) => lerCiclos(items).then(async (c) => {
    const ano = c.anoLetivo ?? String(new Date().getFullYear());
    const [semanas, legado, cfg] = await Promise.all([lerSemanas(items), lerSemana(items).catch(() => null), lerTurmas(items, ano)]);
    setDados({ semanas, legado, ciclos: c.ciclos, ano, cfg });
    setIdx((i) => { const f = focoPath ? semanas.findIndex((x) => x.path === focoPath) : -1; return f >= 0 ? f : irParaUltima || i < 0 || i >= semanas.length ? semanas.length - 1 : i; });
  }).catch((e) => setErro(String(e)));
  useEffect(() => { carregar(false); }, [items, focoPath]);
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
      await criarSemana(items, { ano, seg, rotulo: rotuloDe(seg), turmas: semanaNova({ semanas, turmas }) });
      setIdx(-1); await onRefresh(); // items muda e a tela recarrega na última semana
    } catch (e) { falha(e); }
  };

  if (!turmas.length) return <DefinirTurmas ano={ano} onOk={(lista) => mexer(async () => { await gravarTurmas(items, ano, { turmas: lista, aulas: cfg.aulas }); await onRefresh(); })} />;
  if (!semanas.length) return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <h1 className="font-serif text-3xl font-semibold">Esta semana</h1>
      <p className="mt-2 max-w-xl text-xs text-muted-foreground">Ainda não há nenhuma semana em Anos/{ano}/Semanas. Turmas: {turmas.join(", ")}.</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={() => nova(segundaDe())} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90">Criar a semana de {rotuloDe(segundaDe())}</button>
        {legado && <button onClick={() => importarLegado(items, legado, ano).then(() => onRefresh()).catch(falha)} className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent">Importar do Planejamento antigo</button>}
      </div>
      {legado && <p className="mt-3 max-w-xl text-xs text-muted-foreground">Importar cria uma nota de histórico com o ciclo de cada turma e as aulas já marcadas ✓ em Planejamento.md; depois disso o Planejamento.md não é mais lido.</p>}
    </div>
  );

  const s = semanas[Math.max(0, idx)];
  const ehUltima = semanas.indexOf(s) === semanas.length - 1;
  const situar = (turma, n, sit) => mexer(async () => { const t = await invoke("read_note", { path: s.path }); await invoke("save_note", { path: s.path, text: situacaoAula(t, turma, n, sit) }); });
  const cicloDe = (turma) => { const nome = cicloDaTurma(semanas, turma); return nome ? ciclos.find((c) => c.name.toLowerCase() === nome.toLowerCase()) : null; };
  const colunas = [...turmas, ...s.turmas.map((t) => t.turma).filter((t) => !turmas.includes(t))].map((turma) => s.turmas.find((t) => t.turma === turma) ?? { turma, aulas: [] });
  const todas = colunas.flatMap((t) => t.aulas), dadas = todas.filter((a) => a.dada).length;
  const segAtual = segundaDe();
  const faltaAtual = ehUltima && !focoPath && !items.some((i) => i.name === nomeSemana(segAtual)) && proximaSegunda(semanas).getTime() === segAtual.getTime();

  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button disabled={idx <= 0} onClick={() => setIdx(idx - 1)} className="rounded p-1 hover:bg-accent disabled:opacity-30" aria-label="Semana anterior"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="whitespace-nowrap font-serif text-3xl font-semibold">{s.rotulo || s.name}</h1>
        <button disabled={ehUltima} onClick={() => setIdx(idx + 1)} className="rounded p-1 hover:bg-accent disabled:opacity-30" aria-label="Próxima semana"><ChevronRight className="h-5 w-5" /></button>
        <span className="text-xs text-muted-foreground">{dadas} de {todas.length} aulas dadas</span>
        <div className="flex-1" />
        <button onClick={() => onOpen(s.path)} className="text-xs text-primary hover:underline">abrir nota</button>
        {ehUltima && !faltaAtual && <button onClick={() => nova()} className="rounded-md border px-3 py-1 text-xs hover:bg-accent">Semana seguinte</button>}
      </div>
      {faltaAtual && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-xs">
          <span className="flex-1">A semana de <b>{rotuloDe(segAtual)}</b> ainda não existe. Ela nasce com as aulas não dadas da semana anterior e espaços vazios para o resto.</span>
          <button onClick={() => nova(segAtual)} className="rounded-md bg-primary px-3 py-1 text-primary-foreground hover:opacity-90">Criar esta semana</button>
        </div>
      )}

      <div className="mt-4 flex items-start overflow-x-auto pb-2">
        {colunas.map((t, ci) => {
          const ciclo0 = t.cicloNome ?? cicloDaTurma(semanas, t.turma);
          const vazios = Math.max(0, cfg.aulas - t.aulas.length);
          const sugestoes = proximasDoCiclo({ ciclos, semanas, turma: t.turma, nomeCiclo: ciclo0, qtd: vazios });
          return (
          <Fragment key={t.turma}>
          {ci > 0 && <ResizeHandle width={wCol} setWidth={setWCol} min={260} max={720} side="left" />}
          <div style={{ width: wCol }} className="mx-2 shrink-0 rounded-xl border bg-background p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2"><span className="font-serif text-xl font-semibold">Turma {t.turma}</span>
              <span className="flex items-center gap-1.5">
                {vazios > 0 && sugestoes.length > 0 && <button title={`Preencher os espaços vazios com as próximas aulas de ${ciclo0}`} onClick={() => mexer(async () => { for (const a of sugestoes) await adicionarDoCiclo(s.path, t.turma, a); })} className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent">Preencher</button>}
                {proximaAula(t) && <button onClick={() => setPreparo({ turma: t.turma, aula: proximaAula(t) })} className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent">Preparar aula</button>}
              </span></div>
            <div className="flex flex-col gap-2">
              {t.aulas.map((a) => (
                <div key={a.n} className={"rounded-lg border px-3 py-2.5 " + (a.situacao === "dada" ? "bg-muted/40 opacity-75" : a.situacao === "pulada" ? "border-dashed bg-muted/30 opacity-75" : a.situacao === "incerta" ? "border-warn/70" : "")}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{a.cicloNome ? `${a.cicloNome.replace(/^\d{3}\s*-\s*/, "").replace(/\s*-\s*(PR|PT|TG)$/, "")} · aula ${a.cicloN ?? "?"}` : "aula escrita por você"}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {!a.cicloNome && cicloDe(t.turma) && <button title={`Promover a aula do ciclo ${cicloDe(t.turma).name}`} onClick={() => mexer(() => promoverAvulsa(s.path, t.turma, a.n, cicloDe(t.turma)))} className="hover:text-foreground"><ArrowUpToLine className="h-4 w-4" /></button>}
                      {!a.dada && <button title="Esvaziar este espaço" onClick={() => mexer(() => removerAulaSemana(s.path, t.turma, a.n))} className="hover:text-err"><X className="h-4 w-4" /></button>}
                    </span>
                  </div>
                  <div className="text-sm font-medium leading-snug">{a.cicloNome && <><span style={{ color: fase[a.fase].cor }}>{fase[a.fase].nome}</span> · </>}<Inline texto={a.texto} /></div>
                  {a.recurso && <div className="mt-1 text-xs">{nomes(a.recurso).length ? nomes(a.recurso).map((n) => existe(n)
                    ? <button key={n} onClick={() => onOpen(existe(n).path)} className="mr-2 text-primary hover:underline">{n}</button>
                    : <span key={n} className="mr-2 text-warn">{n} (a criar)</span>) : <span className="text-muted-foreground">{a.recurso}</span>}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    {a.situacao ? (<>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">{SITUACOES.find((x) => x.id === a.situacao).marca} {SITUACOES.find((x) => x.id === a.situacao).nome}</span>
                      <button onClick={() => situar(t.turma, a.n, null)} className="text-muted-foreground hover:underline">desfazer</button>
                    </>) : SITUACOES.map((x) => (
                      <button key={x.id} onClick={() => situar(t.turma, a.n, x.id)} className={x.id === "dada" ? "rounded-full bg-primary px-3 py-1 text-primary-foreground hover:opacity-90" : "rounded-full border px-2.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"}>{x.id === "dada" ? "Dar aula ✓" : `${x.marca} ${x.nome}`}</button>
                    ))}
                  </div>
                </div>
              ))}
              {Array.from({ length: vazios }, (_, k) => (
                <Espaco key={k} n={t.aulas.length + k + 1} turma={t.turma} ciclos={ciclos} semanas={semanas} cicloInicial={ciclo0}
                  onCiclo={(a) => mexer(() => adicionarDoCiclo(s.path, t.turma, a))} onTexto={(texto) => mexer(() => adicionarAvulsa(s.path, t.turma, texto))} />
              ))}
            </div>
          </div>
          </Fragment>
        ); })}
      </div>
      {preparo && <PrepararAula turma={preparo.turma} aula={preparo.aula} semana={s} ciclo={ciclos.find((c) => c.name.toLowerCase() === (preparo.aula.cicloNome ?? "").toLowerCase()) ?? null} existe={existe} onOpen={(p) => { setPreparo(null); onOpen(p); }} onClose={() => setPreparo(null)} />}
    </div>
  );
}

/** A próxima aula a dar: a primeira da turma sem situação (nem dada, nem pulada, nem "não sei"). */
const proximaAula = (t) => t.aulas.find((a) => !a.situacao) ?? null;

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
function PrepararAula({ turma, aula, semana, ciclo, existe, onOpen, onClose }) {
  const vizinha = (n) => ciclo?.aulas.find((x) => x.n === n);
  const antes = aula.cicloN ? vizinha(aula.cicloN - 1) : null, depois = aula.cicloN ? vizinha(aula.cicloN + 1) : null;
  const dadasHoje = semana.turmas.find((t) => t.turma === turma)?.aulas.filter((a) => a.dada) ?? [];
  const alvos = [...new Set([...nomes(aula.recurso ?? ""), ...nomes(aula.texto)])];
  const hab = ciclo?.habTexto?.length ? ciclo.habTexto : (ciclo?.habilidades ?? []).map((codigo) => ({ codigo, texto: "" }));
  const Nota = ({ n }) => existe(n) ? <button onClick={() => onOpen(existe(n).path)} className="mr-2 text-primary hover:underline">{n}</button> : <span className="mr-2 text-warn">{n} (a criar)</span>;
  return (
    <div role="dialog" aria-label="Preparar aula" className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-8" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-baseline justify-between"><span className="text-xs text-muted-foreground">Turma {turma} · {aula.cicloNome ? `${aula.cicloNome} · aula ${aula.cicloN ?? "?"}` : "aula avulsa"}</span>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:underline">fechar</button></div>
        <h2 className="font-serif text-2xl font-semibold"><span style={{ color: fase[aula.fase].cor }}>{fase[aula.fase].nome}</span> · <Inline texto={aula.texto} /></h2>
        {alvos.length > 0 && <div className="mt-3 text-sm"><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Recursos e textos</div>{alvos.map((n) => <Nota key={n} n={n} />)}
          {aula.recurso && !nomes(aula.recurso).length && <span className="text-muted-foreground">{aula.recurso}</span>}</div>}
        {!alvos.length && aula.recurso && <div className="mt-3 text-sm"><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Recurso</div>{aula.recurso}</div>}
        {(antes || depois) && <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
          <div><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Aula anterior do ciclo</div>{antes ? `${antes.n}. ${limpa(antes.texto)}` : "—"}</div>
          <div><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Aula seguinte do ciclo</div>{depois ? `${depois.n}. ${limpa(depois.texto)}` : "—"}</div></div>}
        {ciclo?.conteudos?.length > 0 && <div className="mt-4 text-xs"><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Conteúdos do ciclo</div><ul className="list-disc pl-5">{ciclo.conteudos.map((c) => <li key={c}>{limpa(c)}</li>)}</ul></div>}
        {hab.length > 0 && <div className="mt-4 text-xs"><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Habilidades</div>{hab.map((h) => <div key={h.codigo}><b>{h.codigo}</b> {h.texto}</div>)}</div>}
        {dadasHoje.length > 0 && <div className="mt-4 text-xs"><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Já dadas nesta semana</div>{dadasHoje.map((a) => <div key={a.n}>✓ {limpa(a.texto)}</div>)}</div>}
        {ciclo && <div className="mt-5"><button onClick={() => onOpen(ciclo.path)} className="text-xs text-primary hover:underline">abrir o plano do ciclo</button></div>}
      </div>
    </div>
  );
}

/** Espaço vazio da semana: um clique abre as sugestões do ciclo (e um campo para escrever qualquer coisa). */
function Espaco({ n, turma, ciclos, semanas, cicloInicial, onCiclo, onTexto }) {
  const [aberto, setAberto] = useState(false), [texto, setTexto] = useState(""), [ciclo, setCiclo] = useState(cicloInicial ?? "");
  if (!aberto) return <button onClick={() => setAberto(true)} className="flex min-h-[4.5rem] items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground hover:border-primary/50 hover:bg-accent/40 hover:text-foreground"><Plus className="h-3.5 w-3.5" />Aula {n}</button>;
  const sugestoes = proximasDoCiclo({ ciclos, semanas, turma, nomeCiclo: ciclo, qtd: 5 });
  const fechar = () => { setAberto(false); setTexto(""); };
  const escrever = () => { if (texto.trim()) { onTexto(texto.trim()); fechar(); } };
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/40 p-3 text-xs">
      <div className="flex items-center gap-2"><span className="text-muted-foreground">Sugestões de</span>
        <select value={ciclo} onChange={(e) => setCiclo(e.target.value)} aria-label="Ciclo das sugestões" className="min-w-0 flex-1 rounded border bg-background px-1 py-1">
          <option value="">(escolha um ciclo)</option>{(ciclos.some((c) => String(c.ano) === turma[0]) ? ciclos.filter((c) => String(c.ano) === turma[0] || c.name === ciclo) : ciclos).map((c) => <option key={c.path} value={c.name}>{c.name}</option>)}</select></div>
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
