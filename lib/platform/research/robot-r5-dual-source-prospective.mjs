/**
 * JENIOS ROBOT-R5 -- OFFLINE prospective source-consistency controls.
 * Reuses the *existing* B287 SHA-sealed signal contract. No network, secrets,
 * private engine, broker, order, paid service, execution or statistical claims.
 * Claimed provider labels, caller timestamps and SHA-256 are NOT independent
 * third-party attestation, even when the two price series agree precisely.
 */
import {createHash} from 'node:crypto';
import {inspectFrozenSignalBatch} from './b287-signal-witness.mjs';

const err=code=>{throw Object.assign(new Error(code),{code});};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&Object.keys(x).every(k=>keys.includes(k));
const positiveTime=x=>Number.isSafeInteger(x)&&x>0;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const freeze=x=>Object.freeze(x);
const H=3600000,DAY=86400000;
const modes=['manual','hybrid','reverse'];
const ALIASES=freeze({
 'BTC-USD':freeze({coinbase_exchange:'BTC-USD',kraken_spot:'XBTUSD'}),
 'ETH-USD':freeze({coinbase_exchange:'ETH-USD',kraken_spot:'ETHUSD'}),
 'SOL-USD':freeze({coinbase_exchange:'SOL-USD',kraken_spot:'SOLUSD'})
});
export const ROBOT_R5_FROZEN_PROTOCOL=freeze({
 schema:'JENIOS_ROBOT_R5_PROSPECTIVE_EVIDENCE_PROTOCOL_V1',
 intervalMs:H,minimumRegistrationLeadMs:600000,
 outcomeGraceAfterCloseMs:300000,
 maximumCaptureLagAfterCloseMs:4*H,
 maximumCrossCollectorTimestampSkewMs:600000,
 maxCloseDifferenceBps:50,maxOtherOhlcDifferenceBps:150,
 providers:freeze(['coinbase_exchange','kraken_spot']),
 assets:freeze(['BTC-USD','ETH-USD','SOL-USD']),
 quoteCurrency:'USD',registeredSignalsAreNotExternallyWitnessed:true,
 sourceLabelsAreNotProvenIndependent:true,
 quoteConversionForbidden:true,brokerFillsNeverImplied:true,
 modelParameterOptimizationAllowed:false,externalOrdersAllowed:false
});
const key=(asset,close)=>asset+'|'+close;
function checkTriplets(batch,registeredAtMs){
 const groups=new Map();
 for(const s of batch.signals){
  if(!exact(s,['id','mode','asset','signalAtMs','targetCloseMs',
   'direction','isOrder','executed','realizedPnl']))
   err('ROBOT_R5_SIGNAL_HAS_EXTRA_OR_MISSING_FIELDS');
  const targetOpenMs=s.targetCloseMs-H;
  if(!positiveTime(s.targetCloseMs)||s.targetCloseMs%H!==0||
   !positiveTime(targetOpenMs)||
   s.signalAtMs>targetOpenMs-ROBOT_R5_FROZEN_PROTOCOL.minimumRegistrationLeadMs||
   registeredAtMs>targetOpenMs-ROBOT_R5_FROZEN_PROTOCOL.minimumRegistrationLeadMs||
   batch.frozenAtMs>targetOpenMs-ROBOT_R5_FROZEN_PROTOCOL.minimumRegistrationLeadMs)
   err('ROBOT_R5_FORECAST_NOT_REGISTERED_BEFORE_ENTRY');
  const id=key(s.asset,s.targetCloseMs);
  if(!groups.has(id))groups.set(id,{asset:s.asset,targetCloseMs:s.targetCloseMs,byMode:{}});
  const g=groups.get(id);
  if(g.byMode[s.mode])err('ROBOT_R5_DUPLICATE_MODE');
  g.byMode[s.mode]=s;
 }
 if(groups.size>333)err('ROBOT_R5_TOO_MANY_COHORTS');
 for(const g of groups.values()){
  if(modes.some(m=>!g.byMode[m]))err('ROBOT_R5_THREE_MODE_COHORT_REQUIRED');
  const m=g.byMode.manual.direction,h=g.byMode.hybrid.direction,
   r=g.byMode.reverse.direction;
  if((m==='ABSTAIN'&&(h!=='ABSTAIN'||r!=='ABSTAIN'))||
   (m!=='ABSTAIN'&&h!==m&&h!=='ABSTAIN')||
   (m!=='ABSTAIN'&&r!==(m==='UP'?'DOWN':'UP')&&r!=='ABSTAIN'))
   err('ROBOT_R5_MODES_NOT_COMPARABLE');
 }
 return groups;
}
export function sealR5ProspectiveBatch(batch,{studyId,registeredAtMs}={}){
 if(typeof studyId!=='string'||!/^[A-Za-z0-9._-]{1,80}$/.test(studyId)||
  !positiveTime(registeredAtMs)||!positiveTime(batch?.frozenAtMs)||
  registeredAtMs<batch.frozenAtMs||registeredAtMs-batch.frozenAtMs>300000)
  err('ROBOT_R5_INVALID_REGISTRATION');
 inspectFrozenSignalBatch(batch,{nowMs:registeredAtMs});
 const groups=checkTriplets(batch,registeredAtMs);
 const data={schema:'JENIOS_ROBOT_R5_LOCAL_SEAL_V1',studyId,registeredAtMs,
  signalBatch:batch};
 return freeze({...data,sealDigestSha256:sha(data),cohortCount:groups.size,
  independentlyTimestamped:false,externalWitnessOfSeal:false,
  originalPrivateSignalProvenanceVerified:false,
  cryptographicDigestIsNotPrecommitProof:true,ordersSent:0});
}
function inspectSeal(seal,nowMs){
 if(!exact(seal,['schema','studyId','registeredAtMs','signalBatch',
    'sealDigestSha256','cohortCount','independentlyTimestamped',
    'externalWitnessOfSeal','originalPrivateSignalProvenanceVerified',
    'cryptographicDigestIsNotPrecommitProof','ordersSent'])||
  !exact(seal.signalBatch,['schema','frozenAtMs','signals','sha256'])||
  seal.independentlyTimestamped!==false||seal.externalWitnessOfSeal!==false||
  seal.originalPrivateSignalProvenanceVerified!==false||
  seal.cryptographicDigestIsNotPrecommitProof!==true||seal.ordersSent!==0||
  seal.schema!=='JENIOS_ROBOT_R5_LOCAL_SEAL_V1'||
  !/^[a-f0-9]{64}$/.test(seal.sealDigestSha256||'')||
  !positiveTime(nowMs)||nowMs<seal.registeredAtMs||
  sha({schema:seal.schema,studyId:seal.studyId,registeredAtMs:seal.registeredAtMs,
   signalBatch:seal.signalBatch})!==seal.sealDigestSha256)
  err('ROBOT_R5_SEAL_TAMPERED_OR_CLOCK_INVALID');
 inspectFrozenSignalBatch(seal.signalBatch,{nowMs});
 const groups=checkTriplets(seal.signalBatch,seal.registeredAtMs);
 if(groups.size!==seal.cohortCount)err('ROBOT_R5_COHORT_COUNT_DRIFT');
 return groups;
}
function validRow(row,pair,nowMs){
 const fields=['provider','providerPair','asset','targetCloseMs','candleStartMs',
  'capturedAtMs','open','high','low','close','volume','quoteCurrency',
  'sourceSigned','orderExecuted','originClaim'];
 if(!exact(row,fields)||!Object.hasOwn(ALIASES[pair.asset]||{},row.provider)||
  row.providerPair!==ALIASES[pair.asset][row.provider]||
  row.asset!==pair.asset||row.targetCloseMs!==pair.targetCloseMs||
  row.candleStartMs!==pair.targetCloseMs-H||
  !positiveTime(row.capturedAtMs)||row.capturedAtMs<row.targetCloseMs+
   ROBOT_R5_FROZEN_PROTOCOL.outcomeGraceAfterCloseMs||
  row.capturedAtMs>row.targetCloseMs+
   ROBOT_R5_FROZEN_PROTOCOL.maximumCaptureLagAfterCloseMs||
  row.capturedAtMs>nowMs||
  ![row.open,row.high,row.low,row.close,row.volume].every(finite)||
  row.open<=0||row.close<=0||row.low<=0||row.volume<=0||
  row.high<Math.max(row.open,row.close,row.low)||
  row.low>Math.min(row.open,row.close)||row.high/row.low>1.5||
  row.quoteCurrency!=='USD'||row.sourceSigned!==false||
  row.orderExecuted!==false||
  row.originClaim!=='CALLER_SUPPLIED_UNSIGNED_PUBLIC_CANDLE')
  err('ROBOT_R5_INVALID_OR_UNWITNESSED_SOURCE_ROW');
}
const differenceBps=(a,b)=>Math.abs(a-b)/((a+b)/2)*10000;
export function reviewR5DualSourceEvidence({seal,sourcePairs,reviewedAtMs}={}){
 const cohorts=inspectSeal(seal,reviewedAtMs);
 if(!Array.isArray(sourcePairs)||sourcePairs.length!==cohorts.size)
  err('ROBOT_R5_MISSING_OR_EXTRA_SOURCE_PAIR');
 const byKey=new Map();
 for(const p of sourcePairs){
  if(!exact(p,['asset','targetCloseMs','readings'])||
   !Object.hasOwn(ALIASES,p.asset)||!positiveTime(p.targetCloseMs)||
   !Array.isArray(p.readings)||p.readings.length!==2||
   !cohorts.has(key(p.asset,p.targetCloseMs))||byKey.has(key(p.asset,p.targetCloseMs)))
   err('ROBOT_R5_INVALID_OR_DUPLICATE_SOURCE_PAIR');
  const provs=new Set(p.readings.map(r=>r?.provider));
  if(provs.size!==2||ROBOT_R5_FROZEN_PROTOCOL.providers.some(x=>!provs.has(x)))
   err('ROBOT_R5_TWO_DECLARED_PROVIDERS_REQUIRED');
  for(const r of p.readings)validRow(r,p,reviewedAtMs);
  byKey.set(key(p.asset,p.targetCloseMs),p);
 }
 let overallMaxClose=0,overallMaxOther=0;
 const issues=[],results=[],hours=new Set(),days=new Set();
 for(const g of [...cohorts.values()].sort((a,b)=>a.targetCloseMs-b.targetCloseMs||
    a.asset.localeCompare(b.asset))){
  const pair=byKey.get(key(g.asset,g.targetCloseMs));
  const a=pair.readings.find(r=>r.provider==='coinbase_exchange');
  const b=pair.readings.find(r=>r.provider==='kraken_spot');
  const close= differenceBps(a.close,b.close);
  const others=Math.max(...['open','high','low'].map(k=>differenceBps(a[k],b[k])));
  const skew=Math.abs(a.capturedAtMs-b.capturedAtMs);
  overallMaxClose=Math.max(overallMaxClose,close);
  overallMaxOther=Math.max(overallMaxOther,others);
  const local=[];
  if(close>ROBOT_R5_FROZEN_PROTOCOL.maxCloseDifferenceBps)local.push('CLAIMED_PROVIDER_CLOSE_DISAGREEMENT');
  if(others>ROBOT_R5_FROZEN_PROTOCOL.maxOtherOhlcDifferenceBps)local.push('CLAIMED_PROVIDER_OHLC_DISAGREEMENT');
  if(skew>ROBOT_R5_FROZEN_PROTOCOL.maximumCrossCollectorTimestampSkewMs)
   local.push('CAPTURE_TIMESTAMPS_TOO_FAR_APART');
  if(['open','high','low','close','volume'].every(k=>a[k]===b[k]))
   local.push('DUPLICATED_OR_IDENTICAL_UNWITNESSED_PROVIDER_PAYLOAD');
  issues.push(...local);
  hours.add(g.targetCloseMs);
  days.add(Math.floor((g.targetCloseMs-1)/DAY));
  results.push(freeze({asset:g.asset,targetCloseMs:g.targetCloseMs,
   declaredCloseDifferenceBps:Number(close.toFixed(6)),
   declaredOtherOhlcMaximumDifferenceBps:Number(others.toFixed(6)),
   localIssues:freeze(local),
   // Hashes are local integrity identifiers only: they do not authenticate an API.
   sourcePayloadDigests:freeze(pair.readings.map(r=>freeze({
    claimedProvider:r.provider,digestSha256:sha(r)
   })).sort((x,y)=>x.claimedProvider.localeCompare(y.claimedProvider)))}));
 }
 const rejected=[...new Set(issues)].sort();
 return freeze({schema:'JENIOS_ROBOT_R5_TWO_DECLARED_SOURCE_AUDIT_V1',
  frozenSealDigestSha256:seal.sealDigestSha256,cohortsReviewed:cohorts.size,
  uniqueHourSlots:hours.size,distinctUtcDays:days.size,
  threeModeTripletsFrozen:true,twoClaimedProviderRowsPerCohort:true,
  sourceAgreementWithinLockedTolerances:rejected.length===0,
  descriptiveOfflinePairingEligible:rejected.length===0,
  issues:freeze(rejected),pairDigests:freeze(results),
  maximumClaimedCloseDivergenceBps:Number(overallMaxClose.toFixed(6)),
  maximumClaimedOtherOhlcDivergenceBps:Number(overallMaxOther.toFixed(6)),
  providerLabelsCryptographicallyAuthenticated:false,
  independentProviderDataAuthenticated:false,
  independentPredictionTimestampVerified:false,
  sourceSignerIndependenceVerified:false,
  originalPrivateRobotSignalVerified:false,
  doubleSourcedDataNotEquivalentToSignedPrices:true,
  b280RealProspectiveCoverageCertified:false,
  brokerExecutabilityVerified:false,
  fillPriceVerified:false,feesAndFundingVerified:false,
  hypotheticalNetR:null,actualLossesAvoided:null,actualBrokerRealizedPnl:null,
  statisticalAdvantageCertified:false,commercialPerformanceClaimAllowed:false,
  ordersSent:0,paperOrdersSent:0,paidAiInvocations:0,
  releaseStatus:'NO_GO_EXTERNAL_WITNESS_AND_BROKER_RECONCILIATION_REQUIRED'});
}
