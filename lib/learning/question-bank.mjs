// SERVER ONLY. Nunca importar em componente client nem incluir no contexto do tutor.
export const QUESTION_BANK = [
  {
    "id": "fundamentos-1",
    "trackId": "fundamentos",
    "prompt": "Comprar por 100, vender por 103 e pagar 4 de custos produz qual resultado líquido?",
    "options": [
      "+3",
      "−1",
      "+7",
      "Não existem custos"
    ],
    "answer": 1,
    "explanation": "103 − 100 − 4 = −1. Acertar a direção não garante resultado líquido positivo.",
    "critical": false,
    "placement": true
  },
  {
    "id": "fundamentos-2",
    "trackId": "fundamentos",
    "prompt": "Qual situação caracteriza swing trade?",
    "options": [
      "Abrir e fechar obrigatoriamente no mesmo dia",
      "Usar qualquer gráfico de 5 minutos",
      "Manter a posição entre sessões",
      "Usar um robô"
    ],
    "answer": 2,
    "explanation": "O horizonte de manutenção, e não o indicador, distingue as modalidades.",
    "critical": false,
    "placement": true
  },
  {
    "id": "fundamentos-3",
    "trackId": "fundamentos",
    "prompt": "Um stop garante a perda exata planejada?",
    "options": [
      "Sim, sempre",
      "Sim, se a conta for pequena",
      "Somente usando candles",
      "Não; gaps e liquidez podem alterar a execução"
    ],
    "answer": 3,
    "explanation": "Stop não garante o preço efetivo. Não existe eliminação de risco por essa ordem.",
    "critical": true,
    "placement": true
  },
  {
    "id": "fundamentos-4",
    "trackId": "fundamentos",
    "prompt": "Para recuperar uma perda, aumentar o lote sem plano significa:",
    "options": [
      "Garantir o empate",
      "Aumentar a exposição sem demonstrar vantagem",
      "Eliminar o spread",
      "Reduzir automaticamente a perda"
    ],
    "answer": 1,
    "explanation": "A exposição aumenta. O prejuízo anterior não cria vantagem para a próxima operação.",
    "critical": true,
    "placement": true
  },
  {
    "id": "fundamentos-5",
    "trackId": "fundamentos",
    "prompt": "Estar comprado expressa exposição a qual movimento?",
    "options": [
      "Alta, conforme o instrumento e custos",
      "Qualquer movimento gera lucro",
      "Somente à estabilidade",
      "À queda, sempre"
    ],
    "answer": 0,
    "explanation": "Uma posição comprada simples ganha com alta antes de considerar custos; instrumentos complexos exigem especificação.",
    "critical": false,
    "placement": false
  },
  {
    "id": "fundamentos-6",
    "trackId": "fundamentos",
    "prompt": "Uma aprovação na trilha da JENIOS:",
    "options": [
      "Libera conta real",
      "Certifica lucro",
      "Registra conhecimento nesta avaliação, sem autorizar execução",
      "Substitui licença profissional"
    ],
    "answer": 2,
    "explanation": "A avaliação é pedagógica e não concede autorização de negociação.",
    "critical": true,
    "placement": false
  },
  {
    "id": "fundamentos-7",
    "trackId": "fundamentos",
    "prompt": "O que deve ser identificado antes de avaliar um sinal?",
    "options": [
      "Somente a cor do candle",
      "Instrumento, unidade, moeda e regras",
      "A promessa de um influenciador",
      "A maior alavancagem oferecida"
    ],
    "answer": 1,
    "explanation": "Instrumentos têm especificações; ignorá-las impede compreender risco.",
    "critical": false,
    "placement": false
  },
  {
    "id": "fundamentos-8",
    "trackId": "fundamentos",
    "prompt": "Manter posição para a próxima sessão:",
    "options": [
      "Elimina a volatilidade",
      "Torna o stop infalível",
      "Pode expor a saltos de preço na abertura",
      "Dispensa plano"
    ],
    "answer": 2,
    "explanation": "O preço pode abrir distante do fechamento anterior.",
    "critical": false,
    "placement": false
  },
  {
    "id": "graficos-1",
    "trackId": "graficos",
    "prompt": "Abertura 100 e fechamento 104: qual é o tamanho do corpo do candle?",
    "options": [
      "8",
      "2",
      "4",
      "104"
    ],
    "answer": 2,
    "explanation": "O corpo mede a diferença absoluta entre abertura e fechamento: 4.",
    "critical": false,
    "placement": true
  },
  {
    "id": "graficos-2",
    "trackId": "graficos",
    "prompt": "Máxima 106 e mínima 98: qual é a amplitude?",
    "options": [
      "4",
      "8",
      "106",
      "98"
    ],
    "answer": 1,
    "explanation": "106 − 98 = 8.",
    "critical": false,
    "placement": true
  },
  {
    "id": "graficos-3",
    "trackId": "graficos",
    "prompt": "Um suporte previamente marcado é:",
    "options": [
      "Uma barreira que jamais rompe",
      "Uma garantia de compra",
      "Uma região hipotética de reação",
      "Uma identificação certa de baleia"
    ],
    "answer": 2,
    "explanation": "A região orienta observação, sem garantir a próxima reação.",
    "critical": false,
    "placement": true
  },
  {
    "id": "graficos-4",
    "trackId": "graficos",
    "prompt": "Um candle ainda em formação:",
    "options": [
      "Já tem fechamento definitivo",
      "Pode mudar até o fim do intervalo",
      "Pode ser usado como dado futuro certo",
      "Não possui preço"
    ],
    "answer": 1,
    "explanation": "Só o encerramento torna o fechamento definitivo para aquele intervalo.",
    "critical": false,
    "placement": true
  },
  {
    "id": "graficos-5",
    "trackId": "graficos",
    "prompt": "Ao agregar cinco barras, o fechamento agregado é:",
    "options": [
      "A média das cinco máximas",
      "A primeira abertura",
      "O maior fechamento",
      "O último fechamento"
    ],
    "answer": 3,
    "explanation": "O fechamento é o último valor de fechamento daquele intervalo.",
    "critical": false,
    "placement": false
  },
  {
    "id": "graficos-6",
    "trackId": "graficos",
    "prompt": "Dois horizontes podem mostrar direções diferentes?",
    "options": [
      "Não, isso prova fraude",
      "Sim, representam recortes diferentes",
      "Só se a corretora estiver desligada",
      "Não, os candles devem ser iguais"
    ],
    "answer": 1,
    "explanation": "Diferentes agregações e janelas podem representar movimentos diferentes.",
    "critical": false,
    "placement": false
  },
  {
    "id": "graficos-7",
    "trackId": "graficos",
    "prompt": "Um candle isolado revela a sequência exata entre máxima e mínima?",
    "options": [
      "Sim",
      "Só em candles verdes",
      "Não",
      "Só no diário"
    ],
    "answer": 2,
    "explanation": "OHLC não registra a ordem intrabar dos extremos.",
    "critical": false,
    "placement": false
  },
  {
    "id": "graficos-8",
    "trackId": "graficos",
    "prompt": "Cinco candles verdes bastam para confirmar qualquer tendência?",
    "options": [
      "Não; definição, janela e contexto importam",
      "Sim",
      "Só em cripto",
      "Sim, se forem grandes"
    ],
    "answer": 0,
    "explanation": "É necessário um critério explícito e um horizonte definido.",
    "critical": false,
    "placement": false
  },
  {
    "id": "execucao-1",
    "trackId": "execucao",
    "prompt": "Uma compra limitada a 10 permite execução em 10,50?",
    "options": [
      "Sim, sempre",
      "Não; pode ficar sem execução",
      "Só se for no horário de abertura",
      "Sim, pois limitada garante execução"
    ],
    "answer": 1,
    "explanation": "O limite define preço máximo de compra, sem garantir execução.",
    "critical": false,
    "placement": true
  },
  {
    "id": "execucao-2",
    "trackId": "execucao",
    "prompt": "Após timeout de envio de ordem, a primeira preocupação é:",
    "options": [
      "Reenviar várias vezes",
      "Assumir que não executou",
      "Consultar o estado pelo identificador antes de reenviar",
      "Aumentar o lote"
    ],
    "answer": 2,
    "explanation": "Timeout é estado desconhecido, não prova de falha. Reenvios podem duplicar exposição.",
    "critical": true,
    "placement": true
  },
  {
    "id": "execucao-3",
    "trackId": "execucao",
    "prompt": "Orçamento 60 e risco com custos de 3 por unidade: teto didático?",
    "options": [
      "10",
      "20",
      "30",
      "60"
    ],
    "answer": 1,
    "explanation": "60 ÷ 3 = 20 unidades sob as premissas do exercício.",
    "critical": false,
    "placement": false
  },
  {
    "id": "execucao-4",
    "trackId": "execucao",
    "prompt": "Margem exigida é necessariamente a perda máxima?",
    "options": [
      "Sim",
      "Somente em contratos pequenos",
      "Sim, com stop",
      "Não"
    ],
    "answer": 3,
    "explanation": "Margem, exposição e perda máxima são conceitos diferentes.",
    "critical": true,
    "placement": false
  },
  {
    "id": "execucao-5",
    "trackId": "execucao",
    "prompt": "Como identificar um horário melhor para uma hipótese?",
    "options": [
      "Repetindo uma frase sem verificar",
      "Escolhendo o horário mais agitado",
      "Analisando resultados líquidos, liquidez, eventos e sessões",
      "Usando um fuso fixo para todos os mercados"
    ],
    "answer": 2,
    "explanation": "Regras de negociação e evidência por hipótese devem ser verificadas.",
    "critical": false,
    "placement": false
  },
  {
    "id": "execucao-6",
    "trackId": "execucao",
    "prompt": "Um bom diário separa:",
    "options": [
      "Planejamento, execução e resultado",
      "Apenas lucro e foto",
      "Somente os melhores trades",
      "Só o nome da corretora"
    ],
    "answer": 0,
    "explanation": "Essa separação permite avaliar processo sem confundir sorte e método.",
    "critical": false,
    "placement": false
  },
  {
    "id": "execucao-7",
    "trackId": "execucao",
    "prompt": "Uma stop-limit acrescenta qual risco?",
    "options": [
      "Preço ilimitado em qualquer caso",
      "Não execução se não houver preço aceitável",
      "Perda de todos os dados",
      "Ausência de stop em todos os casos"
    ],
    "answer": 1,
    "explanation": "Controlar o preço com limite pode impedir a execução quando o mercado se afasta.",
    "critical": false,
    "placement": false
  },
  {
    "id": "execucao-8",
    "trackId": "execucao",
    "prompt": "Orçamento 50 e risco de 3 por unidade inteira: qual teto?",
    "options": [
      "17",
      "20",
      "16",
      "50"
    ],
    "answer": 2,
    "explanation": "16 × 3 = 48; 17 × 3 = 51 ultrapassa o orçamento didático.",
    "critical": false,
    "placement": false
  },
  {
    "id": "estrategias-1",
    "trackId": "estrategias",
    "prompt": "Uma regra reproduzível de rompimento precisa:",
    "options": [
      "Ser ajustada depois do resultado",
      "Definir nível, confirmação e momento antes de testar",
      "Usar só um título de vídeo",
      "Garantir 90% de acerto"
    ],
    "answer": 1,
    "explanation": "Critérios anteriores e objetivos permitem reproduzir a hipótese.",
    "critical": false,
    "placement": false
  },
  {
    "id": "estrategias-2",
    "trackId": "estrategias",
    "prompt": "Um falso rompimento identifica o banco que o provocou?",
    "options": [
      "Sim",
      "Só na B3",
      "Não, o padrão não identifica autoria",
      "Só em gráfico diário"
    ],
    "answer": 2,
    "explanation": "Padrão de preço não comprova identidade nem intenção dos participantes.",
    "critical": false,
    "placement": false
  },
  {
    "id": "estrategias-3",
    "trackId": "estrategias",
    "prompt": "Cinco indicadores do mesmo preço são sempre independentes?",
    "options": [
      "Sim",
      "Não; podem repetir a mesma informação",
      "Sim, se tiverem cores diferentes",
      "Só em tendência"
    ],
    "answer": 1,
    "explanation": "Transformações da mesma série podem ser correlacionadas.",
    "critical": false,
    "placement": false
  },
  {
    "id": "estrategias-4",
    "trackId": "estrategias",
    "prompt": "Se a estratégia perde depois de custos, invertê-la:",
    "options": [
      "Garante lucro",
      "Elimina os custos",
      "Garante empate",
      "Não garante lucro; os custos continuam"
    ],
    "answer": 3,
    "explanation": "Comparar alternativas líquidas exige as mesmas premissas e custos.",
    "critical": true,
    "placement": false
  },
  {
    "id": "estrategias-5",
    "trackId": "estrategias",
    "prompt": "Uma condição extrema em um oscilador significa:",
    "options": [
      "Ordem obrigatória",
      "Garantia de reversão",
      "Informação a interpretar no contexto",
      "Sinal sem necessidade de dados"
    ],
    "answer": 2,
    "explanation": "Condição extrema não é uma garantia da direção seguinte.",
    "critical": false,
    "placement": false
  },
  {
    "id": "estrategias-6",
    "trackId": "estrategias",
    "prompt": "Uma regra de retorno à média pode conflitar com:",
    "options": [
      "Uma tendência forte contrária à reversão esperada",
      "Qualquer registro de risco",
      "A existência de custos",
      "Um identificador de ordem"
    ],
    "answer": 0,
    "explanation": "O contexto de tendência pode invalidar o uso de uma hipótese de reversão.",
    "critical": false,
    "placement": false
  },
  {
    "id": "estrategias-7",
    "trackId": "estrategias",
    "prompt": "Se os critérios da hipótese não se alinham, o robô deve:",
    "options": [
      "Sempre comprar",
      "Sempre vender",
      "Inventar confirmação",
      "Poder indicar que não há condição de atuação"
    ],
    "answer": 3,
    "explanation": "Não atuar é uma alternativa prevista, não uma falha de inteligência.",
    "critical": false,
    "placement": false
  },
  {
    "id": "estrategias-8",
    "trackId": "estrategias",
    "prompt": "Uma regra bem calculada está validada financeiramente?",
    "options": [
      "Sim",
      "Não; correção matemática não demonstra rentabilidade",
      "Só se utilizar IA",
      "Sim, quando o nome é híbrido"
    ],
    "answer": 1,
    "explanation": "Ainda é preciso testar comportamento e resultados sob premissas realistas.",
    "critical": false,
    "placement": false
  },
  {
    "id": "laboratorio-1",
    "trackId": "laboratorio",
    "prompt": "40% × 3R − 60% × 1R − custo 0,7R resulta em:",
    "options": [
      "+0,6R",
      "+1,2R",
      "−0,1R",
      "+3R"
    ],
    "answer": 2,
    "explanation": "1,2R − 0,6R − 0,7R = −0,1R.",
    "critical": false,
    "placement": true
  },
  {
    "id": "laboratorio-2",
    "trackId": "laboratorio",
    "prompt": "Escolher e validar o melhor parâmetro na mesma amostra:",
    "options": [
      "É validação independente",
      "Elimina o sobreajuste",
      "Pode introduzir viés de seleção",
      "Garante resultado futuro"
    ],
    "answer": 2,
    "explanation": "Usar o mesmo conjunto para seleção e validação não é confirmação independente.",
    "critical": false,
    "placement": true
  },
  {
    "id": "laboratorio-3",
    "trackId": "laboratorio",
    "prompt": "Perder 20% e ganhar depois 20% do saldo restante:",
    "options": [
      "Volta ao início",
      "Deixa o saldo em 96% do inicial",
      "Deixa o saldo em 100%",
      "Gera 4% de lucro"
    ],
    "answer": 1,
    "explanation": "100 × 0,8 × 1,2 = 96.",
    "critical": false,
    "placement": false
  },
  {
    "id": "laboratorio-4",
    "trackId": "laboratorio",
    "prompt": "Stop e alvo tocados na mesma barra sem sequência conhecida:",
    "options": [
      "Assumir sempre o alvo",
      "Usar o melhor resultado",
      "Ignorar todos os custos",
      "Registrar ambiguidade ou usar convenção conservadora"
    ],
    "answer": 3,
    "explanation": "A informação OHLC não resolve a ordem intrabar dos eventos.",
    "critical": false,
    "placement": false
  },
  {
    "id": "laboratorio-5",
    "trackId": "laboratorio",
    "prompt": "Se a fonte de preços falha, a IA pode inventar um preço atual?",
    "options": [
      "Não; precisa explicitar a indisponibilidade",
      "Sim, se parecer plausível",
      "Sim, usando a média de ontem",
      "Só com uma mensagem otimista"
    ],
    "answer": 0,
    "explanation": "Nunca deve confundir dado inexistente com leitura real.",
    "critical": true,
    "placement": false
  },
  {
    "id": "laboratorio-6",
    "trackId": "laboratorio",
    "prompt": "Um ótimo backtest fora da amostra:",
    "options": [
      "Garante o próximo mês",
      "Substitui todos os riscos",
      "É evidência limitada, não garantia de resultado futuro",
      "Libera qualquer cliente"
    ],
    "answer": 2,
    "explanation": "Mudanças de regime, execução e amostra ainda importam.",
    "critical": false,
    "placement": false
  },
  {
    "id": "laboratorio-7",
    "trackId": "laboratorio",
    "prompt": "Uma conversa da IA pode conceder autorização para operar?",
    "options": [
      "Sim, se o estudante pedir",
      "Só se for no modo Hard",
      "Não; autorização pertence ao sistema de segurança",
      "Sim, após 15 perguntas"
    ],
    "answer": 2,
    "explanation": "Não se promove permissão por texto de modelo ou pontuação pedagógica.",
    "critical": true,
    "placement": false
  },
  {
    "id": "laboratorio-8",
    "trackId": "laboratorio",
    "prompt": "70% × 1R − 30% × 3R − custo 0,1R resulta em:",
    "options": [
      "+0,6R",
      "−0,3R",
      "+0,1R",
      "−1R"
    ],
    "answer": 1,
    "explanation": "0,7R − 0,9R − 0,1R = −0,3R.",
    "critical": false,
    "placement": false
  }
];