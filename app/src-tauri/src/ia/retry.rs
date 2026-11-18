//! Tentativas automáticas para sobrecarga (503/529) e limite momentâneo (429) dos provedores, comum a todos.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use super::provedor::Evento;

/// Quantas vezes tentar de novo depois da primeira.
pub(crate) const TENTATIVAS: usize = 3;
/// Esperas padrão entre as tentativas, quando o provedor não diz quanto esperar.
const ESPERAS: [u64; TENTATIVAS] = [4, 10, 25];
/// Acima disso não vale esperar: o limite é longo (cota do dia, por exemplo) e o erro vai para a tela.
const ESPERA_MAX: u64 = 60;

pub(crate) enum Falha { Rede(reqwest::Error), Http(reqwest::StatusCode, String) }

/// Quanto esperar antes da próxima tentativa; `None` = não tentar de novo (erro definitivo ou limite longo).
pub(crate) fn espera(status: u16, retry_after: Option<&str>, corpo: &str, tentativa: usize) -> Option<Duration> {
    if !matches!(status, 429 | 503 | 529) || tentativa >= TENTATIVAS { return None; }
    let c = corpo.to_lowercase();
    // cota que não volta em segundos: por dia, ou sem saldo
    if status == 429 && ["perday", "per day", "daily", "insufficient_quota", "billing"].iter().any(|k| c.contains(k)) { return None; }
    let dica = retry_after.and_then(|v| v.trim().parse::<f64>().ok()).map(|s| s.ceil() as u64).or_else(|| atraso_no_corpo(corpo));
    match dica {
        Some(s) if s > ESPERA_MAX => None,
        Some(s) => Some(Duration::from_secs(s + 1)),
        None => Some(Duration::from_secs(ESPERAS[tentativa])),
    }
}

/// `"retryDelay": "34s"` (Gemini).
fn atraso_no_corpo(corpo: &str) -> Option<u64> {
    let i = corpo.find("retryDelay")?;
    let resto = &corpo[i + "retryDelay".len()..];
    let digitos: String = resto.chars().skip_while(|c| !c.is_ascii_digit()).take_while(|c| c.is_ascii_digit() || *c == '.').collect();
    digitos.parse::<f64>().ok().map(|s| s.ceil() as u64)
}

/// Envia o pedido e, em 503/529/429 passageiros, espera e repete, avisando a interface. Qualquer outra resposta com erro HTTP
/// vira `Falha::Http` (já com o corpo lido); resposta de sucesso é devolvida para o chamador ler o stream.
pub(crate) async fn enviar(
    montar: &(dyn Fn() -> reqwest::RequestBuilder + Sync), rotulo: &str, cancelar: &AtomicBool, emitir: &mut (dyn FnMut(Evento) + Send),
) -> Result<reqwest::Response, Falha> {
    let mut tentativa = 0;
    loop {
        let resp = montar().send().await.map_err(Falha::Rede)?;
        let status = resp.status();
        if status.is_success() { return Ok(resp); }
        let retry_after = resp.headers().get("retry-after").and_then(|v| v.to_str().ok()).map(String::from);
        let corpo = resp.text().await.unwrap_or_default();
        let Some(d) = espera(status.as_u16(), retry_after.as_deref(), &corpo, tentativa) else { return Err(Falha::Http(status, corpo)) };
        if cancelar.load(Ordering::Relaxed) { return Err(Falha::Http(status, corpo)); }
        tentativa += 1;
        let motivo = if status.as_u16() == 429 { "limite momentâneo de uso (429)" } else { "sobrecarregado" };
        emitir(Evento::Aviso(format!("{rotulo}: {motivo}. Nova tentativa em {} s ({tentativa}/{TENTATIVAS})…", d.as_secs())));
        let fim = tokio::time::Instant::now() + d;
        while tokio::time::Instant::now() < fim {
            if cancelar.load(Ordering::Relaxed) { return Err(Falha::Http(status, corpo)); }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sobrecarga_tenta_de_novo_com_espera_crescente_e_para_no_limite() {
        let s = |t| espera(503, None, "{}", t).map(|d| d.as_secs());
        assert_eq!((s(0), s(1), s(2), s(3)), (Some(4), Some(10), Some(25), None));
        assert!(espera(529, None, "", 0).is_some());
    }

    #[test]
    fn erros_definitivos_nao_repetem() {
        for st in [400, 401, 403, 404, 500] { assert!(espera(st, None, "{}", 0).is_none(), "{st}"); }
    }

    #[test]
    fn limite_por_minuto_espera_o_tempo_dito_pelo_provedor() {
        assert_eq!(espera(429, Some("7"), "{}", 0), Some(Duration::from_secs(8)));
        let gemini = r#"{"error":{"code":429,"details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"34s"}]}}"#;
        assert_eq!(espera(429, None, gemini, 0), Some(Duration::from_secs(35)));
        assert!(espera(429, Some("600"), "{}", 0).is_none(), "espera longa demais: mostra o erro");
    }

    #[test]
    fn cota_do_dia_ou_sem_saldo_nao_repete() {
        assert!(espera(429, None, r#"{"error":{"message":"Quota exceeded ... GenerateRequestsPerDayPerProjectPerModel-FreeTier"}}"#, 0).is_none());
        assert!(espera(429, None, r#"{"error":{"code":"insufficient_quota"}}"#, 0).is_none());
    }
}
