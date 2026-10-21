/**
 * JENIOS B298 — PRIVATE, read-only evidence intake contract.
 * Reuses B197 paired Alpaca Paper GET review and B290 reference-only lifecycle.
 * The signing key is provisioned by the private operator OUTSIDE this repository.
 * A valid collector signature proves export integrity, NOT broker authenticity,
 * actual delivery to a recipient, client consent, executable identity, or P&L.
 * NO network, credentials, broker mutation, Paper execution, or database writes.
 */
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import {canonical,units} from '../pilot-prep/contracts.mjs';
import {assessPairedPaperReads} from '../connections/b197-independent-order-observations.mjs';
import {reverseOperatorCommand} from './b290-inversion-signal-contract.mjs';
import {verifyB297CaptureChain} from './b297-private-readonly-audit.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha=s=>createHash('sha256').update(s).digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9._:-]{1,80}$/.test(x);
const safeTime=x=>Number.isSafeInteger(x)&&x>0;
const fields=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).length===keys.length&&Object.keys(o).every(k=>keys.includes(k));
const greater=(a,b)=>safeTime(a)&&safeTime(b)&&a>=b;
const decimal=x=>typeof x==='string'&&/^(0|[1-9]\d{0,12})(\.\d{1,8})?$/.test(x);
const zero=x=>decimal(x)&&units(x)===0n;
const positive=x=>decimal(x)&&units(x)>0n;
const DOMAIN='JENIOS_B298_READONLY_EVIDENCE_V1\0';
const KEYS=['schema','kind','keyId','nonce','ownerDigest','accountDigest','consentDigest',
 'provider','environment','capturedAtMs','expiresAtMs','readOnly','executionTransportEnabled',
 'ordersSent','paperOrdersSent','event'];
const DELIVERY=['kind','signalId','decisionOutputSha256','emittedAtMs','receiptAtMs',
 'targetOpenMs','recipientDigest','receiptStatus'];
const ORDER=['kind','clientOrderId','symbol','expectedQuantity','observedAtMs','order'];
const POSITION=['kind','symbol','side','quantity','observedAtMs'];
const OPERATOR=['kind','eventId','referenceId','commercialMode','action','side','observedAtMs'];
const SIGNATURE=/^(?:[A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$/;
export const B298_KINDS=Object.freeze(['ORDER_GET','POSITION_GET','SIGNAL_DELIVERY', 'OPERATOR_INTENT']);
export const B298_SCHEMA='JENIOS_B298_READONLY_EVIDENCE_V1';

function validateEvent(p){
 const e=p.event;
 if(p.kind==='ORDER_GET'){
  if(p.provider!=='alpaca'||p.environment!=='paper'||!fields(e,ORDER)||
   e.kind!=='ORDER_GET'||!id(e.clientOrderId)||!id(e.symbol)||
   !positive(e.expectedQuantity)||!safeTime(e.observedAtMs)||
   e.observedAtMs!==p.capturedAtMs||!fields(e.order,
    ['id','client_order_id','symbol','qty','filled_qty','status'])||
   !id(e.order.id)||e.order.client_order_id!==e.clientOrderId||
   e.order.symbol!==e.symbol||!positive(e.order.qty)||
   !decimal(e.order.filled_qty)||units(e.order.qty)!==units(e.expectedQuantity)||
   units(e.order.filled_qty)>units(e.order.qty)||
   !['accepted','pending_new','new','accepted_for_bidding','pending_replace',
     'pending_cancel','stopped','suspended','done_for_day','calculated','replaced',
     'canceled','cancelled','expired','rejected','filled','partially_filled'].includes(e.order.status))
    fail('B298_INVALID_ORDER_EXPORT');
 }else if(p.kind==='POSITION_GET'){
  if(p.provider!=='alpaca'||p.environment!=='paper'||!fields(e,POSITION)||
   e.kind!=='POSITION_GET'||!id(e.symbol)||
   !['flat','long','short'].includes(e.side)||!decimal(e.quantity)||
   !safeTime(e.observedAtMs)||e.observedAtMs!==p.capturedAtMs||
   (e.side==='flat'?!zero(e.quantity):!positive(e.quantity)))
   fail('B298_INVALID_POSITION_EXPORT');
 }else if(p.kind==='SIGNAL_DELIVERY'){
  if(p.provider!=='notification-export'||p.environment!=='isolated'||
   !fields(e,DELIVERY)||e.kind!=='SIGNAL_DELIVERY'||!id(e.signalId)||
   !hex(e.decisionOutputSha256)||!hex(e.recipientDigest)||
   !safeTime(e.emittedAtMs)||!greater(e.receiptAtMs,e.emittedAtMs)||
   e.receiptAtMs>p.capturedAtMs||!greater(e.targetOpenMs,e.emittedAtMs)||
   !['ACCEPTED','DELIVERED','FAILED'].includes(e.receiptStatus))
   fail('B298_INVALID_DELIVERY_EXPORT');
 }else if(p.kind==='OPERATOR_INTENT'){
  if(p.provider!=='customer-event-export'||p.environment!=='isolated'||
   !fields(e,OPERATOR)||e.kind!=='OPERATOR_INTENT'||!id(e.eventId)||
   !id(e.referenceId)||!['manual','hybrid','reverse'].includes(e.commercialMode)||
   !['open','cancel','close'].includes(e.action)||
   !['buy','sell'].includes(e.side)||!safeTime(e.observedAtMs)||
   e.observedAtMs!==p.capturedAtMs)
   fail('B298_INVALID_OPERATOR_EXPORT');
 }else fail('B298_UNKNOWN_EVIDENCE_KIND');
}
function verifyEnvelope(envelope,{trustedKeys,scope,nowMs=Date.now()}={}){
 if(!fields(envelope,['payload','signatureBase64'])||!fields(envelope.payload,KEYS)||
  envelope.payload.schema!==B298_SCHEMA||!B298_KINDS.includes(envelope.payload.kind)||
  !id(envelope.payload.keyId)||!id(envelope.payload.nonce)||
  !hex(envelope.payload.ownerDigest)||!hex(envelope.payload.accountDigest)||
  !hex(envelope.payload.consentDigest)||
  envelope.payload.readOnly!==true||envelope.payload.executionTransportEnabled!==false||
  envelope.payload.ordersSent!==0||envelope.payload.paperOrdersSent!==0||
  !safeTime(envelope.payload.capturedAtMs)||!safeTime(envelope.payload.expiresAtMs)||
  envelope.payload.expiresAtMs<=envelope.payload.capturedAtMs||
  envelope.payload.expiresAtMs-envelope.payload.capturedAtMs>120000||
  !safeTime(nowMs)||envelope.payload.capturedAtMs>nowMs+1000||
  nowMs>=envelope.payload.expiresAtMs||nowMs-envelope.payload.capturedAtMs>120000)
  fail('B298_INVALID_OR_STALE_READ_ENVELOPE');
 const p=envelope.payload;
 if(!scope||!hex(scope.ownerDigest)||!hex(scope.accountDigest)||
  !hex(scope.consentDigest)||p.ownerDigest!==scope.ownerDigest||
  p.accountDigest!==scope.accountDigest||p.consentDigest!==scope.consentDigest)
  fail('B298_WRONG_ACCOUNT_OR_CONSENT_SCOPE');
 validateEvent(p);
 if(!SIGNATURE.test(String(envelope.signatureBase64))||
  !trustedKeys||typeof trustedKeys!=='object'||Array.isArray(trustedKeys)||
  !Object.hasOwn(trustedKeys,p.keyId))fail('B298_COLLECTOR_KEY_NOT_PINNED');
 let key;try{key=createPublicKey(trustedKeys[p.keyId]);}catch{fail('B298_INVALID_TRUST_ROOT');}
 if(key.asymmetricKeyType!=='ed25519')fail('B298_UNSUPPORTED_SIGNATURE_KEY');
 let authentic=false;
 try{authentic=verifySignature(null,Buffer.from(DOMAIN+canonical(p),'utf8'),key,
  Buffer.from(envelope.signatureBase64,'base64'));}catch{fail('B298_INVALID_EVIDENCE_SIGNATURE');}
 if(!authentic)fail('B298_INVALID_EVIDENCE_SIGNATURE');
 return p;
}
function digestEnvelope(p){return sha(DOMAIN+canonical(p));}
function compatible(a,b){
 return a.keyId===b.keyId&&a.ownerDigest===b.ownerDigest&&
  a.accountDigest===b.accountDigest&&a.consentDigest===b.consentDigest&&
  a.nonce!==b.nonce&&a.capturedAtMs<b.capturedAtMs;
}
/** Public output redacts payload IDs and broker bodies. */
export function inspectB298SignedReadEnvelope(envelope,options){
 const p=verifyEnvelope(envelope,options);
 return Object.freeze({schema:'JENIOS_B298_VERIFIED_COLLECTOR_EXPORT_V1',
  evidenceDigestSha256:digestEnvelope(p),kind:p.kind,capturedAtMs:p.capturedAtMs,
  configuredCollectorSignatureVerified:true,independentBrokerAttestation:false,
  independentSignalDeliveryAttestation:false,externalClientConsentAttested:false,
  keyProvisioningAuditedByModule:false,durableReplayCheckPerformed:false,
  operatorReviewRequired:true,ordersSent:0,paperOrdersSent:0,
  liveExecutionAllowed:false,paperExecutionAllowed:false});
}
/** Calls the PRE-EXISTING B197 two-GET observation validator; never commits B152. */
export function auditB298SignedOrderPair({first,second,scope,trustedKeys,nowMs=Date.now()}={}){
 const a=verifyEnvelope(first,{scope,trustedKeys,nowMs});
 const b=verifyEnvelope(second,{scope,trustedKeys,nowMs});
 if(a.kind!=='ORDER_GET'||b.kind!=='ORDER_GET'||!compatible(a,b)||
  a.event.clientOrderId!==b.event.clientOrderId||
  a.event.symbol!==b.event.symbol||
  a.event.expectedQuantity!==b.event.expectedQuantity)
  fail('B298_INCOMPARABLE_BROKER_READS');
 const e=a.event,f=b.event;
 const review=assessPairedPaperReads({clientOrderId:e.clientOrderId,
  symbol:e.symbol,expectedQuantity:e.expectedQuantity,
  first:{order:e.order,receivedAtMs:e.observedAtMs},
  second:{order:f.order,receivedAtMs:f.observedAtMs},nowMs});
 const partialCancelled=review.lastObservedKind==='CANCELLED'&&
  units(review.lastCumulativeQuantity)>0n;
 return Object.freeze({schema:'JENIOS_B298_SIGNED_BROKER_PAIR_REVIEW_V1',
  firstEvidenceSha256:digestEnvelope(a),secondEvidenceSha256:digestEnvelope(b),
  orderReferenceDigest:review.orderReferenceDigest,
  assessment:review.assessment,observations:2,
  lastObservedKind:review.lastObservedKind,
  cumulativeQuantity:review.lastCumulativeQuantity,
  partialCancelRequiresExposureReview:partialCancelled,
  configuredCollectorSignatureVerified:true,brokerProviderSignatureVerified:false,
  accountPermissionIndependentlyAudited:false,durableLedgerReconciled:false,
  protectiveStopsVerified:false,positionClosedVerified:false,
  automaticResubmissionAllowed:false,manualBrokerReviewRequired:true,
  ordersSent:0,paperOrdersSent:0,productionTradingAuthorized:false});
}
export function auditB298SignedPositionPair({first,second,scope,trustedKeys,nowMs=Date.now()}={}){
 const a=verifyEnvelope(first,{scope,trustedKeys,nowMs});
 const b=verifyEnvelope(second,{scope,trustedKeys,nowMs});
 if(a.kind!=='POSITION_GET'||b.kind!=='POSITION_GET'||!compatible(a,b)||
  a.event.symbol!==b.event.symbol||b.capturedAtMs-a.capturedAtMs<250||
  b.capturedAtMs-a.capturedAtMs>60000)
  fail('B298_INCOMPARABLE_POSITION_READS');
 const stable=a.event.side===b.event.side&&
  units(a.event.quantity)===units(b.event.quantity);
 return Object.freeze({schema:'JENIOS_B298_SIGNED_POSITION_PAIR_REVIEW_V1',
  firstEvidenceSha256:digestEnvelope(a),secondEvidenceSha256:digestEnvelope(b),
  assessment:stable?'STABLE_READ_NEEDS_RECONCILIATION':'CHANGED_READ_PAUSE_AND_REVIEW',
  latestSide:b.event.side,latestQuantity:b.event.quantity,
  zeroQuantityObserved:zero(b.event.quantity),
  observedPositionCloseCertified:false,brokerProviderSignatureVerified:false,
  accountWidePositionReconciled:false,stopAndTargetVerified:false,
  manualBrokerReviewRequired:true,ordersSent:0,paperOrdersSent:0,
  productionTradingAuthorized:false});
}
/** B297 synthetic original-core output can be correlated but never upgraded to real delivery. */
export function auditB298SignedSignalDelivery({capture,receipt,scope,trustedKeys,nowMs=Date.now()}={}){
 const chain=verifyB297CaptureChain(capture);
 const p=verifyEnvelope(receipt,{scope,trustedKeys,nowMs});
 if(p.kind!=='SIGNAL_DELIVERY')fail('B298_DELIVERY_RECEIPT_REQUIRED');
 const e=p.event,original=capture.entries.find(x=>x.id===e.signalId);
 if(!original||e.decisionOutputSha256!==original.rawOutputSha256||
  e.emittedAtMs!==original.decisionAtMs||e.receiptAtMs<original.observedAtMs||
  e.receiptAtMs>=e.targetOpenMs)
  fail('B298_UNMATCHED_OR_LATE_SIGNAL_RECEIPT');
 return Object.freeze({schema:'JENIOS_B298_DECLARED_DELIVERY_CORRELATION_V1',
  originalChainSha256:chain.finalEntrySha256,
  collectorEvidenceSha256:digestEnvelope(p),receiptStatus:e.receiptStatus,
  beforeTarget:true,localOriginalDecisionLinked:true,
  declaredAsDelivered:e.receiptStatus==='DELIVERED',
  recipientReceiptIndependentlyVerified:false,
  externalDeliveryProviderAttested:false,recipientActuallyReceivedCertified:false,
  originalSourceWasSynthetic:true,realSignalEmissionVerified:false,
  noCommercialDeliveryClaim:true,ordersSent:0,paperOrdersSent:0});
}
/** Only B290 reference transformation: never translates an intent into a broker command. */
export function auditB298SignedOperatorIntent({envelope,scope,trustedKeys,nowMs=Date.now(),megaTrendDirection=null}={}){
 const p=verifyEnvelope(envelope,{scope,trustedKeys,nowMs});
 if(p.kind!=='OPERATOR_INTENT')fail('B298_OPERATOR_INTENT_REQUIRED');
 const e=p.event;
 const policy=e.commercialMode==='reverse'
  ?reverseOperatorCommand({eventId:e.eventId,action:e.action,side:e.side},
   {megaTrendDirection,operatorAuthorized:true})
  :{decision:'PASS_THROUGH_OPERATOR_MODE',side:e.side,noNewExposure:e.action!=='open'};
 return Object.freeze({schema:'JENIOS_B298_SIGNED_OPERATOR_REFERENCE_V1',
  exportDigestSha256:digestEnvelope(p),commercialMode:e.commercialMode,action:e.action,
  referenceDecision:policy.decision,
  referenceSide:policy.side,noNewExposure:policy.noNewExposure,
  attachedToRealBrokerOrder:false,externalConsentIndependentlyVerified:false,
  genuinePrivateReverseCoreUsed:false,positionLifecycleReconciled:false,
  manualInterventionRequired:true,ordersSent:0,paperOrdersSent:0,
  executionEnabled:false});
}
/** Review a signed local export sequence, not the customer's actual broker ledger.
 * Reuses B290 mode semantics, rejects out-of-order/duplicate lifecycle events and
 * reports no fill/position reconciliation. No transport or state persistence.
 */
export function auditB298SignedOperatorLifecycle({envelopes,scope,trustedKeys,
 nowMs=Date.now(),megaTrendDirection=null}={}){
 if(!Array.isArray(envelopes)||envelopes.length<2||envelopes.length>1000)
  fail('B298_INVALID_OPERATOR_BATCH');
 if(![null,'buy','sell'].includes(megaTrendDirection))
  fail('B298_INVALID_MEGATREND');
 const references=new Map(),seenEvents=new Set(),seenNonces=new Set();
 const counts={manual:0,hybrid:0,reverse:0},actions={open:0,close:0,cancel:0};
 const entries=[];let last=-1,collectorKey=null;
 for(const envelope of envelopes){
  const p=verifyEnvelope(envelope,{scope,trustedKeys,nowMs});
  if(p.kind!=='OPERATOR_INTENT'||p.capturedAtMs<=last||
   seenEvents.has(p.event.eventId)||seenNonces.has(p.nonce)||
   (collectorKey!==null&&collectorKey!==p.keyId))
   fail('B298_OPERATOR_SEQUENCE_TAMPERED');
  last=p.capturedAtMs;collectorKey=p.keyId;
  seenEvents.add(p.event.eventId);seenNonces.add(p.nonce);
  const e=p.event,prior=references.get(e.referenceId);
  if(e.action==='open'){
   if(prior)fail('B298_REFERENCE_REOPEN_NOT_ALLOWED');
   references.set(e.referenceId,{status:'OPEN_REFERENCE',side:e.side,mode:e.commercialMode});
  }else{
   if(prior?.status!=='OPEN_REFERENCE'||prior.side!==e.side||
    prior.mode!==e.commercialMode)fail('B298_ORPHAN_OR_MISMATCHED_CLOSE');
   references.set(e.referenceId,{...prior,status:e.action==='cancel'?'CANCELLED_REFERENCE':'CLOSED_REFERENCE'});
  }
  const policy=e.commercialMode==='reverse'
   ?reverseOperatorCommand({eventId:e.eventId,action:e.action,side:e.side},
    {megaTrendDirection,operatorAuthorized:true})
   :{decision:'PASS_THROUGH_OPERATOR_MODE',side:e.side,noNewExposure:e.action!=='open'};
  if(e.action!=='open'&&policy.noNewExposure!==true)
   fail('B298_UNEXPECTED_CLOSING_EXPOSURE');
  counts[e.commercialMode]++;actions[e.action]++;
  entries.push(Object.freeze({exportDigestSha256:digestEnvelope(p),
   action:e.action,mode:e.commercialMode,referenceDecision:policy.decision,
   noNewExposureFromClosingEvent:policy.noNewExposure}));
 }
 const unresolved=[...references.values()].filter(x=>x.status==='OPEN_REFERENCE').length;
 return Object.freeze({schema:'JENIOS_B298_SIGNED_OPERATOR_LIFECYCLE_V1',
  counts:Object.freeze(counts),actions:Object.freeze(actions),
  observedEvents:entries.length,unresolvedReferenceIntents:unresolved,
  projections:Object.freeze(entries),verifiedCollectorExport:true,
  operatorConsentIndependentlyVerified:false,brokerOrderFeedIndependentlyVerified:false,
  originalPrivateEngineComparedToActualOrders:false,
  cancelledOrClosedPositionsVerified:false,realizedPnlVerified:false,
  durableReplayPreventionImplemented:false,manualBrokerReviewRequired:true,
  ordersSent:0,paperOrdersSent:0,executionEnabled:false});
}

/** Educational what-if only. Never a trade ledger or proof of money saved. */
export function computeB298LossometerHypotheses(rows){
 if(!Array.isArray(rows)||rows.length>500)fail('B298_INVALID_LOSSOMETER');
 let hypotheticalAvoided=0,hypotheticalMissed=0,avoidedR=0,forgoneR=0;
 const ids=new Set();
 for(const e of rows){
  if(!fields(e,['id','referenceNetR','candidateNetR','source'])||
   !id(e.id)||ids.has(e.id)||e.source!=='LAB_COUNTERFACTUAL_ONLY'||
   typeof e.referenceNetR!=='number'||typeof e.candidateNetR!=='number'||
   !Number.isFinite(e.referenceNetR)||!Number.isFinite(e.candidateNetR)||
   Math.abs(e.referenceNetR)>25||Math.abs(e.candidateNetR)>25)
    fail('B298_UNTRUSTED_LOSSOMETER_EVENT');
  ids.add(e.id);
  if(e.referenceNetR<0&&e.candidateNetR>=0){hypotheticalAvoided++;avoidedR-=e.referenceNetR;}
  if(e.referenceNetR>0&&e.candidateNetR<=0){hypotheticalMissed++;forgoneR+=e.referenceNetR;}
 }
 return Object.freeze({schema:'JENIOS_B298_HYPOTHETICAL_LOSSOMETER_V1',
  scenarios:rows.length,hypotheticalLossesAvoided:hypotheticalAvoided,
  hypotheticalLossRNotTaken:Number(avoidedR.toFixed(6)),
  hypotheticalProfitsForegone:hypotheticalMissed,
  hypotheticalProfitRForegone:Number(forgoneR.toFixed(6)),
  actualLossesAvoided:null,actualProfitsForgone:null,
  actualBrokerRealizedPnl:null,realizedPnLVerified:false,
  independentPricesVerified:false,actualFillsVerified:false,
  commercialPerformanceClaimAllowed:false,ordersSent:0,paperOrdersSent:0});
}
/** Even complete local export signatures cannot certify the end-to-end commercial product. */
export function assessB298ExternalIntegrationGate(){
 return Object.freeze({schema:'JENIOS_B298_EXTERNAL_INTEGRATION_GATE_V1',
  signedExportContractImplemented:true,networkBrokerFeedConnected:false,
  independentlyVerifiedOperatorConsent:false,independentDeliveryProviderAck:false,
  originalPrivateCoreToBrokerEventBound:false,livePositionReconciliation:false,
  durableExternalAntiReplay:false,independentMarketPriceHistory:false,
  realLossometerCertified:false,liveExecutionAuthorized:false,
  commercialLaunchAllowed:false,ordersSent:0,paperOrdersSent:0,
  status:'NO_GO_EXTERNAL_SOURCES_NOT_CONNECTED'});
}