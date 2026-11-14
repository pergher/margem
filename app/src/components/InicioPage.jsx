import { SemanaPage } from "@/components/SemanaPage";
import { AnoPage } from "@/components/AnoPage";
import { HojePage } from "@/components/HojePage";

/** Hoje, Semana e Ano e ciclos: as três visões do trabalho diário, escolhidas no menu lateral. */
export function InicioPage({ items, onOpen, onRefresh, onCiclo, onCorrecao, modo, setModo }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {modo === "hoje"
        ? <HojePage items={items} onOpen={onOpen} onRefresh={onRefresh} onCorrecao={onCorrecao} onSemana={() => setModo("semana")} />
        : modo === "semana"
        ? <SemanaPage items={items} onOpen={onOpen} onRefresh={onRefresh} />
        : <AnoPage items={items} onOpen={onOpen} onRefresh={onRefresh} onCiclo={onCiclo} />}
    </div>
  );
}
