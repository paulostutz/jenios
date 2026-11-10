# Ultra R127 — admissão de aberturas e recuperação em fixtures

Data: 10/11/2026, America/Bahia. Candidata local de validação de software. Nenhum adaptador nativo, SDK, API externa de demonstração ou conta real foi utilizado.

## Base reaproveitada

O delta estende `UltraExecutionRuntime` R118 e usa o mesmo `ExecutionLedger`/`OperationLedger` SQLite. Mantém seleção R53, direção R18, matemática de dimensionamento, limites de capital/perda/concentração, aceite de alavancagem e os métodos existentes de intenção, envio, recibo, reconciliação, cancelamento e redução. O escopo de instrumentos vem de `ultraInstrumentScopeR125`. Não altera os arquivos históricos, cobrança, relatório mensal, taxa de Start, UI ou rotas de servidor.

As intenções já eram persistidas antes de `submitProtected`; timeouts já produziam estado incerto, e a recuperação já consultava a intenção original. Parciais, cancelamento do restante, fechamento parcial/final e custos tardios já eram representados. Esses recursos foram preservados e usados na composição R127, não apresentados como implementação nova.

## Lacunas identificadas e corrigidas

1. O `start` R118 não exigia `tradingAllowed` no resultado de inspeção. R127 exige permissão explícita e uma fotografia completa da conta após consultar as intenções pendentes.
2. O runtime anterior usava o ranking legado sem aplicar o escopo R125. R127 mantém o ranking e acrescenta elegibilidade por fornecedor/produto/conta, habilitação explícita do instrumento, contrato B3 WIN/WDO com vencimento e quotes válidas. Forex e ações comuns ficam fora de novas configurações R127.
3. As observações, a conta e o preflight não estavam ligados à mesma geração/revisão de conexão. R127 verifica essa continuidade antes/depois das leituras e imediatamente antes de chamar o envio. Mudança de identidade, inventário incompleto, stream desconhecido, refs não conciliadas, dados antigos ou estado alterado pausam novas aberturas.
4. Uma instância nova não reutiliza uma indicação antiga de prontidão. Exige `start` e nova conciliação; o fingerprint esperado é fixado no estado local existente e divergências na reabertura são recusadas.
5. Mesmo após o commit da intenção, a idade da quote/conta é conferida antes do adaptador. Falha nessa janela não dispara a chamada. A intenção permanece incerta e não é reenviada automaticamente, em vez de inventar um recibo de rejeição da corretora.
6. A revisão independente encontrou que a identidade também precisava ser conferida antes de proteger/cancelar/reduzir exposição. Esses métodos agora exigem identidade e conexão atuais antes da chamada, sem exigir as permissões e a completude necessárias para novas aberturas. A fixture B3 foi ajustada para lote/passo inteiros, coerentes com contratos.

## Arquivos

- `lib/platform/ultra/client/execution-runtime-r127.mjs`: `UltraExecutionRuntimeR127`, subclasse do R118.
- `lib/platform/ultra/client/runtime-fixture-r127.mjs`: `OfflineFixtureBrokerR127`, extensão do broker fictício R118 para gerar inventário e metadata sintéticos.
- `tests/platformUltraR127Runtime.test.mjs`: 24 testes novos direcionados às guardas e sua compatibilidade com os controles existentes.

O runtime aceita `AttributedExecutionLedgerR127`, que acrescenta a origem/estratégia da intenção em transação no ledger existente. Quando há `recordScope`, o runtime confere ambiente, fornecedor e produto antes de usar o ledger; o produto `b3_mini` do runtime corresponde explicitamente a `b3` no contrato de registros.

## Contrato do adaptador no laboratório

O construtor recebe `config`, `market`, `ledger`, `adapter`, `scope`, `now` e `onWarning`. A configuração é validada pela política R125 e passada ao núcleo R118 sem mudar sua matemática.

`scope` possui exatamente `provider`, `environment: "demo"`, `product` e `accountFingerprint`. Os produtos aceitos são `spot`, `usds_m_futures` e `b3_mini`, nas rotas compatíveis. `executionEnvironment` precisa ser `offline_fixture`; `live`, `demo`, `testnet` e valores ausentes são recusados como modo do adaptador.

Além dos métodos R118, o adaptador de teste fornece `runtimeState()` com:

- `accountBinding`, `accountFingerprint`, `provider`, `environment` e `product` exatos;
- `generation` para a sessão de conexão e `revision` para a revisão do estado relevante;
- `observedAtMs` recente;
- `connected`, `tradingAllowed`, `streamSynchronized`, `ordersComplete`, `positionsComplete` e `fillsComplete` explicitamente verdadeiros;
- `unresolvedReferences` vazio somente após conciliação completa do escopo.

A leitura `account()` precisa ter o mesmo vínculo, moeda, `connectionGeneration` e `stateRevision`, além dos campos de risco já exigidos pelo R118. A revisão deve mudar quando qualquer estado relevante à abertura mudar. Esses campos são um contrato validado com fixtures: não são autenticação, autoridade de negociação nem comprovação de um feed nativo.

Cada instrumento mantém a metadata R125 e acrescenta `tradingEnabled`, fornecedor, ambiente e fingerprint. Em cripto, a elegibilidade interna da metadata deve coincidir com esse mesmo fingerprint e produto. Observações inválidas são desabilitadas sem removê-las da lista, preservando a recusa herdada de símbolos duplicados.

## Pausa, cancelamento e redução

Falha de reconciliação pausa novas aberturas. Os métodos `cancel`, `close` e `closePositions` continuam utilizando o caminho R118 de consulta, comprovação de propriedade, quantidade remanescente, intenção durável e recibo confirmado. Antes de `cancelRemainder`, `closeOwned` ou `protectExisting`, R127 confere novamente conexão, idade, conta, fingerprint, fornecedor, ambiente e produto. Essa conferência não exige `tradingAllowed`, stream completo ou histórico completo de fills; portanto, perder autorização de novas aberturas não desativa por si só a redução de exposição. Uma restrição real do fornecedor pode impedir uma redução; o código não a contorna nem transforma indisponibilidade em fechamento concluído.

O estado de prontidão é gravado por `saveTransport` na tabela local existente, com `nativeValidated=false`, `liveExecutionAllowed=false` e `externalPaperAllowed=false`. Não há novo ledger financeiro, cobrança ou autorização remota.

## Validação executada

`node --test tests/platformUltraR127Runtime.test.mjs`: **24/24 aprovados**. Cenários incluem permissão ausente, inventário/stream incompleto, identidade/idade divergentes, vínculo de revisão, instrumento desabilitado, elegibilidade de outra conta/produto, escopo WIN/WDO com contratos inteiros, duplicidade preservada, quotes cruzadas, mudança durante preflight, falha entre intenção e envio, timeout/restart sem duplicação, cancelamento/redução após suspensão de aberturas, troca de conta antes de cancelamento/redução/proteção e distinção aceite/fill/recusa.

O conjunto integrado do agente raiz também usa esta classe com registros atribuídos em quatro fixtures (JENIOS Spot, Flow Futures, JENIOS mini índice, Flow mini dólar). Seu relatório e contagem são separados dos 24 testes próprios deste arquivo. A execução dirigida após esses ajustes totalizou 28/28 aprovações, incluindo os quatro integrados.

Não foi repetida a suíte histórica inteira. Todos os dados, símbolos de demonstração e permissões deste teste são fictícios; `WINZ99`/`WDOZ99` não são recomendações nem contratos consultados. Não foram demonstrados conexão autenticada, roteamento, proteção nativa, lucro, disponibilidade regional de Futures ou operação autônoma real. Esses pontos continuam dependendo dos adaptadores nativos, ambiente autorizado e validação por fornecedor/produto.
