# JENIOS — R111 | UltraFast V2 em três blocos

Data: 05/11/2026. Origem: PR R110, sem alterações no motor financeiro ou produção. Destino: branch isolada de desenvolvimento, sem autorização de ordens reais.

## Precedência obrigatória

- Recuperar o histórico de pesquisa R18, R21–R23, R27–R30, R51–R55, e R59, sem substituir a lógica de Manual, Híbrido ou Reverso.
- R110 é a linha de integração mais recente identificada, enquanto o UltraFast certificado permanece no histórico de pesquisa; não confundir testes com conexões reais e não anunciar lucro.
- O conjunto de módulos históricos copiados neste PR é byte-identical aos blobs do branch `research/jenios-robot-block-a-r51-r55-final-ultrafast-20261023`; nenhuma regra existente foi reescrita.
- Nenhuma chave, conta, ordem real, ordem Paper externa, migração, feature flag de negociação ou deploy foi criada.

## Bloco 1 — inteligência e leitura de mercado

Arquivo: `lib/platform/research/ultrafast-v2-intelligence.mjs`.

1. Detector de volatilidade e ranking de oportunidades: scanner puro com liquidez, spread, custo, preenchimento e frescor de dados.
2. Scalping adaptativo: sugestão de alvo/stop baseada em volatilidade, taxa e edge estimado, sempre sujeita a amostra prospectiva independente.
3. Seleção inteligente de pares: ordenação por score e abstenção quando a oportunidade é ruim.
4. Painel de oportunidades: estrutura de dados fornecida no Bloco 3.
5. Regimes: RANGE, UPTREND, DOWNTREND, BREAKOUT, HIGH_VOLATILITY por heurística transparente.
6. Order Flow: agressão compradora/vendedora e desequilíbrio da profundidade do book.
7. Correlação: comparação de retornos alinhados, detectando concentração de risco.
8. Anti-manipulação: filtros de risco de spread, liquidez e movimentos atípicos; não afirmam comprovar wash trading.

## Bloco 2 — execução e proteção

Arquivo: `lib/platform/research/ultrafast-v2-execution.mjs`.

9. Planner maker/taker: custos, probabilidade de fill, fila, latência, slippage e posição econômica estimada. Não envia ordens.
10. Qualidade do feed: stale, sequência duplicada ou retrocedida, gaps, manutenção e indisponibilidade. Não estabelece conexão WebSocket por si só.
11. Gestão de capital: limite por operação, sessão, dia, exposição geral e exposição correlacionada.
12. Registro de observações de ordens: eventos idempotentes, preenchimento parcial, cancelamento confirmado, estado inconsistente com reconciliação manual. Sem alegar status externo.

## Bloco 3 — shadow, evolução e acompanhamento

Arquivos: `lib/platform/research/ultrafast-v2-shadow.mjs`, `ultrafast-v2-pipeline.mjs` e `ultrafast-v2-certified-bridge.mjs`.

13. Shadow trading: replay temporal sobre cotações fornecidas; sinal em t gera hipótese somente em t+1, custos de ida/volta, stop, alvo, perda e encerramento de amostra. Não reproduz book completo, latência real ou market impact.
14. Qualidade e lucro líquido: PnL **hipotético**, taxa de acerto, fator lucro, custos e drawdown, sem confundí-los com resultado de corretora.
15. Parâmetros adaptativos supervisionados: compara candidato e baseline em amostras prospectivas com holdout e aprovação; **nunca promove parâmetros automaticamente**.
16. Integração de exchanges: contrato de capacidade read-only, gates de homologação e checklist externo; live sempre false.

A ponte `ultrafast-v2-certified-bridge.mjs` reutiliza os gates originais R18, R23, R28 e R53, sem substituir os modelos certificados. A nova pipeline veta oportunidades mesmo quando o novo score é favorável caso qualquer gate legado reprovar.

Nota: os 4 itens originais e as 10 evoluções adicionais estão cobertos funcionalmente no laboratório offline. Os itens com execução real, WebSocket de produção, autenticação financeira, homologaçao Paper externa, UI conectada e mercado prospectivo ainda dependem de implementação operacional separada e evidência externa. Não declarar que foram concluídos neste pacote.

## Critérios de aceite desta etapa

- `node --test tests/platformUltraV2*.test.mjs` e `node scripts/platform/research/r111-ultra-v2-smoke.mjs` aprovados.
- CI direcionada nos arquivos deste pacote e nos testes históricos selecionados.
- Nenhuma alteração em `app/api/platform/` que permita enviar ou cancelar ordens; motores antigos intactos.
- Bloqueios de execução externa e promoção automática conservados; risco de perda financeira permanece.
- Backups e hashes por arquivo salvos na Library JENIOS e commits da branch; PR draft para revisão.

## Próximas dependências para operação real — NÃO ENTREGUES

1. Confirmar exchanges selecionadas e obter fonte WebSocket pública confiável; sincronizar trades/book/ticker, detectar reconnect e gaps por exchange.
2. Identidade, consentimento e permissões de cada cliente com chaves sob cofre seguro; homologação Paper externa e diário durável.
3. Concluir transporte de ordens, preenchimentos, proteção no provedor, cancelamento, reconciliação após reinício e kill switch confirmado externamente.
4. Validação prospectiva fora de amostra, evidência estatística, custos reais, restrições regulatórias e autorização explícita independente para cada etapa financeira.