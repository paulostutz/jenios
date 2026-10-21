import test from 'node:test';
import assert from 'node:assert/strict';
import {compileRedactedPaperReview} from '../lib/platform/connections/b204-redacted-paper-review.mjs';
const nowMs=1792526200000;
const pair={schema:'JENIOS_B201_PRIVATE_PAIRED_PAPER_READ',
 assessment:'STABLE_TERMINAL_OBSERVATIONS',observationCount:2,lastObservedKind:'FILLED',
 independentlyAttested:false,ordersSent:0,automaticResubmissionAllowed:false,
 liveExecutionAuthorized:false};
const risk={schema:'JENIOS_B202_LEDGER_OUTBOX_READONLY_AUDIT',
 classification:'REVIEW_REQUIRED_NO_AUTO_ACTION',severity:'review',outboxState:'RECONCILED',
 conflictCodes:[],ledgerChanged:false,automaticOrderRetryAllowed:false,
 liveExecutionAuthorized:false,ordersSent:0};
const restart={schema:'JENIOS_B203_PRIVATE_RESTART_INVENTORY',
 disposition:'MANUAL_REVIEW_BEFORE_RESUME',orderCount:1,ambiguousCount:0,
 unverifiedDispatchCount:0,openExposureCount:0,
 noAutomaticSubmissionAfterRestart:true,ledgerChanged:false,ordersSent:0,
 liveExecutionAuthorized:false};
const input={pairedRead:pair,ledgerAudit:risk,restartInventory:restart,nowMs};
test('B204 stable Paper history returns a deterministic checksum but NEVER a launch approval',()=>{
 const a=compileRedactedPaperReview(input),b=compileRedactedPaperReview(input);
 assert.equal(a.evidenceChecksumSha256,b.evidenceChecksumSha256);
 assert.match(a.evidenceChecksumSha256,/^[a-f0-9]{64}$/);
 assert.equal(a.severity,'REVIEW');assert.equal(a.readyForBrokerPaperPilot,false);
 assert.equal(a.independentExternalWitnessCertified,false);assert.equal(a.checksumIsDigitalSignature,false);
 assert.equal(a.productionReleaseAllowed,false);assert.equal(a.realExecutionAuthorized,false);
 assert.equal(a.ordersSent,0);assert.equal(a.chargesCreated,0);
});
test('B204 operator checkbox alone cannot authorize anything',()=>{
 const a=compileRedactedPaperReview({...input,operatorAcknowledged:true});
 assert.equal(a.operatorAcknowledgmentClaimed,true);
 assert.equal(a.humanAuthorizationGranted,false);
 assert.equal(a.readyForBrokerPaperPilot,false);
 assert.equal(a.automaticResubmissionAllowed,false);
});
test('B204 ambiguous 404 + risk UNKNOWN and restart exposure yields critical manual escalation',()=>{
 const a=compileRedactedPaperReview({...input,
  pairedRead:{...pair,assessment:'ORDER_NOT_FOUND_IS_UNKNOWN',observationCount:1},
  ledgerAudit:{...risk,classification:'UNKNOWN_BROKER_STATE_NO_GO',
   severity:'critical',outboxState:'AMBIGUOUS',conflictCodes:['404_IS_NOT_A_REJECTION']},
  restartInventory:{...restart,disposition:'HALT_AND_REVIEW',ambiguousCount:1,
   openExposureCount:1}});
 assert.equal(a.severity,'CRITICAL');assert.ok(a.requiredActions.includes('PAUSE_NEW_ENTRIES_AND_REVIEW_BROKER_ORDER'));
 assert.equal(a.readyForBrokerPaperPilot,false);
});
test('B204 rejects credential-bearing or identifier-bearing input rather than copying it to output',()=>{
 for(const [section,extra] of [
  ['pairedRead',{clientOrderId:'plain-order'}],
  ['ledgerAudit',{apiKey:'super-secret'}],
  ['restartInventory',{credentials:{secret:'should-not-be-here'}}],
  ['ledgerAudit',{outboxState:'client_name_or_key'}]
 ]){
  const patched={...input,[section]:{...input[section],...extra}};
  assert.throws(()=>compileRedactedPaperReview(patched));
 }
});
test('B204 refuses fake reconciliation or fabricated execution permissions',()=>{
 const errors=[
  {...input,pairedRead:{...pair,independentlyAttested:true}},
  {...input,pairedRead:{...pair,ordersSent:1}},
  {...input,ledgerAudit:{...risk,ledgerChanged:true}},
  {...input,ledgerAudit:{...risk,conflictCodes:['UNSAFE<script>']}},
  {...input,restartInventory:{...restart,noAutomaticSubmissionAfterRestart:false}},
  {...input,restartInventory:{...restart,liveExecutionAuthorized:true}}
 ];
 for(const row of errors)assert.throws(()=>compileRedactedPaperReview(row));
});
test('B204 adding one extra conflict changes checksum without signing or altering the source',()=>{
 const original=compileRedactedPaperReview(input);
 const patched=compileRedactedPaperReview({...input,ledgerAudit:{...risk,
  classification:'INCONSISTENT_EVIDENCE_NO_GO',severity:'critical',
  conflictCodes:['BROKER_REPORTED_FILL_BELOW_DURABLE_LEDGER']}});
 assert.notEqual(original.evidenceChecksumSha256,patched.evidenceChecksumSha256);
 assert.equal(risk.conflictCodes.length,0);
 assert.equal(patched.checksumIsDigitalSignature,false);
});
