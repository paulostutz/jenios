import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';

const ledger=JSON.parse(readFileSync(new URL('../docs/platform/evidence/ROBOT_MASTER_PERFORMANCE_LEDGER.json',import.meta.url),'utf8'));

test('R24 master ledger keeps real-performance claims null and zero execution',()=>{
 assert.equal(ledger.globalRules.realOrdersSent,0);
 assert.equal(ledger.globalRules.externalPaperOrdersSent,0);
 assert.equal(ledger.globalRules.actualBrokerPnl,null);
 assert.equal(ledger.globalRules.actualLossesAvoided,null);
 assert.equal(ledger.globalRules.realTradeAccuracy,null);
 assert.equal(ledger.globalRules.commercialPerformanceCertified,false);
});

test('R24 master ledger contains Manual, Hybrid, Reverse and UltraFast',()=>{
 const names=ledger.robots.map(x=>x.robot).sort();
 assert.deepEqual(names,['hybrid','manual','reverse','ultrafast']);
});

test('R24 keeps UltraFast entitlement from Global Crypto upward with no per-trade fee',()=>{
 const u=ledger.robots.find(x=>x.robot==='ultrafast');
 assert.equal(u.commercialAccess['platform-nacional'],false);
 assert.equal(u.commercialAccess['platform-global-crypto'],true);
 assert.equal(u.commercialAccess['platform-internacional-pro'],true);
 assert.equal(u.commercialAccess.perTradeFee,false);
});

test('R24 preserves 0.65 alignment guard for assisted modes',()=>{
 for(const name of ['hybrid','reverse']){
  const r=ledger.robots.find(x=>x.robot===name);
  assert.equal(r.alignmentGuardThreshold,.65);
 }
});

test('R24 records every certified block R16-R23',()=>{
 for(let i=16;i<=23;i++)assert.ok(ledger.certifiedBlocks['R'+i]);
});
