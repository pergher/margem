import { useState } from "react";
import { useEffect } from "react";
import { Keyboard, Users, FileText, FolderOpen, Download, Palette, Sun, Moon } from "lucide-react";
import { invoke, isTauri } from "@/lib/api";
import { escolherPastaDoVault } from "@/components/VaultGate";
import { Logo } from "@/components/Logo";
import { FONTES, TAMANHOS_TEXTO } from "@/lib/fontes";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { FORMAS } from "@/lib/forma";
import { procurarAtualizacao, instalarAtualizacao, versaoDoApp } from "@/lib/atualizar";
import { lerLogo } from "@/lib/configProva";
import { lerTurmas, gravarTurmas, turmasDeTexto, AULAS_PADRAO } from "@/lib/turmas";
import { useConfigProva } from "@/lib/useConfigProva";
import { ShortcutsPage } from "@/components/ShortcutsPage";
import { CLAROS, ESCUROS, ESTILOS_CALLOUT } from "@/lib/temas";
import { cn } from "@/lib/utils";
import { Estado, Carregando, useToast } from "@/components/ui/estado";

// Seções da página; novas (cabeçalho das avaliações, escola, logo…) entram aqui.
const SECOES = [
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "atalhos", label: "Atalhos de teclado", icon: Keyboard },
  { id: "turmas", label: "Turmas do ano", icon: Users },
  { id: "provas", label: "Cabeçalho das provas", icon: FileText },
  { id: "vault", label: "Pasta do vault", icon: FolderOpen, soApp: true },
  { id: "atualizacoes", label: "Atualizações", icon: Download, soApp: true },
];

export function SettingsPage({ tema, overrides, setOverrides, items = [], onRefresh }) {
  const [secao, setSecao] = useState("aparencia");
  const [wNav, setWNav] = useWidth("config.menu", 208);
  return (
    <div className="flex min-h-0 flex-1">
      <nav aria-label="Seções das configurações" style={{ width: wNav }} className="shrink-0 overflow-auto p-3">
        <h1 className="px-2 pb-3 pt-2 text-sm font-semibold">Configurações</h1>
        {SECOES.filter((s) => isTauri || !s.soApp).map((s) => (
          <button key={s.id} onClick={() => setSecao(s.id)}
            className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent", secao === s.id && "bg-accent font-medium")}>
            <s.icon className="h-4 w-4" strokeWidth={1.6} />{s.label}
          </button>
        ))}
      </nav>
      {secao === "aparencia" && <Aparencia tema={tema} />}
      {secao === "turmas" && <TurmasDoAno items={items} onRefresh={onRefresh} />}
      {secao === "provas" && <CabecalhoProvas items={items} onRefresh={onRefresh} />}
      {secao === "vault" && <PastaDoVault />}
      {secao === "atualizacoes" && <Atualizacoes />}
      {secao === "atalhos" && <ShortcutsPage overrides={overrides} setOverrides={setOverrides} />}
    </div>
  );
}

function TurmasDoAno({ items, onRefresh }) {
  const ano = items.map((i) => /^Anos\/(\d{4})\//.exec(i.rel)?.[1]).filter(Boolean).sort().pop() ?? String(new Date().getFullYear());
  const toast = useToast();
  const [txt, setTxt] = useState(null), [aulas, setAulas] = useState(AULAS_PADRAO), [msg, setMsg] = useState("");
  useEffect(() => { lerTurmas(items, ano).then((c) => { setTxt(c.turmas.join(", ")); setAulas(c.aulas); }); }, [ano]);
  if (txt === null) return <Carregando>Lendo…</Carregando>;
  const lista = turmasDeTexto(txt);
  const salvar = async () => {
    try { await gravarTurmas(items, ano, { turmas: lista, aulas }); toast("Turmas salvas."); await onRefresh?.(); } catch (e) { toast("Erro: " + (e?.message ?? e), { tipo: "err" }); }
  };
  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className="mx-auto max-w-[640px] px-6 py-10">
      <h1 className="text-xl font-semibold">Turmas de {ano}</h1>
      <p className="mt-1 text-sm text-muted-foreground">As turmas que aparecem na Semana e quantas aulas cada uma tem por semana. Fica guardado em <code>Anos/{ano}/Turmas {ano}.md</code>; no ano seguinte basta criar outro.</p>
      <label className="mt-6 block text-sm">Turmas (separadas por vírgula)
        <input value={txt} onChange={(e) => { setTxt(e.target.value); setMsg(""); }} placeholder="61, 62, 71, 81" className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm" /></label>
      <label className="mt-4 block text-sm">Aulas por turma na semana
        <input type="number" min={1} max={12} value={aulas} onChange={(e) => { setAulas(Math.max(1, Math.min(12, Number(e.target.value) || AULAS_PADRAO))); setMsg(""); }} className="mt-1 block w-24 rounded-md border bg-background px-3 py-1.5 text-sm" /></label>
      <div className="mt-5 flex items-center gap-3"><button onClick={salvar} disabled={!lista.length} className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-40">Salvar</button><span className="text-sm text-muted-foreground">{msg}</span></div>
    </div></div>
  );
}

function CabecalhoProvas({ items, onRefresh }) {
  const { cfg: c, mudar, erro, setErro } = useConfigProva(items, onRefresh);
  if (!c) return <Carregando>Lendo a configuração…</Carregando>;
  const escolher = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) lerLogo(f).then((logo) => { setErro(""); mudar({ ...c, logo, logoNova: true }); }).catch((x) => setErro(x.message)); };
  const campo = "mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm";
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto max-w-[640px] px-6 py-10">
        <h1 className="text-xl font-semibold">Cabeçalho das provas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aparece no topo do DOCX e da impressão da prova, centralizado. Fica guardado no arquivo <code>_sistema/Configuração das provas.md</code> (a logo, em <code>_sistema/anexos</code>).</p>
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
        {erro && <Estado tipo="err" className="mt-3 text-sm">{erro}</Estado>}
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
      {erro && <Estado tipo="err" className="mt-3 text-sm">{erro}</Estado>}
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
      <div className="flex items-center gap-3"><Logo className="h-10 w-10" /><h1 className="text-xl font-semibold">Margem · Atualizações</h1></div>
      <p className="mt-1 text-sm text-muted-foreground">Versão instalada: <strong>{versao}</strong>. O app também procura sozinho ao abrir. Seus arquivos do vault não são tocados na atualização.</p>
      <button onClick={procurar} disabled={prog !== null} className="mt-6 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50">Procurar atualização</button>
      {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
      {prog !== null && prog >= 1 && <p className="mt-3 text-sm text-muted-foreground">Instalando… o Margem vai fechar agora e o instalador roda por alguns segundos; em seguida o Margem abre sozinho. Se não abrir em cerca de 30 segundos, abra pelo menu Iniciar. Sua nota já foi salva e você volta de onde estava.</p>}
      {achada && (
        <div className="mt-5 rounded-xl border p-4">
          <div className="text-sm font-medium">Versão {achada.version} disponível</div>
          {achada.notes && <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{achada.notes}</pre>}
          <button onClick={instalar} disabled={prog !== null} className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
            {prog === null ? "Baixar e instalar (salva seu arquivo antes)" : `Baixando… ${Math.round(prog * 100)}%`}
          </button>
        </div>
      )}
    </div></div>
  );
}

function Aparencia({ tema: { temaClaro, setTemaClaro, temaEscuro, setTemaEscuro, dark, setDark, estiloCallout, setEstiloCallout, fonte, setFonte, tamanhoTexto, setTamanhoTexto, forma, setForma } }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto"><div className="mx-auto max-w-[720px] px-6 py-10">
      <h1 className="text-xl font-semibold">Aparência</h1>
      <p className="mt-1 text-sm text-muted-foreground">Escolha um tema claro e um escuro, de forma independente; o modo decide qual está em uso. O modo também alterna pelo botão de sol/lua no menu lateral.</p>
      <div role="radiogroup" aria-label="Modo" className="mt-6 inline-flex rounded-lg border p-0.5 text-sm">
        {[[false, "Claro", Sun], [true, "Escuro", Moon]].map(([v, nome, Icone]) => (
          <button key={nome} role="radio" aria-checked={dark === v} onClick={() => setDark(v)}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1", dark === v ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60")}>
            <Icone className="h-4 w-4" strokeWidth={1.6} />{nome}
          </button>
        ))}
      </div>
      <GradeTemas titulo="Tema claro" lista={CLAROS} atual={temaClaro} onPick={setTemaClaro} emUso={!dark} />
      <GradeTemas titulo="Tema escuro" lista={ESCUROS} atual={temaEscuro} onPick={setTemaEscuro} emUso={dark} />
      <h2 className="mt-10 text-base font-semibold">Fontes</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cada par define a fonte da interface, do texto das notas, dos títulos e do código. Vale para qualquer tema.</p>
      <div role="radiogroup" aria-label="Par de fontes" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.entries(FONTES).map(([id, f]) => (
          <button key={id} role="radio" aria-checked={fonte === id} onClick={() => setFonte(id)}
            className={cn("overflow-hidden rounded-xl border text-left", fonte === id ? "ring-2 ring-primary" : "hover:border-primary/60")}>
            <div className="space-y-1.5 bg-background p-3">
              <div style={{ fontFamily: f.h1, fontWeight: 600, fontSize: "1.2rem", lineHeight: 1.2 }}>Os gêneros narrativos</div>
              <div style={{ fontFamily: f.texto, fontSize: "0.9rem", lineHeight: 1.5 }}>Narrador, personagens e conflito. “— Já chegou?”, perguntou Ana.</div>
              <div className="rounded-md bg-muted px-2 py-1 text-xs" style={{ fontFamily: f.mono }}>- [ ] Identificar o narrador</div>
            </div>
            <div className="border-t bg-background px-3 py-1.5"><div className="text-xs font-medium">{f.nome}</div><div className="text-xs text-muted-foreground">{f.roles}</div></div>
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Tamanho do texto" className="mt-4 inline-flex rounded-lg border p-0.5 text-sm">
        {Object.entries(TAMANHOS_TEXTO).map(([px, nome]) => (
          <button key={px} role="radio" aria-checked={tamanhoTexto === Number(px)} onClick={() => setTamanhoTexto(Number(px))}
            className={cn("rounded-md px-3 py-1", tamanhoTexto === Number(px) ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60")}>{nome}</button>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Tamanho do texto no editor.</p>
      <h2 className="mt-10 text-base font-semibold">Forma e densidade</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cantos dos botões e cartões e espaço entre os elementos da interface. Vale para qualquer tema.</p>
      <div role="radiogroup" aria-label="Forma e densidade" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.entries(FORMAS).map(([id, f]) => (
          <button key={id} role="radio" aria-checked={forma === id} onClick={() => setForma(id)}
            className={cn("overflow-hidden rounded-xl border text-left", forma === id ? "ring-2 ring-primary" : "hover:border-primary/60")}>
            <div className="flex items-center gap-2 bg-background p-3">
              <span className="h-8 w-14 border bg-muted" style={{ borderRadius: f.lg }} />
              <span className="inline-flex h-8 items-center bg-primary px-3 text-xs text-primary-foreground" style={{ borderRadius: f.md }}>Salvar</span>
            </div>
            <div className="border-t bg-background px-3 py-1.5"><div className="text-xs font-medium">{f.nome}</div><div className="text-xs text-muted-foreground">{f.spec}</div></div>
          </button>
        ))}
      </div>
      <h2 className="mt-10 text-base font-semibold">Callouts</h2>
      <p className="mt-1 text-sm text-muted-foreground">Como aparecem os blocos <code>&gt; [!note]</code>, <code>[!tip]</code> e <code>[!warning]</code> no editor. As cores seguem o tema.</p>
      <div role="radiogroup" aria-label="Estilo dos callouts" className="mt-4 grid grid-cols-2 gap-3">
        {Object.entries(ESTILOS_CALLOUT).map(([id, nome]) => (
          <button key={id} role="radio" aria-checked={estiloCallout === id} onClick={() => setEstiloCallout(id)} data-callout={id}
            className={cn("overflow-hidden rounded-xl border text-left", estiloCallout === id ? "ring-2 ring-primary" : "hover:border-primary/60")}>
            <div className="space-y-2 bg-background p-3">
              {[["", "Nota"], ["cm-callout-warning", "Atenção"]].map(([c, t]) => (
                <div key={t} className={cn("cm-callout cm-callout-first cm-callout-last", c)} style={{ borderTopWidth: 0, borderBottomWidth: 0 }}>
                  <div className="py-2"><div className="cm-callout-title">{t}</div><div className="text-xs">Texto do bloco de exemplo.</div></div>
                </div>
              ))}
            </div>
            <div className="border-t bg-background px-3 py-1.5 text-xs">{nome}</div>
          </button>
        ))}
      </div>
    </div></div>
  );
}

function GradeTemas({ titulo, lista, atual, onPick, emUso }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold">{titulo}{emUso && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-normal text-muted-foreground">em uso</span>}</h2>
      <div role="radiogroup" aria-label={titulo} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(lista).map(([classe, nome]) => (
          <button key={classe} role="radio" aria-checked={atual === classe} onClick={() => onPick(classe)}
            className={cn("overflow-hidden rounded-xl border text-left", atual === classe ? "ring-2 ring-primary" : "hover:border-primary/60")}>
            <div className={cn(classe, "bg-background p-3 text-foreground")}>
              <div className="text-xs font-semibold">Título do arquivo</div>
              <div className="mt-1 text-xs text-muted-foreground">Texto de exemplo com <span className="text-primary underline">link</span></div>
              <div className="mt-2 flex gap-1.5">
                <span className="h-3 w-8 rounded-full bg-primary" /><span className="h-3 w-5 rounded-full bg-accent" /><span className="h-3 w-5 rounded-full bg-muted-foreground" />
              </div>
            </div>
            <div className="border-t bg-background px-3 py-1.5 text-xs">{nome}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
