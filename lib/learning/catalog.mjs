// Conteúdo educativo original JENIOS. Fontes são referências, não afiliações. Não contém gabaritos.
export const CURRICULUM_VERSION = "r26.1";
export const SOURCES = [
  {
    "id": "b3-modalidades",
    "title": "B3 Educação · Day trade e swing trade",
    "url": "https://edu.b3.com.br/w/diferencas-entre-day-trade-e-swing-trade",
    "note": "Referência conceitual; não é endosso à JENIOS.",
    "reviewedAt": "2026-10-16"
  },
  {
    "id": "cvm-riscos",
    "title": "CVM · Caderno educativo Day Trade",
    "url": "https://www.gov.br/cvm/pt-br/assuntos/noticias/2020/educacao-financeira-em-pauta--cvm-lanca-materiais-educativos-sobre-day-trade-e-funcionamento-da-bolsa-de-valores-5221f3b6650040a084fd7e3554ad9807/",
    "note": "Referência para riscos, custos e vieses. Não generalizar uma amostra para todo o mercado.",
    "reviewedAt": "2026-10-16"
  },
  {
    "id": "sec-orders",
    "title": "Investor.gov / SEC · Tipos de ordens",
    "url": "https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/types-orders",
    "note": "Exemplos de ações dos EUA; confirmar regras do produto e da corretora utilizados.",
    "reviewedAt": "2026-10-16"
  },
  {
    "id": "sec-stops",
    "title": "Investor.gov / SEC · Stop e stop-limit",
    "url": "https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15",
    "note": "Referência conceitual, sem garantia de preço de execução.",
    "reviewedAt": "2026-10-16"
  },
  {
    "id": "cme-charts",
    "title": "CME Group · Candles, barras e linhas",
    "url": "https://www.cmegroup.com/education/courses/technical-analysis/chart-types-candlestick-line-bar",
    "note": "Tipos de representação e períodos; sem sinal de compra ou venda.",
    "reviewedAt": "2026-10-16"
  },
  {
    "id": "cme-analysis",
    "title": "CME Group · Fundamentos de análise técnica",
    "url": "https://www.cmegroup.com/education/courses/trading-and-analysis/technical-analysis",
    "note": "Diferenciar observação de interpretação.",
    "reviewedAt": "2026-10-16"
  },
  {
    "id": "cme-support",
    "title": "CME Group · Suporte e resistência",
    "url": "https://www.cmegroup.com/education/courses/technical-analysis/support-and-resistance",
    "note": "Referência de níveis e contexto, não de previsões certas.",
    "reviewedAt": "2026-10-16"
  },
  {
    "id": "cme-course",
    "title": "CME Group · Análise técnica",
    "url": "https://www.cmegroup.com/education/courses/technical-analysis",
    "note": "Índice de temas; as regras e exercícios JENIOS são originais.",
    "reviewedAt": "2026-10-16"
  },
  {
    "id": "ies-learning",
    "title": "IES / WWC · Organização do estudo",
    "url": "https://ies.ed.gov/ncee/wwc/PracticeGuide/1",
    "note": "Referência pedagógica para exemplos, exercícios, recuperação e espaçamento. Os limiares JENIOS são escolhas de produto, não escalas científicas.",
    "reviewedAt": "2026-10-16"
  },
  {
    "id": "cvm-robots",
    "title": "CVM · Robôs de investimentos",
    "url": "https://www.gov.br/investidor/pt-br/investir/como-investir/profissionais-do-mercado/robos-de-investimentos",
    "note": "Automação não é demonstração de rentabilidade; atividade efetiva importa para o enquadramento.",
    "reviewedAt": "2026-10-16"
  },
  {
    "id": "lorenz-public",
    "title": "Fabrício Lorenz · Programa público de Price Action",
    "url": "https://lorenzfabricio.com.br/epa-tp-a/",
    "note": "Somente o programa público foi consultado. Sem acesso ao curso pago, sem cópia de apostilas ou validação de resultados.",
    "reviewedAt": "2026-10-16"
  }
];
export const TRACKS = [
  {
    "id": "fundamentos",
    "title": "Do zero ao primeiro plano",
    "level": "Iniciante",
    "order": 0,
    "description": "Entenda o mercado antes de pensar em apertar um botão.",
    "requires": []
  },
  {
    "id": "graficos",
    "title": "Ler o gráfico sem adivinhar",
    "level": "Básico",
    "order": 1,
    "description": "Preço, candles, tempo e contexto em linguagem simples.",
    "requires": [
      "fundamentos"
    ]
  },
  {
    "id": "execucao",
    "title": "Operar é seguir um processo",
    "level": "Intermediário",
    "order": 2,
    "description": "Ordens, tamanho de posição, sessões e diário de decisões.",
    "requires": [
      "graficos"
    ]
  },
  {
    "id": "estrategias",
    "title": "Dos sinais às hipóteses",
    "level": "Avançado",
    "order": 3,
    "description": "Rompimentos, correções e confirmação sem promessas.",
    "requires": [
      "execucao"
    ]
  },
  {
    "id": "laboratorio",
    "title": "Laboratório Hard",
    "level": "Hard",
    "order": 4,
    "description": "Estatística, vieses de teste e limites da automação.",
    "requires": [
      "estrategias"
    ]
  }
];
export const LESSONS = [
  {
    "id": "mercado",
    "trackId": "fundamentos",
    "title": "O que você negocia quando opera?",
    "minutes": 8,
    "objective": "Distinguir ativo, contrato, preço, liquidez e papel da corretora.",
    "paragraphs": [
      "Um ativo não é apenas uma linha colorida. Uma ação representa participação em uma empresa; um contrato derivativo possui especificações próprias. Antes de estudar um sinal, identifique exatamente o instrumento, sua moeda e sua unidade de negociação.",
      "Comprado significa estar exposto à alta de preço; vendido significa estar exposto à queda. Estar de fora também é uma decisão. Venda a descoberto, derivativos e alavancagem possuem riscos e regras diferentes de comprar uma ação à vista.",
      "A corretora intermedeia o acesso; o gráfico mostra informações; a JENIOS é um software. Uma tela com status “conectado” não basta: qualquer integração real depende de autorização e confirmação do prestador. Nesta trilha não há envio de ordens."
    ],
    "example": "Exemplo fictício: uma unidade comprada por 100 e vendida por 103 gera 3 de resultado bruto. Se os custos totais forem 4, o resultado líquido é −1. Acertar a direção não basta.",
    "exercise": "Explique com suas palavras a diferença entre preço e resultado líquido. Não use dados da sua conta.",
    "flashcard": "Uma tela de gráfico confirma que uma corretora recebeu uma ordem?",
    "sourceIds": [
      "cvm-riscos",
      "cvm-robots"
    ],
    "keywords": [
      "ativo",
      "ação",
      "corretora",
      "derivativo",
      "comprado",
      "vendido",
      "liquidez"
    ],
    "chart": false
  },
  {
    "id": "day-swing",
    "trackId": "fundamentos",
    "title": "Day trade ou swing trade?",
    "minutes": 8,
    "objective": "Distinguir o horizonte de manutenção da posição do período do gráfico.",
    "paragraphs": [
      "Day trade envolve abrir e encerrar a posição no mesmo dia. No swing trade, a posição atravessa sessões. Não é o nome do indicador que define a modalidade: é como você planeja manter e encerrar a exposição.",
      "Ficar posicionado entre sessões acrescenta riscos, como a abertura com salto de preço. Encerrar no mesmo dia não elimina riscos de liquidez, execução ou alavancagem. Nenhuma modalidade é automaticamente mais lucrativa ou adequada a todos.",
      "Um gráfico de cinco minutos pode servir a uma observação de curto prazo dentro de um plano de horizonte maior. Defina primeiro o horizonte da decisão, depois os dados necessários para acompanhá-la."
    ],
    "example": "Exemplo: fechar hoje uma posição iniciada hoje é uma operação intradiária. Manter até outra sessão muda a exposição, mesmo que a tela continue em cinco minutos.",
    "exercise": "Descreva um risco de manter posição durante a noite e um risco que continua existindo dentro do mesmo dia.",
    "flashcard": "Usar um gráfico diário obriga você a manter uma posição por vários dias?",
    "sourceIds": [
      "b3-modalidades"
    ],
    "keywords": [
      "day trade",
      "swing",
      "posição",
      "horizonte",
      "noite",
      "gap"
    ],
    "chart": false
  },
  {
    "id": "risco",
    "trackId": "fundamentos",
    "title": "Perder pouco começa antes da entrada",
    "minutes": 10,
    "objective": "Separar limite planejado de perda máxima garantida.",
    "paragraphs": [
      "Antes de uma operação, escreva o motivo, o ponto que invalidaria a hipótese e o risco planejado. Usar dinheiro essencial para despesas ou emergências para perseguir uma recuperação rápida não é um exercício desta trilha.",
      "Stop é um mecanismo de disparo de uma ordem, não uma garantia de execução naquele preço. Falta de liquidez e saltos de preço podem causar resultado pior que o planejado. A margem exigida também não representa necessariamente a perda máxima.",
      "Não aumentar a posição para recuperar perdas e interromper novas entradas ao atingir um limite são regras de processo que podem ser definidas previamente. Na JENIOS, concluir uma aula ou avaliação não libera conta real."
    ],
    "example": "Exemplo didático: entrada 50, stop planejado 48 e 10 unidades produzem risco nominal de 20, antes de custos e execução. Se a primeira possibilidade de saída surgir em 45, a perda pode ser maior.",
    "exercise": "Por que a frase “tenho stop, então nunca perderei mais que o planejado” é perigosa?",
    "flashcard": "Margem e perda máxima são a mesma coisa?",
    "sourceIds": [
      "sec-stops",
      "cvm-riscos"
    ],
    "keywords": [
      "risco",
      "stop",
      "margem",
      "alavancagem",
      "perda",
      "limite"
    ],
    "chart": false
  },
  {
    "id": "candles",
    "trackId": "graficos",
    "title": "Linhas, barras e candles",
    "minutes": 10,
    "objective": "Ler abertura, máxima, mínima e fechamento em um exemplo.",
    "paragraphs": [
      "A linha normalmente liga um valor de cada intervalo, frequentemente o fechamento. Barras e candles podem mostrar abertura, máxima, mínima e fechamento. Trocar a aparência não cria informação nova que não esteja na série de origem.",
      "No candle, o corpo liga abertura e fechamento; os pavios alcançam máxima e mínima. As cores dependem da configuração. Um corpo grande mostra um deslocamento maior naquele intervalo, mas isoladamente não comprova a direção seguinte.",
      "Use o laboratório abaixo para comparar representações dos mesmos dados fictícios. Pergunte sempre se o candle já fechou: enquanto ele se forma, seus valores podem mudar."
    ],
    "example": "Abertura 100, máxima 106, mínima 98, fechamento 104: corpo de 4 e amplitude de 8. A cor é uma convenção; os quatro valores são a informação.",
    "exercise": "Desenhe mentalmente um candle que abre em 104 e fecha em 100. O que muda em relação ao exemplo?",
    "flashcard": "Um candle revela em que ordem a máxima e a mínima aconteceram?",
    "sourceIds": [
      "cme-charts"
    ],
    "keywords": [
      "candle",
      "vela",
      "barra",
      "linha",
      "abertura",
      "fechamento",
      "pavio",
      "gráfico"
    ],
    "chart": true
  },
  {
    "id": "tempo",
    "trackId": "graficos",
    "title": "Tempo de gráfico e contexto",
    "minutes": 9,
    "objective": "Relacionar dados agregados, horizonte e perda de informação.",
    "paragraphs": [
      "Um período de gráfico define como os negócios são agrupados. Ao agregar cinco barras de um minuto, a abertura é a primeira, a máxima é a maior máxima, a mínima é a menor mínima e o fechamento é o último.",
      "Um período maior pode reduzir detalhes e destacar contexto; um período menor mostra mais oscilações. Muitos movimentos aparentes não tornam o sinal melhor. A escolha depende da hipótese e dos dados, não de uma lista universal de períodos vencedores.",
      "Um cenário pode ter movimento de alta em um recorte curto e baixa em um recorte maior. Isso não é contradição nos dados: são perguntas diferentes. Não confunda atualização rápida da tela com qualidade ou licença do dado."
    ],
    "example": "Se cinco minutos começam em 100 e terminam em 102, o candle agregado fecha em 102, mesmo que um minuto intermediário tenha tocado 105.",
    "exercise": "Escolha dois horizontes para um exemplo simulado e explique qual pergunta cada um ajuda a responder.",
    "flashcard": "Cinco candles de um minuto podem ser substituídos por cinco candles diários na mesma regra sem novo teste?",
    "sourceIds": [
      "cme-charts",
      "cme-analysis"
    ],
    "keywords": [
      "tempo",
      "timeframe",
      "período",
      "1m",
      "5m",
      "diário",
      "agregação"
    ],
    "chart": true
  },
  {
    "id": "contexto",
    "trackId": "graficos",
    "title": "Tendência, lateralização, suporte e resistência",
    "minutes": 10,
    "objective": "Descrever níveis como hipóteses, não barreiras certas.",
    "paragraphs": [
      "Tendência descreve uma direção predominante em um recorte; lateralização descreve deslocamentos sem direção sustentada naquele recorte. A definição precisa ser objetiva quando for utilizada por um robô.",
      "Suportes e resistências são regiões que o analista acompanha como possíveis pontos de reação. Não são paredes impenetráveis. A região pode ser ultrapassada, e um antigo nível pode assumir outro papel.",
      "Marque a região antes do movimento que deseja avaliar. Desenhar os níveis depois do resultado pode criar uma ilusão de previsibilidade. Registre o motivo e o momento de cada marcação."
    ],
    "example": "Exemplo hipotético: o preço reagiu perto de 100 duas vezes. Você marca 99–101 como região de observação. Isso não garante uma terceira reação.",
    "exercise": "Explique o que faria você abandonar uma hipótese de suporte, sem usar o resultado futuro como justificativa.",
    "flashcard": "Uma sequência curta de candles verdes comprova tendência em todos os horizontes?",
    "sourceIds": [
      "cme-support",
      "cme-analysis"
    ],
    "keywords": [
      "tendência",
      "lateral",
      "suporte",
      "resistência",
      "topo",
      "fundo"
    ],
    "chart": false
  },
  {
    "id": "ordens",
    "trackId": "execucao",
    "title": "Da intenção à execução",
    "minutes": 10,
    "objective": "Diferenciar ordem a mercado, limitada e stop.",
    "paragraphs": [
      "Uma ordem a mercado prioriza obter execução nas condições disponíveis; o preço final pode variar. Uma limitada estabelece um preço aceitável ou melhor, mas pode não executar. Uma ordem enviada e uma ordem executada são estados diferentes.",
      "Uma ordem stop, ao atingir a condição de disparo, pode virar ordem a mercado. A stop-limit passa a ser limitada e pode ficar sem execução. Os critérios de disparo e tipos disponíveis variam conforme corretora e mercado.",
      "Em sistemas, um timeout significa que o resultado ainda é desconhecido, não que nada aconteceu. Antes de reenviar uma ordem, é necessário consultar o identificador e reconciliar o estado. Estes são conceitos; o módulo de ensino não roteia ordens."
    ],
    "example": "Exemplo fictício: uma compra limitada a 10 não autoriza execução em 10,50. Caso só existam ofertas acima de 10, ela pode continuar pendente.",
    "exercise": "O que você verificaria depois de um timeout antes de considerar um novo envio?",
    "flashcard": "Uma stop-limit troca qual risco por qual controle?",
    "sourceIds": [
      "sec-orders",
      "sec-stops"
    ],
    "keywords": [
      "ordem",
      "limitada",
      "mercado",
      "stop-limit",
      "execução",
      "timeout",
      "parcial"
    ],
    "chart": false
  },
  {
    "id": "tamanho",
    "trackId": "execucao",
    "title": "Tamanho da posição e custos",
    "minutes": 12,
    "objective": "Resolver um problema didático de dimensionamento.",
    "paragraphs": [
      "Risco nominal é distância entre entrada e stop multiplicada pela quantidade e pelo valor da unidade ou ponto. Custos e folga para execução devem entrar no orçamento. A regra precisa respeitar o tamanho mínimo negociável.",
      "Capital alocado, margem e risco não são sinônimos. Se você não conhece o valor do ponto ou a especificação do instrumento, não há base suficiente para dimensionar a posição.",
      "No exercício, usamos uma unidade fictícia e nenhuma recomendação percentual para a sua conta. O resultado matemático é um teto sob premissas didáticas, não uma garantia de perda máxima."
    ],
    "example": "Orçamento fictício 60, distância até o stop 2 e custo estimado 1 por unidade: custo de risco por unidade 3; quantidade máxima didática 20. Se o mínimo fosse 25, a resposta seria não executar.",
    "exercise": "Refaça o exemplo com orçamento 50. Explique por que arredondar a quantidade para cima violaria o orçamento.",
    "flashcard": "Um ativo barato por unidade é necessariamente menos arriscado?",
    "sourceIds": [
      "sec-orders",
      "sec-stops"
    ],
    "keywords": [
      "tamanho",
      "quantidade",
      "contrato",
      "custo",
      "spread",
      "slippage",
      "dimensionamento"
    ],
    "chart": false
  },
  {
    "id": "plano",
    "trackId": "execucao",
    "title": "Plano, horários e diário",
    "minutes": 9,
    "objective": "Registrar condições de atuação e de não atuação.",
    "paragraphs": [
      "Um plano de estudo operacional registra instrumento, horizonte, condições de entrada, invalidação, saída, limites e eventos que recomendam esperar. A disponibilidade de tempo do estudante ajuda a organizar o estudo, não determina automaticamente uma estratégia vencedora.",
      "Horário de negociação é uma regra do mercado. Melhor horário para uma hipótese é uma questão de evidência: examine liquidez, spread, volatilidade, eventos e resultados líquidos separados por sessão. Calendários, feriados e mudanças de fuso precisam ser confirmados em fonte oficial.",
      "O diário deve separar decisão planejada de execução e resultado. Ganhar descumprindo o plano não demonstra que o processo foi bom; perder respeitando-o não prova que foi ruim."
    ],
    "example": "Exemplo de registro: “não operar durante dado importante sem um plano específico”. Essa regra pode reduzir uma exposição indesejada sem prever a direção da notícia.",
    "exercise": "Crie um checklist com uma condição de entrada e duas condições de não operação para um exercício simulado.",
    "flashcard": "Qual a diferença entre o horário de abertura e um horário comprovadamente melhor para sua estratégia?",
    "sourceIds": [
      "cvm-riscos",
      "cme-analysis"
    ],
    "keywords": [
      "horário",
      "sessão",
      "fuso",
      "notícia",
      "diário",
      "plano",
      "disciplina"
    ],
    "chart": false
  },
  {
    "id": "rompimentos",
    "trackId": "estrategias",
    "title": "Rompimento e falso rompimento",
    "minutes": 12,
    "objective": "Transformar uma interpretação em uma hipótese verificável.",
    "paragraphs": [
      "Um rompimento pode ser definido como a passagem de preço por uma região previamente marcada. Antes de testar, escolha critérios: toque, fechamento além do nível, tolerância, volume e prazo de confirmação. Alterar a definição depois do resultado invalida a comparação.",
      "Falso rompimento descreve uma passagem seguida de retorno sob uma definição específica. O padrão não identifica, por si só, um banco ou alguém caçando seu stop. Hipóteses de causa não devem ser anunciadas como dados observados.",
      "No programa público consultado de Lorenz aparecem temas como barra de ignição, rompimento de lateralização estreita e primeiro teste. A lista exata dos “10 sinais de um livro” citada pelo fundador ainda não foi confirmada; não a apresentamos como técnica homologada."
    ],
    "example": "Exercício autoral: nível 100 marcado antes; exigir fechamento acima de 101 e testar entrada na próxima barra. Se o critério não ocorre, não existe sinal nessa regra, mesmo que a alta venha depois.",
    "exercise": "Escreva uma definição de rompimento que outra pessoa consiga reproduzir apenas com os dados disponíveis naquele instante.",
    "flashcard": "Um rompimento com volume confirma automaticamente a identidade de quem negociou?",
    "sourceIds": [
      "cme-support",
      "lorenz-public"
    ],
    "keywords": [
      "rompimento",
      "falso",
      "ignição",
      "primeiro teste",
      "baleia",
      "breakout",
      "volume"
    ],
    "chart": false
  },
  {
    "id": "correcoes",
    "trackId": "estrategias",
    "title": "Correção, continuação e retorno à média",
    "minutes": 11,
    "objective": "Distinguir famílias de estratégia e o contexto em que serão testadas.",
    "paragraphs": [
      "Buscar continuação após uma correção é diferente de apostar que o preço retornará a uma média. As hipóteses podem entrar em conflito. O mesmo indicador não resolve a escolha sem definir o contexto.",
      "Um pullback é um movimento de retorno a uma região de interesse. Ele pode falhar e se transformar em algo maior. Use uma condição de confirmação e um ponto de invalidação definidos antes de observar o desfecho.",
      "A JENIOS compara regras em pesquisa. Manual, reverso e híbrido descrevem formas de tratar a intenção; nenhum nome é garantia de lucro. “Não fazer nada” permanece uma resposta válida quando os critérios não se alinham."
    ],
    "example": "Exemplo autoral: hipótese A espera retomada após correção; hipótese B espera retorno a uma média em mercado lateral. Sem um critério de regime, não faz sentido somar os sinais como se fossem iguais.",
    "exercise": "Defina uma situação em que uma regra de retorno à média deveria ficar de fora.",
    "flashcard": "Inverter uma estratégia que perde depois dos custos elimina esses custos?",
    "sourceIds": [
      "cme-course",
      "cme-analysis"
    ],
    "keywords": [
      "pullback",
      "correção",
      "continuação",
      "média",
      "reversão",
      "reverso",
      "híbrido"
    ],
    "chart": false
  },
  {
    "id": "indicadores",
    "trackId": "estrategias",
    "title": "Indicadores: informação, não votos",
    "minutes": 11,
    "objective": "Explicar o papel e os limites de médias, momentum e volatilidade.",
    "paragraphs": [
      "Indicadores são transformações de dados. Médias ajudam a resumir preço; medidas de volatilidade descrevem variação; osciladores apresentam recortes de momentum ou posição relativa. Cada cálculo precisa ter parâmetros explícitos.",
      "Cinco indicadores derivados da mesma série podem repetir uma informação. Contá-los como cinco evidências independentes aumenta a confiança sem necessariamente aumentar a informação.",
      "A interpretação de uma condição extrema depende do contexto. Em vez de decorar “sobrecomprado é venda”, formule uma hipótese, defina invalidação e compare o resultado líquido com alternativas. Um indicador calculado corretamente ainda pode não oferecer vantagem operacional."
    ],
    "example": "Exemplo autoral: duas médias e um oscilador podem reagir ao mesmo deslocamento. Um voto majoritário entre eles não mede, sozinho, a probabilidade da próxima barra.",
    "exercise": "Explique por que você escolheu um indicador em um exercício e qual informação ele não fornece.",
    "flashcard": "Um parâmetro escolhido por produzir o melhor gráfico passado já foi validado?",
    "sourceIds": [
      "cme-course"
    ],
    "keywords": [
      "indicador",
      "média",
      "RSI",
      "MACD",
      "ATR",
      "ADX",
      "Bollinger",
      "momentum"
    ],
    "chart": false
  },
  {
    "id": "estatistica",
    "trackId": "laboratorio",
    "title": "Acerto, expectativa e drawdown",
    "minutes": 14,
    "objective": "Avaliar uma hipótese além da taxa de acerto.",
    "paragraphs": [
      "Resultado esperado depende da frequência dos resultados, do tamanho dos ganhos e perdas e dos custos. Uma taxa de acerto alta pode esconder perdas raras e muito grandes.",
      "Drawdown mede a queda em relação a um pico anterior de uma curva de resultados. Uma recuperação percentual é calculada sobre uma base menor; por isso, perder 20% e ganhar 20% depois não devolve o capital ao início.",
      "Uma amostra pequena não demonstra estabilidade. Separe variabilidade de defeito no processo, registre incerteza e não transforme uma avaliação pedagógica em validação financeira."
    ],
    "example": "Exemplo matemático: 40% de ganhos de 3R e 60% de perdas de 1R geram 0,6R antes de custos. Com custo médio de 0,7R, o resultado esperado líquido é −0,1R.",
    "exercise": "Calcule o resultado esperado de 70% de ganhos de 1R e 30% de perdas de 3R, com custo de 0,1R.",
    "flashcard": "Qual informação falta quando alguém mostra apenas “90% de acerto”?",
    "sourceIds": [
      "cvm-riscos"
    ],
    "keywords": [
      "estatística",
      "expectativa",
      "drawdown",
      "acerto",
      "amostra",
      "probabilidade",
      "R"
    ],
    "chart": false
  },
  {
    "id": "backtest",
    "trackId": "laboratorio",
    "title": "Backtest sem olhar o futuro",
    "minutes": 14,
    "objective": "Identificar antecipação de dados, sobreajuste e teste fora da amostra.",
    "paragraphs": [
      "Um teste histórico precisa reproduzir quais informações estavam disponíveis no momento da decisão. Usar um candle ainda não fechado como se seu fechamento já fosse conhecido é um exemplo de informação futura.",
      "Separar treino e teste cronologicamente ajuda a evitar reutilizar o mesmo resultado para escolher e validar a regra. Buscar centenas de parâmetros e publicar só o melhor cria um problema de seleção.",
      "Inclua custos, eventos, sessões e condições de execução. Se stop e alvo aparecem na mesma barra e a ordem dos eventos é desconhecida, não escolha sempre o caminho lucrativo. Registre a incerteza ou adote uma convenção conservadora."
    ],
    "example": "Exemplo autoral: escolher o melhor de 100 parâmetros no período A e “validá-lo” no mesmo A não é um teste independente. Reserve B, sem ajustes baseados em seu resultado.",
    "exercise": "Escreva três falhas que fariam você rejeitar um gráfico de backtest aparentemente perfeito.",
    "flashcard": "Um ótimo resultado fora da amostra garante o próximo mês?",
    "sourceIds": [
      "cvm-robots"
    ],
    "keywords": [
      "backtest",
      "futuro",
      "overfitting",
      "sobreajuste",
      "walk-forward",
      "amostra",
      "replay"
    ],
    "chart": false
  },
  {
    "id": "automacao",
    "trackId": "laboratorio",
    "title": "Robôs, falhas e decisão responsável",
    "minutes": 12,
    "objective": "Distinguir avaliação pedagógica, pesquisa e execução real.",
    "paragraphs": [
      "Um robô precisa de mais que um sinal: identidade, autorização, dados, limites, rastreabilidade e confirmação de execução. Uma conversa com IA não deve ter permissão implícita para movimentar uma conta.",
      "O assistente pode errar. Nesta escola ele explica o conteúdo e propõe exercícios; não conhece uma cotação atual apenas por conversar e não recomenda uma operação personalizada. Fontes e limites devem aparecer junto à explicação.",
      "Resultado da trilha mede acertos nas avaliações desta versão do conteúdo, não inteligência geral, habilitação profissional ou previsão de desempenho. O diagnóstico operacional da Platform é outra etapa. Concluir a escola não o substitui."
    ],
    "example": "Cenário simulado: o provedor para de responder. A resposta segura é sinalizar a falha e não anunciar leitura atual ou ordem executada. Conteúdo antigo não se torna dado novo por receber outra data.",
    "exercise": "Explique para outra pessoa como distinguir “pedido recebido”, “ordem enviada” e “negócio confirmado”.",
    "flashcard": "Quem autoriza uma ordem: o texto de uma conversa ou o contrato de segurança do sistema?",
    "sourceIds": [
      "cvm-robots"
    ],
    "keywords": [
      "robô",
      "IA",
      "inteligência",
      "segurança",
      "integração",
      "Gênio",
      "Gênia"
    ],
    "chart": false
  }
];
export const lessonById = id => LESSONS.find(x=>x.id===id);