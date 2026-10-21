/** B271. Oficinas educativas originais. Sem prova, cadastro extra ou alteração do histórico.
 * Referências previamente catalogadas são contexto, não endosso nem prova de retorno.
 */
export const PRACTICAL_STUDY_WORKSHOPS=Object.freeze([
{
 id:'b271-costs',trackId:'fundamentos',title:'Acertar o preço não é o mesmo que lucrar',
 explanation:'O resultado de uma negociação depende da diferença entre preço de saída e entrada, das taxas, do spread e do possível deslizamento de execução. O percentual de acertos sozinho não mede se a estratégia tem vantagem.',
 steps:['Identifique o preço realmente executado, não só o visto na tela.','Some custos de entrada e saída e calcule o resultado líquido.','Compare a média das perdas com a média dos ganhos.'],
 example:'Exemplo inventado: entrada a 100, saída a 101 e custos totais de 1,20 por unidade produzem resultado líquido de -0,20, apesar da alta de preço.',
 practice:'Altere apenas os custos do exemplo para 0,30. Quanto muda o resultado líquido?',
 selfCheck:'O resultado passa a +0,70 por unidade. Esse cálculo não estima rentabilidade futura.',
 caution:'Custos, impostos e características do instrumento variam; nenhum valor aqui é cotação real.',relatedVideoIds:['CIm6HlYLzLU']
},
{
 id:'b271-stop-gap',trackId:'fundamentos',title:'Diferencie perda planejada de perda garantida',
 explanation:'Distância até o stop e tamanho da posição ajudam a estimar risco nominal. Uma ordem stop pode executar a preço pior; alavancagem, falta de liquidez e saltos entre sessões ampliam perdas.',
 steps:['Defina primeiro o risco que seria tolerável em um cenário adverso.','Estime a perda nominal pela distância entre entrada e stop multiplicada pela quantidade.','Acrescente um cenário de gap e considere que a execução pode falhar.'],
 example:'Exemplo inventado: 10 unidades compradas a 50, com stop planejado a 48, representam 20 de perda nominal antes de taxas. Se a saída acontecer a 45, a perda seria 50.',
 practice:'Qual é a diferença entre o risco calculado com o stop e a perda possível no gap?',
 selfCheck:'Stop é plano e gatilho; não garante execução a um preço específico.',
 caution:'Não dimensione operação real a partir de exemplos didáticos.',relatedVideoIds:[]
},
{
 id:'b271-candle',trackId:'graficos',title:'Leia o candle pela geometria antes do nome',
 explanation:'A amplitude é a máxima menos a mínima; o corpo é a distância entre abertura e fechamento. Sombras e posição do fechamento ajudam a descrever o candle, mas não provam quem negociou nem a próxima direção.',
 steps:['Registre abertura, máxima, mínima e fechamento de uma barra concluída.','Divida o tamanho do corpo e das sombras pela amplitude total.','Verifique se a barra ocorre em tendência, faixa ou evento de volatilidade.'],
 example:'Exemplo inventado: abertura 99, máxima 103, mínima 97 e fechamento 102. Corpo 3/6=50%; sombra superior 1/6 e inferior 2/6.',
 practice:'Se outra barra tiver o mesmo corpo relativo, mas surgir em um regime lateral, a interpretação necessariamente será igual?',
 selfCheck:'Não. A posição no gráfico e o contexto são essenciais; nenhum candle isolado fornece probabilidade auditada.',
 caution:'Descrição geométrica não é sinal de compra ou venda.',relatedVideoIds:['jXcIfXxdsN4']
},
{
 id:'b271-indicators',trackId:'graficos',title:'RSI, médias e ATR respondem a perguntas diferentes',
 explanation:'Médias sintetizam direção passada; RSI e estocástico resumem variações recentes; ATR mede amplitude típica. Usar indicadores correlacionados pode repetir a mesma informação e aparentar uma confirmação inexistente.',
 steps:['Separe indicadores por direção, momentum e volatilidade.','Calcule somente com candles fechados e com janelas explicitadas.','Compare cada filtro a um modelo-base fora da amostra, sem ajuste posterior.'],
 example:'Exemplo inventado: uma EMA curta acima da longa indica contexto histórico de alta, mas RSI alto pode persistir por várias barras. O ATR não determina direção.',
 practice:'Por que RSI sobrecomprado não é automaticamente uma ordem de venda?',
 selfCheck:'Porque momentum alto pode ocorrer em tendências persistentes, e a regra precisa de contexto, invalidação e validação.',
 caution:'Parâmetros citados são exemplos de pesquisa, não setups aprovados.',relatedVideoIds:['mz2O6K6JF4k']
},
{
 id:'b271-orders',trackId:'execucao',title:'Ordem enviada, aceita e executada são estados diferentes',
 explanation:'Um envio pode ser rejeitado, permanecer pendente, executar parcialmente ou ter resultado desconhecido após um timeout. Repetir envio automaticamente pode duplicar exposição. O registro da corretora deve ser reconciliado antes de novas ações.',
 steps:['Distinga intenção local, aceite da corretora e quantidade efetivamente executada.','Em caso de timeout, não suponha falha ou sucesso.','Bloqueie novas entradas até confirmar o estado e as reservas de risco.'],
 example:'Exemplo inventado: uma ordem de 1 unidade executou 0,4. O saldo de 0,6 não está concluído nem necessariamente cancelado.',
 practice:'Após timeout sem confirmação, reenviar a mesma intenção é seguro?',
 selfCheck:'Não; a primeira ordem pode ter sido recebida. A decisão correta depende de consulta e reconciliação do estado.',
 caution:'Pausa local não cancela posições nem substitui proteção na corretora.',relatedVideoIds:['_k2XN41-_f8']
},
{
 id:'b271-full-cost',trackId:'execucao',title:'Inclua fricção no plano de negociação',
 explanation:'Uma simulação de preço médio ignora impactos operacionais. O estudo sério registra taxas, spread, deslizamento, financiamento, latência, execuções parciais e indisponibilidade da corretora conforme o produto.',
 steps:['Estabeleça custos conservadores antes do backtest.','Reavalie o mesmo conjunto com cenários crescentes de custo.','Registre operações não executadas e piores casos de liquidez.'],
 example:'Exemplo inventado: retorno bruto de +0,15% desaparece diante de custo total de 0,30%, gerando -0,15%, antes de outras diferenças de execução.',
 practice:'Por que um ótimo resultado com custo zero não basta?',
 selfCheck:'Porque a vantagem pode desaparecer quando os custos reais e a execução imperfeita são considerados.',
 caution:'Cenários de custo são hipóteses, não uma promessa de preço executável.',relatedVideoIds:[]
},
{
 id:'b271-breakout',trackId:'estrategias',title:'Rompimento observado versus falso rompimento',
 explanation:'Uma ruptura só está confirmada no fechamento definido pelo protocolo. Chamá-la de falsa exige um critério posterior de retorno à faixa; usar essa informação para decidir antes do fechamento gera viés de futuro.',
 steps:['Defina a faixa com barras anteriores ao sinal.','Exija fechamento para classificar a ruptura.','Defina invalidação, risco máximo e horizonte antes de observar o desfecho.'],
 example:'Exemplo inventado: máxima prévia em 110, candle fecha em 111. A ruptura é observável nesse fechamento; retorno abaixo de 110 no próximo candle só pode ser classificado quando ocorrer.',
 practice:'Pode chamar a ruptura de falsa já na abertura da próxima barra?',
 selfCheck:'Não, se a regra de falha exige confirmação pelo fechamento seguinte.',
 caution:'Não são probabilidades de acerto nem método operacional liberado.',relatedVideoIds:['MFnC-tsp90Q','uP8C5nasdUA']
},
{
 id:'b271-connors',trackId:'estrategias',title:'Reversão à média: hipótese não é sistema pronto',
 explanation:'O exemplo educacional de RSI(2) e SMA(200)/SMA(5), descrito em material anteriormente revisado, ilustra como filtrar tendência e sobrevenda. A versão narrada não estabelece stop fixo de preço, logo não serve para execução automática.',
 steps:['Escreva condições de tendência, entrada e saída usando somente dados fechados.','Defina uma variante com risco previamente limitado e compare com a regra-base.','Rejeite configurações com perda não controlada, mesmo com taxa elevada de acerto.'],
 example:'Exemplo inventado: o fechamento fica acima da SMA200 e o RSI2 cai abaixo de 5. Isso é uma condição histórica observada, não autorização de compra.',
 practice:'Acrescentar stop arbitrário prova que a variante é lucrativa?',
 selfCheck:'Não. Muda a hipótese e exige novo teste independente com custos e amostra futura.',
 caution:'Método sem stop previamente definido é inelegível para conexão operacional JENIOS.',relatedVideoIds:['IH5TuzAvFgk']
},
{
 id:'b271-holdout',trackId:'laboratorio',title:'Congele o método antes de abrir a amostra de teste',
 explanation:'Treino serve para formular hipóteses; holdout fora da amostra serve para testá-las sem reotimizar. Uma janela de embargo evita vazamento temporal. Depois, a avaliação prospectiva exige observações futuras registradas sem olhar o resultado antes da decisão.',
 steps:['Documente indicadores, parâmetros, custos, ativos, timeframes e risco.','Separe treino, embargo, holdout e período prospectivo.','Congele as regras e registre também falhas, amostra insuficiente e tentativas descartadas.'],
 example:'Exemplo de calendário fictício: treino até 10/09, embargo de ao menos um dia, holdout posterior e registro prospectivo somente depois da análise congelada.',
 practice:'Modificar RSI após ver a rentabilidade do holdout permite continuar chamando o mesmo holdout de independente?',
 selfCheck:'Não. O holdout foi contaminado e seria necessário novo período verdadeiramente não observado.',
 caution:'Resultados sintéticos nunca comprovam desempenho com capital de usuários.',relatedVideoIds:['CIm6HlYLzLU']
},
{
 id:'b271-modes',trackId:'laboratorio',title:'Compare modos direto, reverso e híbrido sem favorecer nenhum',
 explanation:'Os três modos devem enfrentar os mesmos dados, horários, custos, critérios de execução e orçamento de risco. Vencer em uma janela escolhida após a análise não demonstra vantagem; resultados devem ser repetíveis por regime e ativo.',
 steps:['Registre previamente a hipótese e o critério de cada modo.','Avalie os modos nos mesmos candles e nos mesmos cenários de custo.','Analise tamanho da amostra, perda extrema, drawdown e estabilidade em novos períodos.'],
 example:'Exemplo inventado: o modo reverso tem mais acertos, mas poucas perdas muito grandes; a expectativa líquida pode continuar negativa.',
 practice:'Qual modo deve ser publicado se nenhum apresenta vantagem robusta sob custos?',
 selfCheck:'Nenhum. Preserve os núcleos atuais e mantenha a hipótese no laboratório.',
 caution:'Nenhuma destas oficinas muda sinais, parâmetros ou autoriza ordens.',relatedVideoIds:['klYqVdHcTws']
}
].map(x=>Object.freeze({...x,steps:Object.freeze(x.steps),relatedVideoIds:Object.freeze(x.relatedVideoIds)})));
export function workshopsForTrack(trackId){return PRACTICAL_STUDY_WORKSHOPS.filter(x=>x.trackId===trackId);}
