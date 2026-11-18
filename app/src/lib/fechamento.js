// Fechamento do trimestre: o que ainda está em aberto, juntando o que o app já sabe (correções, ciclos, diário) com uma
// lista de itens do próprio professor (`Anos/AAAA/Fechamento AAAA.md`, `## 1º trimestre` … com `- [ ] item`).
// Nada aqui exige preenchimento: sem pendência, a tela só diz que está tudo em dia.
import { invoke } from "@/lib/api";
import { raizDe } from "@/lib/raiz";
import { listaCorrecoes, lerCorrecao, num } from "@/lib/correcao";
import { lerCiclos, progressoDoCiclo } from "@/lib/ciclos";
import { lerSemanas } from "@/lib/semana";
import { listarDiarios, lerMeta, reunioesEmAberto, alunosEmAlerta } from "@/lib/diario";
import { alternar } from "@/lib/caixa";

export const nomeFechamento = (ano) => `Fechamento ${ano}`;
export const TRIMESTRES = [1, 2, 3];
const LINHA = /^(\s*[-*]\s+\[)([ xX])(\]\s+)(.*)$/;
const TITULO = (tri) => `## ${tri}º trimestre`;

/** Trimestre sugerido: o primeiro com ciclo ainda em andamento; sem isso, pelo mês (fev–mai = 1º, jun–ago = 2º, resto = 3º). */
export function triSugerido(ciclos, semanas, hoje = new Date()) {
  const abertos = ciclos.filter((c) => c.incluido && c.tri).filter((c) => { const p = progressoDoCiclo(c, semanas); return p.some((x) => x.dadas < x.total); }).map((c) => c.tri);
  if (abertos.length) return Math.min(...abertos);
  const m = hoje.getMonth() + 1;
  return m <= 5 ? 1 : m <= 8 ? 2 : 3;
}

// ---------- itens do professor (Markdown) ----------

/** Tarefas da seção do trimestre: { linha (índice no arquivo), feito, texto }. */
export function itensDoTri(texto, tri) {
  const linhas = String(texto ?? "").split("\n"), out = [];
  let dentro = false;
  linhas.forEach((l, i) => {
    if (/^##\s/.test(l)) { dentro = l.trim() === TITULO(tri); return; }
    const m = dentro && LINHA.exec(l);
    if (m) out.push({ linha: i, feito: m[2] !== " ", texto: m[4].trim() });
  });
  return out;
}

/** Acrescenta um item ao fim da seção do trimestre (criando a seção, se faltar). Texto vazio não muda nada. */
export function acrescentarItem(texto, tri, item) {
  const t = String(item ?? "").replace(/\s*\n\s*/g, " ").trim();
  if (!t) return texto;
  const linhas = String(texto).split("\n");
  const ini = linhas.findIndex((l) => l.trim() === TITULO(tri));
  if (ini < 0) return `${String(texto).replace(/\s+$/, "")}\n\n${TITULO(tri)}\n\n- [ ] ${t}\n`;
  let fim = ini + 1;
  while (fim < linhas.length && !/^##\s/.test(linhas[fim])) fim++;
  let ultimo = fim;
  while (ultimo > ini + 1 && !linhas[ultimo - 1].trim()) ultimo--;
  const depois = linhas.slice(fim);
  return [...linhas.slice(0, ultimo), `- [ ] ${t}`, ...(depois.length ? ["", ...depois] : [""])].join("\n");
}

export const alternarItem = alternar;

/** Apaga a linha `n` se ainda for o item `texto` (o arquivo pode ter mudado por fora). */
export function removerItem(texto, n, textoEsperado) {
  const ls = String(texto).split("\n"), m = LINHA.exec(ls[n] ?? "");
  if (!m || m[4].trim() !== textoEsperado) return texto;
  ls.splice(n, 1);
  return ls.join("\n");
}

const modelo = (ano) => `---\ntipo: configuracao\n---\n# ${nomeFechamento(ano)}\n\nItens seus para fechar cada trimestre (lançar notas, entregar relatórios…). Marque como feito ou apague à vontade.\n`;
export const caminhoFechamento = (items, ano) => `${raizDe(items)}/Anos/${ano}/${nomeFechamento(ano)}.md`;

export async function lerFechamento(items, ano) {
  try { return await invoke("read_note", { path: caminhoFechamento(items, ano) }); } catch { return ""; }
}

/** Aplica `mudar(texto)` e grava, criando o arquivo se ainda não existe. */
export async function gravarFechamento(items, ano, mudar) {
  const path = caminhoFechamento(items, ano);
  let atual = null;
  try { atual = await invoke("read_note", { path }); } catch { /* ainda não existe */ }
  if (atual == null) {
    try { await invoke("create_folder", { dir: `${raizDe(items)}/Anos`, name: String(ano) }); } catch { /* já existe */ }
    await invoke("create_note", { dir: `${raizDe(items)}/Anos/${ano}`, name: nomeFechamento(ano) });
    atual = modelo(ano);
  }
  const novo = mudar(atual);
  if (novo !== atual) await invoke("save_note", { path, text: novo });
  return novo;
}

// ---------- pendências automáticas ----------

/** Lotes de produção ainda não finalizados (mesmo critério do "Para corrigir" do Hoje). */
export async function correcoesEmAberto(items, { turma = "" } = {}) {
  const lotes = await Promise.all(listaCorrecoes(items).map((it) => lerCorrecao(it).then((d) => ({ it, d })).catch(() => null)));
  return lotes.filter(Boolean).map(({ it, d }) => {
    const t = d.turma?.replace(/"/g, "") ?? "", total = d.alunos.length;
    const feitas = d.alunos.filter((a) => a.criterios.length && a.criterios.every((c) => num(c.nota) != null)).length;
    return { path: it.path, nome: d.atividade || it.pasta, turma: t, total, feitas, aberto: !/^(finalizado|arquivado)$/i.test(d.status ?? "") };
  }).filter((x) => x.aberto && (!turma || x.turma === turma));
}

/** Ciclos do trimestre com aulas por dar (por turma). */
export async function ciclosEmAberto(items, tri, { turma = "" } = {}) {
  const { ciclos } = await lerCiclos(items);
  const semanas = await lerSemanas(items).catch(() => []);
  return ciclos.filter((c) => c.incluido && c.tri === tri).map((c) => ({ path: c.path, nome: c.name, prog: progressoDoCiclo(c, semanas).filter((p) => !turma || p.turma === turma) }))
    .filter((c) => c.prog.some((p) => p.dadas < p.total));
}

/** Diários com transcrição por fazer ou por revisar (por turma). */
export async function diariosEmAberto(items, { turma = "" } = {}) {
  const r = { pendente: 0, revisao: 0 };
  for (const d of listarDiarios(items)) {
    if (turma && d.turma !== turma) continue;
    try { const t = lerMeta(await invoke("read_note", { path: d.path })).transcricao; if (t === "pendente") r.pendente++; else if (t === "aguardando-revisao") r.revisao++; } catch { /* diário ilegível */ }
  }
  return r;
}

/** Tudo junto, já filtrado por turma. `total` conta o que está em aberto (para a linha discreta do Hoje). */
export async function pendenciasDoFechamento(items, tri, { turma = "", ano = String(new Date().getFullYear()) } = {}) {
  const [correcoes, ciclos, diarios, reunioes, alertas, texto] = await Promise.all([
    correcoesEmAberto(items, { turma }), ciclosEmAberto(items, tri, { turma }), diariosEmAberto(items, { turma }),
    reunioesEmAberto(items).then((l) => l.filter((r) => !turma || r.turma === turma)).catch(() => []),
    alunosEmAlerta(items).then((l) => l.filter((a) => !turma || a.turma === turma)).catch(() => []),
    lerFechamento(items, ano),
  ]);
  const manuais = itensDoTri(texto, tri);
  const total = correcoes.length + ciclos.length + diarios.pendente + diarios.revisao + reunioes.length + alertas.length + manuais.filter((m) => !m.feito).length;
  return { correcoes, ciclos, diarios, reunioes, alertas, manuais, total };
}
