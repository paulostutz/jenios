# JENIOS R41 — PRÉ-REGISTRO ANTES DA COLETA COMPLEMENTAR

**Escopo:** robôs privados em pesquisa offline; nenhuma ordem, pagamento ou dado de usuário. O horário do commit é a evidência de pré-registro.

## Fonte e dados congelados
- Binance Vision oficial, USD-M futuros perpétuos, BTCUSDT, ETHUSDT, SOLUSDT.
- Intervalos 1h (swing) e 5m (intraday).
- Novos 15 meses: 2025-07-01T00:00Z a 2026-10-01T00:00Z exclusivo, posteriores à janela já examinada na R40.
- Separação de leitura: 2025H2, 2026Q1, 2026Q2-Q3. Não alterar parâmetros após abrir essas séries.
- 90 arquivos ZIP mensais esperados + 90 arquivos de checksum obtidos do domínio oficial; conferir SHA256, data, sequência contínua, 12 colunas Binance e propriedades OHLCV.
- Arquivo privado R40 de referência SHA-256: a9427b0122169ac18d68d26a4f1595f61ffd0955bf357037a1f7655bb9f63c4c.

## Protocolo técnico e avaliações
- Usar gerador existente R38_PROTOCOL.version=R38.1; manter constantes scanSignals, chooseMode e replayTrade; correções de desempenho precisam demonstrar equivalência.
- Swing: 1h/4h/1d, 12 candles 4h; day: 5m/5m/1h, 48 candles 5m.
- Entrada na abertura do candle seguinte, apenas dados já encerrados para sinal.
- Alvo 3R, stop ATR ×1,5, risco unitário 0,25% do capital. Custos base: taxa 10bps/lado, slippage de entrada adverso 5bps e saída estimada 5bps.
- Estresse de custo incremental PREDEFINIDO: +10, +25 e +50 bps por lado, além do cenário base.
- Comparar direto, inversão ingênua, chooseMode com intenções inventadas pré-semeadas, não operar e comparador temporal que usa apenas trades fictícios já encerrados. Comparador não é robô comercial.
- Uma posição por símbolo em carteira simulada, fechamento obrigatório, número de trades e exposição.
- Mostrar perdas novas, lucros sacrificados, perdas brutas hipoteticamente evitadas, ganhos adicionais, diferença líquida, drawdown e número de sinais por grupo.
- Intervalos semanais meramente descritivos; sinalizar amostra limitada abaixo de 50 sinais ou 15 semanas independentes por subjanela.
- Funding real, spreads de livro, margem, liquidação e fills reais não medidos.
- Nenhum dado comprova decisões humanas reais ou prejuízo efetivamente evitado de cliente. Real-money=NO_GO, deploy=NO_GO.

## Integridade
Este protocolo deve ser fixado ANTES do download do novo histórico pelo workflow R41; não adaptar critérios depois de conhecer os resultados. O estudo permanece retrospectivo, ainda que sua janela não tenha sido usada nas revisões anteriores.
O núcleo proprietário, credenciais e dados de clientes não devem ser publicados no GitHub.
