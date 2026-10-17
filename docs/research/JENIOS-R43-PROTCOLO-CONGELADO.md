# JENIOS R43 — protocolo pré-registrado de auditoria *mark price*
**Congelamento:** antes de capturar os arquivos desta revisão; commit SHA registra o protocolo.
**Objeto:** pesquisa pública exclusiva de dados de mercado, sem núcleo proprietário, sem cliente, sem API secreta, sem ordens.
**Base de referência privada:** JENIOS Platform R42 ZIP SHA256 `674db8bdc0274fcc73b4a3e77cc100c2297a76f74b71b4f4940a888509f70ffd`.
**Imutabilidade:** não alterar scanSignals, chooseMode, replayTrade, intenções sintéticas, baseline R41/R42, janelas nem seleção fixa de entradas em resposta aos resultados.

1. Mercado: Binance Vision, USD-M, `markPriceKlines` mensais BTCUSDT/ETHUSDT/SOLUSDT, intervalos 1h e 5m, janela UTC [2025-07-01,2026-10-01), 90 arquivos ZIP + 90 CHECKSUM. Exigir SHA256 de cada ZIP, somente um CSV esperado, séries ordenadas, ausência de lacunas ou duplicidade, consistência OHLC, carimbo de fechamento e prova do checksum do CSV final.
2. Conseguir tanto os 45 arquivos de funding R42 (4.113 eventos) quanto os 90 OHLCV da R41 já verificados, sem reescrever esses insumos originais.
3. Para financiamento em cada evento, usar marcação observada compatível com o instante do funding. Na granularidade 5min, usar APENAS preço de abertura do candle que inicia no evento, quando exato, e assinalar desconhecimento do tick exato de liquidação; 1h funciona só como sensibilidade mais grosseira. Não interpolar extremos nem inventar fills.
4. Retrospectivamente reavaliar o mesmo conjunto de 2.150 oportunidades pareadas, seis políticas e três períodos, sem otimização. Preços trade OHLCV continuam sendo os do replay original; série mark serve APENAS para auditoria de margem/financiamento. Se arquivos ou valores faltarem, falhar fechado e classificar cobertura inválida.
5. Limiares ilustrativos 2x/3x/5x/10x, manutenção 0,5% e 2,5% (HIPÓTESES, NÃO brackets históricos da Binance). Não afirmar liquidações reais; avaliação de candle apenas marca possibilidade de cruzamento, sem sequência intrabar nem equivalência com marcação de motor de liquidação.
6. Cenários adicionais de spread por lado: 0/2/5/10bps, sem afirmar custo observado; alertar possível dupla contagem com slippage. Registrar perdas novas, perdas evitadas fictícias, lucros sacrificados, ganhos extras e benefício líquido em R, limites de amostragem e comparador não operar.
7. **Gate pré-congelado**: real-money=NO_GO, deploy=NO_GO, claim-return=NO_GO, even if isolated retrospective uplift>0. Para elevar gate exigir demo prospectivo timestamped, livros reais, histórico de tiers de margem e auditoria de terceiros.

**Documentar quaisquer defeitos e emendas:** corrections in parsing, timestamps or data integrity are permitted with evidence, never silent backfill or changes to price-series selection or research hypotheses.
