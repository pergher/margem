//! Gravação das notas: escrita atômica, detecção de conflito e normalização de texto lido.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use crate::lock;

/// Última versão (hash do texto) que o app leu ou gravou de cada nota: serve para notar que o arquivo mudou por fora.
pub(crate) type Vistos = Mutex<std::collections::HashMap<PathBuf, u64>>;

pub(crate) fn hash_texto(t: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    t.hash(&mut h);
    h.finish()
}

/// Grava sem deixar o arquivo pela metade: escreve num temporário ao lado e troca pelo original (uma queda no meio
/// mantém a versão antiga inteira).
pub(crate) fn gravar_atomico(p: &Path, text: &str) -> Result<(), String> {
    use std::io::Write;
    let nome = p.file_name().ok_or("caminho inválido")?.to_string_lossy();
    let tmp = p.with_file_name(format!("{nome}.margem-tmp"));
    let r = (|| -> std::io::Result<()> {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(text.as_bytes())?;
        f.sync_all()?;
        std::fs::rename(&tmp, p)
    })();
    if let Err(e) = r { let _ = std::fs::remove_file(&tmp); return Err(e.to_string()); }
    Ok(())
}

/// Grava a nota, recusando (erro que começa com `conflito:`) se o arquivo mudou no disco desde que o app o viu pela última vez.
/// Com `forcar`, sobrescreve; `antes` roda logo antes de gravar (aqui: guardar a versão do disco no histórico).
pub(crate) fn gravar_nota(vistos: &Vistos, p: &Path, text: &str, forcar: bool, antes: impl FnOnce(bool)) -> Result<(), String> {
    let no_disco = std::fs::read_to_string(p).ok();
    let conhecido = lock(vistos).get(p).copied();
    let mudou = matches!((&no_disco, conhecido), (Some(d), Some(h)) if hash_texto(d) != h);
    if mudou && !forcar { return Err("conflito: o arquivo foi alterado fora do Margem desde a última leitura".into()); }
    antes(mudou);
    gravar_atomico(p, text)?;
    lock(vistos).insert(p.to_path_buf(), hash_texto(text));
    Ok(())
}

/// Para as telas: sem BOM e com fim de linha `\n` (o editor já trabalha assim; as telas leem frontmatter e tabelas por `\n`).
/// O arquivo em disco só muda se o usuário salvar a nota.
pub(crate) fn normalizar(t: String) -> String {
    let t = t.strip_prefix('\u{feff}').map(str::to_string).unwrap_or(t);
    if t.contains('\r') { t.replace("\r\n", "\n") } else { t }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::teste_util::*;

    #[test]
    fn grava_por_atomico_sem_deixar_temporario() {
        let d = tmpdir("atomico");
        let p = d.join("n.md");
        gravar_atomico(&p, "um").unwrap();
        gravar_atomico(&p, "dois").unwrap();
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "dois");
        assert_eq!(std::fs::read_dir(&d).unwrap().count(), 1);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn recusa_gravar_sobre_mudanca_externa() {
        let d = tmpdir("conflito");
        let p = d.join("n.md");
        let vistos: Vistos = Mutex::new(Default::default());
        std::fs::write(&p, "original").unwrap();
        // nota nunca lida pelo app: grava normalmente
        gravar_nota(&vistos, &p, "a", false, |_| {}).unwrap();
        // lida/gravada pelo app e inalterada: grava
        gravar_nota(&vistos, &p, "b", false, |_| {}).unwrap();
        // outro programa altera o arquivo: recusa e não toca no disco
        std::fs::write(&p, "externo").unwrap();
        let e = gravar_nota(&vistos, &p, "c", false, |_| panic!("não deveria gravar")).unwrap_err();
        assert!(e.starts_with("conflito:"), "{e}");
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "externo");
        // com `forcar`, sobrescreve e avisa que havia mudança externa
        let mut externa = false;
        gravar_nota(&vistos, &p, "c", true, |x| externa = x).unwrap();
        assert!(externa);
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "c");
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn normaliza_bom_e_crlf_na_leitura() {
        assert_eq!(normalizar("\u{feff}---\r\na: 1\r\n---\r\n".into()), "---\na: 1\n---\n");
        assert_eq!(normalizar("sem\nmudança".into()), "sem\nmudança");
    }
}
