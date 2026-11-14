// "Planejar ciclo com o Claude": o app NÃO tem modelo embutido. Monta o pedido (com os recursos que existem no vault),
// o Claude responde (ou grava direto pelo vault-mcp, ferramenta plan_ciclo) e aqui o professor aceita linha a linha.
import { invoke } from "@/lib/api";
import { incluirCicloNoAno } from "@/lib/ciclos";

const sanitiza = (s) => s.replace(/[\\/:|]/g, " ").replace(/\s+/g, " ").trim();
export const nomeCiclo = ({ titulo }) => sanitiza(titulo);

/** Nomes de notas de acervo (aulas, textos) que o Claude pode usar como recurso. */
export function recursosDoAcervo(items) {
  const de = (pasta) => items.filter((i) => i.rel.startsWith(pasta)).map((i) => i.name).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { aulas: de("Acervo/Aulas/"), textos: de("Acervo/Textos/") };
}

export function montarPedido({ ano, tri, incluir, titulo, nAulas, tema }, rec) {
  const lista = (l) => (l.length ? l.slice(0, 120).map((n) => `[[${n}]]`).join(", ") + (l.length > 120 ? ` … (+${l.length - 120})` : "") : "nenhum");
  return `Planeje um ciclo de aulas de Português (um ciclo é atemporal: não tem ano, turma nem datas)${incluir ? `, que vou usar no ${ano}º ano, ${tri}º trimestre` : ""}: "${titulo}".
${tema ? `Tema e observações: ${tema}\n` : ""}Aproximadamente ${nAulas} aulas, em sequência (sem datas). Inclua exercícios, revisão, prova, correção, recuperação e finalização do ciclo.

Se o vault-mcp estiver conectado: use search_notes e get_habilidade para escolher só recursos e habilidades que existem e chame plan_ciclo (titulo="${titulo}") SEM gravar; me mostre a proposta. Eu aceito aula por aula no app.
Se não estiver, responda neste formato exato (recursos só entre os que existem; deixe vazio se não houver):

## Conteúdos

- ...

## Habilidades

(EF0XLP00) texto da habilidade

## Aulas

| # | Conteúdo | Recurso |
| --- | --- | --- |
| 1 | **Crase**. | [[A crase]] |
| 2 | 🔻 Exercícios. | |

Marcas usadas no meu vault: 🔻 exercícios, 🔹 revisão/correção, 🔥 prova/recuperação, 🎮 finalização; aula nova de conteúdo em **negrito**.

Aulas do acervo (use como recurso): ${lista(rec.aulas)}
Textos do acervo: ${lista(rec.textos)}
`;
}

/** Lê o que o Claude devolveu (ou a proposta do plan_ciclo): conteúdos, habilidades e aulas. */
export function lerProposta(text, items) {
  const corpo = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const secao = (nome) => new RegExp(`^##\\s+${nome}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "mi").exec(corpo)?.[1] ?? "";
  const nomes = new Set(items.map((i) => i.name.toLowerCase()));
  const aulas = secao("Aulas").split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l)).map((l) => {
    const c = l.replace(/^\||\|\s*$/g, "").split(/(?<!\\)\|/).map((x) => x.trim().replace(/\\\|/g, "|"));
    const rec = (c[2] ?? "").replace(/^\[\[|\]\]$/g, "");
    return { conteudo: c[1] ?? "", recurso: rec, recursoExiste: !rec || nomes.has(rec.toLowerCase()), ok: true };
  });
  if (!aulas.length) throw new Error("Não achei a tabela “## Aulas” (linhas “| 1 | conteúdo | recurso |”).");
  const conteudos = secao("Conte[úu]dos").split("\n").map((l) => /^\s*[-*]\s+(.*)/.exec(l)?.[1]).filter(Boolean).map((t) => ({ texto: t, ok: true }));
  const habilidades = secao("Habilidades").split("\n").map((l) => /(EF\d\dLP\d\d)\)?[\s*—-]*(.*)$/.exec(l.trim())).filter(Boolean).map((m) => ({ codigo: m[1], texto: m[2].replace(/\s*\^ef\w+$/i, "").trim(), ok: true }));
  return { conteudos, habilidades, aulas };
}

const cel = (s) => s.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();

/** Texto final do ciclo só com o que foi aceito; aulas renumeradas, recurso inexistente vira texto simples. */
export function montarCiclo(_dados, p) {
  const aulas = p.aulas.filter((a) => a.ok);
  if (!aulas.length) throw new Error("Aceite ao menos uma aula.");
  let t = `---\ntipo: ciclo\n---\n## Conteúdos\n\n`;
  for (const c of p.conteudos.filter((x) => x.ok)) t += `- ${c.texto}\n`;
  t += "\n## Habilidades\n\n";
  for (const h of p.habilidades.filter((x) => x.ok)) t += `(${h.codigo})${h.texto ? " " + h.texto : ""}\n`;
  t += "\n## Aulas\n\n| # | Conteúdo | Recurso |\n| --- | --- | --- |\n";
  aulas.forEach((a, i) => { t += `| ${i + 1} | ${cel(a.conteudo)} | ${a.recurso ? (a.recursoExiste ? `[[${cel(a.recurso)}]]` : cel(a.recurso)) : ""} |\n`; });
  return t;
}

export async function criarCiclo(items, dados, proposta) {
  const nome = nomeCiclo(dados);
  if (!nome) throw new Error("Dê um título ao ciclo.");
  const igual = items.find((i) => i.name.toLowerCase() === nome.toLowerCase());
  if (igual) throw new Error(`Já existe uma nota chamada “${igual.name}”. Mude o título do ciclo.`);
  const texto = montarCiclo(dados, proposta);
  const root = items[0].path.slice(0, -items[0].rel.length);
  await invoke("create_folder", { dir: root + "Acervo/", name: "Ciclos" }).catch(() => {});
  const path = await invoke("create_note", { dir: root + "Acervo/Ciclos/", name: nome });
  await invoke("save_note", { path, text: texto });
  if (dados.incluir && dados.anoLetivo) await incluirCicloNoAno(items, { name: nome }, dados.anoLetivo, { ano: dados.ano, tri: dados.tri });
  return path;
}
