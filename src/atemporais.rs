//! Ciclos atemporais (docs/formato-do-vault.md): tira os ciclos de `Anos/AAAA/Planejamento/NNN - Título.md`
//! para `Acervo/Ciclos/Título.md` (o nome vira só o título), reescreve os `[[links]]` e cria o
//! Planejamento do Ano (`Anos/AAAA/Planejamento AAAA.md`), que é quem diz em que ano, trimestre e ordem cada ciclo entra.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::io;
use std::path::{Path, PathBuf};

use crate::reorganizar::{rewrite_links, Move, Plan};
use crate::vault::Vault;

pub struct Resultado {
    pub plan: Plan,
    /// (nome antigo, nome novo) de cada ciclo movido.
    pub renomeados: Vec<(String, String)>,
    /// Planejamentos do Ano que seriam criados.
    pub planejamentos: Vec<String>,
    pub avisos: Vec<String>,
}

struct Antigo {
    rel: PathBuf,
    ano_letivo: String,
    nome: String,
    ano: u32,
    tri: u32,
    ciclo: u32,
    titulo: String,
    sufixo: Option<String>,
}

/// "631 - Poema - PR" → (6, 3, 1, "Poema", Some("PR")); "831 - PR" → título vazio.
fn parse_nome(nome: &str) -> Option<(u32, u32, u32, String, Option<String>)> {
    let d: Vec<u32> = nome.chars().take(3).map(|c| c.to_digit(10)).collect::<Option<Vec<_>>>()?;
    if d.len() != 3 {
        return None;
    }
    let resto = &nome[3..];
    let mut t = if resto.is_empty() { "" } else { resto.trim_start().strip_prefix('-')?.trim() }.to_string();
    let mut sufixo = None;
    for s in ["PR", "PT", "TG"] {
        if t == s {
            sufixo = Some(s.to_string());
            t.clear();
        } else if let Some(r) = t.strip_suffix(&format!("- {s}")) {
            if r.ends_with(char::is_whitespace) {
                sufixo = Some(s.to_string());
                t = r.trim().to_string();
            }
        }
    }
    Some((d[0], d[1], d[2], t, sufixo))
}

/// Tira `ano`, `trimestre` e `ciclo` do frontmatter (agora vivem no Planejamento do Ano) e guarda o sufixo.
fn limpa_frontmatter(text: &str, sufixo: &Option<String>) -> String {
    let Some(resto) = text.strip_prefix("---\n") else { return text.to_string() };
    let Some(fim) = resto.find("\n---") else { return text.to_string() };
    let mut linhas: Vec<&str> = resto[..fim].lines().filter(|l| !["ano:", "trimestre:", "ciclo:"].iter().any(|k| l.starts_with(k))).collect();
    let linha;
    if let Some(s) = sufixo {
        linha = format!("sufixo: {s}");
        linhas.push(&linha);
    }
    let mut out = String::from("---\n");
    for l in linhas {
        out.push_str(l);
        out.push('\n');
    }
    out.push_str(&resto[fim + 1..]);
    out
}

pub fn plan(root: &Path) -> io::Result<Resultado> {
    let v = Vault::open(root)?;
    let mut antigos = vec![];
    for n in &v.notes {
        let rel = n.path.strip_prefix(root).unwrap_or(&n.path).to_path_buf();
        let c: Vec<String> = rel.components().map(|c| c.as_os_str().to_string_lossy().to_string()).collect();
        if c.len() == 4 && c[0] == "Anos" && c[2] == "Planejamento" {
            if let Some((ano, tri, ciclo, titulo, sufixo)) = parse_nome(&n.name) {
                antigos.push(Antigo { rel, ano_letivo: c[1].clone(), nome: n.name.clone(), ano, tri, ciclo, titulo, sufixo });
            }
        }
    }
    antigos.sort_by_key(|a| (a.ano_letivo.clone(), a.ano, a.tri, a.ciclo));
    let mut res = Resultado { plan: Plan::default(), renomeados: vec![], planejamentos: vec![], avisos: vec![] };

    // nomes já ocupados (os ciclos que saem não contam: o nome deles muda)
    let saem: HashSet<String> = antigos.iter().map(|a| a.nome.to_lowercase()).collect();
    let mut ocupados: HashSet<String> = v.notes.iter().map(|n| n.name.to_lowercase()).filter(|n| !saem.contains(n)).collect();
    let mut novo_de: HashMap<String, String> = HashMap::new();
    for a in &antigos {
        let cod = format!("{}{}{}", a.ano, a.tri, a.ciclo);
        let mut cand = vec![];
        if a.titulo.is_empty() {
            res.avisos.push(format!("{}: sem título; virou `Ciclo {cod}` (renomeie depois)", a.nome));
            cand.push(format!("Ciclo {cod}"));
        } else {
            cand.push(a.titulo.clone());
            if let Some(s) = &a.sufixo {
                cand.push(format!("{} - {s}", a.titulo));
            }
            cand.push(format!("{} ({cod})", a.titulo));
        }
        let Some(nome) = cand.into_iter().find(|c| !ocupados.contains(&c.to_lowercase())) else {
            res.avisos.push(format!("{}: nenhum nome livre; ciclo não movido", a.nome));
            continue;
        };
        if nome != a.titulo && !a.titulo.is_empty() {
            res.avisos.push(format!("{}: o título `{}` já existe no vault; ficou `{nome}`", a.nome, a.titulo));
        }
        ocupados.insert(nome.to_lowercase());
        novo_de.insert(a.nome.to_lowercase(), nome.clone());
        res.renomeados.push((a.nome.clone(), nome));
    }

    // textos: links reescritos em todas as notas; os ciclos movidos também perdem ano/trimestre/ciclo
    let movidos: HashMap<PathBuf, &Antigo> = antigos.iter().filter(|a| novo_de.contains_key(&a.nome.to_lowercase())).map(|a| (a.rel.clone(), a)).collect();
    for n in &v.notes {
        let rel = n.path.strip_prefix(root).unwrap_or(&n.path).to_path_buf();
        let mut feitos = 0;
        let mut t = rewrite_links(&n.text, &mut |tgt: &str| {
            let last = tgt.rsplit('/').next().unwrap_or(tgt);
            let nv = novo_de.get(&last.trim().to_lowercase())?;
            feitos += 1;
            Some(nv.clone())
        });
        let mov = movidos.get(&rel);
        if let Some(a) = mov {
            t = limpa_frontmatter(&t, &a.sufixo);
        }
        if feitos > 0 || mov.is_some() {
            res.plan.links_reescritos += feitos;
            res.plan.textos.insert(rel, t);
        }
    }
    for a in &antigos {
        if let Some(nome) = novo_de.get(&a.nome.to_lowercase()) {
            res.plan.moves.push(Move { from: a.rel.clone(), to: PathBuf::from("Acervo").join("Ciclos").join(format!("{nome}.md")), regra: "ciclo atemporal" });
        }
    }

    // Planejamento do Ano: uma tabela por ano letivo, na ordem ano escolar / trimestre / ciclo
    let mut por_ano: BTreeMap<&str, Vec<&Antigo>> = BTreeMap::new();
    for a in antigos.iter().filter(|a| novo_de.contains_key(&a.nome.to_lowercase())) {
        por_ano.entry(a.ano_letivo.as_str()).or_default().push(a);
    }
    for (ano, lista) in por_ano {
        let nome = format!("Planejamento {ano}");
        if v.resolve(&nome).is_some() {
            res.avisos.push(format!("já existe a nota `{nome}`; os ciclos não foram ligados a ela (ligue à mão)"));
            continue;
        }
        let mut t = format!("---\ntipo: planejamento\nano_letivo: {ano}\n---\n# {nome}\n\nCada linha liga um ciclo (`Acervo/Ciclos`) a um ano escolar e a um trimestre. O ciclo em si não tem ano nem turma.\n\n| Ano | Trimestre | Ordem | Ciclo |\n| --- | --- | --- | --- |\n");
        for a in lista {
            t.push_str(&format!("| {} | {} | {} | [[{}]] |\n", a.ano, a.tri, a.ciclo, novo_de[&a.nome.to_lowercase()]));
        }
        let rel = PathBuf::from("Anos").join(ano).join(format!("{nome}.md"));
        res.plan.textos.insert(rel.clone(), t);
        res.planejamentos.push(rel.display().to_string());
    }
    Ok(res)
}
