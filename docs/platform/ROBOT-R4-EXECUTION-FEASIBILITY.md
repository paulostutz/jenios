# JENIOS ROBOT-R4 — Research: execução hipotética, custos e liquidez

**Data:** 21/10/2026 (Bahia); escopo **somente robôs Manual, Híbrido e Reverso**.
**Base:** ROBOT-R3 \`9a872076d3ed4d19229b81bc5cbe2596ac0eabe5\`, CI 39701745821 SUCCESS.
**Branch privada:** \`fix/jenios-robot-r4-execution-feasibility-20261021\`.
**Backup inicial:** \`backup/jenios-robot-r4-pre-feasibility-9a872076-20261021\`.

## Objetivo e método

Criada \`lib/platform/research/robot-r4-execution-feasibility.mjs\`, camada de laboratório sem qualquer ligação de rede, corretora, sinal real, livro de risco ativo ou motor proprietário.

Ela exige sinal sintético congelado antes do início do candle, candle completo depois de cinco minutos, carimbo externo **não alegado**, OHLCV íntegro e estado da corretora tratado como **declarado, não certificado**. Exame de cada hipótese:
- Gap de abertura adverso, spread, profundidade e liquidez hipotética insuficiente.
- Dados de contrato obsoletos, sinal cedo/atrasado, mercado interrompido ou operador pausado.
- Posição já aberta ou preenchimento parcial sem reconciliação: **não atribuir P&L**.
- Short Spot bloqueado, short margem/perpétuo exige empréstimo declarado e funding de referência; declaração não é permissão da corretora.
- Reverso utiliza B290 e R1 já implementados, preservando exceções de megatendência; Manual/Híbrido nunca invertem.
- Stop de 1% e referências de custos do B288 sem reotimização; retorna \`netRHypothetical\` apenas quando condições declaradas não são contraditórias.
- Simulações de bandas de custo, parada adversa e três modalidades exigem mesmo candle e fricções; pontuações ficam nulas para pares onde uma modalidade é inviável.

**Não existe sinal de execução no output.** Qualquer número é em unidades R hipotéticas e o modelo não inclui sequência intrabar validada, ordem executável, contrapartes, spreads reais, liquidez, funding efetivo, garantia de stop ou resultado cliente. Não deriva ganho real de sinal ou diferença de modelo. Os filtros de viabilidade são parâmetros do **laboratório**, jamais limites prontos de uma ordem real.

## Critério de QA
- Testes unitários de safe-fail, monotonicidade de custos, conteúdo adversarial e cenário combinatório.
- Regressões ROBOT-R1/R2/R3, B152/B280/B288 e build Next.js, CI privada de execução e pagamentos desligados.
- Backup certificado somente após CI SUCCESS. Nunca promover a produção nem alterar B303, CHEFE ou LETTER.

## Limitações e continuidade
B280 exige 30 dias prospectivos, 300 horários distintos, 100 observações por ativo/hipótese/modo, mercado/tempo com fonte independente, fricções verificadas e evidência de fills; R4 não comprova nenhum desses requisitos externos.

Amostras B279/B281 de pesquisa tiveram resultados líquidos negativos sob custos conservadores. Não recalibrar regras usando esses resultados; novos parâmetros exigem protocolo ex ante independente.

**Status mínimo da R4:** contrato e adversarial offline testados, **NO-GO para performance e execução operacional**.
