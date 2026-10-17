# JENIOS PLATFORM — CHECKPOINT DOCUMENTAL R40.1 / R41

**Data:** 16/10/2026 (America/Bahia). **Tipo:** registro público mínimo, sem código proprietário.

## Continuidade e integridade
- Base: `checkpoints/jenios-r40-dados-historicos-robos`, SHA `5c7e9fe35f0b71b1958111b3a66d3689e5033f76`.
- `main` no momento da auditoria: `8d9aa4b4a5eefa87ecb64abb65a4d83ba87cdd10`. Sem merge, deploy ou mudanças de produção.
- Arquivo privado anterior: `JENIOS-Platform-R40-completo-privado.zip`, SHA-256 `56af06d62854c958655a78ad54b02fe16c47037ebd109529c5872ac48314029d`.
- Pacote **privado cumulativo** gerado: `JENIOS-Platform-R40-1-R41-VALIDACAO-PRIVADA.zip`, 55.994.365 bytes, SHA-256 `0003a2c0ecd066725fda232cf32e0515f4493b9b5bf80c28f28774652e521858`.
- Todos os 870 arquivos originais R40 confirmados byte a byte; novo pacote com 1.090 entradas CRC/SHA-256 verificadas. Não inserir ZIP privado no repositório público.

## Dados e QA
- R40: 78.768 candles históricos em spot e futuros USD-M, 1h, conforme 108 arquivos mensais oficiais e seus checksums.
- R41: 427.752 candles históricos adicionais USD-M perpétuos BTC, ETH, SOL, 1h e 5m, 2025-07 a 2026-09, conferidos com 90 arquivos mensais oficiais e seus checksums. Coleta GitHub Actions: https://github.com/paulostutz/jenios/actions/runs/38982014766.
- Total misto dos dois estudos: 506.520 candles em mercados e frequências diferentes (não equivale a trades).
- Núcleo privado preservado; **466/466 testes locais offline passaram** (418 existentes + 48 novos).
- Reprodução integral dos testes da aplicação nesta máquina limitada pela ausência de dependências. Não afirmar novo QA integral da aplicação.

## Resultado rigoroso
- Pesquisa R41 5m teve P&L contrafactual absoluto negativo nos modos de direção-base e inversão simples sob os custos prefixados. **Não operar** supera ambos neste cenário. A diferença entre modos sobre intenções fictícias não constitui lucro real, demonstração de alfa ou perdas reais evitadas.
- O estudo R41 é retrospectivo; pré-registro antes do download não torna a série historicamente passada genuinamente prospectiva.
- Custos de livro/spread, funding, margem, liquidação e fills de corretora continuam sem comprovação operacional.

**Gate:** `financialEdgeVerified=false`, `actualClientLossAvoidedVerified=false`, `realTradingEnabled=false`, `productionModified=false`, `merge=false`, `deployment=false`, `releaseGate=NO_GO`.

Somente o texto foi adicionado nesta branch; código proprietário, arquivos de pesquisa privados e dados internos permanecem fora do repositório. **Nenhum conteúdo LETTER.**
