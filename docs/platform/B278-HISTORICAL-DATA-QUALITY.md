# JENIOS B278 — Dados históricos públicos para pesquisa, sem robôs
Data: 21/10/2026. Base B277: `485d7f78ba10b5a4b7a17f400c58cb0eac79c6d2`, CI `39611416684` aprovada.

## Escopo desenvolvido
Preparada captura **somente GET** de candles horários H1 na **Coinbase Exchange Spot pública**, para BTC-USD, ETH-USD e SOL-USD; não exige API de corretora do cliente, token, conta, carteira nem assinatura. A página, universidade, Gênio/Gênia, Social, JENIOS PAY, BankScore, Validador e todos os motores proprietários continuam intactos.

### Identidade de mercado sem equivalência implícita
`BTC-USD`, `ETH-USD` e `SOL-USD` têm **moeda de cotação USD**. Os nomes `BTCUSDT`, `ETHUSDT`, `SOLUSDT` usados em hipóteses anteriores representam mercados em USDT, não USD. Não há autorização de usar esses dados diretamente no motor USDT, ajustar spreads, calcular rentabilidade nem conectar ordens. Sem um protocolo independente de conversão/compatibilidade, `canMapToUsdtRobot=false`.

### Janela e paginação
Cada par: 960 candles de 1 hora, equivalente a 40 dias. Cinco janelas de até 200 candles, no máximo 200 por solicitação, abaixo do limite público de 300. Fim da amostra ao menos 2 horas antes da captura; apenas barras completamente fechadas, datas e horários UTC. Intervalo determinístico de 650 ms entre GETs; sem repetição de requisições falhas nem acesso a endpoints privados.

Referência técnica: [Coinbase Exchange, histórico público](https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles); documentação e FAQ da Coinbase indicam limite de 300 candles por solicitação e informam que a série histórica pode ser incompleta. **Lacunas legítimas do provedor não são interpoladas nem inventadas**.

### Proteções de qualidade
O lote é rejeitado sem conversão de sucesso artificial se houver:
- candle ausente, duplicado, incompleto, fora do intervalo ou desalinhado;
- preço não numérico, negativo ou zero, inconsistência OHLC, volume negativo;
- amplitude intrahorária excepcional (high/low > 1,5), 10% ou mais de barras sem volume, ou mais de metade completamente plana;
- mudança de host, produto, granularidade, datas ou método;
- falha HTTP, rate limiting, erro de rede, JSON inválido ou cobertura incompleta.

Os candles válidos são verificados com SHA-256 sobre JSON canônico com ordenação temporal; cada lote de até 200 barras também recebe SHA-256. O relatório registra início/fim, quantidade, par, moeda USD, hash e contadores de qualidade. O workflow **não arquiva candles brutos** no repositório nem nos artifacts, preservando até a revisão de direitos de uso/redistribuição.

### Planejamento cronológico fixo, sem alegar evidência prospectiva
A série de 960 candles é separada a priori em **600 treinamento, 48 embargo, 312 holdout retrospectivo**, sem sobreposição. Não existe backtest B279 já executado aqui. O desenho da divisão ocorreu **após os preços históricos existirem**, de modo que não pode ser apresentado como pré-registro histórico genuíno ou prova prospectiva independente. Necessários dados independentes, protocolo de custos, relógios auditados, modelo de execução e amostra realmente futura para qualquer autorização operacional.

### Execução e grau de evidência
- `node --test tests/platformB278HistoricalIngest.test.mjs` verifica o contrato com candles sintéticos e transporte público GET simulado; esses testes provam mecânica, **não desempenho de mercado**.
- Na CI, `node scripts/platform/research/b278-public-capture.mjs` tenta ler o histórico público real dos três pares e escreve `.jenios-b278-ci/B278_PUBLIC_MARKET_CAPTURE.json` com status explícito. Se o endpoint não estiver disponível, o relatório registra `FAILED_CLOSED_NO_THREE_ASSET_ATTESTATION` e o passo da coleta falha; isso **não autoriza dizer que os dados reais foram obtidos**.
- O workflow possui uma verificação de qualidade **separada** da CI de código: uma CI verde não converte um passo de rede opcional malsucedido em captura certificada.
- Mesmo uma coleta completa via HTTPS não significa que os dados estão assinados pela corretora, independentes entre provedores, licenciados para redistribuição ou adequados a operações reais.

## Uso no bloco B279
A partir dos hashes e dos horários, reconstituir exatamente as mesmas séries por GET público, confirmar igualdade de digest e direitos de uso; somente então executar pesquisas históricas preliminares com custos e limitações declaradas. Não reaproveitar instrumentos USD para parâmetros USDT. Preservar o núcleo dos robôs original, os três modos e todos os backups. Sem deploy, Pix ou ordens reais.

## Critério de checkpoint
O código de ingestão, seus testes e o build devem passar na CI. Registrar separadamente o resultado **real** da tentativa de coleta, a integridade da amostra, os hashes e as limitações de validação estatística.
