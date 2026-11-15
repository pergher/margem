import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { lerSemanas, rotuloDe } from "@/lib/semana";
import { ESTADOS, listarDiarios, listarAlunos, lerMeta, criarDiario, criarAluno, inserirOcorrencia, mudarEstado, ocorrenciasDoDiario, aulasDoDiario, turmasDe } from "@/lib/diario";
import { Estado, Vazio } from "@/components/ui/estado";

// "2026-09-21" -> "21 a 25 de setembro"; rótulos que não são datas ficam como estão.
const dataLegivel = (t) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((t ?? "").trim()); return m ? rotuloDe(new Date(+m[1], +m[2] - 1, +m[3])).replace(/ de ([A-Za-zçÇ]+)/g, (x) => x.toLowerCase()) : t; };

// "Paulo Pergher" -> "Pa. Pe." (duas letras do primeiro e do último nome)
const abreviar = (nome) => { const p = nome.trim().split(/\s+/); return (p.length > 1 ? [p[0], p[p.length - 1]] : p).map((x) => x.slice(0, 2) + ".").join(" "); };

const Aba = ({ on, children, ...p }) => <button {...p} className={cn("rounded-md px-3 py-1 text-sm", on ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}>{children}</button>;

export function DiarioPage({ items, onOpen, onMarkdown, onRefresh, focoPath }) {
  // focoPath: abre já na nota de diário ou de aluno escolhida (visão personalizada da nota).
  const foco = focoPath ? items.find((i) => i.path === focoPath) : null;
  const ehAluno = !!foco && /^Anos\/\d{4}\/Alunos\//.test(foco.rel);
  const [aba, setAba] = useState(ehAluno ? "alunos" : "diario");
  const [turma, setTurma] = useState(foco ? foco.rel.split("/")[3] : "");
  useEffect(() => { if (foco) { setAba(ehAluno ? "alunos" : "diario"); setTurma(foco.rel.split("/")[3]); } }, [focoPath]);
  const [ocultar, setOcultar] = useState(true); // nomes de alunos abreviados (Pa. Pe.)
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
      <div className="mb-4 text-xs text-muted-foreground">Dados sensíveis: o Claude não tem acesso ao diário nem às fichas de alunos.</div>
      {erro && <Estado tipo="err" className="mb-3 text-sm">Erro: {erro} <button className="underline" onClick={() => setErro("")}>ok</button></Estado>}
      {!turma ? <Vazio titulo="Nenhuma turma encontrada ainda">Crie uma semana ou um aluno e a turma aparece aqui.</Vazio>
        : aba === "diario"
          ? <Diarios items={items} turma={turma} ano={ano} diarios={diarios.filter((d) => d.turma === turma)} semanas={semanas} onRefresh={onRefresh} onEditar={onMarkdown ?? onOpen} falha={falha} />
          : <Alunos items={items} turma={turma} ano={ano} alunos={alunos.filter((a) => a.turma === turma)} diarios={diarios.filter((d) => d.turma === turma)} ocultar={ocultar} onOpen={onOpen} onRefresh={onRefresh} falha={falha} focoSel={focoPath} />}
    </div>
  );
}

function Diarios({ items, turma, ano, diarios, semanas, onRefresh, onEditar, falha }) {
  const [novo, setNovo] = useState(false);
  if (novo) return <NovoDiario turma={turma} semanas={semanas} diarios={diarios} onCancel={() => setNovo(false)}
    onOk={async (semana, aulas, foto) => { try { const p = await criarDiario(items, { ano, turma, semana, aulas, foto }); setNovo(false); await onRefresh(); onEditar(p); } catch (e) { falha(e); } }} />;
  return <ListaDiarios diarios={diarios} falha={falha} onEditar={onEditar} onNovo={() => setNovo(true)} />;
}

// Lista simples: data da semana + o que foi trabalhado em cada aula (sem as ocorrências de alunos).
function trabalhoDasAulas(texto) {
  const linhas = texto.split("\n"), semana = lerMeta(texto).semana;
  return aulasDoDiario(texto).map((a) => {
    const [, tema = ""] = a.titulo.split(/\s+—\s+/);
    const corpo = linhas.slice(a.ini + 1, a.fim).filter((l) => l.trim() && !/^\s*-\s+\[\[/.test(l)).map((l) => l.replace(/^Dado:\s*/, "").trim()).filter(Boolean).join(" ");
    return { semana, aula: a.titulo.replace(/\s+—.*/, ""), tema, corpo };
  });
}

function ListaDiarios({ diarios, onEditar, onNovo, falha }) {
  const [itens, setItens] = useState(null);
  useEffect(() => {
    let vivo = true;
    Promise.all(diarios.map(async (d) => ({ d, aulas: trabalhoDasAulas(await invoke("read_note", { path: d.path })) })))
      .then((l) => vivo && setItens(l)).catch(falha);
    return () => { vivo = false; };
  }, [diarios.map((d) => d.path).join("|")]);
  return (
    <div>
      <button onClick={onNovo} className="mb-4 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:text-foreground">+ Novo diário</button>
      {itens == null && <div className="text-sm text-muted-foreground">Lendo…</div>}
      {itens?.length === 0 && <div className="text-sm text-muted-foreground">Nenhum diário desta turma.</div>}
      <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
        {itens?.slice().reverse().flatMap(({ d, aulas }) => aulas.map((a, i) => (
          <div key={d.path + i} className="group rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{dataLegivel(a.semana)} · {a.aula}</span>
              <button onClick={() => onEditar(d.path)} className="ml-auto text-primary opacity-0 hover:underline group-hover:opacity-100">editar (Markdown)</button>
            </div>
            <div>{[a.tema, a.corpo].filter(Boolean).join(" — ")}</div>
          </div>
        )))}
      </div>
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
          {ja && <Estado tipo="warn" className="mb-2 text-xs">já existe um diário desta turma para esta semana</Estado>}
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
  const [busca, setBusca] = useState("");
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
        <input value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar aluno" placeholder="Buscar aluno…" className="mb-2 w-full rounded border bg-background px-2 py-1 text-sm" />
        <div className="flex flex-col gap-1">
          {alunos.filter((a) => a.path === sel || (ocultar ? abreviar(a.name) : a.name).toLowerCase().includes(busca.trim().toLowerCase())).map((a) => (
            <button key={a.path} onClick={() => setSel(a.path)} className={cn("flex items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm", a.path === sel ? "bg-accent" : "hover:bg-accent/50")}>
              <span>{ocultar ? abreviar(a.name) : a.name}</span>
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
              <h2 className="font-serif text-2xl font-semibold">{ocultar ? abreviar(atual.name) : atual.name}</h2>
              <button onClick={() => onOpen(atual.path)} className="text-xs text-primary hover:underline">abrir no editor</button>
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
