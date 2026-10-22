/**
 * JENIOS ROBOT-R4 — research-only hypothetical execution feasibility stress.
 * NEVER trades, reads provider APIs, attests price/fills, invokes paid services,
 * recomputes the private engine, or changes fixed B288/B152 risk rules.
 * A nonblocked estimate is NOT a trade approval, simulated fill, or performance.
 */
import {reverseOperatorCommand} from './b290-inversion-signal-contract.mjs';
import {reviewR1ReverseEligibility} from './robot-r1-adversarial-gates.mjs';
import {B288_FIXED_PROTOCOL} from './b288-paired-filter-audit.mjs';
import {createHash} from 'node:crypto';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const natural=v=>Number.isSafeInteger(v)&&v>0;
const exact=(o,fields)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).length===fields.length&&Object.keys(o).every(k=>fields.includes(k));
const freeze=x=>Object.freeze(x);
const round=x=>Number(x.toFixed(6));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

export const ROBOT_R4_LOCKED_ASSUMPTIONS=freeze({
 schema:'JENIOS_ROBOT_R4_FEASIBILITY_LAB_V1',
 intervalMs:3600000,observationGraceMs:300000,maximumObservationLagMs:14400000,
 stopPct:B288_FIXED_PROTOCOL.riskStopPct,
 maxSyntheticSpreadBps:30,maxSyntheticAdverseGapBps:100,
 minimumDeclaredDepthMultiple:2,
 unit:'R_OF_UNVERIFIED_REFERENCE_STOP',
 materialCostsUnverified:true,
 partialFillsNotInterpretableAsCompletedTrades:true,
 parameterOptimizationAllowed:false,ordersOrPaperAllowed:false
});
function validate({signal,market,observation,friction,observedAtMs}){
 if(!exact(signal,['id','mode','direction','emittedAtMs','referencePrice',
     'targetOpenMs','source','isOrder'])||
   !/^[A-Za-z0-9._-]{1,80}$/.test(signal.id)||
   !['manual','hybrid','reverse'].includes(signal.mode)||
   !['UP','DOWN','ABSTAIN'].includes(signal.direction)||
   !natural(signal.emittedAtMs)||!natural(signal.targetOpenMs)||
   signal.emittedAtMs>=signal.targetOpenMs||
   !finite(signal.referencePrice)||signal.referencePrice<=0||
   signal.source!=='SYNTHETIC_FROZEN_REFERENCE_ONLY'||signal.isOrder!==false)
  fail('ROBOT_R4_UNVERIFIED_OR_LATE_SIGNAL');
 if(!exact(market,['asset','marketType','metadataAgeMs','metadataMaxAgeMs',
    'borrowAvailableDeclared','megaTrendDirection','paused','positionOpen',
    'localConsentDeclared','liquidityState'])||
   !/^[A-Z][A-Z0-9-]{2,24}$/.test(market.asset)||
   !['spot','margin','perpetual'].includes(market.marketType)||
   !Number.isSafeInteger(market.metadataAgeMs)||market.metadataAgeMs<0||
   !Number.isSafeInteger(market.metadataMaxAgeMs)||
   market.metadataMaxAgeMs<1000||market.metadataMaxAgeMs>86400000||
   ![null,'buy','sell'].includes(market.megaTrendDirection)||
   [market.borrowAvailableDeclared,market.paused,market.positionOpen,
    market.localConsentDeclared].some(x=>typeof x!=='boolean')||
   !['unknown','thin','halted','declared_adequate'].includes(market.liquidityState))
  fail('ROBOT_R4_UNVERIFIED_MARKET_META');
 if(!exact(observation,['targetOpenMs','targetCloseMs','observedAtMs','open',
   'high','low','close','volume','quoteCurrency','sourceSigned','orderExecuted'])||
   observation.targetOpenMs!==signal.targetOpenMs||
   observation.targetCloseMs!==observation.targetOpenMs+
    ROBOT_R4_LOCKED_ASSUMPTIONS.intervalMs||
   !natural(observation.targetCloseMs)||!natural(observation.observedAtMs)||
   !natural(observedAtMs)||observation.observedAtMs>observedAtMs||
   observation.observedAtMs<observation.targetCloseMs+
    ROBOT_R4_LOCKED_ASSUMPTIONS.observationGraceMs||
   ![observation.open,observation.high,observation.low,observation.close,
    observation.volume].every(finite)||
   observation.open<=0||observation.low<=0||observation.close<=0||
   observation.high<Math.max(observation.open,observation.low,observation.close)||
   observation.low>Math.min(observation.open,observation.close)||
   observation.volume<=0||observation.high/observation.low>1.5||
   observation.quoteCurrency!=='USD'||observation.sourceSigned!==false||
   observation.orderExecuted!==false)
  fail('ROBOT_R4_UNVERIFIED_CANDLE');
 if(!exact(friction,['feeBps','spreadBps','entrySlippageBps',
    'exitSlippageBps','stopSlippageBps','fundingBps',
    'declaredDepthMultiple','declaredFillFraction'])||
   [friction.feeBps,friction.spreadBps,friction.entrySlippageBps,
    friction.exitSlippageBps,friction.stopSlippageBps,
    friction.declaredDepthMultiple,friction.declaredFillFraction].some(x=>!finite(x))||
   [friction.feeBps,friction.spreadBps,friction.entrySlippageBps,
    friction.exitSlippageBps,friction.stopSlippageBps].some(x=>x<0||x>1000)||
   friction.declaredDepthMultiple<0||friction.declaredDepthMultiple>100||
   friction.declaredFillFraction<0||friction.declaredFillFraction>1||
   (friction.fundingBps!==null&&(!finite(friction.fundingBps)||
    friction.fundingBps<0||friction.fundingBps>1000))||
   (market.marketType==='spot'&&friction.fundingBps!==0))
  fail('ROBOT_R4_UNVERIFIED_FRICTION');
}
const noGo=freeze({
 schema:'JENIOS_ROBOT_R4_FEASIBILITY_ESTIMATE_V1',
 evidence:'SYNTHETIC_CALLER_SUPPLIED_UNSIGNED',
 marketIndependentlyWitnessed:false,originalEngineDecisionAttested:false,
 signalDeliveryVerified:false,borrowPermissionIndependentlyVerified:false,
 actualOrderFilled:false,partialFillReconciled:false,
 trueBidAskDepthVerified:false,feesAndFundingVerifiedWithBroker:false,
 intrabarSequenceKnown:false,stopExecutionGuaranteed:false,
 actualLossesAvoided:null,actualBrokerRealizedPnl:null,
 statisticallyProven:false,commercialResultClaimAllowed:false,
 privateRiskBookChanged:false,modeSwitched:false,ordersSent:0,
 paperOrdersSent:0,paidAiInvocations:0,realExecutionEnabled:false,
 productionReleaseAllowed:false
});
export function reviewR4ExecutionFeasibility(input={}){
 validate(input);
 const {signal,market,observation:o,friction:f,observedAtMs}=input;
 const reasons=[];
 let side=null,referenceDecision='ABSTAIN';
 if(signal.direction==='ABSTAIN')reasons.push('ABSTAIN_HAS_NO_EXECUTION');
 else {
  const operatorSide=signal.direction==='UP'?'buy':'sell';
  if(signal.mode==='reverse'){
   const r=reviewR1ReverseEligibility({
    command:{eventId:signal.id,action:'open',side:operatorSide},
    marketType:market.marketType,megaTrendDirection:market.megaTrendDirection,
    paused:market.paused,positionOpen:market.positionOpen,
    metadataAgeMs:market.metadataAgeMs,metadataMaxAgeMs:market.metadataMaxAgeMs,
    spreadBps:f.spreadBps,
    maxSpreadBps:ROBOT_R4_LOCKED_ASSUMPTIONS.maxSyntheticSpreadBps,
    borrowAvailableDeclared:market.borrowAvailableDeclared,
    fundingBps:f.fundingBps,localConsentDeclared:market.localConsentDeclared
   });
   if(r.classification==='BLOCK_NEW_EXPOSURE')
    reasons.push(...r.reasonCodes);
   else side=r.referenceSide;
   referenceDecision=r.theoreticalReferenceDecision??'BLOCKED_REVERSE_REFERENCE';
  }else{
   side=operatorSide;
   referenceDecision='KEEP_UNVERIFIED_OPERATOR_DIRECTION';
  }
 }
 if(market.paused)reasons.push('OPERATOR_PAUSED');
 if(market.positionOpen)reasons.push('POSITION_ALREADY_OPEN');
 if(!market.localConsentDeclared)reasons.push('CONSENT_NOT_DECLARED');
 if(market.metadataAgeMs>market.metadataMaxAgeMs)reasons.push('INSTRUMENT_METADATA_STALE');
 if(market.liquidityState!=='declared_adequate')
  reasons.push('MARKET_LIQUIDITY_UNVERIFIED_OR_LOW');
 if(o.observedAtMs-o.targetCloseMs>
    ROBOT_R4_LOCKED_ASSUMPTIONS.maximumObservationLagMs)
  reasons.push('PROSPECTIVE_OBSERVATION_TOO_LATE');
 if(f.spreadBps>ROBOT_R4_LOCKED_ASSUMPTIONS.maxSyntheticSpreadBps)
  reasons.push('SPREAD_TOO_WIDE');
 if(f.declaredDepthMultiple<ROBOT_R4_LOCKED_ASSUMPTIONS.minimumDeclaredDepthMultiple)
  reasons.push('DEPTH_INSUFFICIENT_DECLARED');
 if(f.declaredFillFraction<1)reasons.push('PARTIAL_OR_MISSING_FILL_UNRECONCILED');
 if(market.marketType!=='spot'&&f.fundingBps===null)
  reasons.push('FUNDING_UNKNOWN');
 if(side==='sell'&&market.marketType==='spot')reasons.push('SPOT_SHORT_UNSUPPORTED');
 if(side==='sell'&&market.marketType!=='spot'&&!market.borrowAvailableDeclared)
  reasons.push('SHORT_BORROW_UNVERIFIED');
 let adverseGapBps=null,stopPrice=null,stopTouched=null;
 if(side!==null){
  const sign=side==='buy'?1:-1;
  adverseGapBps=round(Math.max(0,sign*(o.open/signal.referencePrice-1)*10000));
  if(adverseGapBps>ROBOT_R4_LOCKED_ASSUMPTIONS.maxSyntheticAdverseGapBps)
   reasons.push('ADVERSE_OPEN_GAP');
  stopPrice=signal.referencePrice*(1-sign*ROBOT_R4_LOCKED_ASSUMPTIONS.stopPct);
  if((sign===1&&o.open<=stopPrice)||(sign===-1&&o.open>=stopPrice))
   reasons.push('STOP_BREACHED_AT_ENTRY_OPEN');
  stopTouched=sign===1?o.low<=stopPrice:o.high>=stopPrice;
 }
 const unique=freeze([...new Set(reasons)]);
 let netR=null, entryPrice=null, exitPrice=null, feeAndFundingR=null;
 if(!unique.length){
  const sign=side==='buy'?1:-1;
  const unit=signal.referencePrice*ROBOT_R4_LOCKED_ASSUMPTIONS.stopPct;
  // Bid/ask, entry slippage and protective-stop outcome are ALL estimates on
  // one future caller-supplied candle; no actual order book or intrabar order.
  entryPrice=o.open*(1+sign*(f.spreadBps/2+f.entrySlippageBps)/10000);
  const exitAnchor=stopTouched?stopPrice:o.close;
  exitPrice=exitAnchor-sign*o.open*
   (f.spreadBps/2+(stopTouched?f.stopSlippageBps:f.exitSlippageBps))/10000;
  feeAndFundingR=(f.feeBps+(f.fundingBps??0))/10000/
   ROBOT_R4_LOCKED_ASSUMPTIONS.stopPct;
  netR=round(sign*(exitPrice-entryPrice)/unit-feeAndFundingR);
  if(!finite(netR))fail('ROBOT_R4_NONFINITE_HYPOTHETICAL_SCORE');
 }
 return freeze({...noGo,signalId:signal.id,asset:market.asset,mode:signal.mode,
  referenceSide:side,referenceDecision,
  outcome:'NO_ACTUAL_EXECUTION',observedAtMs,
  classification:unique.length?'NO_EXECUTABLE_REFERENCE':
   'HYPOTHETICAL_STRESS_REFERENCE_ONLY',
  reasonCodes:unique,adverseGapBps,stopTouchedInCallerOhlc:stopTouched,
  entryPriceHypothetical:entryPrice,exitPriceHypothetical:exitPrice,
  feeAndFundingR:feeAndFundingR,netRHypothetical:netR,
  hypotheticalStopPct:ROBOT_R4_LOCKED_ASSUMPTIONS.stopPct,
  comparableToConfirmedBrokerFills:false});
}
export function reviewR4PairedThreeModeFeasibility(rows){
 if(!Array.isArray(rows)||rows.length!==3||
   new Set(rows.map(x=>x?.signal?.mode)).size!==3||
   !['manual','hybrid','reverse'].every(m=>rows.some(x=>x.signal.mode===m)))
  fail('ROBOT_R4_THREE_MODES_REQUIRED');
 const base=rows[0],obsHash=sha(base.observation),frictionHash=sha(base.friction);
 if(rows.some(x=>x.market?.asset!==base.market?.asset||
  x.signal?.targetOpenMs!==base.signal.targetOpenMs||
  x.signal?.referencePrice!==base.signal.referencePrice||
  sha(x.observation)!==obsHash||sha(x.friction)!==frictionHash))
  fail('ROBOT_R4_NONCOMPARABLE_SYNTHETIC_COHORT');
 const scored=Object.fromEntries(rows.map(x=>[x.signal.mode,
  reviewR4ExecutionFeasibility(x)]));
 const allDescriptive=Object.values(scored).every(x=>
  x.classification==='HYPOTHETICAL_STRESS_REFERENCE_ONLY');
 return freeze({
  schema:'JENIOS_ROBOT_R4_PAIRED_FEASIBILITY_V1',
  inputDigestSha256:sha(rows),hypotheticalScores:freeze(Object.fromEntries(
   Object.entries(scored).map(([mode,x])=>[mode,x.netRHypothetical]))),
  modesWithBlockedReference:freeze(Object.entries(scored).filter(([,x])=>
   x.classification!=='HYPOTHETICAL_STRESS_REFERENCE_ONLY').map(([k])=>k)),
  pairedScoreDeltaR:allDescriptive?freeze({
   hybridMinusManual:round(scored.hybrid.netRHypothetical-scored.manual.netRHypothetical),
   reverseMinusManual:round(scored.reverse.netRHypothetical-scored.manual.netRHypothetical),
   reverseMinusHybrid:round(scored.reverse.netRHypothetical-scored.hybrid.netRHypothetical)
  }):null,
  pairedBrokerExecutabilityVerified:false,
  exposureAndOrderTimingEquivalenceProven:false,
  privateRobotOutputsAuthenticated:false,
  actualPortfolioPnl:null,lossesReallyPrevented:null,
  realTradeAuthorization:false,ordersSent:0,paperOrdersSent:0,
  comparisonMayBeUsedInCommercialClaims:false,
  status:'NO_GO_UNVERIFIED_EXECUTION_FEASIBILITY'
 });
}
