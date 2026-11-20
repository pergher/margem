// Modelos de nota: o que "Nova aula", "Nova gramática" etc. gravam ao criar. Vivem como notas em `_sistema/modelos`
// (editáveis como qualquer nota); se a nota não existe, vale o modelo de fábrica abaixo, então nada quebra num vault sem elas.
//
// Formato de um modelo: o frontmatter descreve a nota NOVA, com duas diferenças — `tipo: configuracao` (para o modelo
// não contar como aula, texto…) e `modelo_de: <tipo>` (o tipo que a nota nova terá). Marcadores no texto:
//   {{titulo}}  nome da nota        {{titulo_simples}}  o nome sem ( ) [ ] (para o Mermaid)
//   {{data}}    AAAA-MM-DD de hoje  {{ano}}             ano escolar, se conhecido (vazio se não)
import { parseFm, setProp } from "./frontmatter";
import { raizDe } from "./raiz";
import { modeloAula } from "./aula";
import { modeloGramatica } from "./gramatica";
import { RECURSOS } from "./recursos";

export const PASTA_MODELOS = "_sistema/modelos";
export const ehModelo = (rel) => rel.startsWith(PASTA_MODELOS + "/");

/** Tipos que têm modelo (só os de conteúdo livre) e as seções `##` que o app espera encontrar neles. */
export const TIPOS_MODELO = {
  aula: { rotulo: "Aula", obrigatorias: ["Objetivos", "Habilidades", "Conteúdo", "Atividades"], seed: () => modeloAula({ ano: "", titulo: "{{titulo}}" }).replace("root(({{titulo}}))", "root(({{titulo_simples}}))") },
  gramatica: { rotulo: "Gramática", obrigatorias: ["Regra", "Exemplos"], seed: () => modeloGramatica({ topico: "{{titulo}}" }) },
  texto: { rotulo: "Texto", obrigatorias: ["Texto"], seed: () => RECURSOS.texto.modelo("{{titulo}}") },
  oficina: { rotulo: "Oficina", obrigatorias: [], seed: () => RECURSOS.oficina.modelo("{{titulo}}") },
  banco: { rotulo: "Banco de questões", obrigatorias: [], seed: () => RECURSOS.banco.modelo("{{titulo}}") },
};

const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Texto de um modelo de fábrica já no formato de nota-modelo (`tipo: configuracao` + `modelo_de`). */
export function textoDeFabrica(tipo) {
  return TIPOS_MODELO[tipo].seed()
    .replace(/^tipo: (\S+)$/m, "tipo: configuracao\nmodelo_de: $1")
    .replace(/^(\w+): \{\{titulo\}\}$/gm, '$1: "{{titulo}}"');
}

const tituloSeguro = (t) => (/^[^\s:#"'[\]{},&*!|>%@`-][^:#"'[\]{},&*!|>%@`]*$/.test(t) && !/\s$/.test(t) ? t : JSON.stringify(t));

/** Preenche um modelo: tira `tipo: configuracao`, faz de `modelo_de` o `tipo` e troca os marcadores. `ano` só é gravado se vier. */
export function instanciar(modelo, { titulo, ano } = {}) {
  let t = modelo.replace(/^(---\r?\n)([\s\S]*?)(\r?\n---)/, (_, a, fm, c) => a + fm.split(/\r?\n/).filter((l) => !/^tipo:/.test(l)).map((l) => l.replace(/^modelo_de:\s*/, "tipo: ")).join("\n") + c);
  t = t.replace(/"\{\{titulo\}\}"/g, () => tituloSeguro(titulo))
    .replace(/\{\{titulo_simples\}\}/g, () => titulo.replace(/[()[\]]/g, ""))
    .replace(/\{\{titulo\}\}/g, () => titulo)
    .replace(/\{\{data\}\}/g, hoje())
    .replace(/\{\{ano\}\}/g, () => (Array.isArray(ano) ? ano.join(", ") : ano ?? ""));
  if (Array.isArray(ano)) return !ano.length ? t : /^ano:/m.test(t) ? t.replace(/^ano:.*$/m, `ano: [${ano.join(", ")}]`) : setProp(t, "ano", ano);
  return ano ? setProp(t, "ano", ano) : t;
}

/** Seções `##` obrigatórias do tipo que o modelo não tem (nomes como o app as escreve). */
export function secoesFaltando(texto, tipo) {
  const tem = new Set([...texto.replace(/```[\s\S]*?```/g, "").matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => norm(m[1])));
  return (TIPOS_MODELO[tipo]?.obrigatorias ?? []).filter((s) => ![...tem].some((x) => x === norm(s) || x === norm(s) + "s" || x + "s" === norm(s)));
}

/** Modelos do vault: notas de `_sistema/modelos` com `modelo_de` de um tipo conhecido. */
export async function lerModelos(items) {
  const { invoke } = await import("@/lib/api");
  const lista = items.filter((i) => ehModelo(i.rel));
  const lidos = await Promise.all(lista.map(async (i) => {
    try { const texto = await invoke("read_note", { path: i.path }); return { path: i.path, name: i.name, rel: i.rel, texto, tipo: parseFm(texto).entries.find((e) => e.key === "modelo_de")?.value }; }
    catch { return null; }
  }));
  return lidos.filter((m) => m && TIPOS_MODELO[m.tipo]);
}

/** Modelos de um tipo: o que tem o nome do tipo (o padrão) primeiro, depois os demais por nome. */
export function modelosDoTipo(modelos, tipo) {
  const padrao = norm(TIPOS_MODELO[tipo].rotulo);
  return modelos.filter((m) => m.tipo === tipo).sort((a, b) => (norm(b.name) === padrao) - (norm(a.name) === padrao) || a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
}

/** Texto da nota nova: do modelo escolhido (`modeloPath`) ou do padrão do tipo; sem nota-modelo (ou se falhar a leitura), o de fábrica. */
export async function textoNovo(items, tipo, vars, modeloPath) {
  let modelos = [];
  try { modelos = await lerModelos(items); } catch { /* usa o de fábrica */ }
  const dele = modelosDoTipo(modelos, tipo), escolhido = dele.find((m) => m.path === modeloPath) ?? dele[0];
  return instanciar(escolhido?.texto ?? textoDeFabrica(tipo), vars);
}

async function garantirPasta(items) {
  const { invoke } = await import("@/lib/api");
  const raiz = raizDe(items);
  if (items.some((i) => ehModelo(i.rel))) return `${raiz}/${PASTA_MODELOS}`;
  for (const [dir, name] of [[raiz, "_sistema"], [`${raiz}/_sistema`, "modelos"]]) { try { await invoke("create_folder", { dir, name }); } catch { /* já existe */ } }
  return `${raiz}/${PASTA_MODELOS}`;
}

/** Cria a nota de modelo `nome` do tipo (cópia do texto dado, ou do de fábrica) e devolve o caminho. Se o nome existe, numera. */
export async function criarModelo(items, tipo, { nome, texto } = {}) {
  const { invoke } = await import("@/lib/api");
  const dir = await garantirPasta(items), base = nome ?? TIPOS_MODELO[tipo].rotulo;
  const usados = new Set(items.filter((i) => ehModelo(i.rel)).map((i) => norm(i.name)));
  let n = base, k = 2; while (usados.has(norm(n))) n = `${base} (${k++})`;
  const path = await invoke("create_note", { dir, name: n });
  await invoke("save_note", { path, text: texto ?? textoDeFabrica(tipo) });
  return path;
}

/** Cria as notas-modelo padrão que faltam (uma por tipo) e devolve quantas criou. */
export async function semearModelos(items) {
  const existentes = await lerModelos(items);
  let feitos = 0;
  for (const tipo of Object.keys(TIPOS_MODELO)) {
    if (existentes.some((m) => m.tipo === tipo)) continue;
    await criarModelo(items, tipo); feitos++;
    items = [...items, { rel: `${PASTA_MODELOS}/${TIPOS_MODELO[tipo].rotulo}.md`, name: TIPOS_MODELO[tipo].rotulo }]; // para a pasta não ser recriada
  }
  return feitos;
}

/** Devolve o modelo ao texto de fábrica. */
export async function restaurarModelo(path, tipo) {
  const { invoke } = await import("@/lib/api");
  await invoke("save_note", { path, text: textoDeFabrica(tipo) });
}
