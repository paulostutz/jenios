# JENIOS ROBOT-R1 — Validação adversarial offline, 21/10/2026

Escopo **apenas os robôs Manual, Híbrido e Reverso**. Não altera CHEFE, LETTER, Social, PAY, Banco Inter, Universidade ou o trabalho B303 em outro chat.

## Retomada certificada
- Base: B301 pesquisa privada, commit \`b1956cab6aa4e9bcac26a9f57688e279e3b9c691\`, CI 39693360965 SUCCESS.
- Branch exclusiva: \`fix/jenios-robot-r1-adversarial-qa-20261021\`.
- Backup anterior: \`backup/jenios-robot-r1-b301-certified-before-tests-20261021\`.
- R39 histórico foi consultado, mas não mesclado: 334 testes do núcleo privado, 38 cenários **inteiramente sintéticos**, sem vantagem comercial comprovada.
- Dossiê B279/B281: amostra retrospectiva e primeira observação prospectiva com resultados líquidos negativos sob custos conservadores. Não otimizar parâmetros contra resultados já vistos.

## Refinamentos de pesquisa, sem reescrever o motor
1. \`reviewR1ManualSignalWindow\`: reusa \`B290\` e veta crédito por entrega atrasada, não observada, fictícia, abstida ou com cronologia violada. Timestamp declarado nunca vira recibo independente nem lucro de usuário.
2. \`reviewR1HybridSafety\`: reusa contexto B291; adiciona rejeição de informação stale, posição existente, pausa e liquidez incerta, baixa ou mercado suspenso. Descreve contexto sem gerar preço, tamanho, entrada, stop ou ordem. Operador continua decidindo.
3. \`reviewR1ReverseEligibility\`: reusa inversão/regras de megatendência B290, mas impede referência de novo short Spot e solicita leitura de funding/borrow, spread, dados recentes, pausa, posição e consentimento declarado para qualquer proposta **hipotética**. Encerramento/cancelamento permanecem pass-through, sem abrir exposição. Nem um check verde representa autorização da corretora.
4. \`reviewR1PairedLossAttribution\`: separa perdas hipotéticas integralmente evitadas, parcialmente reduzidas ou agravadas, novas perdas criadas, ganhos sacrificados e ganhos reduzidos. Não permite usar dados de corretora como se fossem a fixture. Resultados \`actualLossesAvoided\` e \`actualBrokerRealizedPnl\` permanecem sempre \`null\`.
5. Mantidos B152 fixed-point risk, B280 gates 30 dias / 300 horas / 100 observações por coorte, B288 fricções e B301 consentimento/replay, todos sem alterações.

## Segurança e limites
- A camada R1 é APENAS validação de hipóteses offline, nunca conectada ao runtime de ordens. Não adiciona endpoints, chaves, servidor, database ou módulos com side effect.
- \`vercel.json\` bloqueia deploy automático da branch ROBOT-R1 sem afrouxar os bloqueios B297–B301.
- Nenhum motor privado foi exposto ao GitHub, Vercel ou CI. Entradas originais e indicadores de escolha do usuário permanecem intocados.
- Não houve Paper externo, ordem, cobrança, Pix, IA paga nem qualquer informação financeira com status de P&L real.
- A base pré-fixada R39 e os dados B279/B281 continuam evidências de limitações, não autorização para alterar regras em busca de performance.

## Critério do bloco
- Executar novos testes R1 com fixtures sintéticas e regressões B288/B289/B290/B291/B300/B301, depois suite geral Next e S05.
- Confirmar SHA, CI, rollback/backup, zero deployment da branch e produção B177-R3 preservada.
- A conclusão desse bloco é **QA de validação estática/adversarial**; não comprovação de lucratividade ou integração operacional.
