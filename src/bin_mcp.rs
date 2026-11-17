#![cfg_attr(not(test), warn(clippy::unwrap_used))]
use vault_core::mcp::{parse_args, run_stdio};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match parse_args(&args) {
        Some(s) => run_stdio(&s),
        None => {
            eprintln!("uso: vault-mcp <pasta-do-vault> [--expor-correcoes]");
            std::process::exit(2);
        }
    }
}
