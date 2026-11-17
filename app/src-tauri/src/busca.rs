//! Busca no texto das notas e leitura de embeds (`![[alvo]]`).

use std::path::Path;
use serde::Serialize;
use tauri::State;
use crate::caminhos::slash;
use crate::{com_vault, App};

// ---------- busca no texto e embeds ----------

/// Minúsculas sem acento, para comparar texto em português.
pub(crate) fn fold(s: &str) -> String {
    s.chars().flat_map(|c| c.to_lowercase()).map(|c| match c {
        'á' | 'à' | 'â' | 'ã' | 'ä' => 'a', 'é' | 'è' | 'ê' | 'ë' => 'e', 'í' | 'ì' | 'î' | 'ï' => 'i',
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o', 'ú' | 'ù' | 'û' | 'ü' => 'u', 'ç' => 'c', c => c,
    }).collect()
}

#[derive(Serialize)]
pub struct Hit { name: String, path: String, rel: String, line: usize, snippet: String, count: usize }

/// Busca no conteúdo das notas (todas as palavras, sem acento nem maiúsculas). Mais ocorrências primeiro.
#[tauri::command]
pub fn search_text(app: State<App>, query: String, limit: Option<usize>) -> Result<Vec<Hit>, String> {
    let terms: Vec<String> = fold(&query).split_whitespace().map(String::from).collect();
    if terms.is_empty() { return Ok(vec![]); }
    let root = app.root();
    let mut hits = vec![];
    com_vault(&app, |v| for n in &v.notes {
        let low = fold(&n.text);
        if !terms.iter().all(|t| low.contains(t.as_str())) { continue; }
        let count = terms.iter().map(|t| low.matches(t.as_str()).count()).sum();
        let lines: Vec<&str> = n.text.lines().collect();
        let best = lines.iter().enumerate().max_by_key(|(i, l)| {
            let f = fold(l); (terms.iter().filter(|t| f.contains(t.as_str())).count(), std::cmp::Reverse(*i))
        }).map(|(i, _)| i).unwrap_or(0);
        let snippet: String = lines.get(best).map(|l| l.trim()).unwrap_or("").chars().take(160).collect();
        hits.push(Hit {
            name: n.name.clone(), path: slash(&n.path),
            rel: n.path.strip_prefix(&root).unwrap_or(&n.path).to_string_lossy().replace('\\', "/"),
            line: best + 1, snippet, count,
        });
    })?;
    hits.sort_by(|a, b| b.count.cmp(&a.count).then(a.name.cmp(&b.name)));
    hits.truncate(limit.unwrap_or(50));
    Ok(hits)
}

pub(crate) fn base64(b: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(b.len() * 4 / 3 + 4);
    for c in b.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        for i in 0..4 {
            if i <= c.len() { out.push(T[(n >> (18 - 6 * i) & 63) as usize] as char) } else { out.push('=') }
        }
    }
    out
}

/// Trecho de uma nota: seção de um título (`#Título`) ou parágrafo de um bloco (`#^id`); sem âncora, o corpo todo.
pub(crate) fn section(body: &str, anchor: Option<&str>) -> String {
    let Some(a) = anchor.map(str::trim).filter(|a| !a.is_empty()) else { return body.to_string() };
    let lines: Vec<&str> = body.lines().collect();
    if let Some(id) = a.strip_prefix('^') {
        let Some(i) = lines.iter().position(|l| l.trim_end().ends_with(&format!("^{id}"))) else { return body.to_string() };
        let (mut s, mut e) = (i, i);
        while s > 0 && !lines[s - 1].trim().is_empty() { s -= 1; }
        while e + 1 < lines.len() && !lines[e + 1].trim().is_empty() { e += 1; }
        return lines[s..=e].join("\n").replace(&format!("^{id}"), "").trim_end().to_string();
    }
    let level = |l: &str| l.chars().take_while(|c| *c == '#').count();
    let Some(i) = lines.iter().position(|l| level(l) > 0 && l.trim_start_matches('#').trim().eq_ignore_ascii_case(a)) else { return body.to_string() };
    let lv = level(lines[i]);
    let end = lines[i + 1..].iter().position(|l| level(l) > 0 && level(l) <= lv).map_or(lines.len(), |k| i + 1 + k);
    lines[i..end].join("\n")
}

/// Conteúdo de `![[alvo]]`: imagem (caminho, ou data URL com `inline`), nota (texto sem frontmatter) ou arquivo de outro tipo.
#[tauri::command]
pub fn read_embed(app: State<App>, target: String, anchor: Option<String>, inline: Option<bool>) -> Result<Option<serde_json::Value>, String> {
    use serde_json::json;
    let last = target.rsplit('/').next().unwrap_or(&target).trim().to_string();
    if !last.contains('.') || last.to_lowercase().ends_with(".md") {
        return com_vault(&app, |v| v.resolve(&target).map(|n| {
            let text = section(n.body(), anchor.as_deref());
            let text: String = text.chars().take(20000).collect();
            json!({ "kind": "note", "name": n.name, "path": slash(&n.path), "text": text })
        }));
    }
    // Anexo: o caminho vem do índice do vault em cache, sem percorrer o disco a cada embed.
    let Some(f) = com_vault(&app, |v| v.attachment_path(&last).map(Path::to_path_buf))? else { return Ok(None) };
    let ext = f.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    let mime = match ext.as_str() { "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "gif" => "image/gif", "webp" => "image/webp", "svg" => "image/svg+xml", _ => "" };
    let name = f.file_name().unwrap_or_default().to_string_lossy().to_string();
    if mime.is_empty() || f.metadata().map_or(true, |m| m.len() > 12_000_000) { return Ok(Some(json!({ "kind": "file", "name": name }))); }
    // Padrão: só o caminho (a tela carrega pelo protocolo `asset:`, sem base64 pela ponte). `inline` pede o data URL (logo da prova, exportações).
    if !inline.unwrap_or(false) { return Ok(Some(json!({ "kind": "image", "name": name, "path": slash(&f) }))); }
    let data = std::fs::read(&f).map_err(|e| e.to_string())?;
    Ok(Some(json!({ "kind": "image", "name": name, "data": format!("data:{mime};base64,{}", base64(&data)) })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_e_secao() {
        assert_eq!(base64(b"Man"), "TWFu");
        assert_eq!(base64(b"Ma"), "TWE=");
        assert_eq!(base64(b"M"), "TQ==");
        assert_eq!(fold("Ação Árvore"), "acao arvore");
        let t = "# A\nx\n## B\ny\n## C\nw\n\nz\nbloco ^id1\n";
        assert_eq!(section(t, Some("b")), "## B\ny");
        assert_eq!(section(t, Some("^id1")), "z\nbloco");
    }
}
