// Blocos didáticos em Markdown (cercas ```exemplo e ```sintaxe). Só texto → HTML: o mesmo resultado serve ao editor ao vivo e à visão da aula.
//
// ```exemplo                          Cada exemplo é um grupo de linhas (separados por linha em branco ou por novo `errado:`).
// errado: Eles [forão]{erro} ao mercado.   Marcas `[trecho]{erro}` (errado) e `[trecho]{ok}` (certo).
// certo: Eles [foram]{ok} ao mercado.
// porquê: "Foram" é o pretérito de "ir".   (também `regra:`)
// ```                                 Com `exemplo exercicio` só o errado aparece, com linha de resposta (gabarito fora).
//
// ```sintaxe                          Uma frase por linha; `[trecho]{rótulo}` pode ficar dentro de outro (o predicado agrupa termos).
// [Os alunos]{sujeito} [[leram]{verbo} [o livro]{objeto direto}]{predicado}
// ```                                 Camadas: sem prefixo = função sintática; `{:subst}` = classe de palavra; `{#principal}` = oração.
//                                     Com `sintaxe exercicio` mostra só a frase e linhas para a análise.

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Idioma e opções da linha de abertura da cerca (` ```exemplo exercicio `). */
export function cabecalhoCerca(linha) {
  const m = /^\s*(?:```|~~~)\s*([\wçã-]+)\s*(.*)$/.exec(linha);
  return m ? { lang: m[1].toLowerCase(), opcoes: m[2].toLowerCase().split(/\s+/).filter(Boolean) } : null;
}

// ---------- exemplo ----------
const CHAVES = { errado: "errado", certo: "certo", correto: "certo", porque: "porque", regra: "porque" }; // chaves sem acento
const sem = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function parseExemplos(codigo) {
  const itens = [];
  let atual = null;
  for (const raw of codigo.split("\n")) {
    const l = raw.trim();
    if (!l) { atual = null; continue; }
    const m = /^([\wçê]+)\s*:\s*(.*)$/.exec(l), chave = m && CHAVES[sem(m[1])];
    if (!chave) { if (atual) atual.porque = (atual.porque ? atual.porque + " " : "") + l; continue; }
    if (!atual || (chave === "errado" && atual.errado != null)) { atual = {}; itens.push(atual); }
    atual[chave] = m[2];
  }
  return itens;
}

function marcas(s) {
  return esc(s).replace(/\[([^\]]+)\]\{(erro|ok)\}/g, (_, t, k) => `<mark class="ex-${k}">${t}</mark>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
}

const ACOES = { imagem: "Copiar como imagem", texto: "Copiar código", pedir: "Pedir ao Claude" };

/** O bloco como está na nota (cerca, opções e conteúdo), para colar em outra nota. */
export const blocoComoMarkdown = ({ lang, opcoes = [], codigo }) => "```" + lang + (opcoes.length ? " " + opcoes.join(" ") : "") + "\n" + codigo.replace(/\n+$/, "") + "\n```\n";
/** Moldura do bloco: guarda idioma, opções e fonte (para as ações de copiar/pedir) e a barra de botões. */
function moldura(cls, lang, opcoes, codigo, interior, acoes) {
  const btn = acoes.map((a) => `<button type="button" class="bl-btn" data-acao="${a}">${ACOES[a]}</button>`).join("");
  return `<div class="${cls} bl" data-lang="${lang}" data-opcoes="${esc(opcoes.join(" "))}" data-fonte="${esc(codigo)}"><div class="bl-acoes">${btn}</div>${interior}</div>`;
}

export function htmlExemplo(codigo, opcoes = []) {
  const itens = parseExemplos(codigo), exercicio = opcoes.includes("exercicio") || opcoes.includes("exercício");
  if (!itens.length) return null;
  const linhas = itens.map((x, i) => exercicio
    ? `<li class="ex-item"><div class="ex-l ex-errado"><span class="ex-r">${i + 1}.</span><span>${marcas((x.errado ?? x.certo ?? "").replace(/\[([^\]]+)\]\{(?:erro|ok)\}/g, "[$1]{erro}"))}</span></div><div class="ex-resp">Resposta:</div></li>`
    : `<li class="ex-item">${x.errado != null ? `<div class="ex-l ex-errado"><span class="ex-r">✗ errado</span><span>${marcas(x.errado)}</span></div>` : ""}${x.certo != null ? `<div class="ex-l ex-certo"><span class="ex-r">✓ certo</span><span>${marcas(x.certo)}</span></div>` : ""}${x.porque ? `<div class="ex-l ex-porque"><span class="ex-r">porquê</span><span>${marcas(x.porque)}</span></div>` : ""}</li>`);
  return moldura("ex-bloco", "exemplo", opcoes, codigo, `<ol class="ex-lista">${linhas.join("")}</ol>`, ["imagem", "texto"]);
}

// ---------- sintaxe ----------
const CAMADAS = { f: "Função", k: "Classe de palavra", o: "Oração" };

function fechar(s, i) { // índice do `]` que casa com o `[` em i, ou -1
  let d = 0;
  for (let j = i; j < s.length; j++) { if (s[j] === "[") d++; else if (s[j] === "]" && --d === 0) return j; }
  return -1;
}

/** Frase com marcas → árvore: `{t:"txt", v}` ou `{t:"g", rotulo, camada, filhos}`. */
export function parseSintaxe(s) {
  const nos = [];
  let buf = "", i = 0;
  const solta = () => { if (buf) { nos.push({ t: "txt", v: buf }); buf = ""; } };
  while (i < s.length) {
    if (s[i] === "[") {
      const j = fechar(s, i), k = j >= 0 && s[j + 1] === "{" ? s.indexOf("}", j + 1) : -1;
      if (k > 0) {
        solta();
        let rotulo = s.slice(j + 2, k).trim(), camada = "f";
        if (rotulo[0] === ":") { camada = "k"; rotulo = rotulo.slice(1).trim(); } else if (rotulo[0] === "#") { camada = "o"; rotulo = rotulo.slice(1).trim(); }
        nos.push({ t: "g", rotulo, camada, filhos: parseSintaxe(s.slice(i + 1, j)) });
        i = k + 1; continue;
      }
    }
    buf += s[i++];
  }
  solta();
  return nos;
}

export const matiz = (r) => [...r.toLowerCase()].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
const camadasDe = (nos, set = new Set()) => { nos.forEach((n) => { if (n.t === "g") { set.add(n.camada); camadasDe(n.filhos, set); } }); return set; };
export const textoDe = (nos) => nos.map((n) => (n.t === "txt" ? n.v : textoDe(n.filhos))).join("");
const nosHtml = (nos) => nos.map((n) => n.t === "txt"
  ? `<span class="sx-t">${esc(n.v)}</span>`
  : `<span class="sx-g sx-${n.camada} sx-h${matiz(n.rotulo)}"><span class="sx-c">${nosHtml(n.filhos)}</span><span class="sx-l">${esc(n.rotulo)}</span></span>`).join("");

export function htmlSintaxe(codigo, opcoes = []) {
  const frases = codigo.split("\n").map((l) => l.trim()).filter(Boolean).map(parseSintaxe);
  if (!frases.length) return null;
  const exercicio = opcoes.includes("exercicio") || opcoes.includes("exercício");
  if (exercicio) return moldura("sx-bloco", "sintaxe", opcoes, codigo, frases.map((f, i) => `<div class="sx-ex"><div class="sx-frase-ex">${i + 1}. ${esc(textoDe(f))}</div><div class="ex-resp">Análise:</div></div>`).join(""), ["imagem", "texto"]);
  const usadas = [...camadasDe(frases.flat())];
  const alternar = usadas.length > 1
    ? `<div class="sx-camadas" aria-label="Camadas">${usadas.map((c) => `<label><input type="checkbox" checked data-camada="${c}">${CAMADAS[c]}</label>`).join("")}</div>` : "";
  return moldura("sx-bloco", "sintaxe", opcoes, codigo, alternar + frases.map((f) => `<div class="sx-frase">${nosHtml(f)}</div>`).join(""), ["imagem", "texto", "pedir"]);
}

/** HTML do bloco se a cerca é `exemplo` ou `sintaxe` e tem conteúdo; senão `null` (o texto fica como código). */
export function htmlBloco(lang, opcoes, codigo) {
  if (lang === "exemplo") return htmlExemplo(codigo, opcoes);
  if (lang === "sintaxe") return htmlSintaxe(codigo, opcoes);
  return null;
}

/** Pedido para o Claude analisar as frases do bloco `sintaxe` (o app não analisa: monta o pedido, o professor cola a resposta no bloco). */
export function pedidoSintaxe(codigo) {
  const frases = codigo.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => textoDe(parseSintaxe(l)));
  return `Faça a análise sintática das frases abaixo (Anos Finais, nomenclatura da gramática escolar) e devolva UM bloco de código \`\`\`sintaxe, uma frase por linha, neste formato:

- cada trecho analisado: [trecho]{rótulo}; um trecho pode ficar dentro de outro (o predicado agrupa verbo, objetos e adjuntos): [Os alunos]{sujeito} [[leram]{verbo} [o livro]{objeto direto}]{predicado}.
- função sintática: sem prefixo, {sujeito}; classe de palavra: prefixo dois-pontos, {:substantivo}; oração: prefixo cerquilha, {#subordinada adverbial}.
- inclua só a camada de função, a menos que eu peça mais; mantenha o texto original e a pontuação, sem comentários dentro do bloco.

Frases:
${frases.map((f, i) => `${i + 1}. ${f}`).join("\n")}
`;
}
