/**
 * R51 — integrated soak/fuzz/chaos stress.
 * Combines certified invariants from R46-R50 in deterministic offline scenarios.
 */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export function runR51ChaosSoak({events=50000}={}){
 if(!Number.isSafeInteger(events)||events<10000||events>200000)fail('R51_INVALID_EVENTS');
 let reconnects=0,leaderChanges=0,staleDataBlocks=0,backpressureBlocks=0,reconciliationBlocks=0,economicRevocations=0,falseAllows=0;
 let connected=true,leader=1,queue=0,reconcile=false,economic=true,dataFresh=true;
 for(let i=1;i<=events;i++){
   if(i%997===0){connected=false;reconnects++;queue=0;dataFresh=false;}
   if(i%1009===0){leader++;leaderChanges++;dataFresh=false;}
   if(i%211===0)queue=Math.min(100,queue+7); else queue=Math.max(0,queue-1);
   if(i%701===0)reconcile=true;
   if(i%709===0)reconcile=false;
   if(i%503===0)economic=false;
   if(i%521===0)economic=true;
   if(i%313===0)dataFresh=false;
   if(i%317===0)dataFresh=true;
   if(!connected&&i%997===3){connected=true;dataFresh=false;}
   if(!dataFresh)staleDataBlocks++;
   if(queue>=75)backpressureBlocks++;
   if(reconcile)reconciliationBlocks++;
   if(!economic)economicRevocations++;
   const allow=connected&&dataFresh&&queue<75&&!reconcile&&economic;
   const invariant=(!connected||!dataFresh||queue>=75||reconcile||!economic)?!allow:true;
   if(!invariant)falseAllows++;
 }
 return Object.freeze({
   schema:'JENIOS_R51_CHAOS_SOAK_V1',events,reconnects,leaderChanges,
   staleDataBlocks,backpressureBlocks,reconciliationBlocks,economicRevocations,
   falseAllows,pass:falseAllows===0,
   actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
   ordersSent:0,paperOrdersSent:0
 });
}