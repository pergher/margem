//! Comandos sobre notas e pastas: listar, ler, salvar, histórico, criar, renomear, mover, excluir, avisos e backlinks.

use std::path::{Path, PathBuf};
use serde::Serialize;
use tauri::State;
use vault_core::historico::{hist_dir, hist_ids, mover_historico, snapshot};
use crate::caminhos::*;
use crate::gravacao::*;
use crate::{com_vault, lock, App};

#[derive(Serialize)]
pub struct Item { name: String, path: String, rel: String, tipo: Option<String>, /** última modificação, em segundos desde 1970 */ modified: Option<u64> }


#[tauri::command]
pub fn list_notes(app: State<App>) -> Result<Vec<Item>, String> {
    let root = app.root();
    com_vault(&app, |v| v.notes.iter().map(|n| Item {
        name: n.name.clone(), path: slash(&n.path),
        rel: n.path.strip_prefix(&root).unwrap_or(&n.path).to_string_lossy().replace('\\', "/"), tipo: n.tipo().map(String::from),
        modified: std::fs::metadata(&n.path).and_then(|m| m.modified()).ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()),
    }).collect())
}

#[tauri::command]
pub fn read_note(app: State<App>, path: String) -> Result<String, String> {
    let p = inside(&app, &path)?;
    let t = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    lock(&app.vistos).insert(p, hash_texto(&t));
    Ok(normalizar(t))
}

/// Já existe outra nota com este nome (em qualquer pasta)? Os links resolvem por nome, então repetir deixa `[[nome]]` ambíguo.
pub(crate) fn nome_em_uso(app: &App, nome: &str, exceto: Option<&Path>) -> Result<Option<String>, String> {
    let root = app.root();
    let exceto = exceto.and_then(|p| canon(p).ok());
    com_vault(app, |v| v.notes.iter()
        .find(|n| n.name.trim().to_lowercase() == nome.trim().to_lowercase() && canon(&n.path).ok() != exceto)
        .map(|n| n.path.strip_prefix(&root).unwrap_or(&n.path).to_string_lossy().replace('\\', "/")))
}

/// Arquivo auxiliar `.json` dentro do vault (ex.: `_dados.json` de uma correção); `None` se não existir.
#[tauri::command]
pub fn read_sidecar(app: State<App>, path: String) -> Result<Option<String>, String> {
    // Valida o caminho antes de olhar o disco: um caminho fora do vault dá sempre o mesmo erro, exista ou não.
    match sidecar_em(&app.root(), &path)? {
        Some(p) => std::fs::read_to_string(p).map(Some).map_err(|e| e.to_string()),
        None => Ok(None),
    }
}

/// Grava uma imagem (png/jpg, até 2 MB) numa pasta existente do vault (ex.: a logo da escola em `_sistema/anexos`).
#[tauri::command]
pub fn save_attachment(app: State<App>, dir: String, name: String, data: Vec<u8>) -> Result<String, String> {
    let name = valid_name(&name)?;
    let ext = Path::new(name).extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if !["png", "jpg", "jpeg"].contains(&ext.as_str()) { return Err("só imagens png ou jpg".into()); }
    if data.is_empty() || data.len() > 2_000_000 { return Err("imagem vazia ou maior que 2 MB".into()); }
    let d = pasta_destino(&app, &dir)?;
    if !d.is_dir() { return Err("destino não é pasta".into()); }
    let p = d.join(name);
    gravar_bytes_atomico(&p, &data, || Ok(()))?;
    app.invalidar();
    Ok(slash(&p))
}

#[tauri::command]
pub fn save_note(app: State<App>, path: String, text: String, force: Option<bool>) -> Result<(), String> {
    let p = inside(&app, &path)?;
    let root = root_of(&app)?;
    // falha no histórico nunca impede de salvar; ao sobrescrever uma mudança externa, a versão do disco sempre vai para o histórico
    let r = gravar_nota(&app.vistos, &p, &text, force.unwrap_or(false), |externa| { let _ = snapshot(&root, &p, externa); });
    app.invalidar();
    r
}

#[derive(Serialize)]
pub struct Versao { id: String, ts: u64, bytes: u64 }

#[tauri::command]
pub fn list_history(app: State<App>, path: String) -> Result<Vec<Versao>, String> {
    let root = root_of(&app)?;
    let dir = hist_dir(&root, &inside(&app, &path)?)?;
    Ok(hist_ids(&dir).into_iter().map(|ts| Versao { id: ts.to_string(), ts, bytes: std::fs::metadata(dir.join(format!("{ts}.md"))).map_or(0, |m| m.len()) }).collect())
}

pub(crate) fn versao_path(app: &App, path: &str, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || !id.bytes().all(|b| b.is_ascii_digit()) { return Err("versão inválida".into()); }
    Ok(hist_dir(&root_of(app)?, &inside(app, path)?)?.join(format!("{id}.md")))
}

#[tauri::command]
pub fn read_version(app: State<App>, path: String, id: String) -> Result<String, String> {
    std::fs::read_to_string(versao_path(&app, &path, &id)?).map_err(|e| e.to_string())
}

/// Restaura uma versão: antes guarda o texto atual no histórico (dá para desfazer a restauração).
#[tauri::command]
pub fn restore_version(app: State<App>, path: String, id: String) -> Result<String, String> {
    let texto = std::fs::read_to_string(versao_path(&app, &path, &id)?).map_err(|e| e.to_string())?;
    let p = inside(&app, &path)?;
    snapshot(&root_of(&app)?, &p, true)?;
    gravar_atomico(&p, &texto)?;
    lock(&app.vistos).insert(p, hash_texto(&texto));
    app.invalidar();
    Ok(texto)
}

#[tauri::command]
pub fn resolve_link(app: State<App>, target: String) -> Option<String> {
    com_vault(&app, |v| v.resolve(&target).map(|n| slash(&n.path))).ok().flatten()
}

#[derive(Serialize)]
pub struct Changed { path: String, links: usize }

/// Reescritas de `[[antigo]]` → `[[novo]]` em todas as notas (por nome, como o vault resolve): (caminho, texto original, texto novo, links trocados).
/// Só calcula; quem grava é `aplicar_reescritas`, que desfaz tudo se uma gravação falhar.
pub(crate) fn planejar_links(app: &App, old: &str, new: &str) -> Result<Vec<(PathBuf, String, String, usize)>, String> {
    let mut plano = vec![];
    com_vault(app, |v| for n in &v.notes {
        let Ok(text) = std::fs::read_to_string(&n.path) else { continue };
        let mut feitos = 0;
        let out = vault_core::reorganizar::rewrite_links(&text, &mut |t: &str| {
            let (dir, last) = match t.rfind('/') { Some(i) => (&t[..=i], &t[i + 1..]), None => ("", t) };
            let stem = last.strip_suffix(".md").unwrap_or(last);
            if stem.eq_ignore_ascii_case(old) { feitos += 1; Some(format!("{dir}{new}")) } else { None }
        });
        if feitos > 0 { plano.push((n.path.clone(), text, out, feitos)); }
    })?;
    Ok(plano)
}

/// Grava as reescritas (com histórico de cada nota). Se alguma falhar, devolve as já gravadas ao texto original.
pub(crate) fn aplicar_reescritas(app: &App, plano: &[(PathBuf, String, String, usize)]) -> Result<usize, String> {
    let root = canon(&app.root()).unwrap_or_else(|_| app.root());
    let mut feitas = 0;
    for (k, (path, _, novo, _)) in plano.iter().enumerate() {
        let _ = snapshot(&root, &canon(path).unwrap_or_else(|_| path.clone()), true);
        if let Err(e) = gravar_atomico(path, novo) {
            for (p, orig, _, _) in &plano[..k] { let _ = gravar_atomico(p, orig); lock(&app.vistos).insert(p.clone(), hash_texto(orig)); }
            app.invalidar();
            return Err(format!("{e} (nenhuma nota foi alterada)"));
        }
        lock(&app.vistos).insert(path.clone(), hash_texto(novo));
        feitas += plano[k].3;
    }
    app.invalidar();
    Ok(feitas)
}

/// `rename` que também aceita trocar só maiúsculas/minúsculas (no Windows `Antes.md` → `antes.md` conta como "já existe"): passa por um nome temporário.
pub(crate) fn renomear_fs(from: &Path, to: &Path) -> Result<(), String> {
    let so_caixa = from != to && from.to_string_lossy().to_lowercase() == to.to_string_lossy().to_lowercase();
    if so_caixa {
        let tmp = from.with_file_name(format!(".renomeando-{}", std::process::id()));
        std::fs::rename(from, &tmp).map_err(|e| e.to_string())?;
        if let Err(e) = std::fs::rename(&tmp, to) { let _ = std::fs::rename(&tmp, from); return Err(e.to_string()); }
        Ok(())
    } else { std::fs::rename(from, to).map_err(|e| e.to_string()) }
}

#[tauri::command]
pub fn create_note(app: State<App>, dir: String, name: String) -> Result<String, String> {
    let name = valid_name(&name)?.trim_end_matches(".md").to_string();
    let d = pasta_destino(&app, &dir)?;
    if !d.is_dir() { return Err("destino não é pasta".into()); }
    let p = d.join(format!("{name}.md"));
    if p.exists() { return Err(format!("já existe: {name}.md")); }
    if let Some(onde) = nome_em_uso(&app, &name, None)? { return Err(format!("já existe uma nota com esse nome em {onde}; os links [[{name}]] ficariam ambíguos")); }
    // create_new: nunca sobrescreve, nem numa corrida entre a checagem acima e a escrita
    let escrito = std::fs::OpenOptions::new().write(true).create_new(true).open(&p).and_then(|mut f| { use std::io::Write; f.write_all(format!("# {name}\n").as_bytes()) });
    app.invalidar();
    escrito.map_err(|e| if e.kind() == std::io::ErrorKind::AlreadyExists { format!("já existe: {name}.md") } else { e.to_string() })?;
    Ok(slash(&p))
}

#[tauri::command]
pub fn create_folder(app: State<App>, dir: String, name: String) -> Result<String, String> {
    let name = valid_name(&name)?;
    let d = pasta_destino(&app, &dir)?;
    let p = d.join(name);
    if p.exists() { return Err(format!("já existe: {name}")); }
    std::fs::create_dir(&p).map_err(|e| e.to_string())?;
    app.invalidar();
    Ok(slash(&p))
}

/// Renomeia nota (atualizando wikilinks) ou pasta. `name` sem extensão.
#[tauri::command]
pub fn rename_entry(app: State<App>, path: String, name: String) -> Result<Changed, String> {
    let from = inside_any(&app, &path)?;
    let name = valid_name(&name)?.trim_end_matches(".md").to_string();
    let is_note = from.is_file();
    if is_note && from.extension().map_or(true, |x| x != "md") { return Err("só notas .md".into()); }
    let to = from.with_file_name(if is_note { format!("{name}.md") } else { name.clone() });
    let so_caixa = to != from && to.to_string_lossy().to_lowercase() == from.to_string_lossy().to_lowercase();
    if to != from && !so_caixa && to.exists() { return Err("já existe um item com esse nome".into()); }
    if is_note { if let Some(onde) = nome_em_uso(&app, &name, Some(&from))? { return Err(format!("já existe uma nota com esse nome em {onde}; os links [[{name}]] ficariam ambíguos")); } }
    let antigo = from.file_stem().ok_or("caminho inválido")?.to_string_lossy().to_string();
    renomear_fs(&from, &to)?;
    app.invalidar();
    mover_historico(&root_of(&app)?, &from, &to);
    // Os links são calculados depois de renomear (o vault já enxerga o nome novo); se gravar falhar, desfaz tudo, inclusive o renome.
    let links = if is_note {
        match planejar_links(&app, &antigo, &name).and_then(|p| aplicar_reescritas(&app, &p)) {
            Ok(n) => n,
            Err(e) => { let _ = renomear_fs(&to, &from); mover_historico(&root_of(&app)?, &to, &from); return Err(format!("não renomeou: {e}")); }
        }
    } else { 0 };
    app.invalidar();
    Ok(Changed { path: slash(&to), links })
}

/// Move nota ou pasta para outra pasta (`dir` vazio = raiz). Links por nome continuam valendo.
#[tauri::command]
pub fn move_entry(app: State<App>, path: String, dir: String) -> Result<Changed, String> {
    let from = inside_any(&app, &path)?;
    let d = if dir.is_empty() { root_of(&app)? } else { inside_any(&app, &dir)? };
    if !d.is_dir() { return Err("destino não é pasta".into()); }
    if d.starts_with(&from) { return Err("não dá para mover para dentro de si mesma".into()); }
    let to = d.join(from.file_name().ok_or("caminho inválido")?);
    if to == from { return Ok(Changed { path: path.clone(), links: 0 }); }
    if to.exists() { return Err("já existe um item com esse nome no destino".into()); }
    if from.is_file() { if let Some(onde) = nome_em_uso(&app, &from.file_stem().unwrap_or_default().to_string_lossy(), Some(&from))? { return Err(format!("já existe uma nota com esse nome em {onde}; os links ficariam ambíguos")); } }
    std::fs::rename(&from, &to).map_err(|e| e.to_string())?;
    mover_historico(&root_of(&app)?, &from, &to);
    app.invalidar();
    Ok(Changed { path: slash(&to), links: 0 })
}

/// Exclui para `.lixeira/` na raiz do vault (recuperável; pastas ocultas são ignoradas pelo vault).
#[tauri::command]
pub fn delete_entry(app: State<App>, path: String) -> Result<(), String> {
    let from = inside_any(&app, &path)?;
    let lix = root_of(&app)?.join(".lixeira");
    std::fs::create_dir_all(&lix).map_err(|e| e.to_string())?;
    let base = from.file_name().ok_or("caminho inválido")?.to_string_lossy().to_string();
    let mut to = lix.join(&base);
    let mut i = 1;
    while to.exists() { to = lix.join(format!("{base}.{i}")); i += 1; }
    let r = std::fs::rename(&from, &to).map_err(|e| e.to_string());
    app.invalidar();
    r
}

#[tauri::command]
pub fn list_dirs(app: State<App>) -> Result<Vec<String>, String> {
    fn walk(d: &Path, root: &Path, out: &mut Vec<String>) {
        let Ok(rd) = std::fs::read_dir(d) else { return };
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() && !e.file_name().to_string_lossy().starts_with('.') {
                out.push(p.strip_prefix(root).unwrap_or(&p).to_string_lossy().replace('\\', "/") + "/");
                walk(&p, root, out);
            }
        }
    }
    let root = root_of(&app)?;
    let mut out = vec![]; walk(&root, &root, &mut out); Ok(out)
}

// ---------- propriedades, backlinks e avisos ----------

#[derive(Serialize)]
pub struct Aviso { line: usize, severity: &'static str, code: &'static str, msg: String }
#[derive(Serialize)]
pub struct Saude { note: String, line: usize, severity: &'static str, code: &'static str, msg: String }

/// Todos os avisos do `vault_core` para o painel de saúde (relê o vault do disco).
#[tauri::command]
pub fn vault_health(app: State<App>) -> Result<Vec<Saude>, String> {
    use vault_core::validate::{validate, Severity};
    com_vault(&app, |v| validate(v).into_iter().map(|i| Saude {
        note: i.note, line: i.line, code: i.code, msg: i.msg,
        severity: match i.severity { Severity::Error => "erro", Severity::Warning => "aviso", Severity::Info => "info" },
    }).collect())
}

#[derive(Serialize)]
pub struct Back { name: String, path: String, rel: String, line: usize }
#[derive(Serialize)]
pub struct Info { issues: Vec<Aviso>, backlinks: Vec<Back>, tipo: Option<String>, required: Vec<String>, status: Vec<String> }

/// Lê o vault do disco (a nota já deve estar salva) e devolve avisos do `vault_core`,
/// notas que apontam para ela e os campos obrigatórios do seu `tipo`.
#[tauri::command]
pub fn note_info(app: State<App>, path: String) -> Result<Info, String> {
    use vault_core::validate::{required_fields, validate_note, Severity, STATUS};
    let p = inside(&app, &path)?;
    let name = p.file_stem().ok_or("caminho inválido")?.to_string_lossy().to_string();
    let root = app.root();
    com_vault(&app, |v| {
        let issues = validate_note(v, &name).into_iter().map(|i| Aviso {
            line: i.line, code: i.code, msg: i.msg,
            severity: match i.severity { Severity::Error => "erro", Severity::Warning => "aviso", Severity::Info => "info" },
        }).collect();
        let mut backlinks = vec![];
        for n in v.notes.iter().filter(|n| n.name != name) {
            let Some(l) = n.links.iter().find(|l| !l.target.is_empty() && v.resolve(&l.target).is_some_and(|d| d.name == name)) else { continue };
            backlinks.push(Back {
                name: n.name.clone(), path: slash(&n.path),
                rel: n.path.strip_prefix(&root).unwrap_or(&n.path).to_string_lossy().replace('\\', "/"),
                line: vault_core::links::line_of(&n.text, l.offset),
            });
        }
        let note = v.notes.iter().find(|n| n.name == name);
        let tipo = note.and_then(|n| n.tipo()).map(String::from);
        let required = tipo.as_deref().and_then(required_fields).map(|r| r.iter().map(|s| s.to_string()).collect()).unwrap_or_default();
        Info { issues, backlinks, tipo, required, status: STATUS.iter().map(|s| s.to_string()).collect() }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::teste_util::*;
    use vault_core::vault::Vault;

    #[test]
    fn salva_nota_listada_do_vault_ficticio() {
        // Vault inventado e versionado: o teste falha (não pula) se a pasta sumir.
        let origem = PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../../tests/fixtures/ficticio"));
        assert!(origem.is_dir(), "faltou tests/fixtures/ficticio");
        // Trabalha numa cópia para o teste nunca alterar a fixture versionada.
        let root = std::env::temp_dir().join(format!("vault-ficticio-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        copiar_pasta(&origem, &root);
        let v = Vault::open(&root).unwrap();
        assert!(v.notes.len() >= 5, "o vault fictício deveria ter várias notas");
        for n in v.notes.iter() {
            let p = inside_root(&root, &slash(&n.path)).expect("caminho da lista deve passar em inside()");
            let orig = std::fs::read_to_string(&p).unwrap();
            std::fs::write(&p, &orig).unwrap();
        }
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn renomeia_atualiza_links_e_recusa_fora() {
        let d = std::env::temp_dir().join(format!("vault-ren-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join("A")).unwrap();
        std::fs::write(d.join("A/Velha.md"), "x").unwrap();
        std::fs::write(d.join("B.md"), "ver [[Velha]] e [[A/velha#t|alias]] e [[Outra]]").unwrap();
        let app = App::new(d.clone());
        let plano = planejar_links(&app, "Velha", "Nova").unwrap();
        assert_eq!(std::fs::read_to_string(d.join("B.md")).unwrap(), "ver [[Velha]] e [[A/velha#t|alias]] e [[Outra]]", "planejar não grava");
        assert_eq!(aplicar_reescritas(&app, &plano).unwrap(), 2);
        assert_eq!(std::fs::read_to_string(d.join("B.md")).unwrap(), "ver [[Nova]] e [[A/Nova#t|alias]] e [[Outra]]");
        assert!(inside_any(&app, d.to_str().unwrap()).is_err());
        assert!(inside_any(&app, "/etc").is_err());
        assert!(inside_any(&app, d.join("A").to_str().unwrap()).is_ok());
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn reescrita_com_falha_desfaz_as_ja_gravadas() {
        let d = tmpdir("rollback");
        let (a, b) = (d.join("a.md"), d.join("b.md"));
        std::fs::write(&a, "[[X]]").unwrap();
        std::fs::write(&b, "[[X]]").unwrap();
        let app = App::new(d.clone());
        // a segunda gravação falha: o destino é uma pasta, não dá para criar o temporário/renomear sobre ela
        let ruim = d.join("pasta.md");
        std::fs::create_dir(&ruim).unwrap();
        let plano = vec![(a.clone(), "[[X]]".to_string(), "[[Y]]".to_string(), 1), (ruim, "x".into(), "y".into(), 1), (b.clone(), "[[X]]".into(), "[[Y]]".into(), 1)];
        assert!(aplicar_reescritas(&app, &plano).is_err());
        assert_eq!(std::fs::read_to_string(&a).unwrap(), "[[X]]");
        assert_eq!(std::fs::read_to_string(&b).unwrap(), "[[X]]");
    }

    #[test]
    fn renomear_so_a_caixa_passa_pelo_temporario() {
        let d = tmpdir("caixa");
        std::fs::write(d.join("Antes.md"), "x").unwrap();
        renomear_fs(&d.join("Antes.md"), &d.join("antes.md")).unwrap();
        let nomes: Vec<_> = std::fs::read_dir(&d).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().to_string()).collect();
        assert_eq!(nomes, vec!["antes.md"]);
    }
}
