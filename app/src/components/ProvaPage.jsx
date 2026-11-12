import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { AtividadeDialog } from "@/components/AtividadeDialog";
import { useConfigProva } from "@/lib/useConfigProva";
import { PADRAO } from "@/lib/configProva";
import { listaBancos, lerBanco, verificar, provaEmMarkdown, sugerir, fonteDoTexto, paragrafos, gabarito, salvarProva, docxBlob, imprimir, definirLimite, LIMITE_PADRAO } from "@/lib/prova";

export function ProvaPage({ items, onOpen, onRefresh, textoInicial, onUsouTexto }) {
  const [wBanco, setWBanco] = useWidth("prova.banco", 440), [wVerif, setWVerif] = useWidth("prova.verificacao", 300);
  const bancos = listaBancos(items);
  const [path, setPath] = useState(bancos[0]?.path ?? null);
  const [b, setB] = useState(null);
  const [erro, setErro] = useState("");
  const [sel, setSel] = useState(new Set());
  const [msg, setMsg] = useState("");
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
    setB(null); setSel(new Set()); setMsg("");
    lerBanco(it).then(setB).catch((e) => setErro(String(e)));
  }, [path, items.length]);

  useEffect(() => {
    if (!b || !fonte) { setFontes({}); return; }
    Promise.all(b.textos.map(async (t) => [t.n, await fonteDoTexto(items, t.titulo).catch(() => null)])).then((l) => setFontes(Object.fromEntries(l.filter((x) => x[1]))));
  }, [b, fonte]);

  if (!bancos.length) return <div className="p-8 text-sm text-muted-foreground">Nenhum banco em Acervo/Questoes.</div>;
  if (erro) return <div className="p-8 text-sm text-destructive">Erro: {erro}</div>;
  if (!b) return <div className="p-8 text-sm text-muted-foreground">Lendo o banco…</div>;

  const toggle = (n) => setSel((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const v = verificar(b, sel);
  let num = 0;
  const norm = (x) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const passa = (q, extra = "") => !filtro.trim() || norm(`${q.corpo} ${q.assunto ?? ""} ${q.categoria ?? ""} ${q.formato} ${extra}`).includes(norm(filtro.trim()));
  const ps = () => paragrafos(b, sel, fontes, { turma: dados.turma });
  const baixar = (nome, blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const nomeArq = (x) => `${x} ${dados.turma || b.nome}.docx`;
  const dizer = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };
  const gravar = async () => {
    if (!/^\d{2}$/.test(dados.turma)) return dizer("Informe a turma com 2 dígitos (ex.: 81)");
    try { const p = await salvarProva(items, b, sel, { ...dados, valor: Number(dados.valor) || 10 }, fontes); dizer("Prova salva como nota"); onRefresh?.(); onOpen(p); } catch (e) { dizer("Erro: " + e); }
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(provaEmMarkdown(b, sel)); setMsg("Prova copiada (Markdown)"); } catch { setMsg("Não deu para copiar"); } };
  const Q = ({ q, rot }) => (
    <li className="flex gap-2.5 border-b py-2">
      <input type="checkbox" checked={sel.has(q.n)} onChange={() => toggle(q.n)} aria-label={`Questão ${q.rotulo ?? q.n}`} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">Questão {q.rotulo ?? q.n} · {rot}</div>
        <div className="truncate">{q.corpo.split("\n")[0]}</div>
      </div>
    </li>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {ativ && <AtividadeDialog items={items} banco={b} textoInicial={textoInicial} onClose={() => { setAtiv(false); onUsouTexto?.(); }}
        onDone={(n) => { setAtiv(false); onUsouTexto?.(); dizer(`${n} questão(ões) inseridas no banco`); const it = bancos.find((x) => x.path === path); if (it) lerBanco(it).then(setB); }} />}
      <div className="flex h-11 shrink-0 items-center gap-3 border-b px-4 text-xs">
        <select value={path} onChange={(e) => setPath(e.target.value)} className="max-w-md truncate rounded-md border bg-background px-2 py-1">
          {bancos.map((x) => <option key={x.path} value={x.path}>{x.name}</option>)}
        </select>
        <span className="truncate text-muted-foreground">{b.titulo}</span>
        <div className="flex-1" />
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        <MenuAcoes itens={[
          { rotulo: "Abrir banco como nota", fn: () => onOpen(b.path) },
          { rotulo: "Atividade de um texto", fn: () => setAtiv(true), dica: "Monta o pedido para o Claude e insere as questões no banco" },
          { rotulo: "Sugerir questões", fn: () => setSel(sugerir(b)), dica: "2 de interpretação, 2 de conteúdo e 6 independentes, sem conteúdos excluídos" },
          { rotulo: "Limpar seleção", fn: () => setSel(new Set()), off: !sel.size },
          { rotulo: "Copiar (Markdown)", fn: copiar, off: !sel.size },
          { rotulo: "Baixar DOCX", fn: async () => baixar(nomeArq("Prova"), await docxBlob(ps(), opcExport())), off: !sel.size },
          { rotulo: "PDF / imprimir", fn: () => imprimir(ps(), "Prova", opcExport()), off: !sel.size },
          { rotulo: "Baixar gabarito", fn: async () => baixar(nomeArq("Gabarito"), await docxBlob(gabarito(b, sel))), off: !sel.size },
        ]} />
        <button onClick={gravar} disabled={!sel.size} className="rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-40">Salvar como nota</button>
      </div>

      <div className="flex min-h-0 flex-1">
        <section aria-label="Banco de questões" style={{ width: wBanco }} className="flex shrink-0 flex-col">
          <div className="border-b px-5 py-3">
            <div className="mb-2 text-xs font-medium">Banco de questões · {b.ano}º ano</div>
            <div className="mb-1.5 text-xs text-muted-foreground">Conteúdos excluídos</div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {b.excluidos.length ? b.excluidos.map((e) => <span key={e} className="rounded-full bg-red-100 px-2.5 py-0.5 text-red-800 dark:bg-red-950 dark:text-red-200">{e} ✕</span>) : <span className="text-muted-foreground">nenhum</span>}
            </div>
          </div>
          <div className="border-b px-5 py-2"><input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por conteúdo (ex.: crase, sujeito)" aria-label="Filtrar questões" className="w-full rounded border bg-background px-2 py-1 text-xs outline-none" /></div>
          <div className="min-h-0 flex-1 overflow-auto px-5 py-1.5 text-xs">
            {b.textos.filter((t) => t.questoes.some((q) => passa(q, t.titulo))).map((t) => (
              <div key={t.n}>
                <div className="pb-1.5 pt-3"><div className="text-xs text-muted-foreground">Texto {t.n} · {t.genero}</div><div className="font-serif text-sm font-semibold">{t.titulo}</div></div>
                <ul>{t.questoes.filter((q) => passa(q, t.titulo)).map((q) => <Q key={q.n} q={q} rot={`${q.categoria} · ${q.formato}`} />)}</ul>
              </div>
            ))}
            <div className="mt-3 border-t pb-1.5 pt-3 text-xs text-muted-foreground">Questões independentes</div>
            <ul>{b.independentes.filter((q) => passa(q)).map((q) => <Q key={q.n} q={q} rot={q.assunto} />)}</ul>
          </div>
        </section>
        <ResizeHandle width={wBanco} setWidth={setWBanco} min={300} max={720} side="left" />
        <section aria-label="Prévia da prova" className="flex min-w-0 flex-1 justify-center overflow-auto bg-muted p-6">
          <div className="w-[560px] shrink-0 self-start bg-white p-9 font-serif text-[#1F1D1A] shadow" style={{ minHeight: 792 }}>
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
        </section>
        <ResizeHandle width={wVerif} setWidth={setWVerif} min={220} max={520} side="right" />
        <aside aria-label="Verificação" style={{ width: wVerif }} className="flex shrink-0 flex-col">
          <div className="flex h-11 shrink-0 items-center border-b px-5 text-xs font-medium">Verificação</div>
          <ul className="px-5 py-2 text-xs">
            {v.itens.map((i) => (
              <li key={i.rotulo} className="flex items-baseline gap-2.5 border-b py-2.5">
                {i.ok ? <Check className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-green-700" /> : <X className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-amber-600" />}
                <span className="flex-1">{i.rotulo}</span><span className="text-muted-foreground">{i.info}</span>
              </li>
            ))}
          </ul>
          {v.textosUsados.filter((t) => t.aviso).map((t) => (
            <div key={t.n} className="mx-5 mt-2 rounded-lg bg-amber-100 p-3 text-xs leading-relaxed text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              <div className="mb-0.5 font-semibold">Atenção · Texto {t.n}</div>{t.aviso}
            </div>
          ))}
          <div className="mx-5 mt-3 grid grid-cols-2 gap-2 text-xs">
            <label>Turma<input value={dados.turma} onChange={(e) => setDados({ ...dados, turma: e.target.value })} placeholder="81" className="mt-0.5 w-full rounded border bg-background px-2 py-1" /></label>
            <label>Data<input type="date" value={dados.data} onChange={(e) => setDados({ ...dados, data: e.target.value })} className="mt-0.5 w-full rounded border bg-background px-2 py-1" /></label>
            <label>Valor<input type="number" value={dados.valor} onChange={(e) => setDados({ ...dados, valor: e.target.value })} className="mt-0.5 w-full rounded border bg-background px-2 py-1" /></label>
            <label>Linhas por folha<input type="number" value={limite} onChange={(e) => setLimite(Number(e.target.value) || LIMITE_PADRAO)} className="mt-0.5 w-full rounded border bg-background px-2 py-1" /></label>
          </div>
          <label className="mx-5 mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={cfg.duasColunas} onChange={(e) => mudarCfg({ ...cfg, duasColunas: e.target.checked })} />prova em duas colunas (DOCX e impressão)</label>
          <p className="mx-5 mt-1 text-xs text-muted-foreground">Cabeçalho da escola e logo: Configurações → Cabeçalho das provas.</p>
          <label className="mx-5 mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={fonte} onChange={(e) => setFonte(e.target.checked)} />incluir a fonte dos textos</label>
          <p className="mx-5 mt-3 text-xs text-muted-foreground">Regra do banco: 2 de interpretação e 2 de conteúdo do mesmo texto, mais 6 independentes. A checagem de excluídos e de folha é por palavras e estimativa de linhas.</p>
          <div className="flex-1" />
          <div className="border-t px-5 py-3.5 text-xs text-muted-foreground">{sel.size} questões selecionadas</div>
        </aside>
      </div>
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
      <button onClick={() => setAberto(!aberto)} aria-haspopup="menu" aria-expanded={aberto} className="flex items-center gap-1 rounded-md border px-3 py-1 hover:bg-accent">Ações<ChevronDown className="h-3.5 w-3.5" /></button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border bg-background p-1 shadow-lg">
          {itens.map((it) => (
            <button key={it.rotulo} role="menuitem" disabled={it.off} title={it.dica} onClick={() => { setAberto(false); it.fn(); }}
              className="block w-full rounded px-3 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent">{it.rotulo}</button>
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
