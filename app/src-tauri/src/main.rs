#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use serde::Serialize;
use tauri::{Manager, State};
use vault_core::vault::Vault;

/// Trava o Mutex mesmo que outro comando tenha dado pânico com ele aberto: um erro isolado não derruba todos os comandos seguintes.
fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> { m.lock().unwrap_or_else(|e| e.into_inner()) }

/// Última versão (hash do texto) que o app leu ou gravou de cada nota: serve para notar que o arquivo mudou por fora.
type Vistos = Mutex<std::collections::HashMap<PathBuf, u64>>;

struct App { root_cell: Mutex<PathBuf>, vault: Mutex<Option<Vault>>, vistos: Vistos }

impl App {
    fn new(root: PathBuf) -> Self { App { root_cell: Mutex::new(root), vault: Mutex::new(None), vistos: Mutex::new(Default::default()) } }
    fn root(&self) -> PathBuf { lock(&self.root_cell).clone() }
}

/// Caminho para o JS: sempre com `/` (o Windows aceita) e sem o prefixo `\\?\`.
fn slash(p: &Path) -> String { simp(p).to_string_lossy().replace('\\', "/") }

/// `canonicalize` sem o prefixo `\\?\` do Windows (deixa os caminhos iguais aos da lista de notas).
fn canon(p: &Path) -> std::io::Result<PathBuf> { dunce::canonicalize(p) }
fn simp(p: &Path) -> PathBuf { dunce::simplified(p).to_path_buf() }

#[derive(Serialize)]
struct Item { name: String, path: String, rel: String, tipo: Option<String>, /** última modificação, em segundos desde 1970 */ modified: Option<u64> }

fn load(app: &App) -> Result<(), String> {
    let v = Vault::open(&app.root()).map_err(|e| e.to_string())?;
    *lock(&app.vault) = Some(v);
    Ok(())
}

/// Windows: o instalador do atualizador encerra o app e nem sempre o reabre. Antes de instalar, deixa um vigia (PowerShell,
/// sem janela) que espera este processo sair, espera o instalador terminar e reabre o app se ele ainda não estiver rodando.
/// Se este processo não sair em 2 minutos (instalação cancelada ou falhou), o vigia desiste.
#[tauri::command]
fn agendar_reabertura() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let nome = exe.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        let script = format!(
            "$exe='{exe}'; $n='{nome}'; $pid0={pid}; \
             $p=Get-Process -Id $pid0 -ErrorAction SilentlyContinue; if($p){{ if(-not $p.WaitForExit(120000)){{ exit }} }}; \
             Start-Sleep -Seconds 3; \
             for($i=0;$i -lt 60;$i++){{ \
               if(Get-Process -Name $n -ErrorAction SilentlyContinue){{ exit }}; \
               if(-not (Get-Process -Name 'Margem_*' -ErrorAction SilentlyContinue) -and -not (Get-Process -Name 'setup*' -ErrorAction SilentlyContinue)){{ Start-Process -FilePath $exe; exit }}; \
               Start-Sleep -Seconds 2 }}",
            exe = exe.to_string_lossy().replace('\'', "''"), nome = nome.replace('\'', "''"), pid = std::process::id());
        // CREATE_NO_WINDOW | DETACHED_PROCESS: sem janela e independente deste processo
        std::process::Command::new("powershell").args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
            .creation_flags(0x0800_0000 | 0x0000_0008).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn list_notes(app: State<App>) -> Result<Vec<Item>, String> {
    load(&app)?;
    let g = lock(&app.vault);
    Ok(g.as_ref().unwrap().notes.iter().map(|n| Item {
        name: n.name.clone(), path: slash(&n.path),
        rel: n.path.strip_prefix(&app.root()).unwrap_or(&n.path).to_string_lossy().replace('\\', "/"), tipo: n.tipo().map(String::from),
        modified: std::fs::metadata(&n.path).and_then(|m| m.modified()).ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()),
    }).collect())
}

fn inside(app: &App, p: &str) -> Result<PathBuf, String> {
    inside_root(&app.root(), p)
}

fn inside_root(root: &Path, p: &str) -> Result<PathBuf, String> {
    inside_ext(root, p, &["md"])
}

fn inside_ext(root: &Path, p: &str, exts: &[&str]) -> Result<PathBuf, String> {
    let p = canon(Path::new(p)).map_err(|e| format!("{p}: {e}"))?;
    let root = canon(root).map_err(|e| e.to_string())?;
    if p.starts_with(&root) && p.extension().is_some_and(|x| exts.iter().any(|e| x == *e)) { Ok(p) } else { Err("fora do vault".into()) }
}

fn hash_texto(t: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    t.hash(&mut h);
    h.finish()
}

/// Grava sem deixar o arquivo pela metade: escreve num temporário ao lado e troca pelo original (uma queda no meio
/// mantém a versão antiga inteira).
fn gravar_atomico(p: &Path, text: &str) -> Result<(), String> {
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
fn gravar_nota(vistos: &Vistos, p: &Path, text: &str, forcar: bool, antes: impl FnOnce(bool)) -> Result<(), String> {
    let no_disco = std::fs::read_to_string(p).ok();
    let conhecido = lock(vistos).get(p).copied();
    let mudou = matches!((&no_disco, conhecido), (Some(d), Some(h)) if hash_texto(d) != h);
    if mudou && !forcar { return Err("conflito: o arquivo foi alterado fora do Margem desde a última leitura".into()); }
    antes(mudou);
    gravar_atomico(p, text)?;
    lock(vistos).insert(p.to_path_buf(), hash_texto(text));
    Ok(())
}

#[tauri::command]
fn read_note(app: State<App>, path: String) -> Result<String, String> {
    let p = inside(&app, &path)?;
    let t = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    lock(&app.vistos).insert(p, hash_texto(&t));
    Ok(normalizar(t))
}

/// Para as telas: sem BOM e com fim de linha `\n` (o editor já trabalha assim; as telas leem frontmatter e tabelas por `\n`).
/// O arquivo em disco só muda se o usuário salvar a nota.
fn normalizar(t: String) -> String {
    let t = t.strip_prefix('\u{feff}').map(str::to_string).unwrap_or(t);
    if t.contains('\r') { t.replace("\r\n", "\n") } else { t }
}

/// Já existe outra nota com este nome (em qualquer pasta)? Os links resolvem por nome, então repetir deixa `[[nome]]` ambíguo.
fn nome_em_uso(app: &App, nome: &str, exceto: Option<&Path>) -> Result<Option<String>, String> {
    let root = app.root();
    let v = Vault::open(&root).map_err(|e| e.to_string())?;
    let exceto = exceto.and_then(|p| canon(p).ok());
    Ok(v.notes.iter()
        .find(|n| n.name.trim().to_lowercase() == nome.trim().to_lowercase() && canon(&n.path).ok() != exceto)
        .map(|n| n.path.strip_prefix(&root).unwrap_or(&n.path).to_string_lossy().replace('\\', "/")))
}

/// Arquivo auxiliar `.json` dentro do vault (ex.: `_dados.json` de uma correção); `None` se não existir.
#[tauri::command]
fn read_sidecar(app: State<App>, path: String) -> Result<Option<String>, String> {
    let p = Path::new(&path);
    if !p.exists() { return Ok(None); }
    let p = inside_ext(&app.root(), &path, &["json"])?;
    std::fs::read_to_string(p).map(Some).map_err(|e| e.to_string())
}

/// Grava uma imagem (png/jpg, até 2 MB) numa pasta existente do vault (ex.: a logo da escola em `_sistema/anexos`).
#[tauri::command]
fn save_attachment(app: State<App>, dir: String, name: String, data: Vec<u8>) -> Result<String, String> {
    let name = valid_name(&name)?;
    let ext = Path::new(name).extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if !["png", "jpg", "jpeg"].contains(&ext.as_str()) { return Err("só imagens png ou jpg".into()); }
    if data.is_empty() || data.len() > 2_000_000 { return Err("imagem vazia ou maior que 2 MB".into()); }
    let d = pasta_destino(&app, &dir)?;
    if !d.is_dir() { return Err("destino não é pasta".into()); }
    let p = d.join(name);
    std::fs::write(&p, data).map_err(|e| e.to_string())?;
    Ok(slash(&p))
}

use vault_core::historico::{hist_dir, hist_ids, mover_historico, snapshot};

#[tauri::command]
fn save_note(app: State<App>, path: String, text: String, force: Option<bool>) -> Result<(), String> {
    let p = inside(&app, &path)?;
    let root = root_of(&app)?;
    // falha no histórico nunca impede de salvar; ao sobrescrever uma mudança externa, a versão do disco sempre vai para o histórico
    gravar_nota(&app.vistos, &p, &text, force.unwrap_or(false), |externa| { let _ = snapshot(&root, &p, externa); })
}

#[derive(Serialize)]
struct Versao { id: String, ts: u64, bytes: u64 }

#[tauri::command]
fn list_history(app: State<App>, path: String) -> Result<Vec<Versao>, String> {
    let root = root_of(&app)?;
    let dir = hist_dir(&root, &inside(&app, &path)?)?;
    Ok(hist_ids(&dir).into_iter().map(|ts| Versao { id: ts.to_string(), ts, bytes: std::fs::metadata(dir.join(format!("{ts}.md"))).map_or(0, |m| m.len()) }).collect())
}

fn versao_path(app: &App, path: &str, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || !id.bytes().all(|b| b.is_ascii_digit()) { return Err("versão inválida".into()); }
    Ok(hist_dir(&root_of(app)?, &inside(app, path)?)?.join(format!("{id}.md")))
}

#[tauri::command]
fn read_version(app: State<App>, path: String, id: String) -> Result<String, String> {
    std::fs::read_to_string(versao_path(&app, &path, &id)?).map_err(|e| e.to_string())
}

/// Restaura uma versão: antes guarda o texto atual no histórico (dá para desfazer a restauração).
#[tauri::command]
fn restore_version(app: State<App>, path: String, id: String) -> Result<String, String> {
    let texto = std::fs::read_to_string(versao_path(&app, &path, &id)?).map_err(|e| e.to_string())?;
    let p = inside(&app, &path)?;
    snapshot(&root_of(&app)?, &p, true)?;
    gravar_atomico(&p, &texto)?;
    lock(&app.vistos).insert(p, hash_texto(&texto));
    Ok(texto)
}

#[tauri::command]
fn resolve_link(app: State<App>, target: String) -> Option<String> {
    let g = lock(&app.vault);
    g.as_ref()?.resolve(&target).map(|n| slash(&n.path))
}

// ---------- gerenciar notas e pastas ----------

fn root_of(app: &App) -> Result<PathBuf, String> { canon(&app.root()).map_err(|e| e.to_string()) }

/// Caminho existente (arquivo ou pasta) dentro do vault, nunca a própria raiz nem pasta oculta.
fn inside_any(app: &App, p: &str) -> Result<PathBuf, String> { inside_any_em(&root_of(app)?, p) }

fn inside_any_em(root: &Path, p: &str) -> Result<PathBuf, String> {
    let p = canon(Path::new(p)).map_err(|e| format!("{p}: {e}"))?;
    let oculto = p.strip_prefix(root).map_or(true, |r| r.components().any(|c| c.as_os_str().to_string_lossy().starts_with('.')));
    if p == root || !p.starts_with(root) || oculto { Err("fora do vault".into()) } else { Ok(p) }
}

/// Pasta de destino para criar algo: a raiz (vazia ou o próprio caminho dela) ou uma pasta do vault.
/// Se a pasta ainda não existe (vault novo, sem `Anos/2026/Semanas`), cria-a — só dentro do vault e nunca oculta.
fn pasta_destino(app: &App, dir: &str) -> Result<PathBuf, String> { pasta_destino_em(&root_of(app)?, dir) }

fn pasta_destino_em(root: &Path, dir: &str) -> Result<PathBuf, String> {
    let root = root.to_path_buf();
    if dir.is_empty() { return Ok(root); }
    if let Ok(c) = canon(Path::new(dir)) {
        if c == root { return Ok(root); }
        return inside_any_em(&root, dir);
    }
    let mut rest: Vec<std::ffi::OsString> = Vec::new();
    let mut atual = PathBuf::from(dir);
    let base = loop {
        if let Ok(c) = canon(&atual) { break c; }
        let Some(nome) = atual.file_name().map(|n| n.to_os_string()) else { return Err("fora do vault".into()) };
        rest.push(nome);
        if !atual.pop() { return Err("fora do vault".into()); }
    };
    if !base.starts_with(&root) { return Err("fora do vault".into()); }
    let mut alvo = base;
    for n in rest.into_iter().rev() {
        let s = n.to_string_lossy();
        if s == ".." || s == "." || s.starts_with('.') { return Err("fora do vault".into()); }
        alvo.push(n);
    }
    std::fs::create_dir_all(&alvo).map_err(|e| e.to_string())?;
    Ok(alvo)
}

fn valid_name(n: &str) -> Result<&str, String> {
    let n = n.trim();
    if n.is_empty() || n.starts_with('.') || n.contains(['/', '\\', ':']) { Err(format!("nome inválido: {n:?}")) } else { Ok(n) }
}

#[derive(Serialize)]
struct Changed { path: String, links: usize }

/// Reescritas de `[[antigo]]` → `[[novo]]` em todas as notas (por nome, como o vault resolve): (caminho, texto original, texto novo, links trocados).
/// Só calcula; quem grava é `aplicar_reescritas`, que desfaz tudo se uma gravação falhar.
fn planejar_links(app: &App, old: &str, new: &str) -> Result<Vec<(PathBuf, String, String, usize)>, String> {
    let v = Vault::open(&app.root()).map_err(|e| e.to_string())?;
    let mut plano = vec![];
    for n in &v.notes {
        let Ok(text) = std::fs::read_to_string(&n.path) else { continue };
        let mut feitos = 0;
        let out = vault_core::reorganizar::rewrite_links(&text, &mut |t: &str| {
            let (dir, last) = match t.rfind('/') { Some(i) => (&t[..=i], &t[i + 1..]), None => ("", t) };
            let stem = last.strip_suffix(".md").unwrap_or(last);
            if stem.eq_ignore_ascii_case(old) { feitos += 1; Some(format!("{dir}{new}")) } else { None }
        });
        if feitos > 0 { plano.push((n.path.clone(), text, out, feitos)); }
    }
    Ok(plano)
}

/// Grava as reescritas (com histórico de cada nota). Se alguma falhar, devolve as já gravadas ao texto original.
fn aplicar_reescritas(app: &App, plano: &[(PathBuf, String, String, usize)]) -> Result<usize, String> {
    let root = canon(&app.root()).unwrap_or_else(|_| app.root());
    let mut feitas = 0;
    for (k, (path, _, novo, _)) in plano.iter().enumerate() {
        let _ = snapshot(&root, &canon(path).unwrap_or_else(|_| path.clone()), true);
        if let Err(e) = gravar_atomico(path, novo) {
            for (p, orig, _, _) in &plano[..k] { let _ = gravar_atomico(p, orig); lock(&app.vistos).insert(p.clone(), hash_texto(orig)); }
            return Err(format!("{e} (nenhuma nota foi alterada)"));
        }
        lock(&app.vistos).insert(path.clone(), hash_texto(novo));
        feitas += plano[k].3;
    }
    Ok(feitas)
}

/// `rename` que também aceita trocar só maiúsculas/minúsculas (no Windows `Antes.md` → `antes.md` conta como "já existe"): passa por um nome temporário.
fn renomear_fs(from: &Path, to: &Path) -> Result<(), String> {
    let so_caixa = from != to && from.to_string_lossy().to_lowercase() == to.to_string_lossy().to_lowercase();
    if so_caixa {
        let tmp = from.with_file_name(format!(".renomeando-{}", std::process::id()));
        std::fs::rename(from, &tmp).map_err(|e| e.to_string())?;
        if let Err(e) = std::fs::rename(&tmp, to) { let _ = std::fs::rename(&tmp, from); return Err(e.to_string()); }
        Ok(())
    } else { std::fs::rename(from, to).map_err(|e| e.to_string()) }
}

#[tauri::command]
fn create_note(app: State<App>, dir: String, name: String) -> Result<String, String> {
    let name = valid_name(&name)?.trim_end_matches(".md").to_string();
    let d = pasta_destino(&app, &dir)?;
    if !d.is_dir() { return Err("destino não é pasta".into()); }
    let p = d.join(format!("{name}.md"));
    if p.exists() { return Err(format!("já existe: {name}.md")); }
    if let Some(onde) = nome_em_uso(&app, &name, None)? { return Err(format!("já existe uma nota com esse nome em {onde}; os links [[{name}]] ficariam ambíguos")); }
    std::fs::write(&p, format!("# {name}\n")).map_err(|e| e.to_string())?;
    Ok(slash(&p))
}

#[tauri::command]
fn create_folder(app: State<App>, dir: String, name: String) -> Result<String, String> {
    let name = valid_name(&name)?;
    let d = pasta_destino(&app, &dir)?;
    let p = d.join(name);
    if p.exists() { return Err(format!("já existe: {name}")); }
    std::fs::create_dir(&p).map_err(|e| e.to_string())?;
    Ok(slash(&p))
}

/// Renomeia nota (atualizando wikilinks) ou pasta. `name` sem extensão.
#[tauri::command]
fn rename_entry(app: State<App>, path: String, name: String) -> Result<Changed, String> {
    let from = inside_any(&app, &path)?;
    let name = valid_name(&name)?.trim_end_matches(".md").to_string();
    let is_note = from.is_file();
    if is_note && from.extension().map_or(true, |x| x != "md") { return Err("só notas .md".into()); }
    let to = from.with_file_name(if is_note { format!("{name}.md") } else { name.clone() });
    let so_caixa = to != from && to.to_string_lossy().to_lowercase() == from.to_string_lossy().to_lowercase();
    if to != from && !so_caixa && to.exists() { return Err("já existe um item com esse nome".into()); }
    if is_note { if let Some(onde) = nome_em_uso(&app, &name, Some(&from))? { return Err(format!("já existe uma nota com esse nome em {onde}; os links [[{name}]] ficariam ambíguos")); } }
    let antigo = from.file_stem().unwrap().to_string_lossy().to_string();
    renomear_fs(&from, &to)?;
    mover_historico(&root_of(&app)?, &from, &to);
    // Os links são calculados depois de renomear (o vault já enxerga o nome novo); se gravar falhar, desfaz tudo, inclusive o renome.
    let links = if is_note {
        match planejar_links(&app, &antigo, &name).and_then(|p| aplicar_reescritas(&app, &p)) {
            Ok(n) => n,
            Err(e) => { let _ = renomear_fs(&to, &from); mover_historico(&root_of(&app)?, &to, &from); return Err(format!("não renomeou: {e}")); }
        }
    } else { 0 };
    Ok(Changed { path: slash(&to), links })
}

/// Move nota ou pasta para outra pasta (`dir` vazio = raiz). Links por nome continuam valendo.
#[tauri::command]
fn move_entry(app: State<App>, path: String, dir: String) -> Result<Changed, String> {
    let from = inside_any(&app, &path)?;
    let d = if dir.is_empty() { root_of(&app)? } else { inside_any(&app, &dir)? };
    if !d.is_dir() { return Err("destino não é pasta".into()); }
    if d.starts_with(&from) { return Err("não dá para mover para dentro de si mesma".into()); }
    let to = d.join(from.file_name().unwrap());
    if to == from { return Ok(Changed { path: path.clone(), links: 0 }); }
    if to.exists() { return Err("já existe um item com esse nome no destino".into()); }
    if from.is_file() { if let Some(onde) = nome_em_uso(&app, &from.file_stem().unwrap().to_string_lossy(), Some(&from))? { return Err(format!("já existe uma nota com esse nome em {onde}; os links ficariam ambíguos")); } }
    std::fs::rename(&from, &to).map_err(|e| e.to_string())?;
    mover_historico(&root_of(&app)?, &from, &to);
    Ok(Changed { path: slash(&to), links: 0 })
}

/// Exclui para `.lixeira/` na raiz do vault (recuperável; pastas ocultas são ignoradas pelo vault).
#[tauri::command]
fn delete_entry(app: State<App>, path: String) -> Result<(), String> {
    let from = inside_any(&app, &path)?;
    let lix = root_of(&app)?.join(".lixeira");
    std::fs::create_dir_all(&lix).map_err(|e| e.to_string())?;
    let base = from.file_name().unwrap().to_string_lossy().to_string();
    let mut to = lix.join(&base);
    let mut i = 1;
    while to.exists() { to = lix.join(format!("{base}.{i}")); i += 1; }
    std::fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_dirs(app: State<App>) -> Result<Vec<String>, String> {
    fn walk(d: &Path, root: &Path, out: &mut Vec<String>) {
        let Ok(rd) = std::fs::read_dir(d) else { return };
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() && !e.file_name().to_string_lossy().starts_with('.') {
                out.push(p.strip_prefix(root).unwrap().to_string_lossy().replace('\\', "/") + "/");
                walk(&p, root, out);
            }
        }
    }
    let root = root_of(&app)?;
    let mut out = vec![]; walk(&root, &root, &mut out); Ok(out)
}

// ---------- propriedades, backlinks e avisos ----------

#[derive(Serialize)]
struct Aviso { line: usize, severity: &'static str, code: &'static str, msg: String }
#[derive(Serialize)]
struct Saude { note: String, line: usize, severity: &'static str, code: &'static str, msg: String }

/// Todos os avisos do `vault_core` para o painel de saúde (relê o vault do disco).
#[tauri::command]
fn vault_health(app: State<App>) -> Result<Vec<Saude>, String> {
    use vault_core::validate::{validate, Severity};
    load(&app)?;
    let g = lock(&app.vault);
    let v = g.as_ref().unwrap();
    Ok(validate(v).into_iter().map(|i| Saude {
        note: i.note, line: i.line, code: i.code, msg: i.msg,
        severity: match i.severity { Severity::Error => "erro", Severity::Warning => "aviso", Severity::Info => "info" },
    }).collect())
}

#[derive(Serialize)]
struct Back { name: String, path: String, rel: String, line: usize }
#[derive(Serialize)]
struct Info { issues: Vec<Aviso>, backlinks: Vec<Back>, tipo: Option<String>, required: Vec<String>, status: Vec<String> }

/// Lê o vault do disco (a nota já deve estar salva) e devolve avisos do `vault_core`,
/// notas que apontam para ela e os campos obrigatórios do seu `tipo`.
#[tauri::command]
fn note_info(app: State<App>, path: String) -> Result<Info, String> {
    use vault_core::validate::{required_fields, validate_note, Severity, STATUS};
    let p = inside(&app, &path)?;
    let name = p.file_stem().unwrap().to_string_lossy().to_string();
    load(&app)?;
    let g = lock(&app.vault);
    let v = g.as_ref().unwrap();
    let issues = validate_note(v, &name).into_iter().map(|i| Aviso {
        line: i.line, code: i.code, msg: i.msg,
        severity: match i.severity { Severity::Error => "erro", Severity::Warning => "aviso", Severity::Info => "info" },
    }).collect();
    let mut backlinks = vec![];
    for n in v.notes.iter().filter(|n| n.name != name) {
        let Some(l) = n.links.iter().find(|l| !l.target.is_empty() && v.resolve(&l.target).is_some_and(|d| d.name == name)) else { continue };
        backlinks.push(Back {
            name: n.name.clone(), path: slash(&n.path),
            rel: n.path.strip_prefix(&app.root()).unwrap_or(&n.path).to_string_lossy().replace('\\', "/"),
            line: vault_core::links::line_of(&n.text, l.offset),
        });
    }
    let note = v.notes.iter().find(|n| n.name == name);
    let tipo = note.and_then(|n| n.tipo()).map(String::from);
    let required = tipo.as_deref().and_then(required_fields).map(|r| r.iter().map(|s| s.to_string()).collect()).unwrap_or_default();
    Ok(Info { issues, backlinks, tipo, required, status: STATUS.iter().map(|s| s.to_string()).collect() })
}

// ---------- busca no texto e embeds ----------

/// Minúsculas sem acento, para comparar texto em português.
fn fold(s: &str) -> String {
    s.chars().flat_map(|c| c.to_lowercase()).map(|c| match c {
        'á' | 'à' | 'â' | 'ã' | 'ä' => 'a', 'é' | 'è' | 'ê' | 'ë' => 'e', 'í' | 'ì' | 'î' | 'ï' => 'i',
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o', 'ú' | 'ù' | 'û' | 'ü' => 'u', 'ç' => 'c', c => c,
    }).collect()
}

#[derive(Serialize)]
struct Hit { name: String, path: String, rel: String, line: usize, snippet: String, count: usize }

/// Busca no conteúdo das notas (todas as palavras, sem acento nem maiúsculas). Mais ocorrências primeiro.
#[tauri::command]
fn search_text(app: State<App>, query: String, limit: Option<usize>) -> Result<Vec<Hit>, String> {
    let terms: Vec<String> = fold(&query).split_whitespace().map(String::from).collect();
    if terms.is_empty() { return Ok(vec![]); }
    load(&app)?;
    let g = lock(&app.vault);
    let mut hits = vec![];
    for n in &g.as_ref().unwrap().notes {
        let low = fold(&n.text);
        if !terms.iter().all(|t| low.contains(t.as_str())) { continue; }
        let count = terms.iter().map(|t| low.matches(t.as_str()).count()).sum();
        let lines: Vec<&str> = n.text.lines().collect();
        let best = lines.iter().enumerate().max_by_key(|(i, l)| {
            let f = fold(l); (terms.iter().filter(|t| f.contains(t.as_str())).count(), std::cmp::Reverse(*i))
        }).map(|(i, _)| i).unwrap_or(0);
        let snippet: String = lines.get(best).map(|l| l.trim()).unwrap_or("").chars().take(160).collect();
        hits.push(Hit {
            name: n.name.clone(), path: slash(&n.path),
            rel: n.path.strip_prefix(&app.root()).unwrap_or(&n.path).to_string_lossy().replace('\\', "/"),
            line: best + 1, snippet, count,
        });
    }
    hits.sort_by(|a, b| b.count.cmp(&a.count).then(a.name.cmp(&b.name)));
    hits.truncate(limit.unwrap_or(50));
    Ok(hits)
}

fn base64(b: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(b.len() * 4 / 3 + 4);
    for c in b.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        for i in 0..4 {
            if i <= c.len() { out.push(T[(n >> (18 - 6 * i) & 63) as usize] as char) } else { out.push('=') }
        }
    }
    out
}

fn find_file(dir: &Path, name: &str) -> Option<PathBuf> {
    for e in std::fs::read_dir(dir).ok()?.flatten() {
        let p = e.path();
        let fname = e.file_name().to_string_lossy().to_string();
        if fname.starts_with('.') { continue; }
        if p.is_dir() { if let Some(f) = find_file(&p, name) { return Some(f); } }
        else if fname.to_lowercase() == name { return Some(p); }
    }
    None
}

/// Trecho de uma nota: seção de um título (`#Título`) ou parágrafo de um bloco (`#^id`); sem âncora, o corpo todo.
fn section(body: &str, anchor: Option<&str>) -> String {
    let Some(a) = anchor.map(str::trim).filter(|a| !a.is_empty()) else { return body.to_string() };
    let lines: Vec<&str> = body.lines().collect();
    if let Some(id) = a.strip_prefix('^') {
        let Some(i) = lines.iter().position(|l| l.trim_end().ends_with(&format!("^{id}"))) else { return body.to_string() };
        let (mut s, mut e) = (i, i);
        while s > 0 && !lines[s - 1].trim().is_empty() { s -= 1; }
        while e + 1 < lines.len() && !lines[e + 1].trim().is_empty() { e += 1; }
        return lines[s..=e].join("\n").replace(&format!("^{id}"), "").trim_end().to_string();
    }
    let level = |l: &str| l.chars().take_while(|c| *c == '#').count();
    let Some(i) = lines.iter().position(|l| level(l) > 0 && l.trim_start_matches('#').trim().eq_ignore_ascii_case(a)) else { return body.to_string() };
    let lv = level(lines[i]);
    let end = lines[i + 1..].iter().position(|l| level(l) > 0 && level(l) <= lv).map_or(lines.len(), |k| i + 1 + k);
    lines[i..end].join("\n")
}

/// Conteúdo de `![[alvo]]`: imagem (caminho, ou data URL com `inline`), nota (texto sem frontmatter) ou arquivo de outro tipo.
#[tauri::command]
fn read_embed(app: State<App>, target: String, anchor: Option<String>, inline: Option<bool>) -> Result<Option<serde_json::Value>, String> {
    use serde_json::json;
    let last = target.rsplit('/').next().unwrap_or(&target).trim().to_string();
    if !last.contains('.') || last.to_lowercase().ends_with(".md") {
        load(&app)?;
        let g = lock(&app.vault);
        let Some(n) = g.as_ref().unwrap().resolve(&target) else { return Ok(None) };
        let text = section(n.body(), anchor.as_deref());
        let text: String = text.chars().take(20000).collect();
        return Ok(Some(json!({ "kind": "note", "name": n.name, "path": slash(&n.path), "text": text })));
    }
    let Some(f) = find_file(&root_of(&app)?, &last.to_lowercase()) else { return Ok(None) };
    let ext = f.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    let mime = match ext.as_str() { "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "gif" => "image/gif", "webp" => "image/webp", "svg" => "image/svg+xml", _ => "" };
    let name = f.file_name().unwrap().to_string_lossy().to_string();
    if mime.is_empty() || f.metadata().map_or(true, |m| m.len() > 12_000_000) { return Ok(Some(json!({ "kind": "file", "name": name }))); }
    // Padrão: só o caminho (a tela carrega pelo protocolo `asset:`, sem base64 pela ponte). `inline` pede o data URL (logo da prova, exportações).
    if !inline.unwrap_or(false) { return Ok(Some(json!({ "kind": "image", "name": name, "path": slash(&f) }))); }
    let data = std::fs::read(&f).map_err(|e| e.to_string())?;
    Ok(Some(json!({ "kind": "image", "name": name, "data": format!("data:{mime};base64,{}", base64(&data)) })))
}

fn config_path(h: &tauri::AppHandle) -> Result<PathBuf, String> {
    h.path().app_config_dir().map(|d| d.join("atalhos.json")).map_err(|e| e.to_string())
}

/// Atalhos personalizados, guardados em arquivo na pasta de configuração do app.
#[tauri::command]
fn read_config(h: tauri::AppHandle) -> Result<Option<String>, String> {
    let p = config_path(&h)?;
    if p.exists() { std::fs::read_to_string(p).map(Some).map_err(|e| e.to_string()) } else { Ok(None) }
}

#[tauri::command]
fn write_config(h: tauri::AppHandle, text: String) -> Result<(), String> {
    let p = config_path(&h)?;
    if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
    gravar_atomico(&p, &text)
}

/// Arquivo onde o app guarda a pasta do vault escolhida pelo usuário.
fn root_file(h: &tauri::AppHandle) -> Result<PathBuf, String> {
    h.path().app_config_dir().map(|d| d.join("vault.json")).map_err(|e| e.to_string())
}

/// Pasta guardada, mesmo que não exista mais (movida, apagada, disco/Drive desconectado): o app avisa em vez de esquecê-la.
fn saved_root(h: &tauri::AppHandle) -> Option<PathBuf> {
    let j: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(root_file(h).ok()?).ok()?).ok()?;
    Some(PathBuf::from(j.get("raiz")?.as_str()?))
}

/// Caminho do vault quando a pasta sumiu (`None` = tudo certo). Nunca recria a pasta: um Drive desconectado não pode virar uma pasta vazia.
#[tauri::command]
fn vault_ausente(app: State<App>) -> Option<String> {
    let r = app.root();
    if r.as_os_str().is_empty() || r.is_dir() { None } else { Some(slash(&r)) }
}

/// Pasta escolhida vazia (ignorando o que começa com `.`): monta a estrutura padrão. Só cria o que falta; nunca mexe no que existe.
fn criar_estrutura(root: &Path) -> std::io::Result<()> {
    let vazia = std::fs::read_dir(root)?.flatten().all(|e| e.file_name().to_string_lossy().starts_with('.'));
    if !vazia { return Ok(()); }
    let ano = 1970 + std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) / 31_556_952;
    let mut dirs: Vec<String> = ["_sistema", "Acervo/Aulas", "Acervo/Ciclos", "Acervo/Gramática", "Acervo/Textos", "Acervo/Questoes", "Acervo/Oficinas"].map(String::from).to_vec();
    dirs.extend(["Semanas", "Provas", "Correcoes", "Diarios", "Alunos", "Relatorios"].map(|d| format!("Anos/{ano}/{d}")));
    for d in dirs { std::fs::create_dir_all(root.join(d))?; }
    Ok(())
}

/// Pasta do vault em uso (`None` = ainda não escolhida).
#[tauri::command]
fn get_vault_root(app: State<App>) -> Option<String> {
    let r = app.root();
    if r.as_os_str().is_empty() { None } else { Some(slash(&r)) }
}

/// O protocolo `asset:` só serve arquivos da pasta do vault (escopo dinâmico; o `tauri.conf.json` começa com escopo vazio).
fn liberar_imagens(h: &tauri::AppHandle, root: &Path) {
    if !root.as_os_str().is_empty() { let _ = h.asset_protocol_scope().allow_directory(root, true); }
}

/// Guarda a pasta escolhida e passa a usá-la.
#[tauri::command]
fn set_vault_root(h: tauri::AppHandle, app: State<App>, path: String) -> Result<String, String> {
    let p = canon(Path::new(&path)).map_err(|e| format!("{path}: {e}"))?;
    if !p.is_dir() { return Err("não é uma pasta".into()); }
    criar_estrutura(&p).map_err(|e| format!("não montou a estrutura: {e}"))?;
    let f = root_file(&h)?;
    if let Some(d) = f.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
    std::fs::write(&f, serde_json::json!({ "raiz": p.to_string_lossy() }).to_string()).map_err(|e| e.to_string())?;
    *lock(&app.root_cell) = p.clone();
    *lock(&app.vault) = None;
    liberar_imagens(&h, &p);
    Ok(slash(&p))
}

fn main() {
    // Ordem: VAULT_ROOT (desenvolvimento) → pasta salva → (só em debug) vault de teste → nenhuma (o app pede).
    let env_root = std::env::var("VAULT_ROOT").map(PathBuf::from).ok();
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![list_notes, read_note, save_note, resolve_link, read_config, write_config, create_note, create_folder, rename_entry, move_entry, delete_entry, list_dirs, vault_ausente, note_info, search_text, read_embed, read_sidecar, save_attachment, vault_health, list_history, read_version, restore_version, get_vault_root, set_vault_root, agendar_reabertura]);
    builder
        .setup(move |app| {
            let root = env_root.clone().or_else(|| saved_root(app.handle())).unwrap_or_else(|| {
                if cfg!(debug_assertions) { PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../../tests/fixtures/ficticio")) } else { PathBuf::new() }
            });
            liberar_imagens(app.handle(), &root);
            app.manage(App::new(root));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn estrutura_so_em_pasta_vazia() {
        let d = std::env::temp_dir().join(format!("margem-estrutura-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join(".historico")).unwrap();
        criar_estrutura(&d).unwrap();
        assert!(d.join("Acervo/Aulas").is_dir() && d.join("_sistema").is_dir());
        // pasta com conteúdo: não cria nada novo
        std::fs::remove_dir_all(d.join("Acervo/Oficinas")).unwrap();
        criar_estrutura(&d).unwrap();
        assert!(!d.join("Acervo/Oficinas").exists());
        std::fs::remove_dir_all(&d).unwrap();
    }

    #[test]
    fn pasta_destino_cria_pastas_que_faltam_so_dentro_do_vault() {
        let d = std::env::temp_dir().join(format!("margem-destino-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        let root = canon(&d).unwrap();
        let r = root.to_string_lossy().to_string();
        // a própria raiz vale como destino (vault vazio)
        assert_eq!(pasta_destino_em(&root, &r).unwrap(), root);
        assert_eq!(pasta_destino_em(&root, "").unwrap(), root);
        // pasta que não existe ainda é criada
        let novo = pasta_destino_em(&root, &format!("{r}/Anos/2026/Semanas")).unwrap();
        assert!(novo.is_dir() && novo.ends_with("Anos/2026/Semanas"));
        // fora do vault, oculta ou com `..`: recusa e não cria
        assert!(pasta_destino_em(&root, "/tmp/margem-fora-do-vault/x").is_err());
        assert!(pasta_destino_em(&root, &format!("{r}/.oculta/x")).is_err());
        assert!(pasta_destino_em(&root, &format!("{r}/Anos/../../x")).is_err());
        assert!(!root.join(".oculta").exists());
        std::fs::remove_dir_all(&d).unwrap();
    }

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

    fn copiar_pasta(de: &Path, para: &Path) {
        std::fs::create_dir_all(para).unwrap();
        for e in std::fs::read_dir(de).unwrap() {
            let e = e.unwrap();
            let dest = para.join(e.file_name());
            if e.file_type().unwrap().is_dir() { copiar_pasta(&e.path(), &dest); } else { std::fs::copy(e.path(), dest).unwrap(); }
        }
    }

    #[test]
    fn anexo_e_sidecar_so_dentro_do_vault_e_com_extensao_certa() {
        let d = std::env::temp_dir().join(format!("vault-anexo-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join("_sistema/anexos")).unwrap();
        std::fs::write(d.join("_sistema/_dados.json"), "{}").unwrap();
        std::fs::write(d.join("_sistema/x.txt"), "x").unwrap();
        let sub = d.join("_sistema").to_string_lossy().to_string();
        assert!(inside_ext(&d, &format!("{sub}/_dados.json"), &["json"]).is_ok());
        assert!(inside_ext(&d, &format!("{sub}/x.txt"), &["json"]).is_err());
        assert!(inside_ext(&d, "/etc/passwd", &["json"]).is_err());
        let _ = std::fs::remove_dir_all(&d);
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
    fn base64_e_secao() {
        assert_eq!(base64(b"Man"), "TWFu");
        assert_eq!(base64(b"Ma"), "TWE=");
        assert_eq!(base64(b"M"), "TQ==");
        assert_eq!(fold("Ação Árvore"), "acao arvore");
        let t = "# A\nx\n## B\ny\n## C\nw\n\nz\nbloco ^id1\n";
        assert_eq!(section(t, Some("b")), "## B\ny");
        assert_eq!(section(t, Some("^id1")), "z\nbloco");
    }

    fn tmpdir(n: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("margem-{n}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

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
