/**
 * JENIOS Robot R1 — additive/adversarial OFFLINE research gates only.
 * Reuses B290/B291 commercial contracts; never calls the original private
 * engine, reads a broker, submits Paper orders, or changes trading parameters.
 * All evidence supplied by the caller is UNVERIFIED: no claimed realized P&L.
 */
import {inspectSignalDelivery,reverseOperatorCommand} from './b290-inversion-signal-contract.mjs';
import {reviewB291CopilotContext} from './b291-three-mode-copilot.mjs';
const deny=c=>{throw Object.assign(new Error(c),{code:c});};
const isTime=x=>Number.isSafeInteger(x)&&x>0;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const exact=(object,fields)=>object&&typeof object==='object'&&!Array.isArray(object)&&
 Object.keys(object).length===fields.length&&Object.keys(object).every(k=>fields.includes(k));
const ID=/^[A-Za-z0-9._:-]{1,80}$/;
const ASSET=/^[A-Z][A-Z0-9-]{2,24}$/;
const cents=x=>Number(x.toFixed(6));
const safety=Object.freeze({ordersSent:0,paperOrdersSent:0,realExecutionEnabled:false,
 externalBrokerAuthenticated:false,independentSourceVerified:false,
 originalRobotRuntimeAttested:false,commercialPerformanceClaimAllowed:false});

export function reviewR1ManualSignalWindow(e,{latencyBudgetMs=60000}={}){
 const keys=['signalId','asset','mode','direction','emittedAtMs','recordedAtMs',
  'declaredReceivedAtMs','targetOpenMs','observedAtMs','isOrder','executed','source'];
 if(!exact(e,keys)||e.mode!=='manual'||!ID.test(e.signalId)||
  !ASSET.test(e.asset)||!['UP','DOWN','ABSTAIN'].includes(e.direction)||
  e.isOrder!==false||e.executed!==false||e.source!=='CALLER_SUPPLIED_SYNTHETIC'||
  ![e.emittedAtMs,e.recordedAtMs,e.targetOpenMs,e.observedAtMs].every(isTime)||
  e.emittedAtMs>e.recordedAtMs||e.recordedAtMs>e.observedAtMs||
  e.emittedAtMs>=e.targetOpenMs||
  (e.declaredReceivedAtMs!==null&&
   (!isTime(e.declaredReceivedAtMs)||
    e.declaredReceivedAtMs<e.recordedAtMs||
    e.declaredReceivedAtMs>e.observedAtMs))||
  !Number.isSafeInteger(latencyBudgetMs)||latencyBudgetMs<1000||latencyBudgetMs>3600000)
  deny('ROBOT_R1_INVALID_MANUAL_EVIDENCE');
 const reasons=[];
 if(e.direction==='ABSTAIN')reasons.push('NO_DIRECTION_NO_TRADE');
 else{
  if(e.declaredReceivedAtMs===null)reasons.push('NO_RECEPTION_TIMESTAMP');
  else if(e.declaredReceivedAtMs>=e.targetOpenMs)reasons.push('ARRIVED_AFTER_OPPORTUNITY');
  else if(e.declaredReceivedAtMs-e.emittedAtMs>latencyBudgetMs)
   reasons.push('DELIVERY_LATENCY_EXCEEDED');
 }
 const declaredTimely=e.direction!=='ABSTAIN'&&reasons.length===0;
 if(declaredTimely) {
  const result=inspectSignalDelivery({
   mode:'manual',direction:e.direction,emittedAtMs:e.emittedAtMs,
   targetCandleOpenMs:e.targetOpenMs,isOrder:false
  },{recordedAtMs:e.recordedAtMs,deliveredAtMs:e.declaredReceivedAtMs});
  if(result.deliveryProviderVerified!==false||result.ordersSent!==0)
   deny('ROBOT_R1_UNEXPECTED_PROVIDER_CERTIFICATION');
 }
 return Object.freeze({schema:'JENIOS_ROBOT_R1_MANUAL_TIMELINE_V1',
  signalId:e.signalId,declaredTimely,issues:Object.freeze(reasons),
  decision:declaredTimely?'TIMELY_DECLARED_UNVERIFIED':'NO_DELIVERY_PERFORMANCE_CREDIT',
  deliveryProviderReceiptIndependentlyVerified:false,
  originalSignalProvenanceVerified:false,liveManualPerformanceCertified:false,
  realFillCount:null,lossesNeutralized:null,actualPnl:null,
  ...safety});
}

export function reviewR1HybridSafety({context,intervalMs,paused,positionOpen,
 liquidityState}={}){
 if(![60000,300000,900000,3600000].includes(intervalMs)||
  typeof paused!=='boolean'||typeof positionOpen!=='boolean'||
  !['unknown','thin','halted','declared_adequate'].includes(liquidityState))
  deny('ROBOT_R1_INVALID_HYBRID_CONTEXT');
 // B291 validation is deliberately reused unchanged. It requires caller data to
 // admit that source signatures and operator approval were not authenticated.
 const base=reviewB291CopilotContext(context);
 const issues=[...base.reasons];
 if(context.observedAtMs-context.closedAtMs>intervalMs+300000)
  issues.push('CLOSED_MARKET_DATA_STALE');
 if(paused)issues.push('OPERATOR_PAUSED');
 if(positionOpen)issues.push('EXISTING_POSITION_REQUIRES_REVIEW');
 if(liquidityState==='unknown')issues.push('LIQUIDITY_UNVERIFIED');
 if(liquidityState==='thin')issues.push('LOW_LIQUIDITY');
 if(liquidityState==='halted')issues.push('MARKET_HALTED');
 return Object.freeze({schema:'JENIOS_ROBOT_R1_HYBRID_CONTEXT_GUARD_V1',
  classification:issues.length?'WAIT_AND_REVIEW':'DESCRIPTIVE_CONTEXT_UNVERIFIED',
  reasons:Object.freeze([...new Set(issues)]),marketBias:base.marketBias,
  originalB291Classification:base.classification,
  entryPriceSuggestion:null,stopPriceSuggestion:null,targetPriceSuggestion:null,
  automatedPositionSizing:null,operatorDecides:true,hybridInvertsOrders:false,
  generativeTextCannotAuthorizeTrade:true,marketProviderIndependentlyVerified:false,
  ...safety});
}

export function reviewR1ReverseEligibility({command,marketType,megaTrendDirection=null,
 paused,positionOpen,metadataAgeMs,metadataMaxAgeMs,spreadBps,
 maxSpreadBps,borrowAvailableDeclared,fundingBps,localConsentDeclared}={}){
 if(!command||!['open','cancel','close'].includes(command.action)||
  !['buy','sell'].includes(command.side)||!ID.test(command.eventId||'')||
  !['spot','margin','perpetual'].includes(marketType)||
  ![null,'buy','sell'].includes(megaTrendDirection)||
  [paused,positionOpen,borrowAvailableDeclared,localConsentDeclared].some(x=>typeof x!=='boolean')||
  !Number.isSafeInteger(metadataAgeMs)||metadataAgeMs<0||
  !Number.isSafeInteger(metadataMaxAgeMs)||metadataMaxAgeMs<1000||
  metadataMaxAgeMs>86400000||
  !finite(spreadBps)||spreadBps<0||spreadBps>10000||
  !finite(maxSpreadBps)||maxSpreadBps<0||maxSpreadBps>10000||
  (fundingBps!==null&&(!finite(fundingBps)||Math.abs(fundingBps)>10000)))
  deny('ROBOT_R1_INVALID_REVERSE_INPUT');
 const reference=reverseOperatorCommand(command,{megaTrendDirection,
  operatorAuthorized:true});
 const noNewExposure=command.action!=='open';
 if(noNewExposure)return Object.freeze({
  schema:'JENIOS_ROBOT_R1_REVERSE_SAFETY_V1',
  classification:'POSITION_LIFECYCLE_REFERENCE_ONLY',
  referenceSide:reference.side,referenceAction:reference.action,
  reasonCodes:Object.freeze([]),noNewExposure:true,
  brokerCancelOrClosePerformed:false,liveShortBorrowVerified:false,
  externalConsentVerified:false,brokerStopAndTargetVerified:false,
  ...safety
 });
 const issues=[];
 if(!localConsentDeclared)issues.push('OPERATOR_CONSENT_NOT_DECLARED');
 if(paused)issues.push('OPERATOR_PAUSED');
 if(positionOpen)issues.push('POSITION_ALREADY_OPEN');
 if(metadataAgeMs>metadataMaxAgeMs)issues.push('INSTRUMENT_METADATA_STALE');
 if(spreadBps>maxSpreadBps)issues.push('SPREAD_TOO_WIDE');
 if(marketType==='spot'&&reference.side==='sell')
  issues.push('SPOT_SHORT_UNSUPPORTED');
 if(reference.side==='sell'&&marketType!=='spot'&&!borrowAvailableDeclared)
  issues.push('SHORT_BORROW_NOT_DECLARED');
 if(marketType!=='spot'&&fundingBps===null)
  issues.push('FUNDING_NOT_MODELED');
 return Object.freeze({
  schema:'JENIOS_ROBOT_R1_REVERSE_SAFETY_V1',
  classification:issues.length?'BLOCK_NEW_EXPOSURE':'REFERENCE_FOR_HUMAN_REVIEW_ONLY',
  referenceSide:issues.length?null:reference.side,
  referenceAction:issues.length?null:reference.action,
  theoreticalReferenceDecision:reference.decision,
  reasonCodes:Object.freeze(issues),noNewExposure:issues.length>0,
  liveShortBorrowVerified:false,externalConsentVerified:false,
  brokerStopAndTargetVerified:false,metadataIndependentlyAttested:false,
  orderTransportAuthorized:false,privateCoreDecisionAttested:false,
  ...safety
 });
}

/** Paired comparisons of FIXTURES ONLY. Classification does not imply client
 * losses were actually avoided; even if caller reports an ex-ante forecast,
 * frozen time and market data must be independently witnessed later.
 */
export function reviewR1PairedLossAttribution(rows=[]){
 if(!Array.isArray(rows)||rows.length>500)
  deny('ROBOT_R1_INVALID_PAIRED_ROWS');
 const ids=new Set(),cohorts=new Set();
 const result={paired:0,hypotheticalLossesFullyAvoided:0,
  hypotheticalLossesPartiallyReduced:0,hypotheticalLossesWorsened:0,
  hypotheticalNewLossesIntroduced:0,hypotheticalGainsForegone:0,
  hypotheticalGainsReduced:0,netDifferenceR:0};
 for(const row of rows){
  const keys=['id','cohortKey','referenceNetR','interventionNetR','interventionKind','source'];
  if(!exact(row,keys)||!ID.test(row.id)||!ID.test(row.cohortKey)||
   ids.has(row.id)||cohorts.has(row.cohortKey)||
   !finite(row.referenceNetR)||!finite(row.interventionNetR)||
   Math.abs(row.referenceNetR)>25||Math.abs(row.interventionNetR)>25||
   !['ABSTAIN','KEEP','REVERSE_REFERENCE'].includes(row.interventionKind)||
   row.source!=='SYNTHETIC_PAIRED_UNVERIFIED'||
   (row.interventionKind==='ABSTAIN'&&row.interventionNetR!==0))
   deny('ROBOT_R1_UNTRUSTED_PAIRED_OUTCOME');
  ids.add(row.id);cohorts.add(row.cohortKey);
  const b=row.referenceNetR,c=row.interventionNetR;
  result.paired++;
  result.netDifferenceR+=c-b;
  if(b<0&&c>=0)result.hypotheticalLossesFullyAvoided++;
  if(b<0&&c<0&&c>b)result.hypotheticalLossesPartiallyReduced++;
  if(b<0&&c<b)result.hypotheticalLossesWorsened++;
  if(b>=0&&c<0)result.hypotheticalNewLossesIntroduced++;
  if(b>0&&c<=0)result.hypotheticalGainsForegone++;
  if(b>0&&c>0&&c<b)result.hypotheticalGainsReduced++;
 }
 result.netDifferenceR=cents(result.netDifferenceR);
 return Object.freeze({schema:'JENIOS_ROBOT_R1_PAIRED_ATTRIBUTION_V1',
  ...result,cohortsFromCallerNotIndependent:rows.length,
  classification:'UNSIGNED_LAB_COUNTERFACTUAL_ONLY',
  gainToLossCanCountInBothNewLossAndForegoneGain:true,
  actualLossesAvoided:null,actualBrokerRealizedPnl:null,
  sourceBrokerFillsVerified:false,independentPriceVerified:false,
  prospectiveHypothesisAttested:false,statisticalAdvantageCertified:false,
  commercialLossometerAllowed:false,customerEconomyObserved:false,...safety});
}
