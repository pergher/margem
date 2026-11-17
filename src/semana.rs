//! Leitor único de ciclos (`tipo: ciclo`, tabela "## Aulas") e semanas (`tipo: semana`, uma tabela por turma).
//! Espelha `app/src/lib/semana.js`/`ciclos.js` para que CLI e MCP entendam o progresso das turmas.
//! Só leitura: a edição das tabelas continua no app (`reescrever`), que preserva o que não mudou.

use std::collections::{BTreeMap, BTreeSet};

use crate::vault::{Note, Vault};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Situacao {
    Dada,
    /// Não deu, mas dará: volta na semana seguinte.
    Adiada,
    /// Não dará mais: sai do ciclo e do ano.
    Descartada,
}

impl Situacao {
    fn da_celula(c: &str) -> Option<Situacao> {
        let c = c.trim_end();
        if c.ends_with('✓') {
            Some(Situacao::Dada)
        } else if c.ends_with('↷') {
            Some(Situacao::Adiada)
        } else if c.ends_with('⊘') {
            Some(Situacao::Descartada)
        } else {
            None
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct AulaSemana {
    pub n: usize,
    pub texto: String,
    pub recurso: String,
    pub situacao: Option<Situacao>,
    pub ciclo: Option<String>,
    pub ciclo_n: Option<usize>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TurmaSemana {
    pub turma: String,
    pub ciclo: Option<String>,
    pub aulas: Vec<AulaSemana>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Semana {
    pub rotulo: String,
    pub turmas: Vec<TurmaSemana>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AulaCiclo {
    pub n: usize,
    pub texto: String,
    pub recurso: String,
}

/// Células de uma linha de tabela (`\|` é barra literal).
fn celulas(l: &str) -> Vec<String> {
    let l = l.trim();
    let l = l.strip_prefix('|').unwrap_or(l);
    let l = l.strip_suffix('|').filter(|_| !l.ends_with("\\|")).unwrap_or(l);
    let mut out = vec![String::new()];
    let mut ch = l.chars().peekable();
    while let Some(c) = ch.next() {
        if c == '\\' && ch.peek() == Some(&'|') {
            ch.next();
            if let Some(c) = out.last_mut() { c.push('|'); }
        } else if c == '|' {
            out.push(String::new());
        } else {
            if let Some(atual) = out.last_mut() { atual.push(c); }
        }
    }
    out.into_iter().map(|c| c.trim().to_string()).collect()
}

fn sem_corpo_fm(text: &str) -> String {
    let t = text.strip_prefix('\u{feff}').unwrap_or(text).replace("\r\n", "\n");
    let sp = crate::frontmatter::split(&t);
    t[sp.body_start..].to_string()
}

fn alvo_do_link(c: &str) -> Option<(String, Option<usize>)> {
    let i = c.find("[[")?;
    let resto = &c[i + 2..];
    let fim = resto.find("]]")?;
    let alvo = resto[..fim].split(['|', '#']).next()?.trim();
    if alvo.is_empty() {
        return None;
    }
    let n = resto[fim + 2..].trim().split_whitespace().next().and_then(|x| x.parse().ok());
    Some((alvo.to_string(), n))
}

/// Aulas da tabela "## Aulas" de um ciclo.
pub fn parse_ciclo(text: &str) -> Vec<AulaCiclo> {
    let corpo = sem_corpo_fm(text);
    let mut dentro = false;
    let mut out = vec![];
    for l in corpo.lines() {
        if l.starts_with("## ") || l.trim_end() == "##" {
            dentro = l.trim_start_matches('#').trim().eq_ignore_ascii_case("Aulas");
            continue;
        }
        if !dentro || !l.trim_start().starts_with('|') {
            continue;
        }
        let c = celulas(l);
        if let Ok(n) = c[0].parse::<usize>() {
            out.push(AulaCiclo { n, texto: c.get(1).cloned().unwrap_or_default(), recurso: c.get(2).cloned().unwrap_or_default() });
        }
    }
    out
}

/// Tabelas por turma (`### 61`) de uma nota `tipo: semana`.
pub fn parse_semana(text: &str) -> Semana {
    let t = text.strip_prefix('\u{feff}').unwrap_or(text).replace("\r\n", "\n");
    let sp = crate::frontmatter::split(&t);
    let rotulo = sp.yaml.as_deref().and_then(|y| y.lines().find_map(|l| l.strip_prefix("rotulo:"))).map(|r| r.trim().to_string()).unwrap_or_default();
    let corpo = sem_corpo_fm(&t);
    let mut turmas: Vec<TurmaSemana> = vec![];
    let mut linhas_tabela = 0usize;
    for l in corpo.lines() {
        if let Some(titulo) = l.strip_prefix("### ") {
            turmas.push(TurmaSemana { turma: titulo.trim().to_string(), ciclo: None, aulas: vec![] });
            linhas_tabela = 0;
            continue;
        }
        if l.starts_with("# ") || l.starts_with("## ") {
            turmas.push(TurmaSemana { turma: String::new(), ciclo: None, aulas: vec![] }); // encerra o bloco; descartada abaixo
            linhas_tabela = 0;
            continue;
        }
        let Some(tm) = turmas.last_mut() else { continue };
        if let Some(r) = l.strip_prefix("Ciclo:") {
            tm.ciclo = alvo_do_link(r).map(|(a, _)| a);
        } else if l.trim_start().starts_with('|') {
            linhas_tabela += 1;
            if linhas_tabela <= 2 {
                continue; // cabeçalho e separador
            }
            let c = celulas(l);
            if c[0].is_empty() {
                continue;
            }
            let (ciclo, ciclo_n) = c.get(2).and_then(|x| alvo_do_link(x)).map_or((None, None), |(a, n)| (Some(a), n));
            let situacao = Situacao::da_celula(&c[0]);
            let texto = c[0].trim_end_matches(['✓', '↷', '⊘', '❔']).trim_end().to_string();
            let n = tm.aulas.len() + 1;
            tm.aulas.push(AulaSemana { n, texto, recurso: c.get(1).cloned().unwrap_or_default(), situacao, ciclo, ciclo_n });
        }
    }
    turmas.retain(|t| !t.turma.is_empty());
    Semana { rotulo, turmas }
}

#[derive(Debug, PartialEq)]
pub struct Progresso {
    pub turma: String,
    pub ciclo: String,
    pub total: usize,
    pub dadas: usize,
    pub adiadas: usize,
    pub descartadas: usize,
    /// Primeira aula do ciclo que ainda não tem linha em nenhuma semana da turma.
    pub proxima: Option<(usize, String)>,
}

/// Progresso por turma e ciclo, somando todas as notas `tipo: semana` do vault.
pub fn progresso(v: &Vault) -> Vec<Progresso> {
    let mut semanas: Vec<&Note> = v.by_tipo("semana").collect();
    semanas.sort_by(|a, b| a.path.cmp(&b.path));
    // (turma, ciclo em minúsculas) -> (nome do ciclo, n -> situação mais recente)
    let mut por: BTreeMap<(String, String), (String, BTreeMap<usize, Option<Situacao>>)> = BTreeMap::new();
    for nota in semanas {
        for t in parse_semana(&nota.text).turmas {
            for a in t.aulas {
                let (Some(c), Some(n)) = (a.ciclo, a.ciclo_n) else { continue };
                let e = por.entry((t.turma.clone(), c.to_lowercase())).or_insert_with(|| (c.clone(), BTreeMap::new()));
                e.1.insert(n, a.situacao);
            }
        }
    }
    por.into_iter()
        .map(|((turma, _), (nome, aulas))| {
            let ciclo = v.resolve(&nome).filter(|n| n.tipo() == Some("ciclo")).map(|n| parse_ciclo(&n.text)).unwrap_or_default();
            let conta = |s: Situacao| aulas.values().filter(|x| **x == Some(s)).count();
            let vistas: BTreeSet<usize> = aulas.keys().copied().collect();
            let proxima = ciclo.iter().find(|a| !vistas.contains(&a.n)).map(|a| (a.n, a.texto.clone()));
            Progresso { turma, total: ciclo.len(), dadas: conta(Situacao::Dada), adiadas: conta(Situacao::Adiada), descartadas: conta(Situacao::Descartada), ciclo: nome, proxima }
        })
        .collect()
}

impl std::fmt::Display for Progresso {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} · {}: {}/{} dadas", self.turma, self.ciclo, self.dadas, self.total)?;
        if self.adiadas > 0 {
            write!(f, ", {} adiadas", self.adiadas)?;
        }
        if self.descartadas > 0 {
            write!(f, ", {} descartadas", self.descartadas)?;
        }
        match &self.proxima {
            Some((n, t)) => write!(f, " — próxima sem linha: {n}. {t}"),
            None => write!(f, " — todas as aulas já têm linha"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SEMANA: &str = "---\ntipo: semana\nano: 6\nrotulo: 3 a 7 de Março\n---\n# Semana\n\n### 61\n\nCiclo: [[231 - Crase]]\n\n| Aula | Recurso | Ciclo |\n|---|---|---|\n| Diagnóstico ✓ | [[Prova A]] | [[231 - Crase]] 1 |\n| Crase \\| regra ↷ |  | [[231 - Crase]] 2 |\n| Avulsa |  |  |\n\n### 62\n\n| Aula | Recurso | Ciclo |\n|---|---|---|\n| Leitura ⊘ |  | [[231 - Crase]] 1 |\n";

    #[test]
    fn le_semana_com_situacoes_ciclo_e_barra_escapada() {
        let s = parse_semana(SEMANA);
        assert_eq!(s.rotulo, "3 a 7 de Março");
        assert_eq!(s.turmas.len(), 2);
        let t = &s.turmas[0];
        assert_eq!(t.ciclo.as_deref(), Some("231 - Crase"));
        assert_eq!(t.aulas.len(), 3);
        assert_eq!(t.aulas[0].texto, "Diagnóstico");
        assert_eq!(t.aulas[0].situacao, Some(Situacao::Dada));
        assert_eq!(t.aulas[0].ciclo_n, Some(1));
        assert_eq!(t.aulas[1].texto, "Crase | regra");
        assert_eq!(t.aulas[1].situacao, Some(Situacao::Adiada));
        assert_eq!(t.aulas[2].ciclo, None);
        assert_eq!(s.turmas[1].aulas[0].situacao, Some(Situacao::Descartada));
    }

    #[test]
    fn tolera_bom_e_crlf() {
        let s = parse_semana(&format!("\u{feff}{}", SEMANA.replace('\n', "\r\n")));
        assert_eq!(s.turmas[0].aulas.len(), 3);
        assert_eq!(s.rotulo, "3 a 7 de Março");
    }

    #[test]
    fn le_aulas_do_ciclo_so_da_secao_aulas() {
        let t = "---\ntipo: ciclo\n---\n# C\n\n## Conteúdos\n\n| 9 | x | y |\n\n## Aulas\n\n| # | Conteúdo | Recurso |\n|---|---|---|\n| 1 | Diagnóstico | [[Prova A]] |\n| 2 | Crase \\| regra |  |\n";
        let a = parse_ciclo(t);
        assert_eq!(a.len(), 2);
        assert_eq!(a[1].texto, "Crase | regra");
        assert_eq!(a[0].recurso, "[[Prova A]]");
    }
}
