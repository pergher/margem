import { useEffect, useState } from "react";
import { invoke } from "@/lib/api";
import { parseCiclo, lerCiclos } from "@/lib/ciclos";
import { CicloPage } from "@/components/CicloPage";
import { Estado, Carregando, Erro } from "@/components/ui/estado";

/** Mostra a tela Ciclo para a nota de ciclo aberta (path). */
export function CicloDaNota({ item, items, onOpen, onAno, tick, onRename }) {
  const [ciclo, setCiclo] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    setCiclo(null); setErro("");
    invoke("read_note", { path: item.path }).then(async (t) => { const c = parseCiclo(item, t); const pos = c.legado ? null : (await lerCiclos(items).catch(() => null))?.ciclos.find((x) => x.path === item.path); setCiclo(pos ? { ...c, ano: pos.ano, tri: pos.tri, ciclo: pos.ciclo, incluido: pos.incluido } : c); }).catch((e) => setErro(String(e)));
  }, [item.path, tick]);
  if (erro) return <Erro>{erro}</Erro>;
  if (!ciclo) return <Carregando>Lendo o ciclo…</Carregando>;
  return <CicloPage ciclo={ciclo} items={items} onOpen={onOpen} onAno={onAno} onChange={setCiclo} onRename={onRename} />;
}
