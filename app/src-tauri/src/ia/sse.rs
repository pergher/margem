//! Separador de stream SSE, comum aos provedores.

/// Separa o stream SSE em eventos `(nome, dados)`. Os pedaços de rede chegam cortados em qualquer lugar.
#[derive(Default)]
pub(crate) struct ParserSse { buf: Vec<u8> }

impl ParserSse {
    pub(crate) fn empurrar(&mut self, bytes: &[u8]) -> Vec<(String, String)> {
        self.buf.extend_from_slice(bytes);
        let mut out = vec![];
        loop {
            // um evento termina numa linha em branco (aceita \n\n e \r\n\r\n)
            let achou = self.buf.windows(2).position(|w| w == b"\n\n").map(|i| (i, 2)).or_else(|| self.buf.windows(4).position(|w| w == b"\r\n\r\n").map(|i| (i, 4)));
            let Some((i, n)) = achou else { break };
            let bloco: Vec<u8> = self.buf.drain(..i + n).collect();
            let texto = String::from_utf8_lossy(&bloco[..i]);
            let (mut nome, mut dados) = (String::new(), vec![]);
            for l in texto.lines() {
                if let Some(v) = l.strip_prefix("event:") { nome = v.trim().to_string(); }
                else if let Some(v) = l.strip_prefix("data:") { dados.push(v.strip_prefix(' ').unwrap_or(v).to_string()); }
            }
            if !dados.is_empty() || !nome.is_empty() { out.push((nome, dados.join("\n"))); }
        }
        out
    }
}

