import { useEffect, useMemo, useState } from "react";
import { IconFolderSymlink as FolderInput, IconTag as Tag, IconTrash as Trash2, IconX as X, IconCircleDot as Situacao } from "@tabler/icons-react";
import { invoke } from "@/lib/api";
import { STATUS_LOTE, planejarStatus, planejarTag, limparTag } from "@/lib/lote";
import { cn } from "@/lib/utils";

/** Notas (não pastas) em que dá para mexer no frontmatter. */
export const editavel = (e) => e.tipo === "item" && !e.pathAcao && /\.md$/i.test(e.path ?? "");

/** Barra que aparece quando há mais de uma nota marcada (Ctrl/Shift+clique): mover, status, tag e excluir. */
export function LoteBarra({ marcadas, onMover, onAcao, onLimpar, podeMover, podeExcluir }) {
  const n = marcadas.length, tem = marcadas.some(editavel);
  const Botao = ({ onClick, Icone, children, perigo }) => (
    <button type="button" onClick={onClick} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm hover:bg-accent", perigo && "text-err")}><Icone aria-hidden className="h-4 w-4" strokeWidth={1.7} />{children}</button>
  );
  return (
    <div role="toolbar" aria-label="Ações em lote" onClick={(e) => e.stopPropagation()} className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm">
      <span className="mr-1 text-sm font-medium">{n} selecionad{n === 1 ? "a" : "as"}</span>
      {podeMover && <Botao Icone={FolderInput} onClick={onMover}>Mover para…</Botao>}
      {tem && <Botao Icone={Situacao} onClick={() => onAcao("status")}>Mudar status…</Botao>}
      {tem && <Botao Icone={Tag} onClick={() => onAcao("tag")}>Adicionar tag…</Botao>}
      {podeExcluir && <Botao Icone={Trash2} perigo onClick={() => onAcao("excluir")}>Excluir…</Botao>}
      <span className="flex-1" />
      <button type="button" onClick={onLimpar} aria-label="Limpar a seleção" title="Limpar a seleção (Esc)" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
    </div>
  );
}

/**
 * Diálogo das ações em lote que mexem no conteúdo: mostra primeiro o que mudaria em cada nota (nada é gravado)
 * e só grava ao confirmar. Status e tag guardam o texto original para o "Desfazer"; excluir manda para a .lixeira.
 */
export function LoteDialog({ tipo, alvos, nomeDe, caminhoDe, onClose, onFeito, onErro }) {
  const notas = useMemo(() => alvos.filter(editavel), [alvos]);
  const [textos, setTextos] = useState(null), [status, setStatus] = useState("finalizado"), [tag, setTag] = useState(""), [ocupado, setOcupado] = useState(false);
  useEffect(() => { const t = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", t); return () => window.removeEventListener("keydown", t); }, [onClose]);
  useEffect(() => {
    if (tipo === "excluir") return;
    let vivo = true;
    Promise.all(notas.map(async (e) => [e.path, await invoke("read_note", { path: e.path })])).then((r) => { if (vivo) setTextos(Object.fromEntries(r)); }).catch((e) => onErro(e));
    return () => { vivo = false; };
  }, [tipo, notas]); // eslint-disable-line react-hooks/exhaustive-deps
  const plano = (t) => (tipo === "status" ? planejarStatus(t, status) : planejarTag(t, tag));
  const linhas = tipo === "excluir"
    ? alvos.map((e) => ({ e, rotulo: e.tipo === "pasta" ? `pasta com ${e.n ?? 0} item(ns)` : "", novo: null }))
    : textos ? notas.map((e) => ({ e, ...plano(textos[e.path]) })) : [];
  const muda = linhas.filter((l) => l.novo !== null).length;

  const aplicar = async () => {
    setOcupado(true);
    try {
      if (tipo === "excluir") {
        for (const e of alvos) await invoke("delete_entry", { path: caminhoDe(e) });
        onFeito({ texto: `${alvos.length} excluída${alvos.length === 1 ? "" : "s"} (estão na .lixeira do vault)` });
        return;
      }
      const antes = [];
      for (const l of linhas) {
        if (l.novo === null) continue;
        const atual = await invoke("read_note", { path: l.e.path }), p = plano(atual); // lê de novo: a nota pode ter mudado desde a simulação
        if (p.novo === null) continue;
        await invoke("save_note", { path: l.e.path, text: p.novo }); antes.push([l.e.path, atual]);
      }
      onFeito({ texto: `${antes.length} nota${antes.length === 1 ? "" : "s"} alterada${antes.length === 1 ? "" : "s"}`, paths: antes.map((a) => a[0]),
        desfazer: async () => { for (const [path, texto] of antes) await invoke("save_note", { path, text: texto }); } });
    } catch (e) { onErro(e); } finally { setOcupado(false); }
  };

  const titulo = tipo === "status" ? "Mudar status" : tipo === "tag" ? "Adicionar tag" : "Excluir";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[10vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label={titulo} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="flex max-h-[76vh] w-[min(520px,94vw)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        <div className="border-b px-4 py-3"><h2 className="text-sm font-medium">{titulo} · {alvos.length} {alvos.length === 1 ? "item" : "itens"}</h2></div>
        {tipo === "status" && (
          <div role="radiogroup" aria-label="Novo status" className="flex flex-wrap gap-2 border-b px-4 py-3">
            {STATUS_LOTE.map((s) => <button key={s} role="radio" aria-checked={status === s} onClick={() => setStatus(s)} className={cn("h-8 rounded-full border px-3 text-sm", status === s ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:bg-accent")}>{s}</button>)}
          </div>
        )}
        {tipo === "tag" && (
          <div className="border-b px-4 py-3"><input autoFocus value={tag} onChange={(e) => setTag(e.target.value)} placeholder="nome da tag" aria-label="Tag"
            onKeyDown={(e) => { if (e.key === "Enter" && limparTag(tag) && muda && !ocupado) aplicar(); }} className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary" /></div>
        )}
        {tipo === "excluir" && <p className="border-b px-4 py-3 text-sm text-muted-foreground">Vão para a pasta .lixeira do vault e podem ser recuperadas de lá. Esta ação não tem “Desfazer”.</p>}
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {tipo !== "excluir" && !textos ? <p className="px-2 py-3 text-sm text-muted-foreground">Lendo as notas…</p>
            : linhas.map((l) => (
              <div key={l.e.id} className="flex items-baseline gap-3 rounded-md px-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{nomeDe(l.e)}</span>
                <span className={cn("shrink-0 text-xs", l.novo === null && tipo !== "excluir" ? "text-muted-foreground" : "text-foreground")}>{l.rotulo}</span>
              </div>))}
          {tipo !== "excluir" && alvos.length > notas.length && <p className="px-2 py-1.5 text-xs text-muted-foreground">{alvos.length - notas.length} pasta(s) ou item(ns) sem frontmatter ficam de fora.</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button onClick={onClose} className="h-8 rounded-md border px-3 text-sm hover:bg-accent">Cancelar</button>
          <button onClick={aplicar} disabled={ocupado || (tipo !== "excluir" && !muda)} className={cn("h-8 rounded-md px-3 text-sm text-primary-foreground disabled:opacity-50", tipo === "excluir" ? "bg-err" : "bg-primary")}>
            {ocupado ? "Aplicando…" : tipo === "excluir" ? `Excluir ${alvos.length}` : `Aplicar em ${muda} nota${muda === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
