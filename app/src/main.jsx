import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/literata";
import "@fontsource-variable/lora";
import "@fontsource-variable/nunito";
import "@fontsource-variable/roboto-mono";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/manrope";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/fira-code";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./index.css";
import "./themes.css";
import App from "./App";
import { ToastProvider } from "@/components/ui/estado";
import { aplicarTema, aplicarEstiloCallout, lerTemas } from "./lib/temas";
import { aplicarFonte } from "./lib/fontes";
// Evita o "flash" do tema errado antes do React montar.
try { const t = lerTemas(); aplicarTema(t.claro, t.escuro, JSON.parse(localStorage.getItem("tema") || '"light"') === "dark"); } catch { /* tema padrão */ }
try { aplicarFonte(JSON.parse(localStorage.getItem("fonte") || '"sobrio"'), JSON.parse(localStorage.getItem("tamanhoTexto") || "17")); } catch { /* padrão */ }
try { aplicarEstiloCallout(JSON.parse(localStorage.getItem("estiloCallout") || '"preenchido"')); } catch { /* padrão */ }
createRoot(document.getElementById("root")).render(<ToastProvider><App /></ToastProvider>);
