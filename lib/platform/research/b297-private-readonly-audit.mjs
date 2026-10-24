/**
 * B297 — audit adapter for an isolated PRIVATE runner (no proprietary source here).
 * Pure, read-only, fail-closed. Callback origin and external delivery are NOT
 * attested by this module; the private harness must verify executable bytes.
 */
import {createHash} from 'node:crypto';
import {reverseOperatorCommand,inspectSignalDelivery} from './b290-inversion-signal-contract.mjs';
import {orderRisk} from '../pilot-prep/risk.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ID=/^[A-Za-z0-9._-]{1,80}$/;
const SHA=/^[a-f0-9]{64}$/;
const MODES=['manual','hybrid','reverse'];
const ACTIONS=['manual_preview','hybrid_preview','wait_for_confluence',
 'reverse_not_calibrated','preserve_trend_aligned_intent','suggest_trend_aligned_preview',
 'reverse_preview','wait_for_context','pause_new_entries','manage_existing_position'];
const SOURCE='SYNTHETIC_PRIVATE_LAB_ONLY';
const ACTION_BY_MODE=Object.freeze({
 manual:['manual_preview','wait_for_context','pause_new_entries','manage_existing_position'],
 hybrid:['hybrid_preview','wait_for_confluence','wait_for_context','pause_new_entries','manage_existing_position'],
 reverse:['reverse_preview','reverse_not_calibrated','preserve_trend_aligned_intent',
  'suggest_trend_aligned_preview','wait_for_context','pause_new_entries','manage_existing_position']
});
const NO_SIDE=['wait_for_context','wait_for_confluence','reverse_not_calibrated',
 'pause_new_entries','manage_existing_position'];
const keys=(object,allowed)=>Object.keys(object).every(x=>allowed.includes(x));
const validTime=x=>Number.isSafeInteger(x)&&x>=0;
export const B297_ENGINE_SHA256='9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea';
export const B297_SERVICE_SHA256='cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be';

/** Captures genuine output IF the injected callback is the original service.
 * Does not accept orders, credentials, network fetch, or non-synthetic source.
 */
export async function captureB297OriginalDecisions({analyzeRequest,scenarios,nowMs=Date.now()}={}){
 if(typeof analyzeRequest!=='function'||!Array.isArray(scenarios)||scenarios.length<3||
  scenarios.length>60||!validTime(nowMs))fail('B297_UNSAFE_CAPTURE_REQUEST');
 const seen=new Set(),counts={manual:0,hybrid:0,reverse:0},entries=[];
 let previousHash='0'.repeat(64);
 for(const c of scenarios){
  if(!c||typeof c!=='object'||Array.isArray(c)||!keys(c,['id','mode','intent','horizon','paused'])||
   typeof c.id!=='string'||!ID.test(c.id)||seen.has(c.id)||!MODES.includes(c.mode)||
   !['buy','sell'].includes(c.intent)||!['day','swing'].includes(c.horizon)||
   (c.paused!==undefined&&typeof c.paused!=='boolean'))fail('B297_INVALID_SCENARIO');
  seen.add(c.id);counts[c.mode]++;
  const req=Object.freeze({sourceMode:'synthetic',mode:c.mode,intent:c.intent,
   horizon:c.horizon,paused:c.paused===true});
  const disabledFetch=async()=>fail('B297_NETWORK_FORBIDDEN');
  const answer=await analyzeRequest(req,{fetcher:disabledFetch,now:nowMs});
  const decision=answer?.decision,scan=answer?.scan;
  if(answer?.ok!==true||answer.simulation!==true||answer.executionEnabled!==false||
   answer.sourceMode!=='synthetic'||answer.symbol!=='LABORATÓRIO SINTÉTICO'||
   typeof answer.version!=='string'||!scan||!validTime(scan.decisionAt)||
   scan.decisionAt>nowMs||!decision||!ACTIONS.includes(decision.action)||
   !ACTION_BY_MODE[c.mode].includes(decision.action)||
   (NO_SIDE.includes(decision.action)&&decision.side!==null)||
   ![null,'buy','sell'].includes(decision.side)||decision.mayClose!==true||
   (decision.action==='reverse_preview'&&(c.mode!=='reverse'||
    decision.side===(c.intent==='buy'?'buy':'sell')))||
   (c.mode==='manual'&&decision.side!==null&&decision.side!==c.intent)||
   (c.mode!=='reverse'&&['reverse_preview','reverse_not_calibrated',
    'preserve_trend_aligned_intent','suggest_trend_aligned_preview'].includes(decision.action)))
   fail('B297_NON_READONLY_OR_INCONSISTENT_ORIGINAL_OUTPUT');
  const payload={id:c.id,commercialMode:c.mode,operatorIntent:c.intent,horizon:c.horizon,
   decisionAtMs:scan.decisionAt,observedAtMs:nowMs,action:decision.action,
   suggestedSide:decision.side,originalVersion:answer.version,
   rawOutputSha256:digest(answer),previousSha256:previousHash,
   delivery:'LOCAL_CAPTURE_NO_PROVIDER_ACK',source:SOURCE};
  const entry=Object.freeze({...payload,entrySha256:digest(payload)});
  entries.push(entry);previousHash=entry.entrySha256;
 }
 if(Object.values(counts).some(n=>n===0))fail('B297_THREE_COMMERCIAL_MODES_REQUIRED');
 return Object.freeze({schema:'JENIOS_B297_PRIVATE_READONLY_CAPTURE_V1',
  source:SOURCE,counts:Object.freeze(counts),entries:Object.freeze(entries),
  finalEntrySha256:previousHash,engineSha256Expected:B297_ENGINE_SHA256,
  executableBytesVerifiedByAdapter:false,originalCallbackIdentityAttested:false,
  remoteDeliveryAcknowledged:false,authorizedBrokerFeedObserved:false,
  readOnly:true,ordersSent:0,paperOrdersSent:0,executionEnabled:false,
  profitCertified:false,lossesActuallyAvoided:null});
}
/** Append-only hashes protect local accidental mutation; not an external signature. */
export function verifyB297CaptureChain(batch){
 if(!batch||batch.schema!=='JENIOS_B297_PRIVATE_READONLY_CAPTURE_V1'||
  batch.readOnly!==true||!Array.isArray(batch.entries)||batch.entries.length<3||
  !SHA.test(String(batch.finalEntrySha256))||batch.ordersSent!==0||
  batch.paperOrdersSent!==0||batch.executionEnabled!==false||
  batch.source!==SOURCE||batch.remoteDeliveryAcknowledged!==false||
  batch.executableBytesVerifiedByAdapter!==false)
  fail('B297_INVALID_AUDIT_CHAIN');
 let previous='0'.repeat(64);const ids=new Set();const counts={manual:0,hybrid:0,reverse:0};
 for(const entry of batch.entries){
  if(!entry||!ID.test(String(entry.id))||ids.has(entry.id)||
   entry.previousSha256!==previous||entry.source!==SOURCE||
   !MODES.includes(entry.commercialMode)||!validTime(entry.decisionAtMs)||
   !validTime(entry.observedAtMs)||entry.decisionAtMs>entry.observedAtMs||
   entry.delivery!=='LOCAL_CAPTURE_NO_PROVIDER_ACK'||
   !SHA.test(String(entry.rawOutputSha256)))fail('B297_AUDIT_CHAIN_TAMPERED');
  const {entrySha256,...body}=entry;
  if(digest(body)!==entrySha256)fail('B297_AUDIT_CHAIN_TAMPERED');
  previous=entrySha256;ids.add(entry.id);counts[entry.commercialMode]++;
 }
 if(previous!==batch.finalEntrySha256||!batch.counts||
  MODES.some(mode=>!counts[mode]||counts[mode]!==batch.counts[mode]))
  fail('B297_AUDIT_CHAIN_TAMPERED');
 return Object.freeze({valid:true,entries:batch.entries.length,finalEntrySha256:previous,
  independentTimeWitnessed:false,externallySigned:false});
}
/** Operator intents only, NOT a connected authorized broker account. No fills. */
export function inspectB297OperatorLifecycle(events,{nowMs=Date.now()}={}){
 if(!Array.isArray(events)||events.length<2||events.length>1000||!validTime(nowMs))
  fail('B297_INVALID_LIFECYCLE');
 const ids=new Set(),refs=new Map(),result=[];let previousAt=-1;
 for(const e of events){
  if(!e||!keys(e,['eventId','referenceId','action','side','atMs','authorization','megaTrendDirection'])||
   !ID.test(String(e.eventId))||!ID.test(String(e.referenceId))||ids.has(e.eventId)||
   !['open','cancel','close'].includes(e.action)||!['buy','sell'].includes(e.side)||
   !validTime(e.atMs)||e.atMs<=previousAt||e.atMs>nowMs||
   e.authorization!=='LAB_FIXTURE_ONLY')fail('B297_UNAUTHORIZED_OR_OUT_OF_ORDER_EVENT');
  ids.add(e.eventId);previousAt=e.atMs;
  const state=refs.get(e.referenceId);
  if(e.action==='open'&&state!==undefined)fail('B297_DUPLICATE_REFERENCE_OPEN');
  if(e.action!=='open'&&(state?.status!=='open_reference'||state.side!==e.side))
   fail('B297_INVALID_REFERENCE_TRANSITION');
  const policy=reverseOperatorCommand({eventId:e.eventId,action:e.action,side:e.side},{
   megaTrendDirection:e.megaTrendDirection??null,operatorAuthorized:true});
  if(e.action==='open')refs.set(e.referenceId,{status:'open_reference',side:e.side});
  else refs.set(e.referenceId,{status:e.action==='close'?'closed_reference':'cancelled_reference',side:e.side});
  result.push(Object.freeze({eventId:e.eventId,referenceId:e.referenceId,
   action:e.action,side:e.side,referenceDecision:policy.decision,
   referenceSide:policy.side,noNewExposure:e.action!=='open',
   privateEngineLifecycleVerified:false,brokerFillVerified:false}));
 }
 return Object.freeze({schema:'JENIOS_B297_OPERATOR_FIXTURE_LIFECYCLE_V1',
  source:'LAB_FIXTURE_NO_BROKER_CONSENT',events:Object.freeze(result),
  originalChooseModeUsed:false,externalConsentVerified:false,
  cancelsAndClosesNeverInverted:result.filter(x=>x.action!=='open').every(x=>x.noNewExposure),
  actualPositionReconciled:false,ordersSent:0,paperOrdersSent:0});
}
/** B290 is chronology only. Without delivery vendor acknowledgment, no delivery proof. */
export function inspectB297DeclaredSignalTimeline(signal,{recordedAtMs,deliveredAtMs}={}){
 const checked=inspectSignalDelivery(signal,{recordedAtMs,deliveredAtMs});
 return Object.freeze({schema:'JENIOS_B297_DECLARED_SIGNAL_TIMELINE_V1',
  ...checked,providerDeliveryAcknowledged:false,originalEventBoundToProvider:false,
  confirmedExternalDelivery:false,ordersSent:0});
}
/** Reuse actual B152 arithmetic in pure calculation; never submit even Paper. */
export function inspectB297B152Arithmetic(order,meta,options){
 const result=orderRisk(order,meta,options);
 return Object.freeze({schema:'JENIOS_B297_B152_ARITHMETIC_V1',
  inputDigestSha256:digest({order,meta,options}),riskUnits:result.riskUnits,
  notionalUnits:result.notionalUnits,settlement:result.settlement,
  stopGuaranteed:false,externalMarketMetadataAttested:false,
  riskCalculationExecuted:true,orderApprovedForTransmission:false,
  ordersSent:0,paperOrdersSent:0});
}