//! Cache do `Vault`: abrir o vault lê e interpreta todas as notas, então o resultado é reaproveitado
//! enquanto nenhum arquivo do vault mudar (nome, tamanho ou data de modificação). Gravações feitas
//! pelo app chamam `App::invalidar`; mudanças externas (Drive, Obsidian) são notadas pela assinatura.

use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::time::SystemTime;
use vault_core::vault::Vault;
use crate::{lock, App};

/// Resumo barato (só `stat`) de todos os arquivos visíveis do vault.
type Assinatura = Vec<(PathBuf, Option<SystemTime>, u64)>;

pub struct VaultEmCache { raiz: PathBuf, assinatura: Assinatura, vault: Vault }

fn assinatura(dir: &Path, out: &mut Assinatura) -> std::io::Result<()> {
    for e in std::fs::read_dir(dir)? {
        let e = e?;
        if e.file_name().to_string_lossy().starts_with('.') { continue; } // como o `Vault::open`
        let p = e.path();
        if p.is_dir() { assinatura(&p, out)?; } else {
            let m = e.metadata()?;
            out.push((p, m.modified().ok(), m.len()));
        }
    }
    Ok(())
}

/// Roda `f` com o vault atual, relendo do disco só se algo mudou desde a última leitura.
pub fn com_vault<R>(app: &App, f: impl FnOnce(&Vault) -> R) -> Result<R, String> {
    let raiz = app.root();
    let mut atual = vec![];
    assinatura(&raiz, &mut atual).map_err(|e| e.to_string())?;
    atual.sort();
    let mut g = lock(&app.vault);
    let valido = g.as_ref().is_some_and(|c| c.raiz == raiz && c.assinatura == atual);
    if !valido {
        let vault = Vault::open(&raiz).map_err(|e| e.to_string())?;
        app.aberturas.fetch_add(1, Ordering::Relaxed);
        *g = Some(VaultEmCache { raiz, assinatura: atual, vault });
    }
    Ok(f(&g.as_ref().expect("cache preenchido acima").vault))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::teste_util::tmpdir;

    fn aberturas(app: &App) -> usize { app.aberturas.load(Ordering::Relaxed) }

    #[test]
    fn leituras_seguidas_abrem_o_vault_uma_vez() {
        let d = tmpdir("cache-uma");
        std::fs::write(d.join("A.md"), "um").unwrap();
        let app = App::new(d.clone());
        assert_eq!(com_vault(&app, |v| v.notes.len()).unwrap(), 1);
        assert_eq!(com_vault(&app, |v| v.notes.len()).unwrap(), 1);
        assert_eq!(aberturas(&app), 1);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn gravacao_externa_invalida_o_cache() {
        let d = tmpdir("cache-externa");
        std::fs::write(d.join("A.md"), "um").unwrap();
        let app = App::new(d.clone());
        com_vault(&app, |_| ()).unwrap();
        // outro programa altera uma nota e cria outra
        std::fs::write(d.join("A.md"), "um texto maior").unwrap();
        std::fs::write(d.join("B.md"), "novo").unwrap();
        assert_eq!(com_vault(&app, |v| v.notes.len()).unwrap(), 2);
        assert_eq!(com_vault(&app, |v| v.resolve("A").map(|n| n.text.clone())).unwrap().as_deref(), Some("um texto maior"));
        assert_eq!(aberturas(&app), 2);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn invalidar_forca_nova_leitura_e_anexos_vem_do_indice() {
        let d = tmpdir("cache-invalida");
        std::fs::create_dir_all(d.join("img")).unwrap();
        std::fs::write(d.join("img/Foto.PNG"), "x").unwrap();
        std::fs::write(d.join("A.md"), "um").unwrap();
        let app = App::new(d.clone());
        let f = com_vault(&app, |v| v.attachment_path("pasta/foto.png").map(Path::to_path_buf)).unwrap();
        assert_eq!(f, Some(d.join("img/Foto.PNG")));
        app.invalidar();
        com_vault(&app, |_| ()).unwrap();
        assert_eq!(aberturas(&app), 2);
        let _ = std::fs::remove_dir_all(&d);
    }
}
