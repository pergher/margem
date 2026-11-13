# Melhorias de interface e ideias futuras

Criado em 2026-11-13, a partir de três artefatos de desenho ("Esboço de telas", "Margem — telas revisadas", "Margem — telas") e da revisão de cores, fontes, espaçamentos e interação. Regra desta rodada: **nenhuma tela nova**; melhorar o que existe e anotar o resto.

## Parte 1 — Ajustes no que já existe (fazer agora)

### 1. Tokens de design (base de tudo)
Hoje: cores em `index.css` (shadcn, HSL) + temas em `themes.css`; espaçamentos e raios soltos nas classes Tailwind.
- Raios: reduzir a 8, 12 e pílula (`rounded-lg`, `rounded-xl`, `rounded-full`); trocar `rounded-md`/`rounded-sm`/`10px` espalhados.
- Escala de espaçamento: 4, 8, 12, 16, 24, 32 (evitar `p-[…]`, `gap-[…]` fora dela).
- Altura de controles: 40 px no desktop (hoje `Button`/`Input` = h-9, 36); 48 px só no toque (futuro Android).
- Texto base 15 px (hoje 14 px/`text-sm`); horários e durações com `tabular-nums`.
- Rótulos em caixa-alta pequena: manter só nos cabeçalhos de painel lateral (hoje 13 ocorrências de `uppercase`).
- Registrar a escala num bloco comentado no topo de `index.css` para servir de referência única.

### 2. Cores com papel único
- O app já usa verde-azulado (`--primary` 186 35% 28%) nos botões — a sugestão de sair do laranja/vermelho **já está atendida** aqui; manter.
- Reservar vermelho só para a margem/correção (marcas de erro na transcrição, linha de correção). Conferir `chart-5`/`destructive`.
- Fundos: três níveis (lateral, área de trabalho, "papel" só onde há documento). Auditar `--muted`, `--secondary`, `--accent`, `--card`, que hoje são quase iguais no tema padrão.
- Trio de estados fixo: **certo / atenção / erro**, sempre com ícone ou texto junto (não só cor). Criar três variáveis (`--ok`, `--warn`, `--err`) e aplicá-las em: status do plano ("Pronto" × "Sem plano" × "Atrasado") na Semana e no Ano, avisos da Saúde, "salvo/erro" no rodapé, mensagens de formulário.
- Um botão principal (preenchido) por tela; o resto `outline`/`ghost`. Revisar Semana, Diário, Correção, Prova.

### 3. Fontes
- Serifa (Source Serif) = "isto é conteúdo seu": só no documento (editor, título da nota, texto transcrito, prévia da prova). Títulos de seção da interface passam a Inter 600.
- Mono só no código Markdown e no frontmatter bruto.

### 4. Foco e hover visíveis (Windows e teclado)
- Anel de foco único (`focus-visible:ring-2 ring-ring`) em **todos** os botões, linhas de lista, itens da árvore e do rail — hoje só `Button`/`Input`/`CicloPage` têm.
- Fundo leve no hover em itens clicáveis (`hover:bg-accent/60`) onde falta (rail, cartões do Ano, linhas da Semana, alunos).
- Navegação por teclado nas listas: ↑/↓, Enter abre, Esc fecha (árvore, lista de alunos, itens da paleta).

### 5. Nomes e navegação
- "Notas" é ambíguo (arquivos × avaliação). Rótulo do menu/árvore → **"Arquivos"**; "nota" continua só para avaliação. Revisar textos: `SaudePage` ("Notas sem tipo" → "Arquivos sem tipo"), botão "Nova nota" → "Novo arquivo"/"Novo documento" (decidir), paleta de comandos.
- Rail: hoje tem entradas para Editor, Semana, Ano, Diário, Saúde, Correção, Prova, Config. Decidir um único padrão (rail de ícones **com rótulo no hover/tooltip** e a mesma ordem na paleta Ctrl+K). Telas "filhas" (Ciclo, aluno, lote) não precisam de item: aparecem nas migalhas e voltam pela navegação.
- Adicionar migalha/título consistente no cabeçalho de cada tela (hoje só o editor tem migalhas).

### 6. Listas que escalam (35 alunos)
- Correção e Diário: lista de alunos com **busca** (filtro por nome) em vez de botões soltos; manter nomes ocultos por padrão (olho).
- Correção: atalhos de teclado — 1–4 escolhem o nível do critério, Enter/J avança ao próximo aluno, K volta. Registrar em `lib/shortcuts.js` para aparecerem na página de Atalhos.
- Virtualizar a lista só se passar de ~100 itens (provavelmente desnecessário).

### 7. Tela "Esta semana" com "agora"
(Atenção: a memória do projeto diz para **conversar antes de mexer na Semana**.)
- Destacar a aula atual/próxima pela hora; aulas já passadas ganham ação "Registrar diário". Depende de ter horário por turma (hoje a Semana lê só `Planejamento.md`, sem horário) — ver Parte 2, calendário.
- Estados com cor/ícone próprios (item 2).

### 8. Convenção do Markdown (já resolvida em parte)
- O app já distingue: `> citação` comum = citação (`.cm-quote`, itálico cinza) e `> [!tipo]` = callout. A sugestão de marcador próprio já está atendida; falta **documentar** em `docs/formato-do-vault.md` que `> [!margem]` é o callout de anotação na margem e que `>` puro nunca vira anotação.
- **Feito em 2026-11-13:** `> [!margem]` e a regra de `>` puro, e a tabela de onde ficam os dados, estão em `formato-do-vault.md` (seções "Citação e anotação na margem" e "Onde ficam os dados estruturados"); a nota abaixo sobre `_dados.json` está desatualizada (o app já o lê desde a etapa AF). Falta só decidir `habilidades:` no frontmatter do ciclo.
- (antigo) Definir onde ficam dados estruturados (ocorrências, critérios, BNCC): hoje critérios em `_dados.json` (não lido pelo app), ocorrências no diário. Propor formato (frontmatter × tabela × bloco) e registrar em `formato-do-vault.md` antes de construir.

### 9. Modo foco e modo aula
- O modo foco já existe (`foco`, Ctrl+?, Esc). Ajustes dos desenhos: largura de coluna configurável (520–900 px), parágrafo ativo em destaque e demais atenuados, contador "parágrafo N de M · palavras", rodapé mínimo.
- Modo aula (só leitura do plano, sem ocorrências/notas de alunos): ver Parte 2.

### 10. Estados vazios, carregando, erro, sucesso
Criar componentes únicos (`Vazio`, `Carregando`, `Erro`, `Toast`) com o tom dos desenhos ("Nenhuma nota no 8º A ainda — crie o primeiro plano…") e usar em Semana, Ano, Diário, Correção, Prova, Saúde, VaultGate. Erro: borda/ícone do trio de estados + ação ("Procurar o arquivo"). Sucesso: toast com ação ("Abrir pasta").

## Feito em 2026-11-13 (passo 1; testado só no navegador)
- Raios centralizados em `tailwind.config.js`: sm/md = 8 px, lg/xl = 12 px (sem mexer nos componentes).
- Controles: `Button` 40 px (sm 36), `Input` 40 px; anel de foco de 2 px.
- Foco visível global em `index.css` (botões, links, itens com `tabindex`; exclui o editor) e hover leve em botões sem fundo próprio.
- Variáveis `--ok`, `--warn`, `--err` (claro e escuro) e cores Tailwind `ok/warn/err`; **ainda não aplicadas** nas telas (próximo passo).
- `tabular-nums` no corpo. Texto base (13/15/16) já estava na escala certa.
- **ok/warn/err aplicados (2026-11-13):** todas as cores soltas de estado (`amber-*`, `red-*`, `green-*`, `emerald-*`) em `App.jsx` e `components/` viraram `ok`/`warn`/`err`; `text-destructive` (que não tinha cor definida e não aparecia) virou `text-err`; "Erro…" no rodapé fica em vermelho. Mantidos em vermelho literal só as marcas de correção ortográfica (`decoration-red-500`). Testado só no navegador (tela de Prova); Semana, Correção e Saúde não foram vistas com dados.
- **Ícone nos estados (2026-11-13):** novo `components/ui/estado.jsx` (`<Estado tipo="ok|warn|err" inline>`: ícone + cor + texto, `role="alert"` no erro) usado em todas as mensagens de erro/aviso de página, diálogo e painel; Correção: lista de alunos com ✓/⚠ no lugar do ponto colorido e "Transcrição aprovada" com ✓; Ano: selo "Concluído" com ✓. `vite build` passa; visto no navegador só na Correção. Fora do componente (já têm texto): "(a criar)", marcas `[palavra?]`/`[ilegível]` e o realce de diff.
- **"Notas" → "Arquivos" (2026-11-13):** textos da interface que falavam de arquivo deixaram de dizer "nota": Novo arquivo, Renomear arquivo, Buscar arquivo (também em Atalhos e na paleta), Selecione um arquivo, Arquivos sem tipo (Saúde), "Abrir como nota" → "Abrir no editor", propriedades/links/versões. "Nota" ficou só para avaliação (Nota final, rubrica, ordenar por nota). **Não mexi na tela Semana** ("nota de semana", "abrir nota", "ainda não tem nota"): conversar antes. Docs (README, roteiro) ainda usam "nota" no sentido de arquivo; o termo do código (`createNote`, "nota" em comentários) não mudou.
- **Alunos com busca e atalhos (2026-11-13, item 6):** campo "Buscar aluno…" na Correção e no Diário (filtra pelo rótulo visível, então nomes ocultos não vazam; o aluno aberto fica sempre na lista; "n de m" e J/K seguem a lista filtrada). Correção: J/K = próximo/anterior aluno, ↑/↓ = critério ativo (destacado), 1–4 = nível, 0 = zerar (repetir o nível já marcado o desfaz, como na estrela). Atalhos de tela são teclas simples (`plain: true` em `lib/shortcuts.js`), só valem com a tela aberta (`handlers`) e fora de campos de texto; aparecem e podem ser trocados na página de Atalhos (sem exigir Ctrl/Alt). Enter não foi usado (conflita com botões focados). Testado só no navegador; a gravação da nota no Tauri já existia.
- Falta: estado "incerta" da Semana (só borda âmbar), "Plano pronto/Sem plano" (não existe no app ainda), espaçamentos fora da escala (`p-[…]`), caixa-alta fora de painéis laterais, temas de `themes.css` sem `--ok/--warn/--err`, conferir telas Semana/Correção/Diário com os novos raios e o hover global.

- **Início = página de trabalho diário (2026-11-13):** a Semana virou a página inicial, com seletor "Semana | Ano e ciclos" (o Planejamento saiu do menu; Ctrl+P ainda leva ao Ano) e a faixa "Correções em curso" (lotes não finalizados/arquivados, um clique abre o lote). Semana: 4 espaços por turma (turmas e número em `Turmas AAAA.md`, Configurações → Turmas do ano); espaço vazio → sugestões do ciclo ou texto livre; "Preencher" completa a turma com as próximas aulas do ciclo; a tela "Semana nova"/rascunho foi removida (semana nova traz só as aulas não dadas). Testado só no navegador; faltam Tauri e o "agora" (horário).

## Ordem sugerida
1. Tokens (1) + foco/hover (4) — mexem pouco em lógica, ganho em todas as telas.
2. Estados (2, 10) e nomes (5).
3. Lista de alunos com busca e atalhos (6).
4. Documentar Markdown (8); depois "agora" na Semana (7) após conversar.

## Parte 2 — Ideias para o futuro (não implementar agora)

- **Leitura antes de edição:** cada tipo de arquivo (plano, prova, diário, ciclo) abre direto na tela própria, com "Editar fonte" como ação secundária. Hoje o editor abre o Markdown; o app já tem `CicloDaNota`, `ProvaDaNota`, `TextoDaNota` como pontes.
- **Modo aula:** plano em letra grande, etapas marcáveis, tempo por etapa, modo de projeção que esconde ocorrências e notas de alunos.
- **Hoje com "agora"** (tela inicial): aula atual/próxima, "Registrar diário" nas encerradas. Precisa de horário por turma (um `horario` em `_sistema` ou no ano).
- **Calendário:** datas dos ciclos, deslocar aula, situação dada/prevista (já listado em I.2/I.3).
- **Aluno, Relatório de desempenho, Cobertura da BNCC, Catálogo de textos, Mapa de conteúdos, Montar prova (versão do desenho):** telas dos artefatos que ainda não existem no app, ou existem em forma simples; avaliar uma a uma. Relatório e Aluno dependem de decidir onde ficam ocorrências/critérios (item 8).
- **Android/celular:** poucas telas (Hoje, plano em leitura, registro rápido de ocorrência, foto de redação). Antes é preciso decidir como a pasta de arquivos chega ao celular (sincronização do vault).
- **Atalhos 1–4 e Enter** como padrão de revisão rápida em qualquer lista de avaliação.
- **Tela de configurações** com aparência (callouts, tema, tamanho do texto) e atalhos — já existe base em `SettingsPage`/`ShortcutsPage`.
- **Toque:** altura de controle 48 px quando `pointer: coarse` (CSS media query), sem precisar de app separado.

## Referências (artefatos)
- Esboço de telas (14 telas, estilo "Margem"): https://claude.ai/artifact/TVTpVtk1j65bfnxmbsihyq
- Margem — telas revisadas (Hoje, Plano, Modo aula, Correção): https://claude.ai/artifact/MRfMSj3duiUWHv8NvcNJk7
- Margem — telas (19 telas, inclui Estados, Janela, Foco, Config): https://claude.ai/artifact/JiVvTTMBdb1tnEK5VfHRDU
