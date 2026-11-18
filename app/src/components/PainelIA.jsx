// Aba "IA" do painel direito: conversa sobre a nota aberta. A IA só propõe; quem aplica é o usuário, no diálogo de diferenças.
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { parseFm } from "@/lib/frontmatter";
import { acoesPara } from "@/lib/iaAcoes";
import { htmlIA } from "@/lib/iaMarkdown";
import { iaConfigGravar, iaConfigLer, iaDisponivel, iaPrevia, iaTemChave } from "@/lib/ia";

/** Texto da resposta da IA, em Markdown renderizado (o HTML já sai escapado e sem links/imagens ativos). */
function TextoIA({ texto }) {
  const h = useMemo(() => htmlIA(texto), [texto]);
  return <div className="aula-md ia-md" dangerouslySetInnerHTML={{ __html: h }} />;
}

function Mensagem({ m, onVerProposta }) {
  if (m.papel === "usuario") return <div className="ml-6 self-end rounded-lg bg-accent px-3 py-2 text-sm whitespace-pre-wrap">{m.itens[0].texto}</div>;
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {m.itens.map((it, i) => it.tipo === "texto" ? <TextoIA key={i} texto={it.texto} />
        : it.tipo === "ferramenta" ? <p key={i} className="text-xs text-muted-foreground">⚙ {it.resumo}</p>
        : it.tipo === "aviso" ? <p key={i} role="status" className="rounded-md bg-warn/10 px-2 py-1 text-xs text-warn">{it.msg}</p>
        : it.tipo === "erro" ? <p key={i} role="alert" className="rounded-md bg-err/10 px-2 py-1 text-xs text-err">{it.msg}</p>
        : <div key={i} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
            <span className="min-w-0 flex-1 text-xs"><span className="font-medium">Proposta:</span> {it.resumo}{it.nova ? ` (nota nova: ${it.nova})` : ""}</span>
            <button onClick={() => onVerProposta(it.id)} className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">Ver diferenças</button>
          </div>)}
      {m.itens.length === 0 && <p className="text-xs text-muted-foreground">Pensando…</p>}
    </div>
  );
}

export function PainelIA({ ia, texto, getContexto, onVerProposta, onAbrirConfig }) {
  const [config, setConfig] = useState(null);
  const [chaves, setChaves] = useState({}); // id do provedor -> tem chave guardada
  const [entrada, setEntrada] = useState("");
  const [incluir, setIncluir] = useState(true);
  const [previa, setPrevia] = useState(null);
  const [aviso, setAviso] = useState("");
  const fim = useRef(null);
  useEffect(() => {
    if (!iaDisponivel) return;
    iaConfigLer().then(async (c) => {
      setConfig(c);
      const lista = await Promise.all(c.provedores.map(async (p) => [p.id, await iaTemChave(p.id).catch(() => false)]));
      setChaves(Object.fromEntries(lista));
    }).catch(() => {});
  }, []);
  useEffect(() => { fim.current?.scrollIntoView?.({ block: "end" }); }, [ia.msgs]);

  if (!iaDisponivel) return <p className="px-4 py-3 text-sm text-muted-foreground">A IA está disponível só no app (não no navegador).</p>;
  if (!config) return <p className="px-4 py-3 text-sm text-muted-foreground">Carregando…</p>;
  const sel = config.provedores.find((p) => p.id === config.provedor) ?? config.provedores[0];
  const pronto = (p) => !p.exige_chave || chaves[p.id];
  if (!config.ativa || !config.aceitou_aviso || !pronto(sel)) {
    return (
      <div className="flex flex-col gap-3 px-4 py-4 text-sm">
        <p className="font-medium">A IA está desligada.</p>
        <p className="text-muted-foreground">Ela só sugere alterações: nada é gravado sem você ver as diferenças e aprovar. Para ligar, aceite o aviso de privacidade e escolha um provedor (chave da API, ou um modelo local).</p>
        <button onClick={onAbrirConfig} className="self-start rounded-md border px-3 py-1.5 hover:bg-accent">Abrir Configurações</button>
      </div>
    );
  }
  const trocar = async (id) => {
    if (id === config.provedor) return;
    try { const novo = { ...config, provedor: id }; await iaConfigGravar(novo); setConfig(novo); ia.nova(); setAviso(""); } // outro provedor = conversa nova
    catch (e) { setAviso(String(e)); }
  };
  const tipo = parseFm(texto || "").entries.find((e) => e.key === "tipo")?.value;
  const enviar = (t, opts) => { setAviso(""); setEntrada(""); ia.enviar(t, { incluirNota: incluir, ...opts }); };
  const acao = (a) => {
    if (a.selecao && !getContexto()?.selecao?.trim()) { setAviso("Selecione um trecho no texto da nota primeiro."); return; }
    enviar(a.prompt);
  };
  const ver = async () => { if (previa !== null) { setPrevia(null); return; } try { setPrevia(await iaPrevia(incluir ? getContexto() : null)); } catch (e) { setPrevia({ aviso: String(e) }); } };
  const tecla = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!ia.ocupado && entrada.trim()) enviar(entrada); } };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-1 border-b px-3 py-2 text-xs">
        <label className="flex items-center gap-2 text-muted-foreground">Provedor
          <select value={sel.id} onChange={(e) => trocar(e.target.value)} disabled={ia.ocupado} aria-label="Provedor de IA" className="h-7 min-w-0 flex-1 rounded-md border bg-background px-1.5 text-foreground">
            {config.provedores.map((p) => <option key={p.id} value={p.id} disabled={!pronto(p)}>{p.rotulo}{p.local ? " · local" : ""}{!pronto(p) ? " (sem chave)" : ""}</option>)}
          </select></label>
        {sel.local && <p className="text-ok">Nada sai do computador: o modelo roda aqui.</p>}
        {!sel.suporta_ferramentas && <p className="text-muted-foreground">Sem ferramentas: só a nota aberta e a seleção; a IA responde no texto, sem propor alterações.</p>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 py-3">
        {ia.msgs.length === 0 && <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Converse sobre a nota aberta. A IA consulta o vault (sem dados de alunos) e propõe alterações para você aprovar.</p>
          {acoesPara(tipo).map((a) => <button key={a.id} disabled={ia.ocupado} onClick={() => acao(a)} className="rounded-md border px-3 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-50">{a.rotulo}</button>)}
        </div>}
        {ia.msgs.map((m, i) => <Mensagem key={i} m={m} onVerProposta={onVerProposta} />)}
        <div ref={fim} />
      </div>
      {aviso && <p role="status" className="px-3 pb-1 text-xs text-warn">{aviso}</p>}
      {previa !== null && <div className="mx-3 mb-2 max-h-40 overflow-auto rounded-md border bg-background p-2 text-xs">
        {previa.texto ? <pre className="whitespace-pre-wrap break-words font-mono">{previa.texto}</pre> : <p className="text-muted-foreground">{previa.aviso || "Nenhum conteúdo de nota é enviado (só a sua pergunta)."}</p>}
      </div>}
      <div className="flex flex-col gap-2 border-t px-3 py-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={incluir} onChange={(e) => { setIncluir(e.target.checked); setPrevia(null); }} />Incluir a nota aberta</label>
          <button onClick={ver} className="underline-offset-2 hover:underline">{previa !== null ? "Ocultar" : "Ver o que foi enviado"}</button>
          <span className="flex-1" />
          {ia.msgs.length > 0 && <button onClick={ia.nova} disabled={ia.ocupado} className="hover:text-foreground disabled:opacity-50">Nova conversa</button>}
        </div>
        <textarea value={entrada} onChange={(e) => setEntrada(e.target.value)} onKeyDown={tecla} rows={3} placeholder="Pergunte ou peça uma alteração…" aria-label="Pergunta para a IA"
          className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary" />
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs text-muted-foreground">{ia.uso ? `${ia.uso.entrada} entrada · ${ia.uso.saida} saída (tokens)` : ""}</span>
          {ia.ocupado
            ? <button onClick={ia.parar} className="rounded-md border px-3 py-1 text-sm hover:bg-accent">Parar</button>
            : <button onClick={() => enviar(entrada)} disabled={!entrada.trim()} className={cn("rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground", !entrada.trim() && "opacity-50")}>Enviar</button>}
        </div>
      </div>
    </div>
  );
}
