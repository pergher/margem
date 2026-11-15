//! Histórico de versões: cópias antigas de cada nota em `.historico/<caminho sem .md>/<segundos>.md`
//! (pasta oculta na raiz do vault). Usado pelo app, pela CLI (migrar, reorganizar, edit-cell) e testado aqui.
//! O MCP só cria notas novas e nunca sobrescreve, então não gera versões.
use std::path::{Path, PathBuf};

/// O autosave não gera uma versão a cada toque: no máximo uma a cada 10 minutos (salvo `forcar`).
pub const INTERVALO: u64 = 600;
pub const MAX_VERSOES: usize = 60;
pub const DIAS_PADRAO: u64 = 30;

pub fn agora() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_secs())
}

fn canon(p: &Path) -> PathBuf { p.canonicalize().unwrap_or_else(|_| p.to_path_buf()) }

pub fn hist_dir(root: &Path, nota: &Path) -> Result<PathBuf, String> {
    let (root, nota) = (canon(root), canon(nota));
    let rel = nota.strip_prefix(&root).map_err(|_| "fora do vault".to_string())?;
    Ok(root.join(".historico").join(rel.with_extension("")))
}

/// Ids (segundos) das versões, da mais nova para a mais antiga.
pub fn hist_ids(dir: &Path) -> Vec<u64> {
    let mut v: Vec<u64> = std::fs::read_dir(dir).into_iter().flatten().flatten()
        .filter(|e| e.path().is_file() && e.path().extension().is_some_and(|x| x == "md")) // pastas numéricas (ex.: `2026/`) não são versões
        .filter_map(|e| e.path().file_stem()?.to_str()?.parse().ok()).collect();
    v.sort_unstable_by(|a, b| b.cmp(a));
    v
}

/// Guarda o conteúdo atual da nota antes de ser sobrescrito. `forcar` ignora o intervalo mínimo.
pub fn snapshot(root: &Path, nota: &Path, forcar: bool) -> Result<(), String> {
    let Ok(atual) = std::fs::read_to_string(nota) else { return Ok(()) };
    let dir = hist_dir(root, nota)?;
    let ids = hist_ids(&dir);
    if let Some(ult) = ids.first() {
        if std::fs::read_to_string(dir.join(format!("{ult}.md"))).is_ok_and(|t| t == atual) { return Ok(()); }
        if !forcar && agora().saturating_sub(*ult) < INTERVALO { return Ok(()); }
    }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut id = agora();
    if ids.first().is_some_and(|u| *u >= id) { id = ids[0] + 1; }
    std::fs::write(dir.join(format!("{id}.md")), atual).map_err(|e| e.to_string())?;
    for velho in hist_ids(&dir).into_iter().skip(MAX_VERSOES) { let _ = std::fs::remove_file(dir.join(format!("{velho}.md"))); }
    Ok(())
}

/// Leva o histórico junto quando a nota (ou pasta) muda de lugar ou de nome.
pub fn mover_historico(root: &Path, de: &Path, para: &Path) {
    let root = canon(root);
    let (Ok(a), Ok(b)) = (hist_dir(&root, de), hist_dir(&root, para)) else { return };
    let (a, b) = if de.is_dir() {
        (root.join(".historico").join(canon(de).strip_prefix(&root).unwrap_or(de)), root.join(".historico").join(canon(para).strip_prefix(&root).unwrap_or(para)))
    } else { (a, b) };
    if a.exists() && !b.exists() {
        if let Some(pai) = b.parent() { let _ = std::fs::create_dir_all(pai); }
        let _ = std::fs::rename(a, b);
    }
}

/// Históricos de notas que não existem mais no vault e não estão na lixeira, cuja versão mais nova tem mais de `dias`.
pub fn orfaos(root: &Path, dias: u64) -> Vec<PathBuf> {
    let root = canon(root);
    let base = root.join(".historico");
    let lixeira: Vec<String> = std::fs::read_dir(root.join(".lixeira")).into_iter().flatten().flatten()
        .map(|e| e.file_name().to_string_lossy().to_lowercase()).collect();
    let limite = agora().saturating_sub(dias * 86_400);
    let mut out = vec![];
    fn andar(d: &Path, base: &Path, root: &Path, lix: &[String], limite: u64, out: &mut Vec<PathBuf>) {
        let Ok(rd) = std::fs::read_dir(d) else { return };
        let ids = hist_ids(d);
        if !ids.is_empty() {
            let rel = d.strip_prefix(base).unwrap();
            let nota = root.join(rel).with_extension("md");
            let nome = format!("{}.md", d.file_name().unwrap().to_string_lossy()).to_lowercase();
            if !nota.exists() && !lix.contains(&nome) && ids[0] < limite { out.push(d.to_path_buf()); }
        }
        for e in rd.flatten() { if e.path().is_dir() { andar(&e.path(), base, root, lix, limite, out); } }
    }
    andar(&base, &base, &root, &lixeira, limite, &mut out);
    out
}

/// Apaga os históricos órfãos; devolve quantos foram removidos.
pub fn limpar(root: &Path, dias: u64) -> usize {
    let o = orfaos(root, dias);
    o.iter().filter(|d| std::fs::remove_dir_all(d).is_ok()).count()
}

#[cfg(test)]
mod testes {
    use super::*;

    fn tmp(n: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("{n}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join("A")).unwrap();
        d.canonicalize().unwrap()
    }

    #[test]
    fn guarda_versoes_e_acompanha_a_nota() {
        let d = tmp("hist-a");
        let n = d.join("A/Nota.md");
        std::fs::write(&n, "v1").unwrap();
        snapshot(&d, &n, false).unwrap();
        let h = d.join(".historico/A/Nota");
        assert_eq!(hist_ids(&h).len(), 1);
        std::fs::write(&n, "v2").unwrap();
        snapshot(&d, &n, false).unwrap(); // dentro do intervalo: não cria outra
        assert_eq!(hist_ids(&h).len(), 1);
        snapshot(&d, &n, true).unwrap();
        let ids = hist_ids(&h);
        assert_eq!(ids.len(), 2);
        assert_eq!(std::fs::read_to_string(h.join(format!("{}.md", ids[0]))).unwrap(), "v2");
        snapshot(&d, &n, true).unwrap(); // igual à última: não duplica
        assert_eq!(hist_ids(&h).len(), 2);
        let novo = d.join("B/Nova.md");
        std::fs::create_dir_all(d.join("B")).unwrap();
        std::fs::rename(&n, &novo).unwrap();
        mover_historico(&d, &n, &novo);
        assert_eq!(hist_ids(&d.join(".historico/B/Nova")).len(), 2);
        assert!(!h.exists());
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn limpa_so_orfaos_antigos_e_fora_da_lixeira() {
        let d = tmp("hist-b");
        let velho = |rel: &str| { let h = d.join(".historico").join(rel); std::fs::create_dir_all(&h).unwrap(); std::fs::write(h.join("1000.md"), "x").unwrap(); };
        std::fs::write(d.join("A/Viva.md"), "viva").unwrap();
        velho("A/Viva");       // a nota existe: fica
        velho("A/Sumiu");      // órfã e antiga: sai
        velho("A/NaLixeira");  // órfã, mas está na lixeira: fica
        std::fs::create_dir_all(d.join(".lixeira")).unwrap();
        std::fs::write(d.join(".lixeira/NaLixeira.md"), "x").unwrap();
        let h = d.join(".historico/A/Recente"); // órfã mas recente: fica
        std::fs::create_dir_all(&h).unwrap();
        std::fs::write(h.join(format!("{}.md", agora())), "x").unwrap();
        assert_eq!(orfaos(&d, 30).len(), 1);
        assert_eq!(limpar(&d, 30), 1);
        assert!(d.join(".historico/A/Viva").exists() && d.join(".historico/A/NaLixeira").exists() && d.join(".historico/A/Recente").exists());
        assert!(!d.join(".historico/A/Sumiu").exists());
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn pasta_numerica_nao_e_versao_nem_orfa() {
        let d = tmp("hist-c");
        // `.historico/Anos/2026/Semana.../1000.md`: "Anos" e "2026" são pastas, não notas nem versões.
        let h = d.join(".historico/Anos/2026/S01");
        std::fs::create_dir_all(&h).unwrap();
        std::fs::write(h.join("1000.md"), "x").unwrap();
        std::fs::create_dir_all(d.join("Anos/2026")).unwrap();
        std::fs::write(d.join("Anos/2026/S01.md"), "viva").unwrap();
        assert!(hist_ids(&d.join(".historico/Anos")).is_empty());
        assert!(orfaos(&d, 30).is_empty());
        assert_eq!(limpar(&d, 30), 0);
        assert!(h.join("1000.md").exists());
        let _ = std::fs::remove_dir_all(&d);
    }
}
