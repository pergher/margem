use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde_yaml_ng::Value;

use crate::{frontmatter, links};

pub struct Note {
    pub path: PathBuf,
    pub name: String,
    pub text: String,
    pub body_start: usize,
    pub frontmatter: Option<Value>,
    pub frontmatter_error: Option<String>,
    pub links: Vec<links::WikiLink>,
    pub blocks: Vec<String>,
    pub headings: Vec<String>,
}

impl Note {
    pub fn parse(path: PathBuf, text: String) -> Note {
        let name = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        let sp = frontmatter::split(&text);
        let (fm, err) = match &sp.yaml {
            Some(y) => match frontmatter::parse(y) {
                Ok(v) => (Some(v), None),
                Err(e) => (None, Some(e)),
            },
            None => (None, None),
        };
        Note {
            links: links::extract_links(&text),
            blocks: links::extract_blocks(&text),
            headings: links::extract_headings(&text),
            path,
            name,
            body_start: sp.body_start,
            text,
            frontmatter: fm,
            frontmatter_error: err,
        }
    }

    pub fn field(&self, key: &str) -> Option<&Value> {
        self.frontmatter.as_ref()?.get(key)
    }

    pub fn tipo(&self) -> Option<&str> {
        self.field("tipo")?.as_str()
    }

    pub fn body(&self) -> &str {
        &self.text[self.body_start..]
    }
}

pub struct Vault {
    pub root: PathBuf,
    pub notes: Vec<Note>,
    /// `.md` que não puderam ser lidos como UTF-8 (ex.: Latin-1 de arquivos antigos): ficam de fora e aparecem na validação.
    pub ilegiveis: Vec<(PathBuf, String)>,
    by_name: HashMap<String, usize>,
    /// Arquivos não-Markdown (imagens, PDFs) por nome em minúsculas, para resolver embeds (o primeiro encontrado vence).
    attachments: HashMap<String, PathBuf>,
}

fn norm(s: &str) -> String {
    s.trim().to_lowercase()
}

impl Vault {
    pub fn open(root: &Path) -> std::io::Result<Vault> {
        let mut files = vec![];
        let mut attachments = HashMap::new();
        walk(root, &mut files, &mut attachments)?;
        files.sort();
        let mut notes = vec![];
        let mut ilegiveis = vec![];
        for f in files {
            match fs::read_to_string(&f) {
                Ok(text) => notes.push(Note::parse(f, text)),
                Err(e) if e.kind() == std::io::ErrorKind::InvalidData => ilegiveis.push((f, "não está em UTF-8".to_string())),
                Err(e) => return Err(e),
            }
        }
        let mut by_name = HashMap::new();
        for (i, n) in notes.iter().enumerate() {
            by_name.entry(norm(&n.name)).or_insert(i);
        }
        Ok(Vault { root: root.to_path_buf(), notes, ilegiveis, by_name, attachments })
    }

    /// Resolve por nome, nunca por caminho: usa só o último segmento do alvo.
    pub fn has_attachment(&self, target: &str) -> bool {
        let last = target.rsplit('/').next().unwrap_or(target);
        self.attachments.contains_key(&norm(last))
    }

    /// Caminho do anexo (não-Markdown) com esse nome, sem percorrer o disco de novo.
    pub fn attachment_path(&self, target: &str) -> Option<&Path> {
        let last = target.rsplit('/').next().unwrap_or(target);
        self.attachments.get(&norm(last)).map(PathBuf::as_path)
    }

    pub fn resolve(&self, target: &str) -> Option<&Note> {
        let last = target.rsplit('/').next().unwrap_or(target);
        let last = last.strip_suffix(".md").unwrap_or(last);
        self.by_name.get(&norm(last)).map(|&i| &self.notes[i])
    }

    pub fn by_tipo<'a>(&'a self, tipo: &'a str) -> impl Iterator<Item = &'a Note> {
        self.notes.iter().filter(move |n| n.tipo() == Some(tipo))
    }
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>, att: &mut HashMap<String, PathBuf>) -> std::io::Result<()> {
    for e in fs::read_dir(dir)? {
        let p = e?.path();
        let name = p.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        if name.starts_with('.') {
            continue; // .obsidian e afins nunca são tocados
        }
        if p.is_dir() {
            walk(&p, out, att)?;
        } else if p.extension().is_some_and(|x| x == "md") {
            out.push(p);
        } else {
            att.entry(norm(&name)).or_insert(p);
        }
    }
    Ok(())
}
