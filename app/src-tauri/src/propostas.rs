//! Propostas: toda alteração vinda de IA (Etapa M) passa por aqui. O usuário vê o diff e aceita, aceita em parte ou
//! recusa; nada é gravado antes. Ficam só em memória (não vão para o disco).

use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use vault_core::historico::{agora, hist_dir, hist_ids, snapshot};
use crate::caminhos::*;
use crate::gravacao::*;
use crate::notas::nome_em_uso;
use crate::{lock, App};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct NovaNota { pub dir: String, pub nome: String }

#[derive(Serialize, Clone, Debug)]
pub struct Proposta {
    pub id: u64,
    /// Nota existente que a proposta altera (caminho com `/`); `None` quando é uma nota nova.
    pub nota: Option<String>,
    pub nova: Option<NovaNota>,
    /// Texto da nota (normalizado) no momento da proposta; vazio para nota nova.
    pub texto_base: String,
    pub texto_novo: String,
    pub resumo: String,
    pub criada_em: u64,
}

#[derive(Default)]
pub struct Propostas { lista: Mutex<Vec<Proposta>>, seq: AtomicU64 }

#[derive(Serialize, Debug)]
pub struct Aplicada {
    pub path: String,
    pub nova: bool,
    /// Versão do histórico com o texto de antes (para desfazer com `restore_version`); `None` em nota nova.
    pub versao: Option<String>,
}

/// Registra uma proposta. Valida o caminho (dentro do vault) e já normaliza o texto base.
pub(crate) fn registrar(app: &App, nota: Option<String>, nova: Option<NovaNota>, texto_base: &str, texto_novo: String, resumo: String) -> Result<Proposta, String> {
    let nota = match (&nota, &nova) {
        (Some(_), Some(_)) | (None, None) => return Err("a proposta é de uma nota existente ou de uma nota nova".into()),
        (Some(n), None) => Some(slash(&inside(app, n)?)),
        (None, Some(n)) => { valid_name(&n.nome)?; pasta_destino(app, &n.dir)?; None }
    };
    let p = Proposta {
        id: app.propostas.seq.fetch_add(1, Ordering::Relaxed) + 1, nota, nova,
        texto_base: normalizar(texto_base.to_string()), texto_novo: normalizar(texto_novo), resumo, criada_em: agora(),
    };
    lock(&app.propostas.lista).push(p.clone());
    Ok(p)
}

/// Como `registrar`, e avisa a interface (evento `proposta-nova`). É o que a Etapa M chama.
pub(crate) fn registrar_e_avisar(h: &AppHandle, app: &App, nota: Option<String>, nova: Option<NovaNota>, texto_base: &str, texto_novo: String, resumo: String) -> Result<Proposta, String> {
    let p = registrar(app, nota, nova, texto_base, texto_novo, resumo)?;
    let _ = h.emit("proposta-nova", &p);
    Ok(p)
}

pub(crate) fn descartar(app: &App, id: u64) -> bool {
    let mut l = lock(&app.propostas.lista);
    let antes = l.len();
    l.retain(|p| p.id != id);
    l.len() != antes
}

/// Nome que não colide com nenhuma nota (os links resolvem por nome): "Nome", "Nome 2", "Nome 3"...
fn nome_livre(app: &App, pasta: &Path, nome: &str) -> Result<String, String> {
    for k in 1..1000 {
        let n = if k == 1 { nome.to_string() } else { format!("{nome} {k}") };
        if !pasta.join(format!("{n}.md")).exists() && nome_em_uso(app, &n, None)?.is_none() { return Ok(n); }
    }
    Err("não achei um nome livre".into())
}

/// Grava o texto final escolhido pelo usuário. Nota existente: recusa com `conflito:` se o disco já não é a base da proposta;
/// guarda a versão anterior no histórico. Nota nova: nunca sobrescreve (nome único).
pub(crate) fn aplicar(app: &App, id: u64, texto_final: &str) -> Result<Aplicada, String> {
    let prop = lock(&app.propostas.lista).iter().find(|p| p.id == id).cloned().ok_or("proposta não encontrada (já aplicada ou descartada)")?;
    let r = if let Some(n) = &prop.nova { aplicar_nova(app, n, texto_final)? } else { aplicar_existente(app, &prop, texto_final)? };
    app.invalidar();
    descartar(app, id);
    Ok(r)
}

fn aplicar_existente(app: &App, prop: &Proposta, texto_final: &str) -> Result<Aplicada, String> {
    let path = prop.nota.as_deref().ok_or("proposta sem nota")?;
    let p = inside(app, path)?;
    let root = root_of(app)?;
    let disco = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    if normalizar(disco) != prop.texto_base { return Err("conflito: a nota mudou desde a proposta".into()); }
    if texto_final == prop.texto_base { return Err("nada a aplicar: o texto final é igual ao atual".into()); }
    // a proposta sempre guarda a versão de antes, sem o intervalo mínimo do autosave
    gravar_nota(&app.vistos, &p, texto_final, false, |_| { let _ = snapshot(&root, &p, true); })?;
    let versao = hist_dir(&root, &p).ok().and_then(|d| hist_ids(&d).first().map(|i| i.to_string()));
    Ok(Aplicada { path: slash(&p), nova: false, versao })
}

fn aplicar_nova(app: &App, n: &NovaNota, texto_final: &str) -> Result<Aplicada, String> {
    let nome = valid_name(&n.nome)?.trim_end_matches(".md").to_string();
    let d = pasta_destino(app, &n.dir)?;
    std::fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    let nome = nome_livre(app, &d, &nome)?;
    let p = d.join(format!("{nome}.md"));
    // create_new: nunca sobrescreve, nem numa corrida entre a checagem do nome e a escrita
    std::fs::OpenOptions::new().write(true).create_new(true).open(&p)
        .and_then(|mut f| { use std::io::Write; f.write_all(texto_final.as_bytes()) })
        .map_err(|e| if e.kind() == std::io::ErrorKind::AlreadyExists { format!("já existe: {nome}.md") } else { e.to_string() })?;
    lock(&app.vistos).insert(p.clone(), hash_texto(texto_final));
    Ok(Aplicada { path: slash(&p), nova: true, versao: None })
}

#[tauri::command]
pub fn listar_propostas(app: State<App>) -> Vec<Proposta> { lock(&app.propostas.lista).clone() }

#[tauri::command]
pub fn descartar_proposta(app: State<App>, id: u64) -> bool { descartar(&app, id) }

#[tauri::command]
pub fn aplicar_proposta(app: State<App>, id: u64, texto_final: String) -> Result<Aplicada, String> { aplicar(&app, id, &texto_final) }

/// Primeiro parágrafo de texto (depois do frontmatter e dos títulos) em maiúsculas; serve para testar o fluxo sem IA.
pub(crate) fn maiusculas_no_primeiro_paragrafo(t: &str) -> String {
    let mut linhas: Vec<String> = t.split('\n').map(String::from).collect();
    let mut i = 0;
    if linhas.first().is_some_and(|l| l.trim_end() == "---") {
        if let Some(fim) = linhas.iter().skip(1).position(|l| l.trim_end() == "---") { i = fim + 2; }
    }
    while i < linhas.len() && (linhas[i].trim().is_empty() || linhas[i].starts_with('#')) { i += 1; }
    while i < linhas.len() && !linhas[i].trim().is_empty() { linhas[i] = linhas[i].to_uppercase(); i += 1; }
    linhas.join("\n")
}

/// Só para desenvolvimento: propõe a mesma nota com o primeiro parágrafo em maiúsculas.
#[tauri::command]
pub fn propor_teste(h: AppHandle, app: State<App>, path: String) -> Result<Proposta, String> {
    if !cfg!(debug_assertions) { return Err("disponível só em desenvolvimento".into()); }
    let p = inside(&app, &path)?;
    let base = normalizar(std::fs::read_to_string(&p).map_err(|e| e.to_string())?);
    let novo = maiusculas_no_primeiro_paragrafo(&base);
    registrar_e_avisar(&h, &app, Some(slash(&p)), None, &base, novo, "Primeiro parágrafo em maiúsculas (teste)".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::teste_util::*;

    fn app_em(nome: &str) -> (App, std::path::PathBuf) {
        let d = tmpdir(nome);
        let root = canon(&d).unwrap();
        std::fs::create_dir_all(root.join("Acervo")).unwrap();
        (App::new(root.clone()), root)
    }

    #[test]
    fn maiusculas_pula_frontmatter_e_titulo() {
        let t = "---\ntipo: aula\n---\n# Título\n\nprimeiro parágrafo\nsegunda linha\n\noutro";
        assert_eq!(maiusculas_no_primeiro_paragrafo(t), "---\ntipo: aula\n---\n# Título\n\nPRIMEIRO PARÁGRAFO\nSEGUNDA LINHA\n\noutro");
    }

    #[test]
    fn aplica_em_nota_existente_com_historico_e_desfaz() {
        let (app, root) = app_em("prop-aplica");
        let p = root.join("Acervo/A.md");
        std::fs::write(&p, "# A\n\ntexto\n").unwrap();
        let prop = registrar(&app, Some(slash(&p)), None, "# A\n\ntexto\n", "# A\n\nTEXTO\n".into(), "teste".into()).unwrap();
        assert_eq!(lock(&app.propostas.lista).len(), 1);
        let r = aplicar(&app, prop.id, "# A\n\nTEXTO\n").unwrap();
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "# A\n\nTEXTO\n");
        assert!(!r.nova && lock(&app.propostas.lista).is_empty());
        // a versão de antes está no histórico e traz o texto original
        let id = r.versao.expect("versão do histórico");
        let d = hist_dir(&root, &p).unwrap();
        assert_eq!(std::fs::read_to_string(d.join(format!("{id}.md"))).unwrap(), "# A\n\ntexto\n");
        // proposta já aplicada não se aplica duas vezes
        assert!(aplicar(&app, prop.id, "x").is_err());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn recusa_quando_o_disco_divergiu_da_base() {
        let (app, root) = app_em("prop-conflito");
        let p = root.join("Acervo/A.md");
        std::fs::write(&p, "original").unwrap();
        let prop = registrar(&app, Some(slash(&p)), None, "original", "proposto".into(), "".into()).unwrap();
        std::fs::write(&p, "mudou por fora").unwrap();
        let e = aplicar(&app, prop.id, "proposto").unwrap_err();
        assert!(e.starts_with("conflito:"), "{e}");
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "mudou por fora");
        assert_eq!(lock(&app.propostas.lista).len(), 1, "a proposta continua pendente");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn nao_sai_do_vault() {
        let (app, root) = app_em("prop-fora");
        let fora = root.parent().unwrap().join(format!("fora-{}.md", std::process::id()));
        std::fs::write(&fora, "x").unwrap();
        assert!(registrar(&app, Some(slash(&fora)), None, "x", "y".into(), "".into()).is_err());
        assert!(registrar(&app, None, Some(NovaNota { dir: slash(root.parent().unwrap()), nome: "N".into() }), "", "y".into(), "".into()).is_err());
        assert!(registrar(&app, None, Some(NovaNota { dir: slash(&root.join("Acervo")), nome: "../N".into() }), "", "y".into(), "".into()).is_err());
        assert!(registrar(&app, None, None, "", "y".into(), "".into()).is_err(), "sem nota nem nome");
        let _ = std::fs::remove_file(&fora);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn nota_nova_nao_sobrescreve_nome_existente() {
        let (app, root) = app_em("prop-nova");
        std::fs::write(root.join("Acervo/Crase.md"), "# Crase\n").unwrap();
        let dir = slash(&root.join("Acervo"));
        let prop = registrar(&app, None, Some(NovaNota { dir: dir.clone(), nome: "Crase".into() }), "", "# Crase\n\nnova\n".into(), "".into()).unwrap();
        let r = aplicar(&app, prop.id, "# Crase\n\nnova\n").unwrap();
        assert!(r.nova && r.path.ends_with("Acervo/Crase 2.md"), "{}", r.path);
        assert_eq!(std::fs::read_to_string(root.join("Acervo/Crase.md")).unwrap(), "# Crase\n", "a nota existente fica intacta");
        assert_eq!(std::fs::read_to_string(root.join("Acervo/Crase 2.md")).unwrap(), "# Crase\n\nnova\n");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn descartar_remove_sem_gravar() {
        let (app, root) = app_em("prop-descarta");
        let p = root.join("Acervo/A.md");
        std::fs::write(&p, "a").unwrap();
        let prop = registrar(&app, Some(slash(&p)), None, "a", "b".into(), "".into()).unwrap();
        assert!(descartar(&app, prop.id) && !descartar(&app, prop.id));
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "a");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn texto_final_igual_ao_atual_nao_grava() {
        let (app, root) = app_em("prop-igual");
        let p = root.join("Acervo/A.md");
        std::fs::write(&p, "a").unwrap();
        let prop = registrar(&app, Some(slash(&p)), None, "a", "b".into(), "".into()).unwrap();
        assert!(aplicar(&app, prop.id, "a").unwrap_err().starts_with("nada a aplicar"));
        let _ = std::fs::remove_dir_all(&root);
    }
}

/// Quantas propostas estão pendentes (usado pelos testes da IA).
#[cfg(test)]
pub(crate) fn pendentes(app: &App) -> usize { lock(&app.propostas.lista).len() }
