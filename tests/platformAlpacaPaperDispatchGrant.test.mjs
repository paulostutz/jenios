import test from 'node:test';import assert from 'node:assert/strict';
import {issuePaperGrant,verifyPaperGrant,assertPrivatePaperRuntime} from '../lib/platform/connections/alpaca-paper-dispatch-grant.mjs';
const env={JENIOS_PRIVATE_PAPER_EXECUTOR:'true',JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true',JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PAPER_WORKER_SIGNING_KEY_B64:Buffer.alloc(32,18).toString('base64')};
const p={v:1,userId:'4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',connectionId:'50b85e9d-339c-4d32-b2bf-82c467673832',accountDigest:'a'.repeat(64),clientOrderId:'paper-qa-1',orderBodyDigest:'b'.repeat(64),mode:'direct',
 issuedAtMs:1792526000000,expiresAtMs:1792526070000,customerPaperConsent:'verified_in_private_worker',brokerPermissions:'independently_audited_for_paper',bracketReview:'independently_reviewed',operatorReview:'human_paper_qa_authorized',evidenceDigest:'c'.repeat(64)};
const expected=Object.fromEntries(['userId','connectionId','accountDigest','clientOrderId','orderBodyDigest','mode'].map(k=>[k,p[k]]));
test('B179 signed PAPER technical attestation limited by owner, connection, payload and time',()=>{
 const g=issuePaperGrant(p,{env});assert.equal(verifyPaperGrant(g,expected,{env,nowMs:p.issuedAtMs+3}).technicallySigned,true);
 assert.throws(()=>verifyPaperGrant(g,{...expected,userId:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'},{env,nowMs:p.issuedAtMs+3}),/PAPER_GRANT_CROSS_SCOPE/);
 assert.throws(()=>verifyPaperGrant(g,expected,{env,nowMs:p.expiresAtMs}),/PAPER_GRANT_EXPIRED/);
 assert.throws(()=>verifyPaperGrant({...g,payload:{...g.payload,orderBodyDigest:'d'.repeat(64)}},expected,{env,nowMs:p.issuedAtMs+3}),/SIGNATURE_INVALID/);
});
test('B179 refuses arbitrary browser truth flags and unreviewed paper order',()=>{
 assert.throws(()=>issuePaperGrant({...p,brokerPermissions:true},{env}),/PAPER_APPROVAL_INCOMPLETE/);
 assert.throws(()=>issuePaperGrant({...p,bracketReview:'unverified'},{env}),/PAPER_APPROVAL_INCOMPLETE/);
 assert.throws(()=>issuePaperGrant({...p,operatorReview:false},{env}),/PAPER_APPROVAL_INCOMPLETE/);
 assert.throws(()=>issuePaperGrant({...p,expiresAtMs:p.issuedAtMs+300000},{env}),/PAPER_GRANT_INVALID_TIME/);
});
test('B179 never allows cloud/Vercel or real money even if private flags exist',()=>{
 for(const k of [{VERCEL:'1'},{VERCEL_ENV:'production'},{VERCEL_ENV:'preview'},{JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false'},{JENIOS_PAPER_WORKER_SIGNING_KEY_B64:''}])
  assert.throws(()=>assertPrivatePaperRuntime({...env,...k}),/PRIVATE_PAPER_TRANSPORT_DISABLED|PAPER_GRANT_KEY_MISSING/);
});
