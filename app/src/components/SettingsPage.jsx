import { useState } from "react";
import { useEffect } from "react";
import { Keyboard, FileText, FolderOpen, Download } from "lucide-react";
import { invoke, isTauri } from "@/lib/api";
import { escolherPastaDoVault } from "@/components/VaultGate";
import { procurarAtualizacao, instalarAtualizacao, versaoDoApp } from "@/lib/atualizar";
import { lerLogo } from "@/lib/configProva";
import { useConfigProva } from "@/lib/useConfigProva";
import { ShortcutsPage } from "@/components/ShortcutsPage";
import { cn } from "@/lib/utils";

// Seções da página; novas (cabeçalho das avaliações, escola, logo…) entram aqui.
const SECOES = [
  { id: "atalhos", label: "Atalhos de teclado", icon: Keyboard },
  { id: "provas", label: "Cabeçalho das provas", icon: FileText },
  { id: "vault", label: "Pasta do vault", icon: FolderOpen, soApp: true },
  { id: "atualizacoes", label: "Atualizações", icon: Download, soApp: true },
];

export function SettingsPage({ overrides, setOverrides, items = [], onRefresh }) {
  const [secao, setSecao] = useState("atalhos");
  return (
    <div className="flex min-h-0 flex-1">
      <nav aria-label="Seções das configurações" className="w-52 shrink-0 border-r p-3">
        <h1 className="px-2 pb-3 pt-2 text-sm font-semibold">Configurações</h1>
        {SECOES.filter((s) => isTauri || !s.soApp).map((s) => (
          <button key={s.id} onClick={() => setSecao(s.id)}
            className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent", secao === s.id && "bg-accent font-medium")}>
            <s.icon className="h-4 w-4" strokeWidth={1.6} />{s.label}
          </button>
        ))}
      </nav>
      {secao === "provas" && <CabecalhoProvas items={items} onRefresh={onRefresh} />}
      {secao === "vault" && <PastaDoVault />}
      {secao === "atualizacoes" && <Atualizacoes />}
      {secao === "atalhos" && <ShortcutsPage overrides={overrides} setOverrides={setOverrides} />}
    </div>
  );
}

function CabecalhoProvas({ items, onRefresh }) {
  const { cfg: c, mudar, erro, setErro } = useConfigProva(items, onRefresh);
  if (!c) return <div className="flex-1 p-10 text-sm text-muted-foreground">Lendo a configuração…</div>;
  const escolher = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) lerLogo(f).then((logo) => { setErro(""); mudar({ ...c, logo, logoNova: true }); }).catch((x) => setErro(x.message)); };
  const campo = "mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm";
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto max-w-[640px] px-6 py-10">
        <h1 className="text-xl font-semibold">Cabeçalho das provas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aparece no topo do DOCX e da impressão da prova, centralizado. Fica guardado na nota <code>_sistema/Configuração das provas.md</code> (a logo, em <code>_sistema/anexos</code>).</p>
        <label className="mt-6 block text-sm">Nome da escola
          <input value={c.escola} onChange={(e) => mudar({ ...c, escola: e.target.value })} placeholder="Escola de Educação Básica …" className={campo} /></label>
        <label className="mt-4 block text-sm">Segunda linha (opcional)
          <input value={c.linha2} onChange={(e) => mudar({ ...c, linha2: e.target.value })} placeholder="Professor(a), disciplina, trimestre…" className={campo} /></label>
        <div className="mt-4 text-sm">Logo (PNG ou JPG, até 600 KB)
          <div className="mt-1 flex items-center gap-3">
            {c.logo ? <img src={c.logo} alt="Logo" className="h-14 rounded border bg-white p-1" /> : <span className="text-xs text-muted-foreground">nenhuma</span>}
            <label className="cursor-pointer rounded-md border px-3 py-1.5 text-xs hover:bg-accent">Escolher imagem<input type="file" accept="image/png,image/jpeg" onChange={escolher} className="hidden" /></label>
            {c.logo && <button onClick={() => mudar({ ...c, logo: "", logoArquivo: "", logoNova: false })} className="text-xs text-muted-foreground hover:underline">remover</button>}
          </div>
        </div>
        <label className="mt-4 block text-sm">Linhas por folha (limite da prova de uma folha; 0 = padrão)
          <input type="number" min="0" value={c.limiteLinhas || ""} onChange={(e) => mudar({ ...c, limiteLinhas: Number(e.target.value) || 0 })} placeholder="100" className={campo} /></label>
        <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={c.duasColunas} onChange={(e) => mudar({ ...c, duasColunas: e.target.checked })} />Provas em duas colunas por padrão</label>
        {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
        <div className="mt-8 rounded-xl border p-4 text-center text-sm">
          {c.logo && <img src={c.logo} alt="" className="mx-auto mb-1 h-12" />}
          <div className="font-semibold">{c.escola || "Nome da escola"}</div>
          {c.linha2 && <div>{c.linha2}</div>}
          <div className="mt-2 border-t pt-2 text-left text-xs text-muted-foreground">Prova de Língua Portuguesa · 8º ano<br />Nome: ______________ Turma: ____ Data: ______</div>
        </div>
      </div>
    </div>
  );
}

function PastaDoVault() {
  const [raiz, setRaiz] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => { invoke("get_vault_root").then((r) => setRaiz(r || "")); }, []);
  const trocar = async () => {
    try { const r = await escolherPastaDoVault(); if (r) window.location.reload(); } catch (e) { setErro(String(e)); }
  };
  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className="mx-auto max-w-[640px] px-6 py-10">
      <h1 className="text-xl font-semibold">Pasta do vault</h1>
      <p className="mt-1 text-sm text-muted-foreground">O app lê e grava só dentro desta pasta. Trocar recarrega o app.</p>
      <div className="mt-6 rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all">{raiz || "nenhuma"}</div>
      <button onClick={trocar} className="mt-4 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Trocar pasta…</button>
      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
    </div></div>
  );
}

function Atualizacoes() {
  const [versao, setVersao] = useState("");
  const [achada, setAchada] = useState(null);
  const [msg, setMsg] = useState("");
  const [prog, setProg] = useState(null);
  useEffect(() => { versaoDoApp().then(setVersao); }, []);
  const procurar = async () => {
    setMsg("Procurando…"); setAchada(null);
    try { const u = await procurarAtualizacao(); setAchada(u); setMsg(u ? "" : "Você já está na versão mais recente."); }
    catch (e) { setMsg("Não foi possível verificar (sem internet?): " + e); }
  };
  const instalar = async () => {
    setProg(0); setMsg("");
    try { await instalarAtualizacao(setProg); } catch (e) { setProg(null); setMsg("Falha ao instalar: " + e); }
  };
  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className="mx-auto max-w-[640px] px-6 py-10">
      <h1 className="text-xl font-semibold">Atualizações</h1>
      <p className="mt-1 text-sm text-muted-foreground">Versão instalada: <strong>{versao}</strong>. O app também procura sozinho ao abrir. Seus arquivos do vault não são tocados na atualização.</p>
      <button onClick={procurar} disabled={prog !== null} className="mt-6 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50">Procurar atualização</button>
      {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
      {achada && (
        <div className="mt-5 rounded-xl border p-4">
          <div className="text-sm font-medium">Versão {achada.version} disponível</div>
          {achada.notes && <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{achada.notes}</pre>}
          <button onClick={instalar} disabled={prog !== null} className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
            {prog === null ? "Baixar e instalar (o app reinicia)" : `Baixando… ${Math.round(prog * 100)}%`}
          </button>
        </div>
      )}
    </div></div>
  );
}
