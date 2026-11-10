/** R129 offline composition: records/UM001 -> original Letter synthetic lab.
 * No HTTP client is constructed, no network is called, and no charge is real.
 * Original Letter drafts and payment snapshots retain their private branding.
 */
import {createHash,randomUUID} from 'node:crypto';
import {consolidateMonthlyReports,assessMonthlyPerformance} from './monthly-report-um001.mjs';
import {assessGeneralMonthlyR129,monthlyFixtureDigestR129} from './monthly-general-r129.mjs';
import {prepareMonthlyPerformance,createSyntheticPerformanceLab} from '../fixtures/letter-cb016/packages/group-billing/candidates/ultra-monthly-um001/monthly-performance.mjs';

export {monthlyFixtureDigestR129};
const copy=value=>structuredClone(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const token=value=>typeof value==='string'&&/^[-A-Za-z0-9_.:]{1,160}$/.test(value);
const identityKeys=['customer_id','billing_account_id','environment'];
const fixtureKeys=['registrationId','clientId','ownerScope','evidenceMode'];
const cycleKeys=['accountKey','ownerKey','cycleId'];
const bindingKeys=['company_id','customer_id','billing_account_id','broker_account_id','receiver_id','legal_entity_id','environment','currency','month','timezone','source_account_key','period_start','period_end'];
const equal=(a,b)=>monthlyFixtureDigestR129(a)===monthlyFixtureDigestR129(b);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const seconds=value=>typeof value==='string'?value.replace(/\.000Z$/,'Z'):value;
const fail=code=>{throw Object.assign(Error(code),{code});};
const same=(a,b,keys)=>plain(a)&&plain(b)&&keys.every(key=>a[key]===b[key]);
const validFixture=binding=>plain(binding)&&fixtureKeys.slice(0,3).every(key=>token(binding[key]))&&binding.evidenceMode==='offline_fixture'&&Object.keys(binding).length===fixtureKeys.length;
const validCycle=binding=>plain(binding)&&cycleKeys.every(key=>typeof binding[key]==='string'&&/^synthetic:[A-Za-z0-9:_-]{1,160}$/.test(binding[key]))&&Object.keys(binding).length===cycleKeys.length;
const validGate=identity=>plain(identity)&&token(identity.customer_id)&&token(identity.billing_account_id)&&identity.environment==='demo'&&Object.keys(identity).length===identityKeys.length;

function envelopeView(envelope,{month,timeZone}){
 if(!plain(envelope)||envelope.schema!=='JENIOS_ULTRA_RECORD_MONTHLY_R129'||!validFixture(envelope.fixtureBinding)
  ||envelope.evidenceMode!=='offline_fixture'||!Array.isArray(envelope.groups)||!plain(envelope.view))fail('R129_RECORD_ENVELOPE_REQUIRED');
 for(const key of ['sourceComplete','independentlyVerified','nativeValidated','financialActivationAllowed','billingDecisionIncluded','billable','debitExecuted'])if(envelope[key]!==false)fail('R129_IMPORTED_AUTHORITY_FORBIDDEN');
 if(envelope.digestIsAuthentication!==false)fail('R129_IMPORTED_AUTHORITY_FORBIDDEN');
 const {reportDigest,...payload}=envelope;
 const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 if(!/^[a-f0-9]{64}$/.test(reportDigest??'')||digest(payload)!==reportDigest)fail('R129_RECORD_ENVELOPE_DIGEST_MISMATCH');
 if(envelope.fixtureBindingDigest!==digest(envelope.fixtureBinding))fail('R129_RECORD_FIXTURE_BINDING_MISMATCH');
 const view=envelope.view;
 if((month!==undefined&&view.month!==month)||(timeZone!==undefined&&view.timeZone!==timeZone))fail('R129_MONTHLY_PERIOD_MISMATCH');
 for(const key of ['month','timeZone','periodStart','periodEnd','periodClosed'])if(view[key]!==envelope[key])fail('R129_RECORD_PERIOD_MISMATCH');
 if(!equal(view.groups,envelope.groups.map(group=>group.monthly)))fail('R129_RECORD_ENVELOPE_VIEW_MISMATCH');
 for(const group of envelope.groups){
  if(group.scope?.clientId!==envelope.fixtureBinding.clientId||group.scope?.ownerScope!==envelope.fixtureBinding.ownerScope
   ||group.scope?.currency!==group.monthly?.currency||group.scope?.environment!==group.monthly?.environment
   ||group.monthly?.accountFingerprint!==null)fail('R129_RECORD_CLIENT_SCOPE_MISMATCH');
 }
 return view;
}

function mergeAssessment(original,general,binding){
 const pending=[...new Set([...original.pending_reasons,...general.pending_reasons])].sort();
 const complete=original.complete===true&&general.complete===true&&pending.length===0;
 const scopeBinding=binding?Object.fromEntries(bindingKeys.map(key=>[key,['period_start','period_end'].includes(key)?seconds(binding[key]):binding[key]])):null;
 return {
  ...original,status:complete?original.status:'pending',complete,policy_resolution_confirmed:complete,
  pending_reasons:pending,pendingReasons:pending.map(code=>({code,label:code})),
  scope_binding:scopeBinding,sourcePendingReasons:general.sourcePendingReasons,
  resolvedFixtureReasons:general.resolvedFixtureReasons,fixtureEvidence:general.fixtureEvidence,
  financialActivationAllowed:false,nativeFillDetail:false,
 };
}

/** Each instance owns one original synthetic lab. Do not clone a draft/snapshot
 * into a second lab and treat it as an authoritative observation from this one.
 */
export function createLetterMonthlyR129(options={}){
 if(options.syntheticOnly!==true||Object.keys(options).some(key=>key!=='syntheticOnly'))fail('R129_SYNTHETIC_LETTER_ONLY');
 const lab=createSyntheticPerformanceLab({syntheticOnly:true}),prepared=new WeakSet();
 const authorityInstanceId='letter-lab-r129:'+randomUUID();
 const api={
  prepare(input={}){
   if(!plain(input)||!!input.recordEnvelope===!!input.sources)fail('R129_ONE_MONTHLY_SOURCE_REQUIRED');
   const view=input.recordEnvelope?envelopeView(input.recordEnvelope,input)
    :consolidateMonthlyReports(input.sources,{month:input.month,timeZone:input.timeZone??'America/Bahia',now:input.now??Date.now()});
   const general=assessGeneralMonthlyR129(view,{settlementScope:input.settlementScope,expectedAccountKeys:input.expectedAccountKeys,
    accountBindings:input.accountBindings,policy:input.policy,evidence:input.evidence,recordEnvelope:input.recordEnvelope??null,syntheticOnly:true});
   let assessment=general,draft=null;
   const single=general.expectedAccountKeys.length===1&&general.perAccount.length===1;
   if(single){
    const account=general.perAccount[0];
    const original=assessMonthlyPerformance(account.monthly,{period:view,policy:input.policy,evidence:input.evidence,syntheticOnly:true});
    assessment=mergeAssessment(original,general,account.binding);
    const scope={...input.settlementScope,broker_account_id:account.binding.broker_account_id,
     product:input.product,collection_product:input.collectionProduct,
     period_start:seconds(view.periodStart),period_end:seconds(view.periodEnd)};
    draft=prepareMonthlyPerformance({scope,assessment});
   }
   const multiple=general.expectedAccountKeys.length>1;
   const emission={
    status:multiple?'pending_multi_account_contract':draft?.status??'pending_account_scope',
    obligation_id:draft?.obligation_id??null,
    pendingReasons:multiple?['LETTER_MULTI_ACCOUNT_CONTRACT_REQUIRED',...general.pending_reasons]
     :draft?[...draft.pending_reasons,...draft.central_plan.pending_reasons]:['R129_SINGLE_ACCOUNT_RESULT_REQUIRED',...general.pending_reasons],
    eligibleForSyntheticInvoice:draft?.central_plan.eligible_for_synthetic_invoice===true,
    synthetic_only:true,real_invoice_created:false,bank_contacted:false,debit_executed:false,execution_authorization:false,
   };
   const result=freeze({schema:'JENIOS_ULTRA_LETTER_MONTHLY_R129',view:copy(view),assessment,generalAssessment:general,draft,emission,
    sourcePendingReasons:general.sourcePendingReasons,synthetic_only:true,financialActivationAllowed:false,billable:false,chargeCreated:false,debitExecuted:false,realIntegration:false});
   prepared.add(result);return result;
  },
  register(result){
   if(!prepared.has(result))fail('R129_PREPARATION_FROM_THIS_INSTANCE_REQUIRED');
   if(!result.draft)fail(result.generalAssessment.expectedAccountKeys.length>1?'R129_LETTER_MULTI_ACCOUNT_CONTRACT_REQUIRED':'R129_SINGLE_ACCOUNT_RESULT_REQUIRED');
   return lab.registerDraft(result.draft);
  },
  markSyntheticAwaitingPayment:(...args)=>lab.markSyntheticAwaitingPayment(...args),
  expectedSyntheticReceipt:(...args)=>lab.expectedSyntheticReceipt(...args),
  expectedSyntheticBinding:(...args)=>lab.expectedSyntheticBinding(...args),
  observeSyntheticLetter:(...args)=>lab.observeSyntheticLetter(...args),
  confirmSyntheticPayment:(...args)=>lab.confirmSyntheticPayment(...args),
  gate(identity){
   if(identity?.environment!=='demo')fail('R129_DEMO_GATE_REQUIRED');
   return lab.gate(identity);
  },
  read:(...args)=>lab.read(...args),
  audit:()=>lab.audit(),
  createPerformanceAuthority({fixtureBinding,cycleBinding,gateIdentity,now}={}){
   if(!validFixture(fixtureBinding)||!validCycle(cycleBinding)||!validGate(gateIdentity)||typeof now!=='function')fail('R129_PERFORMANCE_AUTHORITY_BINDING_REQUIRED');
   if(gateIdentity.customer_id!==fixtureBinding.clientId||cycleBinding.ownerKey!==fixtureBinding.ownerScope
    ||cycleBinding.accountKey!==gateIdentity.billing_account_id)fail('R129_PERFORMANCE_CANONICAL_BINDING_MISMATCH');
   const fixture=freeze(copy(fixtureBinding)),cycle=freeze(copy(cycleBinding)),identity=freeze(copy(gateIdentity));
   return ({fixtureBinding:receivedFixture,cycleBinding:receivedCycle,sessionId,stage}={})=>{
    if(!same(receivedFixture,fixture,fixtureKeys)||!same(receivedCycle,cycle,cycleKeys)||!token(sessionId)
     ||!['preflight','submitProtected'].includes(stage))fail('R129_PERFORMANCE_AUTHORITY_SCOPE_MISMATCH');
    const observedAtMs=now();
    if(!Number.isSafeInteger(observedAtMs)||observedAtMs<=0)fail('R129_PERFORMANCE_AUTHORITY_TIME_REQUIRED');
    // Query the same live local lab on every call, including the final guard.
    const gate=lab.gate({...identity,action:'open'});
    return freeze({schema:'JENIOS_ULTRA_PERFORMANCE_AUTHORITY_R129',source:'letter.monthly.r129',authorityInstanceId,evidenceMode:'offline_fixture',
     fixtureBinding:fixture,cycleBinding:cycle,gateIdentity:identity,observedAtMs,gate});
   };
  },
 };
 return Object.freeze(api);
}
