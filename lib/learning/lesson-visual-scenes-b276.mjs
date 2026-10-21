/** B276-R2 — ilustrações originais, sem dependência externa ou dados de corretora.
 * Cada cena é educativa e fictícia. Separada do catálogo para preservar 15 aulas e histórico.
 */
const item=(kind,title,alt,caption,detail={})=>Object.freeze({kind,title,alt,caption,...detail});
export const LESSON_VISUAL_SCENES=Object.freeze({
 mercado:item('flow','Como as partes se relacionam','Fluxo didático ilustrando o ativo, a corretora intermediária e o mercado, sem qualquer ordem real.','O ativo é o que se negocia; o gráfico é uma representação e a corretora é um intermediário.',{labels:['Ativo','Corretora','Mercado']}),
 'day-swing':item('timeline','O horizonte muda o risco','Uma posição intradiária termina no mesmo dia; a posição swing atravessa sessões.','O período exibido pelo gráfico não determina por quanto tempo você mantém uma posição.',{labels:['Abertura','Mesmo dia','Sessão seguinte'],intervals:[1,0,1]}),
 risco:item('risk','Stop planejado não é saída garantida','Exemplo fictício de entrada em 50, stop em 48 e execução pior em 45 após gap.','Entrada 50 e stop em 48 representam perda nominal de 2 por unidade. Se a execução ocorrer em 45, a perda será 5.',{levels:[{value:50,label:'Entrada 50'},{value:48,label:'Stop 48'},{value:45,label:'Gap 45'}]}),
 candles:item('candles','O que há dentro de um candle','Quatro candles fictícios com abertura, fechamento, máxima, mínima, corpo e sombras.','Corpo, máxima, mínima e sombras descrevem preços observados; não informam a próxima direção.',{values:[[55,78,34,72],[70,82,44,48],[47,69,27,62],[60,76,38,42]]}),
 tempo:item('timeline','Agrupar barras esconde detalhes','Uma sequência de minutos agregada em intervalos mais longos perde alguns movimentos internos.','Gráficos de 1 e 5 minutos podem representar a mesma história com níveis diferentes de detalhe.',{labels:['1 minuto','5 minutos','15 minutos'],intervals:[1,5,15]}),
 contexto:item('trend','Tendência ou faixa de preços?','Preços fictícios oscilam entre duas referências horizontais de suporte e resistência.','Suporte e resistência são regiões de estudo, não garantias nem previsões.',{variant:'range',points:[[45,153],[108,127],[164,161],[225,112],[288,147],[356,114],[410,155],[484,121],[560,140]]}),
 ordens:item('flow','A intenção não é a execução','Fluxo simplificado entre intenção de ordem, recebimento, execução parcial e conferência.','Uma ordem recebida pode não estar totalmente executada. Estados desconhecidos exigem reconciliação.',{labels:['Intenção','Recebida','Parcial','Conferida']}),
 tamanho:item('costs','Custos reduzem o resultado','Barras ilustrativas mostram ganho bruto fictício, taxas, spread e resultado líquido menor.','Exemplo fictício: ganho bruto 1,50, custos de 0,70 e resultado líquido 0,80 por unidade.',{values:[1.5,.4,.3,.8],labels:['Ganho bruto','Taxas','Spread','Líquido']}),
 plano:item('flow','Planeje antes de avaliar','Sequência ilustrativa: hipótese, risco, invalidação e diário de resultados.','Planejamento e registro ajudam a evitar mudanças improvisadas depois de conhecer o resultado.',{labels:['Hipótese','Risco','Invalidação','Diário']}),
 rompimentos:item('trend','Rompimento precisa de confirmação','Preços fictícios saem de uma faixa horizontal e depois retornam; a falha só pode ser reconhecida depois.','Não use o retorno futuro como se fosse conhecido na entrada. O fechamento é a referência definida pelo protocolo.',{variant:'breakout',points:[[45,138],[101,166],[145,131],[202,159],[262,124],[322,150],[385,106],[430,78],[468,91],[503,141],[559,157]]}),
 correcoes:item('trend','Correção e continuação são hipóteses','Linha fictícia sobe, recua e pode retomar ou invalidar a tendência; o desfecho não é conhecido de antemão.','Um recuo não prova reversão nem continuação: é necessário definir o contexto e a condição de invalidação.',{variant:'pullback',points:[[45,182],[105,150],[164,155],[225,113],[282,141],[342,91],[405,128],[465,103],[556,70]]}),
 indicadores:item('indicators','Direção, impulso e volatilidade','Três linhas ilustrativas e independentes para direção por médias, momentum por RSI e amplitude por ATR.','Indicadores respondem a perguntas diferentes e podem ser redundantes. Nenhum é voto ou ordem isolada.',{labels:['Médias','RSI','ATR']}),
 estatistica:item('expectancy','Mais acertos nem sempre significam lucro','Dois cenários aritméticos fictícios com taxas de acerto diferentes e expectativa distinta.','Em 10 operações ilustrativas: 8 ganhos de 1R e 2 perdas de 5R totalizam −2R; 4 ganhos de 3R e 6 perdas de 1R totalizam +6R.',{labels:['80% de acertos','40% de acertos'],values:[-2,6]}),
 backtest:item('timeline','Nunca estude usando o futuro','Períodos separados em treino, embargo, teste fora da amostra e observação prospectiva.','A hipótese precisa ser congelada antes da janela de teste. Um ajuste posterior contamina o holdout.',{labels:['Treino','Embargo','Teste OOS','Futuro'],intervals:[4,1,3,3]}),
 automacao:item('flow','Falha exige pausa e reconciliação','Fluxo educativo do robô: verificar limites, receber estado, pausar se desconhecido e reconciliar.','O software não deve tratar timeout como ordem rejeitada e enviá-la novamente às cegas.',{labels:['Limites','Estado','Pausa','Conferir']})
});
export const WORKSHOP_TO_LESSON_SCENE=Object.freeze({
 'b271-costs':'estatistica',
 'b271-stop-gap':'risco',
 'b271-candle':'candles',
 'b271-indicators':'indicadores',
 'b271-orders':'ordens',
 'b271-full-cost':'tamanho',
 'b271-breakout':'rompimentos',
 'b271-connors':'correcoes',
 'b271-holdout':'backtest',
 'b271-modes':'automacao'
});
export function visualForLesson(lessonId){return LESSON_VISUAL_SCENES[lessonId]||null;}
export function visualForWorkshop(workshopId){const lesson=WORKSHOP_TO_LESSON_SCENE[workshopId];return lesson?visualForLesson(lesson):null;}
