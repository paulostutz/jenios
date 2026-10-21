import test from 'node:test';import assert from 'node:assert/strict';
import {compileFrozenRollingHoldout} from '../lib/platform/launch/b225-holdout-candidate.mjs';
const base=Date.parse('2026-10-15T00:00:00Z');
const prices=n=>Array.from({length:n},(_,i)=>{const p=100+i*.09;return {time:new Date(base+i*60000).toISOString(),open:p,high:p+1,low:p-1,close:p+.2,volume:1200};});
test('B225 frozen rolling holdout includes three modes and cost stress without recommending winner',()=>{
 const r=compileFrozenRollingHoldout(prices(250),{now:base+1000*60000});
 assert.equal(r.summaries.length,3);assert.equal(r.nonOverlappingHoldouts>=3,true);
 assert.equal(r.originalRobotsEvaluated,false);assert.equal(r.performanceCertified,false);assert.equal(r.recommendedMode,null);
});
test('B225 short historical sample cannot become evidence',()=>{const r=compileFrozenRollingHoldout(prices(100),{now:base+1000*60000});assert.equal(r.classification,'INVALID_OR_INSUFFICIENT_HOLDOUT');});
