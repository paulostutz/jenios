# JENIOS — ROBOT-R14 — Checkpoint pré-janela prospectiva

Data: 22/10/2026 UTC. Escopo exclusivo: pesquisa read-only dos robôs Manual, Híbrido e Reverso; sem ordens, Paper externo, merge ou deploy.

## Base
- ROBOT-R13 certificado: commit `24d0adc7fb75d2f23cbc95a257542943908c8915`.
- Branch R14: `research/jenios-robot-r14-evidence-20261022`.
- Deploy Vercel da branch R14: desabilitado.
- Núcleo privado original conferido diretamente no backup consolidado R45-B52:
  - engine.mjs SHA-256 `9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea`
  - service.mjs SHA-256 `cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be`

## Protocolo prospectivo
- Estudo: `R14-20261022-1900UTC-BTCUSD-ORIGINAL-CORE`
- Ativo: BTC-USD
- Janela-alvo: 22/10/2026 19:00–20:00 UTC
- Observação de resultado: somente após 20:10 UTC
- Protocolo local SHA-256: `d6cc627ba3ab2de4e9969d8d23557d854d76e4c5af6dfcdb447d7803fc1068c7`
- Hash do protocolo publicado no GitHub no commit `163be677280c6fab5cb13aa4dc8f3cb34dbe24bb` às `2026-10-22T17:43:01Z`, portanto antes da janela.
- O commit público contém somente o digest, não decisões privadas.

## Validador offline R14
- 3/3 testes locais PASS.
- Rejeita registro tardio, alteração dos hashes do núcleo, qualquer ordem/Paper, matriz incompleta/duplicada e tentativa de preencher resultado antes do fechamento.
- Não permite converter ausência de evidência em P&L, losses evitados ou taxa de acerto.

## Limitação atual
A coleta pública fresca do contexto de mercado e o registro privado das seis decisões originais ainda não foram executados. O conector GitHub recusou a criação do workflow de captura quando o conteúdo incluía o protocolo completo de pesquisa; o bloqueio não foi contornado. Nenhum resultado de mercado foi inventado ou reaproveitado de R9.

## Estado
`PREWINDOW_PROTOCOL_PUBLICLY_TIMESTAMPED / PRIVATE_DECISIONS_PENDING_FRESH_CONTEXT`

Nenhuma rentabilidade, taxa de acerto ou perda evitada está certificada neste checkpoint.
