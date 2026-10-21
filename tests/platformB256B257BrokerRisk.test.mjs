import test from 'node:test';import assert from 'node:assert/strict';
import {auditCustomerBrokerReadOnly} from '../lib/platform/release260/b256-customer-broker-audit.mjs';
import {triageExistingPaperRisk} from '../lib/platform/release260/b257-risk-incident-triage.mjs';
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',now=1792526000000;
const connection={id:'50b85e9d-339c-4d32-b2bf-82c467673832',user_id:user,
 provider:'alpaca',environment:'paper',status:'active',identity_verified:true,
 external_digest:'a'.repeat(64),last_sync_at:new Date(now-100).toISOString()};
test('B256 reader stage from server-owned user is read-only even when recently synced',()=>{
 const a=auditCustomerBrokerReadOnly({verifiedUserId:user,connection,nowMs:now});
 assert.equal(a.recentReadConfirmed,true);assert.equal(a.permittedToTrade,false);
 assert.equal(JSON.stringify(a).includes(connection.external_digest),false);
});
test('B256 revoked, foreign owner and stale account all fail closed',()=>{
 for(const row of [{...connection,status:'revoked'},{...connection,user_id:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'},
  {...connection,external_digest:''}]){
  const a=auditCustomerBrokerReadOnly({verifiedUserId:user,connection:row,nowMs:now});
  assert.equal(a.classification,'INVALID_OR_UNLINKED');
 }
 const late=auditCustomerBrokerReadOnly({verifiedUserId:user,
   connection:{...connection,last_sync_at:new Date(now-900000).toISOString()},nowMs:now});
 assert.equal(late.recentReadConfirmed,false);assert.equal(late.permittedToTrade,false);
});
test('B257 404 after timeout retains risk; no inference of rejected or resend',()=>{
 const x=triageExistingPaperRisk({riskRow:{state:'UNKNOWN',held:'400000000',filled:'0'},
  orderLookupStatus:'not_found',nowMs:now});
 assert.equal(x.unknownOrMissingBrokerEvidence,true);assert.equal(x.newEntriesMustStayPaused,true);
 assert.equal(x.heldRiskUnits,'400000000');assert.equal(x.ordersSent,0);
});
test('B257 partly filled position without stop cannot be treated as safe',()=>{
 const x=triageExistingPaperRisk({riskRow:{state:'PARTIAL',held:'400000000',filled:'200000000'},
  orderLookupStatus:'acknowledged',nowMs:now});
 assert.equal(x.newEntriesMustStayPaused,true);assert.equal(x.stopExecutionGuaranteed,false);
 assert.equal(x.operatorAction,'PAUSE_AND_REVIEW');
});
test('B257 invalid live/external states never become release evidence',()=>{
 assert.throws(()=>triageExistingPaperRisk({riskRow:{state:'ACK',held:'4',filled:'0'},
   orderLookupStatus:'live_paid',nowMs:now}),/INVALID_PROVIDER_OBSERVATION_STATUS/);
 assert.throws(()=>triageExistingPaperRisk({riskRow:{state:'UNKNOWN',held:'0',filled:'0'},
   orderLookupStatus:'not_found',nowMs:now}),/UNKNOWN_EXPOSURE_NOT_RESERVED/);
});
