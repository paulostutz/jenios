# JENIOS Ultra R120: autenticação sintética e eventos duráveis

**Não operacional. Não publicado. Nenhuma conta conectada ou ordem real enviada.**

Continuação local de R119 `0ab325a756bdb167c6b357dce52f2b603529a843`.
O objetivo desta etapa é implementar partes independentes da conexão real,
com contratos oficiais e testes sintéticos. Não é a conclusão do Ultra autônomo.

## Entrega

- `binance-auth-fixture-r120.mjs`: canonicalização e vetor HMAC com constante
  pública fictícia; contratos separados Spot/Futures, janela de validade,
  circuito de falhas e logs sem segredo, assinatura, parâmetro ou corpo de conta.
  Não aceita segredo real, ambiente de produção, URL arbitrária ou transporte.
- `binance-events-r120.mjs`: normaliza Spot executionReport/listStatus/envelopes
  e Futures ORDER_TRADE_UPDATE/ALGO_UPDATE. Preserva IDs e decimais exatos,
  distingue última execução de quantidade acumulada e não inventa custo líquido.
- `binance-event-inbox-r120.mjs`: persiste evidências normalizadas no SQLite
  local, deduplica pela identidade nativa e bloqueia conflitos. Sessões têm
  gerações próprias. Desconexão/reinício exigem nova conciliação; nunca reenvio.

Os arquivos e pacotes R119/prévios continuam intactos. Não há UI nova,
provisionamento de chave, WebSocket, HTTP autenticado nem conexão ao executor real.

## Identidade, eventos e conciliação

A caixa durável liga eventos apenas a ações locais conhecidas. Símbolo ou
quantidade iguais não provam titularidade. IDs nativos ou lado contraditórios
são conflitos, inclusive quando a divergência chega pela resposta de consulta.

Filhos Spot OCO/OTOCO são associados somente após recibo durável vinculando
lista e IDs dos filhos. O lado de cada filho vem da intenção original: o lado
da entrada OTOCO não é aplicado indiscriminadamente aos filhos de saída.

Uma ordem disparada por algo Futures só é associada quando seu actualOrderId
já foi confirmado em recibo durável da condicional, com contexto, símbolo e
lado compatíveis. Isso não comprova o fechamento da posição: ainda é necessário
conciliar os fills da ordem disparada, as outras ordens, posições e custos.

Cada rodada de conciliação recebe um ticket com geração, conjunto de ações e
marcos do diário. `reconcileTicket` controla o início das consultas e relaciona
os recibos ao ticket. Uma consulta anterior que apenas termine depois do ticket
não o satisfaz. Um novo evento, mudança de escopo, desconexão ou prazo excedido
invalida a rodada. Há um limite local de cinco segundos por ticket; consultas
incompletas não abrem o bloqueio nem disparam repetição automática.

`locallySynchronized=true` significa somente que as consultas sintéticas do
conjunto de ações foram registradas sem corrida local detectada. Não é estado
de conta autenticada. A caixa não chama resume, não altera posições ou resultados
e mantém canSubmit=false, tradeActivationAllowed=false,
financialReconciliationRequired=true e protectionConfirmed=false.

Eventos tardios ficam no histórico, sem somar novamente uma quantidade acumulada.
Não se presume sequência global recuperável em streams Binance. Eventos
manuais/desconhecidos, dados inválidos e conflitos ficam bloqueados; esta etapa
não oferece um botão para ignorá-los ou apagá-los. É necessário implementar
reconciliação de conta e resolução auditável antes de uso operacional.

## Limites de protocolo

- FINISHED de algo Futures pode significar preenchimento ou cancelamento;
  FILLED/ACK isolados não provam proteção, posição encerrada ou lucro líquido.
- OTOCO não protege um preenchimento parcial da entrada; OCO com stop limitado
  pode não executar em gaps. Essas limitações de R119 permanecem.
- O HMAC REST sintético não demonstra autenticação Spot WebSocket. A sessão
  session.logon/userDataStream.subscribe tem requisito Ed25519 próprio.
- O parser recebe objetos JSON já decodificados sem perda. Um decodificador
  futuro precisa preservar inteiros grandes e rejeitar chaves JSON duplicadas.
- A caixa durável usa milissegundos. O parser Spot aceita microssegundos quando
  explicitamente solicitado, mas esse modo não está conectado à caixa R120.
- listenKey e outros tokens não entram no parser/diário. Eventos de expiração
  devem ser expurgados de material de acesso pelo futuro receptor local.
- O fingerprint sintético não valida conta, UID ou permissões de uma credencial.

Detalhes e fontes oficiais conferidas em 10/11/2026:
`R120-LOCAL-TRANSPORT.md` e `R120-EVENT-PROTOCOL.md`.

## Reproduzir sem conta

Node.js 24 na raiz do pacote extraído:

```sh
node --test tests/platformUltraR120*.test.mjs
```

Os testes incluem falhas, concorrência, perda de resposta, reinício, duplicatas,
IDs divergentes, assinatura fictícia, erros/limites, OCO/OTOCO e condicionais.
Os testes R118/R119 e Python também permanecem no pacote.

## Restante para concluir

Implementar e homologar, no ambiente do titular: recepção nativa/decodificação,
autenticação local apropriada, sincronização de relógio, subscriptions/keepalive,
dados de mercado, reconexão com conciliação de conta, supervisão de proteções,
tratamento de preenchimentos parciais, conciliação financeira completa e interface
autenticada. Nenhum segredo deve ser colado em conversa ou enviado ao servidor do
aplicativo. A configuração real de acesso e ativação permanecem com o titular.

Profit ainda depende do ProfitDLL.zip oficial licenciado, Windows/arquitetura
correta e declarações/manuais da mesma versão. Nada foi substituído por uma ABI
inventada. A publicação do Ultra como concluído continua pendente.
