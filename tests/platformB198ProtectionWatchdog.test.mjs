import test from 'node:test';import assert from 'node:assert/strict';
import {planPrivatePaperProtectionIncident} from '../lib/platform/connections/b198-protection-watchdog.mjs';
const nowMs=1792527000000,unit=100000000n,bracketAudit={bracketConfirmed:true,reviewRequired:false,stopFillGuaranteed:false};
const riskRow=(state,held,filled)=>({state,held:String(BigInt(held)*unit),filled:String(BigInt(filled)*unit)});
const watch=(state,held,filled,bracket=null)=>planPrivatePaperProtectionIncident({riskRow:riskRow(state,held,filled),bracketAudit:bracket,nowMs});
test('B198 UNKNOWN and submitting cannot unlock risk, retries, or assert safety',()=>{
 for(const state of ['UNKNOWN','SUBMITTING']){
  const r=watch(state,4,0,bracketAudit);
  assert.equal(r.severity,'critical');assert.equal(r.entryPauseRecommended,true);
  assert.equal(r.incident,'UNKNOWN_BROKER_EXECUTION');
  assert.equal(r.ordersSent,0);assert.equal(r.stopExecutionGuaranteed,false);
 }
});
test('B198 partial and filled exposures missing protection escalate to critical',()=>{
 for(const state of ['PARTIAL','FILLED','CANCELLED']){
  const r=watch(state,4,state==='FILLED'?4:2);
  assert.equal(r.severity,'critical');
  assert.equal(r.incident,'PAPER_POSITION_PROTECTION_UNVERIFIED');
  assert.ok(r.actions.includes('VERIFY_POSITION_AND_BOTH_EXIT_LEGS_WITH_BROKER'));
 }
});
test('B198 even observed bracket legs cannot certify future stop fill',()=>{
 const r=watch('FILLED',4,4,bracketAudit);
 assert.equal(r.severity,'high');assert.equal(r.entryPauseRecommended,true);
 assert.equal(r.providerStopPresenceObservedInSyntheticEvidence,true);
 assert.equal(r.realBrokerProtectionIndependentlyCertified,false);
 assert.equal(r.stopExecutionGuaranteed,false);
});
test('B198 ACK and RESERVED are not executions and do not trigger remote modifications',()=>{
 const ack=watch('ACK',4,0);const reserved=watch('RESERVED',4,0);
 assert.equal(ack.incident,'ACK_IS_NOT_EXECUTION');
 assert.equal(reserved.incident,'NO_EXECUTION_EVIDENCE');
 assert.equal(ack.entryPauseRecommended,false);
 assert.equal(reserved.ordersSent,0);
});
test('B198 closed ledger still requires independent broker confirmation',()=>{
 const r=watch('CLOSED',0,4);
 assert.equal(r.incident,'LEDGER_CLOSED_REQUIRES_PROVIDER_CONFIRMATION');
 assert.equal(r.manualBrokerLookupRequired,true);
 assert.equal(r.positionsClosedByThisCheck,false);
});
test('B198 fail-close on inconsistent risk release and forged rejection with fills',()=>{
 assert.throws(()=>watch('FILLED',0,4),/RISK_RESERVATION_NOT_HELD|POSITION_RISK_RELEASED_PREMATURELY/);
 assert.throws(()=>watch('UNKNOWN',0,0),/UNKNOWN_EXPOSURE_NOT_RESERVED/);
 assert.throws(()=>watch('REJECTED',0,1),/REJECTED_ORDER_HAS_FILL/);
 assert.throws(()=>watch('CLOSED',4,4),/CLOSED_RISK_NOT_RELEASED/);
 assert.throws(()=>watch('CANCELLED',4,0),/TERMINAL_WITHOUT_FILL_STILL_HOLDS_RISK/);
 assert.throws(()=>watch('CLOSED',0,0),/CLOSED_WITHOUT_CONFIRMED_FILL/);
});
