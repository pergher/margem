// Faixa acima do editor: a nota aberta mudou (ou sumiu) fora do Margem enquanto havia edições pendentes.
export function AvisoMudouFora({ aviso, onCarregar, onManter, onDispensar, onDiferencas }) {
  if (!aviso) return null;
  const btn = "font-medium underline-offset-2 hover:underline";
  return (
    <div role="alert" className="flex shrink-0 items-center gap-4 border-b bg-warn/10 px-6 py-2 text-sm">
      {aviso.tipo === "removida"
        ? <><span className="flex-1">Esta nota foi removida ou renomeada fora do Margem. O que está no editor continua aqui até você fechar a nota.</span>
          <button onClick={onDispensar} className={btn}>Entendi</button></>
        : <><span className="flex-1">Esta nota mudou fora do Margem.</span>
          {onDiferencas && <button onClick={onDiferencas} className={btn}>Ver diferenças</button>}
          <button onClick={onCarregar} className={btn}>Carregar a do disco</button>
          <button onClick={onManter} className={btn}>Manter a minha</button></>}
    </div>
  );
}
