import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {qualifyR129} from '../scripts/platform/ultra/qualify-r129.mjs';

let directory,report,reportPath;
before(async()=>{directory=mkdtempSync(join(tmpdir(),'ultra-monthly-r129-'));({report,reportPath}=await qualifyR129(directory));});
after(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

test('R129 end-to-end fixture uses preserved R128 records in five account journeys',()=>{
 assert.equal(report.schema,'JENIOS_ULTRA_MONTHLY_QUALIFICATION_R129');
 assert.equal(report.results.length,5);
 assert.deepEqual(new Set(report.results.map(row=>row.sourcePlatform)),new Set(['jenios','flow']));
 assert.equal(report.results.reduce((sum,row)=>sum+row.operationCount,0),13);
 for(const row of report.results){
  assert.equal(row.fixtureSubmissions,row.operationCount);
  assert.equal(new Set(row.operationIds).size,row.operationCount);
  assert.ok(row.revisionCount>row.operationCount);
  assert.equal(row.startReservationCount,1);assert.equal(row.reservedSyntheticCents,500);
  assert.equal(row.finalNet,null);assert.equal(row.nativeValidated,false);
  for(const stage of row.stages)assert.equal(stage.reservations,1);
 }
 for(const key of ['realOrdersSent','externalDemoOrdersSent','realInvoicesCreated','realDebitsExecuted'])assert.equal(report[key],0);
 for(const key of ['nativeValidated','externalDemoTested','liveExecutionAllowed','productionPublished','billingActivated','visualQaPerformed'])assert.equal(report[key],false);
});

test('R129 partial, uncertain and incomplete-cost stages never become a zero or confirmed profit',()=>{
 for(const row of report.results){
  for(const phase of ['response_lost','disconnected','recovered_partial_entry','partial_exit']){
   const stage=row.stages.find(item=>item.phase===phase);assert.ok(stage);assert.equal(stage.knownNet,null);
  }
  const pending=row.stages.find(item=>item.phase==='closed_costs_pending');
  assert.equal(pending.knownNet,null);assert.equal(pending.awaitingCosts,1);assert.ok(pending.pendingReasons.includes('COSTS_PENDING'));
  const final=row.stages.at(-1);assert.equal(final.phase,'month_closed');assert.equal(final.operationCount,row.operationCount);assert.equal(final.awaitingCosts,0);
  const saved=JSON.parse(readFileSync(join(directory,row.scenario+'-records.json'),'utf8'));
  assert.equal(saved.state.operationCount,row.operationCount);
  assert.equal(saved.report.groups[0].records.length,row.operationCount);
  for(const record of saved.report.groups[0].records){
   assert.equal(record.result.status,'closed_complete');
   const revisions=saved.report.groups[0].history.filter(old=>old.operationKey===record.operationKey);
   assert.equal(revisions.at(-1).eventId,record.eventId);
   assert.equal(record.evidence.brokerAuthenticated,false);assert.equal(record.evidence.nativeValidated,false);
  }
 }
});

test('R129 general month subtracts the losing account and keeps Letter multi-account emission pending',()=>{
 const {recordEnvelope,individual,included}=report.general;
 assert.equal(recordEnvelope.observedAccountKeys.length,2);
 assert.deepEqual(recordEnvelope.groups.map(group=>group.monthly.confirmed.net).sort(),['-0.20000000','0.30000000']);
 for(const group of recordEnvelope.groups)assert.equal(group.monthly.observedAccountCount,2);
 assert.equal(individual.assessment.eligible_profit_minor,10);
 assert.equal(individual.assessment.performance_minor,2);assert.equal(included.assessment.performance_minor,1);
 for(const preparation of [individual,included]){
  assert.equal(preparation.draft,null);assert.equal(preparation.emission.obligation_id,null);
  assert.equal(preparation.emission.eligibleForSyntheticInvoice,false);
  assert.ok(preparation.emission.pendingReasons.includes('LETTER_MULTI_ACCOUNT_CONTRACT_REQUIRED'));
  assert.equal(preparation.assessment.calculation.accountKey,null);
  assert.equal(preparation.assessment.calculation.accountKeys.length,2);
 }
});

test('R129 single-account 20% and 10% use confirmed costs and keep Start and subscription separate',()=>{
 const gate=report.letterGate;
 assert.equal(gate.individual.assessment.eligible_profit_minor,2970);
 assert.equal(gate.individual.assessment.performance_minor,594);
 assert.equal(gate.included.assessment.performance_minor,297);
 assert.equal(gate.individual.draft.separation.start,'separate');assert.equal(gate.individual.draft.separation.subscription,'separate');
 assert.equal(gate.individual.draft.separation.annual_waives_performance,false);
 assert.equal(gate.firstCycleReservations,1);assert.equal(gate.explicitSecondCycleReservations,1);
 assert.equal(report.reservationJournal.length,6);
 assert.equal(new Set(report.reservationJournal.map(row=>row.key)).size,6);
});

test('R129 actual runtime opening is withheld by Letter and only its authoritative fixture receipt releases it',()=>{
 const gate=report.letterGate;
 assert.equal(gate.pending.allowed_in_simulation,false);
 assert.equal(gate.blockedAttempt.startPreparation.performanceGate.reason,'R129_PERFORMANCE_OPENINGS_BLOCKED');
 assert.equal(gate.blockedAttempt.startPreparation.performanceGate.stage,'preflight');
 assert.equal(gate.afterBlockedAttempt,gate.beforeBlockedAttempt);
 for(const action of ['read','reconcile','cancel','reduce_risk'])assert.equal(gate.preserved[action].allowed_in_simulation,true);
 assert.equal(gate.confirmed.released_once,true);assert.equal(gate.confirmed.obligation.release_count,1);
 assert.equal(gate.released.allowed_in_simulation,true);assert.equal(gate.released.actual_execution_authorized,false);
 assert.equal(gate.afterReleasedAttempt,gate.beforeBlockedAttempt+1);
 assert.equal(report.letterAudit.filter(event=>event.kind==='synthetic_payment_confirmed').length,1);
});

test('R129 qualification refuses a nonempty destination without replacing saved evidence',async()=>{
 const bytes=readFileSync(reportPath);
 await assert.rejects(()=>qualifyR129(directory),/DIRECTORY_MUST_BE_EMPTY/);
 assert.deepEqual(readFileSync(reportPath),bytes);
 assert.deepEqual(JSON.parse(bytes),report);
});
