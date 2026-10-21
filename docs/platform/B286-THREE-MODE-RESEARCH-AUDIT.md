# JENIOS B286 — Auditoria comparativa (sem execução)

Base B285 `7aefd877d78a7eb0c4899a582e62206653990f3d`, CI `39646660619` aprovada. Branch isolada de homologação. B281, B280 e núcleos proprietários preservados. Nenhum deploy.

Auditoria independente dos registros B279 e B281, sem nova coleta e sem simular ordens. Foram aprovadas **133/133 verificações locais** de integridade, cobertura 162/162, monotonicidade de custo e slippage, e ausência de ordens. São verificações de invariantes de relatórios, NÃO 133 novas operações nem certificação dos robôs privados.

## Resultado B279: matrizes matemáticas retrospectivas, estresse 30/30 bps

| Proxy de pesquisa | Decisões hipotéticas | Acertos | Taxa de acerto | Resultado líquido agregado (R) |
|---|---:|---:|---:|---:|
| Direto (não equivale ao Manual de sinais) | 1018 | 176 | 17,289% | -332,0796 |
| Híbrido | 629 | 125 | 19,873% | -212,9869 |
| Reverso | 1018 | 198 | 19,450% | -294,6494 |

Esses números somam seis células ativo/hipótese por modo, com janelas coincidentes; não representam operações independentes de contas reais nem retorno percentual do capital. O modelo híbrido tem menor exposição, mas não comprova perdas neutralizadas: para isso é necessária correspondência evento a evento de sinais aceitos/rejeitados e contrafactual pré-registrado.

## B281

O primeiro candle prospectivo registrou 162 cenários de pesquisa; estresse 30/30 bps: 0 positivos, 15 negativos e 3 abstenções. Uma única hora não demonstra vantagem nem eficácia dos robôs proprietários.

## Refinamentos propostos, NÃO implantados

1. Manual: registrar sinal gerado, timestamp, preço de referência, direção, invalidação e resultado no candle seguinte; distinguir sinal de execução.
2. Híbrido: medir sinais filtrados, perdas evitadas e ganhos descartados no mesmo período, sem olhar o resultado antes de congelar o filtro.
3. Reverso: separar regimes de tendência e lateralização, com proteção de stop e custo de financiamento antes de considerar operações vendidas.
4. Testar custo 0/10/30 bps, slippage 0/10/30 bps, gaps, spreads, latência, indisponibilidade e fonte duplicada.
5. Validação prospectiva mínima: 30 dias, 300 horas e 100 observações úteis por coorte; fontes independentes e controle de multiplicidade.

**Gate:** nenhuma melhoria operacional, promoção comercial de performance, execução real/Paper ou deploy autorizado. O próximo bloco deve medir sinais do núcleo proprietário em ambiente controlado e registrar dados futuros antes do resultado; somente depois considerar refinamento aprovado.
