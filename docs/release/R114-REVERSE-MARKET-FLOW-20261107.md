# R114 — contexto de grandes transferências no Reverso existente

O Reverso existente passa a avaliar o fluxo de negócios antes de manter uma entrada de pesquisa em BTC/USDT Spot na Binance. Uma transferência de Bitcoin não define direção: ela somente aumenta a cautela quando três janelas de negócios e preços confirmam pressão contrária à direção final do núcleo. O Ultra existente recebe a mesma avaliação para comparação, sem alterar sua elegibilidade ou abrir ordens.

## Origem e preservação

- Base pública: `bcf678c7ce6644e078fbd9bd0c159c69199fe033`, branch de produção `release/jenios-genios-g44-20261024`; inclui R113 e assinatura Kivoryn.
- Não usar `main` ou R108 como base do Ultra atual.
- Núcleo privado original: SHA-256 `9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea`.
- Serviço privado original: SHA-256 `cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be`.
- Ambos permanecem byte-idênticos. O refinamento ocorre no runtime existente, depois da decisão original. Seus bytes e credenciais não são publicados neste repositório.
- Monitor `lib/whale-transfers.mjs`, modos Manual/Híbrido, stops, limites, guardas históricas R18/R23/R28/R53 e ciclo sintético R74 preservados.

## Integração

`market-flow-provider.mjs` reutiliza o monitor de grandes transferências e consulta somente a API pública de negócios agregados da Binance. Usa URLs fixas, GET, leitura limitada em bytes, timeout, limite de 12 páginas, reconciliação de IDs, cache e coalescência de consultas. Nenhuma credencial de corretora, assinatura de ordem ou serviço pago.

`market-flow-context.mjs` produz três janelas de 20 segundos. IDs repetidos, fora de ordem, lacunas, respostas truncadas, janela insuficiente e timestamps inválidos não formam contexto utilizável. Observações futuras, coleta atrasada e último negócio antigo são rejeitados. Não confundir a hora da consulta com a hora do negócio. Valores negociados são nocionais em USDT; não pressupõem conversão USD.

Política experimental fixa `R114_FLOW_V1`: pelo menos três negócios e 5.000 USDT por janela, contexto com idade máxima de 5 segundos, movimento de preço contrário de pelo menos 2 bps em todas as janelas. O desequilíbrio contrário exige 0,85 normalmente ou 0,60 quando a cobertura existente confirma transferência grande recente. Estes valores são hipóteses de engenharia; NÃO são parâmetros rentáveis demonstrados. A identidade do investidor, intenção da transferência, causalidade e ausência de reorg não são certificadas.

O filtro recebe a **direção final** do Reverso, preserva recusas e exceções de tendência e nunca inverte novamente, cria entrada, aumenta lote, alarga stop ou impede fechamento/cancelamento. Em BTC suportado, dados insuficientes suspendem a nova entrada de pesquisa. Outros pares, venues e futuros não recebem este sinal. BTC/USD Kraken não equivale a BTC/USDT Binance.

Na integração privada, a ação autenticada `observe_reverse` do runtime R74 chama o serviço original com candles públicos e aplica o filtro ao resultado. A ação `cycle` continua sintética e sem rede. A nova ação é uma observação sob demanda: não é transmissão de ordens, monitoramento agendado nem conexão a conta real.

No Ultra, `ultrafast-v2-pipeline.mjs` recebe `flowContext` já calculado, aplica apenas inspeção síncrona e retorna `marketFlow.enforcement=OBSERVE_ONLY`. Não faz consultas externas no instante da decisão nem muda os gates existentes. A consulta administrativa existente mostra o contexto público; não o mistura com os cenários sintéticos nem com o ticker Kraken.

## Verificação e avaliação econômica

- 68 testes públicos direcionados R111/R112/R113/R114 aprovados localmente antes da regressão completa.
- Quatro testes privados usam o núcleo/serviço originais, incluindo recusa de autenticação, preservação de hashes, exceção de tendência e caminho integrado do handler com HTTP sintético.
- Benchmark mede somente custo local de inspeção de contexto; não representa latência externa, carga de produção ou resultado financeiro.
- Consulta pública deste ambiente expirou e foi classificada indisponível. Isso valida o bloqueio, não certifica disponibilidade da fonte no host publicado.
- Não existem resultados prospectivos suficientes para afirmar aumento de lucro, redução de perdas ou vantagem incremental do Ultra.
- Critério para eventual ativação no Ultra: comparar motor atual, motor + fluxo de mercado e motor + fluxo + transferências nas mesmas oportunidades, com dados disponíveis à época, custos, atrasos, operações bloqueadas e drawdown. Reutilizar a validação temporal R112; não promover parâmetros automaticamente.

## Publicação e rollback

O estado final de CI/deploy é registrado no checkpoint privado após execução; este documento descreve o código, não antecipa o sucesso de implantação. Publicar apenas os arquivos públicos explicitamente incluídos no inventário R114. O núcleo privado continua no armazenamento privado existente.

Rollback público: reverter o commit R114, preservando os inventários anteriores. Rollback Edge: republicar os dois arquivos da versão anterior preservada no checkpoint. Não modificar tabelas, assets, identidade, chaves ou configurações financeiras para reverter o filtro.

## Fontes técnicas

- Binance aggTrades: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
- Fonte pública de mercado: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/general-api-information
- Supabase autenticação: https://supabase.com/docs/guides/functions/auth-headers
