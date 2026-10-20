import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {AlpacaPaperDispatchJournal,paperDispatchHash} from '../lib/platform/connections/alpaca-paper-dispatch-journal.mjs';
const initial={userId:'4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',connectionId:'50b85e9d-339c-4d32-b2bf-82c467673832',clientOrderId:'client-alpha-002',accountDigest:'a'.repeat(64),proposalDigest:'b'.repeat(64),atMs:1792526000000};
function withDb(fn){const dir=mkdtempSync(join(tmpdir(),'jenios-paper-dispatch-'));const path=join(dir,'gateway.db');try{return fn(path,()=>new AlpacaPaperDispatchJournal(path));}finally{rmSync(dir,{recursive:true,force:true});}}
test('B178 persists one-shot claim across restarts without retry or secrets',()=>withDb((path,open)=>{
 const a=open();try{assert.equal(a.prepare(initial).duplicate,false);assert.equal(a.prepare(initial).duplicate,true);let res=a.claim({...initial,atMs:initial.atMs+1});assert.equal(res.claimed,true);assert.equal(res.attempts,1);assert.equal(a.claim({...initial,atMs:initial.atMs+2}).claimed,false);assert.equal(statSync(path).mode&0o777,0o600);}finally{a.close();}
 const b=open();try{let r=b.inspect(initial);assert.equal(r.state,'IN_FLIGHT');assert.equal(r.attempts,1);assert.equal(r.automaticResubmissionAllowed,false);assert.equal(b.claim({...initial,atMs:initial.atMs+9}).claimed,false);}finally{b.close();}
}));
test('B178 concurrent independent SQLite clients cannot double claim',()=>withDb((path,open)=>{
 const a=open(),b=open();try{a.prepare(initial);const x=a.claim({...initial,atMs:initial.atMs+2}),y=b.claim({...initial,atMs:initial.atMs+3});assert.equal(Number(x.claimed)+Number(y.claimed),1);assert.equal(b.inspect(initial).attempts,1);}finally{a.close();b.close();}
}));
test('B178 rejects cross-owner, mutated account, reused ID and clock rollback',()=>withDb((path,open)=>{const a=open();try{
 a.prepare(initial);assert.throws(()=>a.prepare({...initial,accountDigest:'f'.repeat(64)}),/DISPATCH_IDEMPOTENCY_CONFLICT/);
 assert.throws(()=>a.claim({...initial,proposalDigest:'f'.repeat(64)}),/DISPATCH_INTENT_NOT_MATCHED/);
 assert.equal(a.inspect({...initial,userId:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'}),null);
 assert.throws(()=>a.claim({...initial,atMs:initial.atMs-3}),/DISPATCH_CLOCK_ROLLBACK/);
}finally{a.close();}}));
test('B178 ACK and broker reconciliation never permit dispatch again',()=>withDb((path,open)=>{const a=open();try{
 a.prepare(initial);a.claim({...initial,atMs:initial.atMs+1});
 const ack=a.observe({...initial,atMs:initial.atMs+2},{state:'ACKED',evidence:'c'.repeat(64)});assert.equal(ack.state,'ACKED');
 assert.equal(a.observe({...initial,atMs:initial.atMs+3},{state:'ACKED',evidence:'c'.repeat(64)}).duplicate,true);
 assert.throws(()=>a.observe({...initial,atMs:initial.atMs+4},{state:'AMBIGUOUS',evidence:'d'.repeat(64)}),/ALREADY_RECORDED/);
 assert.throws(()=>a.reconcile({...initial,atMs:initial.atMs+5},{verified:false,brokerEvidenceDigest:'e'.repeat(64)}),/INDEPENDENT_BROKER_EVIDENCE_REQUIRED/);
 assert.equal(a.reconcile({...initial,atMs:initial.atMs+6},{verified:true,brokerEvidenceDigest:'e'.repeat(64)}).state,'RECONCILED');
 assert.equal(a.claim({...initial,atMs:initial.atMs+7}).claimed,false);
}finally{a.close();}}));
test('B178 ambiguous claims cannot be re-sent and preserve evidence',()=>withDb((path,open)=>{const a=open();try{
 a.prepare(initial);a.claim({...initial,atMs:initial.atMs+1});
 a.observe({...initial,atMs:initial.atMs+2},{state:'AMBIGUOUS',evidence:paperDispatchHash({timeout:true})});
 assert.equal(a.inspect(initial).state,'AMBIGUOUS');
 assert.equal(a.claim({...initial,atMs:initial.atMs+3}).claimed,false);
 assert.throws(()=>a.prepare({...initial,proposalDigest:'e'.repeat(64)}),/DISPATCH_IDEMPOTENCY_CONFLICT/);
}finally{a.close();}}));
