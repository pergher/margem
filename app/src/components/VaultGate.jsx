import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { invoke } from "@/lib/api";
import { Logo } from "@/components/Logo";

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
        {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}
      </div>
    </div>
  );
}
