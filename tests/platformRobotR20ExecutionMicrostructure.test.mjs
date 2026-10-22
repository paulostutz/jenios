import test from 'node:test';import assert from 'node:assert/strict';
import {selectAlignmentThreshold,evaluateAlignmentThreshold} from '../lib/platform/research/robot-r20-alignment-calibration.mjs';
import {simulateMicroExecution,simulateTimedUltraSession,runR20MicrostructureSweep} from '../lib/platform/research/robot-r20-ultrafast-execution.mjs';

const rows=Array.from({length:800},(_,i)=>({
 operatorCorrect:i%5!==0,
 technicalCorrect:i%7!==0,
 confidence:[.52,.58,.62,.66,.7,.74,.78,.82,.88][i%9]
}));

test('R20 calibrates an alignment threshold without execution',()=>{
 const x=selectAlignmentThreshold(rows);
 assert.ok(x.best.threshold>=.5&&x.best.threshold<=.85);
 assert.equal(x.ordersSent,0);
 for(const r of x.results)assert.equal(r.total,800);
});

test('R20 alignment accounting is deterministic',()=>{
 assert.deepEqual(evaluateAlignmentThreshold(rows,.65),evaluateAlignmentThreshold(rows,.65));
});

test('R20 maker simulation models queue, partial fills and cancel/replace',()=>{
 const x=simulateMicroExecution({orderStyle:'maker',side:'buy',notionalUsd:5000,spreadBps:2,
  makerFeeBps:1,takerFeeBps:4,slippageBps:2,queueAheadUsd:3000,tradeFlowUsd:5500,
  latencyMs:80,cancelAfterMs:500,adverseMoveBps:2});
 assert.ok(x.fillRatio>0&&x.fillRatio<1);assert.equal(x.partialFill,true);assert.equal(x.needsCancelReplace,true);
 assert.equal(x.ordersSent,0);
});

test('R20 taker simulation always fills synthetically but pays more immediate friction',()=>{
 const x=simulateMicroExecution({orderStyle:'taker',side:'sell',notionalUsd:5000,spreadBps:6,
  makerFeeBps:0,takerFeeBps:5,slippageBps:3,queueAheadUsd:999999,tradeFlowUsd:0,
  latencyMs:150,cancelAfterMs:100,adverseMoveBps:2});
 assert.equal(x.fillRatio,1);assert.equal(x.partialFill,false);assert.ok(x.executionCostBps>8);
 assert.equal(x.actualBrokerPnl,null);
});

test('R20 timed session stops at drawdown and tracks partial fills',()=>{
 const events=Array.from({length:20},(_,i)=>({atSec:i*5,resultR:i<3?.3:-.8,fillRatio:i%2?.5:1,cancelReplace:i%3===0}));
 const x=simulateTimedUltraSession({durationSec:600,marketCloseInSec:500,maxTrades:100,drawdownLimitPct:2,events});
 assert.equal(x.haltReason,'DRAWDOWN_LIMIT');assert.ok(x.partialFills>0);assert.ok(x.cancelReplaces>0);
 assert.equal(x.ordersSent,0);
});

test('R20 large execution sweep has maker/taker/partial/cancel coverage',()=>{
 const x=runR20MicrostructureSweep();
 assert.ok(x.total>100000);assert.ok(x.partial>0);assert.ok(x.cancel>0);assert.ok(x.timeouts>0);
 assert.equal(x.maker,x.taker);assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);
});
