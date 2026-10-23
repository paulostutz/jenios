import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeR17} from '../lib/platform/research/robot-r17-decision-quality.mjs';

const summary=JSON.parse(readFileSync(new URL('../docs/platform/evidence/ROBOT_R17_SANITIZED_SUMMARY.json',import.meta.url),'utf8'));

test('R17 sanitized private summary is linked to an immutable-looking digest and remains NO_GO',()=>{
 assert.equal(summary.schema,'JENIOS_R17_SANITIZED_PRIVATE_RESULT_SUMMARY_V1');
 assert.match(summary.source_private_sha256,/^[a-f0-9]{64}$/);
 assert.equal(summary.marketFixtures,36);
 assert.equal(summary.totalExperiments,360);
 assert.equal(summary.claims.actualBrokerPnl,null);
 assert.equal(summary.claims.tradeAccuracy,null);
 assert.equal(summary.claims.adaptiveProfitabilityProven,false);
 assert.equal(summary.claims.executionEnabled,false);
 assert.equal(summary.claims.releaseGate,'NO_GO');
});

test('R17 real sanitized results trigger operator-alignment guard for assisted modes',()=>{
 const x=summarizeR17({
   modes:summary.modeTotals,
   intentSensitivityByMode:summary.intentSensitivityByMode
 });
 assert.equal(x.primaryRecommendation,'ADD_OPERATOR_ALIGNMENT_GUARD_BEFORE_ASSIST_OR_REVERSE');
 for(const mode of ['hybrid','reverse_unvalidated','reverse_hypothetically_calibrated']){
  assert.ok(x.intentSensitivity[mode].issues.includes('HARMS_ALREADY_ALIGNED_OPERATOR_IN_LAB'));
 }
 assert.equal(x.actualBrokerPnl,null);
 assert.equal(x.actualLossesAvoided,null);
 assert.equal(x.tradeAccuracy,null);
 assert.equal(x.releaseGate,'NO_GO');
});

test('R17 assisted modes show positive lab uplift only after operator-intent error grows',()=>{
 for(const mode of ['hybrid','reverse_unvalidated','reverse_hypothetically_calibrated']){
  const rows=summary.intentSensitivityByMode[mode];
  assert.ok(rows.find(x=>x.intentErrorRate===0).netUpliftR<0);
  assert.ok(rows.find(x=>x.intentErrorRate===0.15).netUpliftR<0);
  assert.ok(rows.find(x=>x.intentErrorRate===0.35).netUpliftR>0);
  assert.ok(rows.find(x=>x.intentErrorRate===1).netUpliftR>0);
 }
});

test('R17 accounting remains complete across all 71,600 mode-decisions',()=>{
 const total=summary.modeTotals.reduce((s,x)=>s+x.decisions,0);
 assert.equal(total,71600);
 for(const x of summary.modeTotals)
  assert.equal(x.decisions,x.helped+x.harmed+x.unchanged);
});
