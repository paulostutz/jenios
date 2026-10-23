/** R10 read-only exact window; prevents any external GET before 14:10 UTC.
 * All six precommitted modes abstained: no PnL is computed.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {planR10Observation,inspectR10FutureCandle,R10_PROTOCOL} from
 '../../../lib/platform/research/robot-r10-post-candle.mjs';
const folder='.jenios-r10-post-close';
mkdirSync(folder,{recursive:true});
const now=Date.now();
let data;
if(now<R10_PROTOCOL.earliestObserveMs){
 data={status:'WAITING_FOR_TARGET_CLOSE_PLUS_GRACE',
  nowMs:now,earliestObserveMs:R10_PROTOCOL.earliestObserveMs,
  observedMarketCandle:false,ordersSent:0,profit:null};
 console.log('R10_OUTCOME_WAIT '+JSON.stringify(data));
}else{
 try{
  const plan=planR10Observation(now);
  data=await inspectR10FutureCandle({plan,observedAtMs:Date.now()});
  console.log('R10_OUTCOME_READ '+JSON.stringify({
   targetOpenMs:data.targetOpenMs,targetCloseMs:data.targetCloseMs,
   issues:data.issues,qualityComparable:data.priceConsistencyWithinResearchThresholds,
   entries:data.entries,ordersSent:0}));
 }catch(e){
  data={status:'R10_OUTCOME_NOT_CERTIFIED',code:
   String(e?.code||'R10_READ_UNAVAILABLE'),ordersSent:0,
   priceVerified:false,performanceVerified:false};
  console.error('R10_OUTCOME_NO_GO '+data.code);
  process.exitCode=1;
 }
}
writeFileSync(folder+'/R10_OUTCOME_OR_WAIT.json',JSON.stringify(data,null,2)+'\n',
 {flag:'wx',mode:0o600});
