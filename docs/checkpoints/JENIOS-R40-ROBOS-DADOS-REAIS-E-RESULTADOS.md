# JENIOS R40 — validação histórica real dos robôs (checkpoint técnico)
**Data:** 16/10/2026. **Estado:** pesquisa privada concluída; não autoriza ordens financeiras e não demonstra rentabilidade nem perdas realmente evitadas em clientes.

## Publicação e proteção da aplicação
- GitHub `main` confirmado em `8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10` (R35), sem mudança.
- Esta branch contém SOMENTE ESTE DOCUMENTO. Não contém engine privado, parâmetros de sinais, operações, dados bancários ou chaves.
- Todos os **803 arquivos herdados de R39** foram comparados byte a byte e permanecem idênticos em R40; alterações são adições de arquivos privados de pesquisa, dados, testes e relatórios.
- Nenhum dado do Supabase, JENIOS PAY, Social, BankScore, Validador, corretoras ou produção foi alterado; negociação com dinheiro real segue BLOQUEADA.

## Dados históricos reais / origem declarada e verificada
- 54 arquivos mensais oficiais SPOT e 54 arquivos mensais oficiais de futuros USD-M da Binance Vision, disponibilizados com arquivo `.CHECKSUM`; todos os **108 pares foram comparados por SHA-256** em execução automática e depois novamente localmente.
- **BTCUSDT / ETHUSDT / SOLUSDT**, candles de 1h, 2024-01 até 2025-06.
- **78.768 candles históricos** (13.128 por ativo x 3 ativos x 2 mercados).
- Por série: **8.784 candles/ano** 2024 para desenvolvimento retrospectivo, **4.344 candles** jan–jun/2025 para teste retrospectivo separado. Importante: o protocolo foi congelado em outubro de 2026, quando todo o histórico já existia; NÃO é holdout prospectivo ou avaliação pré-registrada sem risco de viés.
- Download exclusivamente por workflows em BRANCHES DE PESQUISA PÚBLICA, somente código de busca/checksums:
  - https://github.com/paulostutz/jenios/actions/runs/38978750011 (spot: success)
  - https://github.com/paulostutz/jenios/actions/runs/38979230040 (futuros USD-M: success)
- Checksums da própria fonte comprovam a integridade dos bytes baixados, NÃO demonstram a veracidade independente dos negócios da corretora ou dos fills futuros.

## Resultados sem seleção oportunista de dados
- **288 oportunidades retrospectivas de comparação** (não trades reais), **164** no período separado jan–jun/2025: 80 spot + 84 futuros.
- Spot: sinal oposto menos direto, média por sinal **-0,067 R**, intervalo descritivo por blocos semanais 95% **[-0,915; +0,775] R**.
- Futuros USD-M: diferença **+0,028 R**, IC descritivo **[-0,747; +0,800] R**.
- Todos os ICs por ativo e por mercado incluem zero. A inversão não mostrou vantagem estatística robusta com estes testes. Cada série individual tem menos de 50 sinais holdout.
- Carteiras experimentais sem posições sobrepostas diferem em exposição/número de operações: não representam comparação causal pareada, nem rendimento garantido. SPOT não permite venda descoberta direta sem mecanismo de empréstimo; futuros não incluem funding real, spread de livro, margem, liquidação ou fills de ordens.
- A função **real `chooseMode`** rodou em preços históricos reais, mas **intenções e confirmações dos supostos operadores foram geradas sinteticamente**. A variante híbrida apresentou resultado líquido pior que as intenções artificiais nos **seis** cenários analisados com taxa de intenção divergente fictícia de 35%. Isso é ALERTA de engenharia, NÃO validação de desempenho de cliente.
- Cenários adversariais de taxas crescentes 0, 5, 10, 20, 40 e 80 bps por lado (custo base 10 bps mais slippage prefixado) deterioraram os resultados líquidos com custos maiores.
- **Loss efetivamente evitado por cliente: NÃO COMPROVADO.** Resultado de cliente real e retorno comprovado: INDISPONÍVEIS.

## QA concluído
- **388/388 testes do núcleo privado**, 0 falhas e 0 ignorados.
- **674/674 testes da aplicação**, 0 falhas e 0 ignorados.
- **355 arquivos de sintaxe da aplicação** conferidos e build Next.js/Webpack aprovado com credenciais QA fictícias.
- Scripts offline reexecutados para verificar **108 CHECKSUMS + 6 CSVs** e reproduzir os **78.768 candles / 288 oportunidades / 164 sinais de teste** com mesma metodologia e mesmo resultado, sem reotimizar estratégia.
- Relatório PDF com quatro páginas visualmente verificado. Manifests, logs dos testes e resultados positivos/negativos no backup.
- Sem execução de ordens, depósitos, conta de corretora real, WhatsApp, IA real ou publicação dos robôs.

## Arquivo privado e recuperação
- Biblioteca: `/JENIOS-Platform-R40-completo-privado.zip` (arquivo integral cumulativo com todos os avanços anteriores).
- Tamanho: **22.512.624 bytes**, **871 entradas ZIP**, incluindo manifesto de **870 arquivos de conteúdo**.
- SHA-256 do ZIP: `56af06d62854c958655a78ad54b02fe16c47037ebd109529c5872ac48314029d`.
- ZIP CRC e hash SHA-256 de cada um dos 870 arquivos verificados, sem `node_modules`, `.next`, credenciais ou dependências executáveis.
- PDF: `JENIOS-Platform-R40/documentacao-r40/RELATORIO-VALIDACAO-ROBOS-R40.pdf`.
- Código proprietário fica somente na cópia privada; NÃO enviar este ZIP a repositório público.

## Próxima validação obrigatória
1. Congelar protocolo ANTES de uma **nova** série futura não observada, fixando amostra, custos, margem e critérios de aprovação.
2. Registrar intenção real de cliente e decisão do robô, ambas com carimbo de tempo verificável anterior ao resultado, em piloto sem dinheiro real.
3. Comparar resultados líquidos pareados, ganhos sacrificados, perdas novas, limites de risco, falhas de rede, fills e funding em corretora demo.
4. Somente considerar operações reais após estudo estatístico independente, segurança e conformidade.

**Gate:** technicalTests=PASS; reproducibility=PASS; financialEdgeVerified=FALSE; realClientLossAvoidedVerified=FALSE; realTradingEnabled=FALSE; deployment=NO_GO.
