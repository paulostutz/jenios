import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planR8Market,parseR8Candles,captureR8Market} from '../lib/platform/research/robot-r8-public-market.mjs';
const now=Date.parse('2026-10-22T12:32:00Z'),plan=planR8Market(now);
const make=w=>Array.from({length:w.count},(_,i)=>{
 const open=1000+i*.1;
 return [(w.startMs+i*w.intervalMs)/1000,open-.4,open+.4,open,open+.1,10];
}).reverse();
const fetcher=async url=>Response.json(make(plan.windows.find(w=>w.url===url)));
test('R8 fixed 200x5m and 120xH1 closed history',()=>{
 assert.equal(plan.windows[0].count,200);assert.equal(plan.windows[1].count,120);
 assert.equal(plan.decisionAtMs,Date.parse('2026-10-22T12:20:00Z'));
});
test('R8 original engine-compatible candle keys and exact contiguous timestamps',()=>{
 const bars=parseR8Candles(make(plan.windows[0]),plan.windows[0]);
 assert.deepEqual(Object.keys(bars[0]),['time','open','high','low','close','volume']);
 assert.equal(bars.at(-1).time+300000,plan.decisionAtMs);
});
test('R8 no gaps, duplicates or false price record',()=>{
 const w=plan.windows[0],r=make(w);
 for(const rows of [r.slice(1),[r[0],...r],r.map((x,i)=>i===0?[x[0],0,x[2],x[3],x[4],x[5]]:x)])
 assert.throws(()=>parseR8Candles(rows,w));
});
test('R8 uses unsigned public GET data, without executing private engine',async()=>{
 const result=await captureR8Market({plan,observedAtMs:now,fetcher});
 assert.equal(result.bars.length,200);assert.equal(result.higherBars.length,120);
 assert.equal(result.originalPrivateEngineExecuted,false);
 assert.equal(result.originalSignalsRegistered,0);assert.equal(result.actualBrokerPnl,null);
});
test('R8 falsified plan and failed HTTP cannot become market evidence',async()=>{
 await assert.rejects(()=>captureR8Market({plan:{...plan,decisionAtMs:1},observedAtMs:now,fetcher}),/R8_FORGED_PLAN/);
 await assert.rejects(()=>captureR8Market({plan,observedAtMs:now,fetcher:()=>{throw Error('offline')}}),/R8_PUBLIC_HTTP_UNAVAILABLE/);
 const code=readFileSync(new URL('../lib/platform/research/robot-r8-public-market.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(code,/submitOrder|analyzeRequest|OPENAI_API_KEY|process.env/);
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
 assert.equal(v.git.deploymentEnabled['fix/jenios-robot-r8-genuine-private-core-context-20261022'],false);
});

test('R8 collector import resolves to the public module without referring to private engine',()=>{
 const script=readFileSync(new URL('../scripts/platform/research/robot-r8-public-market.mjs',import.meta.url),'utf8');
 assert.match(script,/\.\.\/\.\.\/\.\.\/lib\/platform\/research\/robot-r8-public-market\.mjs/);
 assert.doesNotMatch(script,/nucleo-privado|engine\.mjs|service\.mjs|OPENAI_API_KEY/);
});
