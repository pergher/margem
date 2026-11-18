//! Provedor "compatível com OpenAI": qualquer endpoint no formato Chat Completions (`{base_url}/chat/completions`, com `tools`
//! e `stream: true`): OpenAI, Ollama local (`http://localhost:11434/v1`), OpenRouter, Gemini no modo compatível etc.

use std::collections::BTreeMap;
use std::sync::atomic::Ordering;
use std::time::Duration;
use async_trait::async_trait;
use futures_util::StreamExt;
use serde_json::{json, Value};
use super::provedor::*;
use super::retry;
use super::sse::ParserSse;

/// Modelos locais demoram a carregar antes do primeiro byte.
const OCIOSO: Duration = Duration::from_secs(150);

pub struct OpenAiCompat { pub base_url: String, pub chave: Option<String>, pub modelo: String, pub local: bool }

impl OpenAiCompat {
    fn url(&self) -> String { format!("{}/chat/completions", self.base_url.trim_end_matches('/')) }
}

pub(crate) fn corpo(modelo: &str, base_url: &str, req: &Requisicao<'_>) -> Value {
    let mut msgs = vec![json!({"role": "system", "content": req.sistema})];
    for m in req.msgs {
        match m.papel {
            Papel::Usuario => {
                let texto: Vec<&str> = m.partes.iter().filter_map(|p| if let Parte::Texto(t) = p { Some(t.as_str()) } else { None }).collect();
                for p in &m.partes {
                    if let Parte::ResultadoFerramenta { id, texto, .. } = p { msgs.push(json!({"role": "tool", "tool_call_id": id, "content": texto})); }
                }
                if !texto.is_empty() { msgs.push(json!({"role": "user", "content": texto.join("\n")})); }
            }
            Papel::Assistente => {
                let texto: String = m.partes.iter().filter_map(|p| if let Parte::Texto(t) = p { Some(t.as_str()) } else { None }).collect::<Vec<_>>().join("\n");
                let chamadas: Vec<Value> = m.partes.iter().filter_map(|p| if let Parte::UsoFerramenta { id, nome, args, assinatura } = p {
                    let mut c = json!({"id": id, "type": "function", "function": {"name": nome, "arguments": args.to_string()}});
                    if let Some(a) = assinatura { c["extra_content"] = json!({"google": {"thought_signature": a}}); } // Gemini 3 exige a assinatura de volta
                    Some(c)
                } else { None }).collect();
                let mut o = json!({"role": "assistant", "content": if texto.is_empty() { Value::Null } else { json!(texto) }});
                if !chamadas.is_empty() { o["tool_calls"] = json!(chamadas); }
                msgs.push(o);
            }
        }
    }
    let limite = if base_url.contains("api.openai.com") { "max_completion_tokens" } else { "max_tokens" }; // modelos novos da OpenAI recusam `max_tokens`
    let mut c = json!({"model": modelo, "messages": msgs, "stream": true, "stream_options": {"include_usage": true}});
    c[limite] = json!(req.max_tokens);
    if !req.ferramentas.is_empty() {
        c["tools"] = req.ferramentas.iter().map(|f| json!({"type": "function", "function": {"name": f.nome, "description": f.descricao, "parameters": f.schema}})).collect();
    }
    c
}

/// Junta os pedaços do stream. Cada chamada de ferramenta chega em fragmentos (`function.arguments`), indexada por `index`.
#[derive(Default)]
pub(crate) struct Acumulador { texto: String, ferramentas: BTreeMap<usize, (String, String, String)>, assinaturas: BTreeMap<usize, Value>, tokens_in: u64, tokens_out: u64, pub parada: Option<String>, pub fim: bool, anunciadas: bool }

fn parada_neutra(r: &str) -> String {
    match r { "tool_calls" | "function_call" => "tool_use", "stop" => "end_turn", "length" => "max_tokens", outro => outro }.to_string()
}

fn decodificar(json: &str) -> Result<Value, String> {
    if json.trim().is_empty() { return Ok(json!({})); }
    serde_json::from_str(json).map_err(|e| format!("argumentos de ferramenta ilegíveis: {e}"))
}

impl Acumulador {
    pub(crate) fn evento(&mut self, dados: &str, emitir: &mut (dyn FnMut(Evento) + Send)) -> Result<(), String> {
        let dados = dados.trim();
        if dados.is_empty() { return Ok(()); }
        if dados == "[DONE]" { self.anunciar(emitir)?; self.fim = true; emitir(Evento::Fim(self.parada.clone().unwrap_or_else(|| "end_turn".into()))); return Ok(()); }
        let d: Value = serde_json::from_str(dados).map_err(|e| format!("resposta ilegível: {e}"))?;
        if let Some(e) = d.get("error") {
            return Err(format!("O provedor devolveu um erro: {}", e.get("message").and_then(Value::as_str).or_else(|| e.as_str()).unwrap_or("desconhecido")));
        }
        if let Some(u) = d.get("usage").filter(|u| !u.is_null()) {
            self.tokens_in = u.get("prompt_tokens").and_then(Value::as_u64).unwrap_or(self.tokens_in);
            self.tokens_out = u.get("completion_tokens").and_then(Value::as_u64).unwrap_or(self.tokens_out);
            emitir(Evento::Uso { tokens_in: self.tokens_in, tokens_out: self.tokens_out });
        }
        let Some(ch) = d.pointer("/choices/0") else { return Ok(()) };
        if let Some(t) = ch.pointer("/delta/content").and_then(Value::as_str).filter(|t| !t.is_empty()) {
            self.texto.push_str(t);
            emitir(Evento::Texto(t.to_string()));
        }
        for (pos, c) in ch.pointer("/delta/tool_calls").and_then(Value::as_array).into_iter().flatten().enumerate() {
            let i = c.get("index").and_then(Value::as_u64).map_or(pos, |i| i as usize);
            if let Some(a) = c.pointer("/extra_content/google/thought_signature").filter(|a| !a.is_null()) { self.assinaturas.entry(i).or_insert_with(|| a.clone()); }
            let e = self.ferramentas.entry(i).or_default();
            if let Some(id) = c.get("id").and_then(Value::as_str).filter(|s| !s.is_empty()) { e.0 = id.to_string(); }
            if let Some(n) = c.pointer("/function/name").and_then(Value::as_str).filter(|s| !s.is_empty()) { e.1 = n.to_string(); }
            match c.pointer("/function/arguments") { // alguns servidores mandam o objeto inteiro em vez de texto
                Some(Value::String(a)) => e.2.push_str(a),
                Some(o @ Value::Object(_)) => e.2 = o.to_string(),
                _ => {}
            }
        }
        if let Some(r) = ch.get("finish_reason").and_then(Value::as_str) { self.parada = Some(parada_neutra(r)); self.anunciar(emitir)?; }
        Ok(())
    }

    /// Chamadas de ferramenta completas, uma só vez, no fim da resposta.
    fn anunciar(&mut self, emitir: &mut (dyn FnMut(Evento) + Send)) -> Result<(), String> {
        if self.anunciadas { return Ok(()); }
        self.anunciadas = true;
        for (id, nome, args) in self.completas()? { emitir(Evento::UsoFerramenta { id, nome, args }); }
        Ok(())
    }
    fn completas(&self) -> Result<Vec<(String, String, Value)>, String> {
        self.ferramentas.iter().filter(|(_, (_, nome, _))| !nome.is_empty()).map(|(i, (id, nome, args))| {
            // servidores locais às vezes não mandam `id`: o resultado da ferramenta precisa de um para voltar
            Ok((if id.is_empty() { format!("call_{i}") } else { id.clone() }, nome.clone(), decodificar(args)?))
        }).collect()
    }

    /// Partes completas (texto e ferramentas); ferramenta com JSON cortado é descartada.
    pub(crate) fn partes(self) -> Vec<Parte> {
        let mut out = vec![];
        if !self.texto.is_empty() { out.push(Parte::Texto(self.texto.clone())); }
        for (i, (id, nome, args)) in &self.ferramentas {
            if nome.is_empty() { continue; }
            if let Ok(args) = decodificar(args) { out.push(Parte::UsoFerramenta { id: if id.is_empty() { format!("call_{i}") } else { id.clone() }, nome: nome.clone(), args, assinatura: self.assinaturas.get(i).cloned() }); }
        }
        out
    }
}

fn erro_http(status: reqwest::StatusCode, corpo: &str, local: bool, url: &str) -> String {
    let msg = serde_json::from_str::<Value>(corpo).ok()
        .and_then(|v| v.pointer("/error/message").and_then(Value::as_str).map(String::from))
        .unwrap_or_else(|| corpo.chars().take(200).collect());
    match status.as_u16() {
        401 | 403 => format!("O provedor recusou a chave ({status}). Confira a chave em Configurações › IA."),
        404 if local => format!("O servidor local respondeu 404 em {url}: o modelo existe? (no Ollama: `ollama pull <modelo>`). {msg}"),
        429 => format!("Limite de uso do provedor atingido ({status}): {msg}"),
        _ => format!("Erro do provedor {status}: {msg}"),
    }
}

#[async_trait]
impl Provedor for OpenAiCompat {
    async fn conversar(&self, req: Requisicao<'_>, emitir: &mut (dyn FnMut(Evento) + Send)) -> Result<Vec<Parte>, String> {
        let cliente = reqwest::Client::builder().connect_timeout(Duration::from_secs(15)).build().map_err(|e| e.to_string())?;
        let url = self.url();
        let corpo_json = corpo(&self.modelo, &self.base_url, &req);
        let montar = || {
            let r = cliente.post(&url).header("content-type", "application/json").json(&corpo_json);
            if let Some(c) = &self.chave { r.bearer_auth(c) } else { r }
        };
        let resp = match retry::enviar(&montar, "O provedor", req.cancelar, emitir).await {
            Ok(r) => r,
            Err(retry::Falha::Http(status, texto)) => return Err(erro_http(status, &texto, self.local, &url)),
            Err(retry::Falha::Rede(e)) => return Err(if self.local { format!("O servidor local não respondeu em {url}. O Ollama (ou similar) está rodando?") } else { format!("sem conexão com o provedor: {}", e.without_url()) }),
        };
        let (mut sse, mut acc) = (ParserSse::default(), Acumulador::default());
        let mut fluxo = resp.bytes_stream();
        loop {
            if req.cancelar.load(Ordering::Relaxed) { break; }
            let Some(pedaco) = tokio::time::timeout(OCIOSO, fluxo.next()).await.map_err(|_| "o provedor parou de responder (sem dados por 150 s)".to_string())? else { break };
            for (_, dados) in sse.empurrar(&pedaco.map_err(|e| format!("conexão interrompida: {}", e.without_url()))?) { acc.evento(&dados, emitir)?; }
            if acc.fim { break; }
        }
        Ok(acc.partes())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicBool;

    #[test]
    fn corpo_segue_o_formato_chat_completions() {
        let cancelar = AtomicBool::new(false);
        let msgs = vec![
            Msg::usuario("oi"),
            Msg { papel: Papel::Assistente, partes: vec![Parte::Texto("vou ver".into()), Parte::UsoFerramenta { id: "c1".into(), nome: "read_note".into(), args: json!({"nome": "A"}), assinatura: None }] },
            Msg { papel: Papel::Usuario, partes: vec![Parte::ResultadoFerramenta { id: "c1".into(), texto: "conteúdo".into(), erro: false }] },
        ];
        let fs = vec![Ferramenta { nome: "read_note".into(), descricao: "Lê".into(), schema: json!({"type": "object"}) }];
        let c = corpo("m", "http://localhost:11434/v1", &Requisicao { sistema: "sis", msgs: &msgs, ferramentas: &fs, max_tokens: 500, cancelar: &cancelar });
        assert_eq!(c["messages"][0], json!({"role": "system", "content": "sis"})); // o sistema vai como primeira mensagem
        assert_eq!(c["messages"][1], json!({"role": "user", "content": "oi"}));
        assert_eq!(c["messages"][2]["tool_calls"][0], json!({"id": "c1", "type": "function", "function": {"name": "read_note", "arguments": "{\"nome\":\"A\"}"}}));
        assert_eq!(c["messages"][3], json!({"role": "tool", "tool_call_id": "c1", "content": "conteúdo"}), "o resultado volta com papel `tool`");
        assert_eq!(c["tools"][0], json!({"type": "function", "function": {"name": "read_note", "description": "Lê", "parameters": {"type": "object"}}}));
        assert_eq!(c["stream"], true);
        assert_eq!(c["max_tokens"], 500);
        let o = corpo("m", "https://api.openai.com/v1", &Requisicao { sistema: "s", msgs: &msgs[..1], ferramentas: &[], max_tokens: 9, cancelar: &cancelar });
        assert_eq!(o["max_completion_tokens"], 9);
        assert!(o.get("max_tokens").is_none() && o.get("tools").is_none());
    }

    #[test]
    fn ferramenta_sem_id_e_sem_index_ainda_funciona() {
        let mut acc = Acumulador::default();
        let mut evs = vec![];
        acc.evento(r#"{"choices":[{"delta":{"tool_calls":[{"function":{"name":"progress","arguments":{"turma":"61"}}}]},"finish_reason":"tool_calls"}]}"#, &mut |e| evs.push(e)).unwrap();
        acc.evento("[DONE]", &mut |e| evs.push(e)).unwrap();
        assert_eq!(evs, vec![Evento::UsoFerramenta { id: "call_0".into(), nome: "progress".into(), args: json!({"turma": "61"}) }, Evento::Fim("tool_use".into())]);
    }

    #[test]
    fn assinatura_de_raciocinio_do_gemini_volta_na_chamada() {
        let mut acc = Acumulador::default();
        acc.evento(r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c9","function":{"name":"progress","arguments":"{}"},"extra_content":{"google":{"thought_signature":"SIG=="}}}]},"finish_reason":"tool_calls"}]}"#, &mut |_| {}).unwrap();
        let partes = acc.partes();
        assert!(matches!(&partes[0], Parte::UsoFerramenta { assinatura: Some(a), .. } if a == "SIG=="));
        let cancelar = AtomicBool::new(false);
        let msgs = vec![Msg { papel: Papel::Assistente, partes }];
        let c = corpo("m", "https://generativelanguage.googleapis.com/v1beta/openai", &Requisicao { sistema: "s", msgs: &msgs, ferramentas: &[], max_tokens: 9, cancelar: &cancelar });
        assert_eq!(c["messages"][1]["tool_calls"][0]["extra_content"]["google"]["thought_signature"], "SIG==");
    }

    #[test]
    fn erro_no_stream_vira_erro() {
        assert!(Acumulador::default().evento(r#"{"error":{"message":"modelo não encontrado"}}"#, &mut |_| {}).unwrap_err().contains("modelo não encontrado"));
    }

    #[test]
    fn erros_http_orientam_o_usuario() {
        let e = erro_http(reqwest::StatusCode::NOT_FOUND, r#"{"error":{"message":"model 'x' not found"}}"#, true, "http://localhost:11434/v1/chat/completions");
        assert!(e.contains("ollama pull") && e.contains("not found"));
        assert!(erro_http(reqwest::StatusCode::UNAUTHORIZED, "{}", false, "").contains("recusou a chave"));
    }
}
