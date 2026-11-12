// Diferença por linhas (LCS). Devolve [{ t: " " | "+" | "-", s }] na ordem do texto novo; "-" = só na versão antiga.
export function diffLinhas(antigo, novo) {
  const a = antigo.split("\n"), b = novo.split("\n");
  let i0 = 0;
  while (i0 < a.length && i0 < b.length && a[i0] === b[i0]) i0++;
  let fa = a.length, fb = b.length;
  while (fa > i0 && fb > i0 && a[fa - 1] === b[fb - 1]) { fa--; fb--; }
  const A = a.slice(i0, fa), B = b.slice(i0, fb);
  let meio;
  if (A.length * B.length > 4_000_000) meio = [...A.map((s) => ({ t: "-", s })), ...B.map((s) => ({ t: "+", s }))];
  else {
    const L = Array.from({ length: A.length + 1 }, () => new Uint32Array(B.length + 1));
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    meio = [];
    let i = 0, j = 0;
    while (i < A.length && j < B.length) {
      if (A[i] === B[j]) { meio.push({ t: " ", s: A[i] }); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) meio.push({ t: "-", s: A[i++] });
      else meio.push({ t: "+", s: B[j++] });
    }
    while (i < A.length) meio.push({ t: "-", s: A[i++] });
    while (j < B.length) meio.push({ t: "+", s: B[j++] });
  }
  return [...a.slice(0, i0).map((s) => ({ t: " ", s })), ...meio, ...a.slice(fa).map((s) => ({ t: " ", s }))];
}
