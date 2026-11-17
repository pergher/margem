//! Observador de arquivos: avisa a interface quando uma nota muda no disco por fora do Margem
//! (Claude via `vault-mcp`, Obsidian, Drive...). Não atualiza `vistos`: só `read_note` e `gravar_nota` fazem isso,
//! senão o conflito deixaria de ser detectado ao salvar.

use std::any::Any;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::time::Duration;
use notify::RecursiveMode;
use notify_debouncer_full::new_debouncer;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use crate::caminhos::{inside, slash};
use crate::gravacao::{hash_texto, Vistos};
use crate::{lock, App};

/// Drive e Obsidian geram rajadas de eventos para uma única mudança.
const DEBOUNCE_MS: u64 = 400;
/// Pastas internas do vault: nunca avisam.
const PASTAS_IGNORADAS: [&str; 3] = [".historico", ".lixeira", ".obsidian"];

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub(crate) struct Mudanca { pub path: String, pub tipo: &'static str }

/// Só `.md` fora das pastas internas e que não seja o temporário de `gravar_atomico` (`nota.md.margem-tmp`, que já não termina em `.md`).
pub(crate) fn relevante(root: &Path, p: &Path) -> bool {
    let Ok(rel) = p.strip_prefix(root) else { return false };
    if rel.components().any(|c| PASTAS_IGNORADAS.iter().any(|i| c.as_os_str() == *i)) { return false; }
    p.extension().is_some_and(|e| e.eq_ignore_ascii_case("md"))
}

/// O texto cru (como está no disco, antes de `normalizar`) difere do que o app viu por último?
/// Nota nunca lida ou gravada pelo app conta como mudada.
pub(crate) fn mudou_por_fora(vistos: &Vistos, path: &Path, texto_cru: &str) -> bool {
    match lock(vistos).get(path) { Some(h) => *h != hash_texto(texto_cru), None => true }
}

/// Transforma os caminhos de um lote de eventos nas mudanças que a interface precisa ver.
pub(crate) fn classificar(root: &Path, vistos: &Vistos, caminhos: impl IntoIterator<Item = PathBuf>) -> Vec<Mudanca> {
    let unicos: BTreeSet<PathBuf> = caminhos.into_iter().filter(|p| relevante(root, p)).collect();
    let mut out = vec![];
    for p in unicos {
        if !p.exists() { out.push(Mudanca { path: slash(&p), tipo: "removida" }); continue; }
        let Ok(texto) = std::fs::read_to_string(&p) else { continue };
        let conhecida = lock(vistos).contains_key(&p);
        if !mudou_por_fora(vistos, &p, &texto) { continue; } // foi o próprio app, ou só mudou a data
        out.push(Mudanca { path: slash(&p), tipo: if conhecida { "alterada" } else { "criada" } });
    }
    out
}

/// Observa `root` e chama `tratar` com os caminhos relevantes de cada lote (já com debounce). O que sai é o
/// "cabo" do observador: soltá-lo para de observar.
pub(crate) fn observar(root: PathBuf, tratar: impl Fn(Vec<PathBuf>) + Send + 'static) -> Result<Box<dyn Any + Send>, String> {
    let base = root.clone();
    let mut deb = new_debouncer(Duration::from_millis(DEBOUNCE_MS), None, move |r: notify_debouncer_full::DebounceEventResult| {
        let Ok(eventos) = r else { return };
        let caminhos: Vec<PathBuf> = eventos.into_iter().flat_map(|e| e.event.paths).filter(|p| relevante(&base, p)).collect();
        if !caminhos.is_empty() { tratar(caminhos); }
    }).map_err(|e| e.to_string())?;
    deb.watch(&root, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    Ok(Box::new(deb))
}

/// Inicia (ou reinicia, ao trocar de vault) o observador e emite `vault-mudou` por lote.
pub(crate) fn iniciar_observador(h: &AppHandle, root: &Path) {
    let app = h.state::<App>();
    *lock(&app.observador) = None; // para o anterior
    if root.as_os_str().is_empty() || !root.is_dir() { return; }
    let (h2, raiz) = (h.clone(), root.to_path_buf());
    let r = observar(raiz.clone(), move |caminhos| {
        let app = h2.state::<App>();
        let lote = classificar(&raiz, &app.vistos, caminhos);
        if !lote.is_empty() { let _ = h2.emit("vault-mudou", lote); }
    });
    match r { Ok(cabo) => *lock(&app.observador) = Some(cabo), Err(e) => eprintln!("observador não iniciou: {e}") }
}

/// Reserva para o foco da janela (o watcher pode falhar em pasta sincronizada): a nota mudou no disco desde a última leitura?
/// Devolve `"igual"`, `"alterada"` ou `"removida"`. Não atualiza `vistos`.
#[tauri::command]
pub fn verificar_nota(app: State<App>, path: String) -> Result<&'static str, String> {
    let p = inside(&app, &path)?;
    if !p.exists() { return Ok("removida"); }
    let t = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    Ok(if mudou_por_fora(&app.vistos, &p, &t) { "alterada" } else { "igual" })
}

/// Texto da nota no disco (normalizado) **sem** atualizar `vistos`: serve para comparar com o editor ("Ver diferenças") sem
/// esconder o conflito de quem ainda vai salvar.
#[tauri::command]
pub fn ler_do_disco(app: State<App>, path: String) -> Result<String, String> {
    let p = inside(&app, &path)?;
    std::fs::read_to_string(&p).map(crate::gravacao::normalizar).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::teste_util::*;
    use std::sync::{mpsc, Mutex};

    fn vistos() -> Vistos { Mutex::new(Default::default()) }

    #[test]
    fn mudou_por_fora_compara_o_texto_cru() {
        let v = vistos();
        let p = Path::new("/v/A.md");
        assert!(mudou_por_fora(&v, p, "x"), "nota nunca lida conta como mudada");
        lock(&v).insert(p.to_path_buf(), hash_texto("igual"));
        assert!(!mudou_por_fora(&v, p, "igual"));
        assert!(mudou_por_fora(&v, p, "diferente"));
        assert!(mudou_por_fora(&v, p, "igual\r\n"), "o hash é do texto cru, antes de normalizar");
    }

    #[test]
    fn ignora_pastas_internas_temporarios_e_outros_arquivos() {
        let r = Path::new("/v");
        assert!(relevante(r, Path::new("/v/Acervo/A.md")));
        assert!(relevante(r, Path::new("/v/Acervo/A.MD")));
        assert!(!relevante(r, Path::new("/v/.historico/A/123.md")));
        assert!(!relevante(r, Path::new("/v/.lixeira/A.md")));
        assert!(!relevante(r, Path::new("/v/.obsidian/x.md")));
        assert!(!relevante(r, Path::new("/v/Acervo/A.md.margem-tmp")));
        assert!(!relevante(r, Path::new("/v/Acervo/foto.png")));
        assert!(!relevante(r, Path::new("/fora/A.md")));
    }

    #[test]
    fn classifica_alterada_criada_removida_e_ignora_o_proprio_app() {
        let d = tmpdir("obs-classificar");
        let (a, b, c, e) = (d.join("a.md"), d.join("b.md"), d.join("c.md"), d.join("e.md"));
        for p in [&a, &b, &e] { std::fs::write(p, "v1").unwrap(); }
        let v = vistos();
        for p in [&a, &b, &c] { lock(&v).insert(p.clone(), hash_texto("v1")); }
        std::fs::write(&b, "v2").unwrap(); // mudou por fora
        // c foi lido mas não existe mais; e nunca foi lido; a continua igual
        let m = classificar(&d, &v, vec![a.clone(), b.clone(), c.clone(), e.clone(), b.clone(), d.join("x.txt")]);
        assert_eq!(m, vec![
            Mudanca { path: slash(&b), tipo: "alterada" },
            Mudanca { path: slash(&c), tipo: "removida" },
            Mudanca { path: slash(&e), tipo: "criada" },
        ]);
        assert_eq!(lock(&v).get(&b).copied(), Some(hash_texto("v1")), "classificar não atualiza vistos");
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn observador_avisa_em_ate_2s_e_ignora_pastas_internas() {
        let d = tmpdir("obs-integracao");
        std::fs::create_dir_all(d.join(".historico")).unwrap();
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        let _cabo = observar(d.clone(), move |c| { let _ = tx.lock().unwrap().send(c); }).unwrap();
        std::fs::write(d.join(".historico/h.md"), "x").unwrap();
        std::fs::write(d.join("n.md"), "oi").unwrap();
        let lote = rx.recv_timeout(Duration::from_secs(2)).expect("evento em até 2 s");
        assert!(lote.iter().all(|p| p.ends_with("n.md")), "{lote:?}");
        let _ = std::fs::remove_dir_all(&d);
    }
}
