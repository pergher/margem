import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, ArrowUpToLine } from "lucide-react";
import { FASES, lerCiclos } from "@/lib/ciclos";
import { AULAS_POR_SEMANA, SITUACOES, situacaoAula, lerSemana, lerSemanas, sugerirSemana, importarLegado, cicloDaTurma, proximasDoCiclo, criarSemana, segundaDe, rotuloDe, nomeSemana, removerAulaSemana, adicionarAvulsa, promoverAvulsa, adicionarDoCiclo } from "@/lib/semana";
import { invoke } from "@/lib/api";

const fase = Object.fromEntries(FASES.map((f) => [f.id, f]));
const limpa = (t) => t.replace(/\*\*/g, "");
const nomes = (r) => [...r.matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim());

export function SemanaPage({ items, onOpen, onRefresh, focoPath }) {
  const [dados, setDados] = useState(undefined); // { semanas, legado, ciclos, ano }
  const [idx, setIdx] = useState(-1);
  const [rascunho, setRascunho] = useState(null);
  const [erro, setErro] = useState("");
  const [preparo, setPreparo] = useState(null); // { turma, aula } aberto no painel "Preparar aula"
  const carregar = (irParaUltima) => Promise.all([lerSemanas(items), lerSemana(items).catch(() => null), lerCiclos(items)])
    .then(([semanas, legado, c]) => { setDados({ semanas, legado, ciclos: c.ciclos, ano: c.anoLetivo ?? String(new Date().getFullYear()) }); setIdx((i) => { const f = focoPath ? semanas.findIndex((x) => x.path === focoPath) : -1; return f >= 0 ? f : irParaUltima || i < 0 || i >= semanas.length ? semanas.length - 1 : i; }); })
    .catch((e) => setErro(String(e)));
  useEffect(() => { carregar(false); }, [items, focoPath]);
  const existe = (n) => items.find((i) => i.name.toLowerCase() === n.toLowerCase());
  const falha = (e) => setErro(String(e?.message ?? e));

  if (erro) return <div className="p-8 text-sm text-destructive">Erro: {erro} <button className="ml-2 underline" onClick={() => { setErro(""); carregar(false); }}>tentar de novo</button></div>;
  if (dados === undefined) return <div className="p-8 text-sm text-muted-foreground">Lendo a semana…</div>;

  const { semanas, legado, ciclos, ano } = dados;
  const iniciar = () => {
    const seg = segundaDe();
    setRascunho({ seg, rotulo: rotuloDe(seg), turmas: sugerirSemana({ ciclos, semanas }) });
  };
  const gravar = async (r = rascunho) => {
    try {
      const turmas = r.turmas.filter((t) => t.aulas.length || t.cicloNome);
      await criarSemana(items, { ano, seg: r.seg, rotulo: r.rotulo, turmas });
      setRascunho(null); setIdx(-1); await onRefresh(); // items muda e a tela recarrega na última semana
    } catch (e) { falha(e); }
  };
  // Semana corrente ainda sem nota: um clique cria com o modelo padrão (aulas não dadas + próximas do ciclo).
  const segAtual = segundaDe();
  const faltaAtual = !focoPath && semanas.length > 0 && !items.some((i) => i.name === nomeSemana(segAtual));
  const criarAtual = () => gravar({ seg: segAtual, rotulo: rotuloDe(segAtual), turmas: sugerirSemana({ ciclos, semanas }) });

  if (rascunho) return <Rascunho ciclos={ciclos} semanas={semanas} r={rascunho} setR={setRascunho} onOk={() => gravar()} onCancel={() => setRascunho(null)} jaExiste={items.some((i) => i.name === nomeSemana(rascunho.seg))} />;
  if (!semanas.length) return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <h1 className="font-serif text-3xl font-semibold">Esta semana</h1>
      <p className="mt-2 max-w-xl text-[13px] text-muted-foreground">Ainda não há nenhuma nota de semana (Anos/{ano}/Semanas). A tela mostra só o que está nessas notas.</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {legado && <button onClick={() => importarLegado(items, legado, ano).then(() => onRefresh()).catch(falha)} className="rounded-md bg-primary px-3 py-1.5 text-[13px] text-primary-foreground hover:opacity-90">Importar do Planejamento antigo</button>}
        <button onClick={iniciar} className={legado ? "rounded-md border px-3 py-1.5 text-[13px] hover:bg-accent" : "rounded-md bg-primary px-3 py-1.5 text-[13px] text-primary-foreground hover:opacity-90"}>Semana nova</button>
      </div>
      {legado && <p className="mt-3 max-w-xl text-xs text-muted-foreground">Importar cria uma nota de histórico com o ciclo de cada turma e as aulas já marcadas ✓ em Planejamento.md; depois disso o Planejamento.md não é mais lido.</p>}
    </div>
  );

  const s = semanas[Math.max(0, idx)];
  const ehUltima = semanas.indexOf(s) === semanas.length - 1;
  const mexer = (fn) => fn().then(() => carregar(false)).catch(falha);
  const situar = (turma, n, sit) => mexer(async () => { const t = await invoke("read_note", { path: s.path }); await invoke("save_note", { path: s.path, text: situacaoAula(t, turma, n, sit) }); });
  const cicloDe = (turma) => { const nome = cicloDaTurma(semanas, turma); return nome ? ciclos.find((c) => c.name.toLowerCase() === nome.toLowerCase()) : null; };
  const dadas = s.turmas.flatMap((t) => t.aulas).filter((a) => a.dada).length, total = s.turmas.flatMap((t) => t.aulas).length;

  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <div className="mb-1 flex items-center gap-3">
        <button disabled={idx <= 0} onClick={() => setIdx(idx - 1)} className="rounded p-1 hover:bg-accent disabled:opacity-30" aria-label="Semana anterior"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="font-serif text-3xl font-semibold">{s.rotulo || s.name}</h1>
        <button disabled={ehUltima} onClick={() => setIdx(idx + 1)} className="rounded p-1 hover:bg-accent disabled:opacity-30" aria-label="Próxima semana"><ChevronRight className="h-5 w-5" /></button>
        <span className="text-[13px] text-muted-foreground">{dadas} de {total} aulas dadas</span>
        <div className="flex-1" />
        <button onClick={() => onOpen(s.path)} className="text-xs text-primary hover:underline">abrir nota</button>
        <button onClick={iniciar} className="rounded-md bg-primary px-3 py-1 text-[13px] text-primary-foreground hover:opacity-90">Semana nova</button>
      </div>
      {faltaAtual && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-[13px]">
          <span className="flex-1">A semana de <b>{rotuloDe(segAtual)}</b> ainda não tem nota. Ela já nasce com as aulas não dadas da semana anterior e as próximas do ciclo de cada turma.</span>
          <button onClick={criarAtual} className="rounded-md bg-primary px-3 py-1 text-primary-foreground hover:opacity-90">Criar esta semana</button>
          <button onClick={iniciar} className="text-muted-foreground hover:underline">revisar antes</button>
        </div>
      )}
      <div className="mb-5 text-[13px] text-muted-foreground">Só o rótulo da semana importa, sem datas de aula. Aula não dada continua aqui até você levá-la para a próxima semana.</div>

      <div className="grid gap-4 lg:grid-cols-3">
        {s.turmas.map((t) => (
          <div key={t.turma} className="rounded-xl border bg-background p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2"><span className="font-serif text-xl font-semibold">Turma {t.turma}</span>
              {proximaAula(t) && <button onClick={() => setPreparo({ turma: t.turma, aula: proximaAula(t) })} className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent">Preparar aula</button>}</div>
            <div className="flex flex-col gap-2">
              {t.aulas.map((a) => (
                <div key={a.n} className={"rounded-lg border px-3 py-2.5 " + (a.situacao === "dada" ? "bg-muted/40 opacity-75" : a.situacao === "pulada" ? "border-dashed bg-muted/30 opacity-75" : a.situacao === "incerta" ? "border-amber-400/70" : "")}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
                    <span className="truncate">{a.cicloNome ? `${a.cicloNome.replace(/^\d{3}\s*-\s*/, "").replace(/\s*-\s*(PR|PT|TG)$/, "")} · aula ${a.cicloN ?? "?"}` : "avulsa"}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {!a.cicloNome && cicloDe(t.turma) && <button title={`Promover a aula do ciclo ${cicloDe(t.turma).name}`} onClick={() => mexer(() => promoverAvulsa(s.path, t.turma, a.n, cicloDe(t.turma)))} className="hover:text-foreground"><ArrowUpToLine className="h-4 w-4" /></button>}
                      {!a.dada && <button title="Tirar da semana" onClick={() => mexer(() => removerAulaSemana(s.path, t.turma, a.n))} className="hover:text-destructive"><X className="h-4 w-4" /></button>}
                    </span>
                  </div>
                  <div className="text-[15px] font-medium leading-snug"><span style={{ color: fase[a.fase].cor }}>{fase[a.fase].nome}</span> · {limpa(a.texto)}</div>
                  {a.recurso && <div className="mt-1 text-[13px]">{nomes(a.recurso).length ? nomes(a.recurso).map((n) => existe(n)
                    ? <button key={n} onClick={() => onOpen(existe(n).path)} className="mr-2 text-primary hover:underline">{n}</button>
                    : <span key={n} className="mr-2 text-amber-700">{n} (a criar)</span>) : <span className="text-muted-foreground">{a.recurso}</span>}</div>}
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
              {ehUltima && <Sugestoes lista={proximasDoCiclo({ ciclos, semanas, turma: t.turma, nomeCiclo: t.cicloNome ?? cicloDaTurma(semanas, t.turma), qtd: 3 })} onAdd={(a) => mexer(() => adicionarDoCiclo(s.path, t.turma, a))} />}
              <NovaAvulsa onAdd={(texto, rec) => mexer(() => adicionarAvulsa(s.path, t.turma, texto, rec))} />
            </div>
          </div>
        ))}
      </div>
      {preparo && <PrepararAula turma={preparo.turma} aula={preparo.aula} semana={s} ciclo={ciclos.find((c) => c.name.toLowerCase() === (preparo.aula.cicloNome ?? "").toLowerCase()) ?? null} existe={existe} onOpen={(p) => { setPreparo(null); onOpen(p); }} onClose={() => setPreparo(null)} />}
    </div>
  );
}

/** A próxima aula a dar: a primeira da turma sem situação (nem dada, nem pulada, nem "não sei"). */
const proximaAula = (t) => t.aulas.find((a) => !a.situacao) ?? null;

/** Pacote da aula: o que ela é, os recursos, o contexto do ciclo (aulas vizinhas, conteúdos, habilidades) e as aulas já dadas da turma. */
function PrepararAula({ turma, aula, semana, ciclo, existe, onOpen, onClose }) {
  const vizinha = (n) => ciclo?.aulas.find((x) => x.n === n);
  const antes = aula.cicloN ? vizinha(aula.cicloN - 1) : null, depois = aula.cicloN ? vizinha(aula.cicloN + 1) : null;
  const dadasHoje = semana.turmas.find((t) => t.turma === turma)?.aulas.filter((a) => a.dada) ?? [];
  const alvos = [...new Set([...nomes(aula.recurso ?? ""), ...nomes(aula.texto)])];
  const hab = ciclo?.habTexto?.length ? ciclo.habTexto : (ciclo?.habilidades ?? []).map((codigo) => ({ codigo, texto: "" }));
  const Nota = ({ n }) => existe(n) ? <button onClick={() => onOpen(existe(n).path)} className="mr-2 text-primary hover:underline">{n}</button> : <span className="mr-2 text-amber-700">{n} (a criar)</span>;
  return (
    <div role="dialog" aria-label="Preparar aula" className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-8" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-baseline justify-between"><span className="text-xs text-muted-foreground">Turma {turma} · {aula.cicloNome ? `${aula.cicloNome} · aula ${aula.cicloN ?? "?"}` : "aula avulsa"}</span>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:underline">fechar</button></div>
        <h2 className="font-serif text-2xl font-semibold"><span style={{ color: fase[aula.fase].cor }}>{fase[aula.fase].nome}</span> · {limpa(aula.texto)}</h2>
        {alvos.length > 0 && <div className="mt-3 text-[14px]"><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Recursos e textos</div>{alvos.map((n) => <Nota key={n} n={n} />)}
          {aula.recurso && !nomes(aula.recurso).length && <span className="text-muted-foreground">{aula.recurso}</span>}</div>}
        {!alvos.length && aula.recurso && <div className="mt-3 text-[14px]"><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Recurso</div>{aula.recurso}</div>}
        {(antes || depois) && <div className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
          <div><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Aula anterior do ciclo</div>{antes ? `${antes.n}. ${limpa(antes.texto)}` : "—"}</div>
          <div><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Aula seguinte do ciclo</div>{depois ? `${depois.n}. ${limpa(depois.texto)}` : "—"}</div></div>}
        {ciclo?.conteudos?.length > 0 && <div className="mt-4 text-[13px]"><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Conteúdos do ciclo</div><ul className="list-disc pl-5">{ciclo.conteudos.map((c) => <li key={c}>{limpa(c)}</li>)}</ul></div>}
        {hab.length > 0 && <div className="mt-4 text-[13px]"><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Habilidades</div>{hab.map((h) => <div key={h.codigo}><b>{h.codigo}</b> {h.texto}</div>)}</div>}
        {dadasHoje.length > 0 && <div className="mt-4 text-[13px]"><div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Já dadas nesta semana</div>{dadasHoje.map((a) => <div key={a.n}>✓ {limpa(a.texto)}</div>)}</div>}
        {ciclo && <div className="mt-5"><button onClick={() => onOpen(ciclo.path)} className="text-xs text-primary hover:underline">abrir o plano do ciclo</button></div>}
      </div>
    </div>
  );
}

/** Próximas aulas do ciclo que ainda não estão em nenhuma semana; "+" leva a aula para esta. */
function Sugestoes({ lista, onAdd }) {
  if (!lista.length) return null;
  return (
    <div className="mt-1 rounded-lg border border-dashed p-2">
      <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">Próximas do ciclo</div>
      {lista.map((a) => (
        <button key={a.cicloN} onClick={() => onAdd(a)} title="Adicionar a esta semana" className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left text-[13px] hover:bg-accent">
          <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span><span className="text-muted-foreground">aula {a.cicloN} · </span>{limpa(a.texto)}</span>
        </button>
      ))}
    </div>
  );
}

function NovaAvulsa({ onAdd }) {
  const [aberto, setAberto] = useState(false), [texto, setTexto] = useState(""), [rec, setRec] = useState("");
  if (!aberto) return <button onClick={() => setAberto(true)} className="flex items-center gap-1 rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" />aula avulsa</button>;
  const ok = () => { if (texto.trim()) { onAdd(texto.trim(), rec.trim()); setTexto(""); setRec(""); setAberto(false); } };
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-2">
      <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ok()} placeholder="O que vai ser a aula" className="rounded border bg-background px-2 py-1 text-[13px] outline-none" />
      <input value={rec} onChange={(e) => setRec(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ok()} placeholder="Recurso (opcional, ex.: [[Texto]])" className="rounded border bg-background px-2 py-1 text-[13px] outline-none" />
      <div className="flex gap-2 text-xs"><button onClick={ok} className="text-primary hover:underline">Adicionar</button><button onClick={() => setAberto(false)} className="text-muted-foreground hover:underline">Cancelar</button></div>
    </div>
  );
}

function Rascunho({ r, setR, onOk, onCancel, jaExiste, ciclos, semanas }) {
  // Trocar o ciclo troca as aulas sugeridas (mantém as trazidas da semana anterior e as avulsas).
  const trocarCiclo = (ti, nome) => setR({ ...r, turmas: r.turmas.map((t, i) => {
    if (i !== ti) return t;
    const fixas = t.aulas.filter((a) => a.trazida || !a.cicloNome);
    return { ...t, cicloNome: nome, aulas: [...fixas, ...proximasDoCiclo({ ciclos, semanas, turma: t.turma, nomeCiclo: nome, qtd: AULAS_POR_SEMANA - fixas.length, excluir: fixas })] };
  }) });
  const [novaTurma, setNovaTurma] = useState("");
  const addTurma = () => { const n = novaTurma.trim(); if (n && !r.turmas.some((t) => t.turma === n)) { setR({ ...r, turmas: [...r.turmas, { turma: n, cicloNome: null, aulas: [] }] }); setNovaTurma(""); } };
  const mudar = (ti, fn) => setR({ ...r, turmas: r.turmas.map((t, i) => (i === ti ? { ...t, aulas: fn(t.aulas) } : t)) });
  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <h1 className="mb-1 font-serif text-3xl font-semibold">Semana nova</h1>
      <div className="mb-4 text-[13px] text-muted-foreground">O app sugeriu as próximas {4} aulas de cada turma (mais as não dadas da semana anterior). Tire, troque ou acrescente.</div>
      <label className="mb-5 flex items-center gap-2 text-sm">Rótulo
        <input value={r.rotulo} onChange={(e) => setR({ ...r, rotulo: e.target.value })} className="w-72 rounded border bg-background px-2 py-1" />
        {jaExiste && <span className="text-xs text-amber-700">já existe uma nota para esta segunda-feira</span>}
      </label>
      <div className="grid gap-4 lg:grid-cols-3">
        {r.turmas.map((t, ti) => (
          <div key={t.turma} className="rounded-xl border bg-background p-4">
            <div className="mb-1 font-serif text-xl font-semibold">Turma {t.turma}</div>
            <label className="mb-3 block text-xs text-muted-foreground">Ciclo
              <select value={t.cicloNome ?? ""} onChange={(e) => trocarCiclo(ti, e.target.value || null)} className="mt-0.5 w-full rounded border bg-background px-1 py-1 text-[13px] text-foreground">
                <option value="">(nenhum)</option>
                {ciclos.map((c) => <option key={c.path} value={c.name}>{c.name}</option>)}</select></label>
            <div className="flex flex-col gap-2">
              {t.aulas.map((a, ai) => (
                <div key={ai} className="rounded-lg border px-3 py-2">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{a.cicloNome ? `aula ${a.cicloN}${a.trazida ? " · da semana anterior" : ""}` : "avulsa"}</span><button onClick={() => mudar(ti, (x) => x.filter((_, k) => k !== ai))} className="hover:text-destructive" title="Tirar"><X className="h-3.5 w-3.5" /></button></div>
                  <div className="text-[13px] font-medium">{limpa(a.texto)}</div>
                </div>
              ))}
              {!t.aulas.length && <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Sem aulas nesta turma.</div>}
              <NovaAvulsa onAdd={(texto, recurso) => mudar(ti, (x) => [...x, { texto, recurso, dada: false, cicloNome: null, cicloN: null }])} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm">
        <input value={novaTurma} onChange={(e) => setNovaTurma(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTurma()} placeholder="Nova turma (ex.: 61)" className="w-44 rounded border bg-background px-2 py-1" />
        <button onClick={addTurma} className="rounded-md border px-3 py-1 text-[13px] hover:bg-accent">+ Turma</button>
      </div>
      <div className="mt-5 flex gap-3">
        <button onClick={onOk} disabled={jaExiste} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-40">Criar semana</button>
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:underline">Cancelar</button>
      </div>
    </div>
  );
}
