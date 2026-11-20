// Autocompletar de emoji: `:` + 2 letras (depois de espaço ou no começo da linha) abre a lista; escolhido, entra o próprio emoji
// (Unicode, não `:codigo:`), então a nota continua Markdown puro em qualquer editor. A busca ignora acento e aceita nomes em
// português e em inglês (como no GitHub).
import { syntaxTree } from "@codemirror/language";

// formato: "emoji nome-principal outras palavras…"
const DADOS = `
😀 sorriso grin smile feliz|😃 alegre smiley|😄 rindo happy|😁 radiante beaming|😆 gargalhada laughing|😅 suor aliviado sweat_smile|😂 chorando de rir joy risada|🤣 rolando de rir rofl|🙂 sorrisinho slight_smile|🙃 de cabeca para baixo upside_down|😉 piscadinha wink|😊 satisfeito blush|😇 anjo innocent halo|🥰 apaixonado love carinho|😍 olhos de coracao heart_eyes|🤩 estrelas star_struck|😘 beijo kissing_heart|😋 delicia yum|😛 lingua tongue|😜 maluco zany|🤔 pensando thinking duvida|🤨 desconfiado raised_eyebrow|😐 neutro neutral|😑 sem expressao expressionless|😶 mudo no_mouth|🙄 revirando os olhos eye_roll|😏 malicioso smirk|😒 insatisfeito unamused|😞 desapontado disappointed|😔 pensativo pensive|😟 preocupado worried|😕 confuso confused|🙁 triste frown|😢 chorando cry lagrima|😭 chorando muito sob|😤 bravo triumph|😠 irritado angry|😡 furioso rage|🤯 mente explodindo mind_blown|😳 envergonhado flushed|🥵 calor hot|🥶 frio cold|😱 grito scream|😨 medo fearful|😰 apreensivo cold_sweat|😥 aliviado sad_relieved|😓 cansaco downcast_sweat|🤗 abraco hugs|🤭 mao na boca hand_over_mouth|🤫 silencio shush|😴 dormindo sleeping sono|🥱 bocejo yawn|😷 mascara mask doente|🤒 febre thermometer|🤕 machucado bandage|🤢 enjoado nauseated|🤮 vomito vomit|🥳 festa party|😎 oculos escuros cool sunglasses|🤓 nerd aluno|🧐 monoculo monocle|😈 diabinho smiling_imp|👻 fantasma ghost|💀 caveira skull|🤖 robo robot|💩 coco poop
👍 positivo joinha thumbsup +1 curti|👎 negativo thumbsdown -1|👏 palmas clap aplauso|🙌 maos para cima raised_hands|🙏 por favor pray obrigado|🤝 aperto de maos handshake|💪 forca muscle|✌️ paz victory|🤞 dedos cruzados crossed_fingers|🤟 love_you|👌 ok ok_hand|👋 tchau wave ola|✋ mao raised_hand|🖐️ mao aberta|👆 apontando para cima point_up|👇 apontando para baixo point_down|👈 apontando para a esquerda point_left|👉 apontando para a direita point_right|☝️ indicador|✍️ escrevendo writing_hand|👀 olhos eyes|👁️ olho eye|👂 orelha ear|👃 nariz nose|👄 boca lips|🧠 cerebro brain|🗣️ falando speaking|👤 pessoa busto|👥 pessoas|🧑‍🏫 professor teacher|🧑‍🎓 aluno student|👩‍🏫 professora|👨‍🏫 professor homem|👩‍🎓 aluna|👨‍🎓 aluno homem
❤️ coracao heart|🧡 coracao laranja orange_heart|💛 coracao amarelo yellow_heart|💚 coracao verde green_heart|💙 coracao azul blue_heart|💜 coracao roxo purple_heart|🖤 coracao preto black_heart|🤍 coracao branco white_heart|💔 coracao partido broken_heart|💕 dois coracoes|💖 coracao brilhante sparkling_heart|💯 cem 100 hundred|💥 explosao boom|💫 tontura dizzy|💦 gotas sweat_drops|💬 balao de fala speech_balloon conversa|💭 pensamento thought_balloon|💤 zzz sono
⭐ estrela star|🌟 estrela brilhante glowing_star|✨ brilho sparkles|⚡ raio zap energia|🔥 fogo fire|🌈 arco-iris rainbow|☀️ sol sun|🌙 lua moon|☁️ nuvem cloud|🌧️ chuva rain|❄️ neve snowflake|🌱 broto seedling planta|🌳 arvore tree|🌸 flor cherry_blossom|🌹 rosa rose|🌻 girassol sunflower|🍀 trevo clover sorte|🍎 maca apple|🍌 banana|🍕 pizza|🍰 bolo cake|☕ cafe coffee|🍺 cerveja beer|🎂 aniversario birthday
🐶 cachorro dog|🐱 gato cat|🐭 rato mouse|🐰 coelho rabbit|🦊 raposa fox|🐻 urso bear|🐼 panda|🦁 leao lion|🐸 sapo frog|🐵 macaco monkey|🐔 galinha chicken|🐦 passaro bird|🦉 coruja owl|🦋 borboleta butterfly|🐝 abelha bee|🐢 tartaruga turtle|🐍 cobra snake|🐟 peixe fish|🐳 baleia whale
📚 livros books biblioteca|📖 livro aberto book open_book leitura|📕 livro fechado closed_book|📗 livro verde green_book|📘 livro azul blue_book|📙 livro laranja orange_book|📓 caderno notebook|📔 caderno decorado|📒 caderno de anotacoes ledger|📃 pagina page_with_curl|📄 documento page_facing_up|📑 marcadores bookmark_tabs|🔖 marcador de pagina bookmark|📰 jornal newspaper noticia|🗞️ jornal enrolado|📝 anotacao memo escrever nota|✏️ lapis pencil|🖊️ caneta pen|🖋️ caneta tinteiro fountain_pen|🖍️ giz de cera crayon|📏 regua ruler|📐 esquadro triangular_ruler|✂️ tesoura scissors|📎 clipe paperclip|📌 alfinete pushpin fixar|📍 local round_pushpin|🗂️ pastas card_index_dividers|📁 pasta file_folder|📂 pasta aberta open_file_folder|🗃️ arquivo card_file_box|🗄️ arquivo gaveta file_cabinet|🗑️ lixeira wastebasket|📅 calendario calendar data|📆 calendario rasgavel|🗓️ agenda spiral_calendar|⏰ despertador alarm_clock|⏳ ampulheta hourglass_flowing|⌛ ampulheta hourglass|🕐 relogio clock|🔔 sino bell aviso|🔕 sino mudo|🎓 formatura graduation_cap|🏫 escola school|🎒 mochila backpack|🏆 trofeu trophy|🥇 medalha de ouro gold medal|🥈 medalha de prata|🥉 medalha de bronze|🎖️ medalha military_medal|🎯 alvo dart objetivo|🎨 arte palette pintura|🎭 teatro performing_arts|🎬 cinema clapper|🎤 microfone microphone|🎧 fone headphones|🎵 nota musical musical_note musica|🎶 notas musicais notes|🎮 jogo video_game|🧩 quebra-cabeca puzzle|🎲 dado game_die
💡 ideia bulb lampada|🔍 lupa mag busca procurar|🔎 lupa direita mag_right|🔗 link corrente|🔒 cadeado lock|🔓 aberto unlock|🔑 chave key|⚙️ engrenagem gear configuracao|🔧 ferramenta wrench|🔨 martelo hammer|🧰 caixa de ferramentas toolbox|💻 computador laptop|🖥️ computador de mesa desktop|⌨️ teclado keyboard|🖱️ mouse|📱 celular phone|📷 camera|📸 foto camera_flash|🎥 filmadora movie_camera|📺 televisao tv|📻 radio|💾 disquete floppy salvar|💿 cd|📧 email e-mail|📨 mensagem recebida incoming_envelope|✉️ carta envelope|📮 caixa de correio postbox|📦 pacote package|🛒 carrinho cart|💰 dinheiro moneybag|💵 dolar dollar|🧮 abaco abacus|📊 grafico de barras bar_chart|📈 grafico subindo chart_with_upwards_trend|📉 grafico descendo chart_with_downwards_trend|📋 prancheta clipboard
✅ feito check concluido white_check_mark|✔️ certo heavy_check_mark|☑️ caixa marcada ballot_box_with_check|❌ errado x erro cross_mark|❎ negativo cross_mark_button|⭕ circulo vermelho o|➕ mais plus|➖ menos minus|➗ divisao divide|✖️ multiplicacao multiply|❓ pergunta question|❔ pergunta branca grey_question|❗ exclamacao exclamation|❕ exclamacao branca grey_exclamation|‼️ dupla exclamacao|⚠️ atencao warning cuidado alerta|🚫 proibido prohibited|⛔ entrada proibida no_entry|🔴 circulo vermelho red_circle|🟠 circulo laranja orange_circle|🟡 circulo amarelo yellow_circle|🟢 circulo verde green_circle|🔵 circulo azul blue_circle|🟣 circulo roxo purple_circle|⚫ circulo preto black_circle|⚪ circulo branco white_circle|🟥 quadrado vermelho red_square|🟧 quadrado laranja|🟨 quadrado amarelo|🟩 quadrado verde green_square|🟦 quadrado azul|🟪 quadrado roxo
➡️ seta para a direita arrow_right|⬅️ seta para a esquerda arrow_left|⬆️ seta para cima arrow_up|⬇️ seta para baixo arrow_down|↗️ seta diagonal|↩️ voltar return|🔄 atualizar arrows_counterclockwise|🔁 repetir repeat|🔀 aleatorio shuffle|▶️ play reproduzir|⏸️ pausa pause|⏹️ parar stop|🆗 ok_button|🆕 novo new|🔝 topo top|🔜 em breve soon|✳️ asterisco|©️ copyright|®️ registrado|™️ marca registrada tm
🏠 casa house|🏢 predio office|🏥 hospital|🏛️ prefeitura classical_building|⛪ igreja|🚗 carro car|🚌 onibus bus|🚲 bicicleta bike|✈️ aviao airplane|🚀 foguete rocket|⛵ barco sailboat|🌍 terra globo earth_africa mundo|🌎 americas earth_americas|🗺️ mapa world_map|🧭 bussola compass|🏁 chegada checkered_flag|🚩 bandeira vermelha triangular_flag|🏳️ bandeira branca|🇧🇷 brasil bandeira brazil|🇵🇹 portugal bandeira
`.trim().split("\n").flatMap((l) => l.split("|")).map((x) => { const i = x.indexOf(" "); return { emoji: x.slice(0, i), palavras: x.slice(i + 1).trim() }; });

export const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const INDICE = DADOS.map((d) => ({ ...d, chave: semAcento(d.palavras), tokens: semAcento(d.palavras).split(/[\s_]+/) }));

/** Emojis que casam com o texto digitado: nome que começa > palavra que começa > contém. */
export function buscarEmojis(consulta, limite = 12) {
  const q = semAcento(consulta.trim()).replace(/^:/, "");
  if (q.length < 2) return [];
  const pontuar = (e) => {
    if (e.chave.startsWith(q)) return 0;
    if (e.tokens.some((t) => t.startsWith(q))) return 1;
    return e.chave.includes(q) ? 2 : null;
  };
  return INDICE.map((e) => ({ e, p: pontuar(e) })).filter((x) => x.p !== null).sort((a, b) => a.p - b.p).slice(0, limite).map((x) => x.e);
}

const EM_CODIGO = new Set(["FencedCode", "CodeBlock", "InlineCode", "CodeText"]);
const emCodigo = (state, pos) => { for (let n = syntaxTree(state).resolveInner(pos, -1); n; n = n.parent) if (EM_CODIGO.has(n.name)) return true; return false; };

/** Fonte do autocompletar para o CodeMirror. O `:` precisa estar no começo da linha ou depois de espaço/parêntese (não pega "10:30" nem "http://"). */
export function fonteDeEmoji(ctx) {
  const m = ctx.matchBefore(/:[\p{L}_+-]{2,}/u);
  if (!m) return null;
  const antes = m.from === 0 ? "" : ctx.state.sliceDoc(m.from - 1, m.from);
  if (antes && !/[\s(]/.test(antes)) return null;
  if (emCodigo(ctx.state, m.from)) return null;
  const achados = buscarEmojis(ctx.state.sliceDoc(m.from + 1, ctx.pos));
  if (!achados.length) return null;
  return {
    from: m.from, filter: false,
    options: achados.map((e, i) => ({
      label: `${e.emoji}  ${e.palavras}`, type: "text", boost: -i,
      apply: (view, _c, de, ate) => view.dispatch({ changes: { from: de, to: ate, insert: e.emoji }, selection: { anchor: de + e.emoji.length }, userEvent: "input.complete" }),
    })),
  };
}
