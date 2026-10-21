# JENIOS Platform — laboratório de pesquisa inspirado nos vídeos de trade (B262)

## Limite de proveniência e segurança

Os materiais enviados são uma pauta para estudo, não autorização para copiar conteúdo, comercializar uma estratégia de terceiro ou ativar ordens. O acesso automatizado a legendas/transcrições dos links não ficou disponível; a identificação temática confiável cobriu apenas alguns vídeos por menções públicas. **Não afirmamos ter assistido ou transcrito os 20 links.** O estudo complementa o conhecimento geral com CME/CFA/SEC e produz hipóteses matemáticas originais de pesquisa.

A lógica proprietária dos robôs JENIOS **não foi alterada nem retreinada**. Nenhum dado de corretora foi acessado e nenhuma ordem foi emitida. O módulo de pesquisa é puro, determinístico e sem importação da camada de execução.

## Famílias propostas para avaliar, nunca para declarar prontas

| Família | Medidas de candles fechados | Hipótese verificável | Principal risco |
|---|---|---|---|
| Tendência | EMA(12), EMA(26) | Contexto de tendência versus lateralização | Atraso e whipsaw |
| Momentum | RSI(14), Estocástico(14) | Contexto de impulso e saturação | Saturação prolongada em tendências |
| Volatilidade | ATR(14), dispersão/Bollinger(20), volume relativo | Identificar ruído e adequação de risco | Spread/custo real ignorados |
| Reversões | Máximas/mínimas anteriores (20) | Validade de falsa ruptura somente com confirmação | Lookahead, falsas reversões |
| Múltiplos prazos | Cronologia/candle fechado | Filtrar padrões por contexto maior | Vazamento entre prazos e candles incompletos |

As medidas são observações e **não geram sinais de compra/venda**. Percentuais divulgados em vídeos não são metas de otimização.

## Protocolo para melhorar os robôs com segurança

1. Congelar a versão original do núcleo e pré-registrar as hipóteses antes da avaliação.
2. Criar dados de mercado com origem e relógio independentes por ativo e timeframe, retirando candles ainda abertos.
3. Separar treino, holdout embargado e avaliação prospectiva, sem ajustar parâmetros no holdout. Anotar seleção de ativos e regime de mercado.
4. Comparar os modos direto, reverso e híbrido sob **o mesmo capital, risco e execução**, incluindo cenários de 0/10/30bps e custos efetivamente observados, slippage, spread e latência.
5. Exigir comparação com a versão original, intervalos de confiança, drawdown, taxa de rejeição/ordens parciais, estabilidade por regime, e testes adversariais com falhas de conexão.
6. Registrar resultados negativos e critérios para rejeitar a hipótese. Só promover melhoria ao núcleo mediante revisão independente e nova homologação; não basta acertar um vídeo ou uma amostra histórica.

## Evidência atual

Os ensaios originais B182 reportaram poucas células positivas (2/9 sem taxas, 1/9 com 10 e 30bps), sem certificação de lucro. O novo laboratório B262 valida cálculos sobre candles artificiais, invariantes de tempo, input e preservação do bloqueio de negociação. **Ele não reexecuta o núcleo privado nem atesta desempenho.**

## Fontes educacionais de metodologia

- CME: https://www.cmegroup.com/education/courses/technical-analysis
- CFA 2026: https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/backtesting-and-simulation
- SEC: https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-15

## O que falta na etapa de pesquisa de vídeos

Para associar regras exatas de entrada/saída a cada vídeo, é preciso conferir o conteúdo integral ou uma transcrição autorizada, verificar duração, gráficos, ativo, timeframe, regras de risco e autoria. A lista está preservada na Universidade com `needs_video_review` quando isso não pôde ser verificado. Até essa conferência, não há autorização para afirmar que os robôs passaram a executar estratégias daqueles vídeos.
