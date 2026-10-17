# JENIOS R41 — validação histórica cruzada dos robôs

**Data:** 16/10/2026. **Natureza:** checkpoint documental, não é deploy. **Escopo:** pesquisa dos robôs proprietários da JENIOS Platform; nenhuma alteração na Social, PAY ou APIs financeiras.

## Estado imutável
- GitHub `main` observado antes do checkpoint: `8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10` (hotfix público R35).
- Estratégia privada de geração de decisões foi preservada; SHA-256 de seu motor: `9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea`. Somente o janelamento temporal de replay na pesquisa foi otimizado, com equivalência testada.
- 501 arquivos da aplicação R40/R41 idênticos byte a byte; não foi publicada a R41, nenhuma ordem real, cobrança, mensagem ou alteração de banco.
- O protocolo de pesquisa foi registrado antes da coleta desta bateria no commit `b43a752e961426bb561a11063248657fc142c338` (arquivo `docs/research/JENIOS-R41-PREREGISTERED-FROZEN-PROTOCOL.md`). Esse pré-registro realizado em outubro de 2026 NÃO converte preços de 2025/2026 em resultados prospectivos.

## Origem e reconciliação de preços históricos
- USD-M Binance Vision, três instrumentos `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, frequências 1 hora / 5 minutos; julho de 2025 a setembro de 2026 (15 meses). 90 ZIP históricos e 90 arquivos `.CHECKSUM` correspondentes verificados.
- **427.752 candles**: 32.904 de 1h e 394.848 de 5m.
- Reagregação OHLCV de 5m para 1h: zero divergências com dados de 1h.
- O checksum autentica integridade relativa ao arquivo de verificação fornecido pela fonte indicada, mas não comprova a autenticidade de todas as execuções de mercado.
- Arquivos de origem na Biblioteca `/JENIOS-R41-Dados-Historicos-Verificados.zip`. Arquivo fonte separado: `JENIOS-R41-90-ARQUIVOS-USDM-VERIFICADOS.zip`, **45.455.671 bytes**, SHA-256 `412ddd8f4caef7dfdbc633940ab831519ad5eabe41e2db2f6087a114e8152b76`.

## Backtests congelados (sempre retrospectivos, sem trading real)
- **6.595 sinais simulados** observados nos históricos; 6 grupos `ativo x periodicidade`, sem otimizar regras após observar período histórico.
- 1h: BTC 70 sinais, direcional médio -0,290R e reverso -0,025R; ETH 42 sinais, -0,180R e +0,323R; SOL 61 sinais, -0,049R e -0,143R.
- 5m: BTC 2.156 sinais, direto -1,659R e reverso -1,647R; ETH 2.236 sinais, -1,011R e -1,006R; SOL 2.030 sinais, -0,895R e -0,782R. **Ambos negativos nos três ativos em 5m.**
- Intervalos descritivos por reamostragem semanal para diferença oposto menos direto incluem zero em cinco conjuntos elegíveis: BTC1h [-0,451, +1,041], BTC5m [-0,129, +0,159], ETH5m [-0,126, +0,150], SOL1h [-0,697,+0,459], SOL5m [-0,071,+0,291]. ETH1h contém 42 sinais, insuficiente para o limite mínimo pré-definido de 50; não recebe intervalo elegível.
- Em todos os nove subperíodos ativos de carteira no timeframe 5m (três ativos em três janelas), ambas as referências chegaram ao limite de interrupção por drawdown ≥8%. Não interpretar 8% como stop garantido nem como perda máxima exata.
- Sensibilidade de taxa de 10,20,35,60 bps por lado aferida sobre TODOS os 6595 sinais; elevação dos custos piora os resultados.
- Achado de conformidade: no simulador congelado, certas saídas (stop, gap, encerramento por tempo) cobram 5bps adicionais de slippage além dos 5bps de saída já supostos fixamente; mantido e divulgado nas métricas canônicas. Análise diagnóstica retirando só a duplicidade mantém médias de 5m negativas; não alterar pesquisa a posteriori e afirmar que é o mesmo protocolo.
- `chooseMode` foi avaliado com intenções de operadores **inventadas**, e pesquisas walk-forward usaram somente sinais já fechados. Não são perdas reais de clientes evitadas e não demonstraram desempenho robusto; separadas da comparação simples de direção.
- Dois executores independentes reconciliaram **6.595 decisões** (identidades, lados, preços, saída, retorno líquido e timestamps): zero divergências. Logs JSON e evidências estão no pacote.

## Testes, relatórios e arquivo íntegro
- **472/472 testes do núcleo privado** aprovados, 0 falhas; **674/674 testes da aplicação** aprovados.
- **355 arquivos** passaram na checagem de sintaxe; build Next.js/Webpack aprovado com variáveis fictícias de QA.
- Gate: technicalQA PASS; marketProfitabilityVerified=false; clientLossAvoidedProven=false; executionEnabled=false; productionRelease NO-GO.
- PDF final: `documentacao-r41/RELATORIO-VALIDACAO-ROBOS-R41.pdf` (4 páginas, revisado visualmente), salvo também em Biblioteca `/JENIOS-R41-Relatorio-Validacao-Adversarial.pdf`.
- O primeiro ZIP de draft foi rejeitado ao detectar mudanças simultâneas em dois arquivos; NÃO usar `JENIOS-Platform-R41-completo-privado.zip`. Backup final isolado e verificado por arquivo:
  - `/JENIOS-Platform-R41-AUDITORIA-CRUZADA-FINAL.zip` na Biblioteca.
  - Arquivo local `JENIOS-Platform-R41-FINAL-PRIVADO.zip`: **57.846.686 bytes**; 959 entradas, sendo **958 arquivos** de conteúdo, cada um verificado por SHA-256 e CRC.
  - SHA-256 do ZIP final: `3662d81e2ab2ddb8653d34630a4884897f2d037428196c00fa0416b6d2f0e899`.
  - Contém aplicativo cumulativo R25-R41, núcleo privado separado, scripts de reprodução, resultados canônicos e reconciliados e CSVs normalizados. 90 arquivos ZIP originais estão em arquivo separado. **Não publicar ZIP/código dos robôs em GitHub público**.

## Próxima exigência e decisão de produto
- Nenhuma liberação para dinheiro real em 5m; analisar critérios para se abster e reduzir churn/taxa por sinal sem ajustar retroativamente estes dados.
- Protocolo novo para slippage sem duplicidade e custos reais, previamente registrado ANTES do próximo teste; adicionar funding, spread de book, liquidez, pausas de negociação e margem/futuros.
- Realizar piloto prospectivo em simulação com intenções de clientes registradas **antes** das decisões e rastreáveis; calcular diferencial financeiro líquido pareado, perdas induzidas, lucros sacrificados e incerteza.
- Sem essa prova, o slogan permanece marketing, não garantia financeira; perda real evitada não demonstrada.

**Conclusão: sucesso de validação técnica e de integridade, falha para demonstrar vantagem financeira geral; ordens reais NO-GO.**
