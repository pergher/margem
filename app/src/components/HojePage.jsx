import { useEffect, useState } from "react";
import { lerCiclos } from "@/lib/ciclos";
import { lerSemanas, segundaDe, rotuloDe } from "@/lib/semana";
import { listaCorrecoes, lerCorrecao, num } from "@/lib/correcao";
import { lerRecentes, haQuanto } from "@/lib/recentes";
import { Estado, Carregando, Vazio, Erro } from "@/components/ui/estado";
import { cn } from "@/lib/utils";

const nomes = (r) => [...String(r ?? "").matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim());

/** Hoje, sem horário: a próxima aula de cada turma na semana atual, a correção em curso e os arquivos abertos há pouco. */
export function HojePage({ items, onOpen, onCorrecao, onSemana }) {
  const [semanas, setSemanas] = useState(undefined);
  const [lote, setLote] = useState(undefined); // undefined = lendo; null = nenhum em curso
  const [erro, setErro] = useState("");
  useEffect(() => { lerSemanas(items).then(setSemanas).catch((e) => setErro(String(e))); }, [items]);
  useEffect(() => {
    let vivo = true;
    Promise.all(listaCorrecoes(items).map((it) => lerCorrecao(it).then((d) => ({ it, d })).catch(() => null))).then((r) => {
      if (!vivo) return;
      const emCurso = r.filter((x) => x && !/^(finalizado|arquivado)$/i.test(x.d.status ?? ""));
      const x = emCurso[0];
      setLote(x ? { path: x.it.path, nome: x.d.atividade || x.it.pasta, turma: x.d.turma?.replace(/"/g, ""), total: x.d.alunos.length, feitas: x.d.alunos.filter((a) => a.criterios.length && a.criterios.every((c) => num(c.nota) != null)).length } : null);
    });
    return () => { vivo = false; };
  }, [items]);

  if (erro) return <Erro>Erro: {erro}</Erro>;
  if (semanas === undefined) return <Carregando>Lendo a semana…</Carregando>;

  const existe = (n) => items.find((i) => i.name.toLowerCase() === n.toLowerCase());
  // Semana atual: a que tem o nome da segunda-feira de hoje; senão, a mais recente.
  const seg = segundaDe(), chave = `${seg.getFullYear()}-${String(seg.getMonth() + 1).padStart(2, "0")}-${String(seg.getDate()).padStart(2, "0")}`;
  const semana = semanas.find((s) => (s.name ?? "").includes(chave)) ?? semanas[semanas.length - 1];
  const todas = semana?.turmas.flatMap((t) => t.aulas) ?? [];
  const dadas = todas.filter((a) => a.dada).length, porDar = todas.filter((a) => !a.situacao).length;
  const recentes = lerRecentes().map((r) => ({ ...r, it: items.find((i) => i.path === r.path) })).filter((r) => r.it).slice(0, 5);

  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-8 py-8">
      <header>
        <div className="text-xs text-muted-foreground">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">{semana ? `Semana de ${semana.rotulo || rotuloDe(seg)}` : "Hoje"}</h1>
        {semana && <p className="mt-1 text-sm text-muted-foreground">{dadas} {dadas === 1 ? "aula dada" : "aulas dadas"} · {porDar} por dar</p>}
      </header>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[999_1_460px] flex-col gap-8">
          <section>
            <h2 className="mb-2 text-lg font-semibold">Próximas aulas</h2>
            {!semana
              ? <Vazio titulo="Ainda não há semana" acao={{ rotulo: "Ir para a Semana", onClick: onSemana }}>Crie a semana atual para ver aqui a próxima aula de cada turma.</Vazio>
              : <div className="flex flex-col gap-2">
                {semana.turmas.map((t) => {
                  const aula = t.aulas.find((a) => !a.situacao);
                  const alvos = aula ? [...new Set([...nomes(aula.recurso), ...nomes(aula.texto)])] : [];
                  const prontos = alvos.map(existe).filter(Boolean);
                  const pronto = alvos.length > 0 && prontos.length === alvos.length;
                  return (
                    <div key={t.turma} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-4">
                      <div className="min-w-0 flex-1 basis-52">
                        <div className="font-semibold">{t.turma}{t.cicloNome && <span className="ml-2 text-xs font-normal text-muted-foreground">{t.cicloNome}</span>}</div>
                        <div className={cn("truncate text-sm", aula ? "text-muted-foreground" : "text-ok")}>{aula ? aula.texto.replace(/\[\[|\]\]/g, "") : t.aulas.length ? "Todas as aulas da semana foram resolvidas." : "Sem aulas nesta semana."}</div>
                      </div>
                      {aula && <Estado tipo={pronto ? "ok" : "warn"} inline className="text-xs font-semibold">{pronto ? "Plano pronto" : "Sem plano"}</Estado>}
                      {aula && (pronto
                        ? <button onClick={() => onOpen(prontos[0].path)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Abrir plano</button>
                        : <button onClick={onSemana} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90">Preparar na Semana</button>)}
                    </div>
                  );
                })}
              </div>}
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Documentos recentes</h2>
            {recentes.length === 0
              ? <p className="text-sm text-muted-foreground">Os arquivos que você abrir aparecem aqui.</p>
              : recentes.map((r) => (
                <button key={r.path} onClick={() => onOpen(r.path)} className="flex min-h-11 w-full items-center gap-3 border-b px-2 text-left text-sm">
                  <span className="min-w-0 flex-1 truncate">{r.it.name}</span><span className="shrink-0 text-xs text-muted-foreground">{haQuanto(r.ts)}</span>
                </button>
              ))}
          </section>
        </div>

        <aside className="flex min-w-0 max-w-[400px] flex-[1_1_300px] flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Para corrigir</h2>
            {lote === undefined ? <span className="text-sm text-muted-foreground">Lendo…</span>
              : lote === null ? <p className="text-sm text-muted-foreground">Nenhuma correção em curso.</p>
              : <>
                <div className="font-semibold">{lote.nome}{lote.turma && ` · ${lote.turma}`}</div>
                <div role="img" aria-label={`${lote.feitas} de ${lote.total} corrigidas`} className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${lote.total ? (lote.feitas / lote.total) * 100 : 0}%` }} /></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>{lote.feitas} de {lote.total} corrigidas</span><span>faltam {lote.total - lote.feitas}</span></div>
                <button onClick={() => onCorrecao(lote.path)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Continuar correção</button>
              </>}
          </section>
        </aside>
      </div>
    </div></div>
  );
}
