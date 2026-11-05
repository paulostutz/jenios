# JENIOS R112 — UltraFast V3, três blocos (05/11/2026)

## Diretriz e precedência
- Repositório `paulostutz/jenios`; origem **R111 PR #26**, HEAD `386063b1850734369a17f32d5a471fcc5834877d`, ainda em revisão, NÃO `main` (desatualizada para os robôs).
- Implementação 100% **aditiva** em branch `work/jenios-r112-ultrafast-v3-20261105`; preservar R18–R55 e R111 byte a byte; não criar quinto motor.
- **Esta entrega é somente biblioteca de pesquisa offline + testes.** Não contém conexão WebSocket, dados externos autenticados, painel em produção, ordem real, Paper externo, migração de banco, chave, alçada financeira ou afirmações de lucro.
- Mesmo um resultado de CI verde não prova rentabilidade, integridade de dados de corretora nem precisão dos modelos de fill. Desbloquear Live exige autorização separada e evidências completas.

## Bloco 1 — inteligência, integridade e segurança
- `ultrafast-v3-books.mjs`: reconciliação de *diff-depth* da Binance Spot com snapshot e controle de IDs `U/u`; eventos perdidos, dados obsoletos e book cruzado bloqueiam a análise. Preços canônicos não duplicam um mesmo nível. Verificação Kraken WebSocket v2 CRC32 sobre os 10 melhores asks e bids com decimais em string, confrontada com **vetor oficial `3310070434`**.
- `ultrafast-v3-exchange-rules.mjs`: preflight **offline** para ordens LIMIT Binance Spot (PRICE_FILTER, LOT_SIZE, MIN_NOTIONAL, NOTIONAL e filtros relativos à referência) usando inteiro de 18 casas; campos faltantes, filtros não homologados, status e permissões não verificadas bloqueiam. Há uma checagem independente inicial Kraken (price increment, qty increment, mínimos). Não representa um validador universal de todos os tipos de ordens/exchanges.
- `ultrafast-v3-token-venue.mjs`: heurísticas de riscos de tokens (permissões de dono, mint/freeze, impostos, venda, concentração, removibilidade da liquidez, descolamento de stablecoin) exigindo dados **fornecidos pelo chamador**. Não valida contrato on-chain nem comprova ausência de fraude. Comparação hipotética de preço executável entre duas venues para o mesmo par com custos/slippage/latência e necessidade de pré-funding por venue; sem execução simultânea garantida, transferência nem operação real.
- Testes: vetores Kraken, lacunas e contiguidade Binance, precisão decimal, controles de contrato/token e hipóteses entre venues.

## Bloco 2 — risco, execução e precisão
- `ultrafast-v3-risk.mjs`: marcação teórica a bid, perdas não realizadas, pior cenário de gap pós-stop, taxa, posições pendentes e abertas, limite por operação/sessão/dia/exposição global/correlação; alocador conservador por cluster/score que **não movimenta patrimônio**.
- `ultrafast-v3-microstructure.mjs`: pesquisa determinística de caminhada do livro (taker) com profundidade limitada e slippage máximo; simulador maker com volume de agressões e posição à frente da fila, latência e preenchimentos parciais. Resultados são hipóteses conservadoras, **não execução comprovada**; `cancellationsAheadUnknown=true`.
- Testes: gaps, perdas latentes, travamento por exposição, fila e fill parcial, fontes simuladas vs leitura da corretora.

## Bloco 3 — aprendizagem supervisionada, rastreabilidade e continuidade
- `ultrafast-v3-validation.mjs`: comparação *paired walk-forward* fora da amostra, embargo temporal, teste contra lookahead, reamostragem de blocos determinística, limite conservador ajustado por Bonferroni. Os intervalos são **exploratórios**, dependem dos dados e não certificam desempenho ou causalidade.
- `ultrafast-v3-operations.mjs`: cadeia de evidências SHA-256 com IDs e razões sem payload pessoal, inspeção de atrasos de feed/conta, problemas de relógio, rejeições, fills e ordens desconhecidas. Recovery com verificação e aprovação humana; sem retry/cancel automático. O host precisa persistir a cadeia em armazenamento auditável e comprovar o estado remoto.
- `ultrafast-v3-gate.mjs`: validação composta que exige a aprovação do gate de pesquisa **R111 existente** e todos os novos controles R112; resultados não habilitam ordens nem promoção automática de parâmetros.
- `r112-ultrafast-v3-smoke.mjs`: validação local de fluxo integrado com dados sintéticos, sem rede.
- Workflow direcionado `.github/workflows/jenios-r112-ultra-v3-research.yml` executa testes R112 e R111, smoke e `git diff --check` sem testes financeiros gigantes repetidos.

## Critérios de aceite desta etapa
- Testes locais combinados: **41/41 PASS** (V2 19 + V3 22) em Node 22; smoke integrado OFFLINE PASS.
- A aprovação de CI remoto deve ser checada **após** o push; não confundir aprovação local com sucesso remoto.
- Commits separados CP1/CP2/CP3, PR em rascunho dependente de R111, backup completo SHA256 na Library, sem modificar ou excluir arquivos anteriores.

## Lacunas intencionalmente preservadas
1. Consumidores reais de WebSocket público/privado com reconexão, resnapshot e confirmação de atraso por exchange.
2. Consulta autorizada e verificação real de `exchangeInfo`, regras por conta, ativos on-chain e confiabilidade dos provedores de risco.
3. Livro completo e reconstrução intrajornada com impacto de mercado, liquidez *hidden*, prioridade de fila verdadeira, ajustes de relógio e performance em período turbulento.
4. Conta e consentimento dos clientes, cofre de chaves, Paper trading autenticado, feed de ordens da corretora, diário durável, stop no provedor, fluxo de cancelamento, reconciliação pós-crash.
5. Dados prospectivos independentes suficientes e auditoria de latência/custos, revisão regulatória, liberação graduada de recursos e autorização explícita para qualquer negociação real.

## Referências técnicas oficiais (consultadas)
- Binance Spot diff-depth/snapshot: https://developers.binance.com/zh-CN/docs/products/spot/testnet/web-socket-streams
- Binance Spot filters: https://github.com/binance/binance-spot-api-docs/blob/master/filters.md
- Kraken WebSocket v2 checksum, exemplo oficial: https://docs.kraken.com/exchange/guides/websockets/book-checksum-v2

## Estado
`R112_OFFLINE_RESEARCH_IMPLEMENTED / V2_INTACT / LIVE_FALSE / PAPER_EXTERNAL_FALSE / NO_PRODUCTION_DEPLOY / BROKER_UNVERIFIED`