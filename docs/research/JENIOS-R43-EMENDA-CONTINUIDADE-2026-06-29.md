# JENIOS R43 — emenda de qualidade documental (sem mudança de hipótese)
**Motivo registrado antes da coleta diária:** dos 90 arquivos mensais mark-price SHA256 corretos, seis têm lacuna idêntica de **2026-06-29 inteiro**: BTCUSDT, ETHUSDT e SOLUSDT em 1h/5m. BTCUSDT/1h e ETH/SOL idem. Junho contém 696/720 candles 1h e 8352/8640 candles 5m. Lacuna de 24h em todas as séries.
**Emenda permitida pelo protocolo original:** verificar seis arquivos **DIÁRIOS oficiais** de 2026-06-29 em `https://data.binance.vision/data/futures/um/daily/markPriceKlines`, sempre ZIP+CHECKSUM SHA256, sem sintetizar qualquer preço.
- Só admitir série composta para pesquisa se timestamp inicial/final, continuidade, CSV e OHLCV completos e congruentes com os dois lados do intervalo mensal ausente.
- Manter mensal intacto e o diário original; derivado com novo hash, manifest de proveniência e flag `recoveredFromOfficialDailyArchives=true`.
- Se arquivo diário inexistir, inválido, divergent or with gaps, a série permanece **REJEITADA**. Jamais preencher por interpolação.
- Restam inalterados os mercados, timeframes, janelas, sinais, intenções artificiais e custos congelados; resultados continuam retrospectivos.
- Todos os gates de dinheiro real, rentabilidade e deploy continuam NO_GO.

**Registro de defeito = evidência de problema na cobertura publicada; SHA256 confere com o arquivo recebido, não comprova completude.**
