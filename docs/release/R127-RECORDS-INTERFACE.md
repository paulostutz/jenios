# R127 — interface de registros do Ultra

Data: 10/11/2026, America/Bahia. Candidata local em cópia isolada.

## Entrega e limite

`lib/platform/ultra/client/operation-records-r127.mjs` acrescenta atribuição de origem e uma interface de leitura sobre o diário SQLite existente. Reutiliza `ExecutionLedger`, o histórico de revisões R117/R118, `validateOperation` e `operationNet`. Os arquivos históricos permanecem intactos.

Esta implementação aceita exclusivamente **dados fictícios em `offline_fixture`, no ambiente lógico `demo`**. Não autentica uma corretora, não recebe eventos nativos, não abre conexão de rede e não envia ordens. Todos os registros conservam `brokerAuthenticated=false`, `nativeValidated=false` e `financialActivationAllowed=false`.

A interface não executa cobranças, não determina elegibilidade de performance, não calcula mensalidades e não interpreta o identificador da sessão como evento de Start faturável. Nenhuma regra comercial foi modificada.

## Lacunas encontradas na base

1. O diário R117/R118 já registra intenções, estados, revisões, recibos, comandos e custos pendentes. Seu exportador geral aceita rótulos externos de fornecedor/ambiente e não inclui estratégia/origem por operação.
2. O método genérico `saveOperation` pode guardar registros sem intenção local. Isso é útil para outros caminhos existentes, mas não permite atribuir automaticamente esses registros ao Ultra.
3. Uma revisão financeira pode existir no diário sem que um recibo esteja associado àquela revisão. A saída para outra frente precisa distinguir o registro local de uma confirmação de execução.
4. O histórico contém versões completas de uma operação. Somar as revisões como se fossem negócios diferentes duplicaria valores e quantidades.

## Classe e preparação

Classe exportada: `AttributedExecutionLedgerR127 extends ExecutionLedger`.

Assinatura:

```javascript
new AttributedExecutionLedgerR127(path, binding, context)
```

| Argumento | Conteúdo |
| --- | --- |
| `path` | Arquivo SQLite local do titular. A memória é permitida nos testes. |
| `binding` | `{account, environment: 'demo', provider}`; mesmas dimensões do diário existente. A conta literal não é exportada. |
| `context.sourcePlatform` | `jenios` ou `flow`. Identifica a origem local, sem conceder autorização. |
| `context.connectionId` | Identificador opaco local da conexão. |
| `context.ownerScope` | Identificador opaco local do proprietário; não equivale a autenticação de uma plataforma. |
| `context.sessionId` | Correlação técnica de sessão. Não cria sessão comercial nem cobrança. |
| `context.strategy` | `{id, version, configDigest}`; versão e digest da configuração utilizada pelo chamador. |
| `context.product` | Binance `spot` ou `usds_m_futures`; Profit/MT5 `b3`. Não transforma MT5 em prova de acesso a mercado. |
| `context.evidenceMode` | Somente `offline_fixture`. |

São recusados contexto incompleto, campos adicionais, tentativa de modo nativo/real e combinação incompatível de produto/fornecedor. Um mesmo banco não pode mudar silenciosamente proprietário, conexão ou produto. O vínculo do diário já existente continua separando conta, fornecedor e ambiente.

### Atribuição antes do envio

`prepare(request, now)` chama a preparação herdada e grava a atribuição na **mesma transação SQLite**. Intenção, operação inicial, auditoria e origem ficam persistidos antes de o runtime passar para `sending`.

A atribuição registra robô `ultra`, escopo, plataforma de origem, sessão, estratégia e digest da intenção. Se falhar a gravação de origem, a preparação inteira é revertida. Uma intenção herdada sem origem R127 não recebe atribuição retroativa. Uma tentativa de reusar a mesma intenção com origem/estratégia diferente falha com conflito.

Esta origem é uma declaração local vinculada ao código que prepara a intenção. Não é assinatura da corretora nem prova independente de titularidade, autorização ou execução de estratégia.

### Recibo associado à revisão

`applyReceipt(receipt, options)` conserva a validação R118 e, na mesma transação, associa o recibo à revisão resultante: ID, digest do recibo, digest da operação, horário, conciliação da posição, proteção e cancelamento do saldo da entrada. Se essa associação falhar, a confirmação inteira é revertida. O runtime mantém a intenção incerta e exige conciliação.

A evidência permanece fictícia. O campo `receiptRecorded=true` significa que o recibo passou pelo diário local, não que uma corretora o autenticou.

## Lote de leitura

```javascript
ledger.recordBatch({cursor: null, limit: 100, now: Date.now()})
```

Retorna `JENIOS_ULTRA_OPERATION_RECORD_BATCH_R127` com:

- `feedId` e `scope`: conta vinculada por digest, fornecedor, ambiente, produto, proprietário e conexão.
- `generatedAt`, `evidenceMode`, `nativeValidated` e indicadores de ausência de ativação financeira/decisão de cobrança.
- `records`: até o limite solicitado, de 1 a 1.000 linhas examinadas do histórico.
- `excludedUnattributedCount`: linhas examinadas que não têm a atribuição durável; não entram em `records`.
- `nextCursor: {feedId, sequence}` e `hasMore`: paginação da auditoria existente.

O cursor de outra conta/conexão/produto é recusado. Um cursor além do final do diário também é recusado; ele não faz o consumidor saltar silenciosamente eventos ainda inexistentes. Exportar o lote não altera os acknowledgements do sincronizador R117.

Um lote pode conter zero registros e avançar o cursor se as linhas examinadas forem todas sem atribuição. O consumidor deve seguir `hasMore`, não concluir o histórico pela quantidade zero de registros. O consumidor persiste o cursor somente após processar o lote integralmente.

## Registro por revisão

Cada item tem schema `JENIOS_ULTRA_OPERATION_RECORD_R127` e `eventKind='operation_snapshot'`.

| Campo | Significado |
| --- | --- |
| `operationKey` | Identidade estável da operação técnica, derivada de conta vinculada, produto e ID da intenção. |
| `eventId` | Identidade estável de uma revisão daquela operação. |
| `sequence` | Posição na auditoria local para paginação; não é número de operação comercial. |
| `recordDigest` | Detecção de alteração do conteúdo do registro; não é assinatura nem autenticação. |
| `scope.currency` | Moeda da própria operação. Não existe conversão ou soma entre moedas. |
| `origin` | Robô, plataforma de origem, sessão, estratégia e digest da intenção. |
| `operation` | Snapshot integral validado pelo contrato histórico, com estado, quantidades, preços, horários, referências e valores. |
| `evidence` | Existência do vínculo local e do recibo da revisão; classificação fixa de simulação. |
| `result` | Situação e resultado após custos da corretora, quando calculável pelo contrato herdado. |

`operation` preserva: mercado, ativo, direção, criação, abertura, atualização, encerramento, quantidade solicitada/executada/encerrada, preços médios de entrada/saída, bruto, taxas/rebates, financiamento, valor em aberto, completude dos custos, referências e motivo.

Os campos atuais são snapshots agregados do ciclo. Eles não são um extrato de cada fill individual nem estabelecem uma alocação de funding/posição líquida entre robôs. Os normalizadores e coletores existentes preservam essas evidências separadamente; nenhuma alocação nova foi inventada neste delta.

### Estados do resultado

| `result.status` | Condição |
| --- | --- |
| `execution_uncertain` | Operação com estado desconhecido. Resultado final fica nulo. |
| `not_final` | Operação ainda não encerrada, inclusive preparada, enviada, parcial, cancelada sem execução ou recusada. |
| `unverified_snapshot` | Snapshot encerrado sem recibo correspondente e posição conciliada naquela revisão. Resultado final fica nulo. |
| `awaiting_costs` | Encerramento registrado por recibo local, mas custos incompletos. Resultado final fica nulo. |
| `closed_complete` | Encerramento e custos completos segundo o recibo fictício local. O cálculo reaproveita `operationNet`; isso não constitui resultado real certificado. |

`pendingFields` lista valores nulos de bruto, taxas e financiamento. `costsComplete=false` continua sendo uma pendência mesmo quando todos os componentes conhecidos são numéricos: a ausência de um campo nulo não confirma completude. Nenhum dado ausente vira zero. Rebates e financiamento negativo conservam seu sinal.

## Interface com relatório mensal e cobrança

O consumidor deve tratar cada item como **substituição integral de uma revisão da mesma operação**, não como um valor adicional:

1. Validar escopo e schema, incluindo origem de simulação. Um lote fictício não alimenta resultado real ou cobrança.
2. Deduplicar por `eventId`; o mesmo ID com conteúdo diferente exige investigação, não nova soma.
3. Manter a revisão mais recente por `operationKey`; chegada de uma revisão anterior não regride o estado.
4. Guardar a associação à sessão e à estratégia sem usar cada trade/revisão como um novo Start.
5. Separar contas, produtos, ambientes e moedas. Usar horários registrados, preservando o fuso da apuração definido pela outra frente.
6. Tratar atualização tardia de custos como revisão daquela operação; não contar novamente a operação encerrada.
7. Persistir resultados e cursor de ingestão de forma consistente no sistema consumidor já existente.

Os IDs econômicos do registro não incluem o nome JENIOS/Flow. Reabrir o mesmo diário por outra plataforma preserva a plataforma original registrada e os mesmos IDs, impedindo uma duplicação baseada apenas na troca do rótulo da interface.

**Nenhum consumidor mensal/produtivo foi conectado nesta entrega.** A futura passagem para evidência nativa exige conector autorizado, identidade nativa comprovada, correlação permanente de intenção/ordens/fills, custos por moeda e reconciliação demonstrados. Não basta mudar uma flag deste arquivo para transformar simulação em confirmação financeira.

## Validação executada

`node --test tests/platformUltraR127Records.test.mjs`: **13/13 testes aprovados**, sem falhas ou ignorados.

Cobertura focada: persistência antes do envio; parcial/cancelamento/saídas/custos tardios; replay e reinício; interoperabilidade de origem JENIOS/Flow; resultado incerto sem duplicar ordem; recusa e cancelamento sem lucro fictício; exclusão de registros manuais/legados; isolamento de conta/produto/conexão; rollback de intenção e recibo; paginação/moedas; revisão financeira sem recibo; contexto/cursores inválidos.

Todos usam SQLite temporário e `OfflineFixtureBroker`. Nenhuma API externa, credencial, SDK, terminal ou conta de demonstração foi acessada. Não houve execução de ordens reais nem alteração de cobrança, UI, contratos ou relatórios históricos.
