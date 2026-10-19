import test from 'node:test';
import assert from 'node:assert/strict';
import {replayHistoricalScenario} from '../lib/platform/paper-replay.mjs';
const start=Date.parse('2026-10-17T10:00:00Z'),now=start+400*60_000;
const make=(n=120,slope=0.16)=>Array.from({length:n},(_,i)=>{
 const p=100+i*slope;return {time:new Date(start+i*60_000).toISOString(),
  open:p,high:p+1,low:p-0.5,close:p+0.3,volume:1000+i%3};
});
test('B83 holds out later bars and enters ONLY at next bar after observed prior-close signal',()=>{
 const x=replayHistoricalScenario(make(),{now});
 assert.equal(x.ok,true);assert(x.entries>0);
 assert.equal(x.holdoutOnly,true);assert.equal(x.strategy,'illustrative_sma_hypothesis_not_protected_robot');
 const first=x.paperFills[0];assert.equal(first.kind,'entry');
 assert.equal(first.fillBar,x.evaluationStart);
 assert.equal(first.decisionBar,x.evaluationStart-1);
 assert.equal(x.orderAuthorized,false);assert.equal(x.brokerConnected,false);
 assert.equal(x.verifiedProfit,null);assert.equal(x.avoidedLoss,null);
});
test('B83 changes to FUTURE closes cannot influence historical first entry bar',()=>{
 const bars=make(),x=replayHistoricalScenario(bars,{now});
 const changed=make();
 for(let i=x.evaluationStart+1;i<changed.length;i++){
  const p=300+i;changed[i]={...changed[i],open:p,high:p+1,low:p-1,close:p+0.5};
 }
 const y=replayHistoricalScenario(changed,{now});
 assert.deepEqual(x.paperFills[0],y.paperFills[0]);
});
test('B83 illiquid or gapped candles block replay, never treated as successful trading',()=>{
 const bars=make();bars[85].volume=0;bars[86].time=new Date(start+110*60_000).toISOString();
 for(let i=87;i<bars.length;i++)bars[i].time=new Date(start+(i+24)*60_000).toISOString();
 const x=replayHistoricalScenario(bars,{now});
 assert.equal(x.ok,false);assert.equal(x.realExecutionAllowed,false);
});
test('B83 stop and costs can produce losses, no guaranteed alpha',()=>{
 const bars=make();for(let i=99;i<bars.length;i++){
  const p=100+i*0.16;
  bars[i]={...bars[i],open:p,high:p+1,low:p*0.95,close:p*0.97};
 }
 const r=replayHistoricalScenario(bars,{now,stopPct:0.01,feeBps:25,slippageBps:30});
 assert.equal(r.ok,true);assert(r.paperStops>=1);
 assert(r.hypotheticalFinalEquity<r.initialBalance);
});
test('B83 rejects excessive allocation, absurd fee and fabricated modes',()=>{
 const candles=make();
 for(const bad of [{allocationPct:1},{initialBalance:-1},{feeBps:500},{mode:'LIVE'},{stopPct:0}]){
  assert.throws(()=>replayHistoricalScenario(candles,{...bad,now}),/INVALID_PAPER_CONFIGURATION/);
 }
});
test('B83 modes are independent educational scenario labels, not the robot core',()=>{
 const bars=make();
 for(const mode of ['direto','reverso','hibrido']){
  const x=replayHistoricalScenario(bars,{now,mode});
  assert.equal(x.ok,true);assert.equal(x.mode,mode);assert.equal(x.orderAuthorized,false);
  assert(x.paperFills.every(f=>f.fillBar>f.decisionBar));
 }
});
