# R129 — apuração geral e ponte offline para Letter UM001

## Resultado

A composição acrescenta `monthly-general-r129.mjs` e `letter-monthly-r129.mjs`, em `lib/platform/ultra/client/`, preservando o relatório UM001 e duas dependências originais Letter CB016/UM001. Os hashes e as origens estão em `lib/platform/ultra/fixtures/letter-cb016/README-R129.md`. As cópias são byte-idênticas; nenhum cliente HTTP é instanciado. Não há rede financeira, SQL, cobrança, carteira, ordem ou execução real.

A apuração geral exige conjunto explícito de contas do mesmo cliente, ambiente, moeda, mês e fuso. Conserva cada grupo e inclui contas perdedoras. Não modifica `observedAccountCount` para satisfazer UM001. Não cria broker fictício para o agregado. Para múltiplas contas, `draft` e `emission.obligation_id` são `null`, com `LETTER_MULTI_ACCOUNT_CONTRACT_REQUIRED`.

Para uma conta, a composição reutiliza `assessMonthlyPerformance` original UM001, `prepareMonthlyPerformance` e `createSyntheticPerformanceLab` originais Letter. O laboratório demonstra minuta, fatura fictícia, pagamento fictício e gate da mesma instância. Consulta, conciliação, cancelamento e redução de risco permanecem disponíveis. Uma apuração pendente não se torna dívida emitida.

## Cálculo e limites

A fórmula preservada é ganhos brutos menos perdas brutas, custos de corretora, financiamento e custos elegíveis confirmados da plataforma. A performance é `max(lucro elegível mensal, 0) × percentual`. `individual` usa 2.000 pontos-base (20%); `included` usa 1.000 (10%) com identificação e evidência do plano. Custos gerais da plataforma são subtraídos uma vez, com referência de tratamento, sem repetição por conta.

| Ensaio exato | Resultado |
| --- | --- |
| Conta A: bruto +1.500, custos 100 | +1.400 BRL |
| Conta B: bruto −300, custos 100 | −400 BRL |
| Geral do mesmo cliente | +1.000 BRL |
| Individual / incluído | 200 BRL / 100 BRL preparados |
| Custo elegível geral adicional de 50 BRL | Base 950 BRL; 20% = 190 BRL |
| Perda mensal de 105 BRL ou zero observado | Performance zero, sem fatura |

Ausência de registros não é zero. Conta observada sem linhas mensais ou sem moeda conhecida mantém pendência. BRL e USDT ficam separados; não existe conversão implícita. Custos incompletos, parciais, incerteza, conflitos e perdas anteriores permanecem pendentes. Nenhuma compensação entre meses foi criada. Uma perda anterior observada não é apagada por `none_confirmed`. A aritmética usa inteiros e oito casas; precisão que exija arredondamento não definido permanece pendente. Assinatura, Start e DeFi continuam separados; assinatura anual não elimina performance.

## Preparação

```js
const letter = createLetterMonthlyR129({syntheticOnly: true});
const prepared = letter.prepare({
  recordEnvelope, month: '2026-10', timeZone: 'America/Bahia', now,
  settlementScope, expectedAccountKeys, accountBindings, policy, evidence,
  product: 'jenios', collectionProduct: 'jenios',
});
```

`product` também pode ser `kivoryn_flow`; JENIOS/Flow preservam uma obrigação compartilhada quando identidade e cálculo são os mesmos. `sources` é alternativa somente para fixtures UM001 independentes. Deve ser informado exatamente um entre `sources` e `recordEnvelope`. A integração do feed R129 usa o envelope completo, preservando paginação, exclusões, origem e pendências; repassar somente suas projeções não é uma integração qualificada do feed.

`settlementScope` contém `company_id`, `customer_id`, `billing_account_id`, `receiver_id`, `legal_entity_id`, `environment: 'demo'`, `currency`, `month` e `timezone`. Cada `accountBindings` contém essa identidade e `broker_account_id`, `source_account_key` original, `period_start` e `period_end`. `expectedAccountKeys` identifica o conjunto completo esperado, sem duplicatas. `policy.aggregationScope` é `single_account_confirmed` ou `explicit_account_set_confirmed`. A extensão multicontas é aditiva; o contrato original de emissão UM001 não foi modificado.

O retorno inclui `view`, `assessment`, `generalAssessment`, `draft`, `emission` e `sourcePendingReasons`. `generalAssessment.perAccount[].monthly` conserva o grupo original. A conta local `unverified:` não se torna identidade autenticada de corretora. O laboratório exige `recordEnvelope.fixtureBinding.clientId === settlementScope.customer_id`. Reetiquetar conta perdedora como de outro cliente/escopo mantém a pendência; mapeamento alternativo de IDs reais exige contrato futuro.

## Evidência vinculada do ensaio

O envelope bruto nunca fica pronto só com booleanos copiados ou `approved: true`. Além da evidência sintética normal exigida por UM001, requer:

```js
evidence.fixtureEvidence = {
  schema: 'JENIOS_ULTRA_MONTHLY_FIXTURE_EVIDENCE_R129',
  evidenceMode: 'offline_fixture',
  fixtureBinding: {registrationId, clientId, ownerScope, evidenceMode: 'offline_fixture'},
  envelopeSha256: monthlyFixtureDigestR129(recordEnvelope),
  settlementBindingSha256: monthlyFixtureDigestR129({settlementScope, accountBindings}),
  period: {month, timeZone, periodStart, periodEnd},
  accountKeys: [...expectedAccountKeys].sort(),
  reference: 'synthetic-known-coverage',
  accounts: expectedAccountKeys.map(accountKey => ({
    accountKey, coverageReference, identityReference, attributionReference,
    executionReference, fillDetailLimitationReference,
  })),
  resolvedReasons: [/* somente os códigos permitidos abaixo */],
  nativeFillDetail: false,
};
```

As referências devem ser explícitas e não vazias. A lista imutável de motivos resolvíveis somente no laboratório é `LOCAL_FIXTURE_ONLY`, `CLIENT_BINDING_UNVERIFIED`, `SOURCE_COVERAGE_PENDING`, `ACCOUNT_IDENTITY_PENDING`, `MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED`, `ULTRA_ATTRIBUTION_PENDING` e `FILL_DETAIL_PENDING`.

Os motivos originais permanecem em `sourcePendingReasons`; a resolução fica separada em `resolvedFixtureReasons`. Todos os flags de origem permanecem falsos, inclusive `sourceComplete`, `independentlyVerified`, `nativeValidated`, `financialActivationAllowed` e `billable`. Quantidades agregadas e `brokerRefs` não viram detalhes de fills nativos. Digests verificam consistência local, sem autenticação ou assinatura.

`EXECUTION_EVIDENCE_PENDING`, custos faltantes, incerteza, parciais, conflitos, posição histórica desconhecida, exclusões, corte anterior ao mês e `hasMore` não são dispensáveis. Alterar simultaneamente o destino em `settlementScope` e em todos os bindings invalida a prova anterior. Recalcular digest não contorna cliente canônico. Pendências globais e dos grupos selecionados bloqueiam prontidão; motivos de outra moeda permanecem visíveis sem contaminar a moeda selecionada.

## Fatura e gate fictícios

Após `letter.register(prepared)`, `markSyntheticAwaitingPayment(id, 'synthetic-invoice-...')` registra a fatura fictícia. `expectedSyntheticReceipt(id)` e `expectedSyntheticBinding(id)` fornecem contratos esperados. A fixture de pagamento passa por `observeSyntheticLetter({authority:'letter-synthetic-lab', synthetic_only:true, receipt, binding})`; somente seu snapshot privado, atual e da mesma instância é aceito por `confirmSyntheticPayment(id, snapshot)`. Clones e snapshots de outra instância são recusados. Replay não libera duas vezes; contradição posterior exige conciliação e reabre o bloqueio, preservando redução de risco.

```js
const performanceAuthority = letter.createPerformanceAuthority({
  fixtureBinding,
  cycleBinding: {accountKey, ownerKey, cycleId}, // IDs synthetic:...
  gateIdentity: {customer_id, billing_account_id, environment: 'demo'},
  now: () => clock.now,
});
```

São obrigatórias as igualdades `customer_id === fixtureBinding.clientId`, `ownerKey === fixtureBinding.ownerScope` e `accountKey === billing_account_id`. Essa é a conta central fictícia Start/Letter, distinta do `accountBinding` da corretora. Várias corretoras podem compartilhar uma conta central com ciclos distintos. Nenhum mapa implícito é criado.

O callback recebe `{fixtureBinding, cycleBinding, sessionId, stage, request}` com `stage: 'preflight' | 'submitProtected'`. Retorna sincronicamente schema `JENIOS_ULTRA_PERFORMANCE_AUTHORITY_R129`, source `letter.monthly.r129`, vínculos, `observedAtMs`, o gate atual e `authorityInstanceId: 'letter-lab-r129:<UUID-v4>'`. O UUID é privado, gerado internamente uma vez, sem parâmetro do chamador. O runtime fixa essa identidade; uma instância nova/vazia não substitui a anterior silenciosamente. Perda da autoridade exige conciliação, mantendo aberturas bloqueadas. A ponte não acrescenta persistência financeira ao laboratório original. Não há Promise, aprovação em cache ou saldo de interface nesse caminho.

## Validação

```sh
node --test tests/platformUltraLetterMonthlyR129.test.mjs
```

São 18 testes dirigidos: resultado geral incluindo perdas; 20/10; custo único; omissão de contas e ausência; perda mensal; custos/precisão/perdas anteriores; cliente/moeda; feed bruto; prova vinculada; pendências não dispensáveis; destino alterado em conjunto; pagamento da mesma instância; replay/contradição; espelhos JENIOS/Flow; gate atualizado; identidades canônicas e de instância; hashes e recusa de autoridade nativa. Os envelopes desses testes são projeções fictícias explícitas da fronteira. Ingestão do ledger offline e retomada de sessão com troca de instância pertencem aos testes de registros/runtime e à qualificação composta R129. Não foram rodadas suítes históricas completas nesta frente.

Permanecem pendentes emissão multicontas, políticas entre meses, conversão e arredondamento não definidos, identidade/apuração autoritativas, finalidade central de produção, reconciliação durável de pagamento/estorno e homologação. Start, mensalidade, assinatura e DeFi não foram alterados.
