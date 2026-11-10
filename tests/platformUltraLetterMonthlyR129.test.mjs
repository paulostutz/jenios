import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {initialOperation} from '../lib/platform/ultra/operation.mjs';
import {consolidateMonthlyReports} from '../lib/platform/ultra/client/monthly-report-um001.mjs';
import {assessGeneralMonthlyR129} from '../lib/platform/ultra/client/monthly-general-r129.mjs';
import {createLetterMonthlyR129,monthlyFixtureDigestR129} from '../lib/platform/ultra/client/letter-monthly-r129.mjs';

const now=Date.parse('2026-11-10T20:00:00Z'),month='2026-10',timeZone='America/Bahia';
const copy=value=>structuredClone(value);
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const fixtureBinding={registrationId:'synthetic-registration',clientId:'synthetic-client',ownerScope:'synthetic:owner',evidenceMode:'offline_fixture'};
const scope={company_id:'synthetic-company',customer_id:'synthetic-client',billing_account_id:'synthetic:account',receiver_id:'synthetic-letter-receiver',legal_entity_id:'synthetic-letter-entity',environment:'demo',currency:'BRL',month,timezone:timeZone};
const localCodes=['LOCAL_FIXTURE_ONLY','CLIENT_BINDING_UNVERIFIED','SOURCE_COVERAGE_PENDING','MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED'];
const resolvable=[...localCodes,'ACCOUNT_IDENTITY_PENDING','ULTRA_ATTRIBUTION_PENDING','FILL_DETAIL_PENDING'];
const reasons=codes=>[...new Set(codes)].sort().map(code=>({code,label:code}));
const seconds=value=>value.replace('.000Z','Z');
function closed(id,gross,fees,{currency='BRL',...patch}={}){
 const opened='2026-10-15T12:00:00Z',ended='2026-10-15T13:00:00Z',market=currency==='USDT'?'crypto':'b3';
 return {...initialOperation({market,symbol:market==='b3'?'WINZ26':'BTCUSDT',currency,side:'buy',quantity:'1'},id,Date.parse(opened)),state:'closed',openedAt:opened,closedAt:ended,updatedAt:ended,entryQuantity:'1',exitQuantity:'1',entryPrice:'100',exitPrice:'101',gross,fees,financing:'0',costsComplete:true,brokerRefs:[id+'-broker'],...patch};
}
function source(sourceId,operations,{fingerprint=sourceId==='account-a'?'a'.repeat(64):'b'.repeat(64),provider=operations[0]?.market==='crypto'?'binance':'profit'}={}){
 return {sourceId,platform:'jenios',report:{schema:'JENIOS_ULTRA_OPERATIONS_V1',provider,environment:'demo',connectionLabel:'Conta fictícia R129',...(fingerprint?{accountFingerprint:fingerprint}:{}),generatedAt:new Date(now).toISOString(),operations}};
}
const one=()=>[source('account-a',[closed('gain','1500','100'),closed('loss','-300','100')])];
const two=()=>[source('account-a',[closed('gain','1500','100')]),source('account-b',[closed('loss','-300','100')])];
function setup(sources=one(),{mode='individual',currency='BRL',recordEnvelope=null}={}){
 const view=recordEnvelope?.view??consolidateMonthlyReports(sources,{month,timeZone,now});
 const accountKeys=view.groups.filter(group=>group.currency===currency&&group.environment==='demo').map(group=>group.accountKey).sort();
 const input={sources,month,timeZone,now,settlementScope:{...scope,currency},expectedAccountKeys:accountKeys,
  accountBindings:view.groups.map((group,index)=>({...scope,currency:group.currency,environment:group.environment,source_account_key:group.accountKey,broker_account_id:'synthetic-broker-'+index,period_start:seconds(view.periodStart),period_end:seconds(view.periodEnd)})),
  policy:{version:'synthetic-policy-r129',mode,planId:mode==='included'?'synthetic-included-plan':null,eligibilityReference:'synthetic-policy-fixture',aggregationScope:accountKeys.length===1?'single_account_confirmed':'explicit_account_set_confirmed',timeZone,timezoneReference:'synthetic-period'},
  evidence:{sourceComplete:true,brokerReconciled:true,identityConfirmed:true,ultraAttributionConfirmed:true,settlementScopeComplete:true,platformCosts:{complete:true,eligibleAmount:'0',treatmentReference:'synthetic-general-platform-costs'},priorLosses:{status:'none_confirmed',reference:'synthetic-complete-prior-history'},sha256:hash(sources)},product:'jenios',collectionProduct:'jenios'};
 if(recordEnvelope){delete input.sources;input.recordEnvelope=recordEnvelope;}return {view,input};
}
function envelope(sources=one(),{global=[]}={}){
 // Explicit fake projection for this boundary. Records tests cover ingestion
 // from the real offline ledger; this fixture makes no claim of native fills.
 sources=sources.map(item=>{const {accountFingerprint,...report}=item.report;return {...item,report};});
 const view=consolidateMonthlyReports(sources,{month,timeZone,now});
 const groups=view.groups.map(monthly=>({scope:{clientId:fixtureBinding.clientId,ownerScope:fixtureBinding.ownerScope,currency:monthly.currency,environment:monthly.environment},monthly,pendingReasons:reasons([...localCodes,'FILL_DETAIL_PENDING',...monthly.pendingReasons.map(reason=>reason.code)])}));
 const globalPendingReasons=reasons([...localCodes,...global]),pendingReasons=reasons([...globalPendingReasons,...groups.flatMap(group=>group.pendingReasons)].map(reason=>reason.code));
 const output={schema:'JENIOS_ULTRA_RECORD_MONTHLY_R129',fixtureBinding,fixtureBindingDigest:hash(fixtureBinding),evidenceMode:'offline_fixture',month,timeZone,periodStart:view.periodStart,periodEnd:view.periodEnd,periodClosed:true,view,groups,sources,pendingReasons,globalPendingReasons,digestIsAuthentication:false,sourceComplete:false,independentlyVerified:false,nativeValidated:false,financialActivationAllowed:false,billingDecisionIncluded:false,billable:false,debitExecuted:false};
 return {...output,reportDigest:hash(output)};
}
function fixtureEvidence(input){
 const value=input.recordEnvelope,view=value.view;
 return {schema:'JENIOS_ULTRA_MONTHLY_FIXTURE_EVIDENCE_R129',evidenceMode:'offline_fixture',fixtureBinding:copy(value.fixtureBinding),envelopeSha256:monthlyFixtureDigestR129(value),settlementBindingSha256:monthlyFixtureDigestR129({settlementScope:input.settlementScope,accountBindings:input.accountBindings}),period:{month:view.month,timeZone:view.timeZone,periodStart:view.periodStart,periodEnd:view.periodEnd},accountKeys:[...input.expectedAccountKeys].sort(),reference:'synthetic-harness-known-coverage',nativeFillDetail:false,resolvedReasons:[...resolvable],accounts:input.expectedAccountKeys.map(accountKey=>({accountKey,coverageReference:'synthetic-complete-inventory',identityReference:'synthetic-client-registry',attributionReference:'synthetic-origin',executionReference:'synthetic-ledger-receipts',fillDetailLimitationReference:'synthetic-aggregates-no-native-fills'}))};
}
function explicitEnvelope(value=envelope(),options={}){const {input}=setup(value.sources,{...options,recordEnvelope:value});input.evidence.fixtureEvidence=fixtureEvidence(input);return input;}
const lab=()=>createLetterMonthlyR129({syntheticOnly:true});
const gateIdentity={customer_id:scope.customer_id,billing_account_id:scope.billing_account_id,environment:'demo'};
function paidSnapshot(wrapper,id){return wrapper.observeSyntheticLetter({authority:'letter-synthetic-lab',synthetic_only:true,receipt:{...wrapper.expectedSyntheticReceipt(id),state:'paid',verified_paid:true,proof_sha256:'c'.repeat(64),confirmed_at:'2026-11-10T20:00:00Z'},binding:wrapper.expectedSyntheticBinding(id)});}

test('R129 general result includes losing accounts at 20% and 10% without a fabricated Letter account',()=>{
 for(const [mode,amount] of [['individual',20000],['included',10000]]){
  const wrapper=lab(),r=wrapper.prepare(setup(two(),{mode}).input);
  assert.equal(r.assessment.complete,true);assert.equal(r.assessment.calculation.brokerNet,'1000.00000000');assert.equal(r.assessment.performance_minor,amount);
  assert.deepEqual([r.assessment.calculation.gains,r.assessment.calculation.losses,r.assessment.calculation.brokerFees],['1500.00000000','300.00000000','200.00000000']);
  assert.deepEqual(r.generalAssessment.perAccount.map(account=>account.monthly.confirmed.net),['1400.00000000','-400.00000000']);
  assert.ok(r.generalAssessment.perAccount.every(account=>account.monthly.observedAccountCount===2));assert.equal(r.assessment.calculation.accountKey,null);
  assert.equal(r.draft,null);assert.equal(r.emission.obligation_id,null);assert.ok(r.emission.pendingReasons.includes('LETTER_MULTI_ACCOUNT_CONTRACT_REQUIRED'));
  assert.throws(()=>wrapper.register(r),/LETTER_MULTI_ACCOUNT_CONTRACT_REQUIRED/);assert.deepEqual(wrapper.audit(),[]);
 }
});

test('R129 cannot choose winning accounts, drop bindings or invent a missing zero account',()=>{
 const {view,input}=setup(two()),winning=view.groups.find(group=>group.confirmed.net==='1400.00000000');input.expectedAccountKeys=[winning.accountKey];input.policy.aggregationScope='single_account_confirmed';
 const selected=lab().prepare(input);assert.equal(selected.assessment.complete,false);assert.equal(selected.generalAssessment.calculation.brokerNet,null);assert.ok(selected.generalAssessment.pending_reasons.includes('R129_ACCOUNT_SET_MISMATCH'));
 const missing=setup(two()).input;missing.accountBindings=missing.accountBindings.slice(0,1);assert.equal(lab().prepare(missing).assessment.complete,false);
 const unobserved=setup().input;unobserved.expectedAccountKeys.push('["profit","demo","unobserved-account"]');unobserved.policy.aggregationScope='explicit_account_set_confirmed';
 const empty=lab().prepare(unobserved);assert.equal(empty.assessment.calculation.brokerNet,null);assert.equal(empty.assessment.eligible_profit_minor,null);assert.ok(empty.assessment.pending_reasons.includes('NO_CLOSED_RESULT'));
});

test('R129 subtracts general platform costs once and never charges monthly loss or observed zero',()=>{
 const positive=setup(two()).input;positive.evidence.platformCosts.eligibleAmount='50';const r=lab().prepare(positive);
 assert.equal(r.assessment.calculation.eligibleProfit,'950.00000000');assert.equal(r.assessment.performance_minor,19000);
 for(const [gross,fees,net] of [['-100','5',-10500],['5','5',0]]){
  const wrapper=lab(),value=wrapper.prepare(setup([source('account-a',[closed('result',gross,fees)])]).input);assert.equal(value.assessment.eligible_profit_minor,net);assert.equal(value.draft.status,'no_performance_due');assert.equal(value.draft.performance_minor,0);wrapper.register(value);
  assert.throws(()=>wrapper.markSyntheticAwaitingPayment(value.draft.obligation_id,'synthetic-no-invoice'),/DRAFT_NOT_ISSUABLE/);
 }
});

test('R129 costs, precision and prior-month losses stay pending without invented policies',()=>{
 const costs=setup([source('account-a',[closed('known','1500','100'),closed('unknown','-300',null,{costsComplete:false})])]).input,c=lab().prepare(costs);
 assert.ok(c.assessment.pending_reasons.includes('COSTS_PENDING'));assert.equal(c.draft.performance_minor,null);
 const treatment=setup().input;delete treatment.evidence.platformCosts;assert.ok(lab().prepare(treatment).assessment.pending_reasons.includes('PLATFORM_COST_TREATMENT_PENDING'));
 assert.ok(lab().prepare(setup([source('account-a',[closed('fraction','0.01','0')])]).input).assessment.pending_reasons.includes('ROUNDING_POLICY_PENDING'));
 const earlier=closed('old-loss','-100','0',{createdAt:'2026-09-15T12:00:00Z',openedAt:'2026-09-15T12:00:00Z',closedAt:'2026-09-15T13:00:00Z',updatedAt:'2026-09-15T13:00:00Z'});
 const old=lab().prepare(setup([source('account-a',[...one()[0].report.operations,earlier])]).input);
 assert.ok(old.assessment.pending_reasons.includes('OBSERVED_PRIOR_LOSS_PENDING'));assert.equal(old.draft.performance_minor,null);assert.equal(old.generalAssessment.calculation.brokerNet,'1000.00000000');
});

test('R129 isolates clients and currencies and keeps USDT without invented conversion',()=>{
 const sources=[...two(),source('crypto-account',[closed('crypto-gain','500','0',{currency:'USDT'})],{provider:'binance',fingerprint:'c'.repeat(64)})];
 const brl=lab().prepare(setup(sources).input);assert.equal(brl.assessment.calculation.brokerNet,'1000.00000000');assert.equal(brl.assessment.complete,true);assert.equal(brl.generalAssessment.excludedGroups.length,1);
 const usdt=lab().prepare(setup(sources,{currency:'USDT'}).input);assert.equal(usdt.assessment.calculation.brokerNet,'500.00000000');assert.ok(usdt.assessment.pending_reasons.includes('CURRENCY_CONVERSION_PENDING'));assert.equal(usdt.emission.eligibleForSyntheticInvoice,false);
 const {view,input}=setup(two());input.accountBindings[1].customer_id='other-client';input.expectedAccountKeys=[input.accountBindings[0].source_account_key];input.policy.aggregationScope='single_account_confirmed';
 const partition=assessGeneralMonthlyR129(view,{...input,syntheticOnly:true});assert.equal(partition.calculation.brokerNet,'1400.00000000');assert.equal(partition.perAccount.length,1);
});

test('R129 raw feed cannot become ready from generic approval or copied completeness booleans',()=>{
 const value=envelope(),{input}=setup(value.sources,{recordEnvelope:value});input.evidence.approved=true;const r=lab().prepare(input);
 assert.equal(r.assessment.complete,false);assert.equal(r.draft.performance_minor,null);
 for(const code of [...localCodes,'FILL_DETAIL_PENDING','R129_FIXTURE_COVERAGE_REQUIRED'])assert.ok(r.assessment.pending_reasons.includes(code),code);
 assert.equal(r.view.sourceComplete,false);assert.equal(r.view.independentlyVerified,false);assert.equal(r.billable,false);
});

test('R129 bound fixture evidence resolves only local limits and preserves original flags and limitations',()=>{
 const input=explicitEnvelope(),before=JSON.stringify(input),r=lab().prepare(input);
 assert.equal(r.assessment.complete,true);assert.equal(r.draft.status,'prepared');assert.equal(r.draft.performance_minor,20000);assert.equal(r.assessment.nativeFillDetail,false);
 assert.ok(r.sourcePendingReasons.some(reason=>reason.code==='FILL_DETAIL_PENDING'));assert.ok(r.assessment.resolvedFixtureReasons.includes('FILL_DETAIL_PENDING'));
 assert.equal(r.view.groups[0].accountFingerprint,null);assert.equal(r.view.groups[0].sourceComplete,false);assert.equal(JSON.stringify(input),before);assert.equal(r.realIntegration,false);
});

test('R129 evidence is bound to registration, exact envelope, period and account set',()=>{
 for(const mutate of [e=>{e.fixtureBinding.clientId='other-client';},e=>{e.envelopeSha256='f'.repeat(64);},e=>{e.period.month='2026-09';},e=>{e.accountKeys.push('other-account');},e=>{delete e.accounts[0].coverageReference;},e=>{e.nativeFillDetail=true;}]){
  const input=explicitEnvelope();mutate(input.evidence.fixtureEvidence);const r=lab().prepare(input);assert.equal(r.assessment.complete,false);assert.ok(r.assessment.pending_reasons.includes('R129_FIXTURE_EVIDENCE_MISMATCH'));assert.equal(r.draft.performance_minor,null);
 }
 const changed=explicitEnvelope();changed.recordEnvelope.groups[0].scope.clientId='other-client';const {reportDigest,...payload}=changed.recordEnvelope;changed.recordEnvelope.reportDigest=hash(payload);
 assert.throws(()=>lab().prepare(changed),/RECORD_CLIENT_SCOPE_MISMATCH/);
});

test('R129 partials, uncertain execution, conflicts, excluded rows and pagination gaps cannot be waived',()=>{
 for(const code of ['COSTS_PENDING','PARTIAL_ALLOCATION_PENDING','EXECUTION_UNCERTAIN','EXECUTION_EVIDENCE_PENDING','DUPLICATE_CONFLICT','UNATTRIBUTED_RECORDS_EXCLUDED','MORE_LOCAL_RECORDS_PENDING']){
  const input=explicitEnvelope(envelope(undefined,{global:[code]})),r=lab().prepare(input);assert.equal(r.assessment.complete,false,code);assert.ok(r.assessment.pending_reasons.includes(code),code);assert.equal(r.draft.performance_minor,null);
  input.evidence.fixtureEvidence.resolvedReasons.push(code);const forced=lab().prepare(input);assert.ok(forced.assessment.pending_reasons.includes('R129_FIXTURE_REASON_NOT_RESOLVABLE'));assert.equal(forced.draft.performance_minor,null);
 }
});

test('R129 another currency cost gap remains visible without contaminating BRL',()=>{
 const sources=[...one(),source('crypto-account',[closed('crypto-pending','100',null,{currency:'USDT',costsComplete:false})],{provider:'binance'})];
 const r=lab().prepare(explicitEnvelope(envelope(sources)));assert.equal(r.assessment.complete,true);assert.equal(r.assessment.performance_minor,20000);
 assert.ok(r.sourcePendingReasons.some(reason=>reason.code==='COSTS_PENDING'));assert.equal(r.assessment.pending_reasons.includes('COSTS_PENDING'),false);assert.equal(r.generalAssessment.perAccount.length,1);
});

test('R129 same-client record envelope cannot hide a losing account as another customer',()=>{
 const input=explicitEnvelope(envelope(two()));input.accountBindings[1].customer_id='other-client';input.expectedAccountKeys=[input.accountBindings[0].source_account_key];input.policy.aggregationScope='single_account_confirmed';input.evidence.fixtureEvidence=fixtureEvidence(input);
 const r=lab().prepare(input);assert.equal(r.assessment.complete,false);assert.ok(r.assessment.pending_reasons.includes('R129_RECORD_CLIENT_SCOPE_MISMATCH'));assert.equal(r.draft.performance_minor,null);
});

test('R129 an observed account without monthly rows or a known currency is not an assumed zero',()=>{
 for(const currencies of [['BRL'],[]]){
  const value=envelope();value.observedScopes=[{accountKey:'unverified-observed-empty-account',environment:'demo',currencies}];
  const {reportDigest,...payload}=value;value.reportDigest=hash(payload);
  const r=lab().prepare(explicitEnvelope(value));assert.equal(r.assessment.complete,false);
  assert.ok(r.assessment.pending_reasons.includes('R129_ACCOUNT_BINDING_REQUIRED'));assert.equal(r.draft.performance_minor,null);
  if(!currencies.length)assert.ok(r.assessment.pending_reasons.includes('R129_OBSERVED_ACCOUNT_CURRENCY_PENDING'));
 }
});

test('R129 fixture evidence cannot be retargeted by changing scope and all account bindings together',()=>{
 for(const key of ['customer_id','billing_account_id','broker_account_id']){
  const input=explicitEnvelope();if(key!=='broker_account_id')input.settlementScope[key]='other-destination';
  for(const binding of input.accountBindings)binding[key]='other-destination';
  const r=lab().prepare(input);assert.equal(r.assessment.complete,false);assert.ok(r.assessment.pending_reasons.includes('R129_FIXTURE_EVIDENCE_MISMATCH'));assert.equal(r.draft.performance_minor,null);
  if(key==='customer_id'){
   input.evidence.fixtureEvidence=fixtureEvidence(input);const forged=lab().prepare(input);
   assert.ok(forged.assessment.pending_reasons.includes('R129_RECORD_CLIENT_SCOPE_MISMATCH'));assert.equal(forged.draft.performance_minor,null);
  }
 }
});

test('R129 original synthetic payment clears a debt only through a current snapshot from the same lab',()=>{
 const wrapper=lab(),r=wrapper.prepare(explicitEnvelope()),id=r.draft.obligation_id;wrapper.register(r);wrapper.markSyntheticAwaitingPayment(id,'synthetic-invoice-r129');
 assert.equal(wrapper.gate({...gateIdentity,action:'open'}).allowed_in_simulation,false);
 for(const action of ['consult','reconcile','cancel','reduce_risk'])assert.equal(wrapper.gate({...gateIdentity,action}).allowed_in_simulation,true);
 assert.equal(wrapper.gate({...gateIdentity,customer_id:'another-client',action:'open'}).allowed_in_simulation,true);
 const snapshot=paidSnapshot(wrapper,id);assert.throws(()=>wrapper.confirmSyntheticPayment(id,copy(snapshot)),/AUTHORITATIVE_LAB_SNAPSHOT_REQUIRED/);
 const other=lab(),otherResult=other.prepare(explicitEnvelope());other.register(otherResult);other.markSyntheticAwaitingPayment(id,'synthetic-invoice-r129');assert.throws(()=>other.confirmSyntheticPayment(id,snapshot),/AUTHORITATIVE_LAB_SNAPSHOT_REQUIRED/);
 assert.equal(wrapper.confirmSyntheticPayment(id,snapshot).released_once,true);assert.equal(wrapper.confirmSyntheticPayment(id,snapshot).released_once,false);assert.equal(wrapper.gate({...gateIdentity,action:'open'}).allowed_in_simulation,true);assert.equal(wrapper.gate({...gateIdentity,action:'open'}).actual_execution_authorized,false);
 wrapper.observeSyntheticLetter({authority:'letter-synthetic-lab',synthetic_only:true,receipt:{...wrapper.expectedSyntheticReceipt(id),state:'void'},binding:wrapper.expectedSyntheticBinding(id)});
 assert.equal(wrapper.gate({...gateIdentity,action:'open'}).allowed_in_simulation,false);assert.equal(wrapper.gate({...gateIdentity,action:'reduce_risk'}).allowed_in_simulation,true);
});

test('R129 JENIOS and Flow share one obligation while subscription, Start and DeFi remain separate',()=>{
 const wrapper=lab(),input=setup().input,a=wrapper.prepare(input),b=wrapper.prepare({...input,product:'kivoryn_flow'});
 assert.equal(a.draft.obligation_id,b.draft.obligation_id);assert.equal(a.draft.fingerprint,b.draft.fingerprint);assert.equal(wrapper.register(a).created,true);assert.equal(wrapper.register(b).created,false);assert.deepEqual(wrapper.read(a.draft.obligation_id).source_products,['jenios','kivoryn_flow']);
 assert.deepEqual(a.draft.separation,{subscription:'separate',annual_waives_performance:false,defi:'unchanged',start:'separate'});assert.equal(a.assessment.calculation.subscriptionSeparate,true);assert.equal(a.assessment.calculation.annualSubscriptionWaivesPerformance,false);assert.throws(()=>wrapper.register(copy(a)),/PREPARATION_FROM_THIS_INSTANCE_REQUIRED/);
});

test('R129 synchronous authority rechecks the same lab at preflight and final submission',()=>{
 const wrapper=lab(),cycleBinding={accountKey:'synthetic:account',ownerKey:'synthetic:owner',cycleId:'synthetic:cycle'},callback=wrapper.createPerformanceAuthority({fixtureBinding,cycleBinding,gateIdentity,now:()=>now});
 const args={fixtureBinding,cycleBinding,sessionId:'synthetic-session',stage:'preflight',request:{action:'open'}};
 assert.equal(callback(args).gate.allowed_in_simulation,true);const r=wrapper.prepare(explicitEnvelope()),id=r.draft.obligation_id;wrapper.register(r);wrapper.markSyntheticAwaitingPayment(id,'synthetic-gate-invoice');
 const after=callback({...args,stage:'submitProtected'});assert.equal(after.schema,'JENIOS_ULTRA_PERFORMANCE_AUTHORITY_R129');assert.equal(after.source,'letter.monthly.r129');assert.match(after.authorityInstanceId,/^letter-lab-r129:[0-9a-f-]{36}$/);assert.equal(after.authorityInstanceId,callback(args).authorityInstanceId);assert.equal(after.gate.allowed_in_simulation,false);assert.equal(after.observedAtMs,now);assert.deepEqual(after.cycleBinding,cycleBinding);assert.deepEqual(after.fixtureBinding,fixtureBinding);assert.equal(after.gate.actual_execution_authorized,false);
 assert.throws(()=>callback({...args,fixtureBinding:{...fixtureBinding,clientId:'another-client'}}),/AUTHORITY_SCOPE_MISMATCH/);assert.throws(()=>callback({...args,cycleBinding:{...cycleBinding,cycleId:'synthetic:other'}}),/AUTHORITY_SCOPE_MISMATCH/);assert.throws(()=>callback({...args,stage:'unvalidated'}),/AUTHORITY_SCOPE_MISMATCH/);
 wrapper.confirmSyntheticPayment(id,paidSnapshot(wrapper,id));assert.equal(callback({...args,stage:'submitProtected'}).gate.allowed_in_simulation,true);
});

test('R129 authority identity is private per instance and refuses a different canonical client or owner',()=>{
 const cycleBinding={accountKey:'synthetic:account',ownerKey:'synthetic:owner',cycleId:'synthetic:cycle'};
 const input={fixtureBinding,cycleBinding,gateIdentity,now:()=>now},args={fixtureBinding,cycleBinding,sessionId:'synthetic-session',stage:'preflight'};
 const a=lab(),b=lab();assert.notEqual(a.createPerformanceAuthority(input)(args).authorityInstanceId,b.createPerformanceAuthority(input)(args).authorityInstanceId);
 assert.throws(()=>a.createPerformanceAuthority({...input,gateIdentity:{...gateIdentity,customer_id:'other-client'}}),/CANONICAL_BINDING_MISMATCH/);
 assert.throws(()=>a.createPerformanceAuthority({...input,cycleBinding:{...cycleBinding,ownerKey:'synthetic:other-owner'}}),/CANONICAL_BINDING_MISMATCH/);
 assert.throws(()=>a.createPerformanceAuthority({...input,gateIdentity:{...gateIdentity,billing_account_id:'synthetic:other-billing-account'}}),/CANONICAL_BINDING_MISMATCH/);
});

test('R129 preserves original bytes and refuses non-synthetic or imported authority claims',()=>{
 const prefix='../lib/platform/ultra/fixtures/letter-cb016/packages/group-billing/';
 for(const [file,expected] of [['clients/central-billing-client.mjs','d723887eda5b084e3fa8f8d8b57ee303a4ec469fdf471f4db5a45adb6ed1addc'],['candidates/ultra-monthly-um001/monthly-performance.mjs','313cb4db3c8538ebd7abf66b7667a67be67962a5abb9d1230d06070c71924993']])assert.equal(createHash('sha256').update(readFileSync(new URL(prefix+file,import.meta.url))).digest('hex'),expected);
 assert.throws(()=>createLetterMonthlyR129({syntheticOnly:false}),/SYNTHETIC_LETTER_ONLY/);
 const native=explicitEnvelope();native.recordEnvelope.nativeValidated=true;assert.throws(()=>lab().prepare(native),/IMPORTED_AUTHORITY_FORBIDDEN/);
 const live=setup().input;live.settlementScope.environment='live';assert.throws(()=>lab().prepare(live),/DEMO_MONTHLY_REQUIRED/);
});
