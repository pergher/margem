import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { invoke } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { Estado } from "@/components/ui/estado";

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
        <button onClick={escolher} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">
          <FolderOpen className="h-4 w-4" strokeWidth={1.6} />Escolher pasta…
        </button>
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
          <button onClick={outra} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"><FolderOpen className="h-4 w-4" strokeWidth={1.6} />Escolher a nova pasta…</button>
        </div>
        {erro && <Estado tipo="err" className="mt-4 text-sm">{erro}</Estado>}
      </div>
    </div>
  );
}
