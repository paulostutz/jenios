import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {planR15WindowOutcome,captureR15WindowOutcome}
 from '../../../lib/platform/research/robot-r15-window-outcome.mjs';

const marker='docs/platform/evidence/ROBOT_R15_OUTCOME_TRIGGER.json';
const dir='.jenios-r15-outcome';
mkdirSync(dir,{recursive:true});

try{
 const trigger=JSON.parse(readFileSync(marker,'utf8'));
 if(!trigger||typeof trigger.windowId!=='string')
  throw Object.assign(new Error('R15_OUTCOME_BAD_TRIGGER'),{code:'R15_OUTCOME_BAD_TRIGGER'});
 const digestPath='docs/platform/evidence/ROBOT_'+trigger.windowId.replace('-','_')+'_PRIVATE_PRECOMMIT_SHA256.txt';
 const precommitSha256=readFileSync(digestPath,'utf8').trim();
 const nowMs=Date.now();
 const plan=planR15WindowOutcome({windowId:trigger.windowId,precommitSha256,nowMs});
 const {observation,raw}=await captureR15WindowOutcome({plan,observedAtMs:Date.now()});
 writeFileSync(dir+'/'+trigger.windowId+'-observation.json',JSON.stringify(observation,null,2)+'\n',{flag:'wx',mode:0o600});
 writeFileSync(dir+'/'+trigger.windowId+'-coinbase-raw.json',raw.coinbase+'\n',{flag:'wx',mode:0o600});
 writeFileSync(dir+'/'+trigger.windowId+'-kraken-raw.json',raw.kraken+'\n',{flag:'wx',mode:0o600});
 console.log('R15_WINDOW_OUTCOME_OK '+JSON.stringify({
  windowId:trigger.windowId,precommitSha256,
  closeDifferenceBps:observation.closeDifferenceBps,
  ohlcDifferenceBps:observation.ohlcDifferenceBps,
  issues:observation.issues,ordersSent:0,paperOrdersSent:0
 }));
}catch(e){
 const code=String(e?.code||'R15_OUTCOME_UNKNOWN');
 writeFileSync(dir+'/capture-status.json',JSON.stringify({
  status:'NO_GO',code,ordersSent:0,paperOrdersSent:0
 },null,2)+'\n',{flag:'wx',mode:0o600});
 console.error('R15_WINDOW_OUTCOME_NO_GO '+code);
 process.exitCode=1;
}
