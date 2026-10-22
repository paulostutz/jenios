import {mkdirSync,writeFileSync} from 'node:fs';
import {planR7,inspectR7PublicHour} from '../../../lib/platform/research/robot-r7-public-h1.mjs';
const dir='.jenios-r7-ci';mkdirSync(dir,{recursive:true});
const plan=planR7({nowMs:Date.now()});
try{
 const x=await inspectR7PublicHour({plan,observedAtMs:Date.now()});
 writeFileSync(dir+'/public-h1.json',JSON.stringify(x,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('R7_PUBLIC_GET_OBSERVED '+JSON.stringify({openMs:x.openMs,issues:x.issues,ordersSent:0}));
}catch(e){
 writeFileSync(dir+'/public-h1.json',JSON.stringify({status:'PUBLIC_GET_NO_GO',code:e?.code||'R7_UNKNOWN',ordersSent:0},null,2)+'\n',{flag:'wx',mode:0o600});
 console.error('R7_PUBLIC_GET_NO_GO '+(e?.code||'R7_UNKNOWN'));process.exitCode=1;
}
