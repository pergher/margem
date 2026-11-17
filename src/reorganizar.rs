//! Move as notas para a estrutura de docs/formato-do-vault.md e troca links por caminho
//! por links por nome. Nunca renomeia arquivos; só muda de pasta.

use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::links::extract_links;

pub struct Move {
    pub from: PathBuf,
    pub to: PathBuf,
    pub regra: &'static str,
}

#[derive(Default)]
pub struct Plan {
    pub moves: Vec<Move>,
    /// Arquivos que nenhuma regra cobre; ficam onde estão.
    pub sem_regra: Vec<PathBuf>,
    /// Destinos disputados por mais de um arquivo; nenhum deles é movido.
    pub colisoes: Vec<String>,
    /// Nomes de nota repetidos depois da mudança (links por nome ficam ambíguos).
    pub nomes_repetidos: Vec<(String, Vec<PathBuf>)>,
    /// Novo texto de arquivos cujos links por caminho viraram links por nome (chave: caminho atual).
    pub textos: HashMap<PathBuf, String>,
    pub links_reescritos: usize,
    pub links_ambiguos: Vec<String>,
}

fn walk(dir: &Path, root: &Path, out: &mut Vec<PathBuf>) -> io::Result<()> {
    for e in fs::read_dir(dir)? {
        let p = e?.path();
        let name = p.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        if name.starts_with('.') {
            continue;
        }
        if p.is_dir() {
            walk(&p, root, out)?;
        } else {
            out.push(p.strip_prefix(root).unwrap_or(&p).to_path_buf());
        }
    }
    Ok(())
}

fn join(parts: &[&str], rest: &[&str]) -> PathBuf {
    parts.iter().chain(rest.iter()).collect()
}

/// Regras de destino. `None` = nenhuma regra cobre; `Some(None)` = já está no lugar.
fn destino(rel: &Path, ano: &str) -> Option<Option<(PathBuf, &'static str)>> {
    let comps: Vec<String> = rel.components().map(|c| c.as_os_str().to_string_lossy().to_string()).collect();
    let c: Vec<&str> = comps.iter().map(String::as_str).collect();
    let a = format!("{ano}");
    let anos = ["Anos", a.as_str()];
    let hit = |p: PathBuf, r: &'static str| Some(Some((p, r)));
    match c.as_slice() {
        ["_sistema", ..] | ["Acervo", ..] | ["Anos", ..] => Some(None),
        ["_templates", rest @ ..] => hit(join(&["_sistema", "templates"], rest), "sistema"),
        ["Sistema", rest @ ..] => hit(join(&["_sistema"], rest), "sistema"),
        ["Aulas", rest @ ..] => hit(join(&["Acervo", "Aulas"], rest), "acervo/aulas"),
        ["Questões", rest @ ..] | ["Bancos", rest @ ..] => hit(join(&["Acervo", "Questoes"], rest), "acervo/questoes"),
        ["Recursos", "textos", rest @ ..] => hit(join(&["Acervo", "Textos"], rest), "acervo/textos"),
        ["Recursos", "imagens", rest @ ..] => hit(join(&["Acervo", "Textos", "imagens"], rest), "acervo/textos"),
        ["Recursos", "oficinas", rest @ ..] => hit(join(&["Acervo", "Oficinas"], rest), "acervo/oficinas"),
        ["Recursos", f] => hit(join(&["_sistema"], &[f]), "sistema"),
        ["Planejamentos", "_bncc", rest @ ..] => hit(join(&["_sistema", "bncc"], rest), "sistema"),
        ["Planejamentos", rest @ ..] | ["Planejamento", rest @ ..] => {
            hit(anos.iter().chain(["Planejamento"].iter()).chain(rest.iter()).collect(), "ano/planejamento")
        }
        ["Planejamento.md"] => hit(anos.iter().chain(["Planejamento", "Planejamento.md"].iter()).collect(), "ano/planejamento"),
        ["Diário", rest @ ..] => hit(anos.iter().chain(["Diario"].iter()).chain(rest.iter()).collect(), "ano/diario"),
        ["Relatórios", rest @ ..] => hit(anos.iter().chain(["Relatorios"].iter()).chain(rest.iter()).collect(), "ano/relatorios"),
        ["Correções", "_fichas", rest @ ..] | ["Correcoes", "_fichas", rest @ ..] => hit(join(&["_sistema", "fichas"], rest), "sistema"),
        ["Correções", sub, rest @ ..] | ["Correcoes", sub, rest @ ..] if !rest.is_empty() => {
            hit(anos.iter().chain(["Correcoes", sub].iter()).chain(rest.iter()).collect(), "ano/correcoes")
        }
        ["Correções", f] | ["Correcoes", f] if f.ends_with(".md") => hit(join(&["_sistema", "notas"], &[f]), "sistema"),
        [f] if f.ends_with(".base") => hit(join(&["_sistema", "bases"], &[f]), "sistema"),
        [f] if f.ends_with(".pdf") => hit(anos.iter().chain([*f].iter()).collect(), "ano/planejamento"),
        _ => None,
    }
}

fn strip_ext(p: &str) -> &str {
    p.strip_suffix(".md").unwrap_or(p)
}

pub fn plan(root: &Path, ano: &str, raiz_nome: &str) -> io::Result<Plan> {
    let mut files = vec![];
    walk(root, root, &mut files)?;
    files.sort();
    let mut plan = Plan::default();

    // 1) destinos
    let mut por_destino: BTreeMap<PathBuf, Vec<PathBuf>> = BTreeMap::new();
    let mut regras: HashMap<PathBuf, (PathBuf, &'static str)> = HashMap::new();
    for f in &files {
        match destino(f, ano) {
            Some(None) => {}
            Some(Some((to, r))) => {
                por_destino.entry(to.clone()).or_default().push(f.clone());
                regras.insert(f.clone(), (to, r));
            }
            None => plan.sem_regra.push(f.clone()),
        }
    }
    let ocupados: std::collections::HashSet<&PathBuf> = files.iter().collect();
    for (to, froms) in &por_destino {
        let existe = ocupados.contains(to) && !froms.contains(to);
        if froms.len() > 1 || existe {
            plan.colisoes.push(format!("{} <- {}", to.display(), froms.iter().map(|f| f.display().to_string()).collect::<Vec<_>>().join(" | ")));
            for f in froms {
                regras.remove(f);
                plan.sem_regra.push(f.clone());
            }
        }
    }
    for f in &files {
        if let Some((to, r)) = regras.get(f) {
            plan.moves.push(Move { from: f.clone(), to: to.clone(), regra: r });
        }
    }

    // 2) nomes repetidos no vault final
    let final_path = |f: &PathBuf| regras.get(f).map(|(t, _)| t.clone()).unwrap_or_else(|| f.clone());
    let mut nomes: BTreeMap<String, Vec<PathBuf>> = BTreeMap::new();
    for f in &files {
        let nome = if f.extension().is_some_and(|e| e == "md") {
            f.file_stem().unwrap_or_default().to_string_lossy().to_lowercase()
        } else {
            f.file_name().unwrap_or_default().to_string_lossy().to_lowercase()
        };
        nomes.entry(nome).or_default().push(final_path(f));
    }
    plan.nomes_repetidos = nomes.iter().filter(|(_, v)| v.len() > 1).map(|(k, v)| (k.clone(), v.clone())).collect();

    // 3) links por caminho -> links por nome
    let mut por_caminho: HashMap<String, Vec<&PathBuf>> = HashMap::new();
    for f in &files {
        let s = f.to_string_lossy().replace('\\', "/"); // chaves com "/" também no Windows
        por_caminho.entry(strip_ext(&s).to_lowercase()).or_default().push(f);
    }
    let prefixo = format!("{}/", raiz_nome.to_lowercase());
    for f in &files {
        if !f.extension().is_some_and(|e| e == "md") {
            continue;
        }
        let Ok(text) = fs::read_to_string(root.join(f)) else { continue };
        let mut feitos = 0;
        let new = rewrite_links(&text, &mut |tgt: &str| {
            if !tgt.contains('/') {
                return None;
            }
            let mut cand = strip_ext(tgt.trim_start_matches('/')).to_lowercase();
            if let Some(r) = cand.strip_prefix(&prefixo) {
                cand = r.to_string();
            }
            let achados: Vec<&&PathBuf> = match por_caminho.get(&cand) {
                Some(v) => v.iter().collect(),
                None => {
                    let suf = format!("/{cand}");
                    por_caminho.iter().filter(|(k, _)| k.ends_with(&suf)).flat_map(|(_, v)| v.iter()).collect()
                }
            };
            let [alvo] = achados.as_slice() else { return None };
            let nome = if alvo.extension().is_some_and(|e| e == "md") {
                alvo.file_stem().unwrap_or_default().to_string_lossy().to_string()
            } else {
                alvo.file_name().unwrap_or_default().to_string_lossy().to_string()
            };
            let unico = nomes.get(&nome.to_lowercase()).is_some_and(|v| v.len() == 1);
            if !unico {
                plan.links_ambiguos.push(format!("{}: [[{tgt}]] -> nome `{nome}` repetido", f.display()));
                return None;
            }
            feitos += 1;
            Some(nome)
        });
        if feitos > 0 {
            plan.links_reescritos += feitos;
            plan.textos.insert(f.clone(), new);
        }
    }
    Ok(plan)
}

/// Troca o alvo de cada wikilink usando `f`; só toca no trecho do alvo.
pub fn rewrite_links(text: &str, f: &mut dyn FnMut(&str) -> Option<String>) -> String {
    let mut out = String::with_capacity(text.len());
    let mut last = 0;
    for l in extract_links(text) {
        let start = l.offset + 2;
        let Some(rel) = text[start..].find("]]") else { continue };
        let inner = &text[start..start + rel];
        let tend = inner.find(['#', '|']).unwrap_or(inner.len());
        let raw = &inner[..tend];
        let (tgt, bs) = match raw.strip_suffix('\\') {
            Some(t) => (t, "\\"),
            None => (raw, ""),
        };
        if let Some(new) = f(tgt.trim()) {
            out.push_str(&text[last..start]);
            out.push_str(&new);
            out.push_str(bs);
            last = start + tend;
        }
    }
    out.push_str(&text[last..]);
    out
}

pub fn apply(root: &Path, plan: &Plan) -> io::Result<()> {
    for (rel, text) in &plan.textos {
        let _ = crate::historico::snapshot(root, &root.join(rel), true); // versão antiga fica no histórico
        fs::write(root.join(rel), text)?;
    }
    for m in &plan.moves {
        let to = root.join(&m.to);
        if to.exists() {
            return Err(io::Error::new(io::ErrorKind::AlreadyExists, format!("destino já existe: {}", m.to.display())));
        }
        if let Some(pai) = to.parent() { fs::create_dir_all(pai)?; }
        fs::rename(root.join(&m.from), &to)?;
        crate::historico::mover_historico(root, &root.join(&m.from), &to);
    }
    remove_empty_dirs(root, root);
    Ok(())
}

fn remove_empty_dirs(dir: &Path, root: &Path) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let p = e.path();
        if p.is_dir() && !p.file_name().is_some_and(|n| n.to_string_lossy().starts_with('.')) {
            remove_empty_dirs(&p, root);
            let _ = fs::remove_dir(&p); // só remove se estiver vazia
        }
    }
}
