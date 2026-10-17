# JENIOS R44 — pré-registro de observação prospectiva de livros públicos
**Carimbo externo primário:** commit GitHub deste documento, anterior à execução de captura. Estado de produção intocado.

## Fonte e amostra
Binance USDⓈ-M futures: somente endpoints públicos de leitura **GET** `/fapi/v1/time`, `/fapi/v1/depth?symbol=S&limit=20`, `/fapi/v1/ticker/bookTicker?symbol=S`, `/fapi/v1/premiumIndex?symbol=S`. Símbolos fixos BTCUSDT, ETHUSDT, SOLUSDT. Duas tomadas sequenciais, separadas por 65 segundos no runner, não confundir com OHLCV históricos nem preencher observações falhadas.

## Validação da captura
Conservar payload bruto dos provedores, URL do endpoint público (sem credenciais), captura temporal UTC local e event timestamps da exchange, SHA-256 de cada conjunto, git commit SHA e metadados da GitHub Actions run. Verificar símbolos, cronologia, sanidade bid<ask, quantidades positivas, profundidade e idade da cotação. Se acesso negado/rate limited ou dados inconsistentes, registrar falha e não inferir preço.

## Julgamento e limitações
- Público; nunca solicitar chave API, não incluir engine proprietário, pagamentos ou dados do usuário.
- Profundidade de 20 níveis é fotografia do livro; liquidez pode evaporar e ordens não foram executadas.
- Estimar VWAP teórico para ordens nocionais fixas US$100, US$1.000 e US$10.000, exclusivamente no snapshot observado; nenhum valor identifica slippage REAL.
- Base hipotética de taxa 10bps/lado não é tabela de taxas contratadas. Premissas de spread incremental 0/2/5/10bps, sem dupla contagem em cálculo final.
- Deliberação só com informações disponíveis no instante anterior; segundo snapshot é APENAS observação posterior. Nenhuma estratégia pode ajustar decisão anterior ao ver o segundo snapshot.
- Duas fotografias em ~65 segundos e três ativos são evidência de pipeline, não estudo estatístico de rentabilidade. Ainda não há intenções reais de clientes ou um piloto operacional contínuo.
- `realTrading=false`, `clientLossAvoidedVerified=false`, `profitabilityProven=false`, `deployment=false`, `releaseGate=NO_GO`.
