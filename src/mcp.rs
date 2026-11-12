//! Servidor MCP (JSON-RPC 2.0 por stdio, uma mensagem por linha).
//! Privacidade: notas `tipo: correcao` ficam ocultas, a menos que o servidor
//! seja iniciado com `--expor-correcoes`.

use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use serde_yaml_ng::Value as Y;

use crate::links::line_of;
use crate::validate::{required_fields, validate};
use crate::vault::{Note, Vault};

pub struct Server {
    pub root: PathBuf,
    pub expor_correcoes: bool,
}

impl Server {
    fn hidden(&self, n: &Note) -> bool {
        if self.expor_correcoes {
            return false;
        }
        // dois cadeados: o tipo da nota (correcao, diario, aluno) e a pasta (Anos/AAAA/Correcoes, Relatorios, Diarios e Alunos)
        let rel = n.path.strip_prefix(&self.root).unwrap_or(&n.path);
        let c: Vec<_> = rel.components().map(|c| c.as_os_str().to_string_lossy().to_string()).collect();
        let por_pasta = c.first().is_some_and(|x| x == "Anos") && c.iter().skip(2).any(|x| x == "Correcoes" || x == "Relatorios" || x == "Diarios" || x == "Alunos");
        matches!(n.tipo(), Some("correcao" | "diario" | "aluno")) || por_pasta
    }

    /// Processa uma mensagem; `None` para notificações.
    pub fn handle(&self, msg: &Value) -> Option<Value> {
        let id = msg.get("id")?.clone();
        let method = msg.get("method").and_then(Value::as_str).unwrap_or("");
        let params = msg.get("params").cloned().unwrap_or(json!({}));
        let result = match method {
            "initialize" => Ok(json!({
                "protocolVersion": params.get("protocolVersion").cloned().unwrap_or(json!("2024-11-05")),
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "vault-mcp", "version": env!("CARGO_PKG_VERSION")}
            })),
            "ping" => Ok(json!({})),
            "tools/list" => Ok(json!({"tools": tools()})),
            "tools/call" => {
                let name = params.get("name").and_then(Value::as_str).unwrap_or("");
                let args = params.get("arguments").cloned().unwrap_or(json!({}));
                Ok(match self.call(name, &args) {
                    Ok(t) => json!({"content": [{"type": "text", "text": t}]}),
                    Err(e) => json!({"isError": true, "content": [{"type": "text", "text": e}]}),
                })
            }
            _ => Err(json!({"code": -32601, "message": format!("método desconhecido: {method}")})),
        };
        Some(match result {
            Ok(r) => json!({"jsonrpc": "2.0", "id": id, "result": r}),
            Err(e) => json!({"jsonrpc": "2.0", "id": id, "error": e}),
        })
    }

    fn call(&self, tool: &str, a: &Value) -> Result<String, String> {
        let v = Vault::open(&self.root).map_err(|e| e.to_string())?;
        let s = |k: &str| a.get(k).and_then(Value::as_str);
        match tool {
            "search_notes" => self.search(&v, s("query").unwrap_or(""), s("tipo"), s("campo"), s("valor")),
            "read_note" => {
                let n = self.find(&v, s("nome").ok_or("faltou `nome`")?)?;
                Ok(n.text.clone())
            }
            "backlinks" => {
                let alvo = self.find(&v, s("nome").ok_or("faltou `nome`")?)?;
                let mut out = vec![];
                for n in v.notes.iter().filter(|n| !self.hidden(n)) {
                    for l in &n.links {
                        if v.resolve(&l.target).is_some_and(|d| d.path == alvo.path) {
                            out.push(format!("{}:{}", n.name, line_of(&n.text, l.offset)));
                        }
                    }
                }
                Ok(if out.is_empty() { "nenhum backlink".into() } else { out.join("\n") })
            }
            "validate" => {
                let only = s("nome");
                let ocultas: Vec<&str> = v.notes.iter().filter(|n| self.hidden(n)).map(|n| n.name.as_str()).collect();
                let lines: Vec<String> = validate(&v)
                    .iter()
                    .filter(|i| !ocultas.contains(&i.note.as_str()) && only.is_none_or(|o| i.note.eq_ignore_ascii_case(o)))
                    .map(|i| i.to_string())
                    .collect();
                Ok(if lines.is_empty() { "sem problemas".into() } else { lines.join("\n") })
            }
            "get_habilidade" => {
                let cod = s("codigo").ok_or("faltou `codigo`")?.to_lowercase();
                for n in v.notes.iter().filter(|n| matches!(n.tipo(), Some("habilidades-bncc" | "habilidades-cbtc"))) {
                    for l in n.text.lines() {
                        if l.trim_end().ends_with(&format!("^{cod}")) {
                            return Ok(format!("{}: {}", n.name, l.trim()));
                        }
                    }
                }
                Err(format!("habilidade {cod} não encontrada"))
            }
            "plan_ciclo" => self.plan_ciclo(&v, a),
            "create_note" => self.create(&v, s("tipo").ok_or("faltou `tipo`")?, s("nome").ok_or("faltou `nome`")?),
            _ => Err(format!("ferramenta desconhecida: {tool}")),
        }
    }

    /// Propõe (e, com `gravar: true`, cria) um ciclo novo. Sem `gravar` nada é escrito: o professor revisa a proposta.
    fn plan_ciclo(&self, v: &Vault, a: &Value) -> Result<String, String> {
        use crate::ciclo::{montar, Aula, Proposta};
        let num = |k: &str| a.get(k).and_then(Value::as_u64).map(|x| x as u32).ok_or(format!("faltou `{k}` (número)"));
        let txt = |k: &str| a.get(k).and_then(Value::as_str).unwrap_or("").to_string();
        let lista = |k: &str| -> Vec<String> { a.get(k).and_then(Value::as_array).map(|x| x.iter().filter_map(|i| i.as_str().map(String::from)).collect()).unwrap_or_default() };
        let aulas = a
            .get("aulas")
            .and_then(Value::as_array)
            .ok_or("faltou `aulas` (lista de {conteudo, recurso})")?
            .iter()
            .map(|x| Aula { conteudo: x.get("conteudo").and_then(Value::as_str).unwrap_or("").to_string(), recurso: x.get("recurso").and_then(Value::as_str).unwrap_or("").to_string() })
            .collect();
        let p = Proposta {
            ano: num("ano")?,
            trimestre: num("trimestre")?,
            ciclo: num("ciclo")?,
            titulo: txt("titulo"),
            sufixo: a.get("sufixo").and_then(Value::as_str).map(String::from),
            objetivo: txt("objetivo"),
            conteudos: lista("conteudos"),
            habilidades: lista("habilidades"),
            aulas,
        };
        let m = montar(v, &p)?;
        let avisos = if m.avisos.is_empty() { String::new() } else { format!("\n\nAvisos:\n- {}", m.avisos.join("\n- ")) };
        if a.get("gravar").and_then(Value::as_bool) != Some(true) {
            return Ok(format!("PROPOSTA (nada foi gravado; chame de novo com gravar=true para criar). Arquivo: {}.md\n\n{}{avisos}", m.nome, m.texto));
        }
        let dir = self.destino_dir("ciclo");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join(format!("{}.md", m.nome));
        if path.exists() {
            return Err(format!("já existe {}.md", m.nome));
        }
        std::fs::write(&path, &m.texto).map_err(|e| e.to_string())?;
        let rel = path.strip_prefix(&self.root).unwrap_or(&path).to_string_lossy().replace('\\', "/");
        Ok(format!("criado: {rel}{avisos}"))
    }

    fn find<'a>(&self, v: &'a Vault, nome: &str) -> Result<&'a Note, String> {
        let n = v.resolve(nome).ok_or_else(|| format!("nota `{nome}` não encontrada"))?;
        if self.hidden(n) {
            return Err("nota de correção: dados de alunos não são expostos ao Claude (iniciar com --expor-correcoes para liberar)".into());
        }
        Ok(n)
    }

    fn search(&self, v: &Vault, q: &str, tipo: Option<&str>, campo: Option<&str>, valor: Option<&str>) -> Result<String, String> {
        let ql = q.to_lowercase();
        let mut hits: Vec<(usize, String)> = vec![];
        for n in v.notes.iter().filter(|n| !self.hidden(n)) {
            if tipo.is_some_and(|t| n.tipo() != Some(t)) {
                continue;
            }
            if let (Some(c), Some(val)) = (campo, valor) {
                let ok = match n.field(c) {
                    Some(Y::String(x)) => x.eq_ignore_ascii_case(val),
                    Some(Y::Sequence(xs)) => xs.iter().any(|x| x.as_str().is_some_and(|x| x.eq_ignore_ascii_case(val))),
                    Some(Y::Number(x)) => x.to_string() == val,
                    Some(Y::Bool(x)) => x.to_string() == val,
                    Some(_) => false,
                    None => false,
                };
                if !ok {
                    continue;
                }
            }
            let body = n.text.to_lowercase();
            let score = if ql.is_empty() { 1 } else { n.name.to_lowercase().matches(&ql).count() * 5 + body.matches(&ql).count() };
            if score == 0 {
                continue;
            }
            let snip = n.text.lines().find(|l| ql.is_empty() || l.to_lowercase().contains(&ql)).unwrap_or("").trim();
            hits.push((score, format!("{} [{}] {}", n.name, n.tipo().unwrap_or("-"), snip.chars().take(120).collect::<String>())));
        }
        hits.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
        hits.truncate(20);
        Ok(if hits.is_empty() { "nenhum resultado".into() } else { hits.into_iter().map(|h| h.1).collect::<Vec<_>>().join("\n") })
    }

    /// Pasta de destino de uma nota nova, conforme a estrutura do vault.
    fn destino_dir(&self, tipo: &str) -> std::path::PathBuf {
        let ano = || {
            let mut anos: Vec<String> = std::fs::read_dir(self.root.join("Anos"))
                .into_iter()
                .flatten()
                .flatten()
                .filter(|e| e.path().is_dir())
                .map(|e| e.file_name().to_string_lossy().to_string())
                .collect();
            anos.sort();
            anos.pop().unwrap_or_else(|| chrono::Local::now().format("%Y").to_string())
        };
        let r = &self.root;
        match tipo {
            "aula" => r.join("Acervo/Aulas"),
            "texto" => r.join("Acervo/Textos"),
            "banco" => r.join("Acervo/Questoes"),
            "plano" | "ciclo" => r.join("Anos").join(ano()).join("Planejamento"),
            "calendario" => r.join("Anos").join(ano()),
            "semana" => r.join("Anos").join(ano()).join("Semanas"),
            "prova" => r.join("Anos").join(ano()).join("Provas"),
            "diario" => r.join("Anos").join(ano()).join("Diarios"),
            "aluno" => r.join("Anos").join(ano()).join("Alunos"),
            "correcao" => r.join("Anos").join(ano()).join("Correcoes"),
            _ => r.join("_sistema"),
        }
    }

    fn create(&self, v: &Vault, tipo: &str, nome: &str) -> Result<String, String> {
        let req = required_fields(tipo).ok_or_else(|| format!("tipo `{tipo}` não existe"))?;
        if nome.is_empty() || nome.starts_with('.') || nome.contains(['/', '\\', ':']) {
            return Err("nome inválido (sem barras, dois-pontos ou ponto inicial)".into());
        }
        if v.resolve(nome).is_some() {
            return Err(format!("já existe uma nota chamada `{nome}`"));
        }
        let dir = self.destino_dir(tipo);
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join(format!("{nome}.md"));
        let mut fm = format!("---\ntipo: {tipo}\n");
        for f in req {
            fm.push_str(&format!("{f}: \n"));
        }
        fm.push_str(&format!("---\n\n# {nome}\n"));
        std::fs::write(&path, fm).map_err(|e| e.to_string())?;
        let rel = path.strip_prefix(&self.root).unwrap_or(&path).to_string_lossy().replace('\\', "/");
        Ok(format!("criada: {rel} (campos vazios aparecem como pendência no validador)"))
    }
}

fn tools() -> Value {
    let obj = |props: Value, req: &[&str]| json!({"type": "object", "properties": props, "required": req});
    json!([
        {"name": "search_notes", "description": "Busca notas por texto e/ou campo do frontmatter (ex.: tipo=texto, campo=conteudos, valor=fig-anafora). Notas de correção de alunos nunca aparecem.",
         "inputSchema": obj(json!({"query": {"type": "string"}, "tipo": {"type": "string"}, "campo": {"type": "string"}, "valor": {"type": "string"}}), &[])},
        {"name": "read_note", "description": "Lê uma nota pelo nome (sem caminho).", "inputSchema": obj(json!({"nome": {"type": "string"}}), &["nome"])},
        {"name": "backlinks", "description": "Lista as notas que apontam para a nota dada (arquivo:linha).", "inputSchema": obj(json!({"nome": {"type": "string"}}), &["nome"])},
        {"name": "validate", "description": "Valida o vault (ou uma nota): campos por tipo, taxonomia, links, datas do ciclo.", "inputSchema": obj(json!({"nome": {"type": "string"}}), &[])},
        {"name": "get_habilidade", "description": "Devolve o texto de uma habilidade BNCC/CBTC pelo código (ex.: EF06LP04).", "inputSchema": obj(json!({"codigo": {"type": "string"}}), &["codigo"])},
        {"name": "plan_ciclo", "description": "Planeja um ciclo de aulas (sequência ordenada, sem datas). Sem `gravar` só devolve a proposta e avisos (habilidade ou recurso inexistente, ciclo sem prova); com gravar=true cria Anos/AAAA/Planejamento/ATC - Título.md sem sobrescrever. Antes, use search_notes (tipo=aula/texto/banco) e get_habilidade para escolher recursos e habilidades que existem. ano/trimestre/ciclo: 1 a 9 (ex.: 7,2,3 = ciclo 723). sufixo opcional: PR, PT ou TG.",
         "inputSchema": obj(json!({"ano": {"type": "integer"}, "trimestre": {"type": "integer"}, "ciclo": {"type": "integer"}, "titulo": {"type": "string"}, "sufixo": {"type": "string"}, "objetivo": {"type": "string"}, "conteudos": {"type": "array", "items": {"type": "string"}}, "habilidades": {"type": "array", "items": {"type": "string"}}, "aulas": {"type": "array", "items": {"type": "object", "properties": {"conteudo": {"type": "string"}, "recurso": {"type": "string"}}, "required": ["conteudo"]}}, "gravar": {"type": "boolean"}}), &["ano", "trimestre", "ciclo", "titulo", "aulas"])},
        {"name": "create_note", "description": "Cria uma nota na pasta correta do vault (conforme o tipo) com o frontmatter mínimo do tipo. Não sobrescreve nada.", "inputSchema": obj(json!({"tipo": {"type": "string"}, "nome": {"type": "string"}}), &["tipo", "nome"])}
    ])
}

pub fn run_stdio(server: &Server) {
    use std::io::{BufRead, Write};
    let stdout = std::io::stdout();
    for line in std::io::stdin().lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let reply = match serde_json::from_str::<Value>(&line) {
            Ok(m) => server.handle(&m),
            Err(e) => Some(json!({"jsonrpc": "2.0", "id": null, "error": {"code": -32700, "message": e.to_string()}})),
        };
        if let Some(r) = reply {
            let mut o = stdout.lock();
            let _ = writeln!(o, "{r}");
            let _ = o.flush();
        }
    }
}

pub fn parse_args(args: &[String]) -> Option<Server> {
    let expor = args.iter().any(|a| a == "--expor-correcoes");
    let root = args.iter().find(|a| !a.starts_with("--"))?;
    Some(Server { root: Path::new(root).to_path_buf(), expor_correcoes: expor })
}
