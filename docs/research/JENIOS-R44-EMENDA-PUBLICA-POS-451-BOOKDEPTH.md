# JENIOS R44 — auditoria EXPLORATÓRIA, pós-falha HTTP 451
Data 17/10/2026 UTC. Fonte futura de nível 2 Binance REST pública foi **NEGADA HTTP 451** em runner GitHub Actions (R44 run 38991726868). NENHUMA amostra válida de book real-time foi obtida; não tentar contornar bloqueio regional ou usar proxy.

## Auditoria secundária de arquivos históricos
Para testar adequação dos dados e não reconstruir book não-observado, comparar arquivos oficiais USD-M daily `bookDepth` dos três símbolos fixos BTCUSDT/ETHUSDT/SOLUSDT, duas datas **2026-09-02 e 2026-09-06**; a escolha se baseia em problema público reportado em GitHub issue `binance/binance-public-data#496`. Não são datas ou hipóteses pré-registradas na R43, não interpretar como holdout, nem extrapolar taxa de defeitos para outros dias.

Exigir 6 arquivos ZIP e 6 arquivos CHECKSUM oficiais SHA256; parsing `timestamp,percentage,depth,notional`, ordenação, campo numérico finito, data do arquivo, agregação por bandas cumulativas de ±0.2%, ±1%, ±2%, ±5%. Calcular proporção de valores distintos de `notional/depth` por banda e contagem de sequências congeladas. Identificar casos em que a banda indicativa ask +0.2% é menor que a bid -0.2%, alertando que essas métricas agregadas NÃO são cotações executáveis.

Não produzir VWAP, slippage, fill, corretagem efetiva ou resultados da estratégia a partir desses arquivos; se fonte de qualidade falhar, classificar série UNFIT e manter dados brutos imutáveis.

Resultado esperado: relatório de qualidade e NO_GO independentemente da direção observada. Nenhum núcleo privado, chave, usuário, API de execução, dinheiro real ou merge.
