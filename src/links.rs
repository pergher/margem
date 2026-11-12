//! Extração de wikilinks, embeds e blocos `^id`, ignorando código.

#[derive(Debug, Clone, PartialEq)]
pub struct WikiLink {
    pub target: String,
    pub anchor: Option<String>,
    pub alias: Option<String>,
    pub embed: bool,
    pub offset: usize,
}

/// Percorre as linhas indicando se cada uma está dentro de um bloco de código cercado.
pub fn lines_with_fence(text: &str) -> Vec<(usize, &str, bool)> {
    let mut out = vec![];
    let mut off = 0;
    let mut in_fence = false;
    for l in text.split_inclusive('\n') {
        let t = l.trim_start();
        let is_marker = t.starts_with("```") || t.starts_with("~~~");
        if is_marker {
            in_fence = !in_fence;
            out.push((off, l, true));
        } else {
            out.push((off, l, in_fence));
        }
        off += l.len();
    }
    out
}

pub fn extract_links(text: &str) -> Vec<WikiLink> {
    let mut out = vec![];
    for (off, line, fenced) in lines_with_fence(text) {
        if fenced {
            continue;
        }
        let b = line.as_bytes();
        let mut i = 0;
        let mut in_code = false;
        while i < b.len() {
            if b[i] == b'`' {
                in_code = !in_code;
                i += 1;
                continue;
            }
            if !in_code && b[i] == b'[' && b.get(i + 1) == Some(&b'[') {
                if let Some(rel) = line[i + 2..].find("]]") {
                    let inner = &line[i + 2..i + 2 + rel];
                    let embed = i > 0 && b[i - 1] == b'!';
                    out.push(parse_inner(inner, embed, off + i));
                    i += 2 + rel + 2;
                    continue;
                }
            }
            i += 1;
        }
    }
    out
}

fn parse_inner(inner: &str, embed: bool, offset: usize) -> WikiLink {
    let inner = inner.trim_end_matches('\\');
    let (rest, alias) = match inner.split_once('|') {
        Some((a, b)) => (a, Some(b.trim().trim_end_matches('\\').to_string())),
        None => (inner.trim_end_matches('\\'), None),
    };
    let (target, anchor) = match rest.split_once('#') {
        Some((t, a)) => (t.trim(), Some(a.trim().to_string())),
        None => (rest.trim(), None),
    };
    WikiLink { target: target.to_string(), anchor, alias, embed, offset }
}

/// Ids de bloco (`^id` no fim da linha) e títulos, para resolver âncoras.
pub fn extract_blocks(text: &str) -> Vec<String> {
    let mut out = vec![];
    for (_, line, fenced) in lines_with_fence(text) {
        if fenced {
            continue;
        }
        let t = line.trim_end();
        if let Some(pos) = t.rfind(" ^") {
            let id = &t[pos + 2..];
            if !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
                out.push(id.to_string());
            }
        }
    }
    out
}

pub fn extract_headings(text: &str) -> Vec<String> {
    lines_with_fence(text)
        .into_iter()
        .filter(|(_, l, f)| !f && l.starts_with('#'))
        .map(|(_, l, _)| l.trim_start_matches('#').trim().to_string())
        .collect()
}

pub fn line_of(text: &str, offset: usize) -> usize {
    text[..offset.min(text.len())].bytes().filter(|&b| b == b'\n').count() + 1
}
