/** B277 — 13 original guided studies. Source notes were labeled caption-reviewed in
 * PREVIOUS checkpoints (B262/B270); B277 did not download or rewatch those videos.
 * These texts are not transcripts, copied courses, verified return claims or trading advice.
 */
import {USER_VIDEO_RESOURCES} from './trade-video-resources.mjs';
const freeze=x=>Object.freeze(x);
export const B277_INDEPENDENT_EDUCATIONAL_LINKS=freeze([
 freeze({id:'cme-analysis',title:'CME Group · Análise técnica',url:'https://www.cmegroup.com/education/courses/technical-analysis'}),
 freeze({id:'cme-averages',title:'CME Group · Médias móveis',url:'https://www.cmegroup.com/education/courses/technical-analysis/understanding-moving-averages'}),
 freeze({id:'cme-oscillators',title:'CME Group · RSI, MACD e estocástico',url:'https://www.cmegroup.com/education/courses/technical-analysis/oscillators-macd-rsi-stochastics'}),
 freeze({id:'cme-levels',title:'CME Group · Suporte e resistência',url:'https://www.cmegroup.com/education/courses/technical-analysis/support-and-resistance'}),
 freeze({id:'sec-stops',title:'Investor.gov · Stop, stop-limit e trailing stop',url:'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15'}),
 freeze({id:'sec-orders',title:'Investor.gov · Tipos de ordens',url:'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-14'}),
 freeze({id:'cfa-backtest',title:'CFA Institute · Backtesting & Simulation (2026)',url:'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/backtesting-and-simulation'}),
 freeze({id:'cfa-model',title:'CFA Institute · Model Misspecification (2026)',url:'https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/model-misspecification'})
]);
const define=(videoId,trackId,title,observation,explanation,steps,example,check,limitation,features,linkIds)=>freeze({
 id:'b277-'+videoId,videoId,trackId,title,
 evidence:'PREVIOUS_CHECKPOINT_CAPTION_NOTES_NOT_RECHECKED_B277',
 observation,explanation,
 steps:freeze(steps),example,check,limitation,
 researchFields:freeze(features),externalLinkIds:freeze(linkIds),
 profitabilityVerified:false,authorEndorsementVerified:false,
 videoScreenReviewed:false,robotChangesPermitted:false
});
export const B277_GUIDED_STUDIES=freeze([
 define('CIm6HlYLzLU','fundamentos','Taxa de acerto versus expectativa matemática',
  'O registro anterior resume expectativas, assimetria ganho/perda e paciência; desempenho de terceiros não foi auditado.',
  'O acerto só tem significado quando comparado à perda média, ao ganho médio e aos custos. Uma estratégia de muitos acertos ainda pode ter resultado líquido negativo.',
  ['Anote a proporção de acertos como variável, não como promessa.','Calcule ganhos e perdas em uma unidade de risco R, sempre líquidas de custos.','Avalie a perda máxima e se um resultado muito ruim pode anular vários pequenos ganhos.'],
  'Em dez operações fictícias, oito ganhos de 1R e duas perdas de 5R somam −2R antes de custos. A taxa de acerto de 80% não impede prejuízo.',
  'Qual medida adicional impede confundir taxa de acerto com rentabilidade?', 'Rentabilidades mencionadas em entrevistas são relatos, não resultados auditados da JENIOS.',
  ['win_rate','average_win_r','average_loss_r','round_trip_costs','max_drawdown_r'],['cfa-backtest']),
 define('mz2O6K6JF4k','graficos','Use RSI, MACD e médias sem contar a mesma informação duas vezes',
  'O registro anterior distingue indicadores de direção, força, volatilidade e referências.',
  'RSI, estocástico e MACD podem reagir a variações de preço relacionadas. Vários indicadores aparentemente concordando não são necessariamente evidências independentes.',
  ['Agrupe indicadores por pergunta: direção, momentum, volatilidade e volume.','Calcule os indicadores com preços já fechados e parâmetros previamente definidos.','Teste a contribuição de cada filtro contra um modelo-base, inclusive em períodos laterais.'],
  'Uma média ascendente e RSI elevado podem coexistir por várias barras. Isso não é, por si só, confirmação para vender ou comprar.',
  'Por que RSI e estocástico concordarem não equivale automaticamente a duas provas?', 'Parâmetros publicados são exemplos de estudo, não desempenho ou sinais em tempo real.',
  ['rsi14','macd12_26_9','ema12','ema26','atr14'],['cme-oscillators','cme-averages']),
 define('jXcIfXxdsN4','graficos','Corpo e sombras: descreva, não adivinhe',
  'O registro anterior trata de amplitude, sombras, corpo, fechamento relativo e contexto.',
  'O mesmo formato de candle pode aparecer em lateralização, tendência ou evento adverso. A geometria é um fato; inferir intenção de compradores ou probabilidade de reversão requer evidência independente.',
  ['Use abertura, máxima, mínima e fechamento de um candle inteiramente fechado.','Calcule corpo/amplitude e sombras/amplitude, evitando divisão por zero.','Registre a posição do candle na faixa anterior antes de discutir hipóteses.'],
  'Abertura 100, máxima 106, mínima 98, fechamento 104: amplitude 8, corpo 4, corpo relativo 50%. Nada disso garante continuidade.',
  'Que informação contextual falta para declarar uma reversão?', 'O vídeo não fornece taxas de acerto auditadas para cada geometria.',
  ['body_fraction','upper_wick_fraction','lower_wick_fraction','prior_range20'],['cme-analysis']),
 define('Y5gk-wBkdRM','graficos','Wyckoff como hipótese de regime, não leitura do futuro',
  'A síntese anterior descreve acumulação, avanço, distribuição e queda como modelos interpretativos.',
  'Classificar uma região apenas depois de saber que o preço subiu cria um rótulo retrospectivo. Uma hipótese de regime precisa de definição observável antes do movimento futuro.',
  ['Registre faixas e volumes apenas até a barra de análise.','Defina quantitativamente o que seria lateralização e alteração de regime.','Teste a estabilidade dessa classificação em períodos que não foram usados para construí-la.'],
  'Em um estudo inventado, preço oscila por 20 candles; somente com dados futuros seria possível chamar aquela faixa de acumulação vencedora.',
  'Por que atribuir o nome acumulação depois de uma alta causa viés?', 'Nenhuma previsão causal ou desempenho quantitativo de Wyckoff foi validado.',
  ['range_width20','relative_volume20','closed_candle_regime','forward_leakage_checks'],['cme-levels','cfa-backtest']),
 define('_k2XN41-_f8','execucao','Disciplina: não aumente risco para recuperar perdas',
  'O registro anterior discute Mark Douglas, revanche e desvios comportamentais no plano.',
  'Comportamento disciplinado reduz algumas falhas, mas não transforma uma estratégia sem vantagem em um sistema lucrativo.',
  ['Estabeleça risco máximo por tentativa e sessão antes de estudar entradas.','Registre qualquer quebra de limite ou alteração emocional de quantidade.','Em simulação, marque pausa e reconciliação antes de qualquer nova exposição após erro.'],
  'Após duas perdas fictícias, dobrar a posição para recuperar tudo aumenta o risco agregado, embora o próximo resultado continue incerto.',
  'Disciplina é suficiente para provar que uma estratégia tem vantagem?', 'Não usar esse estudo para diagnóstico psicológico pessoal ou liberação de operações.',
  ['planned_risk','risk_escalation','cooldown_observed','pause_reason'],['cfa-backtest']),
 define('T26RN9f9AMI','execucao','Stop, execução parcial e reconciliação com a corretora',
  'O registro anterior aborda stop técnico, estrutura, disciplina e múltiplos tempos.',
  'Um stop é uma condição prevista, mas a execução depende da corretora e da liquidez. Timeout e confirmação parcial não autorizam envio duplicado.',
  ['Distinga ordem local, aceite e quantidade executada no livro de estados.','Trate timeout como estado desconhecido, nunca como rejeição automática.','Reserve o risco e reconcilie eventos idempotentes antes de reabrir novas tentativas.'],
  'Ordem de 1 unidade teve somente 0,4 executada; 0,6 não é necessariamente cancelado. Reenviar 1 unidade pode exceder o limite.',
  'Qual é a diferença entre stop acionado e saída realmente executada?', 'Uma instrução educacional não substitui documentação ou teste de API da corretora.',
  ['client_order_id','broker_order_status','cumulative_filled_quantity','slippage_bps'],['sec-stops','sec-orders']),
 define('IH5TuzAvFgk','estrategias','RSI(2) e SMA200: estudo de reversão à média com stop ausente',
  'O registro anterior descreve filtro SMA200, RSI de dois períodos e média de cinco; a versão relatada não fixa stop de preço.',
  'Um filtro de tendência não protege contra perda ilimitada. Transformá-lo em uma variante com stop altera a hipótese, exigindo estudo novo e independente.',
  ['Descreva SMA200 e RSI2 com candles diários fechados, sem gerar ordens.','Anote que o stop da proposta original não está definido.','Compare apenas uma variante de pesquisa com risco predefinido e custos completos no holdout.'],
  'Preço acima da SMA200 e RSI2 abaixo de 5 são condições observáveis, não autorização de compra. A ausência de stop impede execução automatizada.',
  'Adicionar um stop arbitrário prova que o método narrado é rentável?', 'MÉTODO ORIGINAL NÃO ELEGÍVEL PARA ORDENS: preço de stop ausente e resultados não auditados.',
  ['sma200','rsi2','sma5','stop_pct_required','oos_protocol'],['cme-averages','cme-oscillators','cfa-backtest']),
 define('MFnC-tsp90Q','estrategias','Faixa lateral: definição objetiva de suporte e resistência',
  'O registro anterior relata critérios de toques anteriores e espera por confirmação sem antecipar rompimento.',
  'Uma faixa exige critérios congelados de largura, tolerância e duração; traçar linhas depois de saber o final da história cria um bom desenho e um teste inválido.',
  ['Defina uma janela fixa de candles anteriores e tolerância por volatilidade.','Registre os toques e os níveis somente com informação disponível no momento.','Defina invalidação antes de avaliar o candle seguinte e custos.'],
  'Suporte 100 e resistência 110 em cenário fictício: um toque próximo de 110 não garante que o próximo recuo repetirá os anteriores.',
  'Que regra impede ajustar o limite da faixa depois de observar a ruptura?', 'Nenhuma porcentagem de acerto ou quantidade ideal de toques foi auditada.',
  ['range_lookback','atr_tolerance','touch_count','candle_close_confirmation'],['cme-levels']),
 define('uP8C5nasdUA','estrategias','Rompimento: confirmação, invalidação e execução no próximo candle',
  'O registro anterior menciona rompimento por price action, plano e espera por setup.',
  'Se o protocolo exige fechamento acima da máxima anterior, o sinal não estava disponível antes desse fechamento. Entrada na mesma barra ao preço favorável gera viés.',
  ['Congele a máxima/mínima das barras anteriores, excluindo a barra da hipótese.','Exija confirmação pelo fechamento e calcule possível entrada apenas na barra seguinte.','Registre falso rompimento, stop, fricção e ausência de execução.'],
  'Máxima anterior 110 e fechamento 111: o rompimento só é conhecido quando a barra fecha. A próxima abertura pode estar em 113.',
  'Por que comprar retroativamente em 110 depois do fechamento em 111 produz viés?', 'Relatos pessoais de sucesso e taxas históricas divulgadas não são comprovação de vantagem.',
  ['prior_high20','prior_low20','signal_close_ms','next_bar_open','gap_slippage'],['cme-levels','cfa-backtest']),
 define('HSrdYcETBmE','estrategias','Retrações: níveis são referências, não probabilidades',
  'O registro anterior observa referências de Fibonacci de 38,2%, 50% e 61,8% condicionadas a contexto e confirmação posterior.',
  'Em uma tendência, uma porcentagem de recuo descreve distância entre níveis. Não fornece, isoladamente, um gatilho completo ou uma chance validada de reversão.',
  ['Fixe extremos anteriores sem procurar os que melhor se encaixam depois.','Calcule as referências percentuais de forma reproduzível.','Exija invalidação, custos e novo teste antes de nomear um método completo.'],
  'Movimento fictício de 100 para 200: uma retração de 50% corresponde a 150, mas não implica que o preço retornará a 200.',
  'Selecionar extremos apenas depois da recuperação do preço mantém a análise causal?', 'Os intervalos citados em legenda não constituem metodologia completa de trade.',
  ['swing_high','swing_low','retracement_pct','closed_confirmation'],['cme-analysis']),
 define('4GONM3_jMNw','estrategias','Padrões gráficos: percentuais anunciados não são chances auditadas',
  'O registro anterior comenta engolfos e padrões de estrela; percentuais de reversão divulgados não foram validados.',
  'O padrão exige definição matemática de tamanho, cor e relação entre candles, seguida de métrica de desfecho. Selecionar apenas os exemplos vencedores distorce a taxa observada.',
  ['Defina geometria com OHLC dos candles fechados, incluindo casos de falha.','Congele horizonte de avaliação e condições de não operar.','Relate tamanho da amostra, seleção de ativos, custos e intervalos de confiança.'],
  'Dois candles hipotéticos podem formar engolfo, mas um terceiro continuar a tendência original; o rótulo não permite deduzir taxa universal.',
  'Por que uma taxa anunciada sem amostra, horizonte e custos não serve para o robô?', 'Percentuais atribuídos a padrões em vídeos são expressamente NÃO AUDITADOS.',
  ['engulfing_definition','sample_count','forward_horizon','confidence_interval','fees'],['cfa-backtest']),
 define('gbo9Q2IsGHQ','laboratorio','Impulso e consolidação: separe contexto de vantagem estatística',
  'O registro anterior trata de força do movimento e contexto de continuação depois de consolidação.',
  'Uma hipótese de continuação pode falhar em mercados laterais ou com custos elevados. Antes de comparar filtros, registre regimes, parâmetros e todos os resultados, não só os melhores.',
  ['Classifique movimento anterior e compressão usando janela congelada.','Compare observações com e sem o filtro sobre o mesmo conjunto de dados.','Descreva casos adversos e se a vantagem sobrevive em ativos e períodos inéditos.'],
  'Uma ruptura fictícia parece forte em baixa fricção, mas o spread de mercado pode consumir a diferença esperada.',
  'Como provar contribuição incremental da informação de volume sem duplicar momentum?', 'Entrevista e exemplos históricos não certificam vantagem estatística da JENIOS.',
  ['range_compression','relative_volume','market_regime','holdout_net_expectancy'],['cfa-backtest','cfa-model']),
 define('klYqVdHcTws','laboratorio','Notícias e experiências de traders: evite saber o futuro',
  'O registro anterior relata notícias, leitura de fluxo e trajetória biográfica, sem auditar números de desempenho.',
  'Em estudos baseados em eventos, a data de publicação pública e a latência real importam. Um dado revisado depois do fato não podia orientar uma decisão anterior.',
  ['Registre timestamp da notícia e momento em que ficaria disponível ao usuário.','Compare com fechamento de candles e atrasos antes de simular qualquer reação.','Exclua informações posteriores e reporte desempenho negativo, risco e múltiplas tentativas.'],
  'Uma notícia com timestamp às 14h não poderia fundamentar uma entrada fictícia às 13h; fazê-lo seria vazamento de informação futura.',
  'Quais dados são necessários para demonstrar que a informação estava disponível antes da decisão?', 'Narrativas biográficas, rentabilidades e histórias de sucesso não são evidências de robustez.',
  ['news_published_at','received_at','closed_candle_at','reaction_latency','event_study_oos'],['cfa-backtest','cfa-model'])
]);
const source=new Map(USER_VIDEO_RESOURCES.map(r=>[r.id,r]));
const expected=Object.freeze(B277_GUIDED_STUDIES.map(x=>x.videoId));
if(new Set(expected).size!==13||B277_GUIDED_STUDIES.length!==13||
 !B277_GUIDED_STUDIES.every(x=>source.get(x.videoId)?.verification==='transcript_reviewed'))
 throw Error('B277_CASE_SOURCE_PROVENANCE_MISMATCH');
export function b277StudiesForTrack(trackId){return B277_GUIDED_STUDIES.filter(x=>x.trackId===trackId);}
export function b277ExternalLinksForCase(caseStudy){
 if(!caseStudy||!Array.isArray(caseStudy.externalLinkIds))return [];
 return B277_INDEPENDENT_EDUCATIONAL_LINKS.filter(x=>caseStudy.externalLinkIds.includes(x.id));
}
