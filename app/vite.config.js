import { execFileSync } from "node:child_process";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

// Só em desenvolvimento: serve o vault de teste por HTTP para poder ver o layout num navegador comum.
function devVault() {
  const root = path.resolve(import.meta.dirname, "../tests/fixtures/vault");
  const walk = (d, out = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      e.isDirectory() ? walk(p, out) : e.name.endsWith(".md") && out.push(p);
    }
    return out;
  };
  return {
    name: "dev-vault",
    configureServer(s) {
      s.middlewares.use("/__vault", (req, res) => {
        const u = new URL(req.url, "http://x");
        const send = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
        if (u.pathname === "/list") return send(walk(root).map((p) => ({ name: path.basename(p, ".md"), path: p, rel: path.relative(root, p).split(path.sep).join("/") })));
        const p = path.resolve(u.searchParams.get("path") || "");
        if (u.pathname === "/read" && p.startsWith(root)) { if (!fs.existsSync(p)) { res.statusCode = 404; return res.end(); } return send(fs.readFileSync(p, "utf8")); }
        if (u.pathname === "/search") {
          const fold = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const terms = fold(u.searchParams.get("q") || "").split(/\s+/).filter(Boolean);
          if (!terms.length) return send([]);
          const hits = [];
          for (const f of walk(root)) {
            const text = fs.readFileSync(f, "utf8"), low = fold(text);
            if (!terms.every((t) => low.includes(t))) continue;
            const count = terms.reduce((n, t) => n + low.split(t).length - 1, 0);
            const lines = text.split("\n");
            let best = 0, score = -1;
            lines.forEach((l, i) => { const k = terms.filter((t) => fold(l).includes(t)).length; if (k > score) { score = k; best = i; } });
            hits.push({ name: path.basename(f, ".md"), path: f, rel: path.relative(root, f).split(path.sep).join("/"), line: best + 1, snippet: lines[best].trim().slice(0, 160), count });
          }
          return send(hits.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 50));
        }
        if (u.pathname === "/embed") {
          const target = (u.searchParams.get("target") || "").split("/").pop().trim();
          if (!target.includes(".") || target.toLowerCase().endsWith(".md")) {
            const stem = target.replace(/\.md$/i, "").toLowerCase();
            const f = walk(root).find((x) => path.basename(x, ".md").toLowerCase() === stem);
            if (!f) return send(null);
            const text = fs.readFileSync(f, "utf8").replace(/^---\n[\s\S]*?\n---\n?/, "");
            return send({ kind: "note", name: path.basename(f, ".md"), path: f, text: text.slice(0, 20000) });
          }
          const find = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name.startsWith(".")) continue; const q = path.join(d, e.name); if (e.isDirectory()) { const r = find(q); if (r) return r; } else if (e.name.toLowerCase() === target.toLowerCase()) return q; } };
          const f = find(root);
          if (!f) return send(null);
          const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" }[path.extname(f).slice(1).toLowerCase()];
          return send(mime ? { kind: "image", name: path.basename(f), data: `data:${mime};base64,` + fs.readFileSync(f).toString("base64") } : { kind: "file", name: path.basename(f) });
        }
        if (u.pathname === "/health") {
          // dev: roda o CLI `vault validate` (target/debug/vault) e converte as linhas em JSON
          const bin = path.resolve(import.meta.dirname, "../target/debug/vault");
          let txt = "";
          try { txt = execFileSync(bin, ["validate", root], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); } catch (e) { txt = String(e.stdout ?? ""); } // o CLI sai com código ≠ 0 quando há avisos
          {
            return send(txt.split("\n").map((l) => /^(erro|aviso|info)\s+(.*):(\d+) \[([a-z-]+)\] (.*)$/.exec(l)).filter(Boolean)
              .map((m) => ({ severity: m[1], note: m[2], line: Number(m[3]), code: m[4], msg: m[5] })));
          }
        }
        if (u.pathname === "/info") {
          const REQ = { aula: ["ano", "status"], plano: ["ano", "trimestre"], ciclo: ["turma", "objetivo", "inicio", "fim", "status"], texto: ["titulo", "autor", "genero", "fonte"], banco: ["ano", "conteudos", "textos"], prova: ["turma", "data", "questoes", "valor"], correcao: ["turma", "mes", "atividade", "status"] };
          const name = path.basename(p, ".md");
          const text = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
          const tipo = /^tipo:\s*(\S+)/m.exec(text.split(/\n---/)[0])?.[1] ?? null;
          const backlinks = walk(root).filter((f) => f !== p).flatMap((f) => {
            const t = fs.readFileSync(f, "utf8"), m = new RegExp("\\[\\[" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\]#|]", "i").exec(t);
            return m ? [{ name: path.basename(f, ".md"), path: f, rel: path.relative(root, f).split(path.sep).join("/"), line: t.slice(0, m.index).split("\n").length }] : [];
          });
          return send({ issues: tipo ? [] : [{ line: 1, severity: "aviso", code: "sem-tipo", msg: "nota sem `tipo` no frontmatter" }], backlinks, tipo, required: REQ[tipo] ?? [], status: ["pendente", "andamento", "finalizado", "arquivado"] });
        }
        if (u.pathname === "/resolve") {
          const t = (u.searchParams.get("target") || "").split("/").pop().toLowerCase();
          return send(walk(root).find((f) => path.basename(f, ".md").toLowerCase() === t) ?? null);
        }
        res.statusCode = 404; res.end();
      });
    },
  };
}

export default {
  plugins: [react(), devVault()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "es2022" },
};
