# Comparativo: Inkdrop × Margem

Lista de features do Inkdrop (https://www.inkdrop.app/features, consultada em 2026-11-19) e se o Margem tem cada uma. Baseado no código (`app/src`), no README e em `docs/afazeres.md`; o app não foi rodado para esta conferência.

Legenda: ✅ temos · 🟡 parcial · ❌ não temos · ➖ fora do escopo.
A última coluna, **Comentário (o que fazer)**, é para você preencher.

## Escrita em Markdown

| Feature do Inkdrop                                        | No Margem? | Observação                                                                                                                | Comentário (o que fazer)                                                                     |
| --------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Editor Markdown puro (CodeMirror 6)                       | ✅          | Usa CodeMirror 6. Editor híbrido: renderiza ao vivo e mostra o texto-fonte só na linha do cursor.                         |                                                                                              |
| GFM: tabelas, tarefas, tachado, `<mark>`, sub/sobrescrito | 🟡          | Tabelas, tarefas, `<u>`, `<mark>`, `<sub>` e `<sup>` existem. Não achei notas de rodapé.                                  |                                                                                              |
| Editor / preview / lado a lado                            | 🟡          | O editor renderiza ao vivo, sem painel de preview separado. Há páginas de leitura próprias (Aula, Ciclo etc.).            |                                                                                              |
| Modo sem distração                                        | ✅          | Modo foco (Ctrl+Shift+F). Faltam largura configurável, parágrafo ativo e contador.                                        |                                                                                              |
| Barra flutuante ao selecionar texto                       | ❌          |                                                                                                                           | Acho que isso seria interessante para usuários comuns.                                       |
| Comandos com `/`                                          | ✅          | Menu `/` com blocos próprios (exemplo, sintaxe, margem, dica, mindmap, erros-comuns). Não tem títulos, listas nem imagem. |                                                                                              |
| Atalhos de formatação (negrito, itálico)                  | 🟡          | O registro de atalhos existe (Configurações). Não vi atalhos de formatação de texto na lista.                             |                                                                                              |
| Sugestão de linguagem em blocos de código                 | ❌          |                                                                                                                           |                                                                                              |
| Autocompletar emoji                                       | ❌          |                                                                                                                           | Isso é bem legal. Conseguimos fazer?                                                         |
| GitHub Alerts / callouts                                  | ✅          | Callouts `> [!tipo]`, com tipos próprios (`margem`, `professor`).                                                         |                                                                                              |
| Links `[[nota]]` com busca                                | ✅          | Wikilinks, com clique/Ctrl+clique e links por nome ou âncora (`#^id`, `#título`). Não vi o autocompletar ao digitar `[[`. | Autocomplete é necessário.                                                                   |
| Colagem inteligente de links (título da página)           | ❌          |                                                                                                                           | Parece interessante, não?                                                                    |
| Imagens (colar, soltar, redimensionar)                    | 🟡          | Exibe imagens e embeds `![[imagem]]` e `![[nota]]`, com tamanho. Não vi colar nem soltar para anexar.                     |                                                                                              |
| Indentação inteligente de listas                          | 🟡          | Marcadores e tarefas renderizados. Não verifiquei a renumeração.                                                          | Verifique.                                                                                   |
| Barra/editor de tabelas                                   | ✅          | Tabela editável no editor, com inserir tabela (Ctrl+Alt+T).                                                               |                                                                                              |
| Quebra de linha que poupa tabelas                         | ❌          |                                                                                                                           |                                                                                              |
| Múltiplos cursores, 30+ comandos de edição                | ❌          |                                                                                                                           |                                                                                              |
| Navegação voltar/avançar                                  | ✅          | Alt+←/→ e histórico de navegação.                                                                                         |                                                                                              |
| Corretor ortográfico                                      | ✅          | Spellcheck ligado no editor.                                                                                              | O corretor é em pt-br?                                                                       |
| Botão de copiar em blocos de código                       | ❌          |                                                                                                                           | Isso seria interessante, especialmente para os "códigos" de análise sintática e de exemplos. |

## Preview

| Feature do Inkdrop                   | No Margem? | Observação                                                      | Comentário (o que fazer) |
| ------------------------------------ | ---------- | --------------------------------------------------------------- | ------------------------ |
| Realce de sintaxe em 100+ linguagens | ❌          | Os blocos de código são específicos de aula (exemplo, sintaxe). |                          |
| Diagramas Mermaid                    | ✅          | Mermaid 12 nas aulas e no `/mindmap`.                           |                          |
| Matemática (KaTeX)                   | ❌          | Não faz sentido para Português.                                 |                          |
| Amostra de cor, snippets do GitHub   | ❌          | Fora do escopo.                                                 |                          |
| Busca dentro do preview              | ❌          |                                                                 |                          |
| Visualizador de imagem               | 🟡          | A lupa existe na Correção.                                      |                          |

## Organização

| Feature do Inkdrop                        | No Margem? | Observação                                                                                                                  | Comentário (o que fazer)                                                                                                                                                                                           |
| ----------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cadernos aninhados                        | ✅          | Árvore de pastas (Explorador) e menu Documentos por tipo.                                                                   |                                                                                                                                                                                                                    |
| Visão de workspace                        | 🟡          | O menu Hoje / Documentos / Ano faz algo parecido.                                                                           |                                                                                                                                                                                                                    |
| Ícones e ordenação manual de cadernos     | 🟡          | Ícones fixos no menu. Pastas se organizam por arrastar para mover.                                                          |                                                                                                                                                                                                                    |
| Tags                                      | 🟡          | Só como campos do frontmatter. Sem sistema de tags com sugestão.                                                            |                                                                                                                                                                                                                    |
| Status de nota                            | ✅          | `status`: pendente, andamento, finalizado, arquivado.                                                                       |                                                                                                                                                                                                                    |
| Fixar no topo                             | ❌          |                                                                                                                             |                                                                                                                                                                                                                    |
| Criar, renomear, mover, excluir (lixeira) | ✅          | Exclusão vai para `.lixeira`. Desfazer movimento existe.                                                                    |                                                                                                                                                                                                                    |
| Ações em lote, duplicar nota              | ❌          |                                                                                                                             | Podemos implementar algumas. Com um Vault grande, ações em lote são necessárias. Seria ótimo também que, em Saúde, existissem algumas ações para corrigir possíveis problemas comuns, rodando scripts específicos. |
| Histórico de revisões                     | ✅          | Existe: `.historico/`, aba no painel direito que lista, compara e restaura (com testes). Falta conferir no Tauri real.                       | Precisamos confirmar se existe. É imperativo que exista isso.                                                                                                                                                      |
| Mesclagem automática de conflitos         | 🟡          | O observador de arquivos detecta mudança externa ("Carregar a do disco / Manter a minha") e protege a gravação. Não mescla. |                                                                                                                                                                                                                    |
| Estatísticas de atividade                 | ❌          | O Hoje e o Fechamento têm outro propósito.                                                                                  |                                                                                                                                                                                                                    |

## Busca e navegação

| Feature do Inkdrop             | No Margem? | Observação                                                                          | Comentário (o que fazer)                                                                         |
| ------------------------------ | ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Busca de texto completo        | ✅          | Ctrl+K busca nome e conteúdo (`search_text`). Sem qualificadores (`tag:`, `book:`). |                                                                                                  |
| Telescope (paleta de comandos) | ✅          | Paleta de comandos (Ctrl+P) e busca (Ctrl+K).                                       |                                                                                                  |
| Outline/sumário                | ✅          | Painel direito com Sumário, Propriedades e Links.                                   |                                                                                                  |
| Backlinks                      | ✅          | Aba Links do painel direito.                                                        |                                                                                                  |
| Nova nota em janela separada   | ❌          |                                                                                     | Tem momentos em que gosto de usar duas notas no Obsidian. Poderia ser uma feature para o futuro. |

## Modelos de nota

| Feature do Inkdrop | No Margem? | Observação                                                                                                 | Comentário (o que fazer)                                                   |
| ------------------ | ---------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Modelos de nota    | 🟡          | Não há seletor de modelos. Há criação por tipo com frontmatter mínimo, "Planejar ciclo" e "Nova correção". | Preciso conseguir visualizar e alterar esses modelos, além de criar novos. |

## IA e agentes

| Feature do Inkdrop                                      | No Margem? | Observação                                                                                                        | Comentário (o que fazer) |
| ------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------ |
| IA com sua chave (Anthropic, compatível OpenAI, Ollama) | ✅          | Chave no cofre do sistema. Ainda não testada com chave real.                                                      |                          |
| Assistente inline com ações                             | ✅          | Painel de IA (Ctrl+Shift+I) e "Adaptar a seleção", com propostas que você aceita ou recusa trecho a trecho.       |                          |
| Next Edit Suggestions                                   | ❌          |                                                                                                                   |                          |
| Servidor MCP                                            | ✅          | `vault-mcp`, com busca, leitura, backlinks, validação e criação. Notas de correção ficam ocultas por privacidade. |                          |
| Agent Skills                                            | 🟡          | Há skills suas (`transcrever-diario` etc.), fora do app.                                                          |                          |
| Arrastar notas para o agente, copiar IDs                | ❌          |                                                                                                                   |                          |

## Backup, sincronização e segurança

| Feature do Inkdrop                           | No Margem? | Observação                                                       | Comentário (o que fazer)                                                        |
| -------------------------------------------- | ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Backup contínuo                              | ➖          | Descartado: você já usa o Google Drive.                          |                                                                                 |
| Exportação                                   | 🟡          | Prova em DOCX/PDF e jogos em PDF. Não há exportar nota ou vault. |                                                                                 |
| Sincronização com criptografia ponta a ponta | ❌          | Vault é uma pasta. Para o Android, Syncthing por ora.            | Interessante isso. Precisamos conversar sobre a importância e para quais casos. |
| Funciona offline                             | ✅          | Tudo é arquivo local.                                            |                                                                                 |
| Sync próprio ou desligado                    | ✅          | Por ser pasta, serve qualquer sync externo.                      |                                                                                 |
| Autenticação em dois fatores                 | ➖          | Não há contas.                                                   |                                                                                 |

## Importação, captura e compartilhamento

| Feature do Inkdrop                      | No Margem? | Observação                                                                | Comentário (o que fazer)     |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------- | ---------------------------- |
| Importar de Evernote, Notion, Bear etc. | ➖          | O vault já é Markdown (compatível com Obsidian).                          |                              |
| Web Clipper, share sheet, Kindle        | ❌          |                                                                           | Quero saber mais sobre isso. |
| Captura rápida                          | ✅          | Ctrl+Alt+M grava na Caixa de entrada. Falta o atalho global do sistema. |                              |
| Publicar nota em link público           | ❌          |                                                                           |                              |
| Alfred/Raycast, servidor HTTP local     | ❌          | O MCP cumpre papel parecido.                                              |                              |

## Teclado e personalização

| Feature do Inkdrop                | No Margem? | Observação                                                              | Comentário (o que fazer)                                                                                                                              |
| --------------------------------- | ---------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atalhos personalizáveis           | ✅          | Página de atalhos, gravada em arquivo.                                  |                                                                                                                                                       |
| Atalhos globais do sistema        | ❌          | Funcionaria no Windows com o plugin do Tauri, mas não no Linux/Wayland. | Quero, mas temos que cuidar com atalhos comuns de outros Apps, como o que estamos usando para uma nota nova que é usado pela maioria dos navegadores. |
| Vim e keymap Sublime              | ❌          |                                                                         |                                                                                                                                                       |
| `init.js` e `styles.css` próprios | ❌          |                                                                         |                                                                                                                                                       |

## Temas

| Feature do Inkdrop                           | No Margem? | Observação                                                                         | Comentário (o que fazer) |
| -------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- | ------------------------ |
| Tema por variáveis CSS (UI, editor, preview) | ✅          | `themes.css`.                                                                      |                          |
| Claro/escuro automático                      | ✅          | Claro e escuro escolhidos de forma independente.                                   |                          |
| Temas oficiais e da comunidade               | ✅          | 8 claros e 20 escuros (Catppuccin, GitHub, Nord, Dracula, Gruvbox, Kanagawa etc.). |                          |
| Fontes e densidade                           | ✅          | Muitas fontes e 5 presets de forma e densidade.                                    |                          |

## Plugins e desenvolvedores

| Feature do Inkdrop                 | No Margem? | Observação | Comentário (o que fazer) |
| ---------------------------------- | ---------- | ---------- | ------------------------ |
| Plugins, CLI `ipm`, API TypeScript | ❌          |            |                          |
| Apresentações (slides)             | ❌          |            |                          |
| CMS / Live Export                  | ❌          |            |                          |

## Plataformas

| Feature do Inkdrop | No Margem? | Observação                                                                         | Comentário (o que fazer) |
| ------------------ | ---------- | ---------------------------------------------------------------------------------- | ------------------------ |
| Windows e Linux    | ✅          | Tauri 2, com instalador e atualizador no Windows. O teste no Tauri real é parcial. |                          |
| macOS              | ❌          | Não é alvo.                                                                        |                          |
| Android            | 🟡          | Modo compacto na mesma base. Testado no emulador, não em celular.                  |                          |
| iOS                | ➖          | Descartado.                                                                        |                          |
| Modo bandeja       | ❌          |                                                                                    | Seria viável?            |

## O que o Margem tem e o Inkdrop não

Validação do vault (CLI, Saúde e MCP), Hoje, Semana, Ano e Ciclo, correção de produções, montagem de prova (DOCX e PDF), diário de alunos, fechamento do trimestre, memória da aula, gerador de jogos, gramática e blocos didáticos (exemplo e sintaxe).
