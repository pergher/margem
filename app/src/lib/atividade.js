// "Atividade a partir de um texto": o app NÃO gera as questões (não há modelo embutido). Ele monta o pedido completo
// para o Claude (com o texto, os cuidados da ficha, o formato do banco e a numeração), e depois confere e insere
// no banco o que o Claude devolveu, sem alterar mais nada da nota.
import { invoke } from "@/lib/api";
import { parseBanco } from "@/lib/prova";
import { parseFm, setProp } from "@/lib/frontmatter";

export const listarTextos = (items) => items.filter((i) => /^Acervo\/Textos\/[^/]+\.md$/.test(i.rel)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

export async function lerFicha(item) {
  const text = await invoke("read_note", { path: item.path });
  const fm = parseFm(text), g = (k) => fm.entries.find((e) => e.key === k);
  const val = (k) => g(k)?.items ?? (g(k)?.value ? [g(k).value] : []);
  const corpo = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const secao = (nome) => new RegExp(`^##\\s+${nome}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "m").exec(corpo)?.[1]?.trim() ?? "";
  return {
    name: item.name, path: item.path, titulo: val("titulo")[0] ?? item.name, autor: val("autor")[0] ?? "", genero: val("genero")[0] ?? "texto",
    fonte: val("fonte")[0] ?? "", foco: val("foco"), conteudos: val("conteudos"), alertas: val("alertas"),
    avisos: secao("Alertas"), texto: secao("Texto"),
  };
}

/** Próximos números livres do banco: do texto e da questão (a numeração das questões é contínua no banco inteiro). */
export function proximosNumeros(banco) {
  const qs = [...banco.textos.flatMap((t) => t.questoes), ...banco.independentes].map((q) => q.n);
  return { texto: Math.max(0, ...banco.textos.map((t) => t.n)) + 1, questao: Math.max(0, ...qs) + 1 };
}

export function montarPedido({ ficha, banco, nInterp, nCont, nums }) {
  const excl = banco.excluidos.length ? banco.excluidos.join("; ") : "nenhum";
  const n0 = nums.questao;
  return `Use a skill banco-de-questoes-portugues. Crie questões para o texto abaixo, no formato do meu banco (${banco.ano}º ano), para eu colar no banco "${banco.titulo}".

Quantidade: ${nInterp} questões de **Interpretação** e ${nCont} de **Conteúdo**${ficha.foco.length ? ` (foco da ficha: ${ficha.foco.join(", ")})` : ""}. Misture "Múltipla escolha" (alternativas (A) a (E), uma correta) e "Dissertativa".
Conteúdos que NÃO podem aparecer (excluídos do banco): ${excl}.${ficha.alertas.length ? `\nAlertas do texto (cuidado com o enunciado): ${ficha.alertas.join(", ")}.` : ""}

Formato exato (numere as questões a partir de ${n0}; este será o Texto ${nums.texto} do banco):

### Questões sobre o Texto ${nums.texto}

#### Questão ${n0} · Interpretação · Dissertativa
<enunciado>
(Resposta: 4 linhas)

#### Questão ${n0 + 1} · Conteúdo · Múltipla escolha
<enunciado>
(A) ...
(B) ...
(C) ...
(D) ...
(E) ...

Depois, em um bloco separado, o gabarito, uma linha por questão, assim:
- **${n0}:** resposta esperada e critérios.
- **${n0 + 1}:** B — justificativa.

Não repita o texto nem a ficha; eu os insiro. Não use cabeçalho além de "### Questões sobre o Texto ${nums.texto}".

TEXTO: ${ficha.titulo} — ${ficha.autor} (${ficha.genero})
${ficha.avisos ? `\nAlertas da ficha:\n${ficha.avisos}\n` : ""}
${ficha.texto}
`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Devolve o novo texto do banco com o texto-base, as questões coladas e o gabarito; lança erro se o resultado não for lido pelo parser. */
export function inserirNoBanco(bancoTexto, { ficha, nums, questoes, gabarito }) {
  let q = questoes.trim();
  if (!/^###\s+Questões sobre o Texto/m.test(q)) q = `### Questões sobre o Texto ${nums.texto}\n\n${q}`;
  if (!/^####\s+Questão\s+\d+\s*·/m.test(q)) throw new Error("não achei nenhuma “#### Questão N · Categoria · Formato” no que foi colado");
  const cit = ficha.texto.split("\n").map((l) => (l.trim() ? `> ${l}` : ">")).join("\n");
  const aviso = ficha.avisos ? "" : "";
  const bloco = `## Texto ${nums.texto} — ${cap(ficha.genero)} — ${ficha.autor}, "${ficha.titulo}"\nFonte: ${ficha.fonte || ficha.autor} (Ficha do seu acervo: \`${ficha.name}.md\`)\n${aviso}\n${cit}\n\n${q}\n\n`;
  let t = bancoTexto;
  const ind = /^## Questões independentes/m.exec(t);
  if (ind) t = t.slice(0, ind.index) + bloco + t.slice(ind.index);
  else t = t.replace(/\s*$/, "\n\n") + bloco;
  const g = gabarito.trim();
  if (g) {
    const sec = /^## Gabarito[^\n]*\n/m.exec(t);
    if (sec) t = t.slice(0, sec.index + sec[0].length) + "\n" + t.slice(sec.index + sec[0].length).replace(/\s*$/, "\n") + `\n**Texto ${nums.texto}**\n\n${g}\n`;
    else t = t.replace(/\s*$/, "\n") + `\n---\n\n## Gabarito e respostas esperadas\n\n**Texto ${nums.texto}**\n\n${g}\n`;
  }
  const lista = (parseFm(t).entries.find((e) => e.key === "textos")?.items ?? []);
  t = setProp(t, "textos", [...lista, `[[${ficha.name}]]`]);
  const novo = parseBanco(t).textos.find((x) => x.n === nums.texto);
  if (!novo || !novo.questoes.length) throw new Error("depois de inserir, o banco não reconheceu as questões; confira o formato");
  return { texto: t, questoes: novo.questoes.length };
}

export async function gravarNoBanco(banco, dados) {
  const atual = await invoke("read_note", { path: banco.path });
  const r = inserirNoBanco(atual, dados);
  await invoke("save_note", { path: banco.path, text: r.texto });
  return r.questoes;
}
