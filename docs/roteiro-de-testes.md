# Roteiro de testes e avaliação — Margem

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
- [ ] **Salvar como nota** cria `tipo: prova` em `Acervo/Provas/`.
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

## Etapa K — observador de arquivos (Windows, `tauri dev`)

- [ ] Nota aberta e sem edições: alterar e salvar no Obsidian ou no Bloco de Notas → o texto muda sozinho, status "Atualizada por fora às HH:MM", cursor e Ctrl+Z preservados, sem nova gravação (conferir o histórico: nenhum snapshot novo).
- [ ] Nota aberta com edições pendentes (digitar sem esperar o autosave) e alterar o arquivo por fora → aparece a faixa; o texto digitado não muda. "Carregar a do disco" troca o texto; "Manter a minha" some com a faixa e o próximo salvamento sobrescreve sem perguntar (versão do disco no histórico).
- [ ] Criar uma nota com `vault-mcp create_note` → aparece na árvore sem reabrir o app.
- [ ] Renomear ou apagar a nota aberta por fora → faixa "removida ou renomeada"; o editor não fecha.
- [ ] Salvar no Margem não gera aviso nem recarga (sem ciclo com o Drive).
- [ ] Trocar a pasta do vault em Configurações → o observador acompanha a nova pasta.
- [ ] Alterar a nota com o Margem em segundo plano e voltar à janela → a verificação no foco pega a mudança.

## Etapa L — propostas (Windows, `tauri dev`)

- [ ] Com uma nota aberta, "Propor (teste)" no rodapé → "1 proposta" → o diálogo mostra o primeiro parágrafo em maiúsculas; Aplicar muda o editor; Ctrl+Z do editor e "Desfazer" do aviso funcionam; a nota é salva sozinha.
- [ ] Mesma coisa com a nota **fechada** (abrir outra): Aplicar grava no disco, cria versão no histórico; "Desfazer" restaura.
- [ ] Desmarcar um trecho → só o marcado entra. Recusar → nada muda.
- [ ] Alterar a nota por fora (ou digitar) depois da proposta → Aplicar recusa ("mudou desde a proposta"); nada é gravado.
- [ ] Faixa da Etapa K: nota suja + mudança por fora → "Ver diferenças" mostra editor × disco; "Usar os trechos marcados" mescla e o próximo salvamento não pergunta.
- [ ] Duas propostas pendentes: ‹ › troca entre elas; o contador do rodapé diminui.

## Etapa M — painel de IA (Windows, `tauri dev`, com chave real)

- [ ] Configurações › IA: ligar pede o aviso de privacidade; sem aceitar não liga. Colar a chave → "Chave guardada"; ela não reaparece na tela. Conferir no Gerenciador de Credenciais do Windows a entrada `ia-anthropic` (serviço `br.margem.app`). "Apagar chave" remove. Procurar a chave em `%APPDATA%` do app: não pode estar em arquivo nenhum.
- [ ] "Testar conexão" responde "Conexão ok". Com chave errada: mensagem clara, sem mostrar a chave.
- [ ] Painel IA (Ctrl+Shift+I): pergunta curta sobre a nota aberta; a resposta chega em streaming; Parar interrompe.
- [ ] Pergunta que exija consultar o vault ("há textos sobre anáfora?") → linha "Buscou notas…" e resposta.
- [ ] Numa **aula**: "Adaptar com mais apoio" → cartão "Proposta" → Ver diferenças → aceitar parte → aplicar → Desfazer. O arquivo só muda depois de aplicar.
- [ ] "Ver o que foi enviado" mostra a nota com o texto ainda não salvo; desmarcar "Incluir a nota aberta" não envia a nota.
- [ ] Abrir uma **correção** (ou nota em `Anos/*/Correcoes` ou `Relatorios`) e perguntar algo: aparece o aviso de dados de alunos e o conteúdo NÃO é enviado ("Ver o que foi enviado" confirma). Pedir à IA para ler a correção pelo nome: recusado.
- [ ] Sem internet / chave sem crédito: erro legível no painel, a conversa continua possível.
- [ ] Verificar o custo na página de uso da Anthropic depois de algumas conversas.

## Etapa N — outros provedores (Windows, `tauri dev`)

- [ ] **Ollama local**: com o Ollama rodando e um modelo baixado, escolher "Local (Ollama)" em Configurações › IA (ajustar o modelo ao que você baixou), Testar conexão. No painel: o selo "Nada sai do computador" aparece, a conversa funciona sem chave e sem internet (desligar o Wi-Fi para confirmar).
- [ ] Local com o Ollama parado: erro claro ("o servidor local não respondeu… está rodando?"). Modelo inexistente: erro com a dica `ollama pull`.
- [ ] Local sem ferramentas: a IA responde no texto e não gera cartão de proposta. Marcar "Suporta ferramentas" com um modelo que suporte (ex.: llama3.1) e repetir "Adaptar com mais apoio": deve gerar proposta.
- [ ] **OpenAI** (ou OpenRouter via "Adicionar compatível…"): colar a chave, Testar conexão, conversa curta, uma ferramenta ("há textos sobre anáfora?") e uma proposta. Se a API recusar `max_completion_tokens`/`max_tokens` ou o nome do modelo, anotar a mensagem.
- [ ] Trocar de provedor no painel começa uma conversa nova; provedor sem chave aparece desabilitado.
- [ ] Endereço `http://` fora do computador é recusado ao salvar; `http://localhost:…` é aceito.
- [ ] Nota de correção aberta com o provedor local: o conteúdo continua NÃO sendo enviado ("Ver o que foi enviado").
- [ ] Atualizar do app com o `ia.json` da Etapa M: o modelo do Claude configurado antes continua o mesmo.
