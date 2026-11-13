use std::path::PathBuf;

use vault_core::migrate::migrate_named;
use vault_core::{historico, reorganizar};
use std::process::ExitCode;

use vault_core::tables::{find_tables, replace_cell};
use vault_core::validate::{validate, Severity};
use vault_core::vault::Vault;

fn usage() -> ExitCode {
    eprintln!("uso:\n  vault validate <pasta>\n  vault reorganizar <pasta> [--ano 2026] [--raiz Escola] [--aplicar] [--detalhes]\n  vault migrar <pasta> [--aplicar]   (sem --aplicar só mostra o que mudaria)\n  vault margem <pasta> [--aplicar]   (aulas: [!tip] Dica para o professor vira [!margem]; sem --aplicar só mostra)\n  vault edit-cell <arquivo> <tabela> <linha> <coluna> <texto>   (índices a partir de 0)\n  vault historico <pasta> [--dias 30] [--limpar]   (históricos de notas excluídas; sem --limpar só lista)");
    ExitCode::from(2)
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("validate") if args.len() == 2 => {
            let v = match Vault::open(&PathBuf::from(&args[1])) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("erro: {e}");
                    return ExitCode::from(2);
                }
            };
            let issues = validate(&v);
            for i in &issues {
                println!("{i}");
            }
            println!("\n{} notas, {} problemas", v.notes.len(), issues.len());
            if issues.iter().any(|i| i.severity == Severity::Error) { ExitCode::from(1) } else { ExitCode::SUCCESS }
        }
        Some("reorganizar") if args.len() >= 2 => {
            let root = PathBuf::from(&args[1]);
            let opt = |k: &str, d: &str| args.iter().position(|a| a == k).and_then(|i| args.get(i + 1)).cloned().unwrap_or(d.to_string());
            let (ano, raiz) = (opt("--ano", "2026"), opt("--raiz", "Escola"));
            let (aplicar, detalhes) = (args.iter().any(|a| a == "--aplicar"), args.iter().any(|a| a == "--detalhes"));
            let plan = match reorganizar::plan(&root, &ano, &raiz) {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("erro: {e}");
                    return ExitCode::from(2);
                }
            };
            let mut por_regra: std::collections::BTreeMap<&str, Vec<&reorganizar::Move>> = Default::default();
            for m in &plan.moves {
                por_regra.entry(m.regra).or_default().push(m);
            }
            for (r, ms) in &por_regra {
                println!("{r}: {} arquivos", ms.len());
                for m in ms.iter().take(if detalhes { usize::MAX } else { 2 }) {
                    println!("    {} → {}", m.from.display(), m.to.display());
                }
            }
            if !plan.sem_regra.is_empty() {
                println!("\nSEM REGRA (ficam onde estão): {}", plan.sem_regra.len());
                for f in plan.sem_regra.iter().take(if detalhes { usize::MAX } else { 8 }) {
                    println!("    {}", f.display());
                }
            }
            for c in &plan.colisoes {
                println!("COLISÃO {c}");
            }
            println!("\nlinks por caminho → por nome: {} em {} notas", plan.links_reescritos, plan.textos.len());
            for a in &plan.links_ambiguos {
                println!("LINK AMBÍGUO {a}");
            }
            if !plan.nomes_repetidos.is_empty() {
                println!("\nNOMES REPETIDOS depois da mudança ({}): links por nome ficam ambíguos", plan.nomes_repetidos.len());
                for (n, v) in plan.nomes_repetidos.iter().take(if detalhes { usize::MAX } else { 10 }) {
                    println!("    {n}: {}", v.iter().map(|p| p.display().to_string()).collect::<Vec<_>>().join(" | "));
                }
            }
            println!("\n{} arquivos {}", plan.moves.len(), if aplicar { "movidos" } else { "seriam movidos (simulação)" });
            if aplicar {
                if let Err(e) = reorganizar::apply(&root, &plan) {
                    eprintln!("erro ao aplicar: {e}");
                    return ExitCode::from(1);
                }
            }
            ExitCode::SUCCESS
        }
        Some("migrar") if args.len() >= 2 => {
            let aplicar = args.iter().any(|a| a == "--aplicar");
            let v = match Vault::open(&PathBuf::from(&args[1])) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("erro: {e}");
                    return ExitCode::from(2);
                }
            };
            let (mut mudou, mut manual, mut erros) = (0, 0, 0);
            for n in &v.notes {
                match migrate_named(&n.name, &n.text) {
                    Err(e) => {
                        erros += 1;
                        println!("ERRO  {}: {e}", n.path.display());
                    }
                    Ok(m) => {
                        let rel = n.path.strip_prefix(&v.root).unwrap_or(&n.path).display().to_string();
                        if !m.changes.is_empty() {
                            mudou += 1;
                            println!("{rel}");
                            for c in &m.changes {
                                println!("    {c}");
                            }
                            if aplicar {
                                let _ = historico::snapshot(&v.root, &n.path, true); // guarda a versão antiga antes de migrar
                                std::fs::write(&n.path, &m.text).expect("escrita");
                            }
                        }
                        if !m.manual.is_empty() {
                            manual += 1;
                            println!("MANUAL {rel}: {}", m.manual.join("; "));
                        }
                    }
                }
            }
            println!("\n{} notas; {} {}; {} pedem decisão manual; {} erros", v.notes.len(), mudou, if aplicar { "migradas" } else { "seriam migradas (simulação)" }, manual, erros);
            if erros > 0 { ExitCode::from(1) } else { ExitCode::SUCCESS }
        }
        Some("margem") if args.len() >= 2 => {
            // Troca "[!tip] Dica para o professor" por "[!margem]" nas aulas do acervo (simulação por padrão).
            let aplicar = args.iter().any(|a| a == "--aplicar");
            let v = match Vault::open(&PathBuf::from(&args[1])) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("erro: {e}");
                    return ExitCode::from(2);
                }
            };
            let (mut arquivos, mut total) = (0, 0);
            for n in &v.notes {
                let rel = n.path.strip_prefix(&v.root).unwrap_or(&n.path).display().to_string().replace('\\', "/");
                if !rel.starts_with("Acervo/Aulas/") { continue; }
                let (novo, c) = vault_core::migrate::professor_para_margem(&n.text);
                if c == 0 { continue; }
                arquivos += 1;
                total += c;
                println!("{rel}: {c}");
                if aplicar {
                    let _ = historico::snapshot(&v.root, &n.path, true);
                    std::fs::write(&n.path, novo).expect("escrita");
                }
            }
            println!("\n{total} anotações em {arquivos} aulas {}", if aplicar { "convertidas em [!margem]" } else { "seriam convertidas em [!margem] (simulação; use --aplicar)" });
            ExitCode::SUCCESS
        }
        Some("edit-cell") if args.len() == 6 => {
            let (Ok(t), Ok(r), Ok(c)) = (args[2].parse::<usize>(), args[3].parse::<usize>(), args[4].parse::<usize>()) else { return usage() };
            let text = std::fs::read_to_string(&args[1]).expect("leitura");
            let tables = find_tables(&text);
            let Some(cell) = tables.get(t).and_then(|t| t.rows.get(r)).and_then(|r| r.get(c)) else {
                eprintln!("célula não encontrada");
                return ExitCode::from(2);
            };
            if let Some(raiz) = PathBuf::from(&args[1]).canonicalize().ok().and_then(|p| p.ancestors().find(|a| a.join(".historico").is_dir() || a.join("Acervo").is_dir()).map(|a| a.to_path_buf())) { let _ = historico::snapshot(&raiz, &PathBuf::from(&args[1]), true); }
            std::fs::write(&args[1], replace_cell(&text, cell, &args[5])).expect("escrita");
            ExitCode::SUCCESS
        }
        Some("historico") if args.len() >= 2 => {
            let root = PathBuf::from(&args[1]);
            let limpar = args.iter().any(|a| a == "--limpar");
            let dias = args.iter().position(|a| a == "--dias").and_then(|i| args.get(i + 1)).and_then(|d| d.parse().ok()).unwrap_or(historico::DIAS_PADRAO);
            let o = historico::orfaos(&root, dias);
            for d in &o { println!("{}", d.display()); }
            if limpar { println!("\n{} históricos de notas excluídas removidos (mais de {dias} dias, fora da lixeira)", historico::limpar(&root, dias)); }
            else { println!("\n{} históricos de notas excluídas há mais de {dias} dias (simulação; use --limpar para apagar)", o.len()); }
            ExitCode::SUCCESS
        }
        _ => usage(),
    }
}
