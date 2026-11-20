# Afazeres do Margem (editor-md)

Lista única, **revisada contra o código em 2026-11-18** (versão 0.1.15 no `package.json`; último tag publicado: v0.1.11; `main` igual a `origin/main`). Itens antigos que já estavam feitos ou foram superados saíram da lista e estão em "Verificado: já feito ou superado", no fim.

Regras: vault real só com **simular → cópia → aplicar**; push ao GitHub só com OK do usuário.

---

## P0 — Próximo: Margem no Android (modo compacto)

Mesma base de código, com um modo compacto para telas estreitas. Desenho e protótipo clicável: artefato "Margem no celular" (`https://claude.ai/artifact/6p8px1wan1A96FHo4NTXXj`). O usuário aprovou o desenho e as cinco decisões em 2026-11-18.

**Decisões fechadas**
- **Edição em pedaços:** marcar aula dada, editar uma seção, registrar ocorrência, anotar. Sem o editor completo no celular.
- **Navegação:** barra inferior com Hoje, Documentos e Ano. No tablet (768 a 1024 px) entra o menu só de ícones que já existe (Ctrl+B).
- **Anotar:** botão flutuante nas telas. Na Aula ele vira o botão "Anotar" da barra inferior e grava nas Anotações do professor da própria aula.
- **Modo compacto automático** abaixo de 768 px, com opção em Configurações para forçar ou desligar.
- **Dados no aparelho:** vault sincronizado, funciona sem internet.

**Por ora (provisório)**
- **Sincronização: Syncthing** entre o computador e o celular, para o vault ficar numa pasta que o app lê. O Google Drive não aparece como pasta comum no Android (armazenamento restrito, SAF).
- **Atualização do app: Obtainium**, instalando o APK dos releases do GitHub (`pergher/margem`). O atualizador do Tauri não existe no Android, então esconder o `AvisoAtualizacao` no celular.
- **Dropbox como alternativa à sincronização:** a conversar antes de decidir (ver "Em aberto").

**Etapas**
- [x] **1. Prova de conceito (feita no emulador em 2026-11-19; falta só um celular de verdade):** pasta real `/storage/emulated/0/Syncthing/Escola` lida no emulador com `MANAGE_EXTERNAL_STORAGE` (manifesto aplicado por `scripts/android-manifesto.sh`, chamado também no CI); `vault_sem_acesso` (JNI `Environment.isExternalStorageManager`) mostra a tela `VaultSemAcesso` com as instruções quando falta a permissão e reconfere ao tocar em "Tentar de novo" ou ao voltar ao app. Antes: feito: ferramentas, `tauri android init`, APK x86_64 e aarch64, emulador `margem` mostrando Hoje com vault fictício. Falta: ler a pasta real do Syncthing (permissão de acesso a todos os arquivos), seletor de pastas e testar num celular. Texto original: verificar Java, Android SDK e NDK nesta máquina; `tauri android init`; abrir o vault na pasta do Syncthing e mostrar a tela Hoje no aparelho. Se o acesso ao vault se mostrar inviável, plano B: servidor local no PC acessado pelo navegador do celular via Tailscale.
- [x] **2. Casca (feita em 2026-11-19; a opção em Configurações veio na etapa 5):** `lib/useCompacto.js` (modo `auto`/`sim`/`nao` em `localStorage`, < 768 px) e `BarraInferior.jsx`; `App.jsx` troca `Menu` pela barra, esconde painel direito, foco, rodapé e `AvisoAtualizacao`. **Falta:** opção em Configurações (etapa 5) e o Explorador no compacto (etapa 3, Documentos).
- **Etapa 1 (2026-11-19, parcial):** ferramentas instaladas em `~/Android` (JDK 17, SDK 34, NDK 26.1, alvos Rust); `tauri android init` feito; `main.rs` virou `lib.rs` + `main.rs`; atualizador e `keyring` só fora do Android; `tauri android build --debug --apk --target aarch64` gera `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`. **Feito em seguida:** emulador `margem` (Pixel 6, API 34, x86_64, em `~/Android`) mostra a tela Hoje com o vault fictício; `VaultGate` tem campo de caminho digitado no Android; áreas seguras ajustadas (`viewport-fit=cover`, `BarraInferior`). **Falta:** ler a pasta real do Syncthing (`/storage/emulated/0/…`, exige permissão de acesso a todos os arquivos) e o seletor de pastas de verdade. **Cuidado com memória:** compilar e emulador juntos travaram o PC em 2026-11-19; compilar com `CARGO_BUILD_JOBS=4` e `GRADLE_OPTS="-Dorg.gradle.workers.max=2 -Dorg.gradle.jvmargs=-Xmx1536m"`, parar o Gradle (`./gradlew --stop`) e só então subir o emulador com `-memory 2048 -cores 2`. Antes: esta máquina não tem Java, Android SDK/NDK nem alvos Rust de Android, e `sudo` está bloqueado. Instalar exige baixar JDK 17, command-line tools do SDK, NDK, e `rustup target add aarch64-linux-android` (cerca de 2 a 3 GB) sem root, em `~/Android`.
- [x] **3. Telas (feitas em 2026-11-19, testadas só no navegador; falta rodar no emulador)** — contexto `CompactoContext`/`useEhCompacto()` (`lib/useCompacto.js`); Hoje em uma coluna com blocos recolhíveis (`ui/Recolhivel.jsx`); Documentos em lista plana, um toque abre, filtro por tipo rolante; Ano com abas e turmas rolantes e Semana em uma coluna; Aula com seções recolhíveis, lápis por seção, gaveta de sumário (ícone + arrastar), barra Anotar / Dar aula ✓ (Anotar grava em `## Memória` pela "nota desta vez"; "Dar aula" marca a próxima aula da Semana que cita a nota). `SituacaoAula` não esconde mais nada até o hover no toque. Também feitos: Planejamento e Fechamento só leitura (sem incluir, tirar, arrastar, criar nem marcar itens); Produções só com o andamento (sem Corrigir); Diário só com "Nova ocorrência" (sem novo aluno, novo diário nem editar em Markdown); botão "Anotar" flutuante (+) em todas as telas menos na Aula (que tem o próprio). **Pendências de toque (etapa 7):** o botão flutuante cobre o fim de algumas telas (falta respiro inferior) e o teclado virtual ainda não foi tratado. Texto original: (as mesmas, em uma coluna, alvos de toque de 44 px):
  - **Hoje:** cartões empilhados; Alunos em alerta, Pendências e Reuniões recolhidos; sem Documentos recentes; sem botão "Criar aula" (pede o editor completo): o cartão só avisa que a aula não existe.
  - **Documentos:** lista filtrada por tipo em abas rolantes, sem árvore de pastas; busca pela lupa (mesma paleta do Ctrl+P).
  - **Ano:** abas rolantes fixas no topo; Semana com quadrado de 44 px (dada, pulei, vazio); Planejamento e Fechamento só leitura; Produções só com o andamento; Diário com "Nova ocorrência".
  - **Aula:** leitura com seções recolhíveis; **sumário abre arrastando a tela para a esquerda** (e pelo ícone de lista no topo; sem aba na borda; arrastar para a direita fecha); lápis edita uma seção por vez; barra inferior com "Anotar" e "Dar aula ✓".
- [x] **4. Esconder no compacto (feito em 2026-11-19, testado só no navegador):** atalhos de teclado desligados (`useAtalhos({ compacto })`); menu de toque longo do Explorador desligado; Hoje sem "Continuar correção" nem Saúde; Ciclo só leitura (lista de aulas, sem + Aula, inserir, remover nem arrastar); Prova sem DOCX/PDF/Gabarito nem coluna de dados; tabelas em Markdown puro (`definirTabelasEditaveis`); sem `ResizeHandle` em Ciclo, Prova e Configurações; painel direito, IA e Histórico já fora. **Sobras:** a busca (lupa) ainda abre qualquer nota, inclusive telas de desktop (Correção, Banco); o `BancoDaNota` não tem versão compacta; a paleta de comandos lista telas escondidas (mas sem atalho para abri-la); a Prova sem banco manda "usar Markdown", botão que não existe no celular. Texto original: atalhos de teclado, Ciclo (+Aula e deslocar), Correção (fotos ao lado dos critérios, lupa, pesos), montar prova e exportar, Atividade de um texto, jogos, painel de IA, tabelas editáveis, painel direito, Histórico/restaurar, colunas redimensionáveis, Saúde do vault.
- [x] **5. Configurações reduzidas (feito em 2026-11-19, testado só no navegador):** no compacto, `SettingsPage` vira `ConfiguracoesCompactas` (modo claro/escuro, tema do modo atual, tamanho do texto, pasta do vault e modo compacto); o acesso é a engrenagem no cabeçalho (o Menu não existe no celular). A opção Automático / Sempre compacto / Nunca fica em Aparência no computador e na tela reduzida (`useCompacto` guarda `modoCompacto`). No Android a pasta é digitada (`CaminhoDigitado`, exportado de `VaultGate`). Sem Sobre/atualização (Obtainium), IA, atalhos nem Escola e professor no celular. Texto original: tema, tamanho do texto, pasta do vault, modo compacto.
- [~] **6. Empacotar (job escrito em 2026-11-19, nunca rodou no GitHub):** job `android` em `release.yml` (init, build aarch64, zipalign + apksigner com secrets, `gh release upload`); instruções em `docs/publicar.md`. **Falta:** o usuário criar keystore e secrets, e acompanhar o primeiro release; testar o Obtainium.
- [~] **7. Cuidados do toque (feito em 2026-11-19, só no navegador):** `useTeclado` em `lib/useCompacto.js` (altura da raiz = `visualViewport`, esconde barra e botão com teclado, rola o campo focado para o centro); respiro de 5,5 rem no fim das telas rolantes (`index.css`). Teclado conferido no emulador (campo do Anotar visível, barra some). **Feitos depois (2026-11-19, conferidos no emulador):** seletor de pastas próprio (`listar_pastas` + `CaminhoDigitado` em `VaultGate.jsx`, com o campo de caminho como alternativa), botão "Abrir a tela de permissão" (`abrir_permissao_arquivos`, JNI), `set_vault_root` recusa pasta compartilhada sem a permissão (evita montar a estrutura sobre um vault que parece vazio), atalhos escondidos (Caixa de entrada, paleta, rótulos Voltar/Avançar), busca sem Correção e Banco, Prova sem a menção ao botão Markdown. **Sobras:** o cabeçalho que `lib/caixa.js` grava na Caixa cita Ctrl+Alt+M (texto do vault).

**Em aberto**
- **Dropbox × Syncthing × Drive:** conversar sobre o Dropbox (ver P8). Pontos a decidir: onde o app Android do Dropbox deixa a pasta (precisa ser um caminho que o app lê), cópias de conflito, o que sincronizar.
- **Nota da aula:** hoje vai para as Anotações do professor da própria aula. Alternativa: ir para a Caixa de entrada marcada com a aula de origem.
- **Privacidade no celular:** o MCP já bloqueia `Diarios/` e `Alunos/`; decidir se essas pastas sincronizam para o aparelho (risco de perda ou roubo).
- Conflitos de sincronização: a Saúde do vault precisa reconhecer cópias de conflito (Syncthing cria `*.sync-conflict-*`).
- `.historico/` e `.lixeira/`: sincronizar ou deixar de fora (o Syncthing aceita `.stignore`).

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

## P4b — Ideias aprovadas em 2026-11-18

- [x] **Captura rápida** (Ctrl+Alt+M (antes Ctrl+Shift+N, trocado em 2026-11-19), paleta e botão "+ Anotar" no Hoje): grava `- [ ] texto` em `_sistema/Caixa de entrada.md`; o Hoje mostra a caixa com caixinhas e "Limpar feitas". Só no navegador. **Falta o atalho global do sistema** (fora do app): funciona no Windows com o plugin global-shortcut do Tauri; no Linux/Wayland não.
- [x] **Memória da aula**: seção opcional `## Memória` no fim da aula (`- AAAA-MM-DD · turma · funcionou|ajustar|cortar — texto`); não vira aba; "Da última vez" recolhida no topo só se houver nota; link discreto "+ nota desta vez" no fim. Nunca pergunta nem conta. Falta o toque opcional ao lado do ✓ da Semana (decidir com cuidado, ver Semana simples).
- [x] **Gerador de jogos a partir da aula** (`lib/jogos.js`, `JogoDialog.jsx`; botão "Gerar jogo" na Aula): caça-palavras (3 níveis), cruzadinha e cartas (jogo da memória); palavras sugeridas da aula, dicas escritas por você (ou pedidas ao Claude por texto copiado); prévia, "Embaralhar", PDF/imprimir, gabarito e "Guardar a lista" como oficina em `Acervo/Oficinas` (`jogo:`, `aula:`). Só no navegador; o diálogo de impressão nunca foi visto no Tauri. Falta: reabrir um jogo guardado para gerar de novo (hoje se copia a lista de volta).
- [x] **Fechamento do trimestre** (`lib/fechamento.js`, `FechamentoPage.jsx`): aba "Fechamento" no Ano (e no menu/paleta) com 1º/2º/3º e filtro de turma. Automático: produções não finalizadas, ciclos do trimestre com aulas por dar, diários por transcrever/revisar, reuniões em aberto, alunos em alerta. "Meus itens": lista própria em `Anos/AAAA/Fechamento AAAA.md` (`## 1º trimestre`, `- [ ] item`). No Hoje, uma linha discreta só aparece se houver algo em aberto. Só no navegador. Limites: produções não têm trimestre (aparecem todas as abertas); o filtro de turma não se aplica aos ciclos sem turma ligada; `progressoDoCiclo` foi extraído para `lib/ciclos.js` (usado também pelo Planejamento).
- Adiado: prova objetiva (foto ou lançamento rápido de `ABCDDA`).

## P4c — Do comparativo com o Inkdrop (2026-11-19)

Fonte: `docs/comparativo-inkdrop.md`. Itens decididos com o usuário; a ordem abaixo é a sugerida.

- [x] **Autocompletar `[[`** (feito em 2026-11-20, `lib/wikilinks.js`; testado no navegador, falta ver no Tauri): lista as notas por nome (sem acento nem maiúscula; a pasta aparece ao lado) enquanto digita; se nenhuma tem esse nome, "Criar «nome»" cria a nota na pasta da nota aberta e já liga o link (não abre a nova, para não interromper a escrita). Falta: sugerir títulos depois de `#` e apelido depois de `|`.
- [x] **Tab / Shift+Tab em listas e renumeração** (feito em 2026-11-20, `lib/listas.js`; testado no navegador, falta ver no Tauri): Tab recua o item pela largura do marcador do irmão de cima (não pula níveis), Shift+Tab volta ao recuo do pai; vale para várias linhas selecionadas e para tarefas; o frontmatter é ignorado. Listas numeradas se renumeram após Tab, Shift+Tab e Enter (o item que desce vira 1). Falta: renumerar ao apagar um item (Backspace/Delete), e Tab no celular (sem teclado; um botão na barra do compacto).
- [x] **Barra flutuante** (feito em 2026-11-20, `lib/barraFlutuante.js`; testado no navegador, falta ver no Tauri): aparece acima do texto selecionado com Negrito, Itálico, Destaque (`<mark>`), Código, Link, Título (##), Subtítulo (###), Citação e Lista; cada botão liga e desliga. Não aparece no frontmatter nem em tela de toque (já há o menu do sistema). Os botões são texto (N, I, Ab…): falta trocar por ícones, se você preferir. Sem atalhos de teclado: Ctrl+B já é o menu lateral.
- [x] **Autocompletar emoji** (feito em 2026-11-20, `lib/emojis.js`): `:` + 2 letras, depois de espaço ou no começo da linha (não pega "10:30", "http://" nem `chave:valor`, nem código); busca por nome em português ou inglês, sem acento; insere o emoji em Unicode, não `:codigo:`. A lista tem cerca de 330 emojis escolhidos à mão (rostos, gestos, escola, setas, status): faltam bandeiras e o catálogo completo, se for preciso.
- [x] **Colar link sobre texto selecionado** vira link: já funcionava, é o `pasteURLAsLink` que o `markdown()` do CodeMirror liga por padrão (conferido em 2026-11-20 no navegador: `que` + URL → `[que](URL)`; aceita `http(s)://`, `www.`, `mailto:`). Não faz nada em código, em seleção que cruza formatação nem sem seleção. Sem código novo. **Opcional, não feito:** buscar o título da página ao colar uma URL sem seleção (usaria internet; iria só a URL).
- [x] **Botão "Copiar código"** nos blocos `exemplo` e `sintaxe` (feito em 2026-11-20; `blocoComoMarkdown` em `lib/blocos.js`, ação em `lib/blocoAcoes.js`): copia o bloco como está na nota, com a cerca e as opções (```` ```sintaxe … ``` ````), para colar em outra nota. Vale também no exercício e na visão da aula e do painel de Gramática, que usam o mesmo botão. Os blocos já tinham "Copiar como imagem" e "Pedir ao Claude". Testado no navegador com a área de transferência simulada (o navegador de teste a bloqueia); falta ver a cópia real no Tauri.
- [x] **Saúde: correções automáticas e "Corrigir todos…"** (feito em 2026-11-20; `lib/saudeAcoes.js`, `SaudePage.jsx`; testado no navegador, falta ver no Tauri com o vault real): cada aviso corrigível ganha o botão "corrigir: …" e cada grupo ganha "Corrigir todos…", que **primeiro mostra o que mudaria (nada é gravado)** e só aplica ao confirmar; cada nota ganha uma versão no Histórico. Corrige, só no frontmatter e só em caso sem dúvida: `sem-tipo` e `tipo-desconhecido` (tipo pela pasta), `campo-obsoleto` (tira `turmas` da aula), `marca-pendente` (transcrição aprovada com marcas volta a `aguardando-revisao`) e `valor-invalido` (status por sinônimo, como "Concluído" → `finalizado`; `ano` "7º" → 7; `trimestre`; `turma` e `turmas` escritas como número voltam a texto). Ficam à mão: link quebrado (criar em lote seria criar arquivos vazios por engano), campo vazio, conteúdo fora do vocabulário, nome repetido, total divergente.
- [ ] **Ações em lote no Explorador** (selecionar várias notas: mover, mudar status, duplicar nota); o lote da Saúde já existe. Desenhar antes: seleção por Ctrl/Shift+clique na árvore e na lista de Documentos.
- [x] **Atalho global de captura** (feito em 2026-11-20; `src-tauri/src/atalho_global.rs`, `lib/useAtalhoGlobal.js`; **nunca rodou no Windows**, só compila e passa nos testes): com o Margem aberto em segundo plano ou minimizado, `Ctrl+Alt+M` (a mesma combinação do app; ao trocá-la em Configurações › Atalhos o global acompanha) traz a janela e abre a captura rápida. Plugin `tauri-plugin-global-shortcut` (Rust registra, emite `margem://captura`; o app abre o diálogo). Opção "Captura rápida também fora do Margem" em Configurações › Atalhos (ligada por padrão; some no celular); se o sistema recusar (outro programa usa a combinação; Linux com Wayland), o erro aparece ali. **Conferir no Windows:** que a combinação dispara com o app minimizado; **cuidado:** em teclado ABNT2, `Ctrl+Alt` é o AltGr, então `Ctrl+Alt+M` pode colidir com caracteres digitados (se colidir, trocar por outra, por exemplo `Ctrl+Alt+Espaço`).
- [ ] **Modo bandeja** (fechar a janela mantém o Margem rodando em segundo plano, ícone na bandeja do Windows para reabrir ou sair): só vale a pena junto do atalho global, para ele funcionar também com a janela "fechada". Hoje o atalho só funciona se o app está aberto ou minimizado.
- [ ] **Confirmar no `tauri dev`:** corretor ortográfico em pt-BR (o `index.html` tem `lang="pt-BR"`, falta ver no app) e a aba Histórico do painel direito (listar, comparar, restaurar), que existe com testes automáticos.
- [ ] **Modelos de nota visíveis e editáveis** (ver, alterar e criar novos; hoje são código). **Antes de fazer, conversar sobre o desenho** (ideia: notas `.md` em `_sistema/modelos`).

Decidido não fazer por ora: criptografia do vault/sync, Web Clipper, share sheet, importação do Kindle.

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
- [x] Saúde: correção rápida para marcas pendentes, valores inválidos e tipo desconhecido (feito em 2026-11-20, ver P4c). Falta: a nota de configuração da prova só aparece na árvore após refresh.
- [ ] Conflito de gravação só protege quem passa por `read_note`/`save_note`; o desfazer multiarquivo cobre falha de gravação, não arrependimento (para isso há o histórico).

## P8 — Ideias futuras (sem compromisso)

- **Sincronização via Drive/Dropbox** (para o P0 usa-se Syncthing por ora; o Dropbox será conversado): sem API (OAuth, LGPD); vault como pasta sincronizada. Falta reconhecer cópias de conflito na Saúde, decidir o destino de `.historico/` e `.lixeira/` e poder excluir alunos/diários da sincronização. Drive for Desktop não existe oficialmente no Linux.
- **Nova nota em janela separada** (usar duas notas lado a lado, como no Obsidian).
- **Modos do Markdown** (público futuro: professores amigos): Simples, Padrão, Fonte; sem WYSIWYG completo.
- **Android:** saiu desta lista, virou o **P0** (modo compacto, mesma base de código, Syncthing por ora e Obtainium). iOS descartado.
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

Artefatos de desenho (claude.ai): Margem no celular `…/artifact/6p8px1wan1A96FHo4NTXXj` (modo compacto, aprovado em 2026-11-18); Esboço de telas `…/artifact/TVTpVtk1j65bfnxmbsihyq`; Margem — telas revisadas `…/artifact/MRfMSj3duiUWHv8NvcNJk7`; Margem — telas (19 telas) `…/artifact/JiVvTTMBdb1tnEK5VfHRDU`.
