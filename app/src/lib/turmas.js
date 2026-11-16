// Turmas do ano letivo e aulas por semana, guardadas numa nota do vault: `Anos/AAAA/Turmas AAAA.md` (`tipo: configuracao`).
//   turmas: ["61", "62", "71"]
//   aulas_por_semana: 4
// Sem a nota, a Semana usa as turmas que já aparecem nas notas de semana e 4 aulas por turma.
import { raizDe, raizBarra } from "@/lib/raiz";
import { invoke } from "@/lib/api";
import { parseFm, setProp } from "@/lib/frontmatter";

export const AULAS_PADRAO = 4;
export const nomeTurmas = (ano) => `Turmas ${ano}`;

const raiz = (items) => raizDe(items);

/** Texto digitado ("61, 62 71") → lista sem repetição, na ordem. */
export const turmasDeTexto = (s) => [...new Set(String(s).split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))];

/** { existe, turmas, aulas } — `turmas` vazio quando a nota não existe ou não tem a lista. */
export async function lerTurmas(items, ano) {
  const it = items.find((i) => i.rel === `Anos/${ano}/${nomeTurmas(ano)}.md`);
  if (!it) return { existe: false, turmas: [], aulas: AULAS_PADRAO };
  try {
    const fm = parseFm(await invoke("read_note", { path: it.path }));
    const e = (k) => fm.entries.find((x) => x.key === k);
    const aulas = Number(e("aulas_por_semana")?.value);
    return { existe: true, turmas: e("turmas")?.items ?? turmasDeTexto(e("turmas")?.value ?? ""), aulas: Number.isInteger(aulas) && aulas > 0 && aulas <= 12 ? aulas : AULAS_PADRAO };
  } catch { return { existe: false, turmas: [], aulas: AULAS_PADRAO }; }
}

/** Grava (criando a nota se preciso). */
export async function gravarTurmas(items, ano, { turmas, aulas }) {
  const dir = `${raiz(items)}/Anos/${ano}`, nome = nomeTurmas(ano);
  const it = items.find((i) => i.rel === `Anos/${ano}/${nome}.md`);
  let path = it?.path, texto;
  if (path) texto = await invoke("read_note", { path });
  else {
    path = await invoke("create_note", { dir, name: nome });
    texto = `---\ntipo: configuracao\n---\n# ${nome}\n\nTurmas do ano e quantas aulas cada uma tem por semana. Edite em Configurações → Turmas do ano.\n`;
  }
  let t = setProp(texto, "turmas", turmas);
  t = setProp(t, "aulas_por_semana", String(aulas));
  if (!parseFm(t).entries.some((e) => e.key === "tipo")) t = setProp(t, "tipo", "configuracao");
  await invoke("save_note", { path, text: t });
}

/** Sugestão para o ano seguinte: cada turma sobe um ano escolar (61 → 71) e as do 9º ano saem. Turmas com outro formato ficam como estão. */
export const sugerirTurmasDoProximoAno = (turmas) => turmas.flatMap((t) => (/^9\d/.test(t) ? [] : /^[678]\d/.test(t) ? [String(Number(t[0]) + 1) + t.slice(1)] : [t]));
