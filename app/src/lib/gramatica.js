// Gramática do acervo (`tipo: gramatica`, `Acervo/Gramática/<Tópico>.md`): nota de REFERÊNCIA, um arquivo por tópico.
// Fronteira com a Aula: a gramática guarda a regra, os exemplos e as dúvidas (o que vale em qualquer aula); a aula guarda a
// sequência didática e as atividades, e cita a gramática com `[[Tópico]]` ou `![[Tópico#Seção]]`.
import { raizDe, raizBarra } from "@/lib/raiz";
import { parseAula } from "@/lib/aula";

const sem = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Seções reconhecidas, na ordem do modelo; `obrigatoria`: o aviso "faltam" só olha estas. */
export const SECOES_GRAMATICA = [
  { id: "regra", nome: "Regra", casa: /^regras?$/, obrigatoria: true },
  { id: "exemplos", nome: "Exemplos", casa: /^exemplos?$/, obrigatoria: true },
  { id: "excecoes", nome: "Exceções e dúvidas", casa: /^(excecoes?( e duvidas)?|duvidas)$/ },
  { id: "teste", nome: "Como testar", casa: /^(como testar|macetes?|teste)$/ },
  { id: "veja", nome: "Veja também", casa: /^(veja tambem|relacionados?)$/ },
];
export const STATUS_GRAMATICA = ["pendente", "andamento", "finalizado", "arquivado"];

/** Modelo de uma gramática nova. */
export function modeloGramatica({ topico, ano = [] }) {
  const anos = (Array.isArray(ano) ? ano : [ano]).filter(Boolean).join(", ");
  return `---
tipo: gramatica
topico: ${topico}
ano: [${anos}]
assuntos: []
tags: []
status: pendente
---
# ${topico}

## Regra

Em poucas linhas, nas suas palavras.

## Exemplos

\`\`\`exemplo
errado: 
certo: 
porquê: 
\`\`\`

## Exceções e dúvidas

- 

## Como testar

## Veja também

- 
`;
}

/** Lê uma gramática: metadados, seções reconhecidas, `faltam` (obrigatórias vazias ou ausentes) e `avisos` (problemas do formato). */
export function parseGramatica(texto) {
  const a = parseAula(texto);
  const secoes = a.secoes.map((s) => ({ ...s, tipo: SECOES_GRAMATICA.find((x) => x.casa.test(sem(s.nome)))?.id ?? null }));
  const tem = (id) => secoes.some((s) => s.tipo === id && s.md.trim());
  const avisos = [];
  const fm = /^---\n([\s\S]*?)\n---/.exec(texto)?.[1] ?? "";
  const campo = (k) => new RegExp(`^${k}:\\s*(.*)$`, "m").exec(fm)?.[1]?.trim() ?? "";
  if (campo("tipo") !== "gramatica") avisos.push("tipo deve ser gramatica");
  if (!campo("topico")) avisos.push("falta o campo topico");
  const anos = campo("ano").replace(/[[\]]/g, "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!anos.length || anos.some((x) => !/^[6-9]$/.test(x))) avisos.push("ano deve ser de 6 a 9 (pode ser lista)");
  const status = campo("status");
  if (status && !STATUS_GRAMATICA.includes(status)) avisos.push(`status "${status}" fora do vocabulário`);
  secoes.filter((s) => !s.tipo).forEach((s) => avisos.push(`seção desconhecida: ${s.nome}`));
  const titulo = /^#\s+(.+)$/m.exec(texto.replace(/^---\n[\s\S]*?\n---\n?/, ""))?.[1]?.trim();
  if (titulo && campo("topico") && titulo !== campo("topico")) avisos.push("o título # difere do topico");
  return {
    topico: campo("topico"), anos, assuntos: a.meta.assuntos, status, secoes, avisos,
    faltam: SECOES_GRAMATICA.filter((x) => x.obrigatoria && !tem(x.id)).map((x) => x.nome),
    links: [...new Set([...texto.replace(/```[\s\S]*?```/g, "").matchAll(/(?<!!)\[\[([^\]|#]+)/g)].map((m) => m[1].trim()))],
  };
}

/** Cria `Acervo/Gramática/<topico>.md` com o modelo e devolve o caminho; se já existir uma nota com o nome, só devolve o dela. */
export async function criarGramatica(items, { topico, ano = [], pasta = "", modelo }) {
  const { invoke } = await import("@/lib/api");
  const nome = topico.replace(/\[\[|\]\]/g, "").replace(/[\\/:*?"<>|#^]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!nome) throw new Error("A gramática não tem título.");
  const ja = items.find((i) => /^Acervo\/Gram[aá]tica\//.test(i.rel) && i.name.toLowerCase() === nome.toLowerCase());
  if (ja) return ja.path;
  const raiz = raizDe(items);
  const dir = `${raiz}/Acervo/Gramática${pasta ? "/" + pasta : ""}`;
  if (!items.some((i) => i.rel.startsWith("Acervo/Gramática/"))) { try { await invoke("create_folder", { dir: `${raiz}/Acervo`, name: "Gramática" }); } catch { /* já existe */ } }
  const path = await invoke("create_note", { dir, name: nome });
  const { textoNovo } = await import("@/lib/modelos");
  await invoke("save_note", { path, text: await textoNovo(items, "gramatica", { titulo: nome, ano }, modelo) });
  return path;
}
