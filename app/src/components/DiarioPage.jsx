import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { lerSemanas } from "@/lib/semana";
import { ESTADOS, listarDiarios, listarAlunos, lerMeta, criarDiario, criarAluno, inserirOcorrencia, mudarEstado, ocorrenciasDoDiario, aulasDoDiario, turmasDe } from "@/lib/diario";

function Foto({ nome }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { setSrc(null); if (nome) invoke("read_embed", { target: nome }).then((r) => setSrc(r?.kind === "image" ? r.data : null)).catch(() => setSrc(null)); }, [nome]);
  if (!nome) return null;
  return src ? <img src={src} alt={nome} className="w-full rounded bg-white shadow" /> : <div className="p-3 text-xs text-muted-foreground">{nome}: imagem não encontrada.</div>;
}

const Aba = ({ on, children, ...p }) => <button {...p} className={cn("rounded-md px-3 py-1 text-sm", on ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}>{children}</button>;

export function DiarioPage({ items, onOpen, onRefresh, focoPath }) {
  // focoPath: abre já na nota de diário ou de aluno escolhida (visão personalizada da nota).
  const foco = focoPath ? items.find((i) => i.path === focoPath) : null;
  const ehAluno = !!foco && /^Anos\/\d{4}\/Alunos\//.test(foco.rel);
  const [aba, setAba] = useState(ehAluno ? "alunos" : "diario");
  const [turma, setTurma] = useState(foco ? foco.rel.split("/")[3] : "");
  useEffect(() => { if (foco) { setAba(ehAluno ? "alunos" : "diario"); setTurma(foco.rel.split("/")[3]); } }, [focoPath]);
  const [ocultar, setOcultar] = useState(true); // nomes de alunos borrados até passar o mouse
  const [semanas, setSemanas] = useState([]);
  const [erro, setErro] = useState("");
  const diarios = useMemo(() => listarDiarios(items), [items]);
  const alunos = useMemo(() => listarAlunos(items), [items]);
  useEffect(() => { lerSemanas(items).then(setSemanas).catch(() => {}); }, [items]);
  const turmas = useMemo(() => [...new Set([...diarios.map((d) => d.turma), ...alunos.map((a) => a.turma), ...semanas.flatMap((s) => s.turmas.flatMap((t) => turmasDe(t.turma)))])].sort(), [diarios, alunos, semanas]);
  useEffect(() => { if (!turma && turmas.length) setTurma(turmas[0]); }, [turmas, turma]);
  const ano = items.map((i) => /^Anos\/(\d{4})\//.exec(i.rel)?.[1]).filter(Boolean).sort().pop() ?? String(new Date().getFullYear());
  const falha = (e) => setErro(String(e?.message ?? e));

  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold">Diário</h1>
        <select value={turma} onChange={(e) => setTurma(e.target.value)} className="rounded border bg-background px-2 py-1 text-sm" aria-label="Turma">
          {turmas.map((t) => <option key={t} value={t}>Turma {t}</option>)}
        </select>
        <Aba on={aba === "diario"} onClick={() => setAba("diario")}>Diários</Aba>
        <Aba on={aba === "alunos"} onClick={() => setAba("alunos")}>Alunos</Aba>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={ocultar} onChange={(e) => setOcultar(e.target.checked)} />ocultar nomes</label>
      </div>
      <div className="mb-4 text-xs text-muted-foreground">Dados sensíveis: estas pastas ficam bloqueadas no MCP (o Claude não lê o diário nem as notas de aluno).</div>
      {erro && <div className="mb-3 text-sm text-destructive">Erro: {erro} <button className="underline" onClick={() => setErro("")}>ok</button></div>}
      {!turma ? <div className="text-sm text-muted-foreground">Nenhuma turma encontrada ainda. Crie uma semana ou um aluno.</div>
        : aba === "diario"
          ? <Diarios items={items} turma={turma} ano={ano} diarios={diarios.filter((d) => d.turma === turma)} alunos={alunos.filter((a) => a.turma === turma)} semanas={semanas} ocultar={ocultar} onRefresh={onRefresh} falha={falha} focoSel={focoPath} />
          : <Alunos items={items} turma={turma} ano={ano} alunos={alunos.filter((a) => a.turma === turma)} diarios={diarios.filter((d) => d.turma === turma)} ocultar={ocultar} onOpen={onOpen} onRefresh={onRefresh} falha={falha} focoSel={focoPath} />}
    </div>
  );
}

function Diarios({ items, turma, ano, diarios, alunos, semanas, ocultar, onRefresh, falha, focoSel }) {
  const [wLista, setWLista] = useWidth("diario.lista", 220), [wFoto, setWFoto] = useWidth("diario.foto", 380);
  const [sel, setSel] = useState(focoSel ?? null);
  useEffect(() => { if (focoSel) setSel(focoSel); }, [focoSel]);
  const [texto, setTexto] = useState(null);
  const [status, setStatus] = useState("");
  const [novo, setNovo] = useState(false);
  const timer = useRef(null);
  const atual = diarios.find((d) => d.path === sel) ?? null;
  useEffect(() => { if (!atual && diarios.length) setSel(diarios[diarios.length - 1].path); if (atual === null && !diarios.length) { setSel(null); setTexto(null); } }, [diarios.length, atual?.path]);
  useEffect(() => { setTexto(null); if (sel) invoke("read_note", { path: sel }).then(setTexto).catch(falha); }, [sel]);

  const gravar = (t) => { setTexto(t); setStatus("Editando…"); clearTimeout(timer.current); timer.current = setTimeout(() => invoke("save_note", { path: sel, text: t }).then(() => setStatus("Salvo")).catch(falha), 700); };
  const meta = texto ? lerMeta(texto) : null;
  const ocs = texto ? ocorrenciasDoDiario(texto) : [];

  return (
    <div className="flex gap-3">
      <div style={{ width: wLista }} className="flex shrink-0 flex-col gap-1">
        {diarios.map((d) => <button key={d.path} onClick={() => setSel(d.path)} className={cn("rounded-lg px-3 py-2 text-left text-sm", d.path === sel ? "bg-accent" : "hover:bg-accent/50")}>{d.name.replace(/^Diario \d+ - /, "")}</button>)}
        {!diarios.length && <div className="text-xs text-muted-foreground">Nenhum diário desta turma.</div>}
        <button onClick={() => setNovo(true)} className="mt-2 rounded-lg border border-dashed px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground">+ Novo diário</button>
      </div>
      <ResizeHandle width={wLista} setWidth={setWLista} min={150} max={400} side="left" />
      <div className="min-w-0 flex-1">
        {novo && <NovoDiario turma={turma} semanas={semanas} diarios={diarios} onCancel={() => setNovo(false)}
          onOk={async (semana, aulas, foto) => { try { const p = await criarDiario(items, { ano, turma, semana, aulas, foto }); setNovo(false); await onRefresh(); setSel(p); } catch (e) { falha(e); } }} />}
        {!novo && texto != null && meta && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">Transcrição:</span>
              {ESTADOS.map((e) => <button key={e.id} onClick={() => gravar(mudarEstado(texto, e.id))} className={cn("rounded-full border px-2.5 py-0.5 text-xs", meta.transcricao === e.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{e.nome}</button>)}
              <span className="ml-auto text-xs text-muted-foreground">{status}</span>
            </div>
            <div className="flex gap-3">
              {meta.foto && <><div style={{ width: wFoto }} className="shrink-0"><div className="mb-1 text-xs text-muted-foreground">{meta.foto}</div><Foto nome={meta.foto} /></div>
                <ResizeHandle width={wFoto} setWidth={setWFoto} min={200} max={800} side="left" /></>}
              <textarea value={texto} onChange={(e) => gravar(e.target.value)} spellCheck={false} className="min-h-[360px] min-w-0 flex-1 rounded-lg border bg-background p-3 font-mono text-xs leading-6 outline-none" />
            </div>
            <Ocorrencia alunos={alunos} aulas={aulasDoDiario(texto)} onAdd={(n, aluno, t) => gravar(inserirOcorrencia(texto, n, aluno, t))} />
            {ocs.length > 0 && <div className="mt-3 text-xs text-muted-foreground">{ocs.length} ocorrência(s): {ocs.map((o, i) => <span key={i} className={cn("mr-2", ocultar && "blur-sm hover:blur-none")}>{o.aluno}</span>)}</div>}
          </>
        )}
        {!novo && texto == null && sel && <div className="text-sm text-muted-foreground">Lendo…</div>}
      </div>
    </div>
  );
}

function Ocorrencia({ alunos, aulas, onAdd }) {
  const [aluno, setAluno] = useState(""), [n, setN] = useState(1), [t, setT] = useState("");
  const ok = () => { if (aluno && t.trim()) { onAdd(n, aluno, t.trim()); setT(""); } };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm">
      <span className="font-medium">+ Ocorrência</span>
      <select value={aluno} onChange={(e) => setAluno(e.target.value)} className="rounded border bg-background px-2 py-1"><option value="">aluno…</option>{alunos.map((a) => <option key={a.path} value={a.name}>{a.name}</option>)}</select>
      <select value={n} onChange={(e) => setN(Number(e.target.value))} className="rounded border bg-background px-2 py-1">{aulas.map((a, i) => <option key={i} value={i + 1}>Aula {i + 1}</option>)}</select>
      <input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ok()} placeholder="o que aconteceu" className="min-w-[200px] flex-1 rounded border bg-background px-2 py-1" />
      <button onClick={ok} disabled={!aluno || !t.trim()} className="rounded-md bg-primary px-3 py-1 text-primary-foreground disabled:opacity-40">Adicionar</button>
      {!alunos.length && <span className="text-xs text-muted-foreground">Cadastre alunos na aba Alunos.</span>}
    </div>
  );
}

function NovoDiario({ turma, semanas, diarios, onOk, onCancel }) {
  const [i, setI] = useState(semanas.length - 1), [foto, setFoto] = useState("");
  const s = semanas[i];
  const aulas = (s?.turmas.filter((t) => turmasDe(t.turma).includes(turma)).flatMap((t) => t.aulas) ?? []).map((a) => a.texto.replace(/\*\*/g, ""));
  const ja = s && diarios.some((d) => d.name === `Diario ${turma} - ${s.rotulo}`);
  return (
    <div className="mb-4 rounded-xl border p-4 text-sm">
      <div className="mb-2 font-medium">Novo diário — turma {turma}</div>
      {!semanas.length ? <div className="text-muted-foreground">Crie antes uma semana na tela Semana: o diário usa as aulas dela.</div> : (
        <>
          <label className="mb-2 flex items-center gap-2">Semana
            <select value={i} onChange={(e) => setI(Number(e.target.value))} className="rounded border bg-background px-2 py-1">{semanas.map((x, k) => <option key={x.path} value={k}>{x.rotulo || x.name}</option>)}</select>
          </label>
          <div className="mb-2 text-xs text-muted-foreground">{aulas.length ? `${aulas.length} aula(s) desta turma na semana.` : "Esta turma não tem aulas na semana; o diário começa vazio."}</div>
          <label className="mb-3 flex items-center gap-2">Foto do caderno (opcional)
            <input value={foto} onChange={(e) => setFoto(e.target.value)} placeholder="nome-do-arquivo.jpg" className="w-64 rounded border bg-background px-2 py-1" />
          </label>
          {ja && <div className="mb-2 text-xs text-amber-700">já existe um diário desta turma para esta semana</div>}
        </>
      )}
      <div className="flex gap-3">
        <button disabled={!s || ja} onClick={() => onOk(s.rotulo || s.name, aulas, foto.trim())} className="rounded-md bg-primary px-3 py-1 text-primary-foreground disabled:opacity-40">Criar</button>
        <button onClick={onCancel} className="text-muted-foreground hover:underline">Cancelar</button>
      </div>
    </div>
  );
}

function Alunos({ items, turma, ano, alunos, diarios, ocultar, onOpen, onRefresh, falha, focoSel }) {
  const [wLista, setWLista] = useWidth("alunos.lista", 260);
  const [nome, setNome] = useState("");
  const [sel, setSel] = useState(focoSel ?? null);
  useEffect(() => { if (focoSel) setSel(focoSel); }, [focoSel]);
  const [ocs, setOcs] = useState([]);
  useEffect(() => {
    let vivo = true;
    Promise.all(diarios.map(async (d) => { const t = await invoke("read_note", { path: d.path }); return ocorrenciasDoDiario(t).map((o) => ({ ...o, diario: d, semana: lerMeta(t).semana })); }))
      .then((l) => vivo && setOcs(l.flat())).catch(falha);
    return () => { vivo = false; };
  }, [diarios.map((d) => d.path).join("|")]);
  const doAluno = (a) => ocs.filter((o) => o.aluno.toLowerCase() === a.name.toLowerCase());
  const atual = alunos.find((a) => a.path === sel);
  const resumo = (a) => doAluno(a).map((o) => `${o.semana} (${o.aula.replace(/ — .*/, "")}): ${o.texto}`).join("\n");
  const add = async () => { if (!nome.trim()) return; try { await criarAluno(items, { ano, turma, nome: nome.trim() }); setNome(""); await onRefresh(); } catch (e) { falha(e); } };

  return (
    <div className="flex gap-3">
      <div style={{ width: wLista }} className="shrink-0">
        <div className="mb-2 flex gap-2">
          <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Novo aluno" className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm" />
          <button onClick={add} className="rounded-md bg-primary px-3 text-sm text-primary-foreground">+</button>
        </div>
        <div className="flex flex-col gap-1">
          {alunos.map((a) => (
            <button key={a.path} onClick={() => setSel(a.path)} className={cn("flex items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm", a.path === sel ? "bg-accent" : "hover:bg-accent/50")}>
              <span className={cn(ocultar && "blur-sm hover:blur-none")}>{a.name}</span>
              <span className="text-xs text-muted-foreground">{doAluno(a).length || ""}</span>
            </button>
          ))}
          {!alunos.length && <div className="text-xs text-muted-foreground">Nenhum aluno cadastrado nesta turma.</div>}
        </div>
      </div>
      <ResizeHandle width={wLista} setWidth={setWLista} min={180} max={440} side="left" />
      <div className="min-w-0 flex-1">
        {atual ? (
          <>
            <div className="mb-2 flex items-center gap-3">
              <h2 className={cn("font-serif text-2xl font-semibold", ocultar && "blur-sm hover:blur-none")}>{atual.name}</h2>
              <button onClick={() => onOpen(atual.path)} className="text-xs text-primary hover:underline">abrir nota</button>
              <button onClick={() => navigator.clipboard?.writeText(resumo(atual))} className="text-xs text-primary hover:underline">copiar resumo (Conselho de Classe)</button>
            </div>
            {doAluno(atual).length === 0 && <div className="text-sm text-muted-foreground">Nenhuma ocorrência nos diários.</div>}
            <div className="flex flex-col gap-2">
              {doAluno(atual).map((o, i) => (
                <div key={i} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="text-xs text-muted-foreground">{o.semana} · {o.aula.replace(/ — .*/, "")}</div>
                  <div>{o.texto}</div>
                </div>
              ))}
            </div>
          </>
        ) : <div className="text-sm text-muted-foreground">Escolha um aluno para ver as ocorrências reunidas dos diários.</div>}
      </div>
    </div>
  );
}
