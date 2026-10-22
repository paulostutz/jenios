import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {R15_COHORT} from '../lib/platform/research/robot-r15-multiwindow-protocol.mjs';
import {planR15WindowOutcome,captureR15WindowOutcome}
 from '../lib/platform/research/robot-r15-window-outcome.mjs';

const digest='9e672b22ecf4a0746399981d4c187ebd85fb54454bd8103ad74f59277584b771';
const w=R15_COHORT.windows[0];
const cb=[[w.openMs/1000,100,102,101,101.5,25]];
const kr={error:[],result:{XXBTZUSD:[[w.openMs/1000,'101','102.02','100','101.52','101.2','30',1]],last:w.closeMs/1000}};
const fetcher=async url=>Response.json(url.includes('coinbase')?cb:kr);

test('R15 outcome plan rejects unknown, malformed or early windows',()=>{
 assert.throws(()=>planR15WindowOutcome({windowId:'R15-W99',precommitSha256:digest,nowMs:w.closeMs+600000}));
 assert.throws(()=>planR15WindowOutcome({windowId:'R15-W01',precommitSha256:'bad',nowMs:w.closeMs+600000}));
 assert.throws(()=>planR15WindowOutcome({windowId:'R15-W01',precommitSha256:digest,nowMs:w.closeMs+599999}),
  e=>e?.code==='R15_OUTCOME_WAIT_UNTIL_CLOSED_PLUS_TEN_MINUTES');
});

test('R15 outcome plan fixes W01 exact hour and public sources',()=>{
 const p=planR15WindowOutcome({windowId:'R15-W01',precommitSha256:digest,nowMs:w.closeMs+600000});
 assert.equal(p.openMs,w.openMs);assert.equal(p.closeMs,w.closeMs);
 assert.match(p.coinbaseUrl,/BTC-USD/);assert.match(p.krakenUrl,/XBTUSD/);
 assert.equal(p.precommitSha256,digest);
});

test('R15 capture remains descriptive, linked and no-PnL',async()=>{
 const p=planR15WindowOutcome({windowId:'R15-W01',precommitSha256:digest,nowMs:w.closeMs+600000});
 const {observation}=await captureR15WindowOutcome({plan:p,observedAtMs:p.nowMs,fetcher});
 assert.equal(observation.windowId,'R15-W01');
 assert.equal(observation.precommitSha256,digest);
 assert.equal(observation.publicPriceConsistencyPassed,true);
 assert.equal(observation.actualBrokerPnl,null);
 assert.equal(observation.actualLossesAvoided,null);
 assert.equal(observation.tradeAccuracy,null);
 assert.equal(observation.brokerOrdersSent,0);
 assert.equal(observation.paperOrdersSent,0);
 assert.equal(observation.commercialPerformanceCertified,false);
});

test('R15 capture rejects tampered plan and HTTP failure',async()=>{
 const p=planR15WindowOutcome({windowId:'R15-W01',precommitSha256:digest,nowMs:w.closeMs+600000});
 await assert.rejects(()=>captureR15WindowOutcome({plan:{...p,openMs:1},observedAtMs:p.nowMs,fetcher}));
 await assert.rejects(()=>captureR15WindowOutcome({plan:p,observedAtMs:p.nowMs,
  fetcher:async()=>new Response('{}',{status:500})}));
});

test('R15 outcome observer contains no broker, secret or private-core transport',()=>{
 const s=readFileSync(new URL('../lib/platform/research/robot-r15-window-outcome.mjs',import.meta.url),'utf8');
 const runner=readFileSync(new URL('../scripts/platform/research/robot-r15-window-outcome.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(s+runner,/submitOrder|createOrder|OPENAI_API_KEY|process\.env|nucleo-privado|private-core/i);
});
