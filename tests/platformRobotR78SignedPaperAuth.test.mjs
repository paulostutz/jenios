import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import {units} from '../lib/platform/pilot-prep/contracts.mjs';
import {canonicalR78PaperPermit,verifyR78PaperPermit,submitSignedR78PaperOnce} from '../lib/platform/connections/paper-signed-authorization-r78.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const user='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7',connection='50b85e9d-339c-4d32-b2bf-82c467673832';
const now=1793091600000;
const env={VERCEL_ENV:'preview',JENIOS_PRIVATE_PAPER_REHEARSAL:'true',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true',JENIOS_PRIVATE_PAPER_EXECUTOR:'true',
 JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_R78_PAPER_APPROVAL_VERIFY_KEY:publicKey.export({format:'der',type:'spki'}).toString('base64')};
const permit={schema:'JENIOS_R78_SIGNED_PAPER_PERMIT_V1',
 approvalId:'4528a72f-c988-45cc-a9f3-7a28d98b40ac',
 ownerUserId:user,connectionId:connection,accountDigest:'a'.repeat(64),
 clientOrderId:'jenios-order-r78-1',mode:'direct',side:'buy',
 symbol:'AAPL',maxNotionalUnits:units('150').toString(),
 issuedAtMs:now-10000,expiresAtMs:now+120000,environment:'paper'};
const signature=p=>sign(null,Buffer.from(canonicalR78PaperPermit(p)),privateKey).toString('base64');
const session={userId:user,authenticated:true,diagnosticCompleted:true};
const storedConnection={id:connection,user_id:user,provider:'alpaca',environment:'paper',
 status:'active',revoked:false,external_digest:permit.accountDigest};
const order={clientOrderId:permit.clientOrderId,mode:'direct',side:'buy',
 symbol:'AAPL',quantity:'1',entry:'100',stop:'98',target:'104'};
const validated=p=>({permit:p,signature:signature(p),session,storedConnection,order,nowMs:now});
const authRecord=p=>({approvalId:p.approvalId,ownerUserId:p.ownerUserId,
 connectionId:p.connectionId,clientOrderId:p.clientOrderId,
 permitSha256:verifyR78PaperPermit(validated(p),{env}).permitSha256,
 expiresAtMs:p.expiresAtMs,status:'APPROVED',revokedAt:null,usedAt:null,
 source:'PLATFORM_AUTH_SERVER_VERIFIED'});
test('R78 signs exact field order and validates cryptography, owner, consent and notional',()=>{
 const proof=verifyR78PaperPermit(validated(permit),{env});
 assert.equal(proof.paperOnly,true);
 assert.equal(proof.liveExecution,false);
 assert.equal(proof.notionalVerified,true);
 assert.equal(proof.ownerUserId,user);
 assert.match(proof.permitSha256,/^[a-f0-9]{64}$/);
 assert.equal(canonicalR78PaperPermit({...permit}),canonicalR78PaperPermit(Object.fromEntries(Object.entries(permit).reverse())));
});
test('R78 rejects tampered owner/connection/mode/order/ceiling with original signature',()=>{
 for(const patch of [
 {ownerUserId:'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496'},
 {connectionId:'648c5d22-94c7-408d-a3a2-44fca3fb46cd'},
 {mode:'reverse'},{clientOrderId:'different-order'}, {symbol:'MSFT'},
 {accountDigest:'b'.repeat(64)},{maxNotionalUnits:units('300').toString()}
 ]){
  assert.throws(()=>verifyR78PaperPermit({...validated(permit),permit:{...permit,...patch}},{env}));
 }
});
test('R78 denies raw JSON consent without valid signature or configured Ed25519 key',()=>{
 assert.throws(()=>verifyR78PaperPermit({...validated(permit),signature:''},{env}));
 assert.throws(()=>verifyR78PaperPermit(validated(permit),{env:{...env,JENIOS_R78_PAPER_APPROVAL_VERIFY_KEY:undefined}}));
 assert.throws(()=>verifyR78PaperPermit(validated(permit),{env:{...env,VERCEL_ENV:'production'}}));
 assert.throws(()=>verifyR78PaperPermit(validated(permit),{env:{...env,JENIOS_REAL_EXECUTION_ENABLED:'true'}}));
});
test('R78 rejects expired/future/overlong signatures and wrong order identity',()=>{
 assert.throws(()=>verifyR78PaperPermit({...validated(permit),nowMs:permit.expiresAtMs},{env}));
 assert.throws(()=>verifyR78PaperPermit({...validated(permit),nowMs:permit.issuedAtMs-10000},{env}));
 assert.throws(()=>verifyR78PaperPermit({...validated(permit),order:{...order,side:'sell'}},{env}));
 assert.throws(()=>canonicalR78PaperPermit({...permit,expiresAtMs:permit.issuedAtMs+600000}));
 assert.throws(()=>canonicalR78PaperPermit({...permit,unauthorizedFlag:true}));
 assert.throws(()=>verifyR78PaperPermit({...validated(permit),order:{...order,quantity:'2'}},{env}),/R78_NOTIONAL_EXCEEDS_CONSENT/);
});
test('R78 refuses all Paper submits without a server-owned durable record',async()=>{
 let submits=0,reads=0;
 const fake=async()=>{submits++;return {paperOnly:true,liveExecution:false,autoResubmitAllowed:false,state:'ACK'};};
 const req={...validated(permit)};
 await assert.rejects(submitSignedR78PaperOnce(req,{env,paperExecutor:fake}),/R78_DURABLE_CONSENT_REQUIRED/);
 for(const state of ['REVOKED','PENDING','APPROVED']){
  const approvalStore={async findApprovedById(){reads++;return {...authRecord(permit),status:state,
   ...(state==='APPROVED'?{permitSha256:'f'.repeat(64)}:{})};}};
  await assert.rejects(submitSignedR78PaperOnce(req,{env,approvalStore,paperExecutor:fake}),/R78_DURABLE_CONSENT_MISMATCH/);
 }
 assert.equal(submits,0);assert.equal(reads,3);
});
test('R78 durable server record + valid Ed25519 permit delegates one approved Paper attempt',async()=>{
 let reads=0,posts=0;
 const approvalStore={async findApprovedById(id,owner){
  reads++;assert.equal(id,permit.approvalId);assert.equal(owner,user);
  return authRecord(permit);
 }};
 const paperExecutor=async(req)=>{
  posts++;assert.equal(req.approval.consent,'PAPER_TEST_ONLY');
  assert.equal(req.approval.maxNotionalUnits,permit.maxNotionalUnits);
  assert.equal(req.approval.authorizedBy,user);
  return {paperOnly:true,liveExecution:false,autoResubmitAllowed:false,state:'ACK',postAttempted:true};
 };
 const outcome=await submitSignedR78PaperOnce({...validated(permit)},
  {approvalStore,env,paperExecutor,ledger:{}});
 assert.equal(reads,1);assert.equal(posts,1);
 assert.equal(outcome.signedOwnerConsentVerified,true);
 assert.equal(outcome.state,'ACK');
});
test('R78 does not allow forged receipts or database errors to claim approval',async()=>{
 const approvalStore={async findApprovedById(){return authRecord(permit);}};
 await assert.rejects(submitSignedR78PaperOnce(validated(permit),{env,approvalStore,
  paperExecutor:async()=>({liveExecution:true,paperOnly:true,autoResubmitAllowed:false})}),/R78_INVALID_PAPER_RECEIPT/);
 await assert.rejects(submitSignedR78PaperOnce(validated(permit),{env,
  approvalStore:{async findApprovedById(){throw Error('user data secret')}}}),/R78_DURABLE_CONSENT_UNAVAILABLE/);
});
test('R78 is private: no HTTP routes, credentials, orders Live or withdrawal paths',()=>{
 const text=readFileSync(new URL('../lib/platform/connections/paper-signed-authorization-r78.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(text,/api\\.alpaca\\.markets|\\/v2\\/withdrawals|\\/v2\\/positions\\/close|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(text,/submitAlpacaPaperOnce/);
 assert.match(text,/Ed25519|ed25519/);
 assert.match(text,/R78_DURABLE_CONSENT_REQUIRED/);
});
