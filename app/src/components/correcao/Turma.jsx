import { useState } from "react";
import { IconEye as Eye, IconEyeOff as EyeOff, IconDownload as Download, IconChevronRight as ChevronRight, IconArrowRight as ArrowRight } from "@tabler/icons-react";
import { Estado } from "@/components/ui/estado";
import { Button } from "@/components/ui/button";
import { fmt, num } from "@/lib/correcao";

/** Comentário de uma linha: só pontos positivos e pontos de atenção (a nota e a variação já aparecem na linha). */
function resumo(x, cs) {
  if (x.total == null) return "Ainda sem nota.";
  const ok = cs.filter((c) => c.v != null).map((c) => ({ ...c, f: c.v / c.max }));
  const fortes = ok.filter((c) => c.f >= 0.75).sort((p, q) => q.f - p.f).slice(0, 2), fracos = ok.filter((c) => c.f < 0.5).sort((p, q) => p.f - q.f).slice(0, 2);
  const partes = [];
  if (fortes.length) partes.push("Pontos positivos: " + fortes.map((c) => c.nome).join(" e "));
  if (fracos.length) partes.push("a melhorar: " + fracos.map((c) => c.nome).join(" e "));
  if (!partes.length) return "Desempenho regular em todos os critérios.";
  return partes.join(" · ") + ".";
}

/** Variação frente à média da turma, como numa cotação: ▲ verde acima, ▼ vermelho abaixo. */
function Variacao({ dif }) {
  if (dif == null) return <span className="w-16 shrink-0" />;
  const v = Math.round(dif * 10) / 10, sobe = v > 0, igual = v === 0;
  return (
    <span title={igual ? "Na média da turma" : `${fmt(Math.abs(v))} ${sobe ? "acima" : "abaixo"} da média da turma`}
      className={"inline-flex w-16 shrink-0 items-center justify-end gap-1 text-xs font-medium tabular-nums " + (igual ? "text-muted-foreground" : sobe ? "text-ok" : "text-err")}>
      <span aria-hidden className="text-[9px]">{igual ? "▬" : sobe ? "▲" : "▼"}</span>
      <span className="sr-only">{igual ? "na média" : sobe ? "acima da média" : "abaixo da média"}</span>{igual ? "0" : (sobe ? "+" : "−") + fmt(Math.abs(v))}
    </span>
  );
}

export function Turma({ d, est, rotulo, nomes, setNomes, onAluno, onTodas }) {
  const [ordem, setOrdem] = useState("original");
  const [abertos, setAbertos] = useState(new Set());
  const [filtro, setFiltro] = useState("todos");
  const alternar = (i) => setAbertos((s) => { const t = new Set(s); t.has(i) ? t.delete(i) : t.add(i); return t; });
  const n = d.alunos.length, corrigidas = n - est.semNota;
  const maxF = Math.max(1, ...est.faixas.map((f) => f.n));
  const aproveitamento = est.media != null && est.maximo ? (est.media / est.maximo) * 100 : null;
  const comMedia = est.porCriterio.filter((c) => c.media != null);
  const fraco = comMedia.length > 1 ? comMedia.reduce((p, c) => (c.media / (c.max || 1) < p.media / (p.max || 1) ? c : p)) : null;
  const filtros = [
    { id: "todos", nome: "Todos", teste: () => true },
    { id: "abaixo", nome: "Abaixo da média", dica: "Nota menor que a média da turma", teste: (x) => x.total != null && est.media != null && x.total < est.media },
    { id: "acima", nome: "Acima da média", dica: "Nota maior que a média da turma", teste: (x) => x.total != null && est.media != null && x.total > est.media },
    { id: "corte", nome: `Abaixo de ${fmt(d.media)}`, dica: "Abaixo da nota de corte da rubrica", teste: (x) => x.total != null && x.total < d.media },
    { id: "zero", nome: "Critério zerado", dica: "Tirou zero em pelo menos um critério", teste: (x) => x.criterios.some((c) => num(c.nota) === 0) },
    { id: "marcas", nome: "Com marcas", dica: "Transcrição com [?] ou [ilegível] pendentes", teste: (x) => x.marcas > 0 },
    { id: "semnota", nome: "Sem nota", dica: "Ainda sem nota", teste: (x) => x.total == null },
  ].map((f) => ({ ...f, n: d.alunos.filter(f.teste).length })).filter((f) => f.id === "todos" || f.id === filtro || f.n > 0);
  const lista = d.alunos.map((x, i) => ({ x, i })).sort((p, q) => ordem === "nota-" ? (q.x.total ?? -1) - (p.x.total ?? -1) : ordem === "nota+" ? (p.x.total ?? 99) - (q.x.total ?? 99) : p.i - q.i).filter(({ x }) => filtros.find((f) => f.id === filtro).teste(x));
  const cartoes = [
    { k: "Média", v: fmt(est.media), sub: aproveitamento != null ? `${Math.round(aproveitamento)}% de ${fmt(est.maximo)}` : "", barra: aproveitamento },
    { k: "Mediana", v: fmt(est.mediana), sub: `${corrigidas} de ${n} com nota` },
    { k: "Menor e maior", v: `${fmt(est.min)} · ${fmt(est.max)}`, sub: est.min != null ? `amplitude de ${fmt(est.max - est.min)}` : "" },
    { k: `Abaixo de ${fmt(d.media)}`, v: `${est.abaixo} de ${n}`, tom: est.abaixo ? "warn" : "ok", sub: est.abaixo ? "precisam de atenção" : "ninguém abaixo da média" },
    { k: "Pendências", v: est.marcas ? `${est.pendentes}` : "Nenhuma", tom: est.marcas ? "warn" : "ok", sub: est.marcas ? `produções · ${est.marcas} ${est.marcas === 1 ? "marca" : "marcas"} na transcrição` : "transcrições sem marcas" },
  ];
  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className="flex w-full flex-col gap-8 px-8 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">Visão da turma <span className="font-normal text-muted-foreground">· {n} produções</span></h2>
        <Button size="sm" variant="outline" onClick={() => setNomes(!nomes)}>{nomes ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}{nomes ? "Ocultar nomes" : "Mostrar nomes"}</Button>
        <Button size="sm" variant="outline" onClick={onTodas}><Download aria-hidden className="h-4 w-4" />Baixar todas as devolutivas</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cartoes.map((c) => (
          <div key={c.k} className="rounded-xl border p-4">
            <div className="text-xs text-muted-foreground">{c.k}</div>
            <div className={"mt-1 font-serif text-2xl font-semibold " + (c.tom === "warn" ? "text-warn" : c.tom === "ok" ? "text-ok" : "")}>{c.v}</div>
            {c.barra != null && <div role="img" aria-label={`${Math.round(c.barra)}% do máximo`} className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${c.barra}%` }} /></div>}
            {c.sub && <div className="mt-1.5 text-xs text-muted-foreground">{c.sub}</div>}
          </div>))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border p-5">
          <h3 className="text-sm font-semibold">Distribuição das notas</h3>
          <p className="mb-4 text-xs text-muted-foreground">Quantos alunos em cada faixa de 1 ponto (de 0 a 1, de 1 a 2…) · máximo {fmt(est.maximo)}</p>
          <div className="flex h-40 items-end gap-1.5">
            {est.faixas.map((f, k) => {
              const baixo = f.ate <= d.media, ult = k === est.faixas.length - 1;
              const quem = d.alunos.filter((x) => x.total != null && (x.total >= f.de && (ult ? x.total <= f.ate : x.total < f.ate)));
              const pos = k < 3 ? "left-0" : k > est.faixas.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <div key={f.de} tabIndex={f.n ? 0 : undefined} aria-label={`${fmt(f.de)} a ${fmt(f.ate)}: ${f.n}${quem.length ? " — " + quem.map(rotulo).join(", ") : ""}`}
                  className="group relative flex h-full flex-1 flex-col justify-end gap-1.5 rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="text-xs font-medium tabular-nums">{f.n}</span>
                  <div className={"rounded-t-md transition-opacity group-hover:opacity-80 " + (baixo ? "bg-warn/70" : "bg-primary/70")} style={{ height: `${(f.n / maxF) * 100}%`, minHeight: f.n ? 6 : 2, opacity: f.n ? undefined : 0.25 }} />
                  {quem.length > 0 && (
                    <div role="tooltip" className={"pointer-events-none invisible absolute bottom-full z-20 mb-1 w-44 rounded-lg border bg-background p-2.5 text-left text-xs shadow-lg group-focus-visible:visible group-hover:visible " + pos}>
                      <div className="mb-1 font-semibold">{fmt(f.de)} a {fmt(f.ate)} · {f.n} {f.n === 1 ? "aluno" : "alunos"}</div>
                      <ul className="space-y-0.5">
                        {quem.slice(0, 12).map((x) => <li key={x.n} className="flex justify-between gap-2"><span className="truncate">{rotulo(x)}</span><span className="tabular-nums text-muted-foreground">{fmt(x.total)}</span></li>)}
                        {quem.length > 12 && <li className="text-muted-foreground">+ {quem.length - 12}</li>}
                      </ul>
                    </div>)}
                </div>);
            })}
          </div>
          <div aria-hidden className="mt-1.5 flex gap-1.5 border-t pt-1.5">{est.faixas.map((f) => <span key={f.de} className="flex-1 text-center text-xs text-muted-foreground tabular-nums">{fmt(f.de)}</span>)}</div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-warn/70" />faixa abaixo da média ({fmt(d.media)})</p>
        </section>

        <section className="rounded-xl border p-5">
          <h3 className="text-sm font-semibold">Média por critério</h3>
          <p className="mb-4 text-xs text-muted-foreground">Quanto a turma tirou em cada critério, em relação ao máximo dele</p>
          <ul className="space-y-3.5">
            {est.porCriterio.map((c) => {
              const p = c.media != null ? (c.media / (c.max || 1)) * 100 : 0, ehFraco = fraco?.nome === c.nome;
              return (
                <li key={c.nome}>
                  <div className="mb-1 flex items-baseline gap-2 text-sm"><span className="min-w-0 flex-1 truncate" title={c.nome}>{c.nome}</span>
                    {ehFraco && <Estado tipo="warn" inline className="text-xs font-semibold">mais fraco</Estado>}
                    <span className="text-xs tabular-nums text-muted-foreground">{fmt(c.media)} / {fmt(c.max)} · {Math.round(p)}%</span></div>
                  <div role="img" aria-label={`${Math.round(p)}% do máximo`} className="h-2 rounded-full bg-muted"><div className={"h-2 rounded-full " + (ehFraco ? "bg-warn" : "bg-primary")} style={{ width: `${p}%`, minWidth: c.media ? 4 : 0 }} /></div>
                </li>);
            })}
          </ul>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="mr-auto text-lg font-semibold">Alunos</h3>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar alunos" className="h-8 rounded-lg border bg-background px-2 text-xs">
            <option value="original">Ordem da lista</option><option value="nota-">Maior nota</option><option value="nota+">Menor nota</option></select>
        </div>
        <div role="group" aria-label="Filtrar alunos" className="mb-3 flex flex-wrap gap-2">
          {filtros.map((f) => (
            <button key={f.id} onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id} title={f.dica}
              className={"inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs " + (filtro === f.id ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-accent")}>
              {f.nome}<span className="tabular-nums text-muted-foreground">{f.n}</span>
            </button>))}
        </div>
        {lista.length === 0 && <p className="rounded-xl border p-4 text-sm text-muted-foreground">Nenhum aluno neste filtro.</p>}
        <div className={"rounded-xl border " + (lista.length ? "" : "hidden")}>
          {lista.map(({ x, i }) => {
            const baixo = x.total != null && x.total < d.media, aberto = abertos.has(i);
            const cs = est.porCriterio.map((c, k) => ({ nome: c.nome.replace(/\s*\(.*\)/, ""), cheio: c.nome, max: c.max || 1, v: num(x.criterios[k]?.nota), turma: c.media, com: (x.criterios[k]?.comentario ?? "").replace(/[*~^_{}|]/g, "").trim() }));
            return (
              <div key={x.n} className="group/linha border-b first:rounded-t-xl last:rounded-b-xl last:border-b-0">
                <div className="flex items-center gap-2 rounded-[inherit] pr-3 hover:bg-accent/50">
                  <button onClick={() => alternar(i)} aria-expanded={aberto} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 pl-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                    <ChevronRight aria-hidden className={"h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform " + (aberto ? "rotate-90" : "")} />
                    <span className="w-24 shrink-0 truncate font-medium sm:w-28">{rotulo(x)}</span>
                    <span role="img" aria-label={cs.map((c) => `${c.nome}: ${c.v == null ? "sem nota" : `${fmt(c.v)} de ${fmt(c.max)}`}`).join("; ")} className="hidden min-w-0 flex-1 items-center gap-1 sm:flex">
                      {cs.map((c, k) => { const f = c.v == null ? null : c.v / c.max, pos = k < 2 ? "left-0" : k > cs.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"; return (
                        <span key={c.nome} className="group/crit relative flex h-5 min-w-2 flex-1 items-center">
                          <span className={"h-2 w-full rounded-md " + (f == null ? "border border-muted-foreground/40" : "bg-primary")} style={f != null ? { opacity: 0.12 + 0.88 * f } : undefined} />
                          <span role="tooltip" className={"pointer-events-none absolute top-full z-30 mt-1 hidden w-60 rounded-lg border bg-background p-2.5 text-left text-xs font-normal shadow-lg group-hover/crit:block " + pos}>
                            <span className="block font-semibold">{c.cheio}</span>
                            <span className="mt-0.5 block tabular-nums">{c.v == null ? "Sem nota" : <>{fmt(c.v)} de {fmt(c.max)} · {Math.round(f * 100)}%</>}</span>
                            {c.turma != null && <span className="block tabular-nums text-muted-foreground">Média da turma: {fmt(c.turma)}</span>}
                            {c.com && <span className="mt-1.5 block line-clamp-3 border-t pt-1.5 text-muted-foreground">{c.com}</span>}
                          </span>
                        </span>); })}
                    </span>
                    {x.marcas > 0 && <Estado tipo="warn" inline className="text-xs">{x.marcas} {x.marcas === 1 ? "marca" : "marcas"}</Estado>}
                    <span className={"w-10 shrink-0 text-right font-serif text-base font-semibold tabular-nums " + (baixo ? "text-err" : "")}>{fmt(x.total)}</span>
                    <Variacao dif={x.total != null && est.media != null ? x.total - est.media : null} />
                  </button>
                  <Button size="sm" variant="outline" className="opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within/linha:opacity-100 group-hover/linha:opacity-100" onClick={() => onAluno(i)} title={`Abrir a correção de ${rotulo(x)}`}>Corrigir<ArrowRight aria-hidden className="h-4 w-4" /></Button>
                </div>
                {aberto && <p className="rounded-b-[inherit] border-t bg-muted/40 px-4 py-2.5 pl-10 text-sm text-foreground/85">{resumo(x, cs)}</p>}
              </div>);
          })}
        </div>
      </section>
      {est.divergentes.length > 0 && <Estado tipo="warn" className="text-xs">{est.divergentes.length} {est.divergentes.length === 1 ? "produção com" : "produções com"} “Nota final” diferente da soma dos critérios.</Estado>}
    </div></div>
  );
}
