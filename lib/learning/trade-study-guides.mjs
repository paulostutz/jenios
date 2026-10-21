/** Estudos originais complementares; não apresentam transcrição ou validação de vídeos. */
export const STUDY_GUIDES=Object.freeze([
  {
    "trackId": "fundamentos",
    "title": "Planejar o risco antes de pensar no sinal",
    "concept": "Uma boa leitura não elimina a possibilidade de perda. Considere tamanho da posição, distância do stop, custos e perdas consecutivas antes de discutir acertos.",
    "activity": "Anote por que um trade poderia falhar e se o capital suportaria esse resultado. Um acerto bruto não é lucro líquido.",
    "sourceStatus": "JENIOS_ORIGINAL_EDUCATIONAL_SYNTHESIS_NOT_VIDEO_TRANSCRIPT"
  },
  {
    "trackId": "graficos",
    "title": "Indicadores são instrumentos de leitura, não promessas",
    "concept": "Médias móveis medem direção suavizada; IFR, MACD e estocástico ajudam a observar momentum; Bollinger e ATR contextualizam volatilidade. Cada um pode atrasar, gerar ruído ou ficar extremo durante tendências.",
    "activity": "Compare duas janelas de candles fechados. Identifique quais indicadores concordam e quais apenas repetem a mesma informação.",
    "sourceStatus": "JENIOS_ORIGINAL_EDUCATIONAL_SYNTHESIS_NOT_VIDEO_TRANSCRIPT"
  },
  {
    "trackId": "execucao",
    "title": "Uma ordem enviada não é uma ordem executada",
    "concept": "Ordens podem ter execução parcial, rejeição, atraso ou stop acionado com slippage. A gestão deve reagir ao estado informado pela corretora e ao registro durável de risco.",
    "activity": "No simulador, descreva como agiria diante de uma ordem desconhecida: consultar e reconciliar, nunca reenviar automaticamente.",
    "sourceStatus": "JENIOS_ORIGINAL_EDUCATIONAL_SYNTHESIS_NOT_VIDEO_TRANSCRIPT"
  },
  {
    "trackId": "estrategias",
    "title": "Reversão exige contexto e invalidação",
    "concept": "Topos duplos, falhas de rompimento, candles de rejeição e divergências não oferecem probabilidades fixas. A hipótese deve definir contexto, gatilho, stop, alvo e regras objetivas de invalidação.",
    "activity": "Descreva um falso rompimento que seria ignorado por falta de confirmação de volume ou por tendência maior contrária.",
    "sourceStatus": "JENIOS_ORIGINAL_EDUCATIONAL_SYNTHESIS_NOT_VIDEO_TRANSCRIPT"
  },
  {
    "trackId": "laboratorio",
    "title": "Um vídeo inspira hipótese; o teste decide",
    "concept": "Pré-registre parâmetros e métrica principal; separe dados de treino, holdout e prospectivo, controle lookahead, custos, spread, slippage e múltiplas comparações. Documente cenários negativos.",
    "activity": "Planeje um teste comparável dos modos direto, reverso e híbrido com limites iguais e períodos que não vazem informação futura.",
    "sourceStatus": "JENIOS_ORIGINAL_EDUCATIONAL_SYNTHESIS_NOT_VIDEO_TRANSCRIPT"
  }
].map(x=>Object.freeze(x)));
