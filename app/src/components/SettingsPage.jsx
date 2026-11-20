import { useState } from "react";
import { useEffect } from "react";
import { IconKeyboard as Keyboard, IconUsers as Users, IconFileText as FileText, IconFolderOpen as FolderOpen, IconDownload as Download, IconPalette as Palette, IconSun as Sun, IconMoon as Moon, IconHome as House, IconBook as BookText, IconHelpCircle as CircleHelp, IconClipboardCheck as ClipboardCheck, IconSearch as Search, IconSettings as Settings, IconFileCheck as FileCheck, IconCalendarEvent as CalendarDays, IconSchool as GraduationCap, IconInfoCircle as Info, IconSparkles as Sparkles } from "@tabler/icons-react";
import { invoke, isTauri } from "@/lib/api";
import { escolherPastaDoVault, noAndroid, CaminhoDigitado } from "@/components/VaultGate";
import { Logo } from "@/components/Logo";
import { FONTES, TAMANHOS_TEXTO } from "@/lib/fontes";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useWidth } from "@/lib/useWidth";
import { useEhCompacto } from "@/lib/useCompacto";
import { FORMAS } from "@/lib/forma";
import { procurarAtualizacao, instalarAtualizacao, versaoDoApp } from "@/lib/atualizar";
import { lerLogo } from "@/lib/configProva";
import { lerTurmas, gravarTurmas, turmasDeTexto, AULAS_PADRAO } from "@/lib/turmas";
import { useConfigProva } from "@/lib/useConfigProva";
import { iaApagarChave, iaConfigGravar, iaConfigLer, iaGuardarChave, iaTemChave, iaTestar } from "@/lib/ia";
import { ShortcutsPage } from "@/components/ShortcutsPage";
import { CLAROS, ESCUROS, ESTILOS_CALLOUT } from "@/lib/temas";
import { OPCOES_COR, DESTAQUES_PADRAO } from "@/lib/destaques";
import { cn } from "@/lib/utils";
import { Estado, Carregando, useToast } from "@/components/ui/estado";


// Seções (layout do artefato "Margem — telas"): menu à esquerda, controles no meio e uma Prévia única à direita.
const SECOES = [
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "escola", label: "Escola e professor", icon: GraduationCap },
  { id: "notas", label: "Notas e pasta", icon: FolderOpen, soApp: true },
  { id: "ia", label: "IA", icon: Sparkles, soApp: true },
  { id: "atalhos", label: "Atalhos", icon: Keyboard },
  { id: "sobre", label: "Sobre o Margem", icon: Info, soApp: true },
];

export function SettingsPage({ tema, overrides, setOverrides, items = [], onRefresh, modoCompacto, atalhoGlobal }) {
  const compacto = useEhCompacto();
  const [secao, setSecao] = useState("aparencia");
  const [wNav, setWNav] = useWidth("config.menu", 208);
  if (compacto) return <ConfiguracoesCompactas tema={tema} modoCompacto={modoCompacto} />;
  return (
    <div className="flex min-h-0 flex-1">
      <nav aria-label="Seções das configurações" style={{ width: wNav }} className="flex shrink-0 flex-col gap-1 overflow-auto p-3">
        <h1 className="px-2 pb-3 pt-2 font-serif text-lg font-semibold">Configurações</h1>
        {SECOES.filter((s) => isTauri || !s.soApp).map((s) => (
          <button key={s.id} onClick={() => setSecao(s.id)} aria-current={secao === s.id ? "page" : undefined}
            className={cn("flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent", secao === s.id && "bg-accent font-medium")}>
            <s.icon className="h-4 w-4" strokeWidth={1.6} />{s.label}
          </button>
        ))}
      </nav>
      {!compacto && <ResizeHandle width={wNav} setWidth={setWNav} min={160} max={320} side="left" />}
      {secao === "aparencia" && <Aparencia tema={tema} modoCompacto={modoCompacto} />}
      {secao === "escola" && <EscolaEProfessor items={items} onRefresh={onRefresh} />}
      {secao === "notas" && <PastaDoVault />}
      {secao === "ia" && <ConfigIA />}
      {secao === "atalhos" && <ShortcutsPage overrides={overrides} setOverrides={setOverrides} atalhoGlobal={atalhoGlobal} />}
      {secao === "sobre" && <Atualizacoes />}
    </div>
  );
}

const MODOS_COMPACTO = [{ id: "auto", nome: "Automático" }, { id: "sim", nome: "Sempre compacto" }, { id: "nao", nome: "Nunca (tela completa)" }];
function OpcoesModoCompacto({ modo, setModo }) {
  return <Opcoes rotulo="Tela compacta" valor={modo} onPick={setModo} opcoes={MODOS_COMPACTO} />;
}

/** Pasta do vault no celular: caminho digitado (o Android não tem seletor de pastas para o app); no computador forçado a compacto, o seletor de sempre. */
function PastaCompacta() {
  const [raiz, setRaiz] = useState(""), [erro, setErro] = useState("");
  useEffect(() => { invoke("get_vault_root").then((r) => setRaiz(r || "")).catch(() => {}); }, []);
  const trocar = async () => { try { const r = await escolherPastaDoVault(); if (r) window.location.reload(); } catch (e) { setErro(String(e)); } };
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all">{raiz || "nenhuma"}</div>
      {noAndroid ? <CaminhoDigitado onDone={() => window.location.reload()} setErro={setErro} />
        : <button onClick={trocar} className="min-h-11 rounded-md border px-3 text-sm hover:bg-accent">Trocar pasta…</button>}
      {erro && <Estado tipo="err" className="text-sm">{erro}</Estado>}
    </div>
  );
}

/** Configurações no celular: só tema, tamanho do texto, pasta do vault e o modo compacto. O resto fica para o computador. */
function ConfiguracoesCompactas({ tema: { dark, setDark, temaClaro, setTemaClaro, temaEscuro, setTemaEscuro, tamanhoTexto, setTamanhoTexto }, modoCompacto }) {
  const tamanhos = Object.entries(TAMANHOS_TEXTO).map(([px, nome]) => ({ id: Number(px), nome }));
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex w-full flex-col gap-6 px-4 py-5">
        <h1 className="font-serif text-2xl font-semibold">Configurações</h1>
        <Grupo titulo="Modo"><Opcoes rotulo="Modo" valor={dark} onPick={setDark} opcoes={[{ id: false, nome: "Claro", icone: Sun }, { id: true, nome: "Escuro", icone: Moon }]} /></Grupo>
        {dark
          ? <Grupo titulo="Tema escuro"><Temas titulo="Tema escuro" lista={ESCUROS} atual={temaEscuro} onPick={setTemaEscuro} /></Grupo>
          : <Grupo titulo="Tema claro"><Temas titulo="Tema claro" lista={CLAROS} atual={temaClaro} onPick={setTemaClaro} /></Grupo>}
        <Grupo titulo="Tamanho do texto"><Opcoes rotulo="Tamanho do texto" valor={tamanhoTexto} onPick={setTamanhoTexto} opcoes={tamanhos} /></Grupo>
        <Grupo titulo="Pasta do vault" nota="O app lê e grava só dentro dela."><PastaCompacta /></Grupo>
        {modoCompacto && <Grupo titulo="Tela compacta" nota="Automático liga abaixo de 768 px de largura."><OpcoesModoCompacto {...modoCompacto} /></Grupo>}
      </div>
    </div>
  );
}

/** Página de uma seção: título, controles à esquerda e, se houver, a Prévia fixa à direita (todas as mudanças num lugar só). */
function Pagina({ titulo, children, previa }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex w-full flex-wrap items-start gap-x-10 gap-y-8 px-8 py-8">
        <section className="min-w-0 flex-[3_1_420px]">
          <h2 className="font-serif text-2xl font-semibold">{titulo}</h2>
          <div className="mt-6 flex flex-col gap-7">{children}</div>
        </section>
        {previa && (
          <aside aria-label="Prévia" className="sticky top-6 flex-[2_1_340px] self-start">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prévia</div>
            {previa}
          </aside>
        )}
      </div>
    </div>
  );
}

function Grupo({ titulo, nota, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-semibold">{titulo}</div>
      {nota && <p className="-mt-1 text-xs text-muted-foreground">{nota}</p>}
      {children}
    </div>
  );
}

/** Grupo de opções excludentes (radiogroup) em botões compactos. */
function Opcoes({ rotulo, valor, onPick, opcoes, className }) {
  const compacto = useEhCompacto();
  return (
    <div role="radiogroup" aria-label={rotulo} className={cn("flex flex-wrap gap-2", className)}>
      {opcoes.map(({ id, nome, icone: Ic, estilo }) => (
        <button key={String(id)} role="radio" aria-checked={valor === id} onClick={() => onPick(id)} style={estilo}
          className={cn("flex items-center gap-1.5 rounded-lg border px-3 text-sm", compacto ? "min-h-11" : "min-h-9", valor === id ? "border-foreground bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60")}>
          {Ic && <Ic className="h-4 w-4" strokeWidth={1.6} />}{nome}
        </button>
      ))}
    </div>
  );
}

function EscolaEProfessor({ items, onRefresh }) {
  const prova = useConfigProva(items, onRefresh);
  const c = prova.cfg;
  const previa = (
    <div className="rounded-xl border bg-background p-4 text-center text-sm">
      {c?.logo && <img src={c.logo} alt="" className="mx-auto mb-1 h-12" />}
      <div className="font-semibold">{c?.escola || "Nome da escola"}</div>
      {c?.linha2 && <div>{c.linha2}</div>}
      <div className="mt-2 border-t pt-2 text-left text-xs text-muted-foreground">Prova de Língua Portuguesa · 8º ano<br />Nome: ______________ Turma: ____ Data: ______</div>
    </div>
  );
  return (
    <Pagina titulo="Escola e professor" previa={previa}>
      <p className="-mt-3 text-sm text-muted-foreground">Estas informações entram no cabeçalho das provas e na Semana. Você preenche uma vez e muda quando precisar; a prévia ao lado mostra o resultado.</p>
      <CabecalhoProvas prova={prova} />
      <TurmasDoAno items={items} onRefresh={onRefresh} />
    </Pagina>
  );
}

function TurmasDoAno({ items, onRefresh }) {
  const ano = items.map((i) => /^Anos\/(\d{4})\//.exec(i.rel)?.[1]).filter(Boolean).sort().pop() ?? String(new Date().getFullYear());
  const toast = useToast();
  const [txt, setTxt] = useState(null), [aulas, setAulas] = useState(AULAS_PADRAO);
  useEffect(() => { lerTurmas(items, ano).then((c) => { setTxt(c.turmas.join(", ")); setAulas(c.aulas); }); }, [ano]);
  if (txt === null) return <Carregando>Lendo…</Carregando>;
  const lista = turmasDeTexto(txt);
  const salvar = async () => {
    try { await gravarTurmas(items, ano, { turmas: lista, aulas }); toast("Turmas salvas."); await onRefresh?.(); } catch (e) { toast("Erro: " + (e?.message ?? e), { tipo: "err" }); }
  };
  return (
    <div className="flex flex-col gap-3 border-t pt-6">
      <h3 className="text-base font-semibold">Turmas de {ano}</h3>
      <p className="-mt-2 text-xs text-muted-foreground">Aparecem na Semana, com as aulas por semana de cada uma. Guardado em <code>Anos/{ano}/Turmas {ano}.md</code>; no ano seguinte basta criar outro.</p>
      <label className="block text-sm font-medium">Turmas (separadas por vírgula)
        <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="61, 62, 71, 81" className="mt-1 min-h-9 w-full rounded-md border bg-background px-3 py-1.5 text-sm font-normal" /></label>
      <label className="block text-sm font-medium">Aulas por turma na semana
        <input type="number" min={1} max={12} value={aulas} onChange={(e) => setAulas(Math.max(1, Math.min(12, Number(e.target.value) || AULAS_PADRAO)))} className="mt-1 block min-h-9 w-24 rounded-md border bg-background px-3 py-1.5 text-sm font-normal" /></label>
      <div><button onClick={salvar} disabled={!lista.length} className="min-h-9 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-40">Salvar turmas</button></div>
    </div>
  );
}

function CabecalhoProvas({ prova: { cfg: c, mudar, erro, setErro } }) {
  if (!c) return <Carregando>Lendo a configuração…</Carregando>;
  const escolher = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) lerLogo(f).then((logo) => { setErro(""); mudar({ ...c, logo, logoNova: true }); }).catch((x) => setErro(x.message)); };
  const campo = "mt-1 min-h-9 w-full rounded-md border bg-background px-3 py-1.5 text-sm font-normal";
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold">Cabeçalho das provas</h3>
      <p className="-mt-2 text-xs text-muted-foreground">Fica no topo do DOCX e da impressão, centralizado. Guardado em <code>_sistema/Configuração das provas.md</code> (a logo, em <code>_sistema/anexos</code>); salva sozinho.</p>
      <label className="block text-sm font-medium">Nome da escola
        <input value={c.escola} onChange={(e) => mudar({ ...c, escola: e.target.value })} placeholder="Escola de Educação Básica …" className={campo} /></label>
      <label className="block text-sm font-medium">Segunda linha (opcional)
        <input value={c.linha2} onChange={(e) => mudar({ ...c, linha2: e.target.value })} placeholder="Professor(a), disciplina, trimestre…" className={campo} /></label>
      <div className="text-sm font-medium">Logo (PNG ou JPG, até 600 KB)
        <div className="mt-1 flex items-center gap-3 font-normal">
          {c.logo ? <img src={c.logo} alt="Logo" className="h-14 rounded border bg-white p-1" /> : <span className="text-xs text-muted-foreground">nenhuma</span>}
          <label className="flex min-h-9 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-accent">Escolher imagem<input type="file" accept="image/png,image/jpeg" onChange={escolher} className="hidden" /></label>
          {c.logo && <button onClick={() => mudar({ ...c, logo: "", logoArquivo: "", logoNova: false })} className="text-xs text-muted-foreground hover:underline">remover</button>}
        </div>
      </div>
      <label className="block text-sm font-medium">Linhas por folha (limite da prova de uma folha; 0 = padrão)
        <input type="number" min="0" value={c.limiteLinhas || ""} onChange={(e) => mudar({ ...c, limiteLinhas: Number(e.target.value) || 0 })} placeholder="100" className={campo} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.duasColunas} onChange={(e) => mudar({ ...c, duasColunas: e.target.checked })} />Provas em duas colunas por padrão</label>
      {erro && <Estado tipo="err" className="text-sm">{erro}</Estado>}
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
    <Pagina titulo="Notas e pasta">
      <p className="mt-1 text-sm text-muted-foreground">O app lê e grava só dentro desta pasta. Trocar recarrega o app.</p>
      <div className="mt-6 rounded-md border bg-muted px-3 py-2 font-mono text-xs break-all">{raiz || "nenhuma"}</div>
      <button onClick={trocar} className="mt-4 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Trocar pasta…</button>
      {erro && <Estado tipo="err" className="mt-3 text-sm">{erro}</Estado>}
    </Pagina>
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
    <Pagina titulo="Sobre o Margem">
      <div className="flex items-center gap-3"><Logo className="h-10 w-10" /><h2 className="text-base font-semibold">Atualizações</h2></div>
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
    </Pagina>
  );
}


function Aparencia({ modoCompacto, tema: { temaClaro, setTemaClaro, temaEscuro, setTemaEscuro, dark, setDark, estiloCallout, setEstiloCallout, fonte, setFonte, tamanhoTexto, setTamanhoTexto, forma, setForma, destaques, setDestaques } }) {
  const f = FONTES[fonte] ?? Object.values(FONTES)[0];
  const tamanhos = Object.entries(TAMANHOS_TEXTO).map(([px, nome]) => ({ id: Number(px), nome }));
  // Prévia única: mostra, juntas, as escolhas de tema, fonte, tamanho, ícones, forma, cores e callouts.
  const previa = (
    <div className="overflow-hidden rounded-xl border bg-background p-5 shadow-sm" style={{ fontSize: tamanhoTexto }}>
      <div style={{ fontFamily: f.h1, fontWeight: 600, fontSize: "1.5em", lineHeight: 1.15 }}>Plano de aula: gêneros narrativos</div>
      <p className="mt-3" style={{ fontFamily: f.texto, lineHeight: 1.6 }}>
        Leitura de um conto, com <strong style={{ color: "var(--cor-negrito)" }}>negrito</strong> e <em style={{ color: "var(--cor-italico)" }}>itálico</em>. “— Já chegou?”, perguntou Ana.
      </p>
      <div data-callout={estiloCallout} className="mt-3 space-y-2">
        {[["", "Nota"], ["cm-callout-warning", "Atenção"]].map(([c, t]) => (
          <div key={t} className={cn("cm-callout cm-callout-first cm-callout-last", c)} style={{ borderTopWidth: 0, borderBottomWidth: 0 }}>
            <div className="py-2"><div className="cm-callout-title">{t}</div><div style={{ fontFamily: f.texto, fontSize: "0.9em" }}>Atenção à pontuação dos diálogos.</div></div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5" style={{ fontFamily: f.texto }}>
        <div className="flex items-center gap-2"><input type="checkbox" checked readOnly tabIndex={-1} aria-label="Exemplo marcado" />Reconhecer narrador e personagens</div>
        <div className="flex items-center gap-2"><input type="checkbox" readOnly tabIndex={-1} aria-label="Exemplo desmarcado" />Identificar o conflito</div>
      </div>
      <div className="mt-3 rounded-md bg-muted px-2 py-1 text-[0.8em]" style={{ fontFamily: f.mono }}>- [ ] Identificar o narrador</div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="inline-flex min-h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground">Salvar</span>
        <div className={"flex gap-2.5 text-muted-foreground"}>
          {[House, BookText, CircleHelp, ClipboardCheck, Search, Settings].map((Ic, i) => <Ic key={i} aria-hidden className="h-5 w-5" />)}
        </div>
      </div>
    </div>
  );
  return (
    <Pagina titulo="Aparência" previa={previa}>
      {modoCompacto && <Grupo titulo="Tela compacta (celular)" nota="Em uma coluna e com barra inferior. Automático liga abaixo de 768 px de largura."><OpcoesModoCompacto {...modoCompacto} /></Grupo>}
      <Grupo titulo="Modo" nota="O botão de sol/lua no menu lateral também alterna.">
        <Opcoes rotulo="Modo" valor={dark} onPick={setDark} opcoes={[{ id: false, nome: "Claro", icone: Sun }, { id: true, nome: "Escuro", icone: Moon }]} />
      </Grupo>
      <Grupo titulo="Tema claro" nota={dark ? undefined : "em uso"}>
        <Temas titulo="Tema claro" lista={CLAROS} atual={temaClaro} onPick={setTemaClaro} />
      </Grupo>
      <Grupo titulo="Tema escuro" nota={dark ? "em uso" : undefined}>
        <Temas titulo="Tema escuro" lista={ESCUROS} atual={temaEscuro} onPick={setTemaEscuro} />
      </Grupo>
      <Grupo titulo="Fontes" nota="Cada par define a interface, o texto das notas, os títulos e o código.">
        <div role="radiogroup" aria-label="Par de fontes" className="flex flex-wrap gap-2">
          {Object.entries(FONTES).map(([id, ft]) => (
            <button key={id} role="radio" aria-checked={fonte === id} onClick={() => setFonte(id)}
              className={cn("flex min-w-[150px] flex-1 flex-col rounded-lg border px-3 py-2 text-left", fonte === id ? "border-foreground bg-accent" : "hover:bg-accent/60")}>
              <span style={{ fontFamily: ft.h1, fontWeight: 600, fontSize: "1.1rem" }}>{ft.nome}</span>
              <span className="text-xs text-muted-foreground">{ft.roles}</span>
            </button>
          ))}
        </div>
      </Grupo>
      <Grupo titulo="Tamanho do texto" nota="No editor.">
        <Opcoes rotulo="Tamanho do texto" valor={tamanhoTexto} onPick={setTamanhoTexto} opcoes={tamanhos} />
      </Grupo>
      <Grupo titulo="Forma e densidade" nota="Cantos dos botões e cartões e espaço entre os elementos.">
        <Opcoes rotulo="Forma e densidade" valor={forma} onPick={setForma} opcoes={Object.entries(FORMAS).map(([id, fm]) => ({ id, nome: fm.nome }))} />
      </Grupo>
      <Grupo titulo="Cores do negrito e do itálico" nota="Valem no editor e na visão de Aula. As prontas acompanham o tema.">
        {[["negrito", "Negrito"], ["italico", "Itálico"]].map(([k, nome]) => (
          <div key={k} className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-sm">{nome}</span>
            <div role="radiogroup" aria-label={`Cor do ${nome.toLowerCase()}`} className="flex flex-wrap items-center gap-2">
              {OPCOES_COR.map((o) => (
                <button key={o.nome} role="radio" aria-checked={destaques[k] === o.valor} aria-label={o.nome} title={o.nome} onClick={() => setDestaques({ ...destaques, [k]: o.valor })}
                  className={cn("flex h-9 w-9 items-center justify-center rounded-full border", destaques[k] === o.valor ? "ring-2 ring-foreground" : "hover:bg-accent")}>
                  <span aria-hidden className="h-5 w-5 rounded-full border" style={{ background: o.valor }} />
                </button>
              ))}
              <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs hover:bg-accent">
                Outra <input type="color" aria-label={`Outra cor para o ${nome.toLowerCase()}`} value={/^#[0-9a-f]{6}$/i.test(destaques[k]) ? destaques[k] : "#888888"} onChange={(e) => setDestaques({ ...destaques, [k]: e.target.value })} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
              </label>
              {destaques[k] !== DESTAQUES_PADRAO[k] && <button onClick={() => setDestaques({ ...destaques, [k]: DESTAQUES_PADRAO[k] })} className="text-xs text-muted-foreground underline hover:text-foreground">padrão</button>}
            </div>
          </div>
        ))}
      </Grupo>
      <Grupo titulo="Callouts" nota="Blocos > [!note], [!tip] e [!warning]. As cores seguem o tema.">
        <Opcoes rotulo="Estilo dos callouts" valor={estiloCallout} onPick={setEstiloCallout} opcoes={Object.entries(ESTILOS_CALLOUT).map(([id, nome]) => ({ id, nome }))} />
      </Grupo>
    </Pagina>
  );
}

/** Temas como amostras compactas (nome + três cores); o resultado completo aparece na Prévia. */
function Temas({ titulo, lista, atual, onPick }) {
  return (
    <div role="radiogroup" aria-label={titulo} className="flex flex-wrap gap-2">
      {Object.entries(lista).map(([classe, nome]) => (
        <button key={classe} role="radio" aria-checked={atual === classe} onClick={() => onPick(classe)}
          className={cn("flex min-h-11 items-center gap-2 rounded-lg border px-2.5 text-sm md:min-h-9", atual === classe ? "border-foreground bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60")}>
          <span className={cn(classe, "flex gap-0.5 rounded-md border bg-background p-1")} aria-hidden>
            <span className="h-3 w-3 rounded-full bg-primary" /><span className="h-3 w-3 rounded-full bg-accent" /><span className="h-3 w-3 rounded-full bg-muted-foreground" />
          </span>{nome}
        </button>
      ))}
    </div>
  );
}

/** IA: desligada por padrão. A chave vai direto para o cofre do sistema e nunca volta para a tela. */
const PROVEDORES_FIXOS = ["anthropic", "openai", "gemini", "local"];
function ConfigIA() {
  const [c, setC] = useState(null);
  const [temChave, setTemChave] = useState(false);
  const [chave, setChave] = useState("");
  const [aceito, setAceito] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const selId = c?.provedor;
  useEffect(() => { iaConfigLer().then(setC).catch((e) => setErro(String(e))); }, []);
  useEffect(() => { if (selId) iaTemChave(selId).then(setTemChave).catch(() => setTemChave(false)); }, [selId]);
  if (!c) return <Pagina titulo="IA">{erro ? <Estado tipo="err" className="text-sm">{erro}</Estado> : <Carregando />}</Pagina>;
  const sel = c.provedores.find((p) => p.id === c.provedor) ?? c.provedores[0];
  const mudar = (campo) => setC({ ...c, provedores: c.provedores.map((p) => (p.id === sel.id ? { ...p, ...campo } : p)) });
  const gravar = async (novo) => { setErro(""); try { await iaConfigGravar(novo); setC(await iaConfigLer()); return true; } catch (e) { setErro(String(e)); return false; } };
  const ligar = async () => { if (!c.aceitou_aviso) { setAceito(false); setMsg("aviso"); return; } await gravar({ ...c, ativa: !c.ativa }); };
  const confirmarAviso = async () => { if (await gravar({ ...c, aceitou_aviso: true, ativa: true })) setMsg(""); };
  const guardar = async () => { setErro(""); try { await iaGuardarChave(sel.id, chave); setChave(""); setTemChave(true); setMsg("Chave guardada no cofre do sistema."); } catch (e) { setErro(String(e)); } };
  const apagar = async () => { setErro(""); try { await iaApagarChave(sel.id); setTemChave(false); setMsg("Chave apagada."); } catch (e) { setErro(String(e)); } };
  const testar = async () => { setErro(""); setMsg("Testando…"); try { if (!(await gravar(c))) { setMsg(""); return; } setMsg(await iaTestar()); } catch (e) { setMsg(""); setErro(String(e)); } };
  const adicionar = () => {
    let n = 1; while (c.provedores.some((p) => p.id === `outro-${n}`)) n++;
    setC({ ...c, provedor: `outro-${n}`, provedores: [...c.provedores, { id: `outro-${n}`, tipo: "openai-compat", rotulo: `Compatível ${n}`, base_url: "https://", modelo: "modelo", suporta_ferramentas: true, exige_chave: true, local: false }] });
  };
  const remover = async () => { const resto = c.provedores.filter((p) => p.id !== sel.id); try { await iaApagarChave(sel.id); } catch { /* sem chave guardada */ } await gravar({ ...c, provedor: resto[0].id, provedores: resto }); };
  const campo = "h-9 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary";
  const compat = sel.tipo === "openai-compat";
  return (
    <Pagina titulo="IA">
      <Grupo titulo="Painel de IA" nota="Conversa sobre a nota aberta. A IA só propõe alterações: nada é gravado sem você ver as diferenças e aprovar. Desligada por padrão.">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.ativa} onChange={ligar} />Ligar a IA</label>
        {msg === "aviso" && (
          <div role="alertdialog" aria-label="Aviso de privacidade" className="rounded-lg border border-warn/60 bg-warn/10 p-3 text-sm">
            <p className="font-medium">Antes de ligar</p>
            <p className="mt-1 text-xs text-muted-foreground">O texto das notas usadas na conversa (a nota aberta e o que a IA consultar) é enviado pela internet ao provedor escolhido (Anthropic, OpenAI ou outro), exceto num modelo local, que roda neste computador. Dados de alunos (correções, relatórios, diário) nunca são enviados, nem a um modelo local. As APIs são cobradas por uso, à parte de assinaturas de aplicativos de chat.</p>
            <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />Entendi e aceito</label>
            <div className="mt-2 flex gap-2">
              <button disabled={!aceito} onClick={confirmarAviso} className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50">Ligar</button>
              <button onClick={() => setMsg("")} className="rounded-md border px-3 py-1 text-sm hover:bg-accent">Cancelar</button>
            </div>
          </div>)}
      </Grupo>
      <Grupo titulo="Provedor" nota={sel.local ? "Local: nada sai do computador e não precisa de chave." : "O provedor em uso no painel. Cada um tem a sua chave."}>
        <div className="flex flex-wrap items-center gap-2">
          <select value={sel.id} onChange={(e) => { setC({ ...c, provedor: e.target.value }); setMsg(""); setChave(""); }} aria-label="Provedor" className={cn(campo, "w-56")}>
            {c.provedores.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
          <button onClick={adicionar} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Adicionar compatível…</button>
          {!PROVEDORES_FIXOS.includes(sel.id) && <button onClick={remover} className="rounded-md border px-3 py-1.5 text-sm text-err hover:bg-accent">Remover</button>}
        </div>
        {compat && <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">Nome<input value={sel.rotulo} onChange={(e) => mudar({ rotulo: e.target.value })} aria-label="Nome do provedor" className={cn(campo, "w-44")} /></label>
          <label className="flex items-center gap-2 text-sm">Endereço<input value={sel.base_url} onChange={(e) => mudar({ base_url: e.target.value })} aria-label="Endereço (base_url)" placeholder="https://…/v1" className={cn(campo, "w-72")} /></label>
        </div>}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">Modelo<input value={sel.modelo} onChange={(e) => mudar({ modelo: e.target.value })} aria-label="Modelo" className={cn(campo, "w-56")} /></label>
          <label className="flex items-center gap-2 text-sm">Máx. de tokens<input type="number" min={256} max={32000} value={c.max_tokens} onChange={(e) => setC({ ...c, max_tokens: Number(e.target.value) })} aria-label="Máximo de tokens" className={cn(campo, "w-24")} /></label>
        </div>
        {compat && <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={sel.suporta_ferramentas} onChange={(e) => mudar({ suporta_ferramentas: e.target.checked })} />Suporta ferramentas</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={sel.exige_chave} onChange={(e) => mudar({ exige_chave: e.target.checked })} />Pede chave</label>
        </div>}
        {!sel.suporta_ferramentas && <p className="text-xs text-muted-foreground">Sem ferramentas a IA só vê a nota aberta e a seleção e responde no texto, sem propor alterações.</p>}
        <div><button onClick={() => gravar(c)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Salvar</button></div>
      </Grupo>
      {sel.exige_chave && <Grupo titulo={`Chave da API (${sel.rotulo})`} nota="Guardada no cofre do sistema (Gerenciador de Credenciais do Windows). Não fica em arquivo nem aparece de novo nesta tela.">
        <div className="flex flex-wrap items-center gap-2">
          <input type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} placeholder={temChave ? "chave guardada (digite para trocar)" : "cole a chave aqui"} aria-label="Chave da API" className={cn(campo, "w-72")} />
          <button onClick={guardar} disabled={!chave.trim()} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50">Guardar</button>
          {temChave && <button onClick={apagar} className="rounded-md border px-3 py-1.5 text-sm text-err hover:bg-accent">Apagar chave</button>}
        </div>
      </Grupo>}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={testar} disabled={sel.exige_chave && !temChave} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50">Testar conexão</button>
        {msg && msg !== "aviso" && <span role="status" className="text-sm text-muted-foreground">{msg}</span>}
      </div>
      {erro && <Estado tipo="err" className="text-sm">{erro}</Estado>}
    </Pagina>
  );
}
