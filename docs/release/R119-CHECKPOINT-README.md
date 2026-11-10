# JENIOS Ultra R119 — adaptadores Binance em qualificação isolada

Continuidade do checkpoint local R118 `06654c7cfcb4b1d5c71a65c9f137b282f14a93ef`,
sobre a release oficial R117. Não publicado. Não operacional para uma conta real.

## Avanço implementado

1. **Spot separado de Futures.** Descritores nativos Spot LIMIT, consulta e
   cancelamento por identidade exata, OCO/OTOCO e consulta/cancelamento de lista.
   SELL somente com estoque disponível; nunca inverter a estratégia para simular
   um short que o mercado escolhido não suporta.
2. **USDⓈ-M Futures atual.** Entrada/fechamento usam `/fapi/v1/order`;
   condicionais usam `/fapi/v1/algoOrder`, com `clientAlgoId`. Fechamentos parciais
   recebem IDs próprios derivados de cada comando durável, não um ID reutilizado.
3. **Correção do preflight.** O campo `MAX_NUM_ALGO_ORDERS` foi retirado de
   exchangeInfo pela Binance em 29/12/2025. R119 não o fabrica: exige inventário
   global completo e aplica o limite documentado de 200 condicionais. O R118
   histórico permanece intacto e não deve ser usado como preflight nativo atual.
4. **Intenção durável por ação nativa.** Cada entrada, proteção, cancelamento e
   fechamento registra descritor, alvo de consulta, produto e vínculo antes do
   transporte de testes. Uma operação só pode possuir uma entrada, inclusive
   entre entrada simples e OTOCO. IDs diferentes não autorizam duplicar a entrada.
5. **Recuperação sem reenvio cego.** Timeout, resultado perdido, recibo inválido,
   identidade divergente ou ordem não encontrada exigem consulta. Uma ação já
   observada/pendente não é reenviada. Mutações preparadas com relógio vencido
   não são disparadas; consultas Futures renovam somente o timestamp, mantendo
   alvo e vínculo. Ações comprovadamente não enviadas ficam `not_sent` após
   recuperação, sem reenvio automático.
6. **Fechamento ligado ao comando local.** Cada close nativo exige o comando
   durável R118 correspondente. Mesmo um recibo nativo FILLED não confirma sozinho
   posição encerrada nem custos completos.

## O que significam os resultados

`DurableBinanceAdapterR119` aceita exclusivamente
`BinanceProtocolSandboxR119`: transporte em memória, roteiro JSON, sem fetch,
sockets, URL, assinatura ou credenciais. Não há opção para ativar transporte real.
Os descritores são não executáveis e não assinados.

O estado nativo `observed` significa que uma resposta sintética foi normalizada
para a identidade esperada. Não significa execução financeira comprovada. O
adaptador mantém `nativeValidated=false`, `realOrdersSent=0`,
`protectionConfirmed=false` e `financialRecordPending=true`.

As observações nativas ficam no diário local separado, ligado à operação original.
Elas **não** são transformadas automaticamente em posição protegida, operação
encerrada ou lucro líquido. O estado financeiro permanece pendente até a futura
conciliação completa de fills, posições, proteções, custos e titularidade.

## Proteções e limitações importantes

- OTOCO Spot só ativa ordens pendentes depois do preenchimento total da entrada.
  Uma entrada parcialmente preenchida continua exposta. ACK não prova ativação.
- OCO Spot implementado usa LIMIT_MAKER e STOP_LOSS_LIMIT. Um stop limitado pode
  não executar em gaps. A reserva de comissão em ativo-base ainda exige
  conciliação real; não se deve presumir que toda quantidade comprada ficou livre.
- Futures implementado é o subconjunto USDT perpétuo, posição one-way, margem
  isolada e alavancagem já configurada. Não muda conta, permissões, margem ou
  alavancagem. Cross, hedge, COIN-M e multi-assets não são implicitamente aceitos.
- Duas condicionais Futures não são uma proteção atômica. A consulta de cada
  perna precisa corresponder ao ID, lado, quantidade, gatilho e flags esperados.
- O diário não substitui a reserva de risco global, autenticação de conta,
  sincronização com relógio do fornecedor, stream/reconexão ou supervisão nativa.
- Não há reconstrução de posição por suposição a partir de símbolo ou ordem
  FILLED. Custos e funding não são tratados como zero quando faltam evidências.
- Seleção automática, motores e regras anteriores não foram alterados. Estes
  adaptadores preservam a direção escolhida, sem alegar rentabilidade.

## Como reproduzir a qualificação local

Node.js 24; não é preciso fornecer conta ou chave. Na raiz extraída:

```sh
node --test tests/platformUltraR119*.test.mjs
```

Os testes exercitam contratos oficiais com dados sintéticos, concorrência,
intenção antes do envio simulado, reinício com resposta perdida, consulta exata,
rejeição, identidades divergentes e proteção pendente. Os testes R118 e Python
continuam disponíveis no pacote. Não são testes de negociação em demo externo.

Módulos novos principais:

- `binance-spot-protocol-r119.mjs`: builders/normalizers Spot.
- `binance-futures-preflight-r119.mjs`: regras atuais e inventário global.
- `binance-futures-protocol-r119.mjs`: builders/normalizers Futures.
- `binance-action-journal-r119.mjs`: diário SQLite e vínculo durável de ações.
- `binance-protocol-sandbox-r119.mjs`: transporte sintético fechado.
- `binance-durable-adapter-r119.mjs`: coordenação entre diário e protocolo.

Exemplos e fontes oficiais constam em `R119-SPOT-PROTOCOL.md` e
`R119-FUTURES-PROTOCOL.md`. Consulte o código dos testes para roteiros executáveis
sem credenciais. Os documentos R118 explicam os coletores somente leitura e os
limites de custos/identidade que continuam aplicáveis.

## Restante antes de concluir e publicar

Conectar transporte autenticado e dados de mercado no ambiente do titular;
implementar fluxo de eventos/reconexão, reserva e supervisor de proteções,
inclusive fills parciais; alimentar o diário financeiro somente após conciliação
nativa completa; validar interface autenticada e percurso do titular; homologar
cada produto. O trader permanece responsável por ativar e executar sua conta.

Profit permanece condicionado ao `ProfitDLL.zip` oficial licenciado, binário
Windows da arquitetura correta e manual/declarações nativas da mesma versão.
Não houve tentativa de substituir esse SDK ou inventar uma ABI.

Nenhuma publicação, transação, alteração de permissões ou envio de credenciais
foi realizado neste checkpoint. Não tratar este pacote como autorização de uso
financeiro ou como conclusão do Ultra autônomo.
