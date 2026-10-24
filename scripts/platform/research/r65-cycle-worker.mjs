/** Explicit QA host entry. No cron, provider key or production flag is created. */
import {createR65Runtime} from '../../../lib/platform/research/robot-r65-runtime.mjs';
const mode=process.argv[2];
if(!['--once','--watch'].includes(mode)||process.argv.length!==3)throw new Error('Use --once or --watch');
const runtime=createR65Runtime();let stopped=false,timer;
const stop=()=>{stopped=true;clearTimeout(timer);};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
async function tick(){
  let delay=60000;
  try{
    const result=await runtime.runTick();
    console.log(JSON.stringify({status:result.status,revision:result.revision,nextAtMs:result.nextAtMs??null}));
    if(result.nextAtMs)delay=Math.min(60000,Math.max(250,result.nextAtMs-Date.now()+50));
  }catch{console.error('R65_CYCLE_UNAVAILABLE');if(mode==='--once')process.exitCode=1;}
  if(mode==='--watch'&&!stopped)timer=setTimeout(tick,delay);
}
await tick();
