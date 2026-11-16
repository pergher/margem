// Lê um banco de questões (`tipo: banco`) e verifica uma seleção para a prova de uma folha.
import { raizDe, raizBarra } from "@/lib/raiz";
import JSZip from "jszip";
import { invoke } from "@/lib/api";

const sem = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function parseQuestoes(bloco, doTexto) {
  return bloco.split(/^#### Questão /m).slice(1).map((q) => {
    const [cab, ...resto] = q.split("\n");
    const m = /^(\d+)\s*·\s*(.*)$/.exec(cab.trim());
    if (!m) return null;
    const partes = m[2].split("·").map((x) => x.trim());
    const linhas = resto.join("\n").split(/^##\s/m)[0].trim().split("\n");
    const resp = linhas.find((l) => /^\(Resposta:/i.test(l.trim()));
    const corpo = linhas.filter((l) => !/^\(Resposta:/i.test(l.trim())).join("\n").trim();
    const opcoes = linhas.filter((l) => /^\([A-E]\)/.test(l.trim())).length;
    return {
      n: Number(m[1]), categoria: doTexto ? partes[0] : null, assunto: doTexto ? null : partes[0],
      formato: doTexto ? (partes[1] ?? "") : (opcoes ? "Múltipla escolha" : "Dissertativa"),
      resposta: (resp ?? "").trim().replace(/^\(Resposta:\s*/i, "").replace(/\)\s*$/, ""), corpo, opcoes, linhasResposta: Number(/(\d+)\s*linhas?/.exec(resp ?? "")?.[1] ?? 0),
    };
  }).filter(Boolean);
}

/** Banco no formato do 7º ano: "## Textos-base" (### T1 — Gênero — Autor, Título) e "## Bloco A/B/C" com "### A1 · T1 · Dissertativa · [M]". */
function parseBancoBlocos(body) {
  const secoes = body.split(/^## /m).slice(1);
  const textos = [], independentes = [];
  let n = 0;
  const questao = (q, extra) => {
    const [cab, ...resto] = q.split("\n");
    const partes = cab.split("·").map((x) => x.trim());
    const rotulo = partes[0];
    const linhas = resto.join("\n").trim().split("\n");
    const resp = linhas.find((l) => /^\(Resposta:/i.test(l.trim()));
    const corpo = linhas.filter((l) => !/^\(Resposta:/i.test(l.trim())).join("\n").trim();
    const opcoes = linhas.filter((l) => /^\([A-E]\)/.test(l.trim())).length;
    const formato = extra.indep ? partes[2] : partes[2];
    return { n: ++n, rotulo, ...extra.campos(partes), formato: formato ?? "", nivel: /\[([^\]]+)\]\s*$/.exec(cab)?.[1] ?? "", resposta: (resp ?? "").trim().replace(/^\(Resposta:\s*/i, "").replace(/\)\s*$/, ""), corpo, opcoes, linhasResposta: Number(/(\d+)\s*linhas?/.exec(resp ?? "")?.[1] ?? 0) };
  };
  const base = secoes.find((x) => /^Textos-base/i.test(x)) ?? "";
  for (const bloco of base.split(/^### /m).slice(1)) {
    const cab = bloco.split("\n", 1)[0];
    const t = /^T(\d+)\s*—\s*([^—]+)—\s*(.*)$/.exec(cab);
    if (!t) continue;
    const linhas = bloco.split("\n").slice(1);
    const aviso = /^⚠️\s*Professor:\s*(.*)$/m.exec(bloco)?.[1] ?? "";
    const citacao = linhas.filter((l) => l.trim() && !/^Fonte:|^⚠️|^\*\(.*\)\*$/.test(l.trim())).map((l) => l.replace(/^>\s?/, "")).join("\n");
    textos.push({ n: Number(t[1]), genero: t[2].trim(), titulo: t[3].trim().replace(/\*/g, ""), aviso, citacao, questoes: [] });
  }
  const porRotulo = {};
  for (const sec of secoes) {
    const letra = /^Bloco\s+([ABC])\b/.exec(sec)?.[1];
    if (!letra) continue;
    for (const q of sec.split(/^### /m).slice(1)) {
      if (letra === "C") { const x = questao(q, { indep: true, campos: (p) => ({ categoria: null, assunto: p[1] }) }); independentes.push(x); porRotulo[x.rotulo] = x.n; continue; }
      const x = questao(q, { campos: (p) => ({ categoria: letra === "A" ? "Interpretação" : "Conteúdo", assunto: null, refTexto: Number(/^T(\d+)$/.exec(p[1])?.[1]) }) });
      x.formato = q.split("\n", 1)[0].split("·")[2]?.trim() ?? "";
      const t = textos.find((z) => z.n === x.refTexto);
      (t ?? textos[0] ?? { questoes: [] }).questoes.push(x); porRotulo[x.rotulo] = x.n;
    }
  }
  const gab = {};
  for (const sec of secoes.filter((x) => /^Gabarito/i.test(x))) for (const l of sec.split("\n")) { const m = /^-\s+\*\*([ABC]\d+):\*\*\s*(.*)$/.exec(l); if (m && porRotulo[m[1]]) gab[porRotulo[m[1]]] = m[2].trim(); }
  return { textos, independentes, gab };
}

export function parseBanco(text) {
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(text)?.[1] ?? "";
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const titulo = /^#\s+(.*)$/m.exec(body)?.[1]?.replace(/^Banco de questões\s*—\s*/, "") ?? "";
  const excl = /^Conteúdos excluídos:\s*(.*)$/m.exec(body)?.[1] ?? "";
  const excluidos = excl.split(";").map((x) => x.replace(/\(.*?\)/g, "").replace(/\.$/, "").trim()).filter(Boolean);
  const ano0 = Number(/^ano:\s*(\d+)/m.exec(fm)?.[1] ?? 0);
  if (/^##\s+Bloco\s+[ABC]\b/m.test(body)) return { titulo, ano: ano0, excluidos, ...parseBancoBlocos(body) };
  const secoes = body.split(/^## /m).slice(1);
  const textos = [], independentes = [];
  for (const s of secoes) {
    const cab = s.split("\n", 1)[0];
    const t = /^Texto\s+(\d+)\s*—\s*([^—]+)—\s*(.*)$/.exec(cab);
    if (t) {
      const aviso = /^⚠️\s*Professor:\s*(.*)$/m.exec(s)?.[1] ?? "";
      const citacao = s.split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s?/, "")).filter(Boolean).join("\n");
      textos.push({ n: Number(t[1]), genero: t[2].trim(), titulo: t[3].trim().replace(/\*/g, ""), aviso, citacao, questoes: parseQuestoes(s.split(/^### Questões/m)[1] ?? "", true) });
    } else if (/^Questões independentes/.test(cab)) independentes.push(...parseQuestoes(s, false));
  }
  const gab = {};
  for (const sec of secoes.filter((x) => /^Gabarito/i.test(x))) for (const l of sec.split("\n")) { const m = /^-\s+\*\*(\d+):\*\*\s*(.*)$/.exec(l); if (m) gab[Number(m[1])] = m[2].trim(); }
  const ano = Number(/^ano:\s*(\d+)/m.exec(fm)?.[1] ?? 0);
  return { titulo, ano, excluidos, textos, independentes, gab };
}

export const listaBancos = (items) => items.filter((i) => /^Acervo\/Questoes\/.*\.md$/.test(i.rel));

export async function lerBanco(item) { return { ...parseBanco(await invoke("read_note", { path: item.path })), path: item.path, nome: item.name }; }

// Estimativa de linhas na folha: ~95 caracteres por linha, mais as linhas de resposta.
export const linhasDaQuestao = (q) => Math.ceil(q.corpo.split("\n").reduce((s, l) => s + Math.max(1, Math.ceil(l.length / 95)), 0)) + q.linhasResposta + 1;
export const LIMITE_PADRAO = 100; // provisório: ajustável na tela (calibrar com uma prova real de uma folha)
export let LIMITE_LINHAS = LIMITE_PADRAO;
export const definirLimite = (n) => { LIMITE_LINHAS = n > 0 ? n : LIMITE_PADRAO; };

export function verificar(banco, sel) {
  const todas = [...banco.textos.flatMap((t) => t.questoes.map((q) => ({ ...q, texto: t.n }))), ...banco.independentes.map((q) => ({ ...q, texto: null }))];
  const esc = todas.filter((q) => sel.has(q.n));
  const interp = esc.filter((q) => q.categoria === "Interpretação"), cont = esc.filter((q) => q.categoria === "Conteúdo"), ind = esc.filter((q) => q.texto === null);
  const mesmoTexto = (l) => l.length > 0 && l.every((q) => q.texto === l[0].texto);
  const textosUsados = banco.textos.filter((t) => esc.some((q) => q.texto === t.n));
  const linhas = esc.reduce((s, q) => s + linhasDaQuestao(q), 0) + textosUsados.reduce((s, t) => s + Math.min(10, t.citacao.split("\n").length), 0) + 4;
  const fora = esc.filter((q) => banco.excluidos.some((e) => sem(q.corpo).includes(sem(e))));
  return { esc, textosUsados, linhas, itens: [
    { ok: interp.length === 2, rotulo: "Interpretação", info: `${interp.length} de 2` },
    { ok: cont.length === 2 && mesmoTexto([...interp, ...cont]), rotulo: "Conteúdo, do mesmo texto", info: `${cont.length} de 2` },
    { ok: ind.length === 6, rotulo: "Independentes", info: `${ind.length} de 6` },
    { ok: fora.length === 0, rotulo: "Nenhum conteúdo excluído", info: fora.length ? "veja as questões " + fora.map((q) => q.n).join(", ") : "" },
    { ok: linhas <= LIMITE_LINHAS, rotulo: "Cabe em 1 folha", info: `~${linhas} de ${LIMITE_LINHAS} linhas` },
  ] };
}

export function provaEmMarkdown(banco, sel) {
  const v = verificar(banco, sel);
  let n = 0, out = `# Prova de Língua Portuguesa · ${banco.ano}º ano\n\nNome: ____  Turma: ____  Data: ____\n`;
  for (const t of v.textosUsados) {
    out += `\n> **Texto ${t.n} · ${t.titulo}**\n` + t.citacao.split("\n").map((l) => "> " + l).join("\n") + "\n";
    for (const q of t.questoes.filter((x) => sel.has(x.n))) out += `\n${++n}. ${q.corpo.replace(/\n/g, "\n   ")}\n` + (q.linhasResposta ? "   " + "_".repeat(60) + "\n" : "");
  }
  const ind = banco.independentes.filter((q) => sel.has(q.n));
  if (ind.length) out += "\n---\nQuestões independentes\n";
  for (const q of ind) out += `\n${++n}. ${q.corpo.replace(/\n/g, "\n   ")}\n`;
  return out;
}

// ---------- sugestão, fonte, nota, exportação ----------
const todasAsQuestoes = (b) => [...b.textos.flatMap((t) => t.questoes.map((q) => ({ ...q, texto: t.n }))), ...b.independentes.map((q) => ({ ...q, texto: null }))];
const excluida = (b, q) => b.excluidos.some((e) => sem(q.corpo).includes(sem(e)));

/** Monta a seleção da regra do banco: 2 de interpretação + 2 de conteúdo do mesmo texto + 6 independentes, sem excluídos e cabendo na folha. */
export function sugerir(b) {
  const ok = (q) => !excluida(b, q);
  const t = b.textos.find((x) => x.questoes.filter((q) => q.categoria === "Interpretação" && ok(q)).length >= 2 && x.questoes.filter((q) => q.categoria === "Conteúdo" && ok(q)).length >= 2);
  const sel = new Set();
  if (t) { for (const c of ["Interpretação", "Conteúdo"]) t.questoes.filter((q) => q.categoria === c && ok(q)).slice(0, 2).forEach((q) => sel.add(q.n)); }
  const ind = b.independentes.filter(ok), cabem = [];
  for (const q of ind) { if (cabem.length === 6) break; const teste = new Set([...sel, ...cabem.map((x) => x.n), q.n]); if (verificar(b, teste).linhas <= LIMITE_LINHAS) cabem.push(q); }
  cabem.forEach((q) => sel.add(q.n));
  return sel;
}

/** Autor e fonte do texto, lidos da ficha em Acervo/Textos com o mesmo título (se houver). */
export async function fonteDoTexto(items, titulo) {
  const it = items.find((i) => /^Acervo\/Textos\//.test(i.rel) && sem(i.name) === sem(titulo)) ?? items.find((i) => /^Acervo\/Textos\//.test(i.rel) && sem(i.name).includes(sem(titulo)));
  if (!it) return null;
  const fm = /^---\n([\s\S]*?)\n---/.exec(await invoke("read_note", { path: it.path }))?.[1] ?? "";
  const g = (k) => new RegExp(`^${k}:\\s*["']?(.*?)["']?\\s*$`, "m").exec(fm)?.[1] ?? "";
  const partes = [g("autor"), g("fonte")].filter(Boolean);
  return partes.length ? partes.join(". ") : null;
}

/** Parágrafos da prova, na ordem e numeração da folha: [{ t, b?, i?, rec?, linha? }]. */
export function paragrafos(b, sel, fontes = {}, opc = {}) {
  const out = [{ t: `Prova de Língua Portuguesa · ${b.ano}º ano${opc.turma ? ` · turma ${opc.turma}` : ""}`, b: true }, { t: "Nome: ______________________   Turma: ______   Data: __________" }];
  let n = 0;
  const questao = (q) => {
    const [pri, ...resto] = q.corpo.split("\n");
    out.push({ t: `${++n}. ${pri}` }, ...resto.map((l) => ({ t: l, rec: true })));
    for (let i = 0; i < q.linhasResposta; i++) out.push({ linha: true });
  };
  for (const t of verificar(b, sel).textosUsados) {
    out.push({ t: `Texto ${t.n} · ${t.titulo}`, b: true });
    if (fontes[t.n]) out.push({ t: fontes[t.n], i: true });
    out.push(...t.citacao.split("\n").slice(0, 10).map((l) => ({ t: l, rec: true, i: true })));
    t.questoes.filter((q) => sel.has(q.n)).forEach(questao);
  }
  const ind = b.independentes.filter((q) => sel.has(q.n));
  if (ind.length) out.push({ t: "Questões independentes", b: true });
  ind.forEach(questao);
  return out;
}

export function gabarito(b, sel) {
  const ordem = [...b.textos.flatMap((t) => t.questoes.filter((q) => sel.has(q.n))), ...b.independentes.filter((q) => sel.has(q.n))];
  return [{ t: `Gabarito · ${b.titulo || "prova"}`, b: true }, ...ordem.map((q, i) => ({ t: `${i + 1}. ${b.gab?.[q.n] ?? "(sem gabarito no banco)"}` }))];
}

/** Nota `tipo: prova` (Anos/AAAA/Provas): campos turma, data, questoes, valor + prova e gabarito. */
export function provaNota(b, sel, { turma, data, valor }, fontes) {
  const ps = (l) => l.map((p) => (p.linha ? "   " + "_".repeat(60) : p.rec ? "   " + p.t : p.b ? `**${p.t}**` : p.i ? `*${p.t}*` : p.t)).join("\n\n");
  return `---\ntipo: prova\nturma: "${turma}"\ndata: ${data}\nquestoes: [${[...sel].sort((x, y) => x - y).join(", ")}]\nvalor: ${valor}\n---\n# Prova ${turma} — ${data}\n\nBanco: [[${b.nome}]]\n\n${ps(paragrafos(b, sel, fontes))}\n\n## Gabarito (professor)\n\n${ps(gabarito(b, sel))}\n`;
}
export async function salvarProva(items, b, sel, dados, fontes) {
  const raiz = raizDe(items);
  const ano = items.map((i) => /^Anos\/(\d{4})\//.exec(i.rel)?.[1]).filter(Boolean).sort().pop() ?? String(new Date().getFullYear());
  try { await invoke("create_folder", { dir: `${raiz}/Anos/${ano}`, name: "Provas" }); } catch { /* já existe */ }
  const path = await invoke("create_note", { dir: `${raiz}/Anos/${ano}/Provas`, name: `Prova ${dados.turma} - ${dados.data}` });
  await invoke("save_note", { path, text: provaNota(b, sel, dados, fontes) });
  return path;
}

const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Tamanho natural (px) de uma imagem em data URL. */
const medirImagem = (src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 }); im.onerror = () => ok(null); im.src = src; });

/**
 * .docx mínimo (fonte 10 pt, margens estreitas) a partir dos parágrafos.
 * opc.cabecalho = { escola, linha2, logo (data URL) } → topo centralizado em coluna única;
 * opc.colunas = 2 → o corpo da prova em duas colunas (seção contínua).
 */
export async function docxBlob(ps, opc = {}) {
  const cab = opc.cabecalho ?? {};
  const run = (p) => `<w:r><w:rPr>${p.b ? "<w:b/>" : ""}${p.i ? "<w:i/>" : ""}</w:rPr><w:t xml:space="preserve">${esc(p.t ?? "")}</w:t></w:r>`;
  const par = (p) => p.linha
    ? '<w:p><w:pPr><w:pBdr><w:bottom w:val="dotted" w:sz="4" w:space="1" w:color="808080"/></w:pBdr><w:spacing w:before="0" w:after="60"/></w:pPr></w:p>'
    : `<w:p><w:pPr><w:spacing w:before="${p.b ? 120 : 0}" w:after="40"/>${p.rec ? '<w:ind w:left="360"/>' : ""}</w:pPr>${run(p)}</w:p>`;
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const pg = '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="850" w:bottom="720" w:left="850" w:header="400" w:footer="400" w:gutter="0"/>';
  const dois = opc.colunas === 2;

  // topo: logo + nome da escola
  let topo = "", imagem = null, ext = "png";
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(cab.logo ?? "");
  if (m) {
    const t = await medirImagem(cab.logo);
    if (t) {
      ext = m[1] === "png" ? "png" : "jpeg"; imagem = m[2];
      const h = 540000, w = Math.round((h * t.w) / t.h); // 1,5 cm de altura (EMU)
      topo += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="40"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${w}" cy="${h}"/><wp:docPr id="1" name="Logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="logo.${ext}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
  }
  const centro = (t, b) => `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="20"/></w:pPr><w:r><w:rPr>${b ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
  if (cab.escola) topo += centro(cab.escola, true);
  if (cab.linha2) topo += centro(cab.linha2, false);

  // título e linha do nome ficam no topo também quando há duas colunas
  const corpo = dois ? ps.slice(2) : ps, cima = dois ? ps.slice(0, 2) : [];
  let xml = topo + (dois ? cima.map(par).join("") : "");
  if (dois) xml += `<w:p><w:pPr><w:sectPr>${pg}</w:sectPr></w:pPr></w:p>`; // fim da seção do topo (uma coluna)
  xml += corpo.map(par).join("");
  const final = `<w:sectPr>${dois ? '<w:type w:val="continuous"/>' : ""}${pg}${dois ? '<w:cols w:num="2" w:space="500"/>' : ""}</w:sectPr>`;

  const z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imagem ? `<Default Extension="${ext}" ContentType="image/${ext}"/>` : ""}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  z.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  if (imagem) {
    z.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.${ext}"/></Relationships>`);
    z.file(`word/media/logo.${ext}`, imagem, { base64: true });
  }
  z.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${xml}${final}</w:body></w:document>`.replace(/<w:r><w:rPr>/g, '<w:r><w:rPr><w:sz w:val="20"/>'));
  return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

/** Imprime (ou salva em PDF pelo diálogo de impressão) numa janela invisível. Mesmas opções do docxBlob. */
export function imprimir(ps, titulo = "Prova", opc = {}) {
  const cab = opc.cabecalho ?? {}, dois = opc.colunas === 2;
  const p1 = (p) => p.linha ? '<div class="l"></div>' : `<p style="${p.b ? "font-weight:bold;margin-top:6pt;" : ""}${p.i ? "font-style:italic;" : ""}${p.rec ? "margin-left:12pt;" : ""}">${esc(p.t ?? "")}</p>`;
  const topo = `<div class="topo">${cab.logo ? `<img src="${cab.logo}" alt="">` : ""}${cab.escola ? `<div class="e">${esc(cab.escola)}</div>` : ""}${cab.linha2 ? `<div>${esc(cab.linha2)}</div>` : ""}</div>`;
  const html = dois ? topo + ps.slice(0, 2).map(p1).join("") + `<div class="cols">${ps.slice(2).map(p1).join("")}</div>` : topo + ps.map(p1).join("");
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  f.contentDocument.write(`<!doctype html><title>${esc(titulo)}</title><style>@page{size:A4;margin:14mm}body{font:10pt Georgia,serif;color:#000}p{margin:0 0 2pt}.l{border-bottom:1px dotted #808080;height:11pt;break-inside:avoid}.topo{text-align:center;margin-bottom:6pt}.topo img{height:1.5cm;display:block;margin:0 auto 2pt}.topo .e{font-weight:bold}.cols{column-count:2;column-gap:10mm;margin-top:6pt}</style>${html}`);
  f.contentDocument.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 200);
}
