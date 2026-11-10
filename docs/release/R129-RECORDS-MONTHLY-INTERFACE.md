# R129 — registros atribuídos para a UM001

Data: 10/11/2026. Candidata local, sem publicação.

## Escopo e reaproveitamento

`lib/platform/ultra/client/records-monthly-r129.mjs` liga o feed atribuído R127, utilizado pelo runtime durável R128, ao consolidado mensal UM001. Reutiliza `validateOperation`, `operationNet`, `monthlyPeriod`, `monthInZone` e `consolidateMonthlyReports`. Não modifica esses módulos, o diário SQLite, a estratégia, a apuração comercial, Start, os guardas ou a UI.

A ponte é um módulo Node sem I/O: recebe JSON, valida e devolve um estado/envelope imutável. Não abre banco, não lê credenciais, não acessa corretoras, não envia ordens e não persiste dados por conta própria. O chamador deve guardar estado e cursores juntos no armazenamento já existente.

Somente `offline_fixture`, ambiente lógico `demo`, é aceito. A interface de registro do cliente também é fictícia: identifica uma associação declarada para o ensaio, sem autenticar o proprietário ou a conta. Todas as flags de validação nativa, cobertura autoritativa, ativação financeira, cobrança e débito permanecem falsas.

## API

```javascript
import {
  ingestRecordBatchesR129,
  monthlyRecordsReportR129,
} from './lib/platform/ultra/client/records-monthly-r129.mjs';

const fixtureBinding = {
  registrationId: 'fixture-registration-1',
  clientId: 'fixture-client-1',
  ownerScope: 'fixture-owner-1',
  evidenceMode: 'offline_fixture',
};
const now = Date.parse('2026-11-10T15:00:00Z');
const fromCursor = null;
const batch = ledger.recordBatch({cursor: fromCursor, now});
const state = ingestRecordBatchesR129(null, [{fromCursor, batch}], {
  fixtureBinding, now,
});
const envelope = monthlyRecordsReportR129(state, {
  month: '2026-10', timeZone: 'America/Bahia', now,
});
```

`ledger.recordContext.ownerScope` deve coincidir com o `ownerScope` do registro fixture. Identificadores são opacos e não contêm a conta literal, senha, chave ou permissão de saque.

### `ingestRecordBatchesR129(previousState, pages, {fixtureBinding, now})`

`previousState` é `null` para iniciar ou o estado anterior, inclusive após serialização JSON. Cada página exige `{fromCursor, batch}`. O cursor inicial é `null`, ou `{feedId, sequence: 0}`. As demais páginas começam exatamente no cursor aceito daquele feed. O `now` opcional é um timestamp inteiro positivo; seu padrão é `Date.now()`.

O resultado tem schema `JENIOS_ULTRA_MONTHLY_RECORD_STATE_R129`:

| Campo | Conteúdo |
| --- | --- |
| `fixtureBinding` | Os quatro campos normalizados do registro fictício. Não pode mudar entre chamadas. |
| `pages` | Páginas originais aceitas, incluindo todos os snapshots e recibos locais exportados. |
| `feeds` | Escopo, cursor, data de geração, indicação de mais linhas e total de linhas excluídas de cada feed. |
| `eventCount` | Quantidade de revisões únicas aceitas. |
| `operationCount` | Quantidade de identidades técnicas de operação. Não é número de Starts comerciais. |
| `stateDigest` | SHA-256 do JSON do estado sem este campo. Integridade local, sem assinatura. |

O estado pertence a um único `clientId`/`ownerScope`/`registrationId`. Várias contas, conexões, produtos e moedas podem coexistir sob esse cliente. Outra associação de cliente é recusada; uma página com outro proprietário também é recusada.

### `monthlyRecordsReportR129(state, {month, timeZone, now})`

O estado é novamente validado e reconstruído antes da projeção. O fuso padrão é `America/Bahia`; os limites e classificações vêm da UM001. O resultado tem schema `JENIOS_ULTRA_RECORD_MONTHLY_R129`.

| Campo | Conteúdo |
| --- | --- |
| `fixtureBinding`, `fixtureBindingDigest` | Registro local e SHA-256 de seu JSON na ordem `registrationId`, `clientId`, `ownerScope`, `evidenceMode`. |
| `month`, `timeZone`, `periodStart`, `periodEnd`, `periodClosed` | Competência calculada pela UM001; intervalo com fim exclusivo. |
| `groups[].scope` | Cliente, proprietário, conta vinculada, fornecedor, ambiente, produto, moeda, conexões e estratégias. |
| `groups[].monthly` | Grupo calculado pela UM001 a partir da projeção descrita abaixo. |
| `groups[].records` | Últimas revisões originais das operações do grupo/competência, com origem e evidência. |
| `groups[].history` | Todas as revisões aceitas dessas operações. |
| `groups[].projectionAdjustments` | Operações cujos valores foram ocultados somente na projeção por falta de recibo conciliado. |
| `groups[].fillDetail` | Declara explicitamente o nível agregado, sem fills individuais ou referências tipadas. |
| `sources` | Fontes `JENIOS_ULTRA_OPERATIONS_V1` usadas internamente na projeção UM001. Não substituem o envelope de evidências. |
| `view` | Visão consolidada UM001 de todas as partições; sem total entre moedas/produtos. |
| `observedScopes` | Todos os feeds observados, inclusive contas vazias ou que só contêm linhas excluídas. |
| `observedAccountKeys` | Inventário das identidades locais de fonte, para não esquecer contas/produtos sem resultado fechado. |
| `globalPendingReasons` | Limitações comuns e pendências da importação/cobertura do cliente. |
| `pendingReasons` | União de todas as pendências observadas. |
| `groups[].pendingReasons` | Pendências específicas do grupo, somadas às limitações e cobertura correspondentes. |
| `reportDigest` | SHA-256 de `JSON.stringify(envelopeSemReportDigest)`. Não é assinatura nem comprovação externa. |

`sources[*].platform` identifica uma superfície de projeção compatível com a UM001. A atribuição individual de cada operação permanece em `groups[*].records[*].origin.sourcePlatform`; o consumidor não deve substituir essa atribuição pelo rótulo único de uma fonte que agrega uma conta.

## Revisões, cursores e replay

Os registros são snapshots integrais. `eventId` identifica uma revisão e `operationKey` identifica a operação. A ingestão exige revisão inicial 1 e sequência consecutiva de revisões por operação. Ela conserva intenção, origem, estratégia, quantidades, preços, custos, horários e recibos do histórico inteiro. A revisão mais recente substitui a anterior na apuração; valores e quantidades não são somados entre revisões.

O feed R127 não informa o cursor inicial solicitado. Por isso, o chamador deve fornecer esse cursor junto de cada lote. A ponte verifica escopo, ID do feed, intervalo da página, sequência dos registros, quantidade de linhas atribuídas/excluídas, digest, origem, recibo, resultado e invariantes das revisões. A continuidade se aplica ao diário R127 atual, cujo histórico é append-only; diário compactado ou com linhas removidas exige outro contrato.

Uma página anteriormente aceita, com o mesmo intervalo e os mesmos registros/exclusões, é replay e não altera o estado. Repetir uma página antiga depois de consumir uma nova também não regride o estado. Atualizar apenas a data de geração de um replay não renova sua observação. Uma nova página a partir do cursor corrente pode registrar observação adicional; repetir também essa mesma faixa vazia mantém a observação anterior. Essa limitação conservadora pode manter `SOURCE_CUTOFF_PENDING`. Nenhuma dessas datas comprova a cobertura nativa do mês.

Conteúdo divergente no mesmo evento/intervalo, salto de cursor, lacuna de revisão, alteração de identidade, retorno de quantidades ou mudança de estado final causam erro. O chamador não recebe um estado parcial ou cursor avançado. O estado anterior não é modificado, inclusive se a chamada contiver uma página válida seguida de outra inválida.

Uma página vazia pode avançar o cursor quando todas as linhas foram excluídas por falta de origem. Isso não vira resultado do Ultra: o número é preservado como **linhas de auditoria excluídas**, com `UNATTRIBUTED_RECORDS_EXCLUDED`.

Limites desta candidata: até 1.000 linhas por página, 20.000 revisões únicas, 20.000 páginas aceitas, 100 feeds e 20 fontes por partição de produto para a chamada UM001. A `view` fornecida já reúne as partições; um array `sources` com mais de 20 fontes não pode ser reapresentado de uma só vez ao núcleo UM001.

## Identidade local e separação de dimensões

Nenhuma projeção preenche `accountFingerprint` com o digest de uma conta local. O `sourceId` é `r129_` seguido de SHA-256 do JSON `{ownerScope, product, provider, environment, accountBinding}`, nessa ordem. A UM001 mantém sua identidade explícita de fonte não verificada:

```javascript
JSON.stringify([provider, 'demo', 'unverified:' + sourceId])
```

O `accountBinding` original permanece no envelope. Produto e proprietário participam da identidade local da fonte. Conexões da mesma conta/produto compartilham a identidade mensal para que referências de corretora repetidas entre operações distintas continuem produzindo conflito na UM001. Não há soma entre clientes, moedas ou ambientes, nem conversão cambial implícita. A visão mensal pode agrupar estratégias na mesma conta, mas conserva a estratégia/configuração de cada operação e o inventário de estratégias do grupo.

## Confirmação e pendências

Um snapshot `closed` com custos completos não basta para entrar no resultado confirmado local. `unverified_snapshot` recebe, apenas na projeção UM001, `gross/fees/financing/unrealized=null` e `costsComplete=false`. O original continua intacto em `records`/`history`, e a alteração de projeção fica descrita. O resultado confirmado permanece nulo para essa operação, com `EXECUTION_EVIDENCE_PENDING`. Esta pendência não pode ser eliminada por um atestado genérico de laboratório.

Recibos conciliados fictícios com custos completos podem participar do cálculo **local simulado** da UM001. Custos tardios substituem a revisão anterior do mesmo encerramento. Componentes ausentes não viram zero; rebates/financiamento negativo preservam o sinal. Parciais, execuções incertas, conflitos de referências e posições de meses anteriores conservam as pendências UM001.

Cancelamento local antes do envio, sem quantidade executada e sem recibo, conserva `result.status=not_final`. Ele não vira execução nativa, encerramento confirmado ou custo elegível de uma operação executada.

O feed R127 tem quantidades e preços agregados, `brokerRefs` e recibos locais. Ele não contém o detalhamento de cada fill, a identidade nativa do cliente ou a conciliação independente de posição/funding entre robôs. Esses dados não são inventados por esta ponte.

Para integrar o consumidor mensal/Letter, use o envelope inteiro. A `view` transporta também `recordPendingReasons` e `recordGlobalPendingReasons`. Seleções por moeda devem considerar as pendências globais e as do grupo selecionado; a união total deve continuar preservada como evidência. Assim, um custo pendente em USDT não é tratado como custo da apuração BRL. `hasMore`, exclusões e falta de cobertura global permanecem visíveis.

Uma frente externa pode demonstrar resolução **somente de laboratório** de uma lista restrita de limitações nativas, vinculada explicitamente a registro fixture, digests, período e contas. Essa demonstração deve conservar as pendências e flags originais, sem alterar este envelope. Esta ponte não recebe tais atestados, não resolve pendências comerciais e não cria elegibilidade de cobrança. Custos, execução incerta, falta de recibo, conflitos, linhas excluídas e importação incompleta continuam impedimentos materiais.

`sourceComplete`, `independentlyVerified`, `nativeValidated`, `financialActivationAllowed`, `billingDecisionIncluded`, `billable` e `debitExecuted` são sempre `false`; `walletBalance` e `finalNet` são `null`. `sessionId` e contagem de trades/revisões não geram Start. Nenhuma função de performance, cobrança ou débito é chamada.

## Validação focada

Comando: `node --test tests/platformUltraRecordsMonthlyR129.test.mjs`.

Resultado: **12/12 aprovados**, sem falhas, ignorados ou cancelados. A primeira execução encontrou somente a preparação de uma fixture que precisava retomar o próprio diário pausado depois de fechar a posição; o teste foi ajustado antes do resultado final.

Os casos novos verificam parciais e custos tardios; replay após serialização; atomicidade de múltiplas páginas; mistura de cliente/proprietário e alegações nativas; páginas sem origem; encerramento sem recibo; várias contas/produtos/moedas/estratégias; referências conflitantes; pendências por moeda versus importação global; execução incerta; lacunas de revisões; limite mensal de Bahia e posição anterior.

Todos os dados foram produzidos por `AttributedExecutionLedgerR127` e `OfflineFixtureBroker` em SQLite na memória. São testes simulados locais. Nenhuma API de demonstração externa, licença, SDK nativo, conta real ou fundo real foi acessado. Testes históricos não foram reexecutados nesta frente.

Uma revisão independente, somente leitura e sem repetir testes, verificou cursor/replay, escopo e preservação da evidência. Não apontou falha material; a observação sobre atualização conservadora de datas de replay está documentada acima.
