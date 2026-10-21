# JENIOS Platform — B279 | Replay retrospectivo isolado de BTC, ETH e SOL

**Data:** 21/10/2026. **Base certificada:** B278 commit `e96a98486cd07b8ee8b264f32c2c8f97c77e9958`, CI `39617307059`. Produção original B177-R3 e projeto `jenios-ecossistem` preservados.

## Missão e escopo seguro
Reconstruir **a mesma janela histórica pública H1 em USD** do B278 por Coinbase Exchange pública, comparar a mesma sequência e hash SHA-256 por ativo, e executar uma investigação exploratória inteiramente isolada: duas hipóteses autorais, os modos **direto, reverso e híbrido**, custos e stops estressados. Nenhum código dos motores proprietários, contas, conexões de corretora, Gênios, Universidade, PAY, Social, BankScore ou Validador foi refeito ou modificado.

**Referências congeladas do B278** (não são autenticação criptográfica da Coinbase):
- BTC-USD: `8170a90fb03f458458ce18e798e0c772e7d1862eb9c5baa4dd234b1456d8aad5`
- ETH-USD: `a2cc69fc747161ad8587c04f6b6b84b55bbd3de4793c455dd200fa93714ce82c`
- SOL-USD: `cd10d24f978501d93f23eb199ac2e850cc42ff4f3ca734f8139205ea08ac4701`

## Janela única (UTC)
960 candles H1 por par, setembro–outubro de 2026. Início 1789128000000; treino até 1791288000000 (600 candles); embargo de 48 candles até 1791460800000; período histórico reservado de 312 candles até 1792584000000. É **divisão retrospectiva concebida depois de os preços existirem**, não holdout pré-registrado e não evidência prospectiva.

**Instrumentos:** BTC-USD, ETH-USD, SOL-USD. **Nunca** reinterpretar esses preços USD como BTCUSDT, ETHUSDT ou SOLUSDT; paridades e spread não foram comparados.

## Hipóteses e cenários congelados antes desta avaliação
- `EMA_CONTEXT_V1`: direção conforme EMA12/EMA26, calculadas com candles fechados anteriormente.
- `CLOSED_BREAKOUT_V1`: rompimento da máxima/mínima dos 20 candles anteriores; o sinal usa apenas candle encerrado.
- `direct`: direção original da hipótese; `reverse`: direção oposta; `hybrid`: apenas se diferença EMA relativa de pelo menos 0,15% e confirmação de direção nas rupturas. **Esses rótulos são protótipos de laboratório, não o comportamento dos robôs proprietários JENIOS.**
- **Stop fictício:** 1% da entrada; mesma unidade R de risco por operação, sem composição nem alavancagem.
- **Fricções:** custo ida-e-volta de 0, 10, 30 bps; deslizamento adverso do stop de 0, 10, 30 bps, em matriz 3×3. Total: 3 ativos × 2 hipóteses × 3 modos × 3 custos × 3 cenários adversos = **162** combinações. Cada ativo/hipótese/modo possui nove combinações.
- Entrada ilustrativa na abertura do candle posterior à confirmação; encerramento fictício no stop ou fechamento da mesma barra. Coletar e analisar **somente candles já fechados**.
- Relatório inclui contagem, acertos, ganhos e perdas em R, expectativa líquida, redução por custos, perda extrema, drawdown e sensibilidade. Resultado vazio mantém `null`, jamais lucro 0 disfarçado.

## Critérios rígidos da coleta de histórico real
`scripts/platform/research/b279-run-real-replay.mjs` usa apenas GET público, janelas da coleta B278 e hash exato do manifesto. Dados faltantes, provedor indisponível ou divergência SHA => `REPLAY_FAILED_CLOSED_NO_VERIFIED_B278_HISTORY`; **nenhum resultado real aceito** e a tentativa não pode ser chamada de backtest histórico validado. O job da tentativa é separado da CI do código. Não arquivar candles brutos, somente hashes e estatísticas/limitações.

Mesmo quando os três hashes são iguais e os cálculos produzem números, esses números **não demonstram vantagem financeira confiável**, por razões conhecidas: apenas aproximadamente 13 dias históricos reservados, parâmetros estudados após observação histórica, nenhuma comparação com dados de outra bolsa, liquidez e livro não modelados, stops sem garantia de fill, posições vendidas sem custo de empréstimo/financiamento, latência e margem ausentes, séries HTTP não assinadas e falta de teste prospectivo. Modelos simplificados podem superestimar desempenho. Não usar esse resultado para selecionar parâmetros operacionais nem recomendar negociações.

## Testes e continuidade
O teste B279 com **séries sintéticas** valida a mecânica: 162 linhas, timestamps causais, exata separação temporal, monotonicidade de custo e slippage, integridade de protocolo, impossibilidade de falsificar o SHA dos dados B278, não equivalência USD/USDT e zero ordens.

A CI geral executa regressões de todos os módulos e build Next.js. `scripts/platform/research/b279-integrity.mjs` verifica seis arquivos novos e garante bytes originais dos códigos protegidos. O candidato só estará certificado com CI verde e commit exato. A captura histórica fica rotulada independentemente (`REPLAY_COMPLETED_B278_SHA_MATCHED` ou `REPLAY_FAILED_CLOSED_NO_VERIFIED_B278_HISTORY`).

## Próximo B280
Construir base de observação prospectiva independente com hipóteses previamente congeladas, dados de origem verificável, regras de custos e risco e comparações estatísticas. Sem alterações dos robôs ou deploy até critérios completos e aceite.
