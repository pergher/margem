# Marcação de erros na transcrição (para a Skill de correções)

Este arquivo diz o que o Claude precisa escrever na seção `### Texto` de cada aluno, em `Transcrições e devolutivas.md`, para o Margem mostrar os erros de ortografia e de pontuação. O app **não detecta nada sozinho**: só destaca o que estiver marcado. Cole ou adapte as seções abaixo na Skill.

## 1. Regra de ouro

A transcrição reproduz **exatamente** o que o aluno escreveu, com os erros. Marcar um erro nunca muda o texto do aluno: a palavra errada continua escrita como ele escreveu, apenas dentro de chaves. Nunca corrigir em silêncio.

## 2. As duas marcas

| Erro | Marca | Exemplo no texto | O que o app mostra |
|---|---|---|---|
| Ortografia | `{como o aluno escreveu\|forma correta}` | `alguém {fazendos\|fazendo} desenhos` | palavra com sublinhado ondulado vermelho; o certo aparece ao lado se "Mostrar correção" estiver ligado |
| Pontuação, **falta** um sinal | `{p:\|sinal}` | `a favor{p:\|,} de fazerem` | ▲ azul no ponto onde falta; o sinal aparece com "Mostrar correção" |
| Pontuação, sinal **a mais** | `{p:sinal\|}` | `deveria{p:,\|} ser aplicada` | o sinal sobrante com fundo azul; a dica diz "remover" |
| Pontuação, sinal **trocado** | `{p:como estava\|como deveria}` | `tarde{p:.\|;} depois` | trecho com fundo azul; o certo ao lado |

Regras de escrita:

- A parte depois do `|` é opcional na ortografia: `{estava}` só aponta o erro, sem dar a forma certa. Prefira sempre dar a forma certa.
- O prefixo `p:` é o que diferencia pontuação de ortografia. Sem ele, é ortografia.
- Dentro das chaves não pode haver outra chave (`{` ou `}`) nem a barra `|` além da que separa as duas partes.
- Marque **uma palavra ou um sinal por vez**. Dois erros na mesma frase são duas marcas.
- A marca vai colada ao trecho, sem espaço extra: `deveria{p:,|} ser` (o espaço depois da marca é o espaço original do texto).
- Para pontuação "a mais" ou "a menos", marque o ponto exato, não a frase inteira.

## 3. O que marcar como ortografia

Combine com o professor e escreva na Skill, mas o padrão sugerido é:

- Palavra escrita errada (`fazendos` por `fazendo`, `esperiência` por `experiência`).
- Acentuação errada ou ausente (`esta` por `está`, `voce` por `você`) e acento a mais.
- Uso errado de `s/z/ss/ç/x/ch`, `g/j`, `r/rr`, `h` e semelhantes.
- Hífen, apóstrofo e juntar/separar palavras (`a gente`/`agente`, `porque`/`por que`, `mais`/`mas`).
- Maiúscula/minúscula errada em nomes próprios e início de frase.

Não marcar como ortografia (a menos que o professor peça): concordância, regência, estilo, repetição, gíria e registro informal. Esses assuntos vão no comentário do critério da avaliação, não na transcrição.

## 4. O que marcar como pontuação

- Vírgula que falta ou sobra (inclusive vírgula entre sujeito e verbo).
- Ponto final ausente ou no lugar errado; frase que deveria ter terminado.
- Dois-pontos, ponto e vírgula, aspas, travessão de fala e reticências usados errado.
- Interrogação/exclamação ausentes.

Não marcar escolhas estilísticas legítimas (vírgula opcional, travessão expressivo). Na dúvida, não marcar e deixar para o comentário do critério.

## 5. Convivência com as outras marcas da transcrição

As marcas antigas continuam valendo e **têm prioridade na leitura**:

- `[palavra?]` quando o Claude **não tem certeza** do que o aluno escreveu (problema de leitura da letra). Se nem se sabe qual é a palavra, não dá para dizer se está errada: primeiro resolva a leitura, depois, se for erro, marque.
- `[ilegível]` para trecho que não dá para ler.
- `~~riscado~~` para o que o aluno riscou e `^acrescentado^` para o que ele escreveu depois por cima.
- Erro dentro de trecho riscado **não** se marca (o aluno já o descartou).

Combinações válidas: `{fazendos|fazendo}` dentro de um trecho `^acrescentado^` **não** funciona (as marcas não se aninham). Nesse caso marque só o erro e deixe de fora o `^...^`, ou o contrário, e avise o professor numa nota.

## 6. Antes de entregar a transcrição

Conferir, para cada aluno:

1. Tirando as marcas (`{x|y}` vira `x`, `{p:x|y}` vira `x`), o texto é idêntico ao que o aluno escreveu.
2. Nenhuma chave aberta sem fechar; nenhuma `|` sobrando.
3. Nenhum erro marcado que esteja em trecho riscado.
4. Marcas `[palavra?]` e `[ilegível]` continuam só onde há dúvida de leitura (elas bloqueiam "Aprovar transcrição" até serem resolvidas; as marcas de erro **não** bloqueiam).

## 7. Exemplo completo

Texto do aluno, como foi escrito:

> – Eu sou a favor de fazerem uma regra, se uma pessoa ver alguém fazendos os desenhos nos banheiros a pessoa deve falar. E também acho que está regra deveria, ser aplicada.

Transcrição marcada:

```
– Eu sou a favor{p:|,} de fazerem uma regra, se uma pessoa ver alguém {fazendos|fazendo} os desenhos nos banheiros{p:|,} a pessoa deve falar. E também acho que {está|esta} regra deveria{p:,|} ser aplicada.
```

O app mostra 2 erros de ortografia e 3 de pontuação para esse aluno.

## 8. Decisões que ficam com você

- Se acentuação e maiúsculas contam como "ortografia" no seu critério.
- Se concordância e regência entram em alguma marca (hoje não há: seria um terceiro tipo, por exemplo `{c:...}`).
- Se o Claude marca **sempre** o certo (recomendado) ou só aponta o erro.
- Se a Skill deve conferir a regra 6 antes de salvar o arquivo.

Referência técnica: convenção resumida em [CLAUDE.vault.md](CLAUDE.vault.md); implementação em `app/src/lib/correcao.js` (`ERRO`, `contarErros`) e `app/src/components/CorrecaoPage.jsx` (`Inline`).
