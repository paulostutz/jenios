/** R100 boot-only background worker; no recurring work or broker activity. */
import {attestR100InertWorker} from '../../../lib/platform/connections/inert-private-host-r100.mjs';
const safeWrite=message=>process.stdout.write(JSON.stringify(message)+'\n');
try{
 if(process.argv.length!==2)throw Error('R100_ARGUMENTS_DENIED');
 const result=attestR100InertWorker();
 safeWrite({event:'R100_INERT_BOOT',...result});
 const idle=setInterval(()=>{},60000);
 const stop=()=>{
  clearInterval(idle);
  safeWrite({event:'R100_INERT_STOP',ordersSent:0,liveExecution:false});
 };
 process.once('SIGTERM',stop);
 process.once('SIGINT',stop);
}catch{
 // Never print filesystem paths, environment variables, secrets, or stack traces.
 process.stderr.write('R100_INERT_BOOT_REFUSED\n');
 process.exitCode=1;
}
