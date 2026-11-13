import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import "./themes.css";
import App from "./App";
import { aplicarTema, aplicarEstiloCallout, lerTemas } from "./lib/temas";
// Evita o "flash" do tema errado antes do React montar.
try { const t = lerTemas(); aplicarTema(t.claro, t.escuro, JSON.parse(localStorage.getItem("tema") || '"light"') === "dark"); } catch { /* tema padrão */ }
try { aplicarEstiloCallout(JSON.parse(localStorage.getItem("estiloCallout") || '"preenchido"')); } catch { /* padrão */ }
createRoot(document.getElementById("root")).render(<App />);
