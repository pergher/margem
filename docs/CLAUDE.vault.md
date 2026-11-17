# Convenções do vault Escola

Copie este arquivo para `Escola/CLAUDE.md`. Ele diz ao Claude como ler e escrever neste vault. Detalhes completos: `docs/formato-do-vault.md` do projeto editor-md.

## O que é
Vault de Markdown (compatível com o Obsidian) para ensinar Português do 6º ao 9º ano. A pesquisa acadêmica fica em outro vault. Tudo é arquivo `.md`; não crie formatos próprios.

## Estrutura
- `_sistema/`: templates, rubricas, `_codigos.md` (taxonomia), BNCC e CBTC.
- `Acervo/`: o que vale em qualquer ano (`Aulas/`, `Textos/`, `Questoes/`, `Oficinas/`).
- `Anos/AAAA/`: o que pertence a um ano letivo (`Planejamento/`, `Correcoes/`, `Relatorios/`, `Diario/`).

## Regras
1. Toda nota tem `tipo` no frontmatter: `aula`, `plano`, `ciclo`, `calendario`, `texto`, `banco`, `prova`, `correcao`, `rubrica`, `taxonomia`, `habilidades-bncc`, `habilidades-cbtc`.
2. Chaves em português, minúsculas, sem acento: `tipo`, `ano`, `turma`, `trimestre`, `titulo`, `autor`, `genero`, `publicacao`, `mes`, `status`.
3. `status` só aceita `pendente`, `andamento`, `finalizado`, `arquivado`. Correções usam também `transcricao`: `pendente`, `aguardando-revisao`, `aprovada`.
4. `ano` é a série (6 a 9). `turma` é texto de dois dígitos (`"61"`). Aulas **não** têm turma: a turma vive no ciclo ou no plano do ano.
5. Links por nome, nunca por caminho: `[[Tipos de sujeito]]`. Habilidades como links de bloco: `[[bncc-lp-6ano#^ef06lp04]]`. Nomes de nota são únicos.
6. Códigos de conteúdo (`foco`, `conteudos`, `conteudo`, `conteudos_excluidos`) só os de `_sistema/_codigos.md`. Para usar um código novo, inclua-o lá primeiro, com descrição curta, e nunca renomeie nem apague os existentes.
7. Valores com `: ` entre aspas: `fonte: "SILVA, A. Obra. São Paulo: Ed. X, 2020."`.
8. Gabarito de atividades vai entre `[colchetes]` só nas fichas de aula. Em correções, colchetes são marcas de transcrição: `[palavra?]`, `[ilegível]`. Erros do aluno na transcrição vão entre chaves: ortografia `{errado|certo}` (a correção é opcional); pontuação `{p:antes|depois}`, por exemplo `{p:|,}` (falta vírgula), `{p:,|}` (vírgula a mais), `{p:e|, e}` (troca). A transcrição continua fiel ao que o aluno escreveu; as chaves só anotam.
9. Poemas mantêm as quebras de verso; nunca junte versos numa linha. Textos literários não são corrigidos nem reescritos.
10. Não altere `.obsidian/`.

## Privacidade
Correções e relatórios têm nomes e textos de menores. O servidor MCP não os expõe. Não copie dados de alunos para outras notas, para prompts nem para o acervo.

## Depois de criar ou editar notas
Rode a ferramenta `validate` do MCP (ou `vault validate`) e resolva os avisos antes de dizer que terminou. Não invente campos: se um dado não existe, deixe o campo vazio e ele aparecerá como pendência.
