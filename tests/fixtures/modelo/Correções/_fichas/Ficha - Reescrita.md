---
type: ficha
assunto: correção da segunda versão (reescrita)
---

Use quando o professor pedir para corrigir a reescrita de uma produção já corrigida com esta skill.

## Montagem

1. Encontre a pasta da 1ª versão em `Correções` (mesma turma e atividade). Se não achar, pergunte o caminho; sem ela, corrija como atividade nova.
2. Crie uma pasta nova: `<turma> - <Mês> - <Atividade> (reescrita)`. Copie `_turma.md` e `_apoio.md` da 1ª versão.
3. Crie o `_dados.json` com os **mesmos critérios, pesos e gradação** da 1ª versão e acrescente `"versao_anterior": "../<pasta da 1ª versão>"`. Com essa chave, `gerar_arquivos.py` põe na tabela de notas a nota da 1ª versão e a diferença, e conta no resumo quem melhorou, manteve ou piorou.
4. Copie as regras de calibragem da 1ª versão para o `Visão da turma.md`. **Não há nova calibragem**, a menos que o professor queira mudar critérios; se mudar, avise que as notas deixam de ser comparáveis.
5. Transcreva normalmente.

## Correção

- Corrija a reescrita pelos critérios, como um texto novo: a nota não ganha bônus por ter melhorado nem perde por ter mantido.
- Leia, para cada aluno, a avaliação da 1ª versão (só a tabela, no `_dados.json` antigo). Em cada comentário, diga o que o aluno resolveu do que foi apontado e o que ainda falta. Ex.: "Agora a carta tem data e assinatura, como faltava na 1ª versão. Ainda falta o vocativo."
- Aluno que não fez a 1ª versão: corrija normalmente e registre em `obs`.
- Aluno que entregou a reescrita quase igual à 1ª versão: sinalize em "Para revisar"; não é situação de cópia.

## Visão da turma

Além das seções de sempre, escreva em "Destaques" e "Problemas recorrentes" o que a turma resolveu na reescrita e o que persistiu (com contagens), comparando com os "Problemas recorrentes" da 1ª versão.
