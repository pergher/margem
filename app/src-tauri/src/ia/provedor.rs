//! Tipos neutros e a trait dos provedores de IA, desacoplados do Tauri (para testar sem rede e para a Etapa N).

use std::sync::atomic::AtomicBool;
use async_trait::async_trait;
use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Papel { Usuario, Assistente }

#[derive(Clone, Debug, PartialEq)]
pub enum Parte {
    Texto(String),
    /// `assinatura`: dado opaco que o provedor (Gemini 3) exige de volta junto da chamada.
    UsoFerramenta { id: String, nome: String, args: Value, assinatura: Option<Value> },
    ResultadoFerramenta { id: String, texto: String, erro: bool },
}

#[derive(Clone, Debug, PartialEq)]
pub struct Msg { pub papel: Papel, pub partes: Vec<Parte> }

impl Msg {
    pub fn usuario(texto: impl Into<String>) -> Self { Msg { papel: Papel::Usuario, partes: vec![Parte::Texto(texto.into())] } }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Ferramenta { pub nome: String, pub descricao: String, /** JSON Schema dos argumentos */ pub schema: Value }

/// O que o provedor conta durante a resposta (streaming).
#[derive(Clone, Debug, PartialEq)]
pub enum Evento {
    Texto(String),
    /// Chamada de ferramenta já completa (argumentos decodificados).
    UsoFerramenta { id: String, nome: String, args: Value },
    Uso { tokens_in: u64, tokens_out: u64 },
    /// Aviso para a tela (por exemplo, "tentando de novo"); não faz parte da resposta.
    Aviso(String),
    /// Motivo de parada informado pelo provedor (`end_turn`, `tool_use`, `max_tokens`...).
    Fim(String),
}

pub struct Requisicao<'a> {
    pub sistema: &'a str,
    pub msgs: &'a [Msg],
    pub ferramentas: &'a [Ferramenta],
    pub max_tokens: u32,
    /// Checado a cada pedaço do stream: se virar `true`, o provedor para e devolve o que já recebeu.
    pub cancelar: &'a AtomicBool,
}

#[async_trait]
pub trait Provedor: Send + Sync {
    /// Uma volta de conversa. Devolve as partes da resposta do assistente (texto e chamadas de ferramenta completas).
    async fn conversar(&self, req: Requisicao<'_>, emitir: &mut (dyn FnMut(Evento) + Send)) -> Result<Vec<Parte>, String>;
}
