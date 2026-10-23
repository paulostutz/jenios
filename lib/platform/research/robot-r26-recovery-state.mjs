/**
 * R26 — UltraFast post-outage recovery state machine.
 * No new exposure until reconnect, market-data resync, account reconciliation and risk reconciliation complete.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};

export const R26_RECOVERY_STATES=Object.freeze([
 'HALTED','RECONNECTING','MARKET_RESYNC','ACCOUNT_RECONCILE','RISK_RECONCILE','READY'
]);

export function nextRecoveryState(state,evidence={}){
 if(!R26_RECOVERY_STATES.includes(state)||!evidence||typeof evidence!=='object')fail('R26_INVALID_RECOVERY_STATE');
 const noExposure={newEntriesAllowed:false,ordersSent:0};
 if(state==='HALTED')return Object.freeze({state:'RECONNECTING',...noExposure});
 if(state==='RECONNECTING'){
   if(evidence.transportConnected!==true)return Object.freeze({state:'RECONNECTING',...noExposure});
   return Object.freeze({state:'MARKET_RESYNC',...noExposure});
 }
 if(state==='MARKET_RESYNC'){
   if(evidence.marketDataFresh!==true||evidence.sequenceContinuous!==true)return Object.freeze({state:'MARKET_RESYNC',...noExposure});
   return Object.freeze({state:'ACCOUNT_RECONCILE',...noExposure});
 }
 if(state==='ACCOUNT_RECONCILE'){
   if(evidence.openOrdersKnown!==true||evidence.positionsKnown!==true)return Object.freeze({state:'ACCOUNT_RECONCILE',...noExposure});
   return Object.freeze({state:'RISK_RECONCILE',...noExposure});
 }
 if(state==='RISK_RECONCILE'){
   if(evidence.riskLedgerMatches!==true||evidence.unknownExposure===true)return Object.freeze({state:'RISK_RECONCILE',...noExposure});
   return Object.freeze({state:'READY',newEntriesAllowed:true,ordersSent:0});
 }
 return Object.freeze({state:'READY',newEntriesAllowed:true,ordersSent:0});
}

export function recoverToReady(sequence=[]){
 if(!Array.isArray(sequence)||sequence.length<1||sequence.length>100)fail('R26_INVALID_RECOVERY_SEQUENCE');
 let state='HALTED',trace=[state];
 for(const evidence of sequence){
   const step=nextRecoveryState(state,evidence);
   state=step.state;trace.push(state);
   if(state==='READY')break;
 }
 return Object.freeze({
  schema:'JENIOS_R26_RECOVERY_TRACE_V1',
  finalState:state,trace:Object.freeze(trace),
  newEntriesAllowed:state==='READY',
  unknownExposureBlocksReady:state!=='READY',
  ordersSent:0,paperOrdersSent:0
 });
}
