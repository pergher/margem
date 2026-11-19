import { useEffect, useState } from "react";
import { IconFolderOpen as FolderOpen } from "@tabler/icons-react";
import { invoke } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { Estado } from "@/components/ui/estado";

export const noAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/** Android: o sistema não dá ao app um seletor de pastas que devolva um caminho, então o app navega pelas pastas
 *  (precisa do "acesso a todos os arquivos"). Dá para digitar o caminho no campo de baixo. */
export function CaminhoDigitado({ onDone, setErro }) {
  const [dir, setDir] = useState(null);
  const [caminho, setCaminho] = useState("");
  useEffect(() => { invoke("listar_pastas", { caminho: null }).then(setDir).catch((e) => setErro(String(e))); }, [setErro]);
  const ir = (c) => invoke("listar_pastas", { caminho: c }).then((d) => { setErro(""); setDir(d); }).catch((e) => setErro(String(e)));
  const usar = async (c) => { try { const r = await invoke("set_vault_root", { path: c }); if (r) onDone(r); } catch (e) { setErro(String(e)); } };
  return (
    <div className="mt-6 flex flex-col gap-2 text-left">
      {dir && <>
        <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-xs"><FolderOpen aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.6} /><code className="min-w-0 flex-1 break-all">{dir.caminho}</code></div>
        <ul className="max-h-64 divide-y overflow-auto rounded-lg border">
          {dir.pai && <li><button type="button" onClick={() => ir(dir.pai)} className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-muted-foreground">↑ Pasta acima</button></li>}
          {dir.pastas.map((n) => <li key={n}><button type="button" onClick={() => ir(`${dir.caminho}/${n}`)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm"><FolderOpen aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} /><span className="truncate">{n}</span></button></li>)}
          {!dir.pastas.length && <li className="px-3 py-3 text-sm text-muted-foreground">Nenhuma subpasta aqui.</li>}
        </ul>
        <button type="button" onClick={() => usar(dir.caminho)} className="min-h-11 rounded-lg bg-primary px-4 text-sm text-primary-foreground">{dir.temVault ? "Usar esta pasta (parece um vault)" : "Usar esta pasta"}</button>
      </>}
      <button type="button" onClick={() => invoke("abrir_permissao_arquivos").catch(() => {})} className="min-h-11 text-left text-sm text-primary underline">Abrir a tela de permissão de arquivos</button>
      <details className="mt-2 text-sm text-muted-foreground">
        <summary className="min-h-11 py-2">Digitar o caminho</summary>
        <input value={caminho} onChange={(e) => setCaminho(e.target.value)} placeholder="/storage/emulated/0/…/Escola" aria-label="Caminho da pasta do vault" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          className="min-h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground" />
        <button type="button" onClick={() => usar(caminho.trim())} disabled={!caminho.trim()} className="mt-2 min-h-11 w-full rounded-lg border px-4 text-sm disabled:opacity-40">Usar o caminho digitado</button>
      </details>
    </div>
  );
}

/** Abre o seletor de pastas do sistema e guarda a escolha. Devolve a pasta ou `null` se cancelou. */
export async function escolherPastaDoVault() {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const dir = await open({ directory: true, multiple: false, title: "Escolha a pasta do vault (a pasta Escola)" });
  if (!dir) return null;
  return invoke("set_vault_root", { path: dir });
}

/** Primeira abertura: o app ainda não sabe onde está o vault. */
export function EscolherVault({ onDone }) {
  const [erro, setErro] = useState("");
  const escolher = async () => {
    try { const r = await escolherPastaDoVault(); if (r) onDone(r); } catch (e) { setErro(String(e)); }
  };
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <Logo className="mx-auto mb-4 h-16 w-16" />
        <h1 className="text-xl font-semibold">Bem-vindo ao Margem</h1>
        <p className="mt-3 text-sm text-muted-foreground">Escolha a pasta do seu vault (a pasta <code>Escola</code>, com <code>_sistema</code>, <code>Acervo</code> e <code>Anos</code>). O app só lê e grava dentro dela. Dá para trocar depois em Configurações.</p>
        {noAndroid ? <CaminhoDigitado onDone={onDone} setErro={setErro} /> : <button onClick={escolher} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">
          <FolderOpen className="h-4 w-4" strokeWidth={1.6} />Escolher pasta…
        </button>}
        {erro && <Estado tipo="err" className="mt-4 text-sm">{erro}</Estado>}
      </div>
    </div>
  );
}

/** A pasta guardada não existe mais (movida, apagada ou disco/Drive desconectado). Nada é recriado nem apagado. */
export function VaultAusente({ caminho, onTentar, onDone }) {
  const [erro, setErro] = useState("");
  const outra = async () => { try { const r = await escolherPastaDoVault(); if (r) onDone(r); } catch (e) { setErro(String(e)); } };
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <Logo className="mx-auto mb-4 h-16 w-16" />
        <h1 className="text-xl font-semibold">Não encontro a pasta do vault</h1>
        <p className="mt-3 break-all text-sm text-muted-foreground"><code>{caminho}</code></p>
        <p className="mt-3 text-sm text-muted-foreground">Ela foi movida, renomeada ou apagada, ou o disco (ou o Google Drive) não está conectado. Seus arquivos não foram alterados: o app não recria nem apaga nada sozinho.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={onTentar} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">Tentar de novo</button>
          {!noAndroid && <button onClick={outra} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"><FolderOpen className="h-4 w-4" strokeWidth={1.6} />Escolher a nova pasta…</button>}
        </div>
        {noAndroid && <CaminhoDigitado onDone={onDone} setErro={setErro} />}
        {erro && <Estado tipo="err" className="mt-4 text-sm">{erro}</Estado>}
      </div>
    </div>
  );
}

/** Android: sem "acesso a todos os arquivos" o app não lê a pasta do Syncthing. */
export function VaultSemAcesso({ onTentar }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <Logo className="mx-auto mb-4 h-16 w-16" />
        <h1 className="text-xl font-semibold">O Margem precisa de acesso aos arquivos</h1>
        <p className="mt-3 text-sm text-muted-foreground">Para ler o vault na pasta sincronizada, libere a permissão no Android:</p>
        <ol className="mt-3 list-decimal space-y-1 pl-6 text-left text-sm text-muted-foreground">
          <li>Configurações do Android › Apps › Margem › Permissões.</li>
          <li>Arquivos e mídia (ou "Todos os arquivos") › Permitir o gerenciamento de todos os arquivos.</li>
          <li>Volte ao Margem e toque em "Tentar de novo".</li>
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">Seus arquivos não foram alterados.</p>
        <button onClick={() => invoke("abrir_permissao_arquivos").catch(() => {})} className="mt-6 block min-h-11 w-full rounded-lg bg-primary px-4 text-sm text-primary-foreground">Abrir a tela de permissão</button>
        <button onClick={onTentar} className="mt-2 block min-h-11 w-full rounded-lg border px-4 text-sm hover:bg-accent">Tentar de novo</button>
      </div>
    </div>
  );
}
