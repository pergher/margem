---
name: transcrever-diario
description: Transcreve a foto de uma página do diário de classe escrito à mão e a insere no vault (Anos/AAAA/Diarios/<turma>/), comparando as anotações com o planejamento da semana para deixá-las mais completas, e etiquetando as ocorrências de alunos. Use quando o professor enviar foto(s) do diário, ou pedir "transcrever o diário da 71", "inserir o diário desta semana", "passar o caderno para o Margem".
---

# Transcrever o diário de classe (foto → Margem)

O professor anota o diário em papel, de forma resumida. Esta skill transforma a foto numa nota `tipo: diario` do vault, mais completa, **sem inventar nada que não esteja na foto ou no planejamento**, e a deixa para ele revisar antes de valer.

Formato do arquivo: `docs/formato-do-vault.md` (seções "Diário" e "Nota de semana"); modelo em `docs/modelos/Diario 71 - 9 a 13 de Novembro.md`.

## Privacidade (leia primeiro)

O diário e as fichas de alunos são sensíveis e o MCP do vault não os expõe. Esta skill só trabalha com o que o professor **envia na conversa ou indica por caminho**: a foto, a nota da semana e as aulas ligadas a ela. Não leia outras pastas de `Diarios/` ou `Alunos/`, não copie dados de alunos para outras notas nem para o acervo. Só os nomes que aparecem na foto são conferidos contra `Anos/AAAA/Alunos/<turma>/`.

## Entrada

Peça só o que faltar: **turma**, **semana** (rótulo, ex. "9 a 13 de Novembro", ou data da segunda-feira) e **as fotos**. Se a foto trouxer a data, use-a. Guarde as fotos em `Anos/AAAA/Diarios/<turma>/Fotos/` (nome original; sem alterá-las) e anote o nome em `foto:`. Uma semana pode ter várias fotos: junte na ordem.

## Etapas

1. **Planejamento.** Leia `Anos/AAAA/Semanas/Semana AAAA-MM-DD.md` e a seção da turma: cada linha é uma aula (texto, recurso `[[…]]`, ciclo e número). Marcas no fim da aula: `✓` dada, `↷` pulada; `🔻 🔹 🔥` são exercícios, revisão e prova. Leia as notas de `Acervo/Aulas` ligadas às aulas da semana **só para vocabulário e conteúdo** (nomes dos assuntos, atividades previstas), não para afirmar o que aconteceu.
2. **Transcrição fiel.** Leia a foto e transcreva o que está escrito, aula por aula, com as palavras do professor. Letra duvidosa: `[palavra?]`; ilegível: `[ilegível]`. Não corrija nem embeleze nesta etapa. Se a foto for ruim (cortada, de cabeça para baixo), diga e peça outra.
3. **Casar com o planejamento.** Ligue cada anotação à aula planejada (por data, ordem e assunto). Aponte, sem decidir sozinho: aula planejada sem anotação; anotação sem aula planejada (aula avulsa); aula anotada mas marcada `↷`; ordem trocada. Pergunte ao professor nesses casos.
4. **Melhorar a anotação.** Para cada aula, escreva o `Dado:` em frase completa, assim:
   - mantenha **todos os fatos** da anotação original (o que foi feito, páginas, exercícios, o que ficou para depois);
   - acrescente do planejamento só o que **identifica** a aula (nome do assunto, recurso, atividade prevista), em linguagem de quem registra o que foi feito;
   - **nunca** afirme que algo foi feito só porque estava planejado. Se o planejamento prevê algo que a anotação não menciona, não escreva; liste-o na revisão como pergunta ("o exercício de fixação previsto foi feito?");
   - se o texto ficar com dúvida, ponha `(?)` depois dela.
   Guarde logo abaixo do `Dado:` a anotação original numa linha `<!-- original: … -->` (o app ignora esse comentário; serve para conferência).
5. **Ocorrências de alunos.** Uma linha por ocorrência, dentro da aula: `- [[Nome completo]] — #etiqueta texto`. Etiquetas (sempre estas, uma ou mais): `#conversa` conversa em sala · `#produtividade` falta de produtividade · `#espelho` fora do espelho de classe · `#andando` andando pela sala · `#briga` · `#celular` uso de celular · `#positivo`. Sem encaixe (ausência, atraso, recado): sem etiqueta. Confira cada nome em `Anos/AAAA/Alunos/<turma>/`; apelido ou nome parcial ambíguo: pergunte, não adivinhe. Aluno que não existe na turma: pergunte se deve ser criado.
6. **Gravar como rascunho.** Crie `Anos/AAAA/Diarios/<turma>/Diario <turma> - <rótulo da semana>.md` (se já existir, mostre a diferença e não sobrescreva sem perguntar) com:

```
---
tipo: diario
ano: <série>
turma: "<turma>"
semana: <rótulo ou AAAA-MM-DD>
transcricao: aguardando-revisao
foto: <arquivo.jpg>
---
# Diário <turma> — <rótulo>

## Aula 1 — <assunto>

Dado: <frase completa>
<!-- original: <o que estava escrito> -->

- [[Nome]] — #conversa <texto>
```

   Uma seção `## Aula N — assunto` por aula, na ordem; o número é o da aula na semana.
7. **Revisão com o professor.** Apresente, por aula, uma tabela curta: *o que estava escrito* · *o que ficou no sistema* · *de onde veio o acréscimo*; depois as perguntas pendentes e as ocorrências com etiquetas. Peça correções. Aplique-as com edição pontual.
8. **Aprovar.** Só quando o professor disser que está bom, mude `transcricao:` para `aprovada`. Não marque `✓` nas aulas da nota de semana por conta própria; ofereça, listando quais.

## Depois

No Margem, a página Diário mostra as aulas e ocorrências na mesma lista; o filtro "Transcrição a aprovar" reúne o que ainda está em `aguardando-revisao` ou `pendente`. Rode `vault validate` (ou a ferramenta `validate` do MCP) sobre a nota criada, se disponível, e resolva os avisos antes de dizer que terminou.
