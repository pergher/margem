import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { invoke } from "@/lib/api";
import { parseBanco } from "@/lib/prova";
import { parseFm, setProp } from "@/lib/frontmatter";
import { estrutura, corpoDe, novaQuestao, removerQuestao, novoTexto, definirExcluidos, assuntoDe, definirAssunto, trocarGabarito } from "@/lib/bancoEdit";
import { listaProvas } from "@/components/RecursosPage";
import { TituloEditavel, EditorSecao, Propriedades, Dado as DadoPainel, PainelShell, ConexoesComuns, TituloPainel, STATUS } from "@/components/AulaDaNota";
import { Text } from "@/components/RightPanel";
import { Carregando, Erro } from "@/components/ui/estado";
import { cn } from "@/lib/utils";

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
    <div ref={ref} className="banco-ed group relative">
      {apagar && <button onClick={apagar} aria-label="Excluir esta questão" title="Excluir esta questão" className="absolute right-0 top-0 z-10 rounded-md p-1.5 text-muted-foreground opacity-0 hover:bg-accent hover:text-err focus:opacity-100 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>}
      <EditorSecao md={corpoDe(est0, { ini: x0.ini - 1, fim: x0.fim })} onChange={mudou} onSave={() => {}} onLink={onLink} numeros={numeros} linhaInicial={x0.ini} />
    </div>
  );
}

/** Visão de um banco de questões (Acervo/Questoes), no estilo da Aula: abas por texto-base, questões editáveis e os dados do banco na margem. */
export function BancoDaNota({ item, items, tick, onRename, onLink, onOpen, numeros, info, painel, setPainel, onRestore, histTick }) {
  const [t, setT] = useState(null), [erro, setErro] = useState(""), [aba, setAba] = useState(null), [provas, setProvas] = useState(null);
  const [versao, setVersao] = useState(0), [abrir, setAbrir] = useState(null);
  const [abaPainel, setAbaPainel] = useState("ficha"), [vista, setVista] = useState(null), [prog, setProg] = useState(0), [slot, setSlot] = useState(null);
  const rolagem = useRef(null);
  useEffect(() => { setSlot(document.getElementById("slot-barra-aula")); }, []);
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
  useEffect(() => { setT(null); setErro(""); setAba(null); setVista(null); invoke("read_note", { path: item.path }).then((x) => { texto.current = x; setT(x); }).catch((e) => setErro(String(e))); }, [item.path, tick]);
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
  // Depois de criar um texto ou uma questão, rola até a parte onde ela nasceu.
  useEffect(() => { if (!aba) return; const id = setTimeout(() => { rolagem.current?.querySelector(`[data-sec="${aba}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); setAba(null); }, 80); return () => clearTimeout(id); }, [aba, versao]);
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
  const statusAtual = parseFm(t).entries.find((e) => e.key === "status")?.value ?? "";
  const statusLista = info?.status?.length ? info.status : STATUS;
  const mudarProp = (chave, valor) => (chave === "ano" ? mudarAno(valor) : aplicar(setProp(ler(), chave, valor)));
  const restaurar = (novo) => { onRestore?.(novo); texto.current = novo; setT(novo); setVersao((v) => v + 1); };
  // Destaque da parte atual ao rolar: a última cujo topo já passou da barra fixa.
  const aoRolar = () => {
    const r = rolagem.current; if (!r) return;
    setProg(r.scrollHeight > r.clientHeight ? r.scrollTop / (r.scrollHeight - r.clientHeight) : 0);
    const topo = r.getBoundingClientRect().top + 90, fim = r.scrollTop + r.clientHeight >= r.scrollHeight - 4;
    const els = [...r.querySelectorAll("[data-sec]")];
    const el = fim ? els[els.length - 1] : els.filter((e) => e.getBoundingClientRect().top <= topo).pop() ?? els[0];
    setVista(el?.dataset.sec ?? null);
  };
  const ir = (x) => { setVista(x.id); rolagem.current?.querySelector(`[data-sec="${x.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const verFicha = () => { setAbaPainel("ficha"); setPainel?.(true); };
  const atual = abas.find((x) => x.id === vista) ?? abas[0];
  const aoLado = b.textos.some((x) => x.aviso); // sem avisos, o conteúdo fica sozinho e centralizado (44rem, como na Aula)
  const largura = aoLado ? "60.5rem" : "44rem";
  const secao = (x, corpo, margem) => (
    <section key={x.id} data-sec={x.id} aria-label={x.nome} className={cn("scroll-mt-4 pb-10 first:pt-8 last:pb-4", aoLado && "grid items-start gap-x-10")} style={aoLado ? { gridTemplateColumns: "minmax(0, 44rem) 14rem" } : undefined}>
      <div className="min-w-0 space-y-4">{corpo}</div>
      {margem}
    </section>
  );
  const conteudo = (x) => {
    if (x.texto) {
      const tx = x.texto, ti = est.textos.findIndex((e) => e.n === tx.n);
      const aviso = tx.aviso ? <aside aria-label={`Na margem: Texto ${tx.n}`} className="min-w-0 pt-10"><div className="border-l-2 border-err pl-3 text-sm text-muted-foreground">{tx.aviso}</div></aside> : null;
      return secao(x, <>
        <Trecho key={`${versao}:t${tx.n}`} tipo="texto" idx={ti} ler={ler} aplicar={aplicar} refazer={refazer} onLink={onLink} numeros={numeros} />
        {tx.questoes.map(cartao)}
        {!tx.questoes.length && <p className="text-sm text-muted-foreground">Este texto ainda não tem questões.</p>}
        <div className="flex flex-wrap gap-2">
          <Botao onClick={() => adicionar({ tipo: "interp", texto: tx.n })}><Plus className="h-3.5 w-3.5" />Questão de interpretação</Botao>
          <Botao onClick={() => adicionar({ tipo: "cont", texto: tx.n })}><Plus className="h-3.5 w-3.5" />Questão de conteúdo</Botao>
        </div>
      </>, aviso);
    }
    if (x.extra != null) return secao(x, <Trecho key={`${versao}:${x.id}`} tipo="extra" idx={x.extra} ler={ler} aplicar={aplicar} refazer={refazer} onLink={onLink} numeros={numeros} />);
    if (x.id === "ind") return secao(x, <>
      <h2 className="font-serif text-xl font-semibold">Questões independentes</h2>
      {b.independentes.map(cartao)}
      {!nInd && <p className="text-sm text-muted-foreground">Ainda não há questões independentes (sem texto-base).</p>}
      <Botao onClick={() => adicionar({ tipo: "ind" })}><Plus className="h-3.5 w-3.5" />Questão independente</Botao>
    </>);
    return secao(x, (
      <div className="banco-ed">
        <EditorSecao key={`${versao}:gab`} md={corpoDe(est, { ini: est.gab.ini - 1, fim: est.gab.fim })} onChange={(md) => aplicar(trocarGabarito(ler(), estrutura(ler()), md))} onSave={() => {}} onLink={onLink} numeros={numeros} linhaInicial={est.gab.ini} />
      </div>));
  };
  const painelBanco = (
    <PainelShell rotulo="Painel do banco" aba={abaPainel} setAba={setAbaPainel} avisos={info?.issues?.length ?? 0}
      ficha={<>
        <section><TituloPainel>Propriedades</TituloPainel><Propriedades texto={t} onSet={mudarProp} status={statusLista} /></section>
        <section aria-label="Dados do banco" className="flex flex-col gap-2">
          <TituloPainel>Dados do banco</TituloPainel>
          <label className="block text-xs text-muted-foreground">Assunto<Text value={assuntoDe(t)} onCommit={(v) => aplicar(definirAssunto(ler(), v, ano))} /></label>
          <label className="block text-xs text-muted-foreground">Conteúdos excluídos (separe com “;”)<Text value={b.excluidos.join("; ")} onCommit={(v) => aplicar(definirExcluidos(ler(), v))} /></label>
          <div className="mt-1 flex flex-col gap-1.5">
            <DadoPainel nome="Questões">{nQ}</DadoPainel>
            <DadoPainel nome="Textos-base">{nTextos}</DadoPainel>
            {interp + cont > 0 && <DadoPainel nome="Interpretação · Conteúdo">{interp} · {cont}</DadoPainel>}
            <DadoPainel nome="Independentes" aviso={!nInd}>{nInd}</DadoPainel>
          </div>
        </section>
      </>}
      conexoes={<>
        <section><TituloPainel>Usado em</TituloPainel>
          {provas == null ? <p className="text-sm text-muted-foreground">…</p> : provas.length
            ? <ul className="list-disc pl-5 text-sm">{provas.map((n) => <li key={n}>{n}</li>)}</ul>
            : <p className="text-sm text-warn">Nenhuma prova usa este banco.</p>}
        </section>
        <ConexoesComuns info={info} onOpen={onOpen} path={item.path} texto={t} onRestore={restaurar} histTick={histTick} nome="banco" />
      </>} />
  );
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Sumário e botão "+ Texto" entram no cabeçalho do app, ao lado dos breadcrumbs; a linha fina abaixo mostra quanto do banco já foi lido */}
        {slot && createPortal(
          <>
            <nav aria-label="Sumário do banco" className="flex min-w-0 items-center gap-0.5 overflow-x-auto border-l pl-3">
              <div role="tablist" aria-label="Partes do banco" className="flex gap-0.5">
                {abas.map((x) => (
                  <button key={x.id} role="tab" aria-selected={atual === x} onClick={() => ir(x)}
                    className={cn("h-7 shrink-0 whitespace-nowrap rounded-md px-2.5 text-xs", atual === x ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{x.nome}</button>
                ))}
              </div>
            </nav>
            <div className="flex-1" />
            <button onClick={adicionarTexto} title="Novo texto-base" className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" />Texto</button>
          </>, slot)}
        <div role="progressbar" aria-label="Progresso de leitura" aria-valuenow={Math.round(prog * 100)} aria-valuemin={0} aria-valuemax={100} className="h-0.5 shrink-0 bg-border"><div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${prog * 100}%` }} /></div>
        <div ref={rolagem} onScroll={aoRolar} className="min-h-0 min-w-0 flex-1 overflow-auto">
          <div className="px-8 pt-8">
            <div className="mx-auto" style={{ maxWidth: largura }}>
              <div className="text-xs text-muted-foreground">Banco de questões</div>
              <TituloEditavel nome={item.name} onRename={onRename ? (n) => onRename(item.path, n) : null} rotulo="banco" />
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-accent py-0.5 pl-2.5 pr-2 text-xs font-medium text-foreground hover:bg-accent/70 focus-within:ring-2 focus-within:ring-ring" title="Clique para mudar o status">
                  <span className={cn("h-1.5 w-1.5 rounded-full", statusAtual === "finalizado" ? "bg-ok" : statusAtual ? "bg-warn" : "bg-muted-foreground")} />
                  {statusAtual || "sem status"}<ChevronDown className="h-3 w-3 text-muted-foreground" />
                  <select aria-label="Status do banco" value={statusAtual} onChange={(e) => mudarProp("status", e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
                    {!statusLista.includes(statusAtual) && <option value={statusAtual}>{statusAtual || "sem status"}</option>}
                    {statusLista.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                {ano > 0 && <span>{ano}º ano</span>}
                <span>{nQ} questões</span>
                <span>{nTextos} {nTextos === 1 ? "texto-base" : "textos-base"}</span>
                {provas != null && !provas.length && <span className="text-warn">nenhuma prova usa este banco</span>}
                <button onClick={verFicha} className="font-medium text-primary hover:underline">Ver ficha</button>
              </div>
            </div>
          </div>
          <div className="mx-auto px-8 pb-8 pt-4" style={{ maxWidth: `calc(${largura} + 4rem)` }}>
            {abas.map(conteudo)}
            {!b.textos.length && <p className="text-sm text-muted-foreground">Este banco ainda não tem textos-base. Use “+ Texto” para começar.</p>}
          </div>
        </div>
      </div>
      {painel && painelBanco}
    </div>
  );
}
