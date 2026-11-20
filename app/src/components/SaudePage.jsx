import { useEffect, useMemo, useState } from "react";
import { invoke } from "@/lib/api";
import { cn } from "@/lib/utils";
import { setProp } from "@/lib/frontmatter";
import { planejar, CODIGOS_AUTOMATICOS } from "@/lib/saudeAcoes";
import { Estado, Erro, Vazio, useToast } from "@/components/ui/estado";
import { ehModelo, lerModelos, secoesFaltando, TIPOS_MODELO } from "@/lib/modelos";

const CODIGOS = {
  "sem-tipo": "Arquivos sem tipo", "tipo-desconhecido": "Tipo desconhecido", "campo-vazio": "Campos vazios ou ausentes", "campo-obsoleto": "Campos obsoletos",
  "modelo-sem-secao": "Modelos sem seção obrigatória", "link-quebrado": "Links quebrados", "ancora-quebrada": "Âncoras quebradas", "marca-pendente": "Marcas de transcrição pendentes", "valor-invalido": "Valores inválidos",
  "conteudo-desconhecido": "Conteúdos fora do vocabulário", "aguardando-revisao": "Transcrições aguardando revisão", "total-diverge": "Total diverge da soma",
  "nota-fora-da-rubrica": "Nota fora da rubrica", "sem-recuperacao": "Ciclo sem recuperação", "data-invalida": "Datas inválidas", "aula-sem-recurso": "Aulas sem recurso", yaml: "Frontmatter inválido", "arquivo-ilegivel": "Arquivos que não são UTF-8 (ignorados)", "nome-repetido": "Notas com nome repetido",
};
const COR = { erro: "text-err", aviso: "text-warn", info: "text-muted-foreground" };

export function SaudePage({ items, onOpen, onRefresh }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const toast = useToast();
  const [filtro, setFiltro] = useState("");
  const [aberto, setAberto] = useState({});
  const [comInfo, setComInfo] = useState(false); // avisos de nível "info" ficam escondidos até pedir
  const [valores, setValores] = useState({});
  const [planos, setPlanos] = useState({}); // k do aviso → { rotulo } (correção automática possível), calculado ao abrir o grupo
  const [lote, setLote] = useState(null); // { code, itens: [{ x, it, rotulo }] } à espera de confirmação
  const [aplicando, setAplicando] = useState(false);
  // As notas-modelo (_sistema/modelos) têm marcadores e campos vazios de propósito: ficam fora dos avisos comuns,
  // e ganham um só aviso próprio, o de faltar uma seção que o app espera na nota criada.
  const carregar = async () => {
    try {
      const l = await invoke("vault_health"), nomes = new Set(items.filter((i) => ehModelo(i.rel)).map((i) => i.name));
      const modelos = await lerModelos(items).catch(() => []);
      const proprios = modelos.flatMap((m) => secoesFaltando(m.texto, m.tipo).map((sec) => ({ note: m.name, line: 1, code: "modelo-sem-secao", severity: "aviso", msg: `modelo de ${TIPOS_MODELO[m.tipo].rotulo.toLowerCase()}: falta a seção «${sec}»` })));
      setPlanos({}); setLote(null); setLista([...l.filter((x) => !nomes.has(x.note)), ...proprios]);
    } catch (e) { setErro(String(e)); }
  };
  useEffect(() => { carregar(); }, []);

  const porNome = useMemo(() => { const m = new Map(); for (const i of items) if (!m.has(i.name)) m.set(i.name, i); return m; }, [items]);
  const grupos = useMemo(() => {
    const f = filtro.trim().toLowerCase(), g = {};
    for (const x of lista ?? []) {
      if (!comInfo && x.severity === "info") continue;
      if (f && !(`${x.note} ${x.msg}`.toLowerCase().includes(f))) continue;
      (g[x.code] ??= []).push(x);
    }
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length);
  }, [lista, filtro, comInfo]);

  // Ao abrir um grupo com correção automática, vê (sem gravar) o que cada aviso mudaria.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const novos = {};
      for (const [code, xs] of grupos) {
        if (!aberto[code] || !CODIGOS_AUTOMATICOS.has(code)) continue;
        for (let i = 0; i < Math.min(xs.length, 200); i++) {
          const x = xs[i], it = porNome.get(x.note), k = code + i + x.note;
          if (!it || planos[k] !== undefined) continue;
          try { const p = planejar(x, it, await invoke("read_note", { path: it.path })); novos[k] = p ? { rotulo: p.rotulo } : null; } catch { novos[k] = null; }
        }
      }
      if (vivo && Object.keys(novos).length) setPlanos((o) => ({ ...o, ...novos }));
    })();
    return () => { vivo = false; };
  }, [grupos, aberto]);

  if (erro) return <Erro>Erro: {erro}</Erro>;
  if (!lista) return <div className="p-8 text-sm text-muted-foreground">Verificando o vault…</div>;

  const dizer = (t) => toast(t, { tipo: "ok", ms: 3000 });
  const editar = async (it, fn) => {
    try { const t = await invoke("read_note", { path: it.path }); await invoke("save_note", { path: it.path, text: fn(t) }); await carregar(); dizer("Corrigido"); }
    catch (e) { setErro(String(e)); }
  };
  const criarLink = async (it, alvo) => {
    try { const dir = it.path.slice(0, it.path.lastIndexOf("/")); await invoke("create_note", { dir, name: alvo }); await onRefresh(); await carregar(); dizer(`Nota “${alvo}” criada ao lado de ${it.name}`); }
    catch (e) { setErro(String(e)); }
  };

  // Correção em lote: primeiro mostra o que mudaria (simulação), só grava depois de confirmar. Cada nota ganha uma versão no Histórico.
  const prever = async (code, xs) => {
    const itens = [], vistos = new Set();
    for (const x of xs) {
      const it = porNome.get(x.note);
      if (!it || vistos.has(it.path)) continue;
      try { const p = planejar(x, it, await invoke("read_note", { path: it.path })); if (p) { vistos.add(it.path); itens.push({ x, it, rotulo: p.rotulo }); } } catch { /* nota ilegível: fica de fora */ }
    }
    setLote({ code, itens });
  };
  const aplicarLote = async () => {
    setAplicando(true);
    let feitas = 0, falhas = 0;
    for (const { x, it } of lote.itens) {
      try {
        const t = await invoke("read_note", { path: it.path }), p = planejar(x, it, t); // lê de novo: a nota pode ter mudado desde a simulação
        if (p) { await invoke("save_note", { path: it.path, text: p.novo }); feitas++; }
      } catch { falhas++; }
    }
    setAplicando(false);
    await carregar();
    toast(`${feitas} nota(s) corrigida(s)${falhas ? `, ${falhas} falha(s)` : ""}. Dá para voltar pelo Histórico da nota.`, { tipo: falhas ? "warn" : "ok", ms: 5000 });
  };

  function Acao({ x, it, k }) {
    if (!it) return null;
    if (CODIGOS_AUTOMATICOS.has(x.code)) {
      const p = planos[k];
      return p ? <button onClick={() => editar(it, (tx) => planejar(x, it, tx)?.novo ?? tx)} className="text-primary hover:underline">corrigir: {p.rotulo}</button> : null;
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

  const visiveis = lista.filter((x) => comInfo || x.severity !== "info"), infos = lista.length - visiveis.length;
  const total = visiveis.length, erros = visiveis.filter((x) => x.severity === "erro").length;
  return (
    <div className="min-h-0 flex-1 overflow-auto p-8">
      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h1 className="font-serif text-3xl font-semibold">Saúde do vault</h1>
        <span className="text-xs text-muted-foreground">{total} aviso(s){erros ? `, ${erros} erro(s)` : ""} · {new Set(visiveis.map((x) => x.code)).size} tipos de problema</span>
        <div className="flex-1" />
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por arquivo ou texto" aria-label="Filtrar avisos" className="w-56 rounded border bg-background px-2 py-1 text-sm" />
        {(infos > 0 || comInfo) && <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={comInfo} onChange={(e) => setComInfo(e.target.checked)} />Mostrar observações{!comInfo && ` (${infos})`}</label>}
        <button onClick={() => { setLista(null); carregar(); }} className="rounded-md border px-3 py-1 text-xs hover:bg-accent">Verificar de novo</button>
      </div>
      <div className="mb-5 text-xs text-muted-foreground">Cada grupo é um tipo de problema; clique no nome do arquivo para abrir na linha. As correções rápidas mexem só no frontmatter ou criam notas vazias; "Corrigir todos…" mostra o que mudaria antes de gravar, e cada nota ganha uma versão no Histórico.</div>

      {grupos.length === 0 && <Vazio titulo={filtro ? "Nenhum aviso para este filtro" : "Nenhum aviso"}>{filtro ? "Tente outro trecho do nome do arquivo ou do texto." : "O vault não tem problemas a corrigir."}</Vazio>}
      <div className="flex flex-col gap-3">
        {grupos.map(([code, xs]) => (
          <div key={code} className="rounded-xl border">
            <div className="flex items-center gap-3 px-4 py-2.5">
              <button onClick={() => setAberto({ ...aberto, [code]: !aberto[code] })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="w-5 text-muted-foreground">{aberto[code] ? "▾" : "▸"}</span>
                <span className="font-medium">{CODIGOS[code] ?? code}</span>
                <span className={cn("rounded-full bg-muted px-2 text-xs", COR[xs[0].severity])}>{xs.length}</span>
                <span className="text-xs text-muted-foreground">{{ erro: "erro", aviso: "aviso", info: "observação" }[xs[0].severity] ?? xs[0].severity}</span>
              </button>
              {CODIGOS_AUTOMATICOS.has(code) && <button onClick={() => prever(code, xs)} disabled={aplicando} className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50">Corrigir todos…</button>}
            </div>
            {lote?.code === code && (
              <div className="border-t bg-muted/40 px-4 py-3 text-xs">
                {lote.itens.length === 0
                  ? <p className="text-muted-foreground">Nenhum destes avisos tem correção automática segura; corrija à mão (clique no nome do arquivo).</p>
                  : <>
                    <p className="mb-1.5 font-medium">{lote.itens.length} nota(s) mudariam (nada foi gravado ainda):</p>
                    <ul className="mb-2 max-h-40 overflow-auto text-muted-foreground">
                      {lote.itens.slice(0, 30).map(({ it, rotulo }) => <li key={it.path}><span className="font-medium text-foreground">{it.name}</span> → {rotulo}</li>)}
                      {lote.itens.length > 30 && <li>… e mais {lote.itens.length - 30}</li>}
                    </ul>
                  </>}
                <div className="flex gap-2">
                  {lote.itens.length > 0 && <button onClick={aplicarLote} disabled={aplicando} className="rounded-md bg-primary px-3 py-1 text-primary-foreground disabled:opacity-60">{aplicando ? "Corrigindo…" : `Aplicar em ${lote.itens.length} nota(s)`}</button>}
                  <button onClick={() => setLote(null)} disabled={aplicando} className="rounded-md border px-3 py-1 hover:bg-accent">{lote.itens.length ? "Cancelar" : "Fechar"}</button>
                </div>
              </div>
            )}
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

    </div>
  );
}
