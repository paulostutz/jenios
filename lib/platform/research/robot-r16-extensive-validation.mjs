/**
 * ROBOT R16 — extensive OFFLINE validation harness.
 * Deterministic synthetic/adversarial scenarios only. No market network, broker
 * transport, external Paper, paid services, private engine import or PnL claims.
 */
import {reviewR1ManualSignalWindow,reviewR1HybridSafety,
 reviewR1ReverseEligibility,reviewR1PairedLossAttribution}
 from './robot-r1-adversarial-gates.mjs';
import {reviewB291ManualLossStreak} from './b291-three-mode-copilot.mjs';

const freeze=x=>Object.freeze(x);
const count=(rows,p)=>rows.reduce((n,x)=>n+(p(x)?1:0),0);

export const R16_PLAN=freeze({
 schema:'JENIOS_ROBOT_R16_EXTENSIVE_VALIDATION_V1',
 deterministic:true,
 syntheticOnly:true,
 modes:freeze(['manual','hybrid','reverse']),
 regimes:freeze(['trend_up','trend_down','range','high_vol','thin_liquidity','halted','stale','wide_spread']),
 executionAllowed:false,
 paperExternalAllowed:false,
 deployAllowed:false,
 mergeAllowed:false,
 realPnlCertificationAllowed:false
});

export function runR16ManualMatrix(){
 const out=[];let i=0;
 for(const direction of ['UP','DOWN','ABSTAIN'])
 for(const deliveryLagMs of [250,1000,5000,30000,60000,60001,120000])
 for(const budgetMs of [1000,5000,60000])
 for(const arrivesBefore of [true,false]){
  const emittedAtMs=1_000_000;
  const targetOpenMs=1_200_000;
  const received=direction==='ABSTAIN'?null:
   (arrivesBefore?emittedAtMs+deliveryLagMs:targetOpenMs+deliveryLagMs);
  const e={signalId:'r16-m-'+i++,asset:'BTC-USD',mode:'manual',direction,
   emittedAtMs,recordedAtMs:emittedAtMs+100,
   declaredReceivedAtMs:received,targetOpenMs,observedAtMs:targetOpenMs+200000,
   isOrder:false,executed:false,source:'CALLER_SUPPLIED_SYNTHETIC'};
  const r=reviewR1ManualSignalWindow(e,{latencyBudgetMs:budgetMs});
  out.push(freeze({direction,deliveryLagMs,budgetMs,arrivesBefore,...r}));
 }
 return freeze(out);
}

export function runR16HybridMatrix(){
 const out=[];let i=0;
 const T=30_000_000;
 for(const atrPct of [0,2,6,6.01,10])
 for(const spreadBps of [0,5,30,30.01,100])
 for(const marketBias of ['UP','DOWN','NEUTRAL'])
 for(const liquidityState of ['declared_adequate','unknown','thin','halted'])
 for(const paused of [false,true])
 for(const positionOpen of [false,true])
 for(const stale of [false,true]){
  const intervalMs=[60000,300000,900000,3600000][i++%4];
  const x=reviewR1HybridSafety({
   intervalMs,paused,positionOpen,liquidityState,
   context:{mode:'hybrid',asset:'BTC-USD',closedAtMs:T,
    observedAtMs:T+(stale?intervalMs+300001:intervalMs),
    atrPct,spreadBps,maxRiskPct:1,marketBias,
    providerSigned:false,operatorApproved:false}
  });
  out.push(freeze({atrPct,spreadBps,marketBias,liquidityState,paused,
   positionOpen,stale,intervalMs,...x}));
 }
 return freeze(out);
}

export function runR16ReverseMatrix(){
 const out=[];let i=0;
 for(const marketType of ['spot','margin','perpetual'])
 for(const side of ['buy','sell'])
 for(const megaTrendDirection of [null,'buy','sell'])
 for(const paused of [false,true])
 for(const positionOpen of [false,true])
 for(const borrowAvailableDeclared of [false,true])
 for(const localConsentDeclared of [false,true])
 for(const fundingBps of [null,-25,0,25])
 for(const metadataAgeMs of [0,1000,10001])
 for(const spreadBps of [1,10,31,100]){
  const r=reviewR1ReverseEligibility({
   command:{eventId:'r16-r-'+i++,action:'open',side},marketType,
   megaTrendDirection,paused,positionOpen,borrowAvailableDeclared,
   localConsentDeclared,fundingBps,metadataAgeMs,metadataMaxAgeMs:10000,
   spreadBps,maxSpreadBps:30
  });
  out.push(freeze({marketType,side,megaTrendDirection,paused,positionOpen,
   borrowAvailableDeclared,localConsentDeclared,fundingBps,metadataAgeMs,
   spreadBps,...r}));
 }
 return freeze(out);
}

export function runR16LossStreakMatrix(){
 const out=[];
 for(const threshold of [2,3,4,5,6,7,8,9,10])
 for(let losses=0;losses<=12;losses++){
  const events=Array.from({length:losses},(_,i)=>({
   closedAtMs:1_000_000+i*1000,netResult:-1,verifiedClosedTrade:true
  }));
  const x=reviewB291ManualLossStreak(events,{threshold});
  out.push(freeze({threshold,losses,...x}));
 }
 return freeze(out);
}

export function runR16CounterfactualMatrix(){
 const rows=Array.from({length:500},(_,i)=>{
  const referenceNetR=[-3,-1.5,-0.6,-0.1,0,0.2,0.8,2,4][i%9];
  const interventionKind=i%11===0?'ABSTAIN':i%4===0?'REVERSE_REFERENCE':'KEEP';
  const candidates=[-4,-2,-0.5,0,0.4,1.2,3];
  const interventionNetR=interventionKind==='ABSTAIN'?0:candidates[(i*7)%candidates.length];
  return {id:'r16-p-'+i,cohortKey:'r16-c-'+i,referenceNetR,interventionNetR,
   interventionKind,source:'SYNTHETIC_PAIRED_UNVERIFIED'};
 });
 return reviewR1PairedLossAttribution(rows);
}

export function summarizeR16(){
 const manual=runR16ManualMatrix();
 const hybrid=runR16HybridMatrix();
 const reverse=runR16ReverseMatrix();
 const streak=runR16LossStreakMatrix();
 const counterfactual=runR16CounterfactualMatrix();
 return freeze({
  schema:'JENIOS_ROBOT_R16_SUMMARY_V1',
  manualCases:manual.length,
  manualTimelyDeclared:count(manual,x=>x.declaredTimely),
  hybridCases:hybrid.length,
  hybridWaitOrReview:count(hybrid,x=>x.classification==='WAIT_AND_REVIEW'),
  reverseCases:reverse.length,
  reverseBlocked:count(reverse,x=>x.classification==='BLOCK_NEW_EXPOSURE'),
  lossStreakCases:streak.length,
  pauseSuggested:count(streak,x=>x.pauseSuggested),
  pairedCounterfactualCases:counterfactual.paired,
  actualLossesAvoided:null,actualBrokerRealizedPnl:null,tradeAccuracy:null,
  statisticalAdvantageCertified:false,commercialPerformanceCertified:false,
  ordersSent:0,paperOrdersSent:0,
  classification:'OFFLINE_SYNTHETIC_EXTENSIVE_VALIDATION_ONLY'
 });
}
