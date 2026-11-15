use std::path::{Path, PathBuf};

use vault_core::frontmatter;
use vault_core::links::extract_links;
use vault_core::tables::{find_tables, replace_cell};
use vault_core::validate::{validate, validate_note, Severity};
use vault_core::vault::{Note, Vault};

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/mini")
}

fn read(rel: &str) -> String {
    std::fs::read_to_string(fixtures().join(rel)).unwrap()
}

#[test]
fn edicao_de_celula_altera_so_a_celula() {
    let text = read("Correcoes/72-Narrativa-Marco.md");
    let tables = find_tables(&text);
    // tabela 0 = Aluno 01; linha 1 = Pontuação; coluna 1 = nota
    let cell = &tables[0].rows[1][1];
    assert_eq!(cell.text, "1");
    let novo = replace_cell(&text, cell, "1,5");
    let (a, b) = cell.raw;
    assert_eq!(&novo[..a], &text[..a]);
    assert_eq!(&novo[a + 1 + 3..], &text[a + 1 + 1..]); // "1" virou "1,5"; o resto é idêntico
    let _ = b;
    assert_eq!(novo.len() as isize - text.len() as isize, 2);
    assert!(novo.contains("| Pontuação | 1,5 | faltou vírgula |"));
}

#[test]
fn celula_vazia_recebe_texto_com_espacos() {
    let text = "| a | b |\n|---|---|\n| x |  |\n";
    let t = &find_tables(text)[0];
    let novo = replace_cell(text, &t.rows[0][1], "ok");
    assert_eq!(novo, "| a | b |\n|---|---|\n| x | ok |\n");
}

#[test]
fn passo_a_passo_nao_mexe_no_resto_do_arquivo() {
    let text = read("Correcoes/72-Narrativa-Marco.md");
    let tables = find_tables(&text);
    let cell = &tables[1].rows[0][2];
    let novo = replace_cell(&text, cell, cell.text.as_str()); // mesmo valor
    assert_eq!(novo, text);
}

#[test]
fn frontmatter_com_dois_pontos_sem_aspas_e_detectado() {
    let n = Note::parse("x.md".into(), "---\ntipo: texto\nfonte: FULANO, A. Obra. São Paulo: Ed. X, 2020.\n---\n".into());
    assert!(n.frontmatter_error.is_some());
}

#[test]
fn links_ignoram_codigo_e_entendem_alias_ancora_embed() {
    let l = extract_links("[[a#^q1|texto]] `[[nao]]` ![[img.png]]\n```\n[[nao2]]\n```\n");
    assert_eq!(l.len(), 2);
    assert_eq!(l[0].target, "a");
    assert_eq!(l[0].anchor.as_deref(), Some("^q1"));
    assert_eq!(l[0].alias.as_deref(), Some("texto"));
    assert!(l[1].embed);
}

#[test]
fn split_preserva_posicao_do_corpo() {
    let t = "---\na: 1\n---\n# T\n";
    let s = frontmatter::split(t);
    assert_eq!(&t[s.body_start..], "# T\n");
}

#[test]
fn vault_ficticio_gera_os_problemas_esperados() {
    let v = Vault::open(&fixtures()).unwrap();
    let issues = validate(&v);
    let codes: Vec<_> = issues.iter().map(|i| (i.note.as_str(), i.code)).collect();
    for esperado in [
        ("611-Diario-Verbos", "sem-recuperacao"),
        ("72-Narrativa-Marco", "marca-pendente"),
        ("72-Narrativa-Marco", "total-diverge"),
    ] {
        assert!(codes.contains(&esperado), "faltou {esperado:?} em {codes:?}");
    }
    // habilidades e âncoras de bloco resolvem
    assert!(!codes.iter().any(|(_, c)| *c == "ancora-quebrada"));
    // nada de erro de yaml no vault de teste
    assert!(!issues.iter().any(|i| i.code == "yaml"), "{issues:?}");
    assert!(issues.iter().any(|i| i.severity == Severity::Error));
}

#[test]
fn ciclo_sem_datas_aponta_aula_sem_recurso_e_fim_na_prova() {
    let dir = std::env::temp_dir().join(format!("vault-test-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(
        dir.join("c.md"),
        "---\ntipo: ciclo\nano: 7\ntrimestre: 2\nciclo: 3\n---\n## Aulas\n\n| # | Conteúdo | Recurso |\n| --- | --- | --- |\n| 1 | **Crase**. |  |\n| 2 | 🔻 Exercícios. |  |\n| 3 | 🔥 Prova |  |\n",
    )
    .unwrap();
    let issues = validate(&Vault::open(&dir).unwrap());
    let codes: Vec<_> = issues.iter().map(|i| i.code).collect();
    assert_eq!(codes.iter().filter(|c| **c == "aula-sem-recurso").count(), 1, "{codes:?}");
    assert!(codes.contains(&"sem-recuperacao"), "{codes:?}");
    assert!(!codes.contains(&"data-invalida"));
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn migracao_converte_frontmatter_antigo_sem_tocar_no_corpo() {
    use vault_core::migrate::migrate;
    let antigo = "---\ntype: class\nyear:\n  - \"6\"\nperiod:\n  - \"63\"\nsubject: [verbos]\ntags: []\nstatus: Não iniciado\n---\n## Corpo\n\n| a | b |\n";
    let m = migrate(antigo).unwrap();
    assert_eq!(m.text, "---\ntipo: aula\nano: 6\nassuntos: [verbos]\ntags: []\nstatus: pendente\n---\n## Corpo\n\n| a | b |\n");
    // idempotente
    assert!(migrate(&m.text).unwrap().changes.is_empty());

    let plano = migrate("---\ntype: plan\nyear:\n  - \"6\"\nperiod:\n  - \"2\"\n---\n").unwrap();
    assert!(plano.text.contains("trimestre: 2") && plano.text.contains("ano: 6"));

    // plano cujo nome é "ATC - Título" é ciclo: trimestre e ciclo saem do nome
    use vault_core::migrate::migrate_named;
    let ciclo = migrate_named("631 - Poema - PR", "---\ntype: plan\nyear:\n  - \"6\"\nperiod:\n  - \"3\"\n---\n## Aulas\n").unwrap();
    assert_eq!(ciclo.text, "---\ntipo: ciclo\nano: 6\ntrimestre: 3\nciclo: 1\n---\n## Aulas\n");
    assert!(ciclo.manual.is_empty());
    assert!(migrate_named("631 - Poema - PR", &ciclo.text).unwrap().changes.is_empty());
    let nao = migrate_named("Planejamento", "---\ntype: plan\nyear: [\"6\"]\nperiod: [\"2\"]\n---\n").unwrap();
    assert!(nao.text.contains("tipo: plano"));

    let corr = migrate("---\ntype: correção\nturma: 81\nmês: Setembro\nstatus: transcrição aprovada\narquivado: 2026-10-15\n---\n").unwrap();
    assert!(corr.text.contains("turma: \"81\"") && corr.text.contains("mes: Setembro"));
    assert!(corr.text.contains("status: andamento\ntranscricao: aprovada") && corr.text.contains("arquivado_em:"));

    let texto = migrate("---\ntitle: T\nauthor: A\nano: 1964\nfoco: []\nconteudos: []\nalertas: []\n---\n").unwrap();
    assert!(texto.text.starts_with("---\ntipo: texto\ntitulo: T\nautor: A\npublicacao: 1964\n"));

    let manual = migrate("---\ntype: ficha\n---\n").unwrap();
    assert!(manual.text.contains("tipo: ficha") && !manual.manual.is_empty());
}

#[test]
fn valores_fora_do_vocabulario_sao_erros() {
    let dir = std::env::temp_dir().join(format!("vault-val-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("a.md"), "---\ntipo: aula\nano: 10\nturmas: [61]\nstatus: Em andamento\n---\n").unwrap();
    let codes = validate(&Vault::open(&dir).unwrap()).iter().filter(|i| i.code == "valor-invalido").count();
    assert_eq!(codes, 3);
    std::fs::remove_dir_all(dir).ok();
}

fn copia_do_modelo(nome: &str) -> PathBuf {
    let dst = std::env::temp_dir().join(format!("{nome}-{}", std::process::id()));
    std::fs::remove_dir_all(&dst).ok();
    fn cp(a: &Path, b: &Path) {
        std::fs::create_dir_all(b).unwrap();
        for e in std::fs::read_dir(a).unwrap() {
            let p = e.unwrap().path();
            let t = b.join(p.file_name().unwrap());
            if p.is_dir() { cp(&p, &t) } else { std::fs::copy(&p, &t).unwrap(); }
        }
    }
    cp(&Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/modelo"), &dst);
    dst
}

#[test]
fn modelo_migra_sem_erro_e_e_idempotente() {
    use vault_core::migrate::migrate_named;
    let dir = copia_do_modelo("modelo-mig");
    let v = Vault::open(&dir).unwrap();
    for n in &v.notes {
        let m = migrate_named(&n.name, &n.text).unwrap_or_else(|e| panic!("{}: {e}", n.name));
        // segunda passada não muda mais nada
        let m2 = migrate_named(&n.name, &m.text).unwrap();
        assert!(m2.changes.is_empty(), "{} não é idempotente: {:?}", n.name, m2.changes);
        // o corpo é idêntico
        let b1 = &n.text[n.body_start..];
        let sp = frontmatter::split(&m.text);
        assert_eq!(b1, &m.text[sp.body_start..], "{}", n.name);
        std::fs::write(&n.path, &m.text).unwrap();
    }
    // depois de migrado: YAML válido e valores dentro dos vocabulários
    let issues = validate(&Vault::open(&dir).unwrap());
    let ruins: Vec<_> = issues.iter().filter(|i| matches!(i.code, "yaml" | "valor-invalido")).collect();
    assert!(ruins.is_empty(), "{ruins:?}");
    // os casos de decisão manual continuam sinalizados
    for esperado in ["tipo-desconhecido", "sem-tipo", "campo-vazio", "marca-pendente"] {
        assert!(issues.iter().any(|i| i.code == esperado), "faltou {esperado}");
    }
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn modelo_textos_e_planos_viram_o_formato_novo() {
    use vault_core::migrate::migrate;
    let dir = copia_do_modelo("modelo-fmt");
    let v = Vault::open(&dir).unwrap();
    let tintim = v.resolve("verissimo-tintim").unwrap();
    let m = migrate(&tintim.text).unwrap();
    assert!(m.text.starts_with("---\ntipo: texto\ntitulo: Tintim\nautor: Luis Fernando Verissimo\n"));
    assert!(m.text.contains("publicacao:"));
    let plano = migrate(&v.resolve("621 - Variação linguística e preconceito linguístico - TG").unwrap().text).unwrap();
    assert!(plano.text.contains("tipo: plano\n") && plano.text.contains("ano: 6\ntrimestre: 2\n"));
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn banco_e_codigos_ganham_frontmatter() {
    use vault_core::migrate::migrate_named;
    let dir = copia_do_modelo("modelo-banco");
    let v = Vault::open(&dir).unwrap();
    let b = v.resolve("banco-questoes-poema-sujeito-predicado-6ano").unwrap();
    let m = migrate_named(&b.name, &b.text).unwrap();
    assert!(m.text.starts_with("---\ntipo: banco\nano: 6\nconteudos: []\nconteudos_excluidos: []\ntextos: [\"[[meireles-os-pescadores-e-suas-filhas]]\", \"[[meireles-as-meninas]]\"]\n---\n# Banco de questões"), "{}", &m.text[..200]);
    assert!(m.text.ends_with(&b.text));
    let c = v.resolve("_codigos").unwrap();
    assert!(migrate_named("_codigos", &c.text).unwrap().text.starts_with("---\ntipo: taxonomia\n---\n# Códigos"));
    std::fs::remove_dir_all(dir).ok();
}

fn escreve(dir: &Path, rel: &str, txt: &str) {
    let p = dir.join(rel);
    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
    std::fs::write(p, txt).unwrap();
}

#[test]
fn reorganizar_move_reescreve_links_e_e_idempotente() {
    use vault_core::reorganizar::{apply, plan};
    let dir = std::env::temp_dir().join(format!("reorg-{}", std::process::id()));
    std::fs::remove_dir_all(&dir).ok();
    escreve(&dir, "Aulas/Sintaxe/Tipos de sujeito.md", "---\ntipo: aula\n---\nx\n");
    escreve(&dir, "Aulas/Verbos/Imperativo.md", "[[Escola/Aulas/Sintaxe/Tipos de sujeito\\]] e [[Aulas/Sintaxe/Tipos de sujeito#^q1|ver]] ![[Recursos/imagens/foto.png]] [[Nome simples]]\n");
    escreve(&dir, "Recursos/imagens/foto.png", "png");
    escreve(&dir, "Recursos/textos/t.md", "texto");
    escreve(&dir, "Recursos/_codigos.md", "c");
    escreve(&dir, "Questões/b.md", "b");
    escreve(&dir, "Bancos/b2.md", "b2");
    escreve(&dir, "Correções/81 - Setembro - Poção/Transcrições.md", "tr");
    escreve(&dir, "Correções/_fichas/Ficha.md", "f");
    escreve(&dir, "_sistema/notas/solta.md", "solta");
    escreve(&dir, "Planejamentos/611.md", "p");
    escreve(&dir, "Planejamentos/_bncc/bncc.md", "bncc");
    escreve(&dir, "_templates/t.md", "tpl");
    escreve(&dir, "Relatórios/r.md", "r");
    escreve(&dir, ".obsidian/app.json", "{}");
    escreve(&dir, "Aulas.base", "base");

    let p = plan(&dir, "2026", "Escola").unwrap();
    assert_eq!(p.links_reescritos, 3);
    apply(&dir, &p).unwrap();

    for novo in [
        "Acervo/Aulas/Sintaxe/Tipos de sujeito.md",
        "Acervo/Textos/imagens/foto.png",
        "Acervo/Textos/t.md",
        "_sistema/_codigos.md",
        "Acervo/Questoes/b.md",
        "Acervo/Questoes/b2.md",
        "Anos/2026/Correcoes/81 - Setembro - Poção/Transcrições.md",
        "_sistema/fichas/Ficha.md",
        "Anos/2026/Planejamento/611.md",
        "_sistema/bncc/bncc.md",
        "_sistema/templates/t.md",
        "Anos/2026/Relatorios/r.md",
        ".obsidian/app.json",
        "_sistema/notas/solta.md",
        "_sistema/bases/Aulas.base",
    ] {
        assert!(dir.join(novo).exists(), "faltou {novo}");
    }
    assert!(!dir.join("Aulas").exists() && !dir.join("Questões").exists());
    let imp = std::fs::read_to_string(dir.join("Acervo/Aulas/Verbos/Imperativo.md")).unwrap();
    assert_eq!(imp, "[[Tipos de sujeito\\]] e [[Tipos de sujeito#^q1|ver]] ![[foto.png]] [[Nome simples]]\n");

    // segunda execução: nada a fazer, e o validador resolve os links
    let p2 = plan(&dir, "2026", "Escola").unwrap();
    assert!(p2.moves.is_empty() && p2.links_reescritos == 0);
    let v = Vault::open(&dir).unwrap();
    assert!(v.resolve("Tipos de sujeito").is_some() && v.has_attachment("foto.png"));
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn reorganizar_nao_move_colisoes() {
    use vault_core::reorganizar::plan;
    let dir = std::env::temp_dir().join(format!("reorg-col-{}", std::process::id()));
    std::fs::remove_dir_all(&dir).ok();
    escreve(&dir, "Questões/mesmo.md", "a");
    escreve(&dir, "Bancos/mesmo.md", "b");
    let p = plan(&dir, "2026", "Escola").unwrap();
    assert_eq!(p.colisoes.len(), 1);
    assert!(p.moves.is_empty());
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn professor_vira_margem() {
    use vault_core::migrate::professor_para_margem;
    let t = "> [!tip] Dica para o professor: **6º ano:** foque no básico.\n> mais uma linha\n\n> [!tip] Para o professor\n> texto\n\n> [!tip] Dica\n> geral\n\n```\n> [!tip] Dica para o professor: no código\n```\n";
    let (n, c) = professor_para_margem(t);
    assert_eq!(c, 2);
    assert!(n.starts_with("> [!margem] **6º ano:** foque no básico.\n> mais uma linha"));
    assert!(n.contains("\n> [!margem]\n> texto"));
    assert!(n.contains("> [!tip] Dica\n> geral"));
    assert!(n.contains("```\n> [!tip] Dica para o professor: no código"));
    assert_eq!(professor_para_margem(&n).1, 0);
}

#[test]
fn ciclos_viram_atemporais_com_planejamento_do_ano_e_links_reescritos() {
    use vault_core::{atemporais, reorganizar};
    let dir = std::env::temp_dir().join(format!("vault-atemp-{}", std::process::id()));
    escreve(&dir, "Anos/2026/Planejamento/723 - Crase - PR.md", "---\ntipo: ciclo\nano: 7\ntrimestre: 2\nciclo: 3\n---\n## Aulas\n");
    escreve(&dir, "Anos/2026/Planejamento/831 - PT.md", "---\ntipo: ciclo\nano: 8\ntrimestre: 3\nciclo: 1\n---\n");
    escreve(&dir, "Anos/2026/Semanas/S.md", "Ciclo: [[723 - Crase - PR]] e [[723 - Crase - PR|Crase]] 4");
    let r = atemporais::plan(&dir).unwrap();
    assert_eq!(r.renomeados.len(), 2);
    reorganizar::apply(&dir, &r.plan).unwrap();
    let crase = std::fs::read_to_string(dir.join("Acervo/Ciclos/Crase.md")).unwrap();
    assert_eq!(crase, "---\ntipo: ciclo\nsufixo: PR\n---\n## Aulas\n");
    assert!(dir.join("Acervo/Ciclos/Ciclo 831.md").exists());
    let sem = std::fs::read_to_string(dir.join("Anos/2026/Semanas/S.md")).unwrap();
    assert_eq!(sem, "Ciclo: [[Crase]] e [[Crase|Crase]] 4");
    let plan = std::fs::read_to_string(dir.join("Anos/2026/Planejamento 2026.md")).unwrap();
    assert!(plan.contains("ano_letivo: 2026") && plan.contains("| 7 | 2 | 3 | [[Crase]] |") && plan.contains("| 8 | 3 | 1 | [[Ciclo 831]] |"), "{plan}");
    // idempotente: nada mais a mover
    assert!(atemporais::plan(&dir).unwrap().renomeados.is_empty());
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn tabela_com_linha_mais_curta_que_o_cabecalho_nao_derruba_o_validador() {
    // Acontece naturalmente enquanto se digita uma linha nova numa tabela.
    let dir = std::env::temp_dir().join(format!("vault-curta-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("c.md"), "---\ntipo: ciclo\nano: 7\n---\n| # | Conteúdo | Recurso |\n| --- | --- | --- |\n| 1 | Crase | x |\n|\n| 2 |\n| 3 | Prova |\n").unwrap();
    std::fs::write(dir.join("rubrica.md"), "---\ntipo: rubrica\n---\n| Critério | Máximo | Passo |\n| --- | --- | --- |\n| Ortografia | 2 | 0,5 |\n| Coesão |\n|\n").unwrap();
    std::fs::write(dir.join("r.md"), "---\ntipo: correcao\nrubrica: \"[[rubrica]]\"\ntranscricao: aprovada\n---\n[[rubrica]]\n\n| Critério | Nota | Obs |\n| --- | --- | --- |\n| Pontuação |\n|\n| Ortografia | 1 |\n| Total | 1 |\n").unwrap();
    let _ = validate(&Vault::open(&dir).unwrap()); // não pode dar pânico
    let _ = std::fs::remove_dir_all(&dir);
}

fn tmp_vault(nome: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("vault-{nome}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

#[test]
fn arquivo_fora_de_utf8_e_pulado_e_avisado_sem_impedir_o_vault() {
    let d = tmp_vault("latin1");
    std::fs::write(d.join("boa.md"), "---\ntipo: ciclo\nano: 7\n---\n").unwrap();
    std::fs::write(d.join("antiga.md"), b"Educa\xe7\xe3o em Latin-1").unwrap(); // "ção" em Latin-1: não é UTF-8
    let v = Vault::open(&d).expect("um arquivo ruim não pode impedir de abrir o vault");
    assert_eq!(v.notes.len(), 1);
    let issues = validate(&v);
    assert!(issues.iter().any(|i| i.code == "arquivo-ilegivel" && i.note == "antiga"), "{issues:?}");
    let _ = std::fs::remove_dir_all(&d);
}

#[test]
fn nomes_repetidos_em_pastas_diferentes_sao_avisados() {
    let d = tmp_vault("repetido");
    std::fs::create_dir_all(d.join("A")).unwrap();
    std::fs::create_dir_all(d.join("B")).unwrap();
    std::fs::write(d.join("A/X.md"), "---\ntipo: ciclo\nano: 7\n---\n").unwrap();
    std::fs::write(d.join("B/x.md"), "---\ntipo: ciclo\nano: 7\n---\n").unwrap();
    let issues = validate(&Vault::open(&d).unwrap());
    assert_eq!(issues.iter().filter(|i| i.code == "nome-repetido").count(), 2, "{issues:?}");
    let _ = std::fs::remove_dir_all(&d);
}

#[test]
fn bom_e_crlf_nao_escondem_o_frontmatter() {
    let n = Note::parse(PathBuf::from("n.md"), "\u{feff}---\r\ntipo: ciclo\r\nano: 7\r\n---\r\ncorpo\r\n".to_string());
    assert_eq!(n.tipo(), Some("ciclo"));
}

#[test]
fn celula_com_barra_vertical_e_escapada() {
    let text = "| a | b |\n|---|---|\n| x | y |\n";
    let t = &find_tables(text)[0];
    let novo = replace_cell(text, &t.rows[0][1], "um | dois");
    assert_eq!(novo, "| a | b |\n|---|---|\n| x | um \\| dois |\n");
    assert_eq!(find_tables(&novo)[0].rows[0].len(), 2); // continua com 2 células
}

#[test]
fn validate_note_so_devolve_a_nota_pedida() {
    let dir = std::env::temp_dir().join(format!("vc-valnota-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("a.md"), "sem tipo\n[[nada]]\n").unwrap();
    std::fs::write(dir.join("b.md"), "também sem tipo\n").unwrap();
    let v = Vault::open(&dir).unwrap();
    let so_a = validate_note(&v, "a");
    assert!(!so_a.is_empty() && so_a.iter().all(|i| i.note == "a"), "{so_a:?}");
    let todos: Vec<_> = validate(&v).into_iter().filter(|i| i.note == "a").map(|i| (i.line, i.code)).collect();
    assert_eq!(so_a.iter().map(|i| (i.line, i.code)).collect::<Vec<_>>(), todos);
    assert!(validate_note(&v, "inexistente").is_empty());
}
