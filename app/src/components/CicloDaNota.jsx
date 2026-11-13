import { useEffect, useState } from "react";
import { invoke } from "@/lib/api";
import { parseCiclo } from "@/lib/ciclos";
import { CicloPage } from "@/components/CicloPage";
import { Estado } from "@/components/ui/estado";

/** Mostra a tela Ciclo para a nota de ciclo aberta (path). */
export function CicloDaNota({ item, items, onOpen, onAno, tick, onRename }) {
  const [ciclo, setCiclo] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    setCiclo(null); setErro("");
    invoke("read_note", { path: item.path }).then((t) => { const c = parseCiclo(item, t); c ? setCiclo(c) : setErro("O nome do arquivo não segue o padrão de ciclo (ex.: 231 - Título)."); }).catch((e) => setErro(String(e)));
  }, [item.path, tick]);
  if (erro) return <Estado tipo="err" className="p-8 text-sm">{erro}</Estado>;
  if (!ciclo) return <div className="p-8 text-sm text-muted-foreground">Lendo o ciclo…</div>;
  return <CicloPage ciclo={ciclo} items={items} onOpen={onOpen} onAno={onAno} onChange={setCiclo} onRename={onRename} />;
}
