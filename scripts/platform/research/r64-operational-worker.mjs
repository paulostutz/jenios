/** Explicit host entry point. No cron registration, real account or default run. */
import { createR64Runtime } from '../../../lib/platform/research/robot-r64-runtime.mjs';
const mode=process.argv[2];
if(!['--once','--watch'].includes(mode)||process.argv.length!==3){
  process.stderr.write('Use --once or --watch in the explicitly configured QA host.\n');process.exitCode=2;
}else{
  let stopping=false,inFlight=false;
  const execute=async()=>{
    if(stopping||inFlight)return;inFlight=true;
    try{
      const result=await createR64Runtime().runCycle();
      process.stdout.write(JSON.stringify({schema:'JENIOS_R64_WORKER_STATUS_V1',status:result.status,
        periodKey:result.periodKey,productionMonitoringStarted:false})+'\n');
    }catch{process.stderr.write('R64_WORKER_UNAVAILABLE: no successful cycle was presumed.\n');if(mode==='--once')process.exitCode=1;}
    finally{inFlight=false;}
  };
  await execute();
  if(mode==='--watch'){
    const timer=setInterval(()=>void execute(),60000);
    const stop=()=>{stopping=true;clearInterval(timer);};
    process.once('SIGTERM',stop);process.once('SIGINT',stop);
  }
}
