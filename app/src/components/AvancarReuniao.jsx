import { useState } from "react";

const entrada = "h-8 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary";
const horaCurta = (h) => (h ? (/^(\d{1,2}):00$/.test(h) ? `${+h.split(":")[0]}h` : `${+h.split(":")[0]}h${h.split(":")[1]}`) : "");

/**
 * Passo seguinte de uma reunião com os responsáveis: solicitada → agendada (pede data e hora) → realizada.
 * `onAvancar(patch)` recebe { estado, data?, hora? }.
 */
export function AvancarReuniao({ acao, onAvancar }) {
  const [abrir, setAbrir] = useState(false), [data, setData] = useState(acao.data), [hora, setHora] = useState("");
  const [busy, setBusy] = useState(false);
  const ir = async (patch) => { setBusy(true); try { await onAvancar(patch); } finally { setBusy(false); setAbrir(false); } };
  const bt = "rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-40";
  if (acao.estado === "agendada") return <button disabled={busy} onClick={() => ir({ estado: "realizada" })} className={bt}>Marcar como realizada</button>;
  if (acao.estado === "planejada") return <button disabled={busy} onClick={() => ir({ estado: "feita" })} className={bt}>Marcar como feita</button>;
  if (acao.estado !== "solicitada") return null;
  if (!abrir) return <button onClick={() => setAbrir(true)} className={bt}>Marcar como agendada</button>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input aria-label="Data da reunião" type="date" value={data} onChange={(e) => setData(e.target.value)} className={entrada} />
      <input aria-label="Hora da reunião" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={entrada} />
      <button disabled={!data || busy} onClick={() => ir({ estado: "agendada", data, hora: horaCurta(hora) })} className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground disabled:opacity-40">Confirmar</button>
      <button onClick={() => setAbrir(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
    </span>
  );
}
