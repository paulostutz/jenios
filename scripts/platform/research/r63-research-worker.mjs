/** Explicit local worker entry. No default background job or external service. */
import {runR63ScheduledFixtureWorker} from '../../../lib/platform/research/robot-r63-research-worker.mjs';

const mode=process.argv[2];
if(!['--once','--watch'].includes(mode)||process.argv.length!==3){
  process.stderr.write('Uso: node scripts/platform/research/r63-research-worker.mjs --once|--watch\n');process.exitCode=2;
}else{
  let running=false,stopping=false,timer;
  const tick=async()=>{
    if(running||stopping)return;running=true;
    try{
      const result=await runR63ScheduledFixtureWorker({directory:process.env.JENIOS_ROBOT_EVOLUTION_JOURNAL_DIR,
        key:process.env.JENIOS_ROBOT_EVOLUTION_JOURNAL_KEY,env:process.env});
      process.stdout.write(JSON.stringify({schema:'JENIOS_R63_WORKER_TICK_V1',status:result.status,
        revision:result.revision??null,providerCalls:0,syntheticFixtureOnly:true,productionMonitoringStarted:false})+'\n');
    }catch(error){
      const code=/^R63_[A-Z0-9_]+$/.test(error?.code||'')?error.code:'R63_WORKER_FAILED';
      process.stderr.write(JSON.stringify({status:'BLOCKED',code})+'\n');
      if(mode==='--once')process.exitCode=1;
    }finally{running=false;}
  };
  await tick();
  if(mode==='--watch'){
    timer=setInterval(()=>void tick(),60000);
    const stop=()=>{stopping=true;clearInterval(timer);};
    process.once('SIGTERM',stop);process.once('SIGINT',stop);
  }
}
