// Ações dos blocos didáticos (botões "Copiar como imagem", "Copiar código" e "Pedir ao Claude"). A imagem é desenhada direto num canvas
// (SVG com foreignObject deixaria o canvas "sujo" no WebKit e a cópia falharia).
import { parseExemplos, parseSintaxe, matiz, pedidoSintaxe, blocoComoMarkdown } from "@/lib/blocos";

const FONTE = "'Source Serif 4 Variable', Georgia, serif", UI = "'Inter Variable', system-ui, sans-serif";

function cores() {
  const cs = getComputedStyle(document.documentElement);
  const c = (v, alt) => { const x = cs.getPropertyValue(v).trim(); return x ? `hsl(${x.replace(/\s+/g, ", ")})` : alt; };
  return {
    fundo: c("--background", "#fff"), texto: c("--foreground", "#222"), suave: c("--muted-foreground", "#777"), borda: c("--border", "#ddd"),
    err: c("--err", "#d33"), ok: c("--ok", "#2a7"),
    matizes: [["--chart-1", "--primary"], ["--chart-2", "--ok"], ["--chart-3", "--warn"], ["--chart-4", "--err"], ["--chart-5", "--muted-foreground"]].map(([a, b]) => c(a, c(b, "#58f"))),
  };
}

// ---------- sintaxe ----------
function medirNos(ctx, nos, vis, k) {
  let w = 0, h = 0;
  const partes = nos.map((n) => {
    if (n.t === "txt") { ctx.font = `28px ${FONTE}`; const tw = ctx.measureText(n.v).width; return { w: tw, h: 38, desenhar: (x, y) => { ctx.font = `28px ${FONTE}`; ctx.fillStyle = k.texto; ctx.textBaseline = "alphabetic"; ctx.fillText(n.v, x, y + 29); } }; }
    const filhos = medirNos(ctx, n.filhos, vis, k), mostra = vis.has(n.camada);
    ctx.font = `600 18px ${UI}`; const lw = mostra ? ctx.measureText(n.rotulo).width + 12 : 0;
    const gw = Math.max(filhos.w, lw) + 4, gh = filhos.h + (mostra ? 32 : 0);
    return { w: gw, h: gh, desenhar: (x, y) => {
      filhos.desenhar(x + 2, y);
      if (!mostra) return;
      const cor = k.matizes[matiz(n.rotulo)], ly = y + filhos.h + 4;
      ctx.strokeStyle = cor; ctx.fillStyle = cor; ctx.lineWidth = n.camada === "o" ? 2 : 3;
      ctx.setLineDash(n.camada === "k" ? [3, 4] : []);
      const linha = (yy) => { ctx.beginPath(); ctx.moveTo(x + 1, yy); ctx.lineTo(x + gw - 1, yy); ctx.stroke(); };
      linha(ly); if (n.camada === "o") linha(ly + 5);
      ctx.setLineDash([]); ctx.font = `600 18px ${UI}`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText(n.rotulo, x + gw / 2, ly + 23); ctx.textAlign = "left";
    } };
  });
  partes.forEach((p) => { w += p.w; h = Math.max(h, p.h); });
  return { w, h, desenhar: (x, y) => { let cx = x; partes.forEach((p) => { p.desenhar(cx, y); cx += p.w; }); } };
}

function desenharSintaxe(ctx, codigo, vis, k, exercicio) {
  if (exercicio) {
    const linhas = codigo.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => parseSintaxe(l));
    return { w: 700, h: linhas.length * 70, pintar: (x, y) => linhas.forEach((f, i) => {
      ctx.font = `20px ${FONTE}`; ctx.fillStyle = k.texto; ctx.fillText(`${i + 1}. ${f.map(function t(n) { return n.t === "txt" ? n.v : n.filhos.map(t).join(""); }).join("")}`, x, y + i * 70 + 21);
      ctx.fillStyle = k.suave; ctx.font = `13px ${UI}`; ctx.fillText("Análise:", x, y + i * 70 + 46);
      ctx.strokeStyle = k.borda; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + i * 70 + 58); ctx.lineTo(x + 700, y + i * 70 + 58); ctx.stroke();
    }) };
  }
  const frases = codigo.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => medirNos(ctx, parseSintaxe(l), vis, k));
  const w = Math.max(...frases.map((f) => f.w), 100), h = frases.reduce((t, f) => t + f.h + 30, -30);
  return { w, h, pintar: (x, y) => { let cy = y; frases.forEach((f) => { f.desenhar(x, cy); cy += f.h + 30; }); } };
}

// ---------- exemplo ----------
function segmentos(s) {
  const out = []; let i = 0;
  for (const m of s.matchAll(/\[([^\]]+)\]\{(erro|ok)\}/g)) { if (m.index > i) out.push({ t: s.slice(i, m.index) }); out.push({ t: m[1], marca: m[2] }); i = m.index + m[0].length; }
  if (i < s.length) out.push({ t: s.slice(i) });
  return out;
}

function desenharExemplo(ctx, codigo, exercicio, k) {
  const itens = parseExemplos(codigo), R = 100, LH = 30;
  const linhasDe = (x, i) => exercicio
    ? [["" + (i + 1) + ".", (x.errado ?? x.certo ?? "").replace(/\[([^\]]+)\]\{(?:erro|ok)\}/g, "[$1]{erro}"), k.suave]]
    : [x.errado != null && ["✗ errado", x.errado, k.err], x.certo != null && ["✓ certo", x.certo, k.ok], x.porque && ["porquê", x.porque, k.suave]].filter(Boolean);
  let w = 300;
  const blocos = itens.map((x, i) => {
    const ls = linhasDe(x, i);
    ls.forEach(([, t]) => { ctx.font = `20px ${FONTE}`; w = Math.max(w, R + 40 + segmentos(t).reduce((a, s) => a + ctx.measureText(s.t).width, 0)); });
    return { ls, h: ls.length * LH + 20 + (exercicio ? 40 : 0) };
  });
  const h = blocos.reduce((t, b) => t + b.h + 12, -12);
  return { w, h, pintar: (x0, y0) => {
    let y = y0;
    blocos.forEach((b) => {
      ctx.strokeStyle = k.borda; ctx.lineWidth = 1; ctx.strokeRect(x0 + .5, y + .5, w - 1, b.h - 1);
      b.ls.forEach(([rot, texto, cor], j) => {
        const base = y + 10 + j * LH + 21; let cx = x0 + R;
        ctx.fillStyle = cor; ctx.font = `600 12px ${UI}`; ctx.textAlign = "left"; ctx.fillText(rot.toUpperCase(), x0 + 14, base);
        segmentos(texto).forEach((s) => {
          ctx.font = `${s.marca ? 600 : 400} 20px ${FONTE}`; ctx.fillStyle = k.texto; ctx.fillText(s.t, cx, base);
          const sw = ctx.measureText(s.t).width;
          if (s.marca) {
            ctx.strokeStyle = s.marca === "erro" ? k.err : k.ok; ctx.lineWidth = 2; ctx.beginPath();
            if (s.marca === "erro") { for (let q = 0; q <= sw; q += 3) ctx[q ? "lineTo" : "moveTo"](cx + q, base + 4 + ((q / 3) % 2 ? 1.5 : 0)); } else { ctx.moveTo(cx, base + 4); ctx.lineTo(cx + sw, base + 4); }
            ctx.stroke();
          }
          cx += sw;
        });
      });
      if (exercicio) { ctx.strokeStyle = k.borda; ctx.beginPath(); ctx.moveTo(x0 + R, y + b.h - 14); ctx.lineTo(x0 + w - 14, y + b.h - 14); ctx.stroke(); ctx.fillStyle = k.suave; ctx.font = `12px ${UI}`; ctx.fillText("Resposta:", x0 + 14, y + b.h - 18); }
      y += b.h + 12;
    });
  } };
}

/** PNG do bloco (`lang`, `opcoes`, `codigo` e, na sintaxe, as camadas ligadas). */
export function blocoParaPng({ lang, opcoes = [], codigo, camadas = ["f", "k", "o"] }) {
  const exercicio = opcoes.includes("exercicio") || opcoes.includes("exercício"), k = cores(), esc = 2, pad = 24;
  const cv = document.createElement("canvas"), ctx = cv.getContext("2d"); // o mesmo contexto mede e desenha (redimensionar só zera o estado)
  const d = lang === "sintaxe" ? desenharSintaxe(ctx, codigo, new Set(camadas), k, exercicio) : desenharExemplo(ctx, codigo, exercicio, k);
  cv.width = Math.ceil((d.w + pad * 2) * esc); cv.height = Math.ceil((d.h + pad * 2) * esc);
  ctx.scale(esc, esc); ctx.fillStyle = k.fundo; ctx.fillRect(0, 0, cv.width, cv.height);
  d.pintar(pad, pad);
  return new Promise((ok, falha) => cv.toBlob((b) => (b ? ok(b) : falha(new Error("Não deu para gerar a imagem."))), "image/png"));
}

/** Trata o clique num botão `.bl-btn` de um bloco; devolve o texto de retorno para o botão (ou `null` se não era botão). */
export async function acionarBotao(alvo) {
  const btn = alvo?.closest?.(".bl-btn"), bloco = btn?.closest(".bl");
  if (!btn || !bloco) return null;
  const lang = bloco.dataset.lang, opcoes = (bloco.dataset.opcoes || "").split(" ").filter(Boolean), codigo = bloco.dataset.fonte;
  const volta = btn.textContent;
  let msg;
  try {
    if (btn.dataset.acao === "pedir") {
      await navigator.clipboard.writeText(pedidoSintaxe(codigo)); msg = "Pedido copiado: cole no Claude";
    } else if (btn.dataset.acao === "texto") {
      await navigator.clipboard.writeText(blocoComoMarkdown({ lang, opcoes, codigo })); msg = "Código copiado";
    } else {
      const camadas = [...bloco.querySelectorAll("input[data-camada]")].filter((x) => x.checked).map((x) => x.dataset.camada);
      const png = await blocoParaPng({ lang, opcoes, codigo, ...(bloco.querySelector("input[data-camada]") ? { camadas } : {}) });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]); msg = "Imagem copiada";
    }
  } catch (e) { msg = "Não foi possível copiar"; console.warn(e); }
  btn.textContent = msg; setTimeout(() => { btn.textContent = volta; }, 2000);
  return msg;
}
