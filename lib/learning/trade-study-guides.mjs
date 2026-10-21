/** Conteúdo complementar autoral baseado em princípios públicos e revisão de legendas de vídeos do usuário. */
export const STUDY_GUIDES=Object.freeze([
  {
    "trackId": "fundamentos",
    "title": "Acerto não é rentabilidade: risco, payoff e expectativa",
    "concept": "Uma estratégia com elevada taxa de acerto pode perder dinheiro se uma única perda for maior que muitos ganhos. Considere valor médio das vitórias e derrotas, custos, exposição total, drawdown e caudas adversas. As entrevistas e aulas enviadas reforçam pensamento probabilístico e controles prévios: sucesso passado divulgado não é prova futura.",
    "activity": "Monte dois exemplos fictícios de 20 operações: um com muitos pequenos acertos e uma grande perda, outro com acertos menos frequentes e perdas pequenas. Compare resultado líquido e drawdown. Não use dados da sua conta.",
    "relatedVideoIds": [],
    "sourceStatus": "JENIOS_ORIGINAL_SYNTHESIS_REFERENCES_VERIFIED_CAPTIONS",
    "topics": [
      {
        "title": "Ganhar mais vezes não garante ganhar dinheiro",
        "explanation": "Expectativa considera acertos, tamanho médio dos ganhos, tamanho médio das perdas e custos. Uma operação correta também pode perder."
      },
      {
        "title": "Risco antes do gráfico",
        "explanation": "O risco financeiro, a distância do stop, o tamanho e a perda agregada devem ser definidos antes de avaliar um padrão."
      },
      {
        "title": "Saber ficar fora",
        "explanation": "Sem contexto adequado, autorização ou condição operacional segura, não operar é uma decisão racional."
      }
    ]
  },
  {
    "trackId": "graficos",
    "title": "Entenda o candle e escolha o indicador certo",
    "concept": "Amplitude, corpo e sombras ajudam a descrever convicção, rejeição e indecisão, mas não revelam com certeza quem comprou ou o próximo preço. Médias móveis resumem tendência, IFR/RSI e estocástico são osciladores, enquanto ATR e Bollinger descrevem volatilidade. Acumulação/distribuição na teoria Wyckoff são modelos interpretativos a confirmar, não causalidade comprovada.",
    "activity": "Com 20 candles fechados fictícios, compare corpo/intervalo total, sombra superior e inferior, tendência e faixa horizontal. Se RSI e estocástico concordarem, pergunte se isso é informação independente ou a mesma medida de momentum.",
    "relatedVideoIds": [
      "mz2O6K6JF4k",
      "UcsI6Z8LfSE",
      "Y5gk-wBkdRM",
      "07qpAS6akb0",
      "jXcIfXxdsN4"
    ],
    "sourceStatus": "JENIOS_ORIGINAL_SYNTHESIS_REFERENCES_VERIFIED_CAPTIONS",
    "topics": [
      {
        "title": "Primeiro o contexto",
        "explanation": "Distinga tendência, lateralização e transições sem supor que o mercado repetirá automaticamente o passado."
      },
      {
        "title": "Candle tem geometria",
        "explanation": "Corpo, posição do fechamento, amplitude e sombras ajudam a descrever pressão, rejeição ou dúvida; não formam previsão isolada."
      },
      {
        "title": "Indicador responde a uma pergunta",
        "explanation": "Médias suavizam direção, RSI/estocástico descrevem momentum, ATR e Bollinger situam variação; volume descreve participação aparente."
      },
      {
        "title": "Wyckoff é hipótese de regime",
        "explanation": "Acumulação, avanço, distribuição e queda exigem confirmação de comportamento e volume, sem classificar pelo desfecho futuro."
      }
    ]
  },
  {
    "trackId": "execucao",
    "title": "Método, manejo e mentalidade — sem revanche",
    "concept": "Operar com plano inclui ponto de invalidação, tamanho, stop de risco, saída pretendida, prazo de validade e reação a ordens parcialmente executadas. Um timeout nunca autoriza enviar novamente a mesma ordem; consulte a corretora e reconcilie com o livro de risco. O erro comportamental de aumentar a mão após perda pode transformar um erro pequeno em perda incompatível com a conta.",
    "activity": "Crie um checklist de ensaio: só iniciar com limites ativos; se ocorrer rejeição, parcial, timeout ou stop não confirmado, pausar novas entradas e solicitar revisão. A pausa local não cancela ordens nem encerra posições.",
    "relatedVideoIds": [
      "_k2XN41-_f8",
      "T26RN9f9AMI"
    ],
    "sourceStatus": "JENIOS_ORIGINAL_SYNTHESIS_REFERENCES_VERIFIED_CAPTIONS",
    "topics": [
      {
        "title": "Disciplina não é promessa de lucro",
        "explanation": "Aderir ao plano evita certas falhas humanas; só dados independentes mostram se o próprio plano tem vantagem."
      },
      {
        "title": "Stop técnico e estado da corretora",
        "explanation": "A ordem pode executar parcialmente, com slippage, ou não executar; não trate a intenção do robô como fill confirmado."
      },
      {
        "title": "Evite revancha e escalada de risco",
        "explanation": "Dobrar lotes após perda, aumentar posição contra stop e mexer em parâmetros após um resultado isolado são comportamentos a vigiar."
      },
      {
        "title": "Documente uma rotina",
        "explanation": "Entrada, invalidação, exposição máxima, critérios de pausa, conferência independente e diário devem anteceder qualquer teste Paper."
      }
    ]
  },
  {
    "trackId": "estrategias",
    "title": "Lateralização, falsos rompimentos e reversão à média",
    "concept": "Faixas de suporte/resistência e falsos rompimentos dependem da confirmação por candles fechados, volatilidade, liquidez e regras de invalidação. Um vídeo descreve a hipótese SMA200/IFR2/SMA5 de Larry Connors, mas a versão original não possui stop fixo de preço: sem limite de risco previamente aprovado ela é incompatível com o motor de proteção JENIOS. Padrões de reversão e percentuais anunciados não são probabilidades auditadas.",
    "activity": "Escreva antes do teste uma regra hipotética de entrada, um stop máximo conhecido antes da ordem, alvo ou saída temporal, custos e condição de não operar. Rejeite qualquer versão cuja perda máxima planejada não seja controlável.",
    "relatedVideoIds": [
      "IH5TuzAvFgk",
      "MFnC-tsp90Q",
      "uP8C5nasdUA",
      "kKbTFQxUrtY",
      "SRsdBdGT6dE",
      "HSrdYcETBmE",
      "4GONM3_jMNw"
    ],
    "sourceStatus": "JENIOS_ORIGINAL_SYNTHESIS_REFERENCES_VERIFIED_CAPTIONS",
    "topics": [
      {
        "title": "Reversão à média com contexto de tendência",
        "explanation": "Um exemplo descrito utiliza SMA(200), IFR/RSI(2) e SMA(5), mas sua viabilidade líquida em cada mercado exige backtest próprio."
      },
      {
        "title": "Lateralização não é qualquer zigue-zague",
        "explanation": "Regiões de suporte e resistência precisam de toques e tolerância pré-definidos; uma configuração no passado não garante o quinto movimento."
      },
      {
        "title": "Rompimento requer confirmação",
        "explanation": "Teste uma ruptura de consolidação a favor de contexto dominante, com critérios de falso rompimento e custo previamente congelados."
      },
      {
        "title": "Padrões de reversão são candidatos de pesquisa",
        "explanation": "Engolfos, estrelas, sombras e retrações são linguagens para formular hipóteses, não taxas universais de acerto."
      }
    ]
  },
  {
    "trackId": "laboratorio",
    "title": "Toda estratégia é hipótese até sobreviver aos dados futuros",
    "concept": "Um relato de trader famoso, um backtest ou uma taxa de acerto anunciada não prova vantagem estatística. Compare versões congeladas fora da amostra, com custos, spread, slippage, stop, financiamento e diferentes regimes. Documente quantas estratégias foram tentadas para reduzir viés de seleção; o núcleo original B182 apresentou evidências historicamente insuficientes e permanece não certificado.",
    "activity": "Pré-registre ativo, período, modo direto/reverso/híbrido e custos 0/10/30bps; embarque janelas de treino/holdout e acompanhe amostra prospectiva testemunhada. Registre separadamente perdas grandes, drawdown, fills não executados e conclusões negativas.",
    "relatedVideoIds": [
      "CIm6HlYLzLU",
      "gbo9Q2IsGHQ",
      "klYqVdHcTws"
    ],
    "sourceStatus": "JENIOS_ORIGINAL_SYNTHESIS_REFERENCES_VERIFIED_CAPTIONS",
    "topics": [
      {
        "title": "Estudo histórico versus prova prospectiva",
        "explanation": "Técnicas observadas em vídeos precisam ser comparadas com uma hipótese-base em holdout não retocado e janela futura independente."
      },
      {
        "title": "Expectativa líquida antes da taxa de acerto",
        "explanation": "Win rate, ganho/perda médio, spread, taxas, slippage e drawdown devem compor a decisão; relato de um criador não é auditoria."
      },
      {
        "title": "Evite otimizar o desenho vencedor",
        "explanation": "Ajustar RSI, médias, ativo e timeframe depois de conhecer a resposta aumenta o risco de sobreajuste."
      },
      {
        "title": "Comparação justa dos três modos",
        "explanation": "Direto, reverso e híbrido devem compartilhar orçamento de risco e infraestrutura de execução, sob mesmo regime de mercado e custos."
      }
    ]
  }
].map(x=>Object.freeze(x)));
