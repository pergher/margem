// Registro único de atalhos. Combinações no formato "Ctrl+Shift+K" ("Ctrl" vale também para Cmd no Mac).
import { invoke } from "@/lib/api";

export const ACTIONS = [
  { id: "search", label: "Buscar arquivo", def: "Ctrl+K" },
  { id: "palette", label: "Paleta de comandos", def: "Ctrl+P" },
  { id: "save", label: "Salvar agora", def: "Ctrl+S" },
  { id: "toggleSide", label: "Reduzir/ampliar o menu lateral", def: "Ctrl+B" },
  { id: "focus", label: "Modo foco (esconde menus e barras)", def: "Ctrl+Shift+F" },
  { id: "captura", label: "Captura rápida (Caixa de entrada)", def: "Ctrl+Shift+N" },
  { id: "ia", label: "Abrir o painel de IA", def: "Ctrl+Shift+I" },
  { id: "back", label: "Voltar na navegação", def: "Alt+ArrowLeft" },
  { id: "forward", label: "Avançar na navegação", def: "Alt+ArrowRight" },
  { id: "toggleNumeros", label: "Mostrar/ocultar a numeração das linhas", def: "Ctrl+Alt+L" },
  { id: "insertTable", label: "Inserir tabela", def: "Ctrl+Alt+T" },
  { id: "zoomIn", label: "Aumentar zoom", def: "Ctrl+=" },
  { id: "zoomOut", label: "Diminuir zoom", def: "Ctrl+-" },
  { id: "zoomReset", label: "Restaurar zoom", def: "Ctrl+0" },
  // Atalhos de tela (teclas simples, só valem na tela indicada e fora de campos de texto).
  { id: "corrNext", label: "Correção: próximo aluno", def: "J", plain: true, tela: "Correção" },
  { id: "corrPrev", label: "Correção: aluno anterior", def: "K", plain: true, tela: "Correção" },
  { id: "corrCritNext", label: "Correção: próximo critério", def: "ArrowDown", plain: true, tela: "Correção" },
  { id: "corrCritPrev", label: "Correção: critério anterior", def: "ArrowUp", plain: true, tela: "Correção" },
  { id: "corrNivel1", label: "Correção: nível 1 no critério", def: "1", plain: true, tela: "Correção" },
  { id: "corrNivel2", label: "Correção: nível 2 no critério", def: "2", plain: true, tela: "Correção" },
  { id: "corrNivel3", label: "Correção: nível 3 no critério", def: "3", plain: true, tela: "Correção" },
  { id: "corrNivel4", label: "Correção: nível 4 no critério", def: "4", plain: true, tela: "Correção" },
  { id: "corrNivel0", label: "Correção: zerar o critério", def: "0", plain: true, tela: "Correção" },
];

/** Ações de tela registradas pela página aberta (id → função). */
export const handlers = {};

const KEY = "atalhos";
const MODS = ["Control", "Shift", "Alt", "Meta", "AltGraph"];

export function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
}
export function saveOverrides(o) {
  const text = JSON.stringify(o);
  try { localStorage.setItem(KEY, text); } catch {}
  invoke("write_config", { text }).catch((e) => console.error("write_config falhou", e)); // no Tauri: arquivo na pasta de configuração
}
/** No Tauri o arquivo manda; devolve os atalhos de lá ou null se não houver. */
export async function loadFromDisk() {
  try { const t = await invoke("read_config"); return t ? JSON.parse(t) || {} : null; } catch { return null; }
}
export const effective = (o) => Object.fromEntries(ACTIONS.map((a) => [a.id, o[a.id] ?? a.def]));

/** Combinação de um KeyboardEvent, ou null se for só modificador. */
export function comboOf(e) {
  if (MODS.includes(e.key)) return null;
  let k = e.key === "+" ? "=" : e.key === "_" ? "-" : e.key;
  if (k.length === 1) k = k.toUpperCase();
  if (k === " ") k = "Space";
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey && k.length > 1) parts.push("Shift"); // Shift em tecla de símbolo/letra já muda o caractere
  if (e.shiftKey && k.length === 1 && /[A-Z]/.test(k)) parts.push("Shift");
  parts.push(k);
  return parts.join("+");
}

export const hasModifier = (c) => /^(Ctrl|Alt)\+/.test(c);

const NAMES = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" };
export const pretty = (c) => c.split("+").map((p) => NAMES[p] ?? p).join(" + ").replace(/ \+ $/, " + +");

export function conflict(map, id, combo) {
  return ACTIONS.find((a) => a.id !== id && map[a.id] === combo);
}
