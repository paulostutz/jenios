/** Synthetic CPU overhead only. Not exchange latency or financial performance. */
import {performance} from 'node:perf_hooks';
import {inspectMarketFlow,buildMarketFlowContext} from '../../../lib/platform/research/market-flow-context.mjs';
const now=1800000000000;
const context=buildMarketFlowContext({startMs:now-60000,endMs:now,receivedAtMs:now,complete:true,evidenceKind:'SYNTHETIC',
 trades:Array.from({length:12},(_,i)=>({a:i,T:now-60000+Math.floor(i/4)*20000+i%4*6000,
 p:String(100-i%4*.02),q:'100',m:true}))});
const options={symbol:'BTC-USDT',venue:'binance',side:'buy',nowMs:now};
for(let i=0;i<5000;i++)inspectMarketFlow(context,options);
const samples=[];
for(let i=0;i<20000;i++){const before=performance.now();inspectMarketFlow(context,options);samples.push((performance.now()-before)*1000);}
samples.sort((a,b)=>a-b);
console.log(JSON.stringify({schema:'JENIOS_R114_SYNTHETIC_CPU_BENCHMARK_V1',node:process.version,
 samples:samples.length,unit:'microseconds',median:samples[10000],p95:samples[19000],p99:samples[19800],
 max:samples.at(-1),networkCallsInDecision:0,measuredScope:'CONTEXT_INSPECTION_ONLY',
 excludes:['network','engine','exchange','order_execution','live_load'],
 financialPerformanceCertified:false,ultraEnforcement:'OBSERVE_ONLY'},null,2));
