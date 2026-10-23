import test from 'node:test';import assert from 'node:assert/strict';
import {buildR32Timeline,runR32LongHoldout,runR32Battery}
 from '../lib/platform/research/robot-r32-longrun-interlock-holdout.mjs';

test('R32 timeline is frozen deterministic and long',()=>{
 const a=buildR32Timeline(1200),b=buildR32Timeline(1200);
 assert.equal(a.length,1200);assert.deepEqual(a,b);
});

test('R32 long holdout has zero false allows',()=>{
 const x=runR32LongHoldout(2400);
 assert.equal(x.falseAllows,0);
 assert.equal(x.invariantHolds,true);
 assert.ok(x.allowed>0);assert.ok(x.blocked>0);
});

test('R32 blocks READY with bad economics and GOOD with incomplete recovery',()=>{
 const x=runR32LongHoldout(1200);
 assert.ok(x.readyButBadBlocks>0);
 assert.ok(x.goodButNotReadyBlocks>0);
});

test('R32 battery spans 9,120 state/regime events with invariant intact',()=>{
 const x=runR32Battery();
 assert.equal(x.totalEvents,9120);
 assert.equal(x.allInvariant,true);
 assert.equal(x.falseAllows,0);
});

test('R32 remains zero execution and no real performance claim',()=>{
 const x=runR32Battery();
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);assert.equal(x.actualBrokerPnl,null);
});
