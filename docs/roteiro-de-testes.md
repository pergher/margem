# Roteiro de testes e avaliação — editor-md

Como usar: rode `npm run tauri dev` na pasta `app` (vault de teste, nunca o real). Para cada item marque `[x]` se funcionou, `[~]` se funcionou com problema, `[ ]` se falhou, e anote em **Obs.** Ao final de cada bloco dê uma **nota de 1 a 5** para a utilidade (vale a pena manter?) e outra para a facilidade de uso.

Legenda: 🅣 = só foi testado no navegador, **precisa conferir no Tauri**.

---

## 0. Preparação
- [ ] O app abre e mostra o vault de teste na árvore à esquerda.
- [ ] Nenhum erro visível no rodapé ou na janela ao abrir.
- [ ] Fechar e abrir de novo mantém tema, larguras e última tela.

## 1. Editor de notas (etapas A–E)
- [ ] Abrir uma nota pela árvore; o texto aparece com renderização ao vivo (títulos, negrito, listas, callouts).
- [ ] Clicar num elemento mostra a fonte (`##`, `**`).
- [ ] Negrito/itálico dentro de callout funcionam.
- [ ] Editar e esperar: o rodapé mostra "Salvo às…" e o arquivo muda no disco.
- [ ] Zoom (atalho) aumenta/diminui o texto.
- [ ] Ctrl+B oculta/mostra a coluna de arquivos.
- [ ] Coluna de arquivos e sumário redimensionam arrastando; duplo clique volta ao padrão.
- [ ] Migalhas, voltar/avançar funcionam.
- [ ] Wikilink `[[…]]`: Ctrl+clique abre a nota (inclusive dentro de célula de tabela).
- [ ] Tabela: editar célula, adicionar/remover linha e coluna; Inserir tabela (Ctrl+Alt+T).
- [ ] Barra de rolagem central estilizada.
- [ ] Página de **Atalhos**: mudar um atalho, usar, reabrir o app (continua?). 🅣 arquivo no Tauri
- **Nota utilidade / facilidade:** __ / __   **Obs.:**

## 2. Árvore: criar, renomear, excluir, mover (F)
- [ ] Criar nota nova numa pasta (grava na pasta do tipo).
- [ ] Renomear; os links que apontam para ela continuam funcionando?
- [ ] Excluir: a nota vai para `.lixeira` (conferir no disco).
- [ ] Arrastar nota para outra pasta; desfazer o movimento.
- **Nota:** __ / __   **Obs.:**

## 3. Painel direito: Sumário, Propriedades, Links (G)
- [ ] Sumário leva ao título ao clicar.
- [ ] Propriedades: editar um campo do frontmatter e conferir o arquivo.
- [ ] Links: backlinks listam quem cita a nota; links quebrados aparecem avisados.
- [ ] Validação ao salvar avisa um campo inválido.
- **Nota:** __ / __   **Obs.:**

## 4. Busca (H) e Paleta (P)
- [ ] Ctrl+K busca por nome e **no conteúdo**; abre no resultado.
- [ ] Embeds de imagem `![[foto.jpg]]` e de nota aparecem.
- [ ] Ctrl+P: ir para cada tela, abrir nota por nome, salvar, tema, zoom, voltar/avançar.
- **Nota:** __ / __   **Obs.:**

## 5. Histórico de alterações (K, V)
- [ ] Editar uma nota 2–3 vezes; aba Histórico lista versões.
- [ ] Ver o diff de uma versão; **Restaurar** devolve o texto.
- [ ] Na pasta `.historico/` há snapshots (≤1 a cada 10 min, máx. 60).
- [ ] CLI: `vault historico <pasta>` lista (simulação); `--limpar` só com cuidado.
- **Nota:** __ / __   **Obs.:**

## 6. Tela Semana — a tela inicial (L, Q, AB, AE, AF)
- [ ] O app abre na Semana; navegar entre semanas.
- [ ] Sem nenhuma semana: "Importar do Planejamento antigo" cria `Semana 0000 - Histórico importado`.
- [ ] **Semana nova**: sugere por turma as não dadas + próximas do ciclo; ✕ tira; "aula avulsa" acrescenta; "+ Turma"; seletor de ciclo por turma.
- [ ] Marcar **Dar aula ✓ / ↷ Pulei / ❔ Não sei**; "desfazer"; conferir a marca no arquivo.
- [ ] Texto legível (fonte maior).
- [ ] Promover aula avulsa ao fim do ciclo.
- [ ] **Preparar aula**: pacote com a aula, recursos, anterior/seguinte, conteúdos, habilidades.
- [ ] Alternância "1. Markdown | 2. Semana" ao abrir uma nota de semana.
- **Nota:** __ / __   **Obs.:**

## 7. Tela Ano e Ciclo (I, M, N, O, X, AD)
- [ ] Ano: ciclos por trimestre, situação e progresso por ciclo.
- [ ] Abrir um ciclo: sequência de aulas, fases coloridas, recursos clicáveis.
- [ ] **+ Aula**, **↧** inserir (desloca) e **✕** remover (sobe). Depois, conferir que o ✓ da Semana acompanha o deslocamento.
- [ ] Arrastar a divisória entre "Dados do ciclo" e a sequência (**novo**; larguras ficam lembradas).
- [ ] **+ Planejar ciclo**: copiar o pedido, colar a proposta do Claude, aceitar/tirar itens, "Criar ciclo".
- [ ] Alternância Markdown / Ciclo ao abrir `Planejamento/NNN…`.
- **Nota:** __ / __   **Obs.:**

## 8. Tela Correção (I, S, AA, AF)
- [ ] Lista de alunos, foto do manuscrito, transcrição, avaliação lado a lado.
- [ ] Nomes ocultos por padrão; revelar.
- [ ] **Lupa** (3×) ao passar o mouse na foto; zoom e rotação.
- [ ] Editar nota por critério: a nota final recalcula e grava na tabela.
- [ ] Pesos: com `_dados.json`, o máximo de cada critério muda.
- [ ] **Visão da turma**: média, mediana, faixas, abaixo da média, pendências.
- [ ] Devolutiva por aluno (copiar/baixar .md) e "baixar todas".
- [ ] Aprovar transcrição (só sem marcas `[?]`/`[ilegível]`).
- [ ] Ordenar por ordem / maior / menor nota / mais marcas.
- [ ] Arrastar as 3 divisórias de coluna.
- **Nota:** __ / __   **Obs.:**

## 9. Tela Prova (I, T, AC, AF, AG)
- [ ] Escolher banco (6º, 7º ano); o 7º ano é lido (A1, B1…).
- [ ] **Sugerir** (2 interpretação + 2 conteúdo + independentes), **Limpar**, filtro por conteúdo.
- [ ] Marcar/desmarcar questões; verificação à direita (limite de linhas, textos, alertas).
- [ ] "Incluir a fonte dos textos".
- [ ] Arrastar as divisórias do banco e da verificação (**novo**).
- [ ] **Salvar como nota** cria `tipo: prova` em `Anos/AAAA/Provas/`.
- [ ] **DOCX da prova**: abrir no Word/LibreOffice; fonte, margens, **duas colunas**, cabeçalho com logo.
- [ ] **Gabarito DOCX**.
- [ ] **PDF / imprimir**: o diálogo de impressão abre e o layout sai certo. 🅣 principal risco
- [ ] Abrir uma prova salva: visão "Prova" (prévia, verificação, editar turma/data/valor).
- [ ] Limite de linhas por folha: calibrar com uma prova real (a tela ignora as colunas).
- **Nota:** __ / __   **Obs.:**

## 10. Atividade a partir de um texto (W)
- [ ] Em Prova → "Atividade de um texto" ou numa nota de texto → "Atividade a partir deste texto".
- [ ] O pedido copiado está completo (texto, ficha, excluídos, formato, numeração).
- [ ] Colar a resposta do Claude: o app confere, insere no banco e soma o gabarito.
- **Nota:** __ / __   **Obs.:**

## 11. Diário e alunos (R, AG)
- [ ] Novo diário a partir de uma semana (uma seção por aula da turma).
- [ ] Editar com autosave; estados da transcrição (pendente / aguardando revisão / aprovada).
- [ ] Foto ao lado da transcrição; arrastar divisórias de lista e foto (**novo**).
- [ ] **+ Ocorrência** insere `- [[Aluno]] — texto`.
- [ ] Aba Alunos: cadastrar, ocorrências reunidas, **copiar resumo** para o Conselho; nomes borrados.
- [ ] Confirmar que o MCP **não** enxerga `Diarios/` e `Alunos/`.
- **Nota:** __ / __   **Obs.:**

## 12. Texto (AG)
- [ ] Nota de `Acervo/Textos` abre na visão "Texto": ficha, leitura, imagem embutida.
- **Nota:** __ / __   **Obs.:**

## 13. Configurações (AA, AC, AF)
- [ ] Seção Atalhos.
- [ ] Cabeçalho das provas: escola, linha 2, logo (PNG/JPG), duas colunas, linhas por folha.
- [ ] A logo é gravada em `_sistema/anexos/` e a nota `_sistema/Configuração das provas.md` aparece (após atualizar a árvore). 🅣
- **Nota:** __ / __   **Obs.:**

## 14. Saúde do vault (U)
- [ ] Abre pelo menu/Ctrl+P; mostra os avisos agrupados (referência: ~143 avisos / 27 erros na cópia de teste).
- [ ] Filtro e clique abrem a nota.
- [ ] Correções rápidas (definir `tipo`, preencher campo, criar nota de link quebrado) e "Verificar de novo" — a contagem cai.
- [ ] O app **não** aplica `reorganizar`/`migrar` sozinho.
- **Nota:** __ / __   **Obs.:**

## 15. Núcleo: CLI e MCP
- [ ] `vault validate <vault>` bate com a tela Saúde.
- [ ] `vault migrar` / `reorganizar` **simulam por padrão**; só `--aplicar` grava (e guarda histórico).
- [ ] MCP: `plan_ciclo` sem `gravar` só propõe; com `gravar: true` cria sem sobrescrever.
- [ ] MCP não cria/altera nada nas pastas sensíveis.
- **Nota:** __ / __   **Obs.:**

---

## Avaliação geral
| Tela / recurso | Uso no dia a dia (1–5) | Falta / sobra | Prioridade |
|---|---|---|---|
| Editor | | | |
| Semana | | | |
| Ano / Ciclo | | | |
| Correção | | | |
| Prova | | | |
| Diário / alunos | | | |
| Saúde | | | |

Perguntas finais:
1. Qual tela você abriria todo dia? Alguma que nunca abriria?
2. O que é lento, confuso ou feio?
3. O que falta para trocar o fluxo antigo (papel/Obsidian) por este?
4. Está pronto para o **vault real** (cópia + simulação)? Se não, o que bloqueia?
5. Depois dos testes: git, atualização automática, Windows — qual primeiro?
