// Caixa de entrada: um arquivo Markdown comum (`_sistema/Caixa de entrada.md`) com uma lista de tarefas.
// Cada captura é uma linha `- [ ] texto`; marcar como feito troca para `- [x]`. O arquivo é seu: pode editar à mão.
import { invoke } from "@/lib/api";
import { raizDe } from "@/lib/raiz";

export const NOME_CAIXA = "Caixa de entrada";
const CABECALHO = `---\ntipo: configuracao\n---\n# ${NOME_CAIXA}\n\nIdeias e tarefas anotadas depressa (Ctrl+Shift+N). Marque como feito ou apague à vontade.\n\n`;
const LINHA = /^(\s*[-*]\s+\[)([ xX])(\]\s+)(.*)$/;

export const caminhoCaixa = (items) => `${raizDe(items)}/_sistema/${NOME_CAIXA}.md`;

/** Tarefas do texto: { linha (índice), feito, texto }. */
export function lerTarefas(texto) {
  return String(texto ?? "").split("\n").map((l, i) => {
    const m = LINHA.exec(l);
    return m ? { linha: i, feito: m[2] !== " ", texto: m[4].trim() } : null;
  }).filter(Boolean);
}

/** Acrescenta uma tarefa ao fim do texto (sem mexer no resto). Texto vazio não muda nada. */
export function acrescentar(texto, nova) {
  const t = String(nova ?? "").replace(/\s*\n\s*/g, " ").trim();
  if (!t) return texto;
  const base = String(texto ?? "");
  return `${base}${base === "" || base.endsWith("\n") ? "" : "\n"}- [ ] ${t}\n`;
}

/** Marca/desmarca a tarefa da linha `n`. Só altera se a linha ainda é aquela tarefa (`texto`). */
export function alternar(texto, n, textoEsperado) {
  const ls = String(texto).split("\n");
  const m = LINHA.exec(ls[n] ?? "");
  if (!m || m[4].trim() !== textoEsperado) return texto;
  ls[n] = `${m[1]}${m[2] === " " ? "x" : " "}${m[3]}${m[4]}`;
  return ls.join("\n");
}

/** Remove as tarefas já feitas. */
export const limparFeitas = (texto) => String(texto).split("\n").filter((l) => { const m = LINHA.exec(l); return !(m && m[2] !== " "); }).join("\n");

/** Lê a caixa; se o arquivo ainda não existe devolve "" (ele nasce na primeira captura). */
export async function lerCaixa(items) {
  try { return await invoke("read_note", { path: caminhoCaixa(items) }); } catch { return ""; }
}

/** Aplica `mudar(textoAtual)` e grava, criando o arquivo se preciso. Devolve o texto gravado. */
export async function gravarCaixa(items, mudar) {
  const path = caminhoCaixa(items);
  let atual = null;
  try { atual = await invoke("read_note", { path }); } catch { /* ainda não existe */ }
  if (atual == null) {
    const dir = `${raizDe(items)}/_sistema`;
    try { await invoke("create_folder", { dir: raizDe(items), name: "_sistema" }); } catch { /* já existe */ }
    await invoke("create_note", { dir, name: NOME_CAIXA });
    atual = CABECALHO;
  }
  const novo = mudar(atual);
  if (novo !== atual) await invoke("save_note", { path, text: novo });
  return novo;
}
