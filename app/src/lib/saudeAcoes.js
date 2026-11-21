// Correções automáticas da página Saúde: dado um aviso e o texto da nota, devolve o que seria mudado (`rotulo`) e o texto novo.
// Só mexem no frontmatter e só em casos sem dúvida; o que exige decisão (conteúdo, link, campo vazio) fica para o professor.
import { parseFm, setProp } from "./frontmatter";

/** Tipo que a pasta indica (usado também pelo botão "definir tipo"). */
export function tipoSugerido(rel, name) {
  if (/^Acervo\/Aulas\//.test(rel)) return "aula";
  if (/^Acervo\/Textos\//.test(rel)) return "texto";
  if (/^Acervo\/Questoes\//.test(rel)) return "banco";
  if (/^Acervo\/Ciclos\//.test(rel)) return "ciclo";
  if (/^Anos\/\d{4}\/Planejamento \d{4}$/.test(rel.replace(/\.md$/, ""))) return "planejamento";
  if (/\/Planejamento\//.test(rel)) return /^\d{3}\b/.test(name) ? "ciclo" : "plano";
  if (/\/Provas\//.test(rel)) return "prova";
  if (/\/Semanas\//.test(rel)) return "semana";
  if (/\/Correcoes\//.test(rel)) return "correcao";
  if (/\/Diarios\//.test(rel)) return "diario";
  if (/\/Alunos\//.test(rel)) return "aluno";
  return null;
}

const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[\s_]+/g, " ");

const STATUS = { "nao iniciado": "pendente", "a fazer": "pendente", "para fazer": "pendente", pendente: "pendente", "em andamento": "andamento", andamento: "andamento", "em progresso": "andamento",
  finalizado: "finalizado", finalizada: "finalizado", concluido: "finalizado", concluida: "finalizado", pronto: "finalizado", pronta: "finalizado", feito: "finalizado", arquivado: "arquivado", arquivada: "arquivado" };
const TRANSCRICAO = { pendente: "pendente", "aguardando revisao": "aguardando-revisao", "aguardando-revisao": "aguardando-revisao", revisar: "aguardando-revisao", aprovada: "aprovada", aprovado: "aprovada" };

/** Valor corrigido de um campo com valor fora do vocabulário, ou `null` se não há correção segura. */
export function valorCorrigido(campo, bruto) {
  const v = String(bruto ?? "").trim();
  if (campo === "status") return STATUS[norm(v)] ?? null;
  if (campo === "transcricao") return TRANSCRICAO[norm(v)] ?? null;
  if (campo === "ano") { const m = /^([6-9])\s*(º|°|o|ª|a)?(\s*ano)?$/i.exec(v); return m ? m[1] : null; }
  if (campo === "trimestre") { const m = /^([1-3])\s*(º|°|o|ª|a)?(\s*(tri|trimestre))?$/i.exec(v); return m ? m[1] : null; }
  if (campo === "turma") return /^\d{2}$/.test(v) ? v : null;
  return null;
}

/**
 * Plano de correção para um aviso `x` ({ code, msg, … }) da nota `it` ({ rel, name }) com o texto atual `texto`.
 * Devolve `{ rotulo, novo }` ou `null` (sem correção automática, ou nada a mudar).
 */
export function planejar(x, it, texto) {
  const plano = (rotulo, novo) => (novo !== texto ? { rotulo, novo } : null);
  const fm = parseFm(texto), get = (k) => fm.entries.find((e) => e.key === k);
  switch (x.code) {
    case "sem-tipo": case "tipo-desconhecido": {
      const t = tipoSugerido(it.rel, it.name);
      return t && get("tipo")?.value !== t ? plano(`tipo: ${t}`, setProp(texto, "tipo", t)) : null;
    }
    case "campo-obsoleto":
      return /`turmas`/.test(x.msg) && get("turmas") ? plano("tirar o campo turmas", setProp(texto, "turmas", undefined)) : null;
    case "marca-pendente":
      return get("transcricao")?.value === "aprovada" ? plano("transcricao: aguardando-revisao", setProp(texto, "transcricao", "aguardando-revisao")) : null;
    case "valor-invalido": {
      const campo = /^(\w+)/.exec(x.msg)?.[1], e = campo && get(campo);
      if (!e) return null;
      if (campo === "turmas") { // lista de turmas escritas como número ([61, 62]): volta a ser texto
        return e.items?.length && e.items.every((i) => /^\d{2}$/.test(i)) ? plano(`turmas: ${e.items.map((i) => `"${i}"`).join(", ")}`, setProp(texto, "turmas", e.items)) : null;
      }
      if (campo === "ano") { // vários anos: lista ([6º, 7º]) ou texto ("6, 7"); cada um é corrigido, e a lista sai ordenada e sem repetição
        const bruto = e.items ?? String(e.value ?? "").split(/[\s,;]+(?:e[\s,;]+)?/).filter(Boolean);
        const anos = bruto.map((x) => valorCorrigido("ano", x));
        if (!bruto.length || anos.includes(null)) return null;
        const lista = [...new Set(anos)].sort(), novo = lista.length === 1 ? lista[0] : lista;
        return plano(`ano: ${lista.length === 1 ? lista[0] : `[${lista.join(", ")}]`}`, setProp(texto, "ano", novo));
      }
      if (e.items) return null;
      const novo = valorCorrigido(campo, e.value);
      return novo === null ? null : plano(`${campo}: ${novo}`, setProp(texto, campo, novo, campo === "turma" ? { aspas: true } : undefined));
    }
    default: return null;
  }
}

/** Códigos de aviso que têm correção automática (o que mostra o botão "Corrigir todos"). */
export const CODIGOS_AUTOMATICOS = new Set(["sem-tipo", "tipo-desconhecido", "campo-obsoleto", "marca-pendente", "valor-invalido"]);
