// Erros comuns da turma: conta, nas transcrições de uma correção, os erros de ortografia marcados `{errado|certo}` e monta
// um bloco ```exemplo com as frases (sem nomes de alunos: só o texto da frase; o professor confere antes de inserir).
import { ERRO } from "@/lib/correcao";

const limpa = (s) => s.replace(/[[\]]/g, "");

/** Frase (até o ponto/`!`/`?`/quebra de linha) em volta do trecho [ini, fim) e sua versão errada e certa, com o erro-alvo marcado. */
function fraseDe(texto, ini, fim) {
  const a = Math.max(texto.lastIndexOf(".", ini - 1), texto.lastIndexOf("!", ini - 1), texto.lastIndexOf("?", ini - 1), texto.lastIndexOf("\n", ini - 1)) + 1;
  const rest = texto.slice(fim), z = fim + (rest.search(/[.!?\n]/) < 0 ? rest.length : rest.search(/[.!?\n]/) + 1);
  const trecho = texto.slice(a, z);
  let errada = "", certa = "", i = 0;
  for (const m of trecho.matchAll(new RegExp(ERRO.source, "g"))) {
    const alvo = a + m.index === ini, antes = limpa(trecho.slice(i, m.index));
    errada += antes; certa += antes; i = m.index + m[0].length;
    const [, p, x, y] = m;
    if (p) { errada += x; certa += y ?? x; continue; } // pontuação: antes|depois
    errada += alvo ? `[${limpa(x)}]{erro}` : x;
    certa += alvo ? `[${limpa(y ?? x)}]{ok}` : (y ?? x);
  }
  const resto = limpa(trecho.slice(i));
  return { errada: (errada + resto).trim(), certa: (certa + resto).trim() };
}

/** `textos`: um texto por aluno. Devolve os erros ordenados por quantos alunos erraram: `{ errado, certo, n, errada, certa }`. */
export function errosComuns(textos) {
  const mapa = new Map();
  textos.forEach((t, aluno) => {
    for (const m of t.matchAll(new RegExp(ERRO.source, "g"))) {
      const errado = (m[2] ?? "").trim();
      if (m[1] || !errado) continue; // pontuação não entra
      const certo = (m[3] ?? "").trim(), chave = `${errado.toLowerCase()}→${certo.toLowerCase()}`;
      const e = mapa.get(chave) ?? { errado, certo, alunos: new Set(), ...fraseDe(t, m.index, m.index + m[0].length) };
      e.alunos.add(aluno); mapa.set(chave, e);
    }
  });
  return [...mapa.values()].map(({ alunos, ...e }) => ({ ...e, n: alunos.size })).sort((a, b) => b.n - a.n || a.errado.localeCompare(b.errado, "pt-BR"));
}

/** Bloco ```exemplo com os erros escolhidos (uma frase errada e, se houver correção, a certa). */
export function blocoDeErros(erros) {
  const itens = erros.map((e) => [`errado: ${e.errada}`, e.certo ? `certo: ${e.certa}` : null].filter(Boolean).join("\n"));
  return "```exemplo\n" + itens.join("\n\n") + "\n```";
}
