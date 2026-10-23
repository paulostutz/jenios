import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewR17ModeQuality,reviewR17IntentSensitivity,summarizeR17}
 from '../lib/platform/research/robot-r17-decision-quality.mjs';

const mode=(name,patch={})=>({mode:name,runs:10,decisions:100,abstentions:20,
 helped:50,harmed:20,unchanged:30,netUpliftR:10,degradationR:4,
 missedWinnersR:3,newNegativeR:1,...patch});

test('R17 accepts complete synthetic accounting but never promotes it to real performance',()=>{
 const x=reviewR17ModeQuality(mode('hybrid'));
 assert.equal(x.classification,'LAB_QUALITY_ACCEPTABLE');
 assert.equal(x.actualBrokerPnl,null);assert.equal(x.actualLossesAvoided,null);
 assert.equal(x.tradeAccuracy,null);assert.equal(x.realMarketAdvantageCertified,false);
 assert.equal(x.ordersSent,0);assert.equal(x.paperOrdersSent,0);
});

test('R17 detects harmful or overly conservative advisory behavior',()=>{
 const harmful=reviewR17ModeQuality(mode('hybrid',{harmed:40,helped:30,unchanged:30,
  newNegativeR:9,abstentions:70}));
 assert.equal(harmful.classification,'REFINE_BEFORE_NEXT_CYCLE');
 assert.ok(harmful.issues.includes('HARM_RATE_TOO_HIGH'));
 assert.ok(harmful.issues.includes('NEW_NEGATIVE_COST_TOO_HIGH'));
 assert.ok(harmful.issues.includes('TOO_CONSERVATIVE'));
});

test('R17 flags assistance that harms an already-aligned synthetic operator',()=>{
 const x=reviewR17IntentSensitivity([
  {intentErrorRate:0,netUpliftR:-10},
  {intentErrorRate:.35,netUpliftR:4},
  {intentErrorRate:.6,netUpliftR:12},
  {intentErrorRate:1,netUpliftR:25}
 ]);
 assert.equal(x.classification,'NEEDS_OPERATOR_ALIGNMENT_GUARD');
 assert.ok(x.issues.includes('HARMS_ALREADY_ALIGNED_OPERATOR_IN_LAB'));
});

test('R17 flags non-monotonic response to worsening synthetic intent',()=>{
 const x=reviewR17IntentSensitivity([
  {intentErrorRate:0,netUpliftR:0},
  {intentErrorRate:.5,netUpliftR:12},
  {intentErrorRate:1,netUpliftR:4}
 ]);
 assert.ok(x.issues.includes('NON_MONOTONIC_INTENT_ERROR_RESPONSE'));
});

test('R17 summary recommends alignment guard when any assisted mode harms correct intent',()=>{
 const modes=['manual','hybrid','reverse_unvalidated','reverse_hypothetically_calibrated']
   .map(x=>mode(x));
 const rows=[
  {intentErrorRate:0,netUpliftR:-2},{intentErrorRate:1,netUpliftR:10}
 ];
 const x=summarizeR17({modes,intentSensitivityByMode:{
  hybrid:rows,reverse_unvalidated:rows,reverse_hypothetically_calibrated:rows
 }});
 assert.equal(x.primaryRecommendation,'ADD_OPERATOR_ALIGNMENT_GUARD_BEFORE_ASSIST_OR_REVERSE');
 assert.equal(x.releaseGate,'NO_GO');
 assert.equal(x.actualBrokerPnl,null);
});

test('R17 rejects incomplete accounting and source contains no execution/network hooks',()=>{
 assert.throws(()=>reviewR17ModeQuality(mode('hybrid',{helped:49})),/R17_INVALID_MODE_METRICS/);
 const s=readFileSync(new URL('../lib/platform/research/robot-r17-decision-quality.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(s,/\bfetch\s*\(|submitOrder|createOrder|OPENAI_API_KEY|process\.env|private-core|nucleo-privado/i);
});
