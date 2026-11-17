// Ações rápidas do painel de IA: os prompts ficam todos aqui, num lugar só, para editar sem mexer na interface.
// `tipos`: tipos de nota em que aparece (null = qualquer); `selecao`: só vale com um trecho selecionado no editor.
const FECHO = " Use `propor_edicao` com o texto COMPLETO da nota (mantenha o frontmatter e o que não precisa mudar); não explique a nota inteira, só diga em uma frase o que mudou.";

export const ACOES = [
  { id: "mais-apoio", rotulo: "Adaptar com mais apoio", tipos: ["aula", "banco"], selecao: false,
    prompt: "Adapte esta nota para alunos que precisam de mais apoio: divida as instruções em passos curtos, acrescente exemplos resolvidos e dicas antes das atividades, sem baixar o nível do conteúdo." + FECHO },
  { id: "simplificar", rotulo: "Simplificar a linguagem", tipos: ["aula", "banco"], selecao: false,
    prompt: "Simplifique a linguagem desta nota (frases mais curtas, vocabulário mais comum), mantendo os conceitos, os exemplos e a estrutura." + FECHO },
  { id: "cinco-questoes", rotulo: "Gerar 5 questões", tipos: ["aula", "banco"], selecao: false,
    prompt: "Crie 5 questões novas sobre o conteúdo desta nota, no mesmo formato das que já existem nela, e acrescente-as no lugar adequado." + FECHO },
  { id: "adaptar-selecao", rotulo: "Adaptar a seleção", tipos: null, selecao: true,
    prompt: "Adapte o trecho selecionado para alunos que precisam de mais apoio (passos curtos, exemplo resolvido, linguagem mais simples). Altere só esse trecho e mantenha o resto da nota igual." + FECHO },
];

export const acoesPara = (tipo) => ACOES.filter((a) => a.tipos === null || a.tipos.includes(tipo));
