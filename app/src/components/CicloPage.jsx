import { useState } from "react";
import { invoke } from "@/lib/api";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { FASES, inserirAula, removerAula, salvarAulas, editarCelula, salvarConteudos, salvarHabilidades, nomeComTitulo, parseCiclo } from "@/lib/ciclos";
import { ajustarSemanasAoCiclo } from "@/lib/semana";
import { Estado } from "@/components/ui/estado";

const fase = Object.fromEntries(FASES.map((f) => [f.id, f]));
const norm = (s) => s.toLowerCase();

// Recurso da aula: [[links]] viram botões (âmbar se a nota não existe), o resto é texto.
function Recurso({ texto, nomes, onOpen, items }) {
  const partes = texto.split(/(\[\[[^\]]+\]\])/g).filter(Boolean);
  return partes.map((p, i) => {
    const m = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(p);
    if (!m) return <span key={i}>{p}</span>;
    const alvo = m[1].trim(), item = items.find((x) => norm(x.name) === norm(alvo));
    return item
      ? <button key={i} onClick={() => onOpen(item.path)} className="text-primary hover:underline">{alvo}</button>
      : <span key={i} title="Arquivo ainda não existe" className="text-warn">{alvo} (a criar)</span>;
  });
}

// Texto que vira campo ao clicar; Enter grava, Esc cancela, sair do campo grava.
function Editavel({ valor, onSave, placeholder = "—", multi, className = "", inputClass = "", label, render, livre, rows = 3 }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(valor);
  const fim = (grava) => { setEdit(false); if (grava && v.trim() !== valor.trim()) onSave(v.trim()); };
  if (!edit) return (
    <span role="button" tabIndex={0} title="Clique para editar" aria-label={label}
      onClick={(e) => { if (e.target.closest("button")) return; setV(valor); setEdit(true); }} onKeyDown={(e) => { if (e.key === "Enter") { setV(valor); setEdit(true); } }}
      className={`cursor-text rounded-sm hover:bg-accent/60 focus-visible:outline focus-visible:outline-1 ${className}`}>{valor ? (render ? render(valor) : valor) : <span className="text-muted-foreground">{placeholder}</span>}</span>
  );
  const props = { autoFocus: true, value: v, onChange: (e) => setV(e.target.value), onBlur: () => fim(true), "aria-label": label,
    onKeyDown: (e) => { if (e.key === "Escape") { e.preventDefault(); fim(false); } else if (e.key === "Enter" && (livre ? e.ctrlKey : !(multi && e.shiftKey))) { e.preventDefault(); fim(true); } },
    className: `w-full rounded-md border bg-background px-1.5 py-0.5 ${inputClass}` };
  return multi ? <textarea rows={rows} {...props} /> : <input {...props} />;
}

const resumo = (t) => t.replace(/\*\*/g, "").replace(/\[\[([^\]|]+)[^\]]*\]\]/g, "$1");

export function CicloPage({ ciclo: c, items, onOpen, onAno, onChange, onRename }) {
  const [wDados, setWDados] = useWidth("ciclo.dados", 340);
  const [novo, setNovo] = useState(null); // { pos, texto }
  const [erro, setErro] = useState("");
  const aplicar = (acao, ajuste) => salvarAulas(c, acao).then(async (x) => { if (ajuste) await ajustarSemanasAoCiclo(items, c.name, ajuste); setErro(""); setNovo(null); onChange(x); }).catch((e) => setErro(String(e.message ?? e)));
  const renomear = async (titulo) => {
    if (!titulo) return setErro("O título não pode ficar vazio.");
    try { const novo = await onRename(c.path, nomeComTitulo(c, titulo)); const nome = novo.split("/").pop().replace(/\.md$/, ""); onChange(parseCiclo({ path: novo, name: nome }, await invoke("read_note", { path: novo }))); setErro(""); } catch (e) { setErro(String(e.message ?? e)); }
  };
    const linhaNova = (
    <div className="flex items-center gap-2 border-b bg-primary/5 px-2.5 py-1.5 text-xs">
      <span className="w-[2.125rem] text-muted-foreground">{novo?.pos}</span>
      <input autoFocus value={novo?.texto ?? ""} onChange={(e) => setNovo({ ...novo, texto: e.target.value })} placeholder="Conteúdo da nova aula (ex.: **Exercícios**. Livro p. 210)"
        onKeyDown={(e) => { if (e.key === "Enter" && novo.texto.trim()) aplicar((t) => inserirAula(t, novo.pos, novo.texto.trim()), { inserirEm: novo.pos }); if (e.key === "Escape") setNovo(null); }}
        className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1" />
      <button disabled={!novo?.texto?.trim()} onClick={() => aplicar((t) => inserirAula(t, novo.pos, novo.texto.trim()), { inserirEm: novo.pos })} className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-40">Inserir</button>
      <button onClick={() => setNovo(null)} className="text-xs text-muted-foreground hover:underline">cancelar</button>
    </div>
  );
  const contagem = FASES.map((f) => ({ f, n: c.aulas.filter((a) => a.fase === f.id).length })).filter((x) => x.n);
  return (
    <div className="flex min-h-0 flex-1">
      <aside aria-label="Dados do ciclo" style={{ width: wDados }} className="shrink-0 overflow-auto p-6">
        <button onClick={onAno} className="mb-3 text-xs text-muted-foreground hover:text-foreground">← Planejamento {c.ano}º ano</button>
        <h1 className="mb-1.5 font-serif text-3xl font-semibold leading-tight">{onRename ? <Editavel label="Título do ciclo" valor={c.vazio ? "" : c.titulo} placeholder={c.titulo} onSave={renomear} inputClass="font-serif text-2xl font-semibold" /> : c.titulo}</h1>
        <div className="mb-5 text-xs leading-relaxed text-muted-foreground">
          {c.ano}º ano · {c.tri}º trimestre · ciclo {c.ciclo}{c.sufixo ? ` · ${c.sufixo}` : ""}<br />{c.aulas.length} aulas
        </div>

        <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Conteúdos</div>
        <div className="mb-5 text-sm">
          <Editavel multi livre rows={Math.max(4, c.conteudos.length + 2)} label="Conteúdos do ciclo" valor={c.conteudos.join("\n")} placeholder="— clique para escrever (um conteúdo por linha)"
            render={() => <ul className="list-disc pl-5">{c.conteudos.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            onSave={(t) => aplicar((tx) => salvarConteudos(tx, t.split("\n").map((l) => l.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean)))} />
        </div>

        <div className="mb-2 text-xs font-semibold text-muted-foreground">Habilidades</div>
        <div className="mb-2">
          <Editavel multi livre rows={Math.max(4, c.habTexto.length * 3)} label="Habilidades do ciclo" valor={c.habTexto.map((h) => `${h.codigo} ${h.texto}`.trim()).join("\n")}
            placeholder="sem habilidade — clique para escrever (uma por linha: EF69LP32 texto)" className="block"
            render={() => c.habTexto.map((h) => (
              <div key={h.codigo} className="mb-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{h.codigo}</span>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{h.texto}</div>
              </div>))}
            onSave={(t) => { const hs = t.split("\n").map((l) => /^\(?(EF\d\dLP\d\d)\)?\s*(.*)/i.exec(l.trim())).filter(Boolean).map((m) => ({ codigo: m[1].toUpperCase(), texto: m[2].trim() })); if (t.trim() && !hs.length) return setErro("Escreva cada habilidade começando pelo código (EF69LP32 texto)."); aplicar((tx) => salvarHabilidades(tx, hs)); }} />
        </div>

        <div className="mt-5 text-xs font-semibold text-muted-foreground">Etapas</div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {contagem.map(({ f, n }) => <span key={f.id} className="rounded-full border px-2 py-0.5"><span aria-hidden className="mr-1 inline-block h-2 w-2" style={{ background: f.cor }} />{f.nome} · {n}</span>)}
        </div>

        <button onClick={() => onOpen(c.path)} className="mt-6 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Abrir no editor</button>
      </aside>
      <ResizeHandle width={wDados} setWidth={setWDados} min={240} max={560} side="left" />

      <section aria-label="Sequência do ciclo" className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 px-6 pb-3 pt-4">
          <div className="mb-2 flex items-center gap-3 text-xs font-medium">Sequência do ciclo <span className="font-normal text-muted-foreground">· {c.aulas.length} aulas</span>
            <button onClick={() => setNovo({ pos: c.aulas.length + 1, texto: "" })} className="rounded-md border px-2 py-0.5 text-xs font-normal hover:bg-accent">+ Aula</button>
            {erro && <Estado tipo="err" inline className="text-xs font-normal">{erro}</Estado>}
          </div>
          <div className="flex h-1.5 max-w-xl gap-0.5">{c.aulas.map((a) => <span key={a.n} style={{ flex: 1, background: fase[a.fase].cor }} />)}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
          <div className="grid gap-x-2.5 border-b px-2.5 py-1.5 text-xs text-muted-foreground" style={{ gridTemplateColumns: "34px 148px 1fr 1fr 64px" }}>
            <span>#</span><span>Etapa</span><span>Conteúdo</span><span>Recurso</span><span />
          </div>
          {c.aulas.map((a) => (
            <div key={a.n}>
            {novo?.pos === a.n && linhaNova}
            <div className="group grid items-start gap-x-2.5 border-b px-2.5 py-1.5 text-xs" style={{ gridTemplateColumns: "34px 148px 1fr 1fr 64px" }}>
              <span className="text-muted-foreground">{a.n}</span>
              <span><span className="rounded-md px-2 py-0.5 text-xs text-white" style={{ background: fase[a.fase].cor }}>{fase[a.fase].nome}</span></span>
              <span><Editavel multi label={`Conteúdo da aula ${a.n}`} valor={a.texto} render={resumo} className="block min-h-[1.25rem]" onSave={(t) => aplicar((tx) => editarCelula(tx, a.n, 2, t))} /></span>
              <span><Editavel multi label={`Recurso da aula ${a.n}`} valor={a.recurso} placeholder="" className="block min-h-[1.25rem]" render={(t) => <Recurso texto={t} items={items} onOpen={onOpen} />} onSave={(t) => aplicar((tx) => editarCelula(tx, a.n, 3, t))} /></span>
              <span className="flex justify-end gap-1 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                <button title={`Inserir uma aula antes da ${a.n} (as seguintes deslocam)`} aria-label={`Inserir antes da aula ${a.n}`} onClick={() => setNovo({ pos: a.n, texto: "" })} className="rounded px-1.5 text-muted-foreground hover:bg-accent">↧</button>
                <button title={`Remover a aula ${a.n} (as seguintes sobem)`} aria-label={`Remover a aula ${a.n}`} onClick={() => { if (window.confirm(`Remover a aula ${a.n}?\n\n${resumo(a.texto)}`)) aplicar((t) => removerAula(t, a.n), { removida: a.n }); }} className="rounded px-1.5 text-muted-foreground hover:bg-accent hover:text-err">✕</button>
              </span>
            </div>
            </div>
          ))}
          {novo?.pos === c.aulas.length + 1 && linhaNova}
          {!c.aulas.length && <div className="p-4 text-sm text-muted-foreground">Este plano ainda não tem a tabela “## Aulas”.</div>}
        </div>
      </section>
    </div>
  );
}
