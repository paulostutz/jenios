/** Curadoria de links enviados para estudo, com METADADOS e LEGENDAS verificadas em 21/10/2026.
 * `transcript_reviewed` = transcript/captions acessados; NÃO significa inspeção visual ou auditoria de taxa de acerto.
 * `metadata_verified_no_captions` = título verificado, sem legendas acessíveis.
 * `metadata_verified_music_only` = legenda não informa critérios de trade.
 * `needs_playlist_review` = vídeos componentes da playlist não inventariados.
 * Sínteses originais de caráter educativo. Nenhuma ordem ou indicador financeiro em tempo real.
 */
import {SUPPLEMENTAL_TRADE_VIDEO_RESOURCES} from './trade-video-supplement-20261021.mjs';
export const USER_VIDEO_RESOURCES=Object.freeze([
  {
    "id": "IH5TuzAvFgk",
    "kind": "video",
    "title": "Se você é AMBICIOSO mas PREGUIÇOSO, use essa estratégia",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "estrategias",
    "verification": "transcript_reviewed",
    "note": "Larry Connors: filtro SMA200, IFR/RSI de 2 períodos para sobrevenda de curto prazo e média de 5 períodos para observar saída. Testes e rentabilidades narrados não são prova independente.",
    "researchQuestion": "Reversão à média condicionada a tendência maior; validar entrada no candle seguinte e custos.",
    "url": "https://www.youtube.com/watch?v=IH5TuzAvFgk"
  },
  {
    "id": "MFnC-tsp90Q",
    "kind": "video",
    "title": "A ÚNICA Estratégia de Lateralização que você precisa saber",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "estrategias",
    "verification": "transcript_reviewed",
    "note": "Quatro testes mínimos para estruturar suporte/resistência e aguardar confirmação na região seguinte; considerar direção anterior e não antecipar rompimentos.",
    "researchQuestion": "Regiões laterais exigem definições quantitativas de tolerância, toque e gatilho sem antecipação.",
    "url": "https://www.youtube.com/watch?v=MFnC-tsp90Q"
  },
  {
    "id": "mz2O6K6JF4k",
    "kind": "video",
    "title": "Todos indicadores explicados em menos de 20 minutos",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "graficos",
    "verification": "transcript_reviewed",
    "note": "Indicadores respondem a perguntas diferentes: direção, força, volatilidade e referências. Médias, MACD, IFR, estocástico, Bollinger e volume são contextuais, não ordens.",
    "researchQuestion": "Distinguir variáveis correlacionadas; checar contribuição informacional marginal de cada indicador.",
    "url": "https://www.youtube.com/watch?v=mz2O6K6JF4k"
  },
  {
    "id": "CIm6HlYLzLU",
    "kind": "video",
    "title": "Os 12 Segredos do TRADER MAIS LUCRATIVO do Mundo (auditado)",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "laboratorio",
    "verification": "transcript_reviewed",
    "note": "Entrevista de Larry Williams interpretada pelo autor: expectativa matemática, assimetria ganho/perda, barra de ignição versus exaustão, paciência e risco. Afirmações históricas exigem fonte independente.",
    "researchQuestion": "Não confundir alta taxa de acerto com expectativa líquida positiva; testar sob custos e drawdown.",
    "url": "https://www.youtube.com/watch?v=CIm6HlYLzLU"
  },
  {
    "id": "uP8C5nasdUA",
    "kind": "video",
    "title": "Passei meses perdendo dinheiro, ATÉ DESCOBRIR ESSE SETUP",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "estrategias",
    "verification": "transcript_reviewed",
    "note": "Rompimento por price action, entrada/stop/alvo previstos, espera pelo setup e disciplina. Resultados pessoais relatados não são atestação de vantagem.",
    "researchQuestion": "Pré-registrar gatilhos objetivos e evitar múltiplas variantes após observar resultados.",
    "url": "https://www.youtube.com/watch?v=uP8C5nasdUA"
  },
  {
    "id": "UcsI6Z8LfSE",
    "kind": "short",
    "title": "Os candles contam uma história e vocêr precisa aprender a ler.",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "graficos",
    "verification": "metadata_verified_no_captions",
    "note": "Short publicado sem legendas acessíveis. Somente o título e a descrição pública foram verificados; não atribuir técnica detalhada.",
    "researchQuestion": "Material visual a revisar; não há regra quantitativa extraída.",
    "url": "https://www.youtube.com/shorts/UcsI6Z8LfSE"
  },
  {
    "id": "Y5gk-wBkdRM",
    "kind": "video",
    "title": "Se Você Dominar a Estratégia...Vai Dominar o Dinheiro",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "graficos",
    "verification": "transcript_reviewed",
    "note": "Ciclos de Wyckoff descritos como acumulação, avanço, distribuição e queda; confirmação por estrutura, volume e falhas de rompimento. Exemplos macro são interpretações de época, não previsão.",
    "researchQuestion": "Pré-definir estados de regime e exigir confirmação sem classificar o ciclo pelo futuro.",
    "url": "https://www.youtube.com/watch?v=Y5gk-wBkdRM"
  },
  {
    "id": "_k2XN41-_f8",
    "kind": "video",
    "title": "A ÚNICA HABILIDADE que você precisa para SER CONSISTENTE",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "execucao",
    "verification": "transcript_reviewed",
    "note": "Psicologia e disciplina baseadas em Mark Douglas: evitar revanche após stop, posição dobrada para recuperar perdas, violação do plano e decisões movidas por emoções.",
    "researchQuestion": "Monitorar comportamento de risco e desvios de plano sem prometer vantagem econômica.",
    "url": "https://www.youtube.com/watch?v=_k2XN41-_f8"
  },
  {
    "id": "07qpAS6akb0",
    "kind": "short",
    "title": "Se você não sabe ler o que o gráfico te entrega, você não pode ser um trader de sucesso.",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "graficos",
    "verification": "metadata_verified_no_captions",
    "note": "Short sem transcrição disponível. O título refere-se à leitura de gráficos, sem parâmetros técnicos verificáveis.",
    "researchQuestion": "É necessária revisão visual para identificar qualquer regra específica.",
    "url": "https://www.youtube.com/shorts/07qpAS6akb0"
  },
  {
    "id": "kKbTFQxUrtY",
    "kind": "short",
    "title": "Esses padrões vão te ajudar a definir onde entrar, onde invalidar e quando ficar de fora.",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "estrategias",
    "verification": "metadata_verified_music_only",
    "note": "Short com legenda automática apenas de música, sem explicação falada útil; título sugere entradas/invalidação.",
    "researchQuestion": "Nenhum gatilho de entrada foi confirmado pelo áudio.",
    "url": "https://www.youtube.com/shorts/kKbTFQxUrtY"
  },
  {
    "id": "jXcIfXxdsN4",
    "kind": "video",
    "title": "Todo CANDLE conta uma HISTÓRIA: Aprenda a PREVER o Mercado!",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "graficos",
    "verification": "transcript_reviewed",
    "note": "Leitura de amplitude, tamanho do corpo, sombras e fechamento relativo para distinguir força, rejeição e indecisão; contexto de tendência importa mais que nome do padrão.",
    "researchQuestion": "Quantificar corpo/range/wicks sem tratar um candle isolado como previsão certa.",
    "url": "https://www.youtube.com/watch?v=jXcIfXxdsN4"
  },
  {
    "id": "SRsdBdGT6dE",
    "kind": "short",
    "title": "Estratégia simples: engolfo de baixa + Stoch. RSI 📊",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "estrategias",
    "verification": "metadata_verified_no_captions",
    "note": "Short sem transcrição acessível. O título menciona engolfo de baixa e Stoch RSI, mas nenhuma regra completa foi auditada.",
    "researchQuestion": "Comparar engolfo e estocástico somente após verificar definições exatas do vídeo.",
    "url": "https://www.youtube.com/shorts/SRsdBdGT6dE"
  },
  {
    "id": "HSrdYcETBmE",
    "kind": "short",
    "title": "Regra essencial pra tu que tá começando e precisa de um operacional funcional!",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "estrategias",
    "verification": "transcript_reviewed",
    "note": "Retratação aproximada de 38,2%, 50% e 61,8% em correção de tendência, condicionada à presença posterior de sinal de reversão; a legenda não define execução completa.",
    "researchQuestion": "Tratar zonas de Fibonacci como hipótese descritiva, não vantagem estatística.",
    "url": "https://www.youtube.com/shorts/HSrdYcETBmE"
  },
  {
    "id": "gbo9Q2IsGHQ",
    "kind": "video",
    "title": "Esse Trader REVELOU O SEGREDO dos Tubarões",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "laboratorio",
    "verification": "transcript_reviewed",
    "note": "Entrevista Lucas Costa (BTG): contexto e continuação após consolidação, força de movimentos, comparação de amplitudes/corpos, avaliação de payoff e vieses de confirmação/retrospectiva.",
    "researchQuestion": "Verificar se rompimento a favor da tendência acrescenta resultado líquido sobre baseline.",
    "url": "https://www.youtube.com/watch?v=gbo9Q2IsGHQ"
  },
  {
    "id": "T26RN9f9AMI",
    "kind": "video",
    "title": "ELE REVELOU SUA ESTRATÉGIA SAGRADA (e ninguém acredita)",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "execucao",
    "verification": "transcript_reviewed",
    "note": "Entrevista André Moraes: stop técnico conforme estrutura, disciplina e confirmação em múltiplos tempos; respeitar invalidação e limitar perdas.",
    "researchQuestion": "Testar entradas, stops e reentradas como procedimentos distintos, sem martingale.",
    "url": "https://www.youtube.com/watch?v=T26RN9f9AMI"
  },
  {
    "id": "klYqVdHcTws",
    "kind": "video",
    "title": "Ele fez U$100.000 POR DIA (com day trade)",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "laboratorio",
    "verification": "transcript_reviewed",
    "note": "Narrativa biográfica de Steve Cohen, leitura de fluxo/notícias e psicologia. Números de desempenho e alegações controversas não foram auditados; exemplos retrospectivos sujeitos a viés.",
    "researchQuestion": "Estudos de eventos/notícias devem excluir informação futura e sobreviver a custos.",
    "url": "https://www.youtube.com/watch?v=klYqVdHcTws"
  },
  {
    "id": "4GONM3_jMNw",
    "kind": "video",
    "title": "8 PADRÕES de REVERSÃO mais PODEROSOS 😱 ( Sinal de Entrada e Saída ) 💰⚡️🚀",
    "channel": "Fabrício Lorenz - Trader e Investidor",
    "trackId": "estrategias",
    "verification": "transcript_reviewed",
    "note": "Padrões gráficos como estrela da tarde, estrela da manhã e engolfo; são citados percentuais de reversão 72%–86%, não auditados e sem comparação metodológica; contexto altera interpretação.",
    "researchQuestion": "Pré-registrar critérios de candle, universo, janela de resultado, taxas e múltiplos testes.",
    "url": "https://www.youtube.com/watch?v=4GONM3_jMNw"
  },
  {
    "id": "PLjp0U_VKdVKriZwroNLVtoehVCRnFa9J7",
    "kind": "playlist",
    "title": "Playlist de trade enviada — 01",
    "channel": null,
    "trackId": "biblioteca",
    "verification": "needs_playlist_review",
    "note": "Itens e conteúdo não enumerados de forma confiável.",
    "researchQuestion": "Abrir a playlist e registrar vídeos/títulos antes de atribuir tópicos.",
    "url": "https://www.youtube.com/playlist?list=PLjp0U_VKdVKriZwroNLVtoehVCRnFa9J7"
  },
  {
    "id": "PLjp0U_VKdVKraDoIAHPHAv8a4pCFDFC5q",
    "kind": "playlist",
    "title": "Playlist de trade enviada — 02",
    "channel": null,
    "trackId": "biblioteca",
    "verification": "needs_playlist_review",
    "note": "Itens e conteúdo não enumerados de forma confiável.",
    "researchQuestion": "Abrir a playlist e registrar vídeos/títulos antes de atribuir tópicos.",
    "url": "https://www.youtube.com/playlist?list=PLjp0U_VKdVKraDoIAHPHAv8a4pCFDFC5q"
  },
  {
    "id": "PLjp0U_VKdVKolNOxyhpkKzTVUnulyHOGE",
    "kind": "playlist",
    "title": "Playlist de trade enviada — 03",
    "channel": null,
    "trackId": "biblioteca",
    "verification": "needs_playlist_review",
    "note": "Itens e conteúdo não enumerados de forma confiável.",
    "researchQuestion": "Abrir a playlist e registrar vídeos/títulos antes de atribuir tópicos.",
    "url": "https://www.youtube.com/playlist?list=PLjp0U_VKdVKolNOxyhpkKzTVUnulyHOGE"
  },
...SUPPLEMENTAL_TRADE_VIDEO_RESOURCES
].map(r=>Object.freeze(r)));
export function resourcesByTrack(trackId){return USER_VIDEO_RESOURCES.filter(x=>x.trackId===trackId);}
