# R61 — Roteiro de aceite do console sintético

## Como usar este roteiro

Este documento complementa o registro histórico R60. A rota `/platform/homologacao/robos` só existe sob o gate completo de QA descrito em `ROBOT_R61_QA_POLICY_INTEGRATION.md`. Não foi publicada em produção. A CI utiliza uma instalação local temporária em loopback; um teste manual futuro deve usar uma cópia de QA com os mesmos bloqueios e sem credenciais de corretora.

Todos os valores são fictícios. Uma decisão permitida não envia ordens. Alterar os parâmetros invalida a decisão anterior; recarregar descarta os resultados. O plano selecionado serve como entrada de fixture e não concede acesso a nenhuma conta.

## Casos de aceitação

| Caso | Ação na tela | Resultado esperado |
|---|---|---|
| Manual com pressão | Selecionar Manual, perdas consecutivas 4, drawdown 6 R e confiança 0,50; avaliar. | Alertas de revisão/risco/baixa confiança, sem mudar modo nem executar operação. |
| Manual calmo | Usar perdas 0, drawdown 0 e confiança 0,85. | Controle preservado; nenhum alerta de risco inventado. |
| Híbrido alinhado | Operador compra, contexto compra, confiança 0,85. | Mantém a decisão do operador. |
| Híbrido em desacordo | Operador compra, contexto venda, confiança 0,65 ou maior. | Orienta revisão; continua Híbrido e não executa inversão. |
| Híbrido com baixa confiança | Mesmo desacordo, confiança 0,60. | Não intervém. |
| Reverso seletivo | Operador compra, contexto venda, confiança 0,85, sem megatendência. | Referência de venda; losseshômetro identificado como hipotético em R. |
| Reverso protegido | Repetir com megatendência, confiança baixa ou contexto alinhado. | Mantém intenção; não aplica inversão cega. |
| Invalidação de entrada | Após um resultado, alterar qualquer parâmetro assistido. | Resultado anterior desaparece até nova avaliação. |
| UltraFast inicial | Plano simulado Global Crypto, BTC/USD, capital 1.000, alavancagem 2; iniciar. | Dois snapshots sintéticos avaliados; somente decisão sintética pode ser permitida. |
| Pausa/retomada | Pausar, retomar e aplicar dois eventos normais. | Pausa bloqueia; retomada permanece bloqueada até a segunda confirmação. |
| Choques e recuperação | Aplicar book vencido, custo alto, manutenção, exposição desconhecida ou falta de entitlement, um por vez. | Bloqueio imediato; dois eventos normais novos para recuperar. |
| Halt de risco | Aplicar limite de risco. | `HALTED`; retomar/aplicar evento desabilitados. Nova avaliação requer nova sessão. |
| Novo identificador | Após halt, iniciar novamente. | Outra sessão, sem reutilizar a autorização anterior. |
| Plano sem UltraFast | Alterar plano para Nacional e iniciar. | Decisão bloqueada por entitlement simulado. |
| Parâmetros UltraFast | Alterar plano, ativo, capital ou alavancagem depois de iniciar. | Sessão anterior invalidada. Capital inválido impede início. |
| Responsividade | Repetir em viewport móvel. | Controles utilizáveis e ausência de overflow horizontal. |
| Recarga | Recarregar depois das avaliações. | Resultados descartados; não há persistência de conta. |
| Gate negativo | Solicitar diretamente a rota com flag ausente, ambiente production ou transporte habilitado. | Acesso negado; console não exposto. |

## Registro dos resultados

Estado automatizado inicial: **PENDENTE DA CI**. Os resultados observados serão registrados no checkpoint R61, no ledger e no artefato da execução. Casos automatizados não contam como aceite manual do proprietário.

Aceite manual do usuário: **NOT_EXECUTED**. Para cada observação futura, registrar commit, data, ambiente de QA, caso, parâmetros e comportamento visto. Não inserir resultado real em registro sintético nem preencher retroativamente R15.

## O que não foi testado aqui

Este roteiro não demonstra login de corretora, permissão real de plano, feed real, saldo, envio ou cancelamento de ordens, fills, slippage observado, lucro, perda evitada ou acurácia real. Os três campos de resultado real permanecem nulos. A passagem para qualquer sessão externa exige outra autorização e evidência própria.
