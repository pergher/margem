import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { invoke } from "@/lib/api";
import { parseBanco } from "@/lib/prova";
import { setProp } from "@/lib/frontmatter";
import { estrutura, corpoDe, novaQuestao, removerQuestao, novoTexto, definirExcluidos, assuntoDe, definirAssunto, trocarGabarito } from "@/lib/bancoEdit";
import { listaProvas } from "@/components/QuestoesPage";
import { TituloEditavel, EditorSecao, Abas } from "@/components/AulaDaNota";
import { Text } from "@/components/RightPanel";
import { Carregando, Erro } from "@/components/ui/estado";
import { cn } from "@/lib/utils";

const Selo = ({ children }) => <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{children}</span>;
const Dado = ({ nome, children, aviso }) => <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-muted-foreground">{nome}</span><span className={cn("text-right font-medium", aviso && "text-warn")}>{children}</span></div>;
const Botao = ({ children, className, ...p }) => <button {...p} className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-md border px-3 text-xs hover:bg-accent", className)}>{children}</button>;

/**
 * Um texto-base ou uma questão como no Live do Markdown: o próprio trecho do arquivo (título incluído) num editor sempre ativo.
 * Cada mudança volta para o lugar dele no arquivo; se o trecho ganhar ou perder um título de questão/texto, os cartões são refeitos.
 */
function Trecho({ tipo, idx, ler, aplicar, refazer, onLink, numeros, apagar, aberto }) {
  const est0 = useMemo(() => estrutura(ler()), []); // eslint-disable-line react-hooks/exhaustive-deps
  const lista = (e) => (tipo === "texto" ? e.textos : tipo === "extra" ? e.extras : e.questoes);
  const x0 = lista(est0)[idx];
  const ref = useRef(null);
  useEffect(() => { if (aberto) setTimeout(() => ref.current?.querySelector(".cm-content")?.focus(), 50); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!x0) return null;
  const mudou = (md) => {
    const est = estrutura(ler()), x = lista(est)[idx];
    if (!x) return;
    const corpo = md.replace(/\s+$/, "");
    const novo = [...est.L.slice(0, x.ini), ...corpo.split("\n"), ...est.L.slice(x.fim)].join("\n");
    const e2 = estrutura(novo);
    aplicar(novo);
    if (e2.textos.length !== est.textos.length || e2.questoes.length !== est.questoes.length || e2.extras.length !== est.extras.length) refazer();
  };
  return (
    <div ref={ref} className="banco-ed group relative rounded-xl border bg-background px-4 py-3 focus-within:border-primary/60">
      {apagar && <button onClick={apagar} aria-label="Excluir esta questão" title="Excluir esta questão" className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-muted-foreground opacity-0 hover:bg-accent hover:text-err focus:opacity-100 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>}
      <EditorSecao md={corpoDe(est0, { ini: x0.ini - 1, fim: x0.fim })} onChange={mudou} onSave={() => {}} onLink={onLink} numeros={numeros} linhaInicial={x0.ini} />
    </div>
  );
}

/** Visão de um banco de questões (Acervo/Questoes), no estilo da Aula: abas por texto-base, questões editáveis e os dados do banco na margem. */
export function BancoDaNota({ item, items, tick, onRename, onLink, numeros }) {
  const [t, setT] = useState(null), [erro, setErro] = useState(""), [aba, setAba] = useState(null), [provas, setProvas] = useState(null);
  const [versao, setVersao] = useState(0), [abrir, setAbrir] = useState(null);
  const texto = useRef(null), sujo = useRef(false), timer = useRef(null), caminho = useRef(item.path);
  caminho.current = item.path;
  const gravar = async () => {
    clearTimeout(timer.current);
    if (!sujo.current || texto.current == null) return;
    sujo.current = false;
    try { await invoke("save_note", { path: caminho.current, text: texto.current }); } catch (e) { setErro(String(e)); }
  };
  const gravarRef = useRef(gravar); gravarRef.current = gravar;
  useEffect(() => () => { gravarRef.current(); }, [item.path]); // ao sair, grava o que faltar
  useEffect(() => { setT(null); setErro(""); setAba(null); invoke("read_note", { path: item.path }).then((x) => { texto.current = x; setT(x); }).catch((e) => setErro(String(e))); }, [item.path, tick]);
  const ler = () => texto.current;
  /** Aplica um novo texto do arquivo (grava depois de uma pausa). `estrutural`: refaz os cartões (adicionar/excluir/renumerar). */
  const aplicar = (novo, estrutural) => {
    texto.current = novo; setT(novo); sujo.current = true;
    clearTimeout(timer.current); timer.current = setTimeout(gravar, 600);
    if (estrutural) setVersao((v) => v + 1);
  };
  const b = useMemo(() => (t == null ? null : parseBanco(t)), [t]);
  const est = useMemo(() => (t == null ? null : estrutura(t)), [t]);
  useEffect(() => {
    let vivo = true; setProvas(null);
    Promise.all(listaProvas(items ?? []).map((p) => invoke("read_note", { path: p.path }).then((x) => (new RegExp(`^Banco:\\s*\\[\\[${item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "mi").test(x) ? p.name : null)).catch(() => null)))
      .then((r) => vivo && setProvas(r.filter(Boolean)));
    return () => { vivo = false; };
  }, [items, item.name]);
  if (erro) return <Erro>{erro}</Erro>;
  if (!b) return <Carregando>Lendo o banco…</Carregando>;

  const nTextos = b.textos.length, nInd = b.independentes.length;
  const nQ = b.textos.reduce((s, x) => s + x.questoes.length, 0) + nInd;
  const todas = [...b.textos.flatMap((x) => x.questoes), ...b.independentes];
  const interp = todas.filter((q) => q.categoria === "Interpretação").length, cont = todas.filter((q) => q.categoria === "Conteúdo").length;
  // Abas na ordem do arquivo: textos-base, independentes, gabarito e qualquer outra seção `##`.
  const iInd = est.questoes.find((q) => q.grupo === "ind")?.ini ?? est.L.findIndex((l) => /^##\s+Questões independentes/.test(l));
  const abas = [
    ...b.textos.map((x) => ({ id: "t" + x.n, nome: `Texto ${x.n}`, texto: x, pos: est.textos.find((e) => e.n === x.n)?.ini ?? 0 })),
    { id: "ind", nome: "Independentes", pos: iInd >= 0 ? iInd : 1e9 },
    ...(est.gab ? [{ id: "gab", nome: "Gabarito", pos: est.gab.ini }] : []),
    ...est.extras.map((x, k) => ({ id: "x" + k, nome: x.nome, extra: k, pos: x.ini })),
  ].sort((p, q) => p.pos - q.pos);
  const atual = abas.find((x) => x.id === aba) ?? abas[0];
  const avisos = b.textos.filter((x) => x.aviso);
  const chaveDe = (q) => (est.blocos ? q.rotulo : String(q.n));
  const idxDe = (q) => est.questoes.findIndex((e) => e.chave === chaveDe(q));
  const refazer = () => setVersao((v) => v + 1);
  const cartao = (q) => {
    const chave = chaveDe(q);
    return <Trecho key={`${versao}:${chave}`} tipo="questao" idx={idxDe(q)} aberto={abrir === chave} ler={ler} aplicar={aplicar} refazer={refazer} onLink={onLink} numeros={numeros}
      apagar={() => { if (window.confirm(`Excluir a questão ${chave}? Isso também remove a linha dela no gabarito.`)) aplicar(removerQuestao(ler(), estrutura(ler()), chave), true); }} />;
  };
  const adicionar = (o) => { const r = novaQuestao(ler(), estrutura(ler()), o); setAbrir(r.chave); setAba(o.tipo === "ind" ? "ind" : "t" + o.texto); aplicar(r.text, true); };
  const adicionarTexto = () => { const r = novoTexto(ler(), estrutura(ler())); setAba("t" + r.n); aplicar(r.text, true); };
  const ano = b.ano || "";
  const mudarAno = (v) => aplicar(definirAssunto(setProp(ler(), "ano", v), assuntoDe(ler()), v));
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="grid items-stretch gap-x-10 px-8 py-8" style={{ gridTemplateColumns: "minmax(0, 48rem) minmax(15rem, 1fr)" }}>
        <div className="col-start-1 row-start-1 min-w-0">
          <div className="text-xs text-muted-foreground">Banco de questões</div>
          <TituloEditavel nome={item.name} onRename={onRename ? (n) => onRename(item.path, n) : null} rotulo="banco" />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {ano > 0 && <Selo>{ano}º ano</Selo>}<Selo>{nQ} questões</Selo><Selo>{nTextos} {nTextos === 1 ? "texto-base" : "textos-base"}</Selo>
          </div>
          <Abas rotulo="Partes do banco" abas={abas} atual={atual} onSelect={(x) => setAba(x.id)}
            extra={<button onClick={adicionarTexto} title="Novo texto-base" className="mb-1 ml-1 flex h-7 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" />Texto</button>} />
        </div>
        <div className="col-start-1 row-start-2 min-w-0 pt-6">
          <div className="space-y-4">
            {atual?.texto && (() => {
              const x = atual.texto, ti = est.textos.findIndex((e) => e.n === x.n);
              return (
                <>
                  <Trecho key={`${versao}:t${x.n}`} tipo="texto" idx={ti} ler={ler} aplicar={aplicar} refazer={refazer} onLink={onLink} numeros={numeros} />
                  {x.questoes.map(cartao)}
                  {!x.questoes.length && <p className="text-sm text-muted-foreground">Este texto ainda não tem questões.</p>}
                  <div className="flex flex-wrap gap-2">
                    <Botao onClick={() => adicionar({ tipo: "interp", texto: x.n })}><Plus className="h-3.5 w-3.5" />Questão de interpretação</Botao>
                    <Botao onClick={() => adicionar({ tipo: "cont", texto: x.n })}><Plus className="h-3.5 w-3.5" />Questão de conteúdo</Botao>
                  </div>
                </>
              );
            })()}
            {atual?.extra != null && <Trecho key={`${versao}:${atual.id}`} tipo="extra" idx={atual.extra} ler={ler} aplicar={aplicar} refazer={refazer} onLink={onLink} numeros={numeros} />}
            {atual?.id === "ind" && <>
              {b.independentes.map(cartao)}
              {!nInd && <p className="text-sm text-muted-foreground">Ainda não há questões independentes (sem texto-base).</p>}
              <Botao onClick={() => adicionar({ tipo: "ind" })}><Plus className="h-3.5 w-3.5" />Questão independente</Botao>
            </>}
            {atual?.id === "gab" && (
              <div className="banco-ed rounded-xl border bg-background px-4 py-3 focus-within:border-primary/60">
                <EditorSecao key={`${versao}:gab`} md={corpoDe(est, { ini: est.gab.ini - 1, fim: est.gab.fim })} onChange={(md) => aplicar(trocarGabarito(ler(), estrutura(ler()), md))} onSave={() => {}} onLink={onLink} numeros={numeros} linhaInicial={est.gab.ini} />
              </div>)}
            {!b.textos.length && atual?.id !== "ind" && atual?.id !== "gab" && <p className="text-sm text-muted-foreground">Este banco ainda não tem textos-base. Use “+ Texto” para começar.</p>}
          </div>
        </div>
        <aside aria-label="Margem" className="col-start-2 row-start-2 min-w-0 space-y-6 pt-6">
          {avisos.length > 0 && (
            <section className="flex flex-col gap-3 border-l-2 border-err pl-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Na margem</h2>
              {avisos.map((x) => <div key={x.n} className="text-sm"><b>Texto {x.n}: </b>{x.aviso}</div>)}
            </section>
          )}
          <section aria-label="Dados do banco" className="flex flex-col gap-2 border-l-2 border-border pl-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados do banco</h2>
            <label className="block text-xs text-muted-foreground">Assunto<Text value={assuntoDe(t)} onCommit={(v) => aplicar(definirAssunto(ler(), v, ano))} /></label>
            <label className="block text-xs text-muted-foreground">Ano
              <select value={String(ano)} onChange={(e) => mudarAno(e.target.value)} className="mt-0 h-7 w-full rounded-md border bg-background px-1.5 text-xs text-foreground">
                <option value="">—</option>{["6", "7", "8", "9"].map((x) => <option key={x} value={x}>{x}º ano</option>)}
              </select></label>
            <label className="block text-xs text-muted-foreground">Conteúdos excluídos (separe com “;”)<Text value={b.excluidos.join("; ")} onCommit={(v) => aplicar(definirExcluidos(ler(), v))} /></label>
            <div className="mt-1 flex flex-col gap-1.5">
              <Dado nome="Questões">{nQ}</Dado>
              <Dado nome="Textos-base">{nTextos}</Dado>
              {interp + cont > 0 && <Dado nome="Interpretação · Conteúdo">{interp} · {cont}</Dado>}
              <Dado nome="Independentes" aviso={!nInd}>{nInd}</Dado>
              <div className="text-sm"><span className="text-muted-foreground">Usado em</span>
                {provas == null ? <span className="ml-2">…</span> : provas.length
                  ? <ul className="mt-0.5 list-disc pl-5">{provas.map((n) => <li key={n}>{n}</li>)}</ul>
                  : <span className="float-right font-medium text-warn">nenhuma prova</span>}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
