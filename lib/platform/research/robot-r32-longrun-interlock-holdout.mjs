/**
 * R32 — long-run independent holdout for R31 recovery+regime interlock.
 * Frozen deterministic timelines; R31 policy is not tuned in this block.
 */
import {evaluateRecoveryRegimeInterlock} from './robot-r31-recovery-regime-interlock.mjs';

const fail=c=>{throw Object.assign(new Error(c),{code:c});};

function recovery(kind){
 if(kind==='ready') return [
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:false}
 ];
 if(kind==='unknown') return [
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true},
  {openOrdersKnown:true,positionsKnown:true},
  {riskLedgerMatches:true,unknownExposure:true}
 ];
 if(kind==='stale') return [
  {transportConnected:true},
  {marketDataFresh:false,sequenceContinuous:false}
 ];
 if(kind==='partial') return [
  {transportConnected:true},
  {marketDataFresh:true,sequenceContinuous:true}
 ];
 fail('R32_BAD_RECOVERY_KIND');
}

function regime(i,good){
 const costSeq=[.8,1.2,2.4,4.8,7.2];
 const fillSeq=[.96,.88,.74,.55,.35];
 const winSeq=[.64,.61,.58,.54,.50];
 const idx=(i*7+3)%5;
 if(good){
  return {regime:'GOOD_'+i,epoch:i+1,totalCostBps:costSeq[idx%3],fillProbability:fillSeq[idx%3],estimatedWinRate:winSeq[idx%3],
    grossWinBps:[12,15,18][idx%3],grossLossBps:[8,9,10][idx%3]};
 }
 return {regime:'BAD_'+i,epoch:i+1,totalCostBps:costSeq[3+idx%2],fillProbability:fillSeq[3+idx%2],estimatedWinRate:winSeq[3+idx%2],
   grossWinBps:[9,12][idx%2],grossLossBps:[9,12][idx%2]};
}

export function buildR32Timeline(length=1200){
 if(!Number.isSafeInteger(length)||length<100||length>5000)fail('R32_INVALID_LENGTH');
 const rows=[];
 for(let i=0;i<length;i++){
   const cycle=i%12;
   let rk='ready',good=true;
   if(cycle===2||cycle===8)rk='unknown';
   else if(cycle===3||cycle===9)rk='partial';
   else if(cycle===4)rk='stale';
   if([1,4,5,8,9,10].includes(cycle))good=false;
   rows.push(Object.freeze({index:i,recoveryKind:rk,recoverySequence:recovery(rk),regime:regime(i,good)}));
 }
 return Object.freeze(rows);
}

export function runR32LongHoldout(length=1200){
 const timeline=buildR32Timeline(length);
 let allowed=0,blocked=0,falseAllows=0,readyButBadBlocks=0,goodButNotReadyBlocks=0;
 let consecutiveAllows=0,maxConsecutiveAllows=0;
 const trace=[];
 for(const row of timeline){
  const x=evaluateRecoveryRegimeInterlock({recoverySequence:row.recoverySequence,regime:row.regime});
  const shouldAllow=row.recoveryKind==='ready' && row.regime.regime.startsWith('GOOD_');
  if(x.allowNewEntries)allowed++;else blocked++;
  if(x.allowNewEntries!==shouldAllow)falseAllows++;
  if(row.recoveryKind==='ready'&&!shouldAllow&&!x.allowNewEntries)readyButBadBlocks++;
  if(row.recoveryKind!=='ready'&&row.regime.regime.startsWith('GOOD_')&&!x.allowNewEntries)goodButNotReadyBlocks++;
  consecutiveAllows=x.allowNewEntries?consecutiveAllows+1:0;
  maxConsecutiveAllows=Math.max(maxConsecutiveAllows,consecutiveAllows);
  if(row.index<50)trace.push(Object.freeze({index:row.index,recoveryKind:row.recoveryKind,regime:row.regime.regime,allow:x.allowNewEntries}));
 }
 return Object.freeze({
  schema:'JENIOS_R32_LONGRUN_INTERLOCK_HOLDOUT_V1',
  frozenPolicy:true,length,allowed,blocked,falseAllows,
  readyButBadBlocks,goodButNotReadyBlocks,maxConsecutiveAllows,
  sampleTrace:Object.freeze(trace),
  invariantHolds:falseAllows===0,
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}

export function runR32Battery(){
 const sizes=[120,600,1200,2400,4800];
 const results=sizes.map(runR32LongHoldout);
 return Object.freeze({
  schema:'JENIOS_R32_BATTERY_V1',
  sizes:Object.freeze(sizes),
  totalEvents:results.reduce((s,x)=>s+x.length,0),
  allInvariant:results.every(x=>x.invariantHolds),
  falseAllows:results.reduce((s,x)=>s+x.falseAllows,0),
  totalAllowed:results.reduce((s,x)=>s+x.allowed,0),
  totalBlocked:results.reduce((s,x)=>s+x.blocked,0),
  actualBrokerPnl:null,ordersSent:0,paperOrdersSent:0
 });
}
