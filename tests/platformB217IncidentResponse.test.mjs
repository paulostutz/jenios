import test from 'node:test';import assert from 'node:assert/strict';
import {decidePaperAuditIncident} from '../lib/platform/launch/b217-incident-response.mjs';
const base={auditState:'REVIEW_RECORDED',severity:'REVIEW',ledgerState:'REJECTED',dispatchState:'RECONCILED',atMs:1792530000000};
test('B217 safe-looking state still requires human acceptance',()=>{let r=decidePaperAuditIncident(base);assert.equal(r.classification,'OPERATOR_ACCEPTANCE_PENDING');assert.equal(r.pausedByThisReview,false);});
for(const v of [{ledgerState:'UNKNOWN'},{ledgerState:'PARTIAL'},{dispatchState:'AMBIGUOUS'},
 {auditState:'FAILED_CLOSED'},{severity:'CRITICAL'}])test('B217 incident halts on '+Object.keys(v)[0],()=>{
 const r=decidePaperAuditIncident({...base,...v});assert.equal(r.classification,'HALT_ENTRIES_AND_REVIEW');
 assert.equal(r.retryStarted,false);assert.equal(r.ordersSent,0);assert.equal(r.providerOrderCancelSent,false);
});
test('B217 malformed evidence rejected',()=>assert.throws(()=>decidePaperAuditIncident({...base,ledgerState:'MAGIC'}),/B217_INVALID_INCIDENT_SCOPE/));
