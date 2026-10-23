import {mkdirSync,writeFileSync} from 'node:fs';
import {planR14Observation,captureR14Outcome}
 from '../../../lib/platform/research/robot-r14-post-candle.mjs';

const dir='.jenios-r14-outcome';
mkdirSync(dir,{recursive:true});
const now=Date.now();
try{
 const plan=planR14Observation(now);
 const {observation,raw}=await captureR14Outcome({plan,observedAtMs:Date.now()});
 writeFileSync(dir+'/observation.json',JSON.stringify(observation,null,2)+'\n',{flag:'wx',mode:0o600});
 writeFileSync(dir+'/coinbase-raw.json',raw.coinbase+'\n',{flag:'wx',mode:0o600});
 writeFileSync(dir+'/kraken-raw.json',raw.kraken+'\n',{flag:'wx',mode:0o600});
 console.log('R14_OUTCOME_CAPTURE_OK '+JSON.stringify({
  targetOpenMs:observation.targetOpenMs,targetCloseMs:observation.targetCloseMs,
  closeDifferenceBps:observation.closeDifferenceBps,
  ohlcDifferenceBps:observation.ohlcDifferenceBps,
  issues:observation.issues,
  ordersSent:0,paperOrdersSent:0
 }));
}catch(e){
 const code=String(e?.code||'R14_UNKNOWN');
 writeFileSync(dir+'/capture-status.json',JSON.stringify({
  status:'NO_GO',code,ordersSent:0,paperOrdersSent:0
 },null,2)+'\n',{flag:'wx',mode:0o600});
 console.error('R14_OUTCOME_CAPTURE_NO_GO '+code);
 process.exitCode=1;
}
