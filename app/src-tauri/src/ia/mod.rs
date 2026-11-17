//! IA dentro do Margem (Etapa M). Regras: nada vindo de IA grava sem aprovação (só `propostas`); a rede e a chave ficam no
//! Rust; dados de alunos não saem (checado em `contexto` e nas ferramentas); conversas só em memória.

pub mod agente;
pub mod anthropic;
pub mod contexto;
pub mod ferramentas;
pub mod provedor;
pub mod openai_compat;
pub mod segredos;
pub(crate) mod sse;
#[cfg(test)]
mod testes;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter, Manager, State};
use agente::{rodar, Config, EventoIA, MAX_VOLTAS};
use contexto::{montar_contexto, Contexto, ContextoMontado};
use ferramentas::FerramentasVault;
use provedor::{Msg, Provedor, Requisicao};
use crate::gravacao::gravar_atomico;
use crate::{lock, App};

/// Convenções do vault (as mesmas que o Claude Code lê) + regras próprias do painel.
pub(crate) const SISTEMA: &str = concat!(
    include_str!("../../../../docs/CLAUDE.vault.md"),
    "\n\n## Você está dentro do Margem\n",
    "- Responda sempre em português do Brasil, de forma direta.\n",
    "- Você NUNCA grava nada: para alterar uma nota use `propor_edicao` (texto COMPLETO da nota) e para criar use `propor_nota`. ",
    "O professor vê as diferenças e aprova antes de qualquer gravação.\n",
    "- Use as ferramentas de leitura para consultar o vault em vez de adivinhar. Não invente campos de frontmatter nem códigos de conteúdo.\n",
    "- Não inclua dados de alunos (nomes, textos, notas) em nada que você escrever; notas de correção, diário e alunos não estão disponíveis.\n",
    "- A nota aberta no editor chega como contexto na pergunta, quando o professor deixa. Preserve o que não precisa mudar.\n",
);

#[derive(Default)]
pub struct Estado {
    conversas: Mutex<HashMap<String, Vec<Msg>>>,
    cancelar: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

/// Um provedor configurado. `tipo`: `anthropic` ou `openai-compat` (qualquer endpoint Chat Completions).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ProvedorCfg {
    pub id: String,
    pub tipo: String,
    pub rotulo: String,
    /// Só para `openai-compat`.
    #[serde(default)]
    pub base_url: String,
    pub modelo: String,
    /// Sem suporte, a conversa roda sem ferramentas: só a nota aberta e a seleção.
    pub suporta_ferramentas: bool,
    /// Provedor local (Ollama) não pede chave.
    pub exige_chave: bool,
    /// Calculado ao ler: o endereço é deste computador ("nada sai do computador").
    #[serde(default)]
    pub local: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ConfigIA {
    /// Desligada por padrão.
    pub ativa: bool,
    /// `id` do provedor em uso.
    pub provedor: String,
    pub max_tokens: u32,
    /// O usuário leu que o texto das notas usadas na conversa é enviado ao provedor.
    pub aceitou_aviso: bool,
    #[serde(default = "provedores_padrao")]
    pub provedores: Vec<ProvedorCfg>,
    /// Campo da Etapa M (um só provedor): na leitura passa para o provedor `anthropic` e deixa de ser gravado.
    #[serde(default, skip_serializing)]
    modelo: Option<String>,
}

pub(crate) fn provedores_padrao() -> Vec<ProvedorCfg> {
    let p = |id: &str, tipo: &str, rotulo: &str, base_url: &str, modelo: &str, ferr: bool, chave: bool| ProvedorCfg {
        id: id.into(), tipo: tipo.into(), rotulo: rotulo.into(), base_url: base_url.into(), modelo: modelo.into(), suporta_ferramentas: ferr, exige_chave: chave, local: false,
    };
    vec![
        p("anthropic", "anthropic", "Claude", "", "claude-sonnet-5-5", true, true),
        p("openai", "openai-compat", "OpenAI", "https://api.openai.com/v1", "gpt-4o", true, true),
        p("gemini", "openai-compat", "Gemini", "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-3.5-flash-lite", true, true),
        p("local", "openai-compat", "Local (Ollama)", "http://localhost:11434/v1", "llama3.1", false, false),
    ]
}

impl Default for ConfigIA {
    fn default() -> Self { ConfigIA { ativa: false, provedor: "anthropic".into(), max_tokens: 4096, aceitou_aviso: false, provedores: provedores_padrao(), modelo: None } }
}

impl ConfigIA {
    pub fn selecionado(&self) -> Option<&ProvedorCfg> { self.provedores.iter().find(|p| p.id == self.provedor) }

    /// Depois de ler: migra o formato antigo e calcula `local`.
    fn normalizar(mut self) -> Self {
        if let Some(m) = self.modelo.take() { if let Some(a) = self.provedores.iter_mut().find(|p| p.id == "anthropic") { a.modelo = m; } }
        // Configurações gravadas antes do Gemini existir: acrescenta o provedor (antes do local, se houver).
        if !self.provedores.iter().any(|p| p.id == "gemini") {
            if let Some(g) = provedores_padrao().into_iter().find(|p| p.id == "gemini") {
                let pos = self.provedores.iter().position(|p| p.id == "local").unwrap_or(self.provedores.len());
                self.provedores.insert(pos, g);
            }
        }
        for p in &mut self.provedores { p.local = p.tipo == "openai-compat" && e_local(&p.base_url); }
        self
    }
}

/// O endereço é deste computador (localhost, 127.0.0.1 ou ::1)?
pub(crate) fn e_local(url: &str) -> bool {
    let resto = url.split_once("://").map_or(url, |(_, r)| r);
    let host = resto.split(['/', '?']).next().unwrap_or("");
    let host = host.rsplit_once('@').map_or(host, |(_, h)| h); // usuario@host
    let host = if let Some(h) = host.strip_prefix('[') { h.split(']').next().unwrap_or("") } else { host.split(':').next().unwrap_or("") };
    matches!(host.to_lowercase().as_str(), "localhost" | "127.0.0.1" | "::1")
}

fn arquivo_config(h: &AppHandle) -> Result<std::path::PathBuf, String> {
    h.path().app_config_dir().map(|d| d.join("ia.json")).map_err(|e| e.to_string())
}

fn id_valido(id: &str) -> bool { !id.is_empty() && id.len() <= 40 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') }

pub(crate) fn validar(c: &ConfigIA) -> Result<(), String> {
    if !(256..=32_000).contains(&c.max_tokens) { return Err("max_tokens deve ficar entre 256 e 32000".into()); }
    if c.provedores.is_empty() || c.provedores.len() > 12 { return Err("lista de provedores inválida".into()); }
    let mut vistos = std::collections::HashSet::new();
    for p in &c.provedores {
        if !id_valido(&p.id) || !vistos.insert(p.id.as_str()) { return Err(format!("identificador de provedor inválido ou repetido: {:?}", p.id)); }
        if p.rotulo.trim().is_empty() || p.rotulo.len() > 60 { return Err("nome do provedor inválido".into()); }
        if p.modelo.trim().is_empty() || p.modelo.len() > 100 || p.modelo.chars().any(char::is_whitespace) { return Err(format!("nome de modelo inválido em {}", p.rotulo)); }
        match p.tipo.as_str() {
            "anthropic" => {}
            "openai-compat" => {
                let u = p.base_url.trim();
                // a chave nunca viaja em texto puro para fora do computador
                let ok = u.starts_with("https://") || (u.starts_with("http://") && e_local(u));
                if !ok || u.len() > 200 || u.chars().any(char::is_whitespace) { return Err(format!("endereço inválido em {} (use https://; http só para localhost)", p.rotulo)); }
            }
            _ => return Err(format!("tipo de provedor desconhecido em {}", p.rotulo)),
        }
    }
    if c.selecionado().is_none() { return Err("provedor selecionado não existe".into()); }
    if c.ativa && !c.aceitou_aviso { return Err("antes de ligar a IA é preciso aceitar o aviso de privacidade".into()); }
    Ok(())
}

#[tauri::command]
pub fn ia_config_ler(h: AppHandle) -> Result<ConfigIA, String> {
    let p = arquivo_config(&h)?;
    Ok(std::fs::read_to_string(p).ok().and_then(|t| serde_json::from_str::<ConfigIA>(&t).ok()).unwrap_or_default().normalizar())
}

#[tauri::command]
pub fn ia_config_gravar(h: AppHandle, config: ConfigIA) -> Result<(), String> {
    let config = config.normalizar();
    validar(&config)?;
    let p = arquivo_config(&h)?;
    if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
    gravar_atomico(&p, &serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?)
}

/// O que seria enviado junto da próxima pergunta ("Ver o que foi enviado").
#[tauri::command]
pub fn ia_previa_contexto(app: State<App>, contexto: Option<Contexto>) -> ContextoMontado { montar_contexto(&app, contexto.as_ref()) }

pub(crate) fn provedor_de(cfg: &ConfigIA) -> Result<(Box<dyn Provedor>, &ProvedorCfg), String> {
    let p = cfg.selecionado().ok_or("provedor selecionado não existe")?;
    let chave = segredos::ler(&p.id)?;
    if p.exige_chave && chave.is_none() { return Err(format!("Falta a chave de API de {}: Configurações › IA.", p.rotulo)); }
    let prov: Box<dyn Provedor> = match p.tipo.as_str() {
        "anthropic" => Box::new(anthropic::Anthropic::novo(chave.unwrap_or_default(), p.modelo.clone())),
        _ => Box::new(openai_compat::OpenAiCompat { base_url: p.base_url.clone(), chave, modelo: p.modelo.clone(), local: p.local }),
    };
    Ok((prov, p))
}

/// Sem suporte a ferramentas o modelo só vê a nota aberta e a seleção; não pode propor nada.
struct SemFerramentas;
impl ferramentas::Ferramentas for SemFerramentas {
    fn lista(&self) -> Vec<provedor::Ferramenta> { vec![] }
    fn executar(&self, nome: &str, _: &serde_json::Value) -> ferramentas::Saida { ferramentas::Saida { texto: format!("ferramenta `{nome}` indisponível neste provedor"), erro: true, proposta: None } }
}

const AVISO_SEM_FERRAMENTAS: &str = "\n\n## Modo sem ferramentas\nNeste provedor você não tem ferramentas: não consulta o vault nem propõe alterações. Trabalhe só com a nota aberta e o trecho selecionado que vierem na pergunta e escreva o texto sugerido na própria resposta, para o professor copiar.\n";

#[tauri::command]
pub async fn ia_enviar(h: AppHandle, app: State<'_, App>, conversa_id: String, texto: String, contexto: Option<Contexto>, canal: Channel<EventoIA>) -> Result<(), String> {
    let cfg = ia_config_ler(h.clone())?;
    if !cfg.ativa || !cfg.aceitou_aviso { return Err("A IA está desligada: ligue em Configurações › IA.".into()); }
    if texto.trim().is_empty() { return Err("pergunta vazia".into()); }
    let (prov, pcfg) = provedor_de(&cfg)?;
    let flag = Arc::new(AtomicBool::new(false));
    {
        let mut c = lock(&app.ia.cancelar);
        if c.contains_key(&conversa_id) { return Err("já há uma resposta em andamento nesta conversa".into()); }
        c.insert(conversa_id.clone(), flag.clone());
    }
    let ctx = montar_contexto(&app, contexto.as_ref());
    if let Some(a) = &ctx.aviso { let _ = canal.send(EventoIA::Aviso { msg: a.clone() }); }
    let pergunta = Msg::usuario(match &ctx.texto { Some(c) => format!("{c}\n\n{texto}"), None => texto });
    let mut msgs = lock(&app.ia.conversas).remove(&conversa_id).unwrap_or_default();
    let h2 = h.clone();
    let ao_propor = move |p: &crate::propostas::Proposta| { let _ = h2.emit("proposta-nova", p); };
    {
        let completas = FerramentasVault { app: &app, aberta: ctx.aberta, ao_propor: &ao_propor };
        let sem = SemFerramentas;
        let ferr: &dyn ferramentas::Ferramentas = if pcfg.suporta_ferramentas { &completas } else { &sem };
        let sistema = if pcfg.suporta_ferramentas { SISTEMA.to_string() } else { format!("{SISTEMA}{AVISO_SEM_FERRAMENTAS}") };
        let cfg_ag = Config { sistema: &sistema, max_tokens: cfg.max_tokens, max_voltas: MAX_VOLTAS };
        let mut emitir = |e: EventoIA| { let _ = canal.send(e); };
        rodar(prov.as_ref(), ferr, &cfg_ag, &mut msgs, pergunta, &flag, &mut emitir).await;
    }
    lock(&app.ia.conversas).insert(conversa_id.clone(), msgs);
    lock(&app.ia.cancelar).remove(&conversa_id);
    Ok(())
}

#[tauri::command]
pub fn ia_cancelar(app: State<App>, conversa_id: String) {
    if let Some(f) = lock(&app.ia.cancelar).get(&conversa_id) { f.store(true, Ordering::Relaxed); }
}

/// Esquece a conversa (nova conversa).
#[tauri::command]
pub fn ia_limpar(app: State<App>, conversa_id: String) { lock(&app.ia.conversas).remove(&conversa_id); }

/// "Testar conexão": uma pergunta mínima, sem ferramentas e sem nada do vault.
#[tauri::command]
pub async fn ia_testar(h: AppHandle) -> Result<String, String> {
    let cfg = ia_config_ler(h)?;
    let (prov, pcfg) = provedor_de(&cfg)?;
    let nao = AtomicBool::new(false);
    let msgs = vec![Msg::usuario("Responda apenas: ok")];
    let mut resp = String::new();
    // max_tokens folgado: modelos que "pensam" (Gemini 3, por ex.) gastam parte do limite antes de escrever.
    {
        let mut coletar = |e| if let provedor::Evento::Texto(t) = e { resp.push_str(&t); };
        let chamada = prov.conversar(Requisicao { sistema: "Responda de forma curta.", msgs: &msgs, ferramentas: &[], max_tokens: 512, cancelar: &nao }, &mut coletar);
        match tokio::time::timeout(std::time::Duration::from_secs(40), chamada).await {
            Err(_) => return Err(format!("{} não respondeu em 40 s (modelo {}). Confira o nome do modelo e a chave.", pcfg.rotulo, pcfg.modelo)),
            Ok(r) => { r?; }
        }
    }
    if resp.trim().is_empty() { return Err(format!("{} conectou, mas o modelo {} não devolveu texto. Tente outro modelo.", pcfg.rotulo, pcfg.modelo)); }
    Ok(format!("Conexão ok ({} · {}): {}", pcfg.rotulo, pcfg.modelo, resp.trim()))
}
