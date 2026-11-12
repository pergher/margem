# Margem · núcleo do vault

Biblioteca e ferramentas em Rust para um vault de Markdown (compatível com o Obsidian) usado no ensino de Português e, separadamente, na pesquisa. Tudo é arquivo `.md`; nada é guardado em formato próprio. Escopo completo: `escopo-editor-markdown-ensino.md`. Formato do vault: [docs/formato-do-vault.md](docs/formato-do-vault.md).

Hoje existem o núcleo, o CLI `vault` e o servidor MCP `vault-mcp`. Há também um **protótipo do editor** em `app/` (Tauri 2 + React + shadcn/ui + CodeMirror 6), descrito em [Editor](#editor-protótipo).

## Instalação

Precisa do Rust (`rustup`) e de um linker C (`sudo apt install build-essential`).

```bash
cargo build --release
cargo test
```

Os binários ficam em `target/release/vault` e `target/release/vault-mcp`.

## Comandos

Todos recebem a pasta do vault (a pasta `Escola/`). Os que alteram arquivos **simulam por padrão** e só gravam com `--aplicar`.

### `vault validate <pasta>`
Lista os problemas do vault, um por linha (`nível nota:linha [código] mensagem`). Sai com código 1 se houver erro.

| código | significado |
|---|---|
| `yaml` | frontmatter ilegível (por exemplo, `fonte:` com `: ` sem aspas) |
| `sem-tipo`, `tipo-desconhecido` | falta `tipo`, ou o tipo não existe no formato |
| `campo-vazio` | campo obrigatório do tipo vazio ou ausente |
| `campo-obsoleto` | `turmas` numa aula |
| `valor-invalido` | `status`, `ano`, `trimestre`, `turma(s)` ou `transcricao` fora do vocabulário |
| `conteudo-desconhecido` | código de conteúdo que não está em `_codigos.md` |
| `link-quebrado`, `ancora-quebrada` | `[[link]]` sem destino, ou `#^id` / `#título` inexistente |
| `aula-sem-recurso`, `sem-recuperacao` | aula do ciclo sem recurso; ciclo que termina na prova |
| `data-invalida` | aula do ciclo em feriado, recesso, dia sem aula ou fora do período |
| `marca-pendente` | `[palavra?]` ou `[ilegível]` com `transcricao: aprovada` |
| `total-diverge`, `nota-fora-da-rubrica` | total diferente da soma; nota acima do máximo ou fora do passo |

### `vault migrar <pasta> [--aplicar]`
Converte o frontmatter antigo para o formato novo (`type`→`tipo`, `year`→`ano`, status padronizado etc.; veja a tabela na spec). Só mexe nas linhas do frontmatter e aborta a nota se o corpo fosse mudar. Rodar duas vezes não muda mais nada. Notas que precisam de decisão sua aparecem como `MANUAL`.

### `vault reorganizar <pasta> [--ano 2026] [--raiz Escola] [--aplicar] [--detalhes]`
Move as notas para `_sistema/`, `Acervo/` e `Anos/AAAA/` e troca links por caminho por links por nome. Nunca renomeia arquivos. Mostra o que não tem regra, colisões de destino e nomes que ficam repetidos.

### `vault edit-cell <arquivo> <tabela> <linha> <coluna> <texto>`
Troca o conteúdo de uma célula de tabela (índices a partir de 0) sem alterar mais nenhum byte do arquivo.

### Fluxo recomendado
1. Faça uma cópia do vault.
2. `vault migrar` (simulação), confira, depois `--aplicar`.
3. `vault reorganizar` (simulação), confira, depois `--aplicar`.
4. `vault validate` e resolva os avisos.

## Servidor MCP (`vault-mcp`)

Deixa o Claude consultar o vault. Conversa por stdio (JSON-RPC, uma mensagem por linha).

```bash
claude mcp add vault -- /caminho/para/target/release/vault-mcp /caminho/para/Escola
```

| ferramenta | o que faz |
|---|---|
| `search_notes` | busca por texto e por campo do frontmatter (`tipo`, `campo`, `valor`) |
| `read_note` | lê uma nota pelo nome (sem caminho) |
| `backlinks` | quem aponta para a nota (arquivo:linha) |
| `validate` | o mesmo do CLI, para o vault ou uma nota |
| `get_habilidade` | texto de uma habilidade BNCC/CBTC pelo código |
| `create_note` | cria uma nota na pasta certa do vault (conforme o tipo) com o frontmatter mínimo; não sobrescreve |

**Privacidade.** Notas `tipo: correcao` e tudo em `Anos/*/Correcoes` e `Anos/*/Relatorios` ficam ocultas em todas as ferramentas. Para liberar (por sua conta e risco), inicie com `--expor-correcoes`.

## Editor (protótipo)

Em `app/`. Em desenvolvimento abre o vault de `tests/fixtures/vault` (ou o de `VAULT_ROOT`); o app instalado pede a pasta do vault na primeira abertura (guardada em `vault.json` na pasta de configuração do app). Instalador Windows, atualização automática e publicação: `docs/publicar.md`, mostra a árvore de pastas, edita com renderização ao vivo e salva com `Ctrl+S`.

```bash
cd app && npm install            # uma vez
PATH=$HOME/.cargo/bin:$PATH npx tauri dev
```

Requisitos no Linux: Node 18+, `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `libssl-dev`, `libxdo-dev`, `pkg-config`.

- **Comandos Tauri** (`app/src-tauri/src/main.rs`): `list_notes`, `read_note`, `save_note`, `resolve_link`. Só lê e grava `.md` dentro do vault.
- **Renderização** (`app/src/lib/livePreview.js`): títulos, ênfase, listas, tarefas, citações, callouts (`> [!tipo]`), tabelas, `<u>`/`<mark>`, wikilinks e frontmatter como chips. O texto-fonte só aparece na linha com o cursor. O callout `professor` some no modo Aluno.
- **Links:** clique simples abre `[[nota]]`; no texto-fonte, `Ctrl+clique`.
- **Layout:** componentes shadcn escritos à mão (a CLI exige Node mais novo) em `app/src/components/ui`; paleta e fontes seguem o artefato "Esboço de telas". Tema claro/escuro.
- **Ver no navegador:** `npx vite` em `app/` serve o vault de teste só para leitura (`/__vault`), útil para conferir o visual sem o Tauri. O salvar não grava nesse modo.
- **Ainda não feito:** painel de propriedades editável, backlinks, validação ao salvar, criar/renomear/mover notas, busca no conteúdo, teste no Windows.

## Estrutura do código

| arquivo | função |
|---|---|
| `src/frontmatter.rs` | separa e lê o frontmatter YAML |
| `src/links.rs` | wikilinks, embeds, blocos `^id` e títulos, ignorando código |
| `src/tables.rs` | tabelas com posição em bytes e edição parcial de célula |
| `src/vault.rs` | lê a pasta e resolve links por nome |
| `src/validate.rs` | regras de validação |
| `src/migrate.rs` | migração do frontmatter |
| `src/reorganizar.rs` | estrutura de pastas e reescrita de links |
| `src/mcp.rs` | servidor MCP |

## Testes

- `tests/fixtures/mini`: vault pequeno, escrito à mão, no formato novo.
- `tests/fixtures/modelo`: amostras reais no formato antigo (sem dados de alunos).
- `tests/fixtures/vault`: cópia completa do vault; fica no `.gitignore` e nenhum teste depende dela.
