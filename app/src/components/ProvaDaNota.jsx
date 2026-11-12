import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { invoke } from "@/lib/api";
import { parseFm, setProp } from "@/lib/frontmatter";
import { lerBanco, verificar, paragrafos, gabarito, docxBlob, imprimir, fonteDoTexto, definirLimite, LIMITE_PADRAO } from "@/lib/prova";
import { useConfigProva } from "@/lib/useConfigProva";

/** Visão de uma nota `tipo: prova` (Anos/AAAA/Provas): a prova montada a partir do banco citado, com exportação e edição de turma/data/valor. */
export function ProvaDaNota({ item, items, onOpen, tick }) {
  const [texto, setTexto] = useState(null);
  const [b, setB] = useState(null);
  const [erro, setErro] = useState("");
  const [fonte, setFonte] = useState(false);
  const [fontes, setFontes] = useState({});
  const timer = useRef(null);
  const { cfg } = useConfigProva(items);
  const limite = cfg?.limiteLinhas || LIMITE_PADRAO;
  definirLimite(limite);

  useEffect(() => {
    setTexto(null); setB(null); setErro("");
    invoke("read_note", { path: item.path }).then(setTexto).catch((e) => setErro(String(e)));
  }, [item.path, tick]);

  const fm = texto ? parseFm(texto) : null;
  const get = (k) => fm?.entries.find((e) => e.key === k);
  const nomeBanco = texto ? /^Banco:\s*\[\[([^\]|#]+)/m.exec(texto)?.[1]?.trim() : null;
  const bancoItem = nomeBanco ? items.find((i) => i.name.toLowerCase() === nomeBanco.toLowerCase()) : null;
  useEffect(() => {
    if (!bancoItem) return;
    lerBanco(bancoItem).then(setB).catch((e) => setErro(String(e)));
  }, [bancoItem?.path]);
  useEffect(() => {
    if (!b || !fonte) { setFontes({}); return; }
    Promise.all(b.textos.map(async (t) => [t.n, await fonteDoTexto(items, t.titulo).catch(() => null)])).then((l) => setFontes(Object.fromEntries(l.filter((x) => x[1]))));
  }, [b, fonte]);

  if (erro) return <div className="p-8 text-sm text-destructive">{erro}</div>;
  if (!texto) return <div className="p-8 text-sm text-muted-foreground">Lendo a prova…</div>;
  if (!nomeBanco || !bancoItem) return <div className="p-8 text-sm text-muted-foreground">Esta nota não cita um banco de questões existente (linha <code>Banco: [[nome]]</code>). Use “1. Markdown” para ver o texto.</div>;
  if (!b) return <div className="p-8 text-sm text-muted-foreground">Lendo o banco…</div>;

  const sel = new Set((get("questoes")?.items ?? []).map(Number).filter(Number.isFinite));
  const dados = { turma: get("turma")?.value ?? "", data: get("data")?.value ?? "", valor: get("valor")?.value ?? "" };
  const v = verificar(b, sel);
  const ps = paragrafos(b, sel, fontes, { turma: dados.turma });
  const opc = { cabecalho: cfg ? { escola: cfg.escola, linha2: cfg.linha2, logo: cfg.logo } : {}, colunas: cfg?.duasColunas ? 2 : 1 };
  const baixar = (nome, blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const arq = (x) => `${x} ${dados.turma || item.name}.docx`;
  // Edita só a linha do frontmatter; grava depois de uma pausa.
  const mudar = (k, valor) => {
    let t = setProp(texto, k, valor);
    if (k === "turma") t = t.replace(/^turma:.*$/m, `turma: "${valor.replace(/"/g, "")}"`); // turma é sempre texto
    setTexto(t); clearTimeout(timer.current);
    timer.current = setTimeout(() => invoke("save_note", { path: item.path, text: t }).catch((e) => setErro(String(e))), 600);
  };
  const campo = "mt-0.5 w-full rounded border bg-background px-2 py-1";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b px-4 text-[13px]">
        <span className="font-medium">Prova {dados.turma} · {dados.data}</span>
        <span className="text-muted-foreground">banco: <button onClick={() => onOpen(bancoItem.path)} className="text-primary hover:underline">{bancoItem.name}</button></span>
        <div className="flex-1" />
        <button onClick={async () => baixar(arq("Prova"), await docxBlob(ps, opc))} className="rounded-md border px-3 py-1 hover:bg-accent">DOCX</button>
        <button onClick={() => imprimir(ps, "Prova", opc)} className="rounded-md border px-3 py-1 hover:bg-accent">PDF / imprimir</button>
        <button onClick={async () => baixar(arq("Gabarito"), await docxBlob(gabarito(b, sel)))} className="rounded-md border px-3 py-1 hover:bg-accent">Gabarito</button>
      </div>
      <div className="flex min-h-0 flex-1">
        <section aria-label="Prévia da prova" className="flex min-w-0 flex-1 justify-center overflow-auto bg-muted p-6">
          <div className="w-[560px] shrink-0 self-start bg-white p-9 font-serif text-[13px] leading-snug text-[#1F1D1A] shadow" style={{ minHeight: 792 }}>
            {cfg?.logo && <img src={cfg.logo} alt="" className="mx-auto mb-1 h-12" />}
            {cfg?.escola && <div className="text-center font-semibold">{cfg.escola}</div>}
            {cfg?.linha2 && <div className="mb-2 text-center">{cfg.linha2}</div>}
            {ps.map((p, i) => p.linha ? <div key={i} className="h-[14px] border-b border-dotted border-neutral-400" />
              : <div key={i} className={[p.b ? "mt-2 font-bold" : "", p.i ? "italic" : "", p.rec ? "pl-4" : ""].join(" ")}>{p.t}</div>)}
          </div>
        </section>
        <aside aria-label="Dados e verificação" className="flex w-[300px] shrink-0 flex-col overflow-auto border-l">
          <div className="grid grid-cols-2 gap-2 px-5 py-4 text-xs">
            <label>Turma<input value={dados.turma} onChange={(e) => mudar("turma", e.target.value)} className={campo} /></label>
            <label>Data<input type="date" value={dados.data} onChange={(e) => mudar("data", e.target.value)} className={campo} /></label>
            <label>Valor<input type="number" value={dados.valor} onChange={(e) => mudar("valor", e.target.value)} className={campo} /></label>
          </div>
          <ul className="border-t px-5 py-2 text-[13px]">
            {v.itens.map((i) => (
              <li key={i.rotulo} className="flex items-baseline gap-2.5 border-b py-2.5">
                {i.ok ? <Check className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-green-700" /> : <X className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-amber-600" />}
                <span className="flex-1">{i.rotulo}</span><span className="text-muted-foreground">{i.info}</span>
              </li>
            ))}
          </ul>
          <label className="mx-5 mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={fonte} onChange={(e) => setFonte(e.target.checked)} />incluir a fonte dos textos</label>
          <p className="mx-5 mt-3 text-[11px] text-muted-foreground">As questões vêm da lista <code>questoes</code> do frontmatter, lidas no banco citado. Para trocar questões, monte a prova de novo em “Montar prova”.</p>
          <div className="mt-auto border-t px-5 py-3.5 text-xs text-muted-foreground">{sel.size} questões</div>
        </aside>
      </div>
    </div>
  );
}
