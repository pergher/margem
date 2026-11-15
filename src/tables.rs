//! Tabelas Markdown com posições em bytes, para edição parcial de células.

use crate::links::lines_with_fence;

#[derive(Debug, Clone)]
pub struct Cell {
    /// Intervalo bruto entre dois `|`.
    pub raw: (usize, usize),
    pub text: String,
}

#[derive(Debug, Clone)]
pub struct Table {
    pub start: usize,
    pub end: usize,
    pub header: Vec<Cell>,
    /// Linhas de dados (sem cabeçalho e sem a linha `---`).
    pub rows: Vec<Vec<Cell>>,
}

fn split_cells(line: &str, line_off: usize) -> Vec<Cell> {
    let t = line.trim_end_matches(['\n', '\r']);
    let b = t.as_bytes();
    let mut bars = vec![];
    let mut i = 0;
    let mut in_code = false;
    while i < b.len() {
        match b[i] {
            b'\\' => i += 1,
            b'`' => in_code = !in_code,
            b'|' if !in_code => bars.push(i),
            _ => {}
        }
        i += 1;
    }
    let first = t.trim_start().starts_with('|');
    let mut edges: Vec<usize> = vec![];
    if !first {
        edges.push(usize::MAX); // marcador de "antes do início"
    }
    edges.extend(bars.iter().copied());
    if !t.trim_end().ends_with('|') {
        edges.push(t.len());
    }
    let mut cells = vec![];
    for w in edges.windows(2) {
        let a = if w[0] == usize::MAX { 0 } else { w[0] + 1 };
        let e = w[1];
        if a <= e {
            cells.push(Cell { raw: (line_off + a, line_off + e), text: t[a..e].trim().to_string() });
        }
    }
    cells
}

fn is_separator(line: &str) -> bool {
    let t = line.trim().trim_matches('|');
    !t.is_empty() && t.split('|').all(|c| {
        let c = c.trim();
        !c.is_empty() && c.chars().all(|ch| ch == '-' || ch == ':')
    })
}

pub fn find_tables(text: &str) -> Vec<Table> {
    let lines = lines_with_fence(text);
    let mut out = vec![];
    let mut i = 0;
    while i < lines.len() {
        let (off, line, fenced) = lines[i];
        if !fenced && line.trim_start().starts_with('|') {
            let mut j = i;
            while j < lines.len() && !lines[j].2 && lines[j].1.trim_start().starts_with('|') {
                j += 1;
            }
            if j - i >= 2 && is_separator(lines[i + 1].1) {
                let header = split_cells(line, off);
                let rows = (i + 2..j).map(|k| split_cells(lines[k].1, lines[k].0)).collect();
                let end = lines[j - 1].0 + lines[j - 1].1.len();
                out.push(Table { start: off, end, header, rows });
            }
            i = j.max(i + 1);
        } else {
            i += 1;
        }
    }
    out
}

/// `|` dentro do texto da célula vira `\|` (senão a célula se parte em duas) e quebra de linha vira espaço.
fn escape_cell(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut prev_backslash = false;
    for c in s.chars() {
        match c {
            '|' if !prev_backslash => out.push_str("\\|"),
            '\n' | '\r' => out.push(' '),
            _ => out.push(c),
        }
        prev_backslash = c == '\\';
    }
    out
}

/// Substitui só o conteúdo de uma célula; o restante do arquivo fica idêntico, byte a byte.
pub fn replace_cell(text: &str, cell: &Cell, new: &str) -> String {
    let new = &escape_cell(new);
    let (a, b) = cell.raw;
    let raw = &text[a..b];
    if raw.trim().is_empty() {
        // célula vazia: ocupa o espaço inteiro com " novo "
        let repl = if new.is_empty() { raw.to_string() } else { format!(" {new} ") };
        return format!("{}{}{}", &text[..a], repl, &text[b..]);
    }
    let lead = raw.len() - raw.trim_start().len();
    let trail = raw.len() - raw.trim_end().len();
    format!("{}{}{}", &text[..a + lead], new, &text[b - trail..])
}
