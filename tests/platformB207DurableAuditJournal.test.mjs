import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,statSync,symlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {PrivatePaperReadAuditStore} from '../lib/platform/connections/b207-durable-read-audit.mjs';
const env={JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,8).toString('base64'),
 JENIOS_PAPER_OBSERVER_KEY_B64:Buffer.alloc(32,9).toString('base64'),
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',
 JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true',JENIOS_PRIVATE_PAPER_OBSERVER_WORKER:'true'};
const now=1792526000000;
const scope={userId:'4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',
 connectionId:'50b85e9d-339c-4d32-b2bf-82c467673832',clientOrderId:'order-review-1',auditId:'human-audit-1'};
const report={schema:'JENIOS_B204_REDACTED_PAPER_REVIEW',evidenceChecksumSha256:'a'.repeat(64),
 severity:'CRITICAL',ordersSent:0,readyForBrokerPaperPilot:false,realExecutionAuthorized:false,
 productionReleaseAllowed:false,chargesCreated:0,humanAuthorizationGranted:false,
 brokerPermissionCertified:false,privateWorkerDeployedByReport:false,
 independentExternalWitnessCertified:false,automaticResubmissionAllowed:false};
const fixture=fn=>{const dir=mkdtempSync(join(tmpdir(),'jenios-b207-')),path=join(dir,'observer.sqlite');
 let store=new PrivatePaperReadAuditStore(path,{env});
 try{return fn({store,path,dir,reopen:()=>{store.close();store=new PrivatePaperReadAuditStore(path,{env});return store;}})}
 finally{store.close();rmSync(dir,{recursive:true,force:true});}};
test('B207 private store claims at most once for the same signed audit cycle',()=>fixture(({store})=>{
 const one=store.claim(scope,{nowMs:now});assert.equal(one.claimed,true);
 const again=store.claim(scope,{nowMs:now+100});assert.equal(again.claimed,false);
 assert.equal(again.state,'IN_PROGRESS');assert.equal(again.attempts,1);
 assert.equal(one.auditDigest.length,64);
}));
test('B207 stores only keyed HMAC scope, not raw user/connection/order IDs',()=>fixture(({store,path})=>{
 store.claim(scope,{nowMs:now});
 const text=readFileSync(path).toString('latin1');
 for(const value of Object.values(scope))assert.equal(text.includes(value),false);
 assert.equal(statSync(path).mode&0o777,0o600);
}));
test('B207 snapshot after restart never automatically recovers or retries an unfinished audit',()=>fixture(({store,reopen})=>{
 const one=store.claim(scope,{nowMs:now,leaseMs:2000});
 store=reopen();
 const expired=store.claim(scope,{nowMs:now+2001,leaseMs:2000});
 assert.equal(expired.claimed,false);assert.equal(expired.state,'EXPIRED_NEEDS_REVIEW');
 assert.equal(expired.auditDigest,one.auditDigest);
 assert.equal(store.claim(scope,{nowMs:now+5000}).claimed,false);
 const fresh=store.claim({...scope,auditId:'new-human-approval-cycle'},{nowMs:now+5000});
 assert.equal(fresh.claimed,true);
}));
test('B207 report recorded durably with checksum only; duplicate after close does not reopen',()=>fixture(({store,reopen})=>{
 store.claim(scope,{nowMs:now});
 const saved=store.record(scope,{nowMs:now+20,report});
 assert.equal(saved.state,'REVIEW_RECORDED');assert.equal(saved.severity,'CRITICAL');
 assert.equal(saved.evidenceChecksumSha256,'a'.repeat(64));
 store=reopen();
 assert.equal(store.claim(scope,{nowMs:now+30}).claimed,false);
 assert.equal(store.inspect(scope).state,'REVIEW_RECORDED');
 assert.throws(()=>store.record(scope,{nowMs:now+40,report}),/PRIVATE_AUDIT_NOT_ACTIVE/);
}));
test('B207 report cannot mark Paper, real trading, payment or deployment authorized',()=>fixture(({store})=>{
 store.claim(scope,{nowMs:now});
 for(const patch of [{ordersSent:1},{readyForBrokerPaperPilot:true},{liveExecutionAuthorized:true},
  {productionReleaseAllowed:true},{evidenceChecksumSha256:'wrong'},{severity:'GO'}]){
  assert.throws(()=>store.record(scope,{nowMs:now+1,report:{...report,...patch}}),
   /UNTRUSTED_PRIVATE_AUDIT_REPORT/);
 }
 assert.equal(store.inspect(scope).state,'IN_PROGRESS');
}));
test('B207 failed run cannot auto-repeat and has a redacted, fixed error code',()=>fixture(({store})=>{
 store.claim(scope,{nowMs:now});
 const x=store.failClosed(scope,{nowMs:now+2});
 assert.equal(x.state,'FAILED_CLOSED');assert.equal(x.code,'PRIVATE_AUDIT_UNCONFIRMED');
 assert.equal(store.claim(scope,{nowMs:now+3000}).claimed,false);
 assert.throws(()=>store.failClosed(scope,{nowMs:now+3,code:'apiKey 123'}));
}));
test('B207 concurrent processes on one SQLite file cannot both claim same audit',()=>fixture(({store,path})=>{
 const other=new PrivatePaperReadAuditStore(path,{env});
 try{const [a,b]=[store.claim(scope,{nowMs:now}),other.claim(scope,{nowMs:now})];
  assert.equal(Number(a.claimed)+Number(b.claimed),1);
 }finally{other.close();}
}));
test('B207 rejects symlinks, relative paths and unrelated user scopes',()=>fixture(({store,path,dir})=>{
 const link=join(dir,'sneaky.sqlite');symlinkSync(path,link);
 assert.throws(()=>new PrivatePaperReadAuditStore(link,{env}));
 assert.throws(()=>new PrivatePaperReadAuditStore('relative.db',{env}));
 assert.throws(()=>store.claim({...scope,userId:'wrong'},{nowMs:now}),/INVALID_AUDIT_OWNER_SCOPE/);
}));
