// Criação dos recursos do acervo (texto, oficina, banco de questões) a partir de um modelo. A prova não passa por aqui: é montada em ProvaPage.

export const RECURSOS = {
  texto: { pasta: "Textos", dialogo: "Novo texto", modelo: (n) => `---\ntipo: texto\ntitulo: ${n}\nautor:\ngenero:\npublicacao:\nfonte:\nlink:\ndominio_publico: false\ntags: []\nfoco: []\nconteudos: []\nalertas: []\n---\n## Texto\n\nCole aqui o texto.\n` },
  oficina: { pasta: "Oficinas", dialogo: "Nova oficina", modelo: (n) => `---\ntipo: oficina\ntitulo: ${n}\nanos: []\nconteudo:\ntags: []\n---\n# ${n}\n\n**Dinâmica:** descreva em uma ou duas linhas.\n\n## Material\n\n## Como fazer\n\n## Variações\n` },
  banco: { pasta: "Questoes", dialogo: "Novo banco de questões", modelo: (n) => `---\ntipo: banco\nano:\nconteudos: []\nconteudos_excluidos: []\ntextos: []\n---\n# ${n}\n\nConteúdos excluídos:\n\n## Texto 1 — Gênero — Autor, "Título"\n\n> Cole aqui o texto-base.\n\n### Questões sobre o Texto 1\n\n#### Questão 1 · Interpretação · Dissertativa\nEnunciado.\n(Resposta: 4 linhas)\n\n---\n\n## Questões independentes\n` },
};

/** Cria `Acervo/<pasta do tipo>/[subpasta/]<nome>.md` com o modelo e devolve o caminho; se já existir nota com o nome, só devolve o dela. `pasta` é relativa à pasta do tipo. */
export async function criarRecurso(items, tipo, { nome, pasta = "" }) {
  const r = RECURSOS[tipo];
  const { invoke } = await import("@/lib/api");
  const n = nome.replace(/\[\[|\]\]/g, "").replace(/[\\/:*?"<>|#^]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!n) throw new Error("O nome está vazio.");
  const prefixo = `Acervo/${r.pasta}/`;
  const ja = items.find((i) => i.rel.startsWith(prefixo) && i.name.toLowerCase() === n.toLowerCase());
  if (ja) return ja.path;
  const raiz = items[0].path.slice(0, items[0].path.length - items[0].rel.length).replace(/\/$/, "");
  if (!items.some((i) => i.rel.startsWith(prefixo))) { try { await invoke("create_folder", { dir: `${raiz}/Acervo`, name: r.pasta }); } catch { /* já existe */ } }
  const path = await invoke("create_note", { dir: `${raiz}/${prefixo}${pasta ? pasta + "/" : ""}`.replace(/\/$/, ""), name: n });
  await invoke("save_note", { path, text: r.modelo(n) });
  return path;
}
