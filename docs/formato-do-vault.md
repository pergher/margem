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
| `ciclo` | ano, trimestre, ciclo | objetivo, habilidades, conteudos, status, textos_sala, textos_prova, tags |
| `calendario` | inicio, fim, feriados, turmas | recessos |
| `texto` | titulo, autor, genero, fonte, dominio_publico, foco, conteudos, alertas | publicacao, link, imagem, tags |
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

Uma tabela por turma (`### 61`), com `Ciclo: [[231 - Crase]]` logo abaixo do título e as colunas `Aula | Recurso | Ciclo`. Na coluna **Ciclo** a linha aponta a aula do ciclo (`[[231 - Crase]] 3`) ou fica vazia (aula avulsa). A **situação** da aula é uma marca no fim da célula *Aula*:

| marca | situação | conta no progresso do Ano? |
|---|---|---|
| (nenhuma) | planejada | não |
| `✓` | dada | sim |
| `↷` | pulei | não (volta na sugestão da semana seguinte) |
| `❔` | não sei | não (idem) |

Se um ciclo ganhar ou perder aulas pela tela Ciclo (inserir, deslocar, remover), o app ajusta o número da aula nas linhas das semanas que apontam para ele.

## Configuração das provas (`tipo: configuracao`)

O app guarda o cabeçalho das provas na nota `_sistema/Configuração das provas.md` (nada fica só no navegador): `escola` e `linha2` (texto do cabeçalho), `logo` (nome do arquivo PNG/JPG em `_sistema/anexos/`, ex.: `logo-escola.png`), `duas_colunas` (true/false) e `limite_linhas` (linhas por folha, calibrado com uma prova real). Edita-se em Configurações → Cabeçalho das provas ou direto na nota.

## Pesos da correção

A nota de cada critério na tabela `### Avaliação` já é em pontos (ex.: Ortografia, de peso 2, vai de 0 a 2). O app lê o `_dados.json` da pasta da correção: o `peso` de cada critério é o seu máximo e `gradacao` (ex.: 0, 0,25 … 1) multiplicada pelo peso dá as notas que o menu oferece. Sem `_dados.json` (ou com `criterios` só em texto), todos os critérios valem o mesmo máximo, lido do texto da rubrica.

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
│   ├── Textos/      fichas de texto
│   ├── Questoes/    bancos de questões
│   └── Oficinas/    jogos e dinâmicas
└── Anos/
    └── 2026/
        ├── calendario.md
        ├── Planejamento/   plano anual, ciclos e planos por turma
        ├── Semanas/        uma nota `tipo: semana` por semana (aulas dadas ✓, avulsas)
        ├── Diarios/<turma>/   diário de aula por turma e semana (sensível, bloqueado no MCP)
        ├── Alunos/<turma>/    uma nota por aluno, com as ocorrências (sensível, bloqueado no MCP)
        ├── Provas/
        ├── Correcoes/<turma>-<mes>-<atividade>/   transcrições, fotos, devolutivas, visão da turma
        ├── Relatorios/
        └── Diario/
```

- **Acervo** não tem ano nem turma. **Anos/AAAA** é tudo o que pertence a um ano letivo e pode ser arquivado inteiro.
- Links são por nome, então mover pastas não quebra nada. Exceção: embeds de imagem por caminho (`![[Fotos/Foto 27.jpg]]`) precisam ser ajustados.
- Nomes de nota são únicos no vault inteiro. Notas de ano levam o ano na frente (`2026-81-Setembro-Poção Mágica · Transcrições`). *(proposta, ainda não confirmada)*
- Arquivos `.base` ficam em `_sistema/bases/`; notas soltas de trabalho (ex.: ajustes de skill) em `_sistema/notas/`. O `create_note` do MCP grava na pasta do tipo (aula→Acervo/Aulas, texto→Acervo/Textos, banco→Acervo/Questoes, plano/ciclo→Anos/AAAA/Planejamento, prova→Provas, semana→Semanas, correcao→Correcoes, demais→_sistema).
- O servidor MCP bloqueia `Anos/*/Correcoes`, `Relatorios`, `Diarios` e `Alunos` por pasta, além do bloqueio por `tipo: correcao`, `diario` e `aluno` (decisão: o Claude não lê o diário nem as notas de aluno pelo MCP).
- `vault reorganizar <pasta> --ano 2026` move para essa estrutura (simulação por padrão; `--aplicar` grava). Só muda de pasta, nunca renomeia, e troca links por caminho (`[[Escola/Aulas/X]]`, `![[Recursos/imagens/y.png]]`) por links por nome.
