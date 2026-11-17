//! Gravação das notas: escrita atômica, detecção de conflito e normalização de texto lido.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use crate::lock;

/// Última versão (hash do texto) que o app leu ou gravou de cada nota: serve para notar que o arquivo mudou por fora.
pub(crate) type Vistos = Mutex<std::collections::HashMap<PathBuf, u64>>;

/// FNV-1a de 64 bits: estável entre versões do Rust e entre processos (o `DefaultHasher` não garante isso),
/// então o hash pode ser guardado ou comparado depois.
pub(crate) fn hash_texto(t: &str) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in t.as_bytes() { h ^= u64::from(*b); h = h.wrapping_mul(0x0000_0100_0000_01b3); }
    h
}

/// Retrato do arquivo no disco: conteúdo (hash), data de modificação e tamanho. Só o hash não basta para notar
/// uma troca por um sincronizador que reescreve o mesmo texto; os três juntos deixam a janela de corrida bem pequena.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) struct Retrato { hash: u64, mtime: Option<std::time::SystemTime>, len: u64 }

/// `None` se o arquivo não existe (ou não é texto UTF-8 legível).
pub(crate) fn retratar(p: &Path) -> Option<Retrato> {
    let texto = std::fs::read_to_string(p).ok()?;
    let m = std::fs::metadata(p).ok()?;
    Some(Retrato { hash: hash_texto(&texto), mtime: m.modified().ok(), len: m.len() })
}

/// Grava sem deixar o arquivo pela metade: escreve num temporário ao lado e troca pelo original (uma queda no meio
/// mantém a versão antiga inteira).
pub(crate) fn gravar_atomico(p: &Path, text: &str) -> Result<(), String> {
    gravar_atomico_checando(p, text, || Ok(()))
}

/// Como `gravar_atomico`, mas roda `checar` com o temporário já pronto e imediatamente antes do `rename`:
/// se devolver erro, o temporário é apagado e o original não é tocado.
pub(crate) fn gravar_atomico_checando(p: &Path, text: &str, checar: impl FnOnce() -> Result<(), String>) -> Result<(), String> {
    gravar_bytes_atomico(p, text.as_bytes(), checar)
}

/// Escrita atômica de bytes (imagens, anexos), com a mesma checagem opcional antes do `rename`.
pub(crate) fn gravar_bytes_atomico(p: &Path, dados: &[u8], checar: impl FnOnce() -> Result<(), String>) -> Result<(), String> {
    use std::io::Write;
    let nome = p.file_name().ok_or("caminho inválido")?.to_string_lossy();
    let tmp = p.with_file_name(format!("{nome}.margem-tmp"));
    let r = (|| -> Result<(), String> {
        let mut f = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(dados).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
        checar()?;
        std::fs::rename(&tmp, p).map_err(|e| e.to_string())
    })();
    if let Err(e) = r { let _ = std::fs::remove_file(&tmp); return Err(e); }
    Ok(())
}

/// Grava a nota, recusando (erro que começa com `conflito:`) se o arquivo mudou no disco desde que o app o viu pela última vez.
/// A checagem é feita duas vezes: no começo e de novo logo antes do `rename`, comparando conteúdo, data e tamanho com o que
/// foi visto no começo (um sincronizador pode mexer no arquivo no meio da gravação).
/// Com `forcar`, sobrescreve; `antes` roda antes de gravar (aqui: guardar a versão do disco no histórico) com `true` quando
/// o disco difere do que o app conhecia; se o arquivo ainda mudar depois disso, `antes(true)` roda de novo para guardar também essa versão.
pub(crate) fn gravar_nota(vistos: &Vistos, p: &Path, text: &str, forcar: bool, mut antes: impl FnMut(bool)) -> Result<(), String> {
    let inicial = retratar(p);
    let conhecido = lock(vistos).get(p).copied();
    let mudou = matches!((inicial, conhecido), (Some(d), Some(h)) if d.hash != h);
    if mudou && !forcar { return Err("conflito: o arquivo foi alterado fora do Margem desde a última leitura".into()); }
    antes(mudou);
    gravar_atomico_checando(p, text, || {
        if retratar(p) == inicial { return Ok(()); }
        if !forcar { return Err("conflito: o arquivo foi alterado durante a gravação (sincronizador?); nada foi gravado".into()); }
        antes(true);
        Ok(())
    })?;
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

    #[test]
    fn recusa_se_o_arquivo_muda_entre_a_checagem_e_o_rename() {
        let d = tmpdir("conflito-tardio");
        let p = d.join("n.md");
        let vistos: Vistos = Mutex::new(Default::default());
        std::fs::write(&p, "original").unwrap();
        gravar_nota(&vistos, &p, "a", false, |_| {}).unwrap();
        // um sincronizador troca o arquivo depois da primeira checagem (o gancho `antes` roda nessa janela)
        let e = gravar_nota(&vistos, &p, "b", false, |_| std::fs::write(&p, "do drive").unwrap()).unwrap_err();
        assert!(e.starts_with("conflito:") && e.contains("durante a gravação"), "{e}");
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "do drive", "o arquivo alheio fica intacto");
        assert_eq!(std::fs::read_dir(&d).unwrap().count(), 1, "sem temporário sobrando");
        // mesmo tamanho e mesmo texto reescrito por fora: ainda vale o aviso quando o conteúdo difere
        std::fs::write(&p, "a").unwrap();
        let vistos: Vistos = Mutex::new(Default::default());
        gravar_nota(&vistos, &p, "a", false, |_| {}).unwrap();
        let e = gravar_nota(&vistos, &p, "b", false, |_| std::fs::write(&p, "z").unwrap()).unwrap_err();
        assert!(e.starts_with("conflito:"), "{e}");
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn com_forcar_a_mudanca_tardia_tambem_vai_para_o_historico() {
        let d = tmpdir("conflito-tardio-forcado");
        let p = d.join("n.md");
        let vistos: Vistos = Mutex::new(Default::default());
        std::fs::write(&p, "original").unwrap();
        gravar_nota(&vistos, &p, "a", false, |_| {}).unwrap();
        let mut chamadas = vec![];
        gravar_nota(&vistos, &p, "b", true, |x| {
            chamadas.push(x);
            if chamadas.len() == 1 { std::fs::write(&p, "do drive").unwrap(); }
        }).unwrap();
        assert_eq!(chamadas, vec![false, true], "o snapshot é refeito ao notar a mudança tardia");
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "b");
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn hash_e_estavel_entre_versoes_e_processos() {
        // valores de referência do FNV-1a de 64 bits: se mudarem, o hash deixou de ser estável
        assert_eq!(hash_texto(""), 0xcbf2_9ce4_8422_2325);
        assert_eq!(hash_texto("a"), 0xaf63_dc4c_8601_ec8c);
        assert_ne!(hash_texto("a"), hash_texto("b"));
    }

    #[test]
    fn grava_bytes_por_atomico() {
        let d = tmpdir("bytes");
        let p = d.join("img.png");
        gravar_bytes_atomico(&p, &[0x89, b'P', b'N', b'G'], || Ok(())).unwrap();
        assert_eq!(std::fs::read(&p).unwrap(), vec![0x89, b'P', b'N', b'G']);
        assert!(gravar_bytes_atomico(&p, b"outro", || Err("não".into())).is_err());
        assert_eq!(std::fs::read(&p).unwrap().len(), 4, "o original fica intacto se a checagem recusa");
        assert_eq!(std::fs::read_dir(&d).unwrap().count(), 1);
        let _ = std::fs::remove_dir_all(&d);
    }
}
