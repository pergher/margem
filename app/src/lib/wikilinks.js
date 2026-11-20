// Autocompletar de `[[`: ao digitar `[[`, lista as notas do vault pelo nome (sem acento nem maiúscula);
// se nenhuma tem exatamente o nome digitado, oferece "Criar «nome»" (cria a nota ao lado da nota aberta e já liga o link).
import { EditorSelection } from "@codemirror/state";

let provedor = { notas: () => [], criar: null };
/** O App informa de onde vêm as notas (`notas()` → [{ name, rel }]) e como criar uma (`criar(nome)`). */
export const definirProvedorDeLinks = (p) => { provedor = { ...provedor, ...p }; };

export const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Notas que casam com o texto digitado, melhores primeiro: começa com > começa uma palavra > contém. */
export function filtrarNotas(notas, consulta, limite = 40) {
  const q = semAcento(consulta.trim());
  const pontuar = (nome) => {
    const n = semAcento(nome);
    if (!q) return 3;
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(/[\s\-_.,()]+/).some((w) => w.startsWith(q))) return 2;
    return n.includes(q) ? 3 : null;
  };
  return notas
    .map((n) => ({ n, p: pontuar(n.name) }))
    .filter((x) => x.p !== null)
    .sort((a, b) => a.p - b.p || a.n.name.length - b.n.name.length || a.n.name.localeCompare(b.n.name, "pt"))
    .slice(0, limite)
    .map((x) => x.n);
}

const pasta = (rel) => { const p = rel.split("/").slice(0, -1).join("/"); return p; };

function inserir(view, from, to, nome) {
  // Se o `]]` já está depois do cursor (editando um link), não repete.
  const fecha = view.state.sliceDoc(to, to + 2) === "]]";
  const texto = fecha ? nome : nome + "]]";
  view.dispatch({
    changes: { from, to, insert: texto },
    selection: EditorSelection.cursor(from + nome.length + 2),
    userEvent: "input.complete",
  });
}

/** Fonte do autocompletar para o CodeMirror. */
export function fonteDeWikilinks(ctx) {
  const m = ctx.matchBefore(/\[\[[^\]\[\n|#^]*/);
  if (!m) return null;
  const from = m.from + 2, consulta = ctx.state.sliceDoc(from, ctx.pos);
  const notas = provedor.notas();
  const achadas = filtrarNotas(notas, consulta);
  const options = achadas.map((n, i) => ({
    label: n.name, detail: pasta(n.rel), type: "text", boost: -i,
    apply: (view, _c, f, t) => inserir(view, f, t, n.name),
  }));
  const q = consulta.trim();
  if (q && provedor.criar && !notas.some((n) => semAcento(n.name) === semAcento(q))) {
    options.push({
      label: `Criar «${q}»`, detail: "nova nota", type: "keyword", boost: -1000,
      apply: (view, _c, f, t) => { inserir(view, f, t, q); provedor.criar(q); },
    });
  }
  if (!options.length) return null;
  // `filter: false`: quem filtra e ordena é `filtrarNotas` (ignora acentos); a lista é refeita a cada tecla.
  return { from, options, filter: false };
}
