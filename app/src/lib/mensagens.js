// Mensagens prontas para copiar e enviar por outros aplicativos (WhatsApp, e-mail, sistema da escola).
// São sugestões geradas a partir dos registros do aluno; o professor revisa antes de enviar.
import { COMPORTAMENTOS, NEGATIVOS, indiceSemana, tipoAcao } from "@/lib/diario";

const MINUSCULA = { conversa: "conversa em sala", produtividade: "falta de produtividade", espelho: "ficar fora do espelho de classe", andando: "andar pela sala", briga: "brigas", celular: "uso de celular" };
const lista = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);
const dia = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
const dataBr = (iso) => { const [, m, d] = iso.split("-"); return `${+d}/${+m}`; };

/** Ocorrências negativas das últimas `semanas` semanas, da mais antiga à mais recente. */
export function recentes(ocs, hoje = new Date(), semanas = 4) {
  const atual = indiceSemana(hoje);
  return ocs.filter((o) => o.data && indiceSemana(o.data) > atual - semanas && indiceSemana(o.data) <= atual && o.cats.some((c) => NEGATIVOS.includes(c.id)))
    .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
}

/** "conversa em sala (4), uso de celular (2)" */
export function resumoDeComportamentos(ocs) {
  const tot = COMPORTAMENTOS.map((c) => [c.id, ocs.filter((o) => o.cats.some((x) => x.id === c.id)).length]).filter(([, n]) => n);
  return lista(tot.sort((a, b) => b[1] - a[1]).map(([id, n]) => `${MINUSCULA[id]} (${n})`));
}

const jaFeito = (acoes) => acoes.filter((a) => a.estado !== "solicitada" && a.estado !== "agendada" && a.estado !== "planejada" && a.tipo !== "informar")
  .sort((a, b) => a.data.localeCompare(b.data)).map((a) => `${tipoAcao(a.tipo).longo.toLowerCase()} em ${dataBr(a.data)}`);

function contexto({ nome, turma, ocs, acoes, hoje }) {
  const rec = recentes(ocs, hoje);
  return { nome, turma, rec, resumo: resumoDeComportamentos(rec), feito: jaFeito(acoes) };
}
const comentarioDe = (c) => (c?.trim() ? `\n\n${c.trim()}` : "");
const registros = (rec) => rec.slice(-5).map((o) => `• semana de ${dia(o.data)} (${o.aula}): ${o.texto || "sem anotação"}`).join("\n");

/** Relato à direção sobre o que vem acontecendo com o aluno. */
export function mensagemInformarDirecao(d) {
  const { nome, turma, rec, resumo, feito } = contexto(d);
  return [
    `Prezada direção, gostaria de relatar o que tenho observado com ${nome}, da turma ${turma}.`,
    rec.length ? `Nas últimas 4 semanas, registrei: ${resumo}.\n\n${registros(rec)}` : "Neste momento não há ocorrências recentes registradas, mas considero importante deixar o relato.",
    feito.length ? `Já realizei: ${lista(feito)}.` : "Ainda não houve outra providência da minha parte.",
  ].join("\n\n") + `${comentarioDe(d.comentario)}\n\nFico à disposição para conversar.`;
}

/** Aviso aos responsáveis. */
export function mensagemNotificarResponsaveis(d) {
  const { nome, rec, resumo, feito } = contexto(d);
  return [
    `Prezados responsáveis, tudo bem? Escrevo sobre ${nome}.`,
    rec.length ? `Nas últimas semanas, observei em aula: ${resumo}.` : "Gostaria de conversar sobre o desempenho e o comportamento em sala.",
    feito.some((f) => f.startsWith("conversar")) ? "Já conversei com o aluno, e conto com o apoio de vocês para reforçar essa orientação em casa." : "Conto com o apoio de vocês para conversar sobre isso em casa.",
  ].join("\n\n") + `${comentarioDe(d.comentario)}\n\nFico à disposição para qualquer esclarecimento.`;
}

/** Pedido à direção para agendar uma conversa com os responsáveis. */
export function mensagemPedirAgendamento(d) {
  const { nome, turma, rec, resumo, feito } = contexto(d);
  return [
    `Prezada direção, solicito o agendamento de uma conversa com os responsáveis de ${nome}, da turma ${turma}.`,
    rec.length ? `Motivo: nas últimas 4 semanas, registrei ${resumo}.` : "Motivo: preciso conversar com os responsáveis sobre o desempenho e o comportamento do aluno.",
    feito.length ? `Já realizei: ${lista(feito)}.` : "",
  ].filter(Boolean).join("\n\n") + `${comentarioDe(d.comentario)}\n\nPeço, por gentileza, que me informem a data e o horário disponíveis.`;
}

/** Mensagem sugerida para cada ação (nada para as que não têm). */
export function mensagemDaAcao(tipo, estado, dados) {
  if (tipo === "informar") return { titulo: "Mensagem para a direção", texto: mensagemInformarDirecao(dados) };
  if (tipo === "notificar") return { titulo: "Mensagem para os responsáveis", texto: mensagemNotificarResponsaveis(dados) };
  if (tipo === "agendar" && estado === "solicitada") return { titulo: "Pedido de agendamento à direção", texto: mensagemPedirAgendamento(dados) };
  return null;
}
