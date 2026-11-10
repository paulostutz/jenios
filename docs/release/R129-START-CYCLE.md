# R129 — sessão durável e preparação fictícia do Start

## Escopo e composição

`DurableUltraRuntimeR129` estende `DurableUltraRuntimeR128` sem alterar os arquivos R128, R127 ou UM001. O runtime herdado continua responsável por seleção, quantidade, sessão, lease, ordem, execução parcial, recuperação e redução. `UltraStartCycleBridgeR129` acrescenta somente vínculo durável, intenção de consulta e dois gates fictícios para novas aberturas.

O módulo UM001 mantém a regra de 500 centavos BRL por ciclo explícito. Não foram criados nomes de planos, saldo real, débito, captura, liberação, estorno, sistema de recebimento, ordem externa ou autorização de integração. Todos os adapters continuam `offline_fixture`, com ambiente operacional `demo`. Os indicadores de execução real, comprovação nativa e cobrança permanecem falsos.

## Interface concreta

```js
import {DurableUltraRuntimeR129} from './session-runtime-r129.mjs';

// r128Options contém configuração/ledger atribuído/adapter fixture e os
// mesmos sessionId, ownerScope e connectionScope já exigidos pelo R128.
// Neste exemplo ownerScope é 'synthetic:owner', inclusive no ledger atribuído.
const fixtureBinding = {
  registrationId: 'synthetic:registration',
  clientId: 'synthetic:client',
  ownerScope: r128Options.ownerScope,
  evidenceMode: 'offline_fixture',
};
const cycleBinding = {
  accountKey: 'synthetic:account',
  ownerKey: 'synthetic:owner',
  cycleId: 'synthetic:cycle:1',
};
const performanceAuthority = letterLaboratory.createPerformanceAuthority({
  fixtureBinding,
  cycleBinding,
  gateIdentity: {
    customer_id: fixtureBinding.clientId,
    billing_account_id: cycleBinding.accountKey,
    environment: 'demo',
  },
  now: () => fixtureClock.now,
});
const runtime = new DurableUltraRuntimeR129({
  ...r128Options,
  fixtureBinding,
  startFee: {
    authority: sharedUm001Laboratory,
    authorityId: 'synthetic:um001:instance-1',
    ...cycleBinding,
    requestId: 'synthetic:start:1',
  },
  performanceAuthority,
});
await runtime.start();
const preparation = runtime.startPreparation();
// Resposta do Start perdida: consulta a mesma chave; não envia outro Start.
runtime.reconcileStartPreparation();
await runtime.tick();
```

`fixtureBinding` é o mesmo registro fictício explícito utilizado pela ponte de registros. Não comprova um cliente real. A identidade da conta/ciclo vem do harness autorizado; não é derivada do `sessionId`, das operações nem do feed. `authorityId`, `accountKey`, `ownerKey`, `cycleId` e `requestId` exigem o prefixo `synthetic:`. `ownerScope` deve coincidir com o ledger atribuído e a sessão R128.

Nesta fixture, os vínculos são estritos: `fixtureBinding.clientId === gateIdentity.customer_id`, `fixtureBinding.ownerScope === cycleBinding.ownerKey` e `cycleBinding.accountKey === gateIdentity.billing_account_id`. A conta central fictícia Start/Letter permanece distinta do `accountBinding` da corretora. Não há mapeamento inferido. Identificadores diferentes entre os sistemas dependerão de um mapa canônico explícito e validado em uma evolução futura.

`start()`, `resume()`, `tick()` e `finish()` devolvem também `startPreparation`. `startPreparation()` é uma leitura; `reconcileStartPreparation()` é síncrono e exige o controlador atual da sessão. A preparação distingue `authorityState`, `preparationStatus` e `startReady`; reserva confirmada não representa autorização de execução real. O último resultado de performance é informativo: o callback será consultado novamente na próxima abertura.

## Autoridades e gate de abertura

O gate é instalado no adapter antes da construção do R128, preservando seus proxies de controle. Ele verifica a preparação do Start em `preflight` e novamente em `submitProtected`. O gate de performance recebe `{fixtureBinding, cycleBinding, sessionId, stage, request}` e deve devolver, de forma síncrona:

```js
{
  schema: 'JENIOS_ULTRA_PERFORMANCE_AUTHORITY_R129',
  source: 'letter.monthly.r129',
  authorityInstanceId: 'letter-lab-r129:<UUID-v4>',
  evidenceMode: 'offline_fixture',
  fixtureBinding,
  cycleBinding,
  gateIdentity: {customer_id, billing_account_id, environment: 'demo'},
  observedAtMs,
  gate: {
    synthetic_only: true,
    actual_execution_authorized: false,
    allowed_in_simulation,
    blocked_obligations,
    reason,
  },
}
```

O helper do Letter R129 fecha sobre a mesma instância do laboratório, gera internamente um UUID v4 de instância e consulta seu gate a cada chamada. O runtime confere vínculo, origem, ambiente, tempo não futuro com idade máxima de cinco segundos, permissão simulada e ausência de obrigações bloqueadoras. Booleano de aprovação, resposta desconhecida, Promise, prova de outra conta/ambiente ou exceção fecham o gate. Nenhum callback de autoridade é obtido de JSON de cliente.

O primeiro callback canônico fixa a identidade Letter e seu `authorityInstanceId` no diário, sob `ultra_performance_authority_r129:<digest de fixtureBinding e accountBinding>`. Essa chave não contém `sessionId` nem `cycleId`: terminar a sessão ou iniciar outro ciclo explícito não apaga uma dívida mensal. Uma instância nova e vazia, mesmo com cliente e conta iguais, recebe `R129_PERFORMANCE_AUTHORITY_INSTANCE_CHANGED`; sua ausência de obrigações não é tratada como quitação da instância anterior. O vínculo também permanece na entrada da sessão. Perda da autoridade precisa de reconciliação futura, sem liberação automática. O UUID identifica a instância fictícia; não é assinatura nem autenticação de um serviço financeiro.

O contrato síncrono evita acrescentar um `await` entre as últimas verificações herdadas e a chamada do adapter. A preparação do Start também usa somente os métodos síncronos do UM001. Uma Promise é tratada como resposta incerta; não há callback posterior que altere o diário fora do controlador.

Se a performance bloquear já no `preflight`, nenhuma intenção de ordem é criada. Se o bloqueio surgir depois do `preflight`, o runtime verifica uma intenção local ainda `sending`, sem recibo nem quantidade executada, e a muda para `cancelled` antes de chamar o adapter. O motivo é `R129_OPENING_WITHHELD_BEFORE_DISPATCH`, com `brokerSubmissionAttempted: false`. O retorno é `opening_withheld`. Isso registra retenção local; não representa recusa ou cancelamento nativo e não cria recibo de corretora. A pausa conservadora herdada permanece e requer retomada explícita. Uma intenção retida não fica como ordem desconhecida impossível de consultar.

Consulta, conciliação, coleta de recibos, proteção, cancelamento e redução não passam pelos gates de Start/performance. O `tick` herdado continua conciliando e protegendo posições antes de avaliar uma nova abertura. Seus controles existentes de identidade, conexão e posse do lease continuam aplicáveis às reduções.

## Persistência, replay e recuperação

A ponte usa apenas `saveTransport` do diário existente, cercado pelo controlador R128. A entrada `ultra_start_cycle_r129:<sessionId>` guarda o vínculo, primeiro início, marca de tentativa, decisão recebida, terminal inicial e identidade Letter. A entrada de autoridade de performance descrita acima sobrevive à troca de sessão/ciclo nesse diário e mantém a identidade da instância. Não acrescenta uma tabela financeira.

A intenção e a marca `startAttempted` são persistidas antes da única chamada possível a `recordStart`. Resposta perdida, reinício ou retomada consultam `reconnect` com a mesma conta/ciclo. Depois de uma tentativa marcada, mesmo `UNKNOWN_CYCLE` não autoriza outro Start. Um evento local preparado e comprovadamente nunca tentado pode ser enviado uma vez depois da consulta. Essa distinção evita reserva duplicada em resposta incerta.

A decisão UM001 recebida é validada contra dono, conta, ciclo, primeiro início, chave da reserva, classificação fictícia com evidência e os estados originais do módulo. Alteração posterior do snapshot financeiro ou de um terminal é recusada. O hash local serve à integridade/correlação; não autentica corretora, Letter ou cliente.

Uma instância nova do runtime começa sem prova financeira em memória. Seu cache durável não libera o gate: a autoridade original precisa ser consultada. Se o laboratório UM001 em memória tiver sido perdido, a ponte permanece pendente e não o recria para reservar novamente. A durabilidade do vínculo local não torna a reserva UM001 durável ou distribuída.

Uma sessão R128 anterior sem vínculo R129 não recebe Start retroativo durante `resume()`. A sessão pode conciliar e reduzir exposição; novas aberturas ficam pendentes de vínculo explícito. Não foi criada política de migração financeira.

## Pausa, encerramento e retomada

Uma sessão pausada R128 é retomável. No UM001, `paused` e `ended` são terminais. A ponte conserva ambos os fatos: retoma a mesma sessão e a mesma reserva, sem reabrir o terminal tarifário nem gerar outro ciclo.

A primeira pausa gera somente o primeiro terminal UM001. Encerramento direto e sem exposição gera `ended`. Se `finish()` retorna `draining`, o ciclo é registrado como pausado; a sessão conserva a exposição pendente e `finishedAtMs: null`. Um encerramento posterior preserva esse primeiro `paused` no UM001. O `pause()` interno de `finish()` não transforma indevidamente um encerramento direto em pausa. Nenhum desses eventos captura, libera ou estorna a reserva.

Várias operações, reconexão entre JENIOS e Flow, replay, retomada e reinício do runtime não multiplicam a tarifa do mesmo ciclo. A deduplicação central comprovada continua limitada a uma instância UM001 fictícia compartilhada pelas plataformas.

## Pendências verdadeiras e Administração

Uma resposta perdida de uma reserva que já existe pode ser conciliada e liberar novas aberturas. Uma pendência verdadeira UM001 de enquadramento, ativação ou saldo não pode ser resolvida por replay. `admin.setPlanEnabled` permanece no handler original, com autorização, versão, requisição idempotente e auditoria; só afeta novos ciclos. O snapshot pendente existente permanece pendente.

Não foram criados captura, liberação, estorno, saldo mutável ou aprovação retroativa. A retomada aqui demonstrada aplica a instrução de não repetir a tarifa no mesmo ciclo e mantém `resumePolicy: pending` no registro UM001 original; ela não afirma uma política financeira real concluída.

## Validação dirigida

Comando, executado no checkout R129:

```sh
node --test tests/platformUltraR129StartCycle.test.mjs
```

Resultado da última execução: **26 testes aprovados, 0 falhas, 0 cancelados, 0 ignorados**, saída 0, duração informada de 401,691945 ms. Os testes cobrem múltiplas operações por ciclo, plataformas compartilhando a mesma autoridade, resposta perdida e reinício, autoridade substituta sem reserva, pendências verdadeiras, mudança administrativa somente para novos ciclos, gates desconhecidos, performance mudando antes do dispatch, preservação de cancelamento/redução, isolamento de vínculos/controladores e pausa/encerramento sem exposição fabricada. Também cobrem provas de outro cliente/conta e ausência de identidade da instância.

Os callbacks controlados deste teste são fixtures. Um teste dirigido adicional utiliza o wrapper Letter efetivo: o laboratório original registra uma dívida; uma instância nova vazia não libera o runtime após retomada; cancelamento e redução continuam disponíveis; um novo ciclo explícito no mesmo diário continua bloqueado e preserva o vínculo original. A validação integrada completa continua no harness R129 conjunto. Nenhum teste aqui é de API de demonstração externa, licença de Profit/Genial/Binance, Wallet/Letter real, integração bancária ou comprovação nativa. Não houve rede, navegador, ordem real, fundos reais, staging ou commit nesta frente.
