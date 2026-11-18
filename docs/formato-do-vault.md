# Formato do vault (versão 1, rascunho)

O vault é a pasta `Escola/`. A pesquisa acadêmica (tese, análises, referências) fica em outro vault e não entra aqui.

Regras para toda nota nova. Notas antigas são convertidas pelo comando `vault migrar`.

## Regras gerais

- Toda nota tem `tipo` no frontmatter.
- Chaves em português, minúsculas, sem acento e sem espaço (`mes`, não `mês`). Valores de texto livre mantêm acento.
- Links sempre por nome (`[[nome]]`), nunca por caminho. Nomes de nota são únicos no vault.
- Listas em linha: `turmas: ["61", "62"]`. Texto com `: ` entre aspas (`fonte: "SILVA, A. Obra. São Paulo: Ed. X, 2020."`).
- Códigos de conteúdo (`foco`, `conteudos`, `conteudo`, `conteudos_excluidos`) vêm de `Recursos/_codigos.md`.

## Vocabulários fechados

| campo | valores |
|---|---|
| `status` | `pendente`, `andamento`, `finalizado`, `arquivado` |
| `transcricao` (só correção) | `pendente`, `aguardando-revisao`, `aprovada` |
| `ano` | número de 6 a 9 |
| `turmas` / `turma` | texto de dois dígitos: ano + número da turma (`"61"`) |
| `trimestre` | 1, 2 ou 3 |

## Campos por tipo

| `tipo` | obrigatórios | opcionais |
|---|---|---|
| `aula` | ano, status | assuntos, tags |
| `plano` | ano, trimestre | turmas, status, tags |
| `ciclo` | (nenhum: atemporal) | objetivo, sufixo, habilidades, conteudos, status, textos_sala, textos_prova, tags |
| `calendario` | inicio, fim, feriados, turmas | recessos |
| `texto` | titulo, autor, genero, fonte, dominio_publico, foco, conteudos, alertas | publicacao, link, imagem, tags |
| `oficina` | (nenhum) | titulo, anos, conteudo, tags |
| `banco` | ano, conteudos, conteudos_excluidos, textos | |
| `prova` | turma, data, questoes, valor | |
| `semana` | ano, rotulo | — |
| `diario` | ano, turma, semana, transcricao | fotos |
| `aluno` | ano, turma | — |
| `correcao` | turma, mes, atividade, rubrica, status, transcricao | arquivado_em |
| `rubrica`, `taxonomia` | (nenhum) | |
| `configuracao` | (nenhum) | escola, linha2, logo, duas_colunas, limite_linhas (nota `_sistema/Configuração das provas.md`) |
| `habilidades-bncc`, `habilidades-cbtc` | ano | |

## Nota de semana (`tipo: semana`)

Uma tabela por turma (`### 61`), com `Ciclo: [[Crase]]` logo abaixo do título e as colunas `Aula | Recurso | Ciclo`. Na coluna **Ciclo** a linha aponta a aula do ciclo (`[[231 - Crase]] 3`) ou fica vazia (aula avulsa). A **situação** da aula é uma marca no fim da célula *Aula*:

| marca | situação | conta no progresso do Ano? |
|---|---|---|
| (nenhuma) | planejada | não |
| `✓` | dada | sim |
| `↷` | pulei | não (volta na sugestão da semana seguinte) |
| `❔` | não sei | não (idem) |

Se um ciclo ganhar ou perder aulas pela tela Ciclo (inserir, deslocar, remover), o app ajusta o número da aula nas linhas das semanas que apontam para ele.

## Turmas do ano (`tipo: configuracao`)

`Anos/AAAA/Turmas AAAA.md` guarda as turmas do ano e quantas aulas cada uma tem por semana: `turmas: ["61", "62"]` e `aulas_por_semana: 4`. A tela Início → Semana mostra esse número de espaços por turma (4 por padrão); no ano seguinte basta criar outra nota. Edita-se em Configurações → Turmas do ano. Sem a nota, a Semana usa as turmas que já aparecem nas notas de semana.

Na Semana, cada espaço vazio recebe uma aula do ciclo (com sugestões: as próximas ainda sem semana) ou um texto livre (aula avulsa, ex.: aula atípica). A nota de semana nova traz só as aulas não dadas da anterior; os outros espaços ficam vazios.

## Configuração das provas (`tipo: configuracao`)

O app guarda o cabeçalho das provas na nota `_sistema/Configuração das provas.md` (nada fica só no navegador): `escola` e `linha2` (texto do cabeçalho), `logo` (nome do arquivo PNG/JPG em `_sistema/anexos/`, ex.: `logo-escola.png`), `duas_colunas` (true/false) e `limite_linhas` (linhas por folha, calibrado com uma prova real). Edita-se em Configurações → Cabeçalho das provas ou direto na nota.

## Pesos da correção

A nota de cada critério na tabela `### Avaliação` já é em pontos (ex.: Ortografia, de peso 2, vai de 0 a 2). O app lê o `_dados.json` da pasta da correção: o `peso` de cada critério é o seu máximo e `gradacao` (ex.: 0, 0,25 … 1) multiplicada pelo peso dá as notas que o menu oferece. Sem `_dados.json` (ou com `criterios` só em texto), todos os critérios valem o mesmo máximo, lido do texto da rubrica.

## Citação e anotação na margem

- `> texto` (sem colchetes) é **citação**: o editor mostra em itálico cinza com barra à esquerda. Nunca vira anotação.
- `> [!tipo] Título` é **callout**: `note`, `tip`, `warning`, `example`, `question`, `important`, `abstract`, `info`, `professor`. Linhas seguintes com `>` fazem parte dele; `+`/`-` depois do tipo (`[!tip]-`) são aceitos.
- `> [!margem] Título` é a **anotação na margem**: observação do professor sobre o trecho (ex.: um lembrete na transcrição de uma redação). Só `[!margem]` é anotação; um `>` puro, mesmo perto de uma, continua sendo citação.

## Onde ficam os dados estruturados

Regra: dado que o app lê e grava mora **na nota a que pertence**, em tabela ou lista; o frontmatter guarda só metadados da nota inteira; `_dados.json` só guarda configuração que o app lê e não grava.

| dado | onde fica | formato |
|---|---|---|
| critérios e notas de uma redação | nota da correção, `### Avaliação` de cada aluno | tabela `Critério \| Nota \| Comentário`; "Nota final" é a última linha |
| pesos e gradação dos critérios | `_dados.json` na pasta da correção | `peso`, `gradacao`, níveis dos descritores (só leitura para o app) |
| ocorrências de aluno | diário da turma, seção `## Aula N — texto` | linha `- [[Nome]] — #etiqueta texto`; a nota do aluno não guarda cópia, o app junta lendo os diários. Etiquetas: `#conversa` `#produtividade` `#espelho` `#andando` `#briga` `#celular` `#positivo` (sem etiqueta, a página Diário sugere pelo texto e marca como “sugerido”) |
| ações com o aluno | nota do aluno, seção `## Ações` | linha `- AAAA-MM-DD [14h] — #tipo #comportamento #estado texto`; tipo: `#conversar` `#diretoria` `#agendar` `#notificar`; estado: `#planejada` ou `#feita` |
| situação da aula | nota de semana | marca no fim da célula *Aula* (ver acima) |
| habilidades/códigos BNCC | nota do ciclo | texto da habilidade com o código no início (ex.: `EF69LP…`); sem campo próprio por ora |

Proposta ainda **não** implementada, para decidir quando a tela de cobertura da BNCC existir: lista `habilidades: ["EF69LP32", …]` no frontmatter do ciclo, com os códigos conferidos contra `Recursos/_codigos.md`, para o app contar a cobertura sem ler o texto.

## Ferramentas

- `vault validate <pasta>` confere tudo o que está acima; veja os códigos de aviso no [README](../README.md).
- `vault migrar <pasta> [--aplicar]` aplica a tabela abaixo (simulação por padrão).
- `vault reorganizar <pasta> [--aplicar]` aplica a estrutura de pastas do fim deste documento.

## Mudanças em relação ao vault antigo

| antes | depois |
|---|---|
| `type: class` / `plan` / `correção` / `bncc` | `tipo: aula` / `plano` / `correcao` / `habilidades-bncc` |
| `year: ["6"]` | `ano: 6` |
| `period: ["63"]` (aula) | removido: a aula é do acervo e vale em qualquer ano; a turma vive no ciclo ou plano |
| `period: ["2"]` (plano) | `trimestre: 2` |
| `type: plan` com nome `ATC - Título - PR` (A = ano, T = trimestre, C = ciclo) | `tipo: ciclo`, `ano`, `trimestre` e `ciclo` (pelo nome do arquivo); sem datas: a ordem das aulas é a da tabela `## Aulas` e as aulas dadas ficam em `Planejamento.md` |
| `subject` | `assuntos` |
| `title`, `author` (texto) | `titulo`, `autor` |
| `ano` (texto: ano de publicação) | `publicacao` (`ano` fica só para o ano escolar, 6 a 9) |
| `mês`, `arquivado` (correção) | `mes`, `arquivado_em` |
| `status: Não iniciado` / `Em andamento` / `Finalizado` | `pendente` / `andamento` / `finalizado` |
| `status: transcrição aprovada` | `status: andamento` + `transcricao: aprovada` |
| texto sem `tipo` | `tipo: texto` |
| `banco-questoes-*` sem frontmatter | `tipo: banco`, `ano` (pelo título), `textos` (pelas fichas citadas no corpo); `conteudos` e `conteudos_excluidos` ficam `[]` para preencher |
| `_codigos.md` sem frontmatter | `tipo: taxonomia` |

Fora do que o comando converte (decisão manual): tipos `ficha`, `material didático`, `jogo didático`, `diary`, `nota`, `resource`, e notas sem frontmatter.

## Estrutura de pastas (proposta)

```
Escola/
├── _sistema/        CLAUDE.md, templates, rubricas, codigos (taxonomia), BNCC e CBTC
├── Acervo/          perene: serve em qualquer ano
│   ├── Aulas/<assunto>/
│   ├── Ciclos/      ciclos atemporais: 16 aulas, nome = título (sem ano, trimestre nem turma)
│   ├── Gramática/   referência por tópico (regra, exemplos, dúvidas), atemporal
│   ├── Textos/      fichas de texto
│   ├── Questoes/    bancos de questões
│   ├── Oficinas/    jogos e dinâmicas
│   └── Provas/      provas montadas (turma e data no cabeçalho)
└── Anos/
    └── 2026/
        ├── calendario.md
        ├── Planejamento {AAAA}.md   o plano anual: tabela Ano | Trimestre | Ordem | [[Ciclo]], sem turma
        ├── Planejamento/   planos antigos por turma (legado)
        ├── Semanas/        uma nota `tipo: semana` por semana (aulas dadas ✓, avulsas)
        ├── Diarios/<turma>/   diário de aula por turma e semana (sensível, bloqueado no MCP)
        ├── Alunos/<turma>/    uma nota por aluno, com as ocorrências (sensível, bloqueado no MCP)
        ├── Correcoes/<turma>-<mes>-<atividade>/   transcrições, fotos, devolutivas, visão da turma
        ├── Relatorios/
        └── Diario/
```

- **Acervo** não tem ano nem turma. **Anos/AAAA** é tudo o que pertence a um ano letivo e pode ser arquivado inteiro.
- Links são por nome, então mover pastas não quebra nada. Exceção: embeds de imagem por caminho (`![[Fotos/Foto 27.jpg]]`) precisam ser ajustados.
- Nomes de nota são únicos no vault inteiro. Notas de ano levam o ano na frente (`2026-81-Setembro-Poção Mágica · Transcrições`). *(proposta, ainda não confirmada)*
- Arquivos `.base` ficam em `_sistema/bases/`; notas soltas de trabalho (ex.: ajustes de skill) em `_sistema/notas/`. O `create_note` do MCP grava na pasta do tipo (aula→Acervo/Aulas, texto→Acervo/Textos, banco→Acervo/Questoes, ciclo→Acervo/Ciclos, planejamento→Anos/AAAA, plano→Anos/AAAA/Planejamento, prova→Acervo/Provas, semana→Semanas, correcao→Correcoes, demais→_sistema).
- O servidor MCP bloqueia `Anos/*/Correcoes`, `Relatorios`, `Diarios` e `Alunos` por pasta, além do bloqueio por `tipo: correcao`, `diario` e `aluno` (decisão: o Claude não lê o diário nem as notas de aluno pelo MCP).
- `vault reorganizar <pasta> --ano 2026` move para essa estrutura (inclusive `Anos/AAAA/Provas/` → `Acervo/Provas/`) (simulação por padrão; `--aplicar` grava). Só muda de pasta, nunca renomeia, e troca links por caminho (`[[Escola/Aulas/X]]`, `![[Recursos/imagens/y.png]]`) por links por nome.


## Aula do acervo: seções e Margem (2026-11-13)

A aula (`tipo: aula`, `Acervo/Aulas/…`) não tem "plano de aula" separado. A visão personalizada reconhece seções `##` pelo título (sem diferença de acento ou maiúscula): **Objetivos**, **Habilidades** (códigos `EF69LP…`), **Conteúdo**, **Mindmap** (também `Esquema`) e **Atividades**. Seções com outros nomes aparecem em "Outras seções". Nenhuma é obrigatória.

- **Mindmap** é um bloco Mermaid (```` ```mermaid ```` com `mindmap`); se o código falhar, a visão mostra o texto-fonte.
- **Na margem:** anotações do professor são callouts `> [!margem] texto`; a visão as tira do corpo e as mostra na coluna lateral "Na margem". Os `> [!tip] Dica para o professor` antigos **não** são migrados automaticamente (ficam no corpo).

## Gramática do acervo (modelo de 2026-11-15)

`Acervo/Gramática/<Tópico>.md`, `tipo: gramatica`, um arquivo por tópico (Crase, Concordância verbal…), atemporal como Aula e Ciclo. O `create_note` do MCP grava aí.

- **Fronteira com a Aula:** a gramática é *referência*: a regra, os exemplos e as dúvidas, nas palavras do professor, valendo para qualquer aula. A aula é a *sequência didática* (objetivos, atividades) e cita a gramática por `[[Crase]]` ou por trecho, `![[Crase#Como testar]]`. A regra mora num só lugar; a aula não a copia.
- **Frontmatter:** `tipo: gramatica`; `topico` (igual ao nome do arquivo e ao `# título`); `ano` (6 a 9, pode ser lista: onde costuma ser trabalhado); `assuntos` (liga aulas e gramática); `tags`; `status` (pendente, andamento, finalizado, arquivado). Obrigatórios para o validador: `topico` e `ano`.
- **Seções `##`** (nenhuma tem número; o título é reconhecido sem diferença de acento ou maiúscula): **Regra** (obrigatória, poucas linhas), **Exemplos** (obrigatória; blocos ```` ```exemplo ```` e, em sintaxe, ```` ```sintaxe ````), **Exceções e dúvidas**, **Como testar** (macete) e **Veja também** (links para outras gramáticas). Cada `##` é uma seção da página única da visão de aula.
- Conteúdo: texto do próprio professor (resumo e organização), não cópia de gramática publicada. Nada de aluno, turma ou data aqui.
- Código: `app/src/lib/gramatica.js` (modelo, `parseGramatica`, avisos); exemplos fictícios em `docs/modelos/Gramática/` (4 tópicos) e `docs/modelos/Aula fictícia - Crase na prática.md`, que mostra a aula citando a gramática. Os testes conferem que cada arquivo segue o modelo.

## Recursos (2026-11-15)

A tela **Recursos** (antes "Questões") reúne o que a aula usa e que mora no Acervo. "Recurso" é o mesmo nome da coluna *Recurso* da nota de semana e do aviso `aula-sem-recurso`: tudo o que uma aula pode apontar.

| tipo de recurso | onde fica | `tipo` | o que a lista mostra |
|---|---|---|---|
| Texto | `Acervo/Textos/` (imagens em `Acervo/Textos/imagens/`, fora da lista) | `texto` | título, autor, gênero e começo do texto; filtro por gênero |
| Banco de questões | `Acervo/Questoes/` | `banco` | nº de questões e de textos-base; "Montar prova com este banco" |
| Prova | `Acervo/Provas/` | `prova` | turma, data, nº de questões e valor (as provas antigas, em `Anos/AAAA/Provas/`, ainda são reconhecidas) |
| Oficina (jogo, dinâmica) | `Acervo/Oficinas/` | `oficina` (as antigas, `jogo didático`, seguem aceitas na lista) | título e começo do texto |

- A lista abre na raiz do `Acervo` e só mostra as pastas `Textos`, `Questoes` e `Oficinas`; `Aulas`, `Ciclos` e `Gramática` têm tela própria. Cada pasta aceita subpastas, mover, renomear e arrastar.
- Filtros: tipo, ano (6 a 9), gênero (lido de `genero` nas fichas de texto) e ano letivo (só provas, quando há mais de um). A busca olha título, autor, gênero, tags e conteúdos.
- Campos lidos da ficha de texto: `titulo` (ou `title`), `autor` (ou `author`), `genero`, `ano`/`anos`, `foco`, `tags`, `conteudos`. Oficina: `titulo`, `anos`, `conteudo`. Campo vazio só deixa o dado de fora do cartão.
- **Novo** (botão no alto): *Novo texto*, *Nova oficina*, *Novo banco de questões* e *Montar prova*. Os três primeiros pedem só o nome e criam a nota com o modelo na pasta do tipo (na subpasta aberta, se você estiver dentro da pasta do tipo); se já existe nota com o nome, abrem a existente. Modelos em `app/src/lib/recursos.js`: o texto traz o frontmatter completo da ficha e a seção `## Texto`; a oficina, `anos`, `conteudo` e as seções Material, Como fazer e Variações; o banco, `ano` vazio (preencher em Propriedades), um `## Texto 1` com `### Questões sobre o Texto 1` e `## Questões independentes`. Também há "Novo texto", "Nova oficina" e "Novo banco de questões" na paleta de comandos. O `create_note` do MCP grava `tipo: oficina` em `Acervo/Oficinas`.
- "Atividade a partir deste texto" (menu de contexto de um texto) abre a montagem de prova com o texto escolhido. **Montar prova** continua sendo um botão da tela.
- Nome interno: a página é `recursos` (`RecursosPage.jsx`; estado `recursosAba`/`recursosPasta`, ação `irRecursos`). O que não mudou: as pastas e os `tipo`, as chaves de frontmatter `questoes` (da prova) e o código de leitura de bancos (`lib/prova.js`).
- Ainda sem tela: habilidades BNCC/CBTC, códigos de conteúdo (`_codigos.md`), calendário e relatórios.

## Ciclos e Planejamento do Ano (decisão de 2026-11-14)

- **Ciclo** = conjunto de 16 aulas (gêneros textuais e conteúdos da língua), atemporal como a Aula: `Acervo/Ciclos/<Título>.md`, `tipo: ciclo`, nome só com o título. Não tem ano, trimestre, ordem nem turma. Um Projeto de escrita também pode ser um ciclo.
- **Planejamento do Ano** = plano anual que contém os ciclos: `Anos/AAAA/Planejamento AAAA.md`, `tipo: planejamento`, `ano_letivo: AAAA`, tabela `Ano | Trimestre | Ordem | Ciclo` (`| 6 | 2 | 1 | [[Crase]] |`). É ele quem põe o ciclo num ano; a turma só entra quando as aulas do ciclo vão para as semanas.
- A tela **Ano e ciclos** lê essa tabela; os ciclos de `Acervo/Ciclos` que nenhum Planejamento usa aparecem em "Fora de um ano", com o botão Incluir.
- Migração do formato antigo (`Anos/AAAA/Planejamento/ATC - Título - PR.md`): `vault ciclos <pasta>` simula; `--aplicar` move os ciclos, tira `ano/trimestre/ciclo` do frontmatter (guarda o sufixo PR/PT/TG em `sufixo`), reescreve os `[[links]]` e cria o Planejamento do Ano. Título repetido ganha o sufixo ou o código; ciclo sem título vira `Ciclo NNN`. O app ainda lê o formato antigo enquanto o vault não for migrado.

## Enunciado da produção (`tipo: correcao`)

O que foi pedido aos alunos fica na própria nota `Transcrições e devolutivas.md`, numa seção `## Enunciado` logo antes do primeiro aluno (gênero, tema, extensão, estrutura, material de apoio). O app mostra a seção, recolhida, no alto da Visão da turma e da correção (Produções → abrir o lote), com "Adicionar/Editar" e "Copiar", e a seção não conta como aluno. Ao montar o pedido de avaliação para o Gemini/ChatGPT, copie o enunciado dali em vez de redigi-lo de novo (o MCP não lê `Correcoes/`).

