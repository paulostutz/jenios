import {mkdirSync,writeFileSync} from 'node:fs';
import {planR8Market,captureR8Market} from '../../../lib/platform/research/robot-r8-public-market.mjs';
const dir='.jenios-r8-ci';mkdirSync(dir,{recursive:true});
const plan=planR8Market(Date.now());
try{
 const data=await captureR8Market({plan,observedAtMs:Date.now()});
 writeFileSync(dir+'/closed-public-context.json',JSON.stringify(data)+'\n',{flag:'wx',mode:0o600});
 console.log('R8_MARKET_CAPTURE_OK '+JSON.stringify({bars:data.bars.length,higherBars:data.higherBars.length,decisionAtMs:data.decisionAtMs,ordersSent:0}));
}catch(e){
 const code=String(e?.code||'R8_UNKNOWN');
 writeFileSync(dir+'/capture-status.json',JSON.stringify({status:'NO_CONTEXT',code,privateCoreExecuted:false,ordersSent:0})+'\n',{flag:'wx',mode:0o600});
 console.error('R8_MARKET_CAPTURE_NO_GO '+code);process.exitCode=1;
}
