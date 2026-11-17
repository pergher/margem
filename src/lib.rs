#![cfg_attr(not(test), warn(clippy::unwrap_used))] // sem unwrap() fora dos testes: use `?`, `ok_or` ou `let ... else` com mensagem em português
pub mod frontmatter;
pub mod links;
pub mod tables;
pub mod vault;
pub mod validate;
pub mod mcp;
pub mod ciclo;
pub mod atemporais;
pub mod migrate;
pub mod reorganizar;
pub mod historico;
pub mod semana;
