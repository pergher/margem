# Afazeres do Margem (editor-md)

Lista única, **revisada contra o código em 2026-11-18** (versão 0.1.15 no `package.json`; último tag publicado: v0.1.11; `main` igual a `origin/main`). Itens antigos que já estavam feitos ou foram superados saíram da lista e estão em "Verificado: já feito ou superado", no fim.

Regras: vault real só com **simular → cópia → aplicar**; push ao GitHub só com OK do usuário.

---

## P1 — Lançar e testar o que nunca rodou no Windows

As etapas K–N (observador de arquivos, propostas, painel de IA, provedores) e tudo até a 0.1.15 estão só em commits: **não há tag depois de v0.1.11**, então nada disso foi instalado no Windows. Testado até aqui: `cargo test`, vitest, navegador.

- [ ] Publicar a próxima tag (0.1.15, ou a que o usuário escolher) e instalar/atualizar no Windows. Guia: `docs/publicar.md` (chave `~/.tauri/margem.key` sem senha; não criar o secret de senha; não fazer polling na API do GitHub).
- [ ] **Observador de arquivos (K)** no Windows: nota limpa alterada por fora recarrega sozinha; nota suja mostra a faixa "Carregar a do disco / Manter a minha" e "Ver diferenças"; nota criada pelo `vault-mcp` aparece na árvore; salvar no Margem não gera aviso; trocar a pasta do vault reaponta o observador.
- [ ] **Propostas (L e revisão na nota)**: "Propor (teste)" com nota aberta e fechada; aceitar/recusar trecho a trecho; Ctrl+Z; desfazer; mudança por fora recusa a proposta; duas propostas e contador no rodapé.
- [ ] **PDF/imprimir da Prova** e DOCX (2 colunas, cabeçalho e logo): principal risco de layout, nunca visto no Tauri.
- [ ] Confirmar com o usuário o que já foi conferido pelo uso das versões 0.1.5–0.1.11: reabertura após atualizar (`agendar_reabertura`), imagens via `asset:` (escopo dinâmico na pasta do vault, `config.rs`), CSP, renomear só com troca de maiúsculas, conflito de gravação.
- [ ] CI com clippy/ESLint/vitest/cobertura: conferir que está verde no GitHub (Actions).

## P2 — IA: testar com chave real e privacidade

Os testes automáticos de privacidade existem (`nota_de_correcao_nao_e_enviada`, `ia_nao_propoe_nada_sobre_dados_de_alunos`, `diarios_e_alunos_ficam_ocultos_por_pasta_e_por_tipo`). Falta ver no app.

- [ ] **Conferir o formato da API Anthropic, os eventos SSE e os nomes de modelo na documentação** (`claude-sonnet-5-5`, Gemini `gemini-3.5-flash-lite`): foram escritos de memória.
- [ ] Chave só no Credential Manager (`ia-anthropic`, serviço `br.margem.app`) e em arquivo nenhum; Testar conexão sem vazar a chave; Apagar chave.
- [ ] Com **correção, diário ou aluno abertos**: "Ver o que foi enviado" não mostra o conteúdo; pedir à IA para ler pelo nome é recusado (também no provedor local).
- [ ] Painel (Ctrl+Shift+I): streaming, Parar, ferramentas, "Adaptar com mais apoio" → proposta → aplicar → Desfazer; erro legível sem internet/sem crédito; custo na página do provedor.
- [ ] Ollama local (selo "Nada sai do computador", sem internet/chave), OpenAI/OpenRouter e Gemini contra servidores reais; anotar recusas de `max_tokens`/`max_completion_tokens`.
- [ ] Avisos de validação já na proposta (hoje só depois de aplicar); ícone de propostas só no rodapé.
- [ ] Não feito: Gemini nativo (o modo compatível basta), modelo padrão por ação, teste automático de Configurações › IA.

## P3 — Vault real

Objetivo central. Aplicado só em cópias/fixtures (`tests/fixtures/vault`, e o fictício versionado em `tests/fixtures/ficticio`). Conferir com o usuário o estado atual do vault real.

- [ ] Para cada um: cópia → simular (sem `--aplicar`) → conferir → aplicar → Saúde "Verificar de novo": `vault reorganizar`, `vault migrar`, `vault ciclos`, `vault margem`; copiar `CLAUDE.md`.
- [ ] Conferir os avisos novos na Saúde (`nome-repetido`, `arquivo-ilegivel`).
- [ ] Decisões do usuário: ano na frente do nome dos arquivos de `Anos/AAAA`; `conteudos`/`conteudos_excluidos` dos bancos (vazios); CBTC, calendário e rubrica definitivos; se `_sistema/fichas` continua oculta ao MCP (`hidden()` em `src/mcp.rs`).

## P4 — Uso diário

- [ ] **Diário:** a foto ainda é um nome de arquivo digitado no diálogo; falta importar a foto para dentro do vault pelo app. (A transcrição é feita pela skill `transcrever-diario`, com o Claude fora do MCP.)
- [ ] Ao mover arquivos: avisar quando o destino contraria o tipo; Ctrl+Z global do movimento; pastas renomeadas por fora não geram aviso (só os `.md`).

## P5 — Correção, Prova, Aula

- [ ] Conferir se a skill de correção (fora do repositório) lê a seção `## Enunciado`; os lotes antigos não têm enunciado.
- [ ] Erros do aluno `{errado|certo}`: conferir se o editor Markdown mostra as chaves cruas; lista de alunos e Visão da turma não contam erros; o Claude ainda não marca erros ao transcrever (depende do prompt).
- [ ] Devolutivas em DOCX/PDF; aprovação de transcrição por aluno.
- [ ] Prova: calibrar o limite de linhas por folha com prova real (a conta ignora as colunas; `limite_linhas` já é configurável); trocar questões de uma prova salva sem passar por "Montar prova"; a prova grava o número da questão pela ordem no arquivo (se o banco mudar de ordem, provas antigas apontam outra); conferir o DOCX no Word; logo só do disco.
- [ ] Atividade de um texto: crônicas longas (cortar à mão), prévia do que será inserido, sugerir autor/gênero.
- [ ] Aula: `[!margem]` ao lado da seção onde está; conferir a visão com aulas reais e Mermaid.
- [ ] Gramática: aba "usada nas aulas"; conversão do EPUB (decidir de quem é o texto; usar só resumo/organização próprios).

## P6 — Acabamento de interface

- [ ] Escolher a **forma/densidade** preferida (5 presets em Configurações › Aparência; o padrão continua "Suave e confortável"); aplicar bordas e sombras do artefato "Forma e densidade".
- [ ] Anel de foco e hover em todas as listas; teclado (↑/↓, Enter, Esc) na árvore/Explorador e na lista de alunos (a paleta já tem ↑/↓); Correção só pelo teclado.
- [ ] `Vazio`/`Toast` já estão em Ano, Correção, Saúde, Diário, Prova, Hoje e Explorador; falta "Procurar o arquivo" no erro do VaultGate.
- [ ] Divisórias de coluna: faltam nas telas Semana, Aula e Diário (existem em Hoje, Prova, Ciclo, Correção e Configurações).
- [ ] 13 usos de `uppercase` fora de cabeçalhos de painel; registrar a escala de espaçamento em `index.css`; um botão principal por tela; contraste do texto secundário sobre fundos `muted`; `--ok/--warn/--err` não existem em `themes.css` (só no `index.css`).
- [ ] Serifa só no conteúdo do documento; títulos da interface em Inter 600; mono só em código/frontmatter.
- [ ] Modo foco existe (Ctrl+Shift+F); faltam largura configurável, parágrafo ativo em destaque e contador. Modo aula (letra grande, etapas marcáveis, projeção sem ocorrências); controles de 48 px em toque.
- [ ] Respostas da IA já em Markdown; "Adaptar a seleção" ainda usa `window.getSelection`.

## P7 — Débito técnico

- [ ] Dois leitores de ciclo/semana (JS no app, Rust em `src/semana.rs` para CLI/MCP). Já há testes de conformidade nos dois lados; decidir se o app passa a usar o núcleo e portar `reescrever`.
- [ ] ESLint: 5 avisos de `eslint-disable` sem uso (`npm run lint --fix`). Clippy: contar de novo (eram 11 avisos de estilo).
- [ ] Limpeza do histórico de notas excluídas só por CLI (`vault historico --limpar`); `.historico` fora da busca.
- [ ] Saúde: correção rápida para marcas pendentes, valores inválidos e tipo desconhecido (hoje só abre a nota); a nota de configuração da prova só aparece na árvore após refresh.
- [ ] Conflito de gravação só protege quem passa por `read_note`/`save_note`; o desfazer multiarquivo cobre falha de gravação, não arrependimento (para isso há o histórico).

## P8 — Ideias futuras (sem compromisso)

- **Sincronização via Drive/Dropbox:** sem API (OAuth, LGPD); vault como pasta sincronizada. Falta reconhecer cópias de conflito na Saúde, decidir o destino de `.historico/` e `.lixeira/` e poder excluir alunos/diários da sincronização. Drive for Desktop não existe oficialmente no Linux.
- **Modos do Markdown** (público futuro: professores amigos): Simples, Padrão, Fonte; sem WYSIWYG completo.
- **Android** (só depois da sincronização; iOS descartado): Tauri 2 compila, mas o vault no Drive esbarra no armazenamento restrito (SAF). Escopo: Hoje, Semana (✓), ler a Aula, ocorrência no Diário, foto de redação.
- **Telas que não existem:** Aluno, Relatório de desempenho, Cobertura da BNCC, Catálogo de textos, Mapa de conteúdos (Relatório e Aluno dependem de decidir onde ficam ocorrências e critérios).
- **Descartado:** gráfico de evolução do aluno, gráfico de relações, backup do vault inteiro (já há Google Drive), versão do aluno em DOCX dos blocos didáticos, "Preparar aula" (removido em 2026-11-15), visão personalizada de Textos (removida em 2026-11-16).

---

## Verificado: já feito ou superado (não voltar a listar)

- **Git/GitHub:** repositório público `pergher/margem`, `main` sincronizado, tags v0.1.0 a v0.1.11, CI e release por tag, atualizador funcionando (0.1.1 → 0.1.x). "Empurrar commits" e "criar conta/repo" estão feitos.
- **Pedidos 1–9 do usuário** (git, atualizador, visão por tipo, situação da aula, telas = .md, Configurações, prova em 2 colunas com cabeçalho/logo, lupa na Correção, colunas redimensionáveis): feitos.
- **Turmas do ano novo:** `Turmas AAAA.md` + diálogo "Criar AAAA" com turmas sugeridas (`sugerirTurmasDoProximoAno`).
- **Tirar ciclo do ano:** botão de lixeira no Planejamento (`tirarCicloDoAno`); ciclos também arrastáveis.
- **Criar/renomear/excluir/mover arquivos:** vive no Explorador (Documentos), com F2, Del, arrastar e "Mover para…"; reescrita de wikilinks ao renomear com desfazer (`planejar_links`). `FileTree.jsx` ainda existe, sem uso: pode apagar.
- **Preparar aula** e a visão personalizada de Textos foram removidas de propósito.
- **Ícones:** Tabler Icons substituiu o Lucide (as opções Padrão/Traço fino/Duotone e a decisão "Traço fino fixo" ficaram obsoletas).
- **IA:** painel, propostas com revisão dentro da própria nota, Markdown nas respostas, retentativas em 503/529/429, Gemini pré-configurado, mapa de códigos e habilidades no contexto, privacidade com testes.
- **Observador de arquivos, histórico na CLI** (snapshots em todos os caminhos que sobrescrevem), **gravação atômica e conflito** com segunda checagem antes do rename.
- **Núcleo/App:** `App.jsx`, `CorrecaoPage` e `main.rs` divididos em módulos/hooks; sem `unwrap` no núcleo; vault fictício versionado e CI barra dados reais; piso de cobertura no CI; testes de conformidade Rust/JS.
- **Ano em abas** (Semana, Planejamento, Produções, Diário) com filtro de turma e Nova correção; **Documentos** reúne Aulas, Gramática, Recursos e Provas (`Acervo/Provas`).
- **Espaçamentos fora da escala (`p-[…]`, `gap-[…]`):** zero ocorrências.
- **Etapas do plano de avaliação 1–9:** feitas (perda de dados no editor, pânicos, gravação segura, Semana sem reescrita destrutiva, robustez do vault, CSP, testes/CI, correções de interface, operações multiarquivo).
- **Guias antigos de aplicar no vault real** (cópia → simulação → `--aplicar`): incorporados em P3.

---

## Apêndice — Notação preservada

Blocos didáticos (`app/src/lib/blocos.js`; aula de teste em `docs/modelos/Aula de teste - blocos didáticos.md`):
- `exemplo`: linhas `errado:` / `certo:` / `porquê:` (ou `regra:`); marcas `[trecho]{erro}` e `[trecho]{ok}`; `exemplo exercicio` mostra só o errado com linha de resposta.
- `sintaxe`: uma frase por linha, `[trecho]{rótulo}` aninhável (`[[leram]{verbo} [o livro]{objeto direto}]{predicado}`); prefixo `:` = classe de palavra, `#` = oração, sem prefixo = função; camadas ligáveis; `sintaxe exercicio` mostra só a frase.
- Menu `/` (`lib/menuBarra.js`), "Copiar como imagem", "Pedir ao Claude" (só sintaxe), `/erros-comuns` (conta `{errado|certo}` por aluno, só frases, sem nomes, texto editável antes de inserir).
- Gramática do acervo: `Acervo/Gramática/`, referência (regra e exemplos) × aula (sequência didática que a referencia); ver `formato-do-vault.md`.

Artefatos de desenho (claude.ai): Esboço de telas `…/artifact/TVTpVtk1j65bfnxmbsihyq`; Margem — telas revisadas `…/artifact/MRfMSj3duiUWHv8NvcNJk7`; Margem — telas (19 telas) `…/artifact/JiVvTTMBdb1tnEK5VfHRDU`.
