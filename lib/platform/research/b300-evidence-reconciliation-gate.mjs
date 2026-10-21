/**
 * JENIOS B300 — offline cross-evidence reconciliation gate (NO trading).
 * Reuses the genuine B297 local capture contract, B298 signed collector exports,
 * B299 signed *configured* consent and B197 broker-read *contract*.
 * A collector signature is NOT an official broker signature. None of the input
 * claims establishes account ownership, real execution, external delivery,
 * verified P&L, or losses actually avoided. No transport, DB writes or secrets.
 */
import {createHash} from 'node:crypto';
import {canonical,units} from '../pilot-prep/contracts.mjs';
import {verifyB297CaptureChain,inspectB297B152Arithmetic} from './b297-private-readonly-audit.mjs';
import {inspectB298SignedReadEnvelope,auditB298SignedOrderPair,
 auditB298SignedPositionPair,auditB298SignedSignalDelivery,
 auditB298SignedOperatorLifecycle,computeB298LossometerHypotheses} from './b298-signed-evidence-audit.mjs';
import {verifyB299OfflineConsent} from './b299-private-consent-replay-journal.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const validClock=x=>Number.isSafeInteger(x)&&x>0;
const sha=x=>createHash('sha256').update(canonical(x)).digest('hex');
const inputArray=(v,max,code)=>{
 if(!Array.isArray(v)||v.length>max)fail(code);
 return v;
};
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).length===keys.length&&Object.keys(o).every(k=>keys.includes(k));
const bounded=Object.freeze({pairs:20,deliveries:50,intents:100,counterfactuals:200,riskChecks:20});

/**
 * Entirely offline: accepts caller-supplied signed exports plus explicitly
 * configured trust roots. Requires a B299 consent signature for EACH export.
 * Does not itself write to or certify B299's separate durable replay journal.
 */
export function auditB300ReadOnlyCohort({scope,signedConsent,trustedConsentKeys,
 trustedCollectorKeys,b297Capture=null,orderPairs=[],positionPairs=[],
 deliveryReceipts=[],operatorIntents=[],lossometerWhatIf=[],riskChecks=[],
 nowMs=Date.now()}={}){
 if(!validClock(nowMs))fail('B300_INVALID_CLOCK');
 inputArray(orderPairs,bounded.pairs,'B300_INVALID_ORDER_PAIRS');
 inputArray(positionPairs,bounded.pairs,'B300_INVALID_POSITION_PAIRS');
 inputArray(deliveryReceipts,bounded.deliveries,'B300_INVALID_DELIVERIES');
 inputArray(operatorIntents,bounded.intents,'B300_INVALID_INTENTS');
 inputArray(lossometerWhatIf,bounded.counterfactuals,'B300_INVALID_LOSSOMETER');
 inputArray(riskChecks,bounded.riskChecks,'B300_INVALID_RISK_INPUTS');
 if(!orderPairs.length&&!positionPairs.length&&!deliveryReceipts.length&&
    !operatorIntents.length&&!riskChecks.length)fail('B300_EMPTY_REVIEW');
 if(deliveryReceipts.length&&!b297Capture)fail('B300_ORIGINAL_CAPTURE_REQUIRED');
 if(operatorIntents.length===1)fail('B300_INCOMPLETE_OPERATOR_SEQUENCE');
 const consent=verifyB299OfflineConsent({signedConsent,trustedConsentKeys,
  trustedCollectorKeys,scope,nowMs});
 const state={seenNonce:new Set(),seenDigest:new Set(),readKinds:new Set()};
 const verifyOne=(envelope,kind)=>{
  const item=inspectB298SignedReadEnvelope(envelope,{scope,trustedKeys:trustedCollectorKeys,nowMs});
  if(item.kind!==kind)fail('B300_WRONG_EVIDENCE_KIND');
  const p=envelope.payload;
  if(p.keyId!==consent.collectorKeyId||
    !consent.allowedKinds.includes(kind)||
    p.capturedAtMs<consent.issuedAtMs||p.capturedAtMs>=consent.expiresAtMs)
   fail('B300_OUTSIDE_SIGNED_CONSENT');
  if(state.seenNonce.has(p.nonce)||state.seenDigest.has(item.evidenceDigestSha256))
   fail('B300_DUPLICATE_EVIDENCE_OR_NONCE');
  state.seenNonce.add(p.nonce);state.seenDigest.add(item.evidenceDigestSha256);
  state.readKinds.add(kind);
  return item;
 };
 const orderRows=[],positionRows=[],deliveryRows=[];
 const seenOrder=new Set(),seenPosition=new Set(),seenSignal=new Set();
 for(const pair of orderPairs){
  if(!Array.isArray(pair)||pair.length!==2)fail('B300_ORDER_PAIR_REQUIRED');
  verifyOne(pair[0],'ORDER_GET');verifyOne(pair[1],'ORDER_GET');
  const raw=pair[0].payload.event;
  if(seenOrder.has(raw.clientOrderId))fail('B300_ORDER_TWICE_IN_COHORT');
  seenOrder.add(raw.clientOrderId);
  const x=auditB298SignedOrderPair({first:pair[0],second:pair[1],
   scope,trustedKeys:trustedCollectorKeys,nowMs});
  orderRows.push({symbol:raw.symbol,assessment:x.assessment,
   kind:x.lastObservedKind,quantity:x.cumulativeQuantity,
   partialCancel:x.partialCancelRequiresExposureReview});
 }
 for(const pair of positionPairs){
  if(!Array.isArray(pair)||pair.length!==2)fail('B300_POSITION_PAIR_REQUIRED');
  verifyOne(pair[0],'POSITION_GET');verifyOne(pair[1],'POSITION_GET');
  const raw=pair[0].payload.event;
  if(seenPosition.has(raw.symbol))fail('B300_POSITION_TWICE_IN_COHORT');
  seenPosition.add(raw.symbol);
  const x=auditB298SignedPositionPair({first:pair[0],second:pair[1],
   scope,trustedKeys:trustedCollectorKeys,nowMs});
  positionRows.push({symbol:raw.symbol,assessment:x.assessment,
   side:x.latestSide,quantity:x.latestQuantity,zero:x.zeroQuantityObserved});
 }
 const captureInfo=b297Capture?verifyB297CaptureChain(b297Capture):null;
 for(const receipt of deliveryReceipts){
  verifyOne(receipt,'SIGNAL_DELIVERY');
  const raw=receipt.payload.event;
  if(seenSignal.has(raw.signalId))fail('B300_SIGNAL_RECEIPT_DUPLICATE');
  seenSignal.add(raw.signalId);
  const x=auditB298SignedSignalDelivery({capture:b297Capture,receipt,
   scope,trustedKeys:trustedCollectorKeys,nowMs});
  deliveryRows.push(x.receiptStatus);
 }
 for(const e of operatorIntents)verifyOne(e,'OPERATOR_INTENT');
 const operator=operatorIntents.length?auditB298SignedOperatorLifecycle({
  envelopes:operatorIntents,scope,trustedKeys:trustedCollectorKeys,nowMs}):null;
 const modes=operator?.counts??{manual:0,hybrid:0,reverse:0};
 const riskRows=riskChecks.map(item=>{
  if(!exact(item,['order','meta','options']))fail('B300_RISK_FIELDS_INVALID');
  const x=inspectB297B152Arithmetic(item.order,item.meta,item.options);
  if(x.ordersSent!==0||x.orderApprovedForTransmission!==false)
   fail('B300_RISK_CHECK_ESCAPED_READONLY');
  return {riskSha256:x.inputDigestSha256,riskUnits:x.riskUnits};
 });
 const hypothesis=computeB298LossometerHypotheses(lossometerWhatIf);
 const issues=new Set();
 if(!orderRows.length)issues.add('BROKER_ORDER_OBSERVATIONS_MISSING');
 if(!positionRows.length)issues.add('BROKER_POSITION_OBSERVATIONS_MISSING');
 if(!operator)issues.add('OPERATOR_INTENTS_MISSING');
 if(Object.values(modes).some(n=>n===0))issues.add('THREE_COMMERCIAL_MODES_INCOMPLETE');
 if(!deliveryRows.length)issues.add('SIGNAL_RECEIPT_OBSERVATIONS_MISSING');
 if(!riskRows.length)issues.add('RISK_B152_EVIDENCE_MISSING');
 if(orderRows.some(x=>!positionRows.some(p=>p.symbol===x.symbol)))
  issues.add('ORDER_HAS_NO_SAME_SYMBOL_POSITION_READ');
 if(orderRows.some(x=>x.partialCancel))issues.add('CANCEL_WITH_PARTIAL_FILL_REQUIRES_REVIEW');
 if(orderRows.some(x=>x.assessment!=='STABLE_TERMINAL_OBSERVATIONS'))
  issues.add('ORDER_STATE_UNCERTAIN_OR_OPEN');
 if(positionRows.some(x=>x.assessment!=='STABLE_READ_NEEDS_RECONCILIATION'))
  issues.add('POSITION_CHANGED_OR_AMBIGUOUS');
 if(orderRows.some(x=>units(x.quantity)>0n&&
    positionRows.some(p=>p.symbol===x.symbol&&p.zero)))
  issues.add('FILLED_ORDER_AND_FLAT_POSITION_NOT_A_CLOSE_PROOF');
 if(operator?.unresolvedReferenceIntents>0)issues.add('OPEN_OPERATOR_INTENTS_UNRECONCILED');
 if(deliveryRows.some(x=>x!=='DELIVERED'))issues.add('DELIVERY_NOT_DECLARED_DELIVERED');
 // Even with no local inconsistencies, these external gates are ALWAYS missing.
 issues.add('COLLECTOR_EXPORT_NOT_OFFICIAL_BROKER_ATTESTATION');
 issues.add('CLIENT_IDENTITY_AND_API_SCOPE_UNVERIFIED');
 issues.add('RECIPIENT_ACK_UNVERIFIED_BY_INDEPENDENT_PROVIDER');
 issues.add('B152_DURABLE_LEDGER_NOT_RECONCILED');
 issues.add('STOP_TARGET_AND_FILL_PRICES_UNVERIFIED');
 issues.add('B299_ANTI_REPLAY_JOURNAL_NOT_READ_BY_THIS_MODULE');
 issues.add('ACTUAL_PNL_AND_LOSS_AVOIDANCE_NOT_VERIFIED');
 const severity=orderRows.some(x=>x.partialCancel||x.assessment==='EVOLVING_OR_AMBIGUOUS')||
  positionRows.some(x=>x.assessment==='CHANGED_READ_PAUSE_AND_REVIEW')||
  (operator&&operator.unresolvedReferenceIntents>0)?'CRITICAL_REVIEW':
  'NO_GO_REQUIRES_EXTERNAL_ATTESTATION';
 const summary=Object.freeze({schema:'JENIOS_B300_READONLY_CORRELATION_GATE_V1',
  evidenceCount:state.seenNonce.size,orderPairs:orderRows.length,
  positionPairs:positionRows.length,declaredSignalReceipts:deliveryRows.length,
  declaredDelivered:deliveryRows.filter(x=>x==='DELIVERED').length,
  declaredAccepted:deliveryRows.filter(x=>x==='ACCEPTED').length,
  declaredFailed:deliveryRows.filter(x=>x==='FAILED').length,
  operatorEvents:operator?.observedEvents??0,
  collectorClaimedModes:Object.freeze({...modes}),
  unresolvedOperatorReferences:operator?.unresolvedReferenceIntents??null,
  staticRiskArithmeticChecks:riskRows.length,
  orderAssessments:Object.freeze(orderRows.map(x=>Object.freeze({
   kind:x.kind,assessment:x.assessment,partialCancelRequiresReview:x.partialCancel}))),
  positionAssessments:Object.freeze(positionRows.map(x=>Object.freeze({
   side:x.side,assessment:x.assessment,zeroQuantityObserved:x.zero}))),
  captureSyntheticChainVerified:!!captureInfo,
  captureSha256:captureInfo?.finalEntrySha256??null,
  consentSignatureVerifiedToConfiguredKey:consent.configuredConsentSignerSignatureVerified,
  collectorSignaturesVerifiedToConfiguredKeys:true,
  independentProviderOriginVerified:false,independentAccountOwnerVerified:false,
  actualDeliveryConfirmed:false,brokerRealFillVerified:false,
  b152DurableLedgerReconciled:false,externalConsentAuthorityVerified:false,
  brokerStopAndTargetGuaranteed:false,marketPricesIndependentlyVerified:false,
  b299DurableReplayVerifiedByThisModule:false,
  riskArithmeticOnly:riskRows.length>0,
  hypothesis:Object.freeze({scenarios:hypothesis.scenarios,
   hypotheticalLossesAvoided:hypothesis.hypotheticalLossesAvoided,
   hypotheticalLossRNotTaken:hypothesis.hypotheticalLossRNotTaken,
   hypotheticalProfitsForegone:hypothesis.hypotheticalProfitsForegone,
   hypotheticalProfitRForegone:hypothesis.hypotheticalProfitRForegone,
   actualLossesAvoided:null,actualProfitsForgone:null,
   actualBrokerRealizedPnl:null}),
  manualLossStreakVerified:null,realPnlVerified:null,
  automaticReverseModeSwitch:false,
  issues:Object.freeze([...issues].sort()),severity,
  releaseStatus:'NO_GO_EXTERNAL_VERIFICATION_REQUIRED',
  ordersSent:0,paperOrdersSent:0,paymentsCreated:0,
  realExecutionEnabled:false,liveOrdersEnabled:false,
  commercialResultsCanBeClaimed:false,
  note:'Saidas de leitura assinadas por chaves configuradas e pesquisa sintetica; sem identidade de provedor independente, sem conciliacao de ordens, sem P&L realizado.'
 });
 const reportSha256=sha(summary);
 return Object.freeze({...summary,reportSha256,
  digestIsExternalSignature:false,independentTimestampAttested:false});
}

export function assessB300LaunchReadiness(){
 return Object.freeze({schema:'JENIOS_B300_EXTERNAL_LAUNCH_GATE_V1',
  researchContractsTested:true,originalPrivateEngineModified:false,
  officialBrokerConnectedByThisModule:false,realOrderEventsIndependentlyVerified:false,
  externalDeliveryIndependentlyVerified:false,
  realPnlIndependentlyVerified:false,liveExecutionPermitted:false,
  paperExecutionPermitted:false,automatedModeSwitchPermitted:false,
  commercialPerformanceClaimsPermitted:false,productionDeployPermitted:false,
  ordersSent:0,paperOrdersSent:0,
  status:'NO_GO_REQUIRE_INDEPENDENT_EXTERNAL_EVIDENCE'});
}