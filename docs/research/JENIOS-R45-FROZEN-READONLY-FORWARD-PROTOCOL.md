# JENIOS R45 — PROTOCOLO CONGELADO ANTES DE NOVAS CAPTURAS

**Escopo:** pesquisa pública de coleta prospectiva sem motor privado e SEM habilitar dinheiro real. O carimbo temporal do commit GitHub anterior ao workflow comprova que esta coleta se iniciou após o registro de critérios.

**Fonte alternativa lícita:** documentação Kraken Futures Public Book WebSocket `wss://futures.kraken.com/ws/v1`, feed `book`, produto documentado `PI_XBTUSD`. Capturar SOMENTE `book_snapshot`; não assinar feeds privados e jamais acessar, enviar ou cadastrar chaves. O feed poderá ser indisponível, inválido ou restrito; nesse caso preservar falha e terminar sem cotações.

**Amostra:** duas conexões públicas de leitura, com 65 segundos NOMINAIS de separação após a primeira captura, sem reotimização, reconsulta oportunista ou execução. Esperar timestamp UTC do provedor, sequência, bids/asks e SHA256 dos bytes da mensagem; rejeitar datas futuras, atraso acima de 30s e cruzamento de book. Se qualquer captura falhar, `coverageComplete=false` e desempenho prospectivo NÃO MEDIDO.

**Não comparar contratos indevidamente:** `PI_XBTUSD` é produto distinto, de estrutura inversa/contrato próprio. NÃO converter suas quantidades para retornos dos contratos `BTCUSDT` USD-M Binance, não inferir custo em USD nem usar marks de uma venue para liquidar na outra. Toda fotografia será apenas evidência da infraestrutura.

**Critérios prospectivos:** pré-registro não altera `scanSignals`, `chooseMode`, `replayTrade`, custos históricos, R41-R44 nem o modelo; as intenções são inexistentes ou artificiais. Sem demonstração de vantagem, sem fills, sem decisão real de clientes, sem prova de perda evitada. Qualquer filtro de risco testado com fixtures permanece teste de engenharia, não comprovante financeiro.

**Risco, controles e gate:** sem ordens, sem deposits, sem chave, sem API de trade, sem merge, sem deploy, sem emissão de promessa de lucro ou operação. `releaseGate=NO_GO` mesmo que duas cotações válidas sejam obtidas. Bloqueio HTTP 451 Binance não pode ser contornado com proxy/VPN e é registrado separadamente.

**Evidência requerida:** registrar sha do commit de protocolo, sha do workflow, run id e arquivos originais de observação apenas após captura; produzir manifesto de erros se falhar; `externalClockAttestation=false`. Não incluir dados pessoais ou códigos proprietários neste repositório público.
