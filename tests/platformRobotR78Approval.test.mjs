import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createR78Approval,verifyR78Approval,claimR78Approval} from '../lib/platform/connections/robot-r78-paper-approval.mjs';
const env={JENIOS_R78_APPROVAL_SIGNING_SECRET:'a'.repeat(64)};
const nowMs=1793091600000;
const scope={ownerId:'owner:verified',connectionId:'connection:verified',
 clientOrderId:'order77',orderDigest:createHash('sha256').update('order77').digest('hex')};
const newApproval=()=>createR78Approval({...scope,maxNotionalUnits:'10000000000',nowMs},{env,random:()=>Buffer.alloc(24,7)});
test('R78 signs a scoped Paper-only approval and validates exact account/intent',()=>{
 const proof=newApproval();const v=verifyR78Approval(proof,{...scope,nowMs,env});
 assert.equal(v.ownerId,scope.ownerId);assert.equal(v.connectionId,scope.connectionId);
 assert.equal(v.maxNotionalUnits,'10000000000');
 assert.equal(proof.record.liveAccount,false);assert.equal(proof.record.environment,'paper');
 for(const patch of [{ownerId:'owner:other'},{connectionId:'connection:other'},
  {clientOrderId:'different'},{orderDigest:'b'.repeat(64)}])
  assert.throws(()=>verifyR78Approval(proof,{...scope,...patch,nowMs,env}),/R78_APPROVAL_INVALID/);
});
test('R78 refuses modified approval, forged signature, missing or invalid signing key',()=>{
 const proof=newApproval();
 assert.throws(()=>verifyR78Approval({...proof,record:{...proof.record,maxNotionalUnits:'999999999999'}},
  {...scope,nowMs,env}),/R78_SIGNATURE_MISMATCH/);
 assert.throws(()=>verifyR78Approval({...proof,signature:'b'.repeat(64)},{...scope,nowMs,env}),/R78_SIGNATURE_MISMATCH/);
 for(const key of ['',undefined,'short'])assert.throws(()=>createR78Approval({
  ...scope,maxNotionalUnits:'10000000000',nowMs},{env:{JENIOS_R78_APPROVAL_SIGNING_SECRET:key}}),/R78_SIGNER_UNAVAILABLE/);
});
test('R78 rejects expiration, future and unsupported live fields before claiming',async()=>{
 const proof=newApproval();
 assert.throws(()=>verifyR78Approval(proof,{...scope,nowMs:nowMs+300000,env}),/R78_APPROVAL_INVALID/);
 assert.throws(()=>verifyR78Approval(proof,{...scope,nowMs:nowMs-1,env}),/R78_APPROVAL_INVALID/);
 const live={...proof,record:{...proof.record,liveAccount:true}};
 assert.throws(()=>verifyR78Approval(live,{...scope,nowMs,env}),/R78_APPROVAL_INVALID/);
});
test('R78 refuses a missing durable store, zero returns and network/database errors',async()=>{
 const proof=newApproval();
 await assert.rejects(claimR78Approval(proof,scope,{env,nowMs}),/R78_DURABLE_CLAIM_REQUIRED/);
 await assert.rejects(claimR78Approval(proof,scope,{env,nowMs,store:{claimOnce:async()=>false}}),/R78_APPROVAL_USED_OR_REVOKED/);
 await assert.rejects(claimR78Approval(proof,scope,{env,nowMs,store:{claimOnce:async()=>{throw Error('db secret')}}}),/R78_DURABLE_CLAIM_UNAVAILABLE/);
});
test('R78 only one claimant can succeed in a durable atomic claim (simulated store)',async()=>{
 const proof=newApproval();const claims=new Set();
 const store={async claimOnce(key){if(claims.has(key.nonce))return false;claims.add(key.nonce);return true;}};
 const results=await Promise.allSettled([claimR78Approval(proof,scope,{env,nowMs,store}),claimR78Approval(proof,scope,{env,nowMs,store})]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.equal(results[0].value.canTradeLive,false);
});
