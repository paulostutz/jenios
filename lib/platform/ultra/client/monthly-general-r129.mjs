/** R129: explicit account-set arithmetic for the offline UM001 rehearsal.
 * This module does not invent a multi-account Letter obligation or authenticate
 * imported records. Missing observations and costs remain pending, never zero.
 */
import {createHash} from 'node:crypto';
import {decimal8,format8} from './reporting.mjs';
import {monthlyPeriod} from './monthly-report-um001.mjs';

const CENT=1000000n;
const COMMON_IDENTITY=['company_id','customer_id','billing_account_id','receiver_id','legal_entity_id','environment','currency','month','timezone'];
const BINDING_IDENTITY=[...COMMON_IDENTITY,'broker_account_id','source_account_key','period_start','period_end'];
const FIXTURE_KEYS=['registrationId','clientId','ownerScope','evidenceMode'];
const FIXTURE_REASONS=Object.freeze([
 'LOCAL_FIXTURE_ONLY','CLIENT_BINDING_UNVERIFIED','SOURCE_COVERAGE_PENDING',
 'ACCOUNT_IDENTITY_PENDING','MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED',
 'ULTRA_ATTRIBUTION_PENDING','FILL_DETAIL_PENDING',
]);
const EVIDENCE_REFERENCES=['coverageReference','identityReference','attributionReference','executionReference','fillDetailLimitationReference'];
const ZERO_FLAGS=Object.freeze({billable:false,chargeCreated:false,debitExecuted:false,realIntegration:false,financialActivationAllowed:false,nativeFillDetail:false});
const copy=value=>structuredClone(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=2048&&!/[\u0000-\u001f]/.test(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
const unique=values=>[...new Set(values)].sort();
const stable=value=>Array.isArray(value)?value.map(stable):plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const seconds=value=>typeof value==='string'?value.replace(/\.000Z$/,'Z'):value;
const reasons=codes=>unique(codes).map(code=>({code,label:code}));
const reasonCodes=list=>{
 if(!Array.isArray(list)||list.some(reason=>!plain(reason)||!text(reason.code)))throw Error('R129_INVALID_PENDING_REASONS');
 return list.map(reason=>reason.code);
};
const minor=value=>value%CENT===0n&&value/CENT<=BigInt(Number.MAX_SAFE_INTEGER)&&value/CENT>=BigInt(Number.MIN_SAFE_INTEGER)?Number(value/CENT):null;

/** Consistency checksum only. A digest is not a signature or native authority. */
export const monthlyFixtureDigestR129=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

function fixtureResolution(envelope,{period,expectedAccountKeys,evidence,settlementScope,accountBindings}){
 if(!envelope)return {valid:false,resolved:[],pending:[],reference:null};
 const fixture=evidence?.fixtureEvidence;
 if(!plain(fixture))return {valid:false,resolved:[],pending:['R129_FIXTURE_COVERAGE_REQUIRED'],reference:null};
 const binding=envelope.fixtureBinding;
 const validBinding=plain(binding)&&binding.evidenceMode==='offline_fixture'&&FIXTURE_KEYS.every(key=>text(binding[key]))
  &&plain(fixture.fixtureBinding)&&FIXTURE_KEYS.every(key=>fixture.fixtureBinding[key]===binding[key])
  &&Object.keys(fixture.fixtureBinding).every(key=>FIXTURE_KEYS.includes(key));
 const keys=fixture.accountKeys;
 const accounts=fixture.accounts;
 const requested=fixture.resolvedReasons;
 const allowed=Array.isArray(requested)&&requested.length===new Set(requested).size&&requested.every(code=>FIXTURE_REASONS.includes(code));
 const valid=fixture.schema==='JENIOS_ULTRA_MONTHLY_FIXTURE_EVIDENCE_R129'&&fixture.evidenceMode==='offline_fixture'
  &&validBinding&&fixture.envelopeSha256===monthlyFixtureDigestR129(envelope)
  &&fixture.settlementBindingSha256===monthlyFixtureDigestR129({settlementScope,accountBindings})
  &&equal(fixture.period,period)&&Array.isArray(keys)&&keys.length===new Set(keys).size&&equal(unique(keys),expectedAccountKeys)
  &&text(fixture.reference)&&fixture.nativeFillDetail===false
  &&Array.isArray(accounts)&&accounts.length===expectedAccountKeys.length
  &&equal(unique(accounts.map(account=>account?.accountKey)),expectedAccountKeys)
  &&accounts.every(account=>plain(account)&&EVIDENCE_REFERENCES.every(key=>text(account[key])))&&allowed;
 if(!valid)return {valid:false,resolved:[],pending:[allowed?'R129_FIXTURE_EVIDENCE_MISMATCH':'R129_FIXTURE_REASON_NOT_RESOLVABLE'],reference:null};
 return {valid:true,resolved:unique(requested),pending:[],reference:fixture.reference,envelopeSha256:fixture.envelopeSha256};
}

function validatePeriod(view,scope){
 const period=monthlyPeriod(view?.month,view?.timeZone);
 if(view.periodStart!==period.periodStart||view.periodEnd!==period.periodEnd||scope.month!==period.month||scope.timezone!==period.timeZone)throw Error('R129_MONTHLY_PERIOD_MISMATCH');
 return period;
}

function bindingProblems(binding,group,scope,period){
 const codes=[];
 if(!binding){codes.push('R129_ACCOUNT_BINDING_REQUIRED');return codes;}
 if(BINDING_IDENTITY.some(key=>!text(binding[key]))||!id(binding.broker_account_id))codes.push('R129_ACCOUNT_BINDING_REQUIRED');
 if(COMMON_IDENTITY.some(key=>binding[key]!==scope[key])||binding.source_account_key!==group.accountKey
   ||binding.environment!==group.environment||binding.currency!==group.currency
   ||seconds(binding.period_start)!==seconds(period.periodStart)||seconds(binding.period_end)!==seconds(period.periodEnd))codes.push('R129_ACCOUNT_BINDING_MISMATCH');
 return codes;
}

function confirmedTotals(groups,completeSet){
 const fields=['gains','losses','gross','fees','financing','net'];
 const observed=Object.fromEntries(fields.map(field=>{
  if(!groups.length||groups.some(group=>group.confirmed?.[field]===null||group.confirmed?.[field]===undefined))return [field,null];
  return [field,format8(groups.reduce((sum,group)=>sum+decimal8(group.confirmed[field]),0n))];
 }));
 const total=completeSet?observed:Object.fromEntries(fields.map(field=>[field,null]));
 return {total,observed};
}

/** General monthly result, preserving every source account and currency.
 * `accountBindings` is an explicit synthetic fixture registry, not a broker
 * identity obtained from a report. A multi-account result cannot issue Letter.
 */
export function assessGeneralMonthlyR129(view,{
 settlementScope,expectedAccountKeys,accountBindings,policy=null,evidence=null,
 syntheticOnly=false,recordEnvelope=null,
}={}){
 if(syntheticOnly!==true)throw Error('R129_SYNTHETIC_MONTHLY_ONLY');
 if(!plain(view)||!Array.isArray(view.groups)||!plain(settlementScope))throw Error('R129_INVALID_MONTHLY_VIEW');
 const scope=copy(settlementScope),period=validatePeriod(view,scope);
 if(scope.environment!=='demo')throw Error('R129_DEMO_MONTHLY_REQUIRED');
 if(!['BRL','USD','EUR','USDT'].includes(scope.currency))throw Error('R129_INVALID_SETTLEMENT_CURRENCY');
 if(!Array.isArray(expectedAccountKeys)||!expectedAccountKeys.length||expectedAccountKeys.length>20
  ||expectedAccountKeys.some(key=>!text(key))||new Set(expectedAccountKeys).size!==expectedAccountKeys.length)throw Error('R129_EXPLICIT_ACCOUNT_SET_REQUIRED');
 if(!Array.isArray(accountBindings)||accountBindings.some(binding=>!plain(binding)))throw Error('R129_ACCOUNT_BINDINGS_REQUIRED');
 const expected=unique(expectedAccountKeys),codes=[];
 for(const key of ['company_id','customer_id','billing_account_id','receiver_id','legal_entity_id'])if(!id(scope[key]))codes.push('R129_SETTLEMENT_IDENTITY_REQUIRED');
 if(recordEnvelope){
  if(recordEnvelope.schema!=='JENIOS_ULTRA_RECORD_MONTHLY_R129'||!equal(recordEnvelope.view,view))throw Error('R129_RECORD_ENVELOPE_VIEW_MISMATCH');
  for(const key of ['sourceComplete','independentlyVerified','billable','debitExecuted'])if(view[key]!==false)throw Error('R129_IMPORTED_AUTHORITY_FORBIDDEN');
  if(recordEnvelope.fixtureBinding?.clientId!==scope.customer_id)codes.push('R129_RECORD_CLIENT_SCOPE_MISMATCH');
 }
 const bindings=new Map();
 for(const binding of accountBindings){
  if(!text(binding.source_account_key))throw Error('R129_ACCOUNT_BINDING_REQUIRED');
  const key=JSON.stringify([binding.source_account_key,binding.environment,binding.currency]);
  if(bindings.has(key))throw Error('R129_DUPLICATE_ACCOUNT_BINDING');
  bindings.set(key,binding);
 }
 const groupBinding=group=>bindings.get(JSON.stringify([group.accountKey,group.environment,group.currency]));
 const matchesScope=binding=>!!binding&&COMMON_IDENTITY.every(key=>binding[key]===scope[key]);
 const relevant=view.groups.filter(group=>group.environment===scope.environment&&group.currency===scope.currency);
 const selected=relevant.filter(group=>matchesScope(groupBinding(group)));
 const unbound=relevant.filter(group=>!groupBinding(group));
 if(unbound.length)codes.push('R129_ACCOUNT_BINDING_REQUIRED');
 // Every record envelope belongs to one registered client. Relabelling a
 // losing account as a different client/billing scope cannot remove it.
 if(recordEnvelope&&relevant.some(group=>groupBinding(group)&&!matchesScope(groupBinding(group))))codes.push('R129_RECORD_CLIENT_SCOPE_MISMATCH');
 const selectedKeys=unique(selected.map(group=>group.accountKey));
 const completeSet=equal(selectedKeys,expected)&&selected.length===expected.length;
 if(!completeSet)codes.push('R129_ACCOUNT_SET_MISMATCH','MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED');
 for(const group of selected)codes.push(...bindingProblems(groupBinding(group),group,scope,period));
 // An observed account may have no closed row in the month. It is still part
 // of coverage and cannot disappear merely because its subtotal is unknown.
 const observedCandidates=relevant.flatMap(group=>group.observedAccountKeys??[group.accountKey]);
 if(recordEnvelope)for(const observation of recordEnvelope.observedScopes??[]){
  if(observation.environment!==scope.environment)continue;
  if(!Array.isArray(observation.currencies)||observation.currencies.length===0){
   codes.push('R129_OBSERVED_ACCOUNT_CURRENCY_PENDING');
   observedCandidates.push(observation.accountKey);
  }else if(observation.currencies.includes(scope.currency))observedCandidates.push(observation.accountKey);
 }
 const observedKeys=unique(observedCandidates);
 for(const key of observedKeys){
  const binding=bindings.get(JSON.stringify([key,scope.environment,scope.currency]));
  if(!binding)codes.push('R129_ACCOUNT_BINDING_REQUIRED');
  else if(recordEnvelope&&!matchesScope(binding))codes.push('R129_RECORD_CLIENT_SCOPE_MISMATCH');
  else if(matchesScope(binding)&&!expected.includes(key))codes.push('R129_ACCOUNT_SET_MISMATCH','MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED');
 }
 const sourceCodes=selected.flatMap(group=>reasonCodes(group.pendingReasons));
 const allSourceCodes=[...sourceCodes];
 if(recordEnvelope){
  sourceCodes.push(...reasonCodes(recordEnvelope.globalPendingReasons??recordEnvelope.pendingReasons));
  allSourceCodes.push(...reasonCodes(recordEnvelope.pendingReasons));
  for(const entry of recordEnvelope.groups??[])if(expected.includes(entry.monthly?.accountKey)&&entry.monthly?.currency===scope.currency&&entry.monthly?.environment===scope.environment){
   const entryCodes=reasonCodes(entry.pendingReasons);sourceCodes.push(...entryCodes);allSourceCodes.push(...entryCodes);
  }
 }
 const fixture=fixtureResolution(recordEnvelope,{period,expectedAccountKeys:expected,evidence,settlementScope:scope,accountBindings});
 codes.push(...fixture.pending);
 const resolved=new Set(fixture.resolved);
 // The original UM001 fixture path permits explicit synthetic evidence.
 // An R129 feed additionally needs the exact bound fixture above.
 if(!recordEnvelope){
  if(evidence?.sourceComplete===true&&evidence?.brokerReconciled===true)resolved.add('SOURCE_COVERAGE_PENDING');
  if(evidence?.identityConfirmed===true)resolved.add('ACCOUNT_IDENTITY_PENDING');
  if(evidence?.ultraAttributionConfirmed===true)resolved.add('ULTRA_ATTRIBUTION_PENDING');
 }
 codes.push(...sourceCodes.filter(code=>!resolved.has(code)&&code!=='NO_CLOSED_RESULT'));
 if(view.periodClosed!==true)codes.push('MONTH_OPEN');
 if(evidence?.sourceComplete!==true||evidence?.brokerReconciled!==true)codes.push('SOURCE_COVERAGE_PENDING');
 if(evidence?.identityConfirmed!==true)codes.push('ACCOUNT_IDENTITY_PENDING');
 if(evidence?.ultraAttributionConfirmed!==true)codes.push('ULTRA_ATTRIBUTION_PENDING');
 const aggregation=expected.length===1?'single_account_confirmed':'explicit_account_set_confirmed';
 if(evidence?.settlementScopeComplete!==true||policy?.aggregationScope!==aggregation||!completeSet)codes.push('MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED');
 if(policy?.timeZone!==period.timeZone||!text(policy?.timezoneReference))codes.push('BILLING_TIMEZONE_PENDING');
 if(scope.currency!=='BRL')codes.push('CURRENCY_CONVERSION_PENDING');
 for(const group of selected){
  const total=group.confirmed;
  if(total&&['gains','losses','gross','fees','financing','net'].every(key=>total[key]!==null&&total[key]!==undefined)){
   if(decimal8(total.gains)-decimal8(total.losses)!==decimal8(total.gross)
    ||decimal8(total.gross)-decimal8(total.fees)-decimal8(total.financing)!==decimal8(total.net))codes.push('R129_CONFIRMED_TOTALS_MISMATCH');
  }
  if((group.priorLossesObserved??[]).length)codes.push('OBSERVED_PRIOR_LOSS_PENDING');
 }
 const {total,observed}=confirmedTotals(selected,completeSet);
 let eligible=total.net===null?null:decimal8(total.net),platformCosts=null;
 const costs=evidence?.platformCosts;
 if(costs?.complete!==true||!text(costs?.treatmentReference)||typeof costs?.eligibleAmount!=='string')codes.push('PLATFORM_COST_TREATMENT_PENDING');
 else{
  platformCosts=decimal8(costs.eligibleAmount);
  if(platformCosts<0n)throw Error('INVALID_PLATFORM_COSTS');
  if(eligible!==null)eligible-=platformCosts;
 }
 if(eligible===null)codes.push('NO_CLOSED_RESULT');
 const rate=policy?.mode==='individual'?2000:policy?.mode==='included'?1000:null;
 const planConfirmed=!!(text(policy?.version)&&text(policy?.eligibilityReference)&&(policy.mode==='individual'||policy.mode==='included'&&text(policy.planId)));
 if(!planConfirmed||rate===null)codes.push('PLAN_ELIGIBILITY_PENDING');
 if(eligible!==null&&eligible>0n&&!(evidence?.priorLosses?.status==='none_confirmed'&&text(evidence.priorLosses.reference)))codes.push('PRIOR_LOSS_POLICY_PENDING');
 if(!/^[a-f0-9]{64}$/.test(evidence?.sha256??''))codes.push('EVIDENCE_PENDING');
 let performance=null;
 if(eligible!==null&&eligible<=0n)performance=0n;
 else if(eligible!==null&&rate!==null){
  const numerator=eligible*BigInt(rate);
  if(numerator%10000n)codes.push('ROUNDING_POLICY_PENDING');else performance=numerator/10000n;
 }
 const eligibleMinor=eligible===null?null:minor(eligible),performanceMinor=performance===null?null:minor(performance);
 if(eligible!==null&&eligibleMinor===null||performance!==null&&performanceMinor===null)codes.push('ROUNDING_POLICY_PENDING');
 const pending=reasons(codes),complete=pending.length===0;
 return {
  schema:'JENIOS_ULTRA_GENERAL_MONTHLY_R129',synthetic_only:true,evidenceMode:'offline_fixture',
  status:complete?(eligible<=0n?'no_performance_due':'ready'):'pending',complete,
  eligible_profit_minor:eligibleMinor,rate_bps:rate,performance_minor:performanceMinor,
  policy_version:policy?.version??null,evidence_sha256:evidence?.sha256??null,
  plan_eligibility_confirmed:planConfirmed,policy_resolution_confirmed:complete,
  pending_reasons:pending.map(reason=>reason.code),pendingReasons:pending,
  settlementScope:scope,expectedAccountKeys:expected,observedAccountKeys:observedKeys,
  accountSetSha256:monthlyFixtureDigestR129({scope,period,accountKeys:expected}),
  sourcePendingReasons:reasons(allSourceCodes),
  resolvedFixtureReasons:unique(sourceCodes.filter(code=>resolved.has(code))),
  fixtureEvidence:fixture.valid?{reference:fixture.reference,envelopeSha256:fixture.envelopeSha256,nativeFillDetail:false}:null,
  perAccount:selected.map(group=>({accountKey:group.accountKey,binding:copy(groupBinding(group)),monthly:copy(group)})),
  excludedGroups:view.groups.filter(group=>!selected.includes(group)).map(group=>({accountKey:group.accountKey,currency:group.currency,environment:group.environment,reason:'OTHER_OR_UNBOUND_SETTLEMENT_SCOPE'})),
  calculation:{
   ...period,currency:scope.currency,environment:scope.environment,
   accountKey:expected.length===1?expected[0]:null,accountKeys:expected,aggregationScope:aggregation,
   gains:total.gains,losses:total.losses,brokerFees:total.fees,financing:total.financing,brokerNet:total.net,
   observedTotals:observed,eligiblePlatformCosts:platformCosts===null?null:format8(platformCosts),
   eligibleProfit:eligible===null?null:format8(eligible),rateBps:rate,performance:performance===null?null:format8(performance),
   eligible_profit_minor:eligibleMinor,rate_bps:rate,performance_minor:performanceMinor,
   operationKeys:selected.flatMap(group=>group.operations.map(operation=>operation.operationKey)).sort(),
   formula:'ganhos brutos - perdas brutas - custos corretora - financiamento - custos elegíveis confirmados da plataforma',
   performanceFormula:'max(lucro elegível mensal, 0) × percentual',
   subscriptionSeparate:true,annualSubscriptionWaivesPerformance:false,defiPerformanceSeparate:true,
  },...ZERO_FLAGS,
 };
}
