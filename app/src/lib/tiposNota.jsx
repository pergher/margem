// Tipo de uma nota pelo caminho: nome, ícone e cor. Um só lugar para o `[[`, a Hoje, a busca, a paleta e Documentos.
// As cores (`--tipo-*`) estão em index.css, uma para cada tipo, nos temas claro e escuro.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IconPlus, IconHash, IconAt, IconBook, IconBookmarks, IconQuote, IconListCheck, IconDeviceGamepad2, IconRepeat, IconClipboardList, IconChecklist, IconCalendarWeek, IconNotebook, IconUser, IconFileText } from "@tabler/icons-react";

export const TIPOS_NOTA = {
  aula: { id: "aula", nome: "Aula", Icone: IconBook },
  gramatica: { id: "gramatica", nome: "Gramática", Icone: IconBookmarks },
  texto: { id: "texto", nome: "Texto", Icone: IconQuote },
  banco: { id: "banco", nome: "Banco de questões", Icone: IconListCheck },
  oficina: { id: "oficina", nome: "Oficina", Icone: IconDeviceGamepad2 },
  ciclo: { id: "ciclo", nome: "Ciclo", Icone: IconRepeat },
  prova: { id: "prova", nome: "Prova", Icone: IconClipboardList },
  correcao: { id: "correcao", nome: "Correção", Icone: IconChecklist },
  semana: { id: "semana", nome: "Semana", Icone: IconCalendarWeek },
  diario: { id: "diario", nome: "Diário", Icone: IconNotebook },
  aluno: { id: "aluno", nome: "Aluno", Icone: IconUser },
  nota: { id: "nota", nome: "Nota", Icone: IconFileText },
};

/** Id do tipo, só pelo caminho no vault. */
export function idDoTipo(rel = "") {
  if (/^Acervo\/Aulas\//.test(rel)) return "aula";
  if (/^Acervo\/Gram[aá]tica\//.test(rel)) return "gramatica";
  if (/^Acervo\/Textos\//.test(rel)) return "texto";
  if (/^Acervo\/Questoes\//.test(rel)) return "banco";
  if (/^Acervo\/Oficinas\//.test(rel)) return "oficina";
  if (/\/Provas\//.test(rel)) return "prova";
  if (/\/Correcoes\//.test(rel)) return "correcao";
  if (/\/Semanas\//.test(rel)) return "semana";
  if (/^Acervo\/Ciclos\//.test(rel) || /\/Planejamento\//.test(rel)) return "ciclo";
  if (/\/Diarios\//.test(rel)) return "diario";
  if (/\/Alunos\//.test(rel)) return "aluno";
  return "nota";
}

/** `{ id, nome, Icone, cor }` do tipo de uma nota (ou de um id de tipo). */
export function tipoDaNota(relOuId = "") {
  const id = TIPOS_NOTA[relOuId] ? relOuId : idDoTipo(relOuId);
  return { ...TIPOS_NOTA[id], cor: `hsl(var(--tipo-${id}))` };
}

/** Ícone do tipo, na cor dele. */
export function IconeDoTipo({ tipo, className = "h-4 w-4 shrink-0", ...resto }) {
  const { Icone, cor } = tipoDaNota(tipo);
  return <Icone aria-hidden className={className} strokeWidth={1.7} style={{ color: cor }} {...resto} />;
}

const EXTRAS = { criar: [IconPlus, "hsl(var(--primary))"], titulo: [IconHash, "hsl(var(--muted-foreground))"], apelido: [IconAt, "hsl(var(--muted-foreground))"] };

/** Elemento DOM do ícone de um tipo de nota (ou de "criar", "titulo", "apelido"), para o autocompletar do CodeMirror. */
export function iconeDom(relOuId) {
  const [Icone, cor] = EXTRAS[relOuId] ?? (({ Icone: I, cor: c }) => [I, c])(tipoDaNota(relOuId));
  const el = document.createElement("span");
  el.className = "cm-tipo-icone"; el.setAttribute("aria-hidden", "true"); el.style.color = cor;
  el.innerHTML = renderToStaticMarkup(createElement(Icone, { strokeWidth: 1.8, size: 16 }));
  return el;
}
