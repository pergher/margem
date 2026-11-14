import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { AtividadeDialog } from "@/components/AtividadeDialog";
import { useConfigProva } from "@/lib/useConfigProva";
import { PADRAO } from "@/lib/configProva";
import { listaBancos, lerBanco, verificar, provaEmMarkdown, sugerir, fonteDoTexto, paragrafos, gabarito, salvarProva, docxBlob, imprimir, definirLimite, LIMITE_PADRAO } from "@/lib/prova";
import { Estado, Carregando, Erro, Vazio, useToast } from "@/components/ui/estado";

export function ProvaPage({ items, onOpen, onRefresh, textoInicial, onUsouTexto, bancoInicial, onVoltar }) {
  const [wBanco, setWBanco] = useWidth("prova.banco", 460);
  const bancos = listaBancos(items);
  const [path, setPath] = useState(bancos.find((x) => x.path === bancoInicial)?.path ?? bancos[0]?.path ?? null);
  const [b, setB] = useState(null);
  const [erro, setErro] = useState("");
  const [sel, setSel] = useState(new Set());
  const toast = useToast();
  const [filtro, setFiltro] = useState("");
  const [ativ, setAtiv] = useState(false);
  useEffect(() => { if (textoInicial) setAtiv(true); }, [textoInicial]);
  const [fonte, setFonte] = useState(false);
  const [fontes, setFontes] = useState({});
  const [dados, setDados] = useState({ turma: "", data: new Date().toISOString().slice(0, 10), valor: 10 });
  const { cfg: cfgLida, mudar: mudarCfg } = useConfigProva(items); // a nota nova aparece na árvore no próximo refresh (não recarrega o banco agora)
  const cfg = cfgLida ?? PADRAO;
  const limite = cfg.limiteLinhas || LIMITE_PADRAO;
  definirLimite(limite);
  const setLimite = (n) => mudarCfg({ ...cfg, limiteLinhas: n === LIMITE_PADRAO ? 0 : n });
  const opcExport = () => ({ cabecalho: { escola: cfg.escola, linha2: cfg.linha2, logo: cfg.logo }, colunas: cfg.duasColunas ? 2 : 1 });

  useEffect(() => {
    const it = bancos.find((x) => x.path === path);
    if (!it) return;
    setB(null); setSel(new Set());
    lerBanco(it).then(setB).catch((e) => setErro(String(e)));
  }, [path, items.length]);

  useEffect(() => {
    if (!b || !fonte) { setFontes({}); return; }
    Promise.all(b.textos.map(async (t) => [t.n, await fonteDoTexto(items, t.titulo).catch(() => null)])).then((l) => setFontes(Object.fromEntries(l.filter((x) => x[1]))));
  }, [b, fonte]);

  if (!bancos.length) return <Vazio titulo="Nenhum banco de questões">Os bancos ficam em Acervo/Questoes. Quando houver um, você monta a prova aqui.</Vazio>;
  if (erro) return <Erro>Erro: {erro}</Erro>;
  if (!b) return <Carregando>Lendo o banco…</Carregando>;

  const toggle = (n) => setSel((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const v = verificar(b, sel);
  let num = 0;
  const norm = (x) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const passa = (q, extra = "") => !filtro.trim() || norm(`${q.corpo} ${q.assunto ?? ""} ${q.categoria ?? ""} ${q.formato} ${extra}`).includes(norm(filtro.trim()));
  const ps = () => paragrafos(b, sel, fontes, { turma: dados.turma });
  const baixar = (nome, blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const nomeArq = (x) => `${x} ${dados.turma || b.nome}.docx`;
  const dizer = (t, tipo = "ok") => toast(t, { tipo, ms: 3000 });
  const gravar = async () => {
    if (!/^\d{2}$/.test(dados.turma)) return dizer("Informe a turma com 2 dígitos (ex.: 81)", "warn");
    try { const p = await salvarProva(items, b, sel, { ...dados, valor: Number(dados.valor) || 10 }, fontes); dizer("Prova salva como arquivo"); onRefresh?.(); onOpen(p); } catch (e) { dizer("Erro: " + e, "err"); }
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(provaEmMarkdown(b, sel)); dizer("Prova copiada (Markdown)"); } catch { dizer("Não deu para copiar", "err"); } };
  const numeros = new Map(); let k = 0; // número da questão na prova, na mesma ordem da prévia
  v.textosUsados.forEach((t) => t.questoes.filter((q) => sel.has(q.n)).forEach((q) => numeros.set(q.n, ++k)));
  b.independentes.filter((q) => sel.has(q.n)).forEach((q) => numeros.set(q.n, ++k));
  const itemQ = (q, rot) => { // função (não componente): assim a lista não é remontada a cada seleção e a rolagem não pula
    const on = sel.has(q.n), [enun, ...resto] = q.corpo.split("\n");
    return (
      <li key={q.n} className="border-b last:border-b-0">
        <label onClick={(e) => { e.preventDefault(); toggle(q.n); }} /* sem a ativação nativa do label o checkbox escondido não recebe foco, e o navegador não rola a página até ele */ className={`relative block cursor-pointer -ml-[2px] border-l-2 py-3 pl-4 pr-10 transition-colors focus-within:bg-accent/50 ${on ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent/40"}`}>
          <input type="checkbox" checked={on} readOnly aria-label={`Questão ${q.rotulo ?? q.n}`} className="sr-only" />
          <span aria-hidden className={`absolute right-2 top-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${on ? "bg-primary text-primary-foreground" : "border border-dashed text-transparent"}`}>{on ? numeros.get(q.n) : ""}</span>
          <div className="text-sm text-muted-foreground">Questão {q.rotulo ?? q.n} · {rot}</div>
          <div className="mt-1 text-[17px] leading-relaxed">{enun}</div>
          {on && resto.length > 0 && <div className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{resto.join("\n")}</div>}
        </label>
      </li>
    );
  };

  const rotuloQ = (n) => n === 1 ? "questão" : "questões";
  const campo = "mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary";

  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className="flex min-h-full flex-col gap-4 px-8 py-8">
      {ativ && <AtividadeDialog items={items} banco={b} textoInicial={textoInicial} onClose={() => { setAtiv(false); onUsouTexto?.(); }}
        onDone={(n) => { setAtiv(false); onUsouTexto?.(); dizer(`${n} questão(ões) inseridas no banco`); const it = bancos.find((x) => x.path === path); if (it) lerBanco(it).then(setB); }} />}

      <header className="flex shrink-0 flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          {onVoltar && <button onClick={onVoltar} className="mb-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Banco de questões e provas</button>}
          <h1 className="font-serif text-3xl font-semibold leading-tight">Montar prova</h1>
          <p className="mt-1 text-sm text-muted-foreground">{b.ano}º ano · {sel.size} {rotuloQ(sel.size)} {sel.size === 1 ? "selecionada" : "selecionadas"}</p>
        </div>
        <Detalhes>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label>Turma<input value={dados.turma} onChange={(e) => setDados({ ...dados, turma: e.target.value })} placeholder="81" className={campo} /></label>
            <label>Data<input type="date" value={dados.data} onChange={(e) => setDados({ ...dados, data: e.target.value })} className={campo} /></label>
            <label>Valor<input type="number" value={dados.valor} onChange={(e) => setDados({ ...dados, valor: e.target.value })} className={campo} /></label>
            <label>Linhas por folha<input type="number" value={limite} onChange={(e) => setLimite(Number(e.target.value) || LIMITE_PADRAO)} className={campo} /></label>
          </div>
          <div className="mt-3 flex flex-col gap-1.5 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.duasColunas} onChange={(e) => mudarCfg({ ...cfg, duasColunas: e.target.checked })} className="accent-[hsl(var(--primary))]" />Prova em duas colunas</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={fonte} onChange={(e) => setFonte(e.target.checked)} className="accent-[hsl(var(--primary))]" />Incluir a fonte dos textos</label>
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">Cabeçalho da escola e logo: Configurações → Cabeçalho das provas.</p>
        </Detalhes>
        <MenuAcoes itens={[
          { rotulo: "Abrir banco no editor", fn: () => onOpen(b.path) },
          { rotulo: "Atividade de um texto", fn: () => setAtiv(true), dica: "Monta o pedido para o Claude e insere as questões no banco" },
          { rotulo: "Sugerir questões", fn: () => setSel(sugerir(b)), dica: "2 de interpretação, 2 de conteúdo e 6 independentes, sem conteúdos excluídos" },
          { rotulo: "Limpar seleção", fn: () => setSel(new Set()), off: !sel.size },
          { rotulo: "Copiar (Markdown)", fn: copiar, off: !sel.size },
          { rotulo: "Baixar DOCX", fn: async () => baixar(nomeArq("Prova"), await docxBlob(ps(), opcExport())), off: !sel.size },
          { rotulo: "PDF / imprimir", fn: () => imprimir(ps(), "Prova", opcExport()), off: !sel.size },
          { rotulo: "Baixar gabarito", fn: async () => baixar(nomeArq("Gabarito"), await docxBlob(gabarito(b, sel))), off: !sel.size },
        ]} />
        <button onClick={gravar} disabled={!sel.size} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-40">Salvar como arquivo</button>
      </header>

      <div className="flex">
        <section aria-label="Banco de questões" style={{ width: wBanco }} className="flex shrink-0 flex-col gap-3 self-start pr-5">
          <div className="flex items-center gap-2">
            <select value={path} onChange={(e) => setPath(e.target.value)} aria-label="Banco de questões" className="h-10 min-w-0 flex-1 truncate rounded-md border bg-background px-3 text-sm">
              {bancos.map((x) => <option key={x.path} value={x.path}>{x.name}</option>)}
            </select>
          </div>
          <label className="flex h-10 shrink-0 items-center gap-2 rounded-full border bg-background px-4 text-sm text-muted-foreground focus-within:border-primary">
            <Search aria-hidden className="h-4 w-4 shrink-0" />
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por conteúdo (ex.: crase, sujeito)" aria-label="Filtrar questões" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
            {filtro && <button onClick={() => setFiltro("")} aria-label="Limpar filtro" className="hover:text-foreground"><X className="h-4 w-4" /></button>}
          </label>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Conteúdos excluídos</span>
            {b.excluidos.length ? b.excluidos.map((e) => <span key={e} className="rounded-full bg-err/15 px-2.5 py-0.5 text-err">{e}</span>) : <span className="text-muted-foreground">nenhum</span>}
          </div>
          <div className="text-xs">
            {b.textos.filter((t) => t.questoes.some((q) => passa(q, t.titulo))).map((t) => (
              <div key={t.n}>
                <div className="pb-1.5 pt-3"><div className="text-xs text-muted-foreground">Texto {t.n} · {t.genero}</div><div className="font-serif text-sm font-semibold">{t.titulo}</div></div>
                <ul className="ml-1.5 border-l-2 border-foreground/15">{t.questoes.filter((q) => passa(q, t.titulo)).map((q) => itemQ(q, `${q.categoria} · ${q.formato}`))}</ul>
              </div>
            ))}
            <div className="mt-3 border-t pb-1.5 pt-3 text-xs text-muted-foreground">Questões independentes</div>
            <ul className="ml-1.5 border-l-2 border-foreground/15">{b.independentes.filter((q) => passa(q)).map((q) => itemQ(q, q.assunto))}</ul>
          </div>
        </section>
        <ResizeHandle width={wBanco} setWidth={setWBanco} min={300} max={720} side="left" />

        <section aria-label="Prova" className="sticky top-4 flex min-w-0 flex-1 flex-col gap-3 self-start pl-5">
          <div aria-label="Prévia da prova" className="flex max-h-[calc(100vh-8.5rem)] justify-center overflow-auto rounded-lg bg-muted p-6">
            <div className="w-[560px] max-w-full shrink-0 self-start bg-white p-9 font-serif text-[#1F1D1A] shadow" style={{ minHeight: 792 }}>
              {cfg.logo && <img src={cfg.logo} alt="" className="mx-auto mb-1 h-12" />}
              {cfg.escola && <div className="text-center text-[11px] font-semibold">{cfg.escola}</div>}
              {cfg.linha2 && <div className="mb-1 text-center text-[10px]">{cfg.linha2}</div>}
              <div className="mb-2 flex items-baseline justify-between border-b border-[#1F1D1A] pb-1.5"><div className="text-[13px] font-semibold">Prova de Língua Portuguesa · {b.ano}º ano</div><div className="font-sans text-[9px] text-neutral-500">1 folha</div></div>
              <div className="mb-3 flex gap-4 font-sans text-[9px] text-neutral-600"><span className="flex-1 border-b border-neutral-400">Nome:</span><span className="w-16 border-b border-neutral-400">Turma:</span><span className="w-16 border-b border-neutral-400">Data:</span></div>
              {!sel.size && <p className="font-sans text-xs text-neutral-500">Marque questões no banco para montar a prova.</p>}
              <div style={cfg.duasColunas ? { columnCount: 2, columnGap: 20, columnRule: "1px solid #d4d4d4" } : undefined}>
              {v.textosUsados.map((t) => (
                <div key={t.n}>
                  <div className="mb-2 rounded bg-[#F6F4F0] p-2.5">
                    <div className="mb-1 font-sans text-[8.5px] text-neutral-500">Texto {t.n} · {t.titulo}{fontes[t.n] ? ` — ${fontes[t.n]}` : ""}</div>
                    <div className="whitespace-pre-line text-[9px] leading-snug">{t.citacao.split("\n").slice(0, 10).join("\n")}</div>
                  </div>
                  {t.questoes.filter((q) => sel.has(q.n)).map((q) => <Folha key={q.n} q={q} n={++num} />)}
                </div>
              ))}
              {b.independentes.some((q) => sel.has(q.n)) && <div className="mb-1.5 mt-2 border-t pt-1 font-sans text-[8.5px] text-neutral-500">Questões independentes</div>}
              {b.independentes.filter((q) => sel.has(q.n)).map((q) => <Folha key={q.n} q={q} n={++num} />)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div></div>
  );
}

function Detalhes({ children }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (!ref.current?.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAberto(!aberto)} aria-haspopup="dialog" aria-expanded={aberto} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent"><SlidersHorizontal className="h-4 w-4" />Detalhes</button>
      {aberto && <div role="dialog" aria-label="Detalhes da prova" className="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border bg-background p-4 shadow-lg">{children}</div>}
    </div>
  );
}

function MenuAcoes({ itens }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (!ref.current?.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAberto(!aberto)} aria-haspopup="menu" aria-expanded={aberto} className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent">Ações<ChevronDown className="h-3.5 w-3.5" /></button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border bg-background p-1 shadow-lg">
          {itens.map((it) => (
            <button key={it.rotulo} role="menuitem" disabled={it.off} title={it.dica} onClick={() => { setAberto(false); it.fn(); }}
              className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent">{it.rotulo}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Folha({ q, n }) {
  const [primeira, ...resto] = q.corpo.split("\n");
  return (
    <div className="mb-2 text-[10px] leading-snug">
      <div><b>{n}.</b> {primeira}</div>
      {resto.map((l, i) => <div key={i} className="whitespace-pre-line">{l}</div>)}
      {Array.from({ length: q.linhasResposta }).map((_, i) => <div key={i} className="h-[11px] border-b border-dotted border-neutral-400" />)}
    </div>
  );
}
