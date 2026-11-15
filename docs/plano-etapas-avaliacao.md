# Plano de etapas a partir da avaliação do Fable (14/11/2026)

Fonte: `avaliacao-fable.md`. Cada etapa é pequena o bastante para uma sessão, tem critério de pronto e, quando possível, um teste que falha antes da correção.

## Estado (atualizado em 15/11/2026)

Etapas 1 a 9 **implementadas**; 10 **parcial** (ver abaixo); 11 pendente. Nada foi commitado (a pasta não é repositório git). Testes: `cargo test` (núcleo e `app/src-tauri`) e `npm test` (44 testes, vitest) e `npm run lint` em `app/` passam; `vite build` compila. **Nada disso foi exercitado no app Tauri real nem no Windows**: ver "A conferir" abaixo e a etapa 11.

| Etapa | Estado | O que mudou (arquivos principais) |
|---|---|---|
| 1 | feita | `Editor.jsx`: `setText` cria um `EditorState` novo por nota (histórico de desfazer vazio). |
| 2 | feita | `validate.rs`: `.get()`/`.first()` no lugar de índices; `historico.rs`: `hist_ids` só aceita arquivos `.md`; `main.rs` (Tauri): auxiliar `lock()` ignora Mutex envenenado. Testes novos. |
| 3 | feita | Tauri: `gravar_atomico` (temporário + rename) e `gravar_nota` com hash do último texto visto; `save_note` recusa com erro `conflito:` se o arquivo mudou fora (parâmetro `force`). `App.jsx`: diálogo de conflito, releitura ao reabrir a nota atual, salvamento ao fechar a janela (`core:window:allow-destroy` em `capabilities/default.json`). |
| 4 | feita | `semana.js`: `reescrever` agora só regera as linhas alteradas (frontmatter extra, texto livre e linhas intactas ficam como estavam); recusa editar tabela com texto no meio. 8 testes em `lib/__tests__/semana.test.js`. |
| 5 | feita | `vault.rs`: `.md` não UTF-8 é pulado e avisado (`arquivo-ilegivel`); `frontmatter.rs` aceita BOM; `read_note` do Tauri normaliza BOM/CRLF para as telas; validador avisa `nome-repetido` e o app recusa criar/renomear/mover para nome repetido; `tables.rs` escapa `\|` em `replace_cell`. |
| 6 | feita | `AulaDaNota.jsx`: links `javascript:`/`vbscript:`/`data:` viram `#`; CSP em `tauri.conf.json`; `mcp.rs`: cadeado de pasta vale em qualquer profundidade e inclui `_sistema/notas` e `_sistema/fichas`; descrição do `validate` atualizada. |
| 7 | feita | Testes vitest de `frontmatter.js`, `ciclos.js`, `correcao.js`; CI com clippy, `cargo test` do núcleo e do Tauri, versões, ESLint, vitest e `vite build`; `eslint.config.js`; `scripts/checar-versao.mjs`; `vite.config.js` espelha `required_fields`; pacote renomeado `margem-app`; `vault reorganizar --ano` usa o ano atual. |
| 8 | feita | Correção: colunas encolhem até um mínimo (e rolam de lado abaixo disso), rótulos “ortografia/pontuação” nos contadores (só em tela larga), título do cartão = atividade (`nomeEdit` mantém o nome da pasta); Saúde: “observações” (info) escondidas por padrão e instruções de terminal movidas para `docs/aplicar-no-vault-real.md`; Diário: datas legíveis, aviso sem “MCP”, lista em colunas; Semana: só “Dada” à vista (Adiada/Descartada no menu ⋯) e rótulo “Próxima semana/Esta semana”; “Editar / Ver” no lugar de “Markdown / Personalizada”; Ano e ciclos sem a data de hoje e com o mesmo nome do menu; Explorador abre em lista e explica “um clique seleciona, dois abrem”; Questões: título do `# ` do banco. |
| 9 | feita | `validate_note` no núcleo (painel da nota valida só ela); `lib/transacao.js` (`gravarVarios`: calcula tudo antes, grava, desfaz se falhar) usado em promover aula, ajustar semanas ao ciclo e editar a tabela do ciclo (`salvarCicloEAjustarSemanas`); Tauri: renomear calcula as reescritas de link antes (`planejar_links`), grava com desfazer (`aplicar_reescritas`, inclusive o renome) e aceita trocar só maiúsculas (`renomear_fs`); `read_embed` devolve o caminho e a tela usa `convertFileSrc` (feature `protocol-asset`, escopo dinâmico = pasta do vault, CSP com `asset:`); `inline: true` mantém o data URL do logo da prova. |
| 10 | parcial | **Núcleo:** `src/semana.rs` é o leitor de ciclo (`parse_ciclo`) e de semana (`parse_semana`: situações ✓ ↷ ⊘, ligação ao ciclo, `\|`, BOM/CRLF) e `progresso(v)`; ferramenta MCP `progress` e `vault progresso <pasta>` mostram dadas/adiadas/descartadas e a próxima aula sem linha por turma e ciclo. 3 testes unitários + 1 de integração. **App:** `lib/usePreferencias.js` (aparência e layout), `lib/useNavegacao.js` (tela, pastas, abas) e `lib/store.js`; `lib/useNotaAberta.js` (nota aberta, salvamento com conflito, fechamento da janela, sumário/palavras). `App.jsx` caiu de 525 para ~390 linhas. |

### A conferir (não verificado)
- **Etapa 10:** o app ainda usa o leitor JS (`semana.js`/`ciclos.js`); o Rust é um segundo leitor, só de leitura, para CLI/MCP. Não foi feito: usar o núcleo no app (comandos Tauri + backend do `vite.config.js`) nem portar a edição (`reescrever`), por risco e porque o app precisa seguir funcionando no navegador de dev. Dois leitores podem divergir: qualquer mudança de formato precisa dos dois (testes cobrem os dois). `App.jsx` ainda concentra histórico de navegação, atalhos, diálogos e as operações de pasta/renomear. Verificado no navegador de dev: telas, tema, zoom, Voltar e abrir nota; **não** digitar/salvar/conflito (a tela da aula abriu em modo “Ver”) nem o app Tauri.
- **CSP** (etapa 6): testar no app instalado/`tauri dev --release`: diagramas Mermaid, imagens, exportação DOCX/PDF, atualizador. Se algo falhar, suspeitar da CSP primeiro.
- **Conflito e fechamento** (etapa 3): editar o arquivo por fora e digitar no app; fechar a janela com nota por salvar.
- **Saúde** (etapa 5): no vault real podem aparecer avisos novos (`nome-repetido`, `arquivo-ilegivel`).
- **`_sistema/fichas`** (etapa 6) foi ocultada do MCP por precaução; se for material aberto, tirar de `hidden()` em `src/mcp.rs`.
- Limites conhecidos: a detecção de conflito só protege quem passa por `read_note`/`save_note`; editar a Semana regera a linha alterada (espaçamento pode mudar) e não atualiza `ano:` ao acrescentar turma de outra série; o teste do validador (tabela curta) não foi rodado contra o código antigo.
- Etapa 9: **imagens pelo protocolo `asset:` não foram testadas no app Tauri** (só compila; no navegador de desenvolvimento segue o data URL). Se as fotos de Correção, imagens do editor ou do texto não aparecerem, suspeitar de `assetProtocol`/CSP/escopo. A troca só de maiúsculas foi testada no Linux (não exercita o caso do Windows). `move_entry` não faz reescritas, por isso não mudou. O desfazer cobre falha de gravação, não “arrependimento” (para isso há o histórico de versões).
- Etapa 8: verificado no navegador de desenvolvimento só Correção (janela estreita) e Semana. Não conferidos: Correção só pelo teclado, Diário, Saúde, Ano e ciclos. Contraste do texto secundário medido por cálculo (todos os 28 temas ≥ 4,5:1 sobre o fundo; não sobre fundos `muted`). A área de temas/fontes já tinha a prévia fixa (`sticky`); não mexi. Quem já escolheu “grade” nas listas mantém a grade (preferência salva).
- Etapa 7: o CI novo não foi executado (só os mesmos comandos, localmente). `clippy` só aponta avisos de estilo (11 `if` colapsáveis etc.), não corrigidos de propósito; ESLint tem 8 avisos de `eslint-disable` sem uso. Instalar o clippy local exigiu `rustup component add clippy`.

---

## Etapa 1 — Perda de dados no editor (urgente) ✅ feita
- Ctrl+Z após abrir nota grava o texto da nota anterior (`Editor.jsx:50`). Usar `view.setState` com `EditorState` novo por nota (ou `Transaction.addToHistory.of(false)`); o mesmo em "Restaurar versão".
- Pronto quando: abrir A, abrir B, Ctrl+Z não altera B nem dispara salvamento.

## Etapa 2 — Núcleo sem pânicos ✅ feita
- `validate.rs` (linhas ~233, 251–252, 284): trocar `row[i]` por `.get()`; testes com `| Pontuação |` e linha só `|`.
- `main.rs` do Tauri: trocar `lock().unwrap()` por tratamento de erro (Mutex envenenado não pode derrubar todos os comandos).
- `historico.rs` `hist_ids`: considerar só arquivos `.md` (evita `--limpar` apagar `.historico/Anos`); teste com pastas numéricas.
- Pronto quando: `cargo test` cobre os três casos.

## Etapa 3 — Gravação segura ✅ feita
- Escrita atômica (arquivo temporário + rename) no Tauri.
- Detecção de mudança externa: comparar mtime/hash antes de gravar; `open()` reler quando o arquivo mudou (`App.jsx:223`); avisar em vez de sobrescrever.
- Salvar no fechamento da janela de forma síncrona/aguardada.
- Pronto quando: editar o arquivo por fora e digitar no app mostra aviso de conflito.

## Etapa 4 — Semana sem reescrita destrutiva ✅ feita
- Substituir `reescrever` (`semana.js:204`) por edição localizada (frontmatter extra e texto livre preservados), no padrão de `situacaoAula`.
- Testes de `lib/semana.js` primeiro (ver etapa 7).
- Pronto quando: adicionar/remover/promover aula preserva tudo fora da tabela.

## Etapa 5 — Robustez do vault ✅ feita
- Pular `.md` não UTF-8 e avisar na Saúde (`vault.rs:78`).
- Tolerar BOM e CRLF (Rust e leitores JS: `parseCiclo`, `parseCorrecao`, `parseSemanaNota`).
- Nomes repetidos: aviso no validador; impedir em `create_note`/`rename_entry` do app.
- `edit-cell` escapar `|` (`tables.rs:90`).
- Pronto quando: cada caso tem teste e aparece na Saúde.

## Etapa 6 — Segurança menor ✅ feita
- CSP básica em `tauri.conf.json`; bloquear links `javascript:` no `marked`.
- MCP: cadeado de pasta independente da raiz; revisar `reorganizar` → `_sistema/notas`.
- Atualizar descrição da ferramenta `validate` do MCP.

## Etapa 7 — Rede de testes e CI ✅ feita
- Testes (vitest) para `lib/semana.js`, `ciclos.js`, `correcao.js`, `frontmatter.js`.
- CI: `cargo test` do Tauri + `vite build`.
- Alinhar o backend de dev do `vite.config.js` ao núcleo (campos de ciclo abandonados).
- Rodar `clippy` no núcleo e pôr um lint básico (ESLint) no frontend; corrigir só o que apontar de erro real.
- Casa: versão única em três arquivos, renomear `editor-md-app`, `--ano` padrão fixo.

## Etapa 8 — Interface (correções) ✅ feita
- Correção em 1024 px: colunas flexíveis, transcrição com largura mínima; explicar ou remover "ab 0" e ". 0".
- Saúde: esconder nível "info" por padrão; mover instruções de terminal para a documentação.
- Diário: datas legíveis; texto do aviso do MCP sem jargão.
- Semana: só "Dada" à vista, Adiada/Descartada em menu.
- Rótulos: "Markdown / Personalizada" → "Editar / Ver"; unificar "Ano e ciclos" / "Planejamento".
- Aulas: ver modo lista densa; Questões: título do `# ` em vez do nome do arquivo.
- Ano e ciclos: tirar a data de hoje acima do título.
- Semana no sábado: deixar claro que é a semana seguinte (ex.: rótulo "Próxima semana"), para "3 aulas dadas" não confundir.
- Aulas: indicar a regra "um clique seleciona, dois abrem" (ou abrir com um clique, como nas outras telas); lista mais densa no lugar dos cartões de pasta grandes.
- Correção, lista: o título do cartão não repete turma, mês e atividade já mostrados abaixo.
- Correção: testar o uso só pelo teclado.
- Diário: aproveitar melhor o espaço da tela.
- Conferir contraste dos textos pequenos. Congelar a área de temas/fontes.

## Etapa 9 — Operações multiarquivo e desempenho ✅ feita
- Renomear, promover aula e ajustar semanas: validar antes e permitir reverter.
- Salvamento: validar só a nota alterada; imagens via `convertFileSrc` em vez de base64.
- Renomear só com troca de maiúsculas no Windows.

## Etapa 10 — Arquitetura (antes de telas novas) ◐ parcial
- Mover leitura/edição de semana e ciclo para `vault_core` (um único leitor; CLI e MCP passam a entender o progresso).
- Quebrar o estado de `App.jsx` (roteamento e ~45 estados).
- Só depois retomar telas novas.

## Etapa 11 — Verificação no Windows (antes de publicar a próxima versão)
- A avaliação só testou no navegador, contra um servidor de mentira. Instalar a versão e conferir no Windows real: abrir o vault, salvar, atualizador, exportação DOCX/PDF, montagem de prova, renomear, pasta sincronizada.
- Rodar os testes do Tauri e o `tauri dev` pelo menos uma vez.

## Ordem e dependências
1 → 2 → 3 são independentes e podem ir em qualquer ordem, mas todas antes de qualquer tela nova. 7 (testes) deve preceder 4 e 10. 8 pode correr em paralelo com 5–6.
