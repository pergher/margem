import { useEffect, useMemo, useState } from "react";
import { MESES_NOMES, listarRubricas, alunosDaTurma, criarCorrecao } from "@/lib/novaCorrecao";

const campo = "mt-1 w-full rounded border bg-background px-2 py-1.5 text-sm";

/** "Nova correção": atividade, turma, mês, rubrica e alunos; cria o lote e abre a tela de correção. */
export function NovaCorrecaoDialog({ items, turmas, turmaInicial, onClose, onCriada }) {
  const ano = String(new Date().getFullYear());
  const rubricas = useMemo(() => listarRubricas(items), [items]);
  const [d, setD] = useState({ atividade: "", turma: turmaInicial || turmas[0] || "", mes: MESES_NOMES[new Date().getMonth()], rubrica: rubricas[0]?.path ?? "", enunciado: "" });
  const [alunos, setAlunos] = useState("");
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  useEffect(() => { setAlunos(alunosDaTurma(items, ano, d.turma).join("\n")); }, [d.turma]); // sugere a lista da turma
  const criar = async () => {
    try { onCriada(await criarCorrecao(items, { ...d, ano, rubricaItem: rubricas.find((r) => r.path === d.rubrica), alunos: alunos.split("\n") })); }
    catch (e) { setMsg(String(e?.message ?? e)); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-6" onMouseDown={onClose}>
      <div role="dialog" aria-label="Nova correção" className="w-[min(560px,96vw)] rounded-xl border bg-background p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-2xl font-semibold">Nova correção</h2>
        <p className="mt-1 text-xs text-muted-foreground">Cria o lote em Anos/{ano}/Correcoes com um bloco por aluno e os critérios da rubrica. Depois é só transcrever (ou colar) o texto de cada aluno e dar as notas.</p>
        <label className="mt-4 block text-sm font-medium">Atividade<input autoFocus value={d.atividade} onChange={set("atividade")} placeholder="ex.: Crônica" className={campo} /></label>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <label className="text-sm font-medium">Turma<select value={d.turma} onChange={set("turma")} className={campo}>{turmas.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-sm font-medium">Mês<select value={d.mes} onChange={set("mes")} className={campo}>{MESES_NOMES.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label className="text-sm font-medium">Rubrica<select value={d.rubrica} onChange={set("rubrica")} className={campo}><option value="">Sem rubrica (nota única)</option>{rubricas.map((r) => <option key={r.path} value={r.path}>{r.name}</option>)}</select></label>
        </div>
        <label className="mt-3 block text-sm font-medium">Alunos (um por linha)<textarea value={alunos} onChange={(e) => setAlunos(e.target.value)} placeholder={"Nome do aluno (grava só a sigla, ex.: PaPe)\nOutro aluno"} className={campo + " h-32 font-mono text-xs"} /></label>
        <label className="mt-3 block text-sm font-medium">Enunciado (opcional)<textarea value={d.enunciado} onChange={set("enunciado")} className={campo + " h-16"} /></label>
        {msg && <div role="alert" className="mt-3 text-sm text-err">{msg}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">Cancelar</button>
          <button onClick={criar} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90">Criar e corrigir</button>
        </div>
      </div>
    </div>
  );
}
