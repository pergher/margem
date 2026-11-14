import { corAno } from "@/lib/cores";

/** Anos (6º ao 9º) como pílulas coloridas: a cor é o símbolo do ano, e o número continua escrito. */
export function Anos({ anos }) {
  return anos?.length ? <span className="inline-flex items-center gap-1">{anos.map((x) => <span key={x} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium" style={{ color: corAno(x), background: `color-mix(in srgb, ${corAno(x)} 14%, transparent)` }}>{x}º</span>)}</span> : null;
}
