import { useEffect, useMemo, useState } from "react";
import { invoke } from "@/lib/api";
import { cn } from "@/lib/utils";
import { setProp } from "@/lib/frontmatter";
import { Estado, Erro } from "@/components/ui/estado";

const CODIGOS = {
  "sem-tipo": "Arquivos sem tipo", "tipo-desconhecido": "Tipo desconhecido", "campo-vazio": "Campos vazios ou ausentes", "campo-obsoleto": "Campos obsoletos",
  "link-quebrado": "Links quebrados", "ancora-quebrada": "Âncoras quebradas", "marca-pendente": "Marcas de transcrição pendentes", "valor-invalido": "Valores inválidos",
  "conteudo-desconhecido": "Conteúdos fora do vocabulário", "aguardando-revisao": "Transcrições aguardando revisão", "total-diverge": "Total diverge da soma",
  "nota-fora-da-rubrica": "Nota fora da rubrica", "sem-recuperacao": "Ciclo sem recuperação", "data-invalida": "Datas inválidas", "aula-sem-recurso": "Aulas sem recurso", yaml: "Frontmatter inválido",
};
const COR = { erro: "text-err", aviso: "text-warn", info: "text-muted-foreground" };

function tipoSugerido(rel, name) {
  if (/^Acervo\/Aulas\//.test(rel)) return "aula";
  if (/^Acervo\/Textos\//.test(rel)) return "texto";
  if (/^Acervo\/Questoes\//.test(rel)) return "banco";
  if (/\/Planejamento\//.test(rel)) return /^\d{3}\b/.test(name) ? "ciclo" : "plano";
  if (/\/Provas\//.test(rel)) return "prova";
  if (/\/Semanas\//.test(rel)) return "semana";
  if (/\/Correcoes\//.test(rel)) return "correcao";
  if (/\/Diarios\//.test(rel)) return "diario";
  if (/\/Alunos\//.test(rel)) return "aluno";
  return null;
}

export function SaudePage({ items, onOpen, onRefresh }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState("");
  const [aberto, setAberto] = useState({});
  const [valores, setValores] = useState({});
  const carregar = () => invoke("vault_health").then(setLista).catch((e) => setErro(String(e)));
  useEffect(() => { carregar(); }, []);

  const porNome = useMemo(() => { const m = new Map(); for (const i of items) if (!m.has(i.name)) m.set(i.name, i); return m; }, [items]);
  const grupos = useMemo(() => {
    const f = filtro.trim().toLowerCase(), g = {};
    for (const x of lista ?? []) {
      if (f && !(`${x.note} ${x.msg}`.toLowerCase().includes(f))) continue;
      (g[x.code] ??= []).push(x);
    }
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length);
  }, [lista, filtro]);

  if (erro) return <Erro>Erro: {erro}</Erro>;
  if (!lista) return <div className="p-8 text-sm text-muted-foreground">Verificando o vault…</div>;

  const dizer = (t) => { setAviso(t); setTimeout(() => setAviso(""), 3000); };
  const editar = async (it, fn) => {
    try { const t = await invoke("read_note", { path: it.path }); await invoke("save_note", { path: it.path, text: fn(t) }); await carregar(); dizer("Corrigido"); }
    catch (e) { setErro(String(e)); }
  };
  const criarLink = async (it, alvo) => {
    try { const dir = it.path.slice(0, it.path.lastIndexOf("/")); await invoke("create_note", { dir, name: alvo }); await onRefresh(); await carregar(); dizer(`Nota “${alvo}” criada ao lado de ${it.name}`); }
    catch (e) { setErro(String(e)); }
  };

  function Acao({ x, it, k }) {
    if (!it) return null;
    if (x.code === "sem-tipo") {
      const t = tipoSugerido(it.rel, it.name);
      return t ? <button onClick={() => editar(it, (tx) => setProp(tx, "tipo", t))} className="text-primary hover:underline">definir tipo: {t}</button> : null;
    }
    if (x.code === "campo-vazio") {
      const campo = /`([^`]+)`/.exec(x.msg)?.[1];
      if (!campo) return null;
      const ano = /^Anos\/(\d{4})\//.exec(it.rel)?.[1] ?? "";
      const v = valores[k] ?? (campo === "ano" ? ano : "");
      return <span className="flex items-center gap-1"><input value={v} onChange={(e) => setValores({ ...valores, [k]: e.target.value })} placeholder={campo} className="w-32 rounded border bg-background px-1.5 py-0.5 text-xs" />
        <button disabled={!v.trim()} onClick={() => editar(it, (tx) => setProp(tx, campo, v.trim()))} className="text-primary hover:underline disabled:opacity-40">gravar</button></span>;
    }
    if (x.code === "link-quebrado") {
      const alvo = /\[\[([^\]|#]+)/.exec(x.msg)?.[1]?.trim();
      return alvo ? <button onClick={() => criarLink(it, alvo)} className="text-primary hover:underline">criar o arquivo</button> : null;
    }
    return null;
  }

  const total = lista.length, erros = lista.filter((x) => x.severity === "erro").length;
  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h1 className="font-serif text-3xl font-semibold">Saúde do vault</h1>
        <span className="text-xs text-muted-foreground">{total} aviso(s){erros ? `, ${erros} erro(s)` : ""} · {lista.length ? Object.keys(Object.fromEntries(lista.map((x) => [x.code, 1]))).length : 0} tipos de problema</span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{aviso}</span>
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por arquivo ou texto" aria-label="Filtrar avisos" className="w-56 rounded border bg-background px-2 py-1 text-sm" />
        <button onClick={() => { setLista(null); carregar(); }} className="rounded-md border px-3 py-1 text-xs hover:bg-accent">Verificar de novo</button>
      </div>
      <div className="mb-5 text-xs text-muted-foreground">Cada grupo é um tipo de problema; clique no nome do arquivo para abrir na linha. As correções rápidas mexem só no frontmatter ou criam notas vazias (reversível pela lixeira .lixeira).</div>

      {grupos.length === 0 && <div className="rounded-xl bg-muted p-4 text-sm">Nenhum aviso{filtro ? " para este filtro" : ""}. 🎉</div>}
      <div className="flex flex-col gap-3">
        {grupos.map(([code, xs]) => (
          <div key={code} className="rounded-xl border">
            <button onClick={() => setAberto({ ...aberto, [code]: !aberto[code] })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
              <span className="w-5 text-muted-foreground">{aberto[code] ? "▾" : "▸"}</span>
              <span className="font-medium">{CODIGOS[code] ?? code}</span>
              <span className={cn("rounded-full bg-muted px-2 text-xs", COR[xs[0].severity])}>{xs.length}</span>
              <span className="text-xs text-muted-foreground">{xs[0].severity}</span>
            </button>
            {aberto[code] && (
              <ul className="border-t px-4 py-1 text-xs">
                {xs.slice(0, 200).map((x, i) => {
                  const it = porNome.get(x.note), k = code + i + x.note;
                  return (
                    <li key={k} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b py-1.5 last:border-0">
                      {it ? <button onClick={() => onOpen(it.path)} className="font-medium hover:underline">{x.note}<span className="font-normal text-muted-foreground">:{x.line}</span></button> : <span className="font-medium">{x.note}:{x.line}</span>}
                      <span className="min-w-0 flex-1 text-muted-foreground">{x.msg}</span>
                      <Acao x={x} it={it} k={k} />
                    </li>
                  );
                })}
                {xs.length > 200 && <li className="py-2 text-xs text-muted-foreground">… e mais {xs.length - 200}; use o filtro.</li>}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-muted p-4 text-xs">
        <div className="mb-1 font-semibold">Aplicar no vault real (sempre com simulação e cópia antes)</div>
        <div className="leading-7 text-muted-foreground">
          1. Copie a pasta do vault (ex.: <code>cp -r Escola Escola-antes</code>). 2. Simule: <code>vault reorganizar &lt;pasta&gt;</code> e <code>vault migrar &lt;pasta&gt;</code> (sem <code>--aplicar</code> só mostram o que mudaria).
          3. Confira o resultado e só então rode com <code>--aplicar</code>. 4. Volte aqui e clique em “Verificar de novo”.
        </div>
      </div>
    </div>
  );
}
