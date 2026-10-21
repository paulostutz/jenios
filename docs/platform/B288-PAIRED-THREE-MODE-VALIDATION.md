# JENIOS B288 — Refinamento auditável do filtro híbrido e comparação das três modalidades

**Base:** B287 CI 39649914525, commit 9e37aec07394db7eb03257d00b8d4229ce0be6c0. Branch: `fix/jenios-b288-paired-filter-cost-stress-20261021`. Produção não alterada.

## Escopo implementado

O módulo `b288-paired-filter-audit.mjs` **não gera sinais** e **não usa os motores proprietários**. Recebe lotes de sinais já congelados pelo contrato B287 e candles H1 externos fornecidos pelo chamador, sempre rotulados como dados USD spot não assinados. Faz apenas aritmética determinística sobre esse material. Rejeita se algum sinal for emitido depois da abertura do candle, se o batch tiver sido congelado depois dessa abertura, se faltar qualquer um dos três modos sobre o mesmo ativo/hora, se preço/volume estiverem inconsistentes ou se não houver intervalo de segurança de cinco minutos após fechamento.

São nove cenários por decisão: custo round-trip de 0/10/30 bps e slippage adverso de stop de 0/10/30 bps, com stop hipotético fixo de 1%. O slippage só incide quando há toque do stop; o modelo de saída por fechamento de candle não inclui profundidade, fila, gaps, financiamento de posição short, liquidação ou spread dinâmico. Não há preenchimento de ordens real nem Paper.

## Medições separadas

- **Manual (sinais)**: contagem de sinais matematicamente avaliáveis, acertos/erros líquidos hipotéticos, abstenção, percentual de acerto descritivo, soma líquida e drawdown em R — **não retorno da conta**.
- **Híbrido**: as mesmas medidas e uma auditoria pareada contra o Manual em cada ativo/hora com direção idêntica ou `ABSTAIN`. O filtro deve registrar **ambos** `hypotheticalLossesAvoided` e `hypotheticalGainsMissed`, juntamente com R de perdas que seriam evitadas e ganhos que seriam abandonados sob 30/30 bps. Nem todos esses resultados constituem perdas efetivamente neutralizadas: a métrica é **contrafactual hipotética, não execução observada**.
- **Reverso**: direção contrária, quando o Manual deu sinal, sob os mesmos custos e preços, com empréstimo, funding e margem explicitamente não modelados.

## Regra contra ajuste excessivo

Nenhum parâmetro dos robôs é recalibrado a partir do desfecho observado. O resultado só define **hipóteses de aprimoramento futuro** e falhas. É proibido selecionar o melhor dos nove cenários e apresentar esse número como desempenho. Para cada melhoria candidata, primeiro registrar o protocolo com hash e período de treino, separar embargo e holdout que o algoritmo não viu, repetir validação prospectiva e manter também os resultados ruins.

## Classificação comercial e limites

Testes de CI usam **fixtures sintéticas**: seus ganhos, perdas e supostas perdas evitadas não podem entrar em publicidade como rentabilidade da JENIOS. Dados públicos de BTC-USD, ETH-USD e SOL-USD não são BTCUSDT, ETHUSDT ou SOLUSDT. Os núcleos proprietários permanecem sem avaliação econômica nesta etapa. Exige-se pelo menos 30 dias, 300 horas e 100 observações úteis por grupo, além de preço independente atestado, relógio testemunhado, custos/execução realisticamente modelados e análise estatística antes de reivindicações de desempenho.

Não enviar ordens reais ou simuladas, não acionar corretoras, não cobrar, não fazer deploy e não afetar CHEFE ou LETTER.

## Próximas ações necessárias

1. Exportação **somente leitura** dos sinais genuínos dos três motores, com confirmação isolada do SHA do core e timestamps pré-candle.
2. Captura prospectiva consentida de preços com origem independente auditada, preservando também eventos rejeitados.
3. Conciliação de custos e deduplicação de evento/hora; comparação verdadeira de filtros e ganhos descartados.
4. Somente após avaliação fora da amostra, aprovação humana explícita para ajustes de parâmetros; repetir após cada mudança, sem promover números retrospectivos como futuros.
