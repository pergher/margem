import { expect, it } from "vitest";
import { html } from "../AulaDaNota";

it("links javascript: do arquivo não viram href executável", () => {
  const h = html("[x](javascript:alert(1)) [y](  JavaScript:alert(2)) ![z](data:text/html;base64,AAAA) [ok](https://exemplo.com)");
  expect(h).not.toMatch(/javascript:/i);
  expect(h).not.toMatch(/data:text/i);
  expect(h).toContain('href="https://exemplo.com"');
});
