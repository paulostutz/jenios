# R71 — evolução privada limitada: trabalho em progresso

Base certificada: R70, commit `851804aa45ac8cee2aea4fe9096712a7aeff2048`, CI `40129546998` concluída com sucesso. O backup R70, checkpoint, ledger e CI foram consultados antes das alterações.

Este registro intermediário **não é uma certificação R71**. A implementação e a aceitação integrada estão em andamento na branch `research/jenios-robot-r71-private-evolution-20261024`; o backup de progresso é separado do futuro backup certificado.

## Lacuna concreta e alteração permitida

O `chooseMode` do core privado original já recebe `positionOpen`; o serviço histórico analisado não encaminha esse contexto. R71 acrescenta uma política externa versionada que encaminha o contexto sintético para Híbrido e Reverso. Os bytes proprietários, sua versão histórica e os registros nativos R67 ficam intactos. Manual, posição fechada e pausa devem conservar a decisão original.

Política: `HONOR_EXISTING_POSITION_CONTEXT_FOR_ASSISTED`, `forwardPositionOpen: false → true`, uma promoção por histórico, comparação prospectiva de oito casos fixos, zero mudanças nos casos protegidos e redução estrita dos casos sem encaminhamento de posição aberta. Rejeição ou rollback retira a candidata daquele histórico. A geração cresce na aplicação e no rollback.

## Trabalho implementado e verificação pendente

- Admissão atômica R67 + anotação assinada R71; sem enriquecer registros antigos sem contexto.
- Estudo completo paginado sobre associação congelada no PostgreSQL, com digest de membros e reconstituição de métricas.
- Estado durável com revisão/digest esperados, comparação registrada antes da janela, casos admitidos durante a janela real do banco e rollback auditável.
- Fonte privada, fila durável e consulta autenticada da versão externa; sem restaurar ou alegar restauração do histórico interno do runtime.
- Painel Platform autenticado separado do ciclo UltraFast R65; HTML anônimo sem dados administrativos.
- Contrato fechado de hipótese preparado, com alternativa determinística; geração paga desativada.

Os testes unitários iniciais de estudo, estado, worker e trava de deploy passaram. O primeiro ensaio local original confirmou o comportamento da política e rollback com estado explicitamente modelado. A aceitação conjunta PostgreSQL/HTTP/navegador, a CI e o fechamento ainda estão pendentes; esses ensaios iniciais não substituem a certificação final.

## Limites permanentes

Sem merge, deploy, migração hospedada, ordens reais, Paper externo, chamada paga a provedor ou monitoramento de clientes. Evidências públicas de CI são fixtures de protocolo explícitas. Execução local original com entradas sintéticas é evidência separada; nenhuma delas certifica PnL, corretora, identidade administrativa hospedada ou atestação independente do host.

R65 UltraFast 750→500 ms permanece uma política distinta. R61 Híbrido/Reverso e seus guards não são reatribuídos ao core privado histórico. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` continuam `null`.

O inventário somente leitura do ambiente ainda não comprova configuração hospedada completa ou um host operacional privado. Não foi identificado motivo para reconstruir o motor proprietário.
