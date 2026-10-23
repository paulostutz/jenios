# JENIOS ROBOT-R3 — Auditoria descritiva prospectiva em blocos UTC (21/10/2026)

## Continuidade e isolamento
- Base ROBOT-R1/R2 `de5a3e8460fc917a4230774999ccd1a3eb2850b2`, CI 39698428627 SUCCESS, 1.715 testes gerais e 114 contratos aprovados.
- Branch **exclusiva de pesquisa**, sem alteração dos módulos operacionais, `fix/jenios-robot-r3-prospective-statistical-audit-20261021`.
- Backup anterior preservado: `backup/jenios-robot-r3-pre-prospective-de5a3e84-20261021`.
- B303 de homologação comercial em outra branch **não foi editado**. CHEFE, LETTER, Social, PAY e produção B177-R3 preservados.
- A execução da CI opera somente sobre fixtures sem rede, corretora, Paper, dinheiro ou provedor pago.

## O que faz a nova camada ROBOT-R3
- Reutiliza o validador estrito **B287/B288** para sinais congelados antes da abertura e preço OHLCV observado depois de fechamento + cinco minutos. Se houver manipulação do hash, timestamp, preço, modalidade ou retorno externo falsamente declarado, o lote falha.
- Reavalia **somente a matriz conservadora predefinida 30 bps de custo ida-volta e 30 bps de slippage adverso de stop**, com stop hipotético de 1%, sem ajustar parâmetros históricos.
- Agrupa pares de três modalidades por ativo/hora; três ativos no mesmo horário contam como **uma única hora UTC**, impedindo inflar a amostra.
- Abstenções do Híbrido têm exposição=0 e continuam no denominador da comparação pareada; resultados de ativos são igualmente ponderados dentro da hora. Cada dia UTC recebe peso igual no bootstrap.
- Faz **1024 reamostragens determinísticas por dia** com semente pública fixa, para três comparações pré-definidas: Híbrido−Manual, Reverso−Manual e Reverso−Híbrido. Intervalos de percentis recebem ajuste conservador Bonferroni, `familyWiseAlpha=0.05` para três comparações. Sem `p-value` autorizado, sem ajuste seletivo ou escolha da melhor série.
- Relata variação dos resultados após exclusão de um dia, dias favoráveis/desfavoráveis, exposição/abstenção e médias descritivas. Isso não certifica independência entre dias ou causalidade.
- Reutiliza parâmetros descritivos B280: 30 dias UTC e 300 horas distintas. **Não equivale ao gate completo B280**, porque exige ao menos 100 observações por ativo/hipótese/modalidade, carimbo temporal independente, segunda fonte de preço e validação de fills e custos com o broker.

## Limitações incontornáveis
Todos os preços e sinais usados pelos testes são fabricados ou fornecidos pelo chamador e explicitamente não assinados. O bootstrap diário não elimina dependência entre dias, influência de notícias, selection bias, manipulação ex post, slippage de ordem, margem, custos de short/funding, latência ou falta de execução possível.
- `statisticalAdvantageCertified=false` e `commercialPerformanceClaimAllowed=false`, mesmo que o intervalo descritivo esteja acima de zero.
- `actualLossesAvoided=null`, `realizedBrokerPnl=null`, sem rentabilidade, lossômetro real ou execução atestada.
- Não adicionar promessas de resultado em LP, Social ou Universidade.
- Nenhuma regra proprietária é alterada e nenhuma ordem real/Paper externa está autorizada.

## Evidência e rollback
A CI ROBOT-R3 deve executar testes adversariais R1/R2, novos cenários de cobertura/calendário, suites B280/B287/B288 e `npm run build`; criar backup certificado após o resultado SUCCESS.
Não há deploy de Preview nem alteração de produção. Rollback privado até a base R1/R2 preservada.
