import { describe, expect, it } from "vitest";
import { htmlIA } from "../iaMarkdown";

describe("htmlIA", () => {
  it("renderiza negrito, listas, títulos e código", () => {
    const h = htmlIA("## Título\n\n**forte** e *ênfase*\n\n- um\n- dois\n\n```js\nx = 1\n```");
    expect(h).toContain("<h2"); expect(h).toContain("<strong>forte</strong>"); expect(h).toContain("<li>um</li>"); expect(h).toContain("<pre>");
  });
  it("não deixa HTML cru nem script passar", () => {
    const h = htmlIA("oi <script>alert(1)</script> <img src=x onerror=alert(1)>");
    expect(h).not.toMatch(/<(script|img)\b/i); // só tags reais contam: o texto escapado aparece como texto
    expect(h).toContain("&lt;script&gt;");
  });
  it("imagem remota vira o texto alternativo, sem pedido de rede", () => {
    const h = htmlIA("![gráfico](https://evil.example/x.png?dados=1)");
    expect(h).not.toContain("<img"); expect(h).not.toContain("evil.example"); expect(h).toContain("gráfico");
  });
  it("link vira texto: sem href, nem javascript:", () => {
    const h = htmlIA("[clique](https://x.com) e [mau](javascript:alert(1))");
    expect(h).not.toMatch(/<a\b|href=/i); expect(h).toContain("clique"); expect(h).toContain("mau");
  });
  it("texto parcial de streaming não quebra", () => {
    expect(() => htmlIA("**negrito abe")).not.toThrow();
    expect(htmlIA(undefined)).toBe("");
  });
});
