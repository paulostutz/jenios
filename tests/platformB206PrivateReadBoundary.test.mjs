import test from 'node:test';
import assert from 'node:assert/strict';
import {assertIsolatedReadWorker,issuePrivatePaperReadGrant,verifyPrivatePaperReadGrant,
 createOfficialPaperGetBoundary} from '../lib/platform/connections/b206-private-read-boundary.mjs';
const userId='4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7';
const connectionId='50b85e9d-339c-4d32-b2bf-82c467673832',now=1792526000000;
export const env={JENIOS_DEMO_VAULT_KEY_B64:Buffer.alloc(32,8).toString('base64'),
 JENIOS_PAPER_OBSERVER_KEY_B64:Buffer.alloc(32,9).toString('base64'),
 JENIOS_PRIVATE_PAPER_REHEARSAL:'true',JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'true',
 JENIOS_PRIVATE_PAPER_READ_OBSERVER:'true',JENIOS_PRIVATE_PAPER_OBSERVER_WORKER:'true',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false'};
export const payload={v:1,kind:'ALPACA_PAPER_READ_ONLY',operatorApproval:'PRIVATE_MANUAL_READ_APPROVED',
 userId,connectionId,clientOrderId:'demo-order-1',auditId:'audit-1',accountDigest:'a'.repeat(64),
 issuedAtMs:now-1000,expiresAtMs:now+60000};
const fail=(fn,code)=>assert.throws(fn,e=>e?.code===code);
test('B206 allows isolated GET-only mode and never authorizes broker order submission',()=>{
 const result=assertIsolatedReadWorker(env);
 assert.equal(result.method,'GET');assert.equal(result.externalPaperOrderSubmission,false);
 assert.equal(result.liveTrading,false);assert.equal(result.automaticRetry,false);
});
test('B206 refuses Vercel preview/prod, dangerous transport flags and missing secrets',()=>{
 for(const patch of [{VERCEL:'1'},{VERCEL_ENV:'preview'},{VERCEL_ENV:'production'},
  {JENIOS_PRIVATE_PAPER_EXECUTOR:'true'},{JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'true'},
  {JENIOS_REAL_EXECUTION_ENABLED:'true'},{JENIOS_PRIVATE_PAPER_OBSERVER_WORKER:'false'},
  {JENIOS_PRIVATE_PAPER_ACCOUNT_PREFLIGHT:'false'},{JENIOS_DEMO_VAULT_KEY_B64:'invalid'}])
  fail(()=>assertIsolatedReadWorker({...env,...patch}),'PRIVATE_GET_ONLY_WORKER_DISABLED');
 fail(()=>assertIsolatedReadWorker({...env,JENIOS_PAPER_OBSERVER_KEY_B64:'invalid'}),'OBSERVER_SIGNING_KEY_REQUIRED');
});
test('B206 short-lived HMAC does not authorize execution, grants only exactly one scope',()=>{
 const grant=issuePrivatePaperReadGrant(payload,{env});
 const result=verifyPrivatePaperReadGrant(grant,payload,{env,nowMs:now});
 assert.equal(result.readOnlyGranted,true);assert.equal(result.externalOrderAuthorized,false);
 assert.equal(result.independentBrokerWitnessCertified,false);
 for(const k of ['userId','connectionId','clientOrderId','auditId','accountDigest'])
  fail(()=>verifyPrivatePaperReadGrant(grant,{...payload,[k]:k==='accountDigest'?'b'.repeat(64):'different'},
   {env,nowMs:now}),'READ_GRANT_CROSS_ACCOUNT');
});
test('B206 tampering, expiry, forged extra scopes and missing operator review fail closed',()=>{
 const grant=issuePrivatePaperReadGrant(payload,{env});
 fail(()=>verifyPrivatePaperReadGrant({...grant,hmacSha256:'b'.repeat(64)},payload,{env,nowMs:now}),
  'READ_GRANT_SIGNATURE_INVALID');
 fail(()=>verifyPrivatePaperReadGrant(grant,payload,{env,nowMs:payload.expiresAtMs}),'READ_GRANT_EXPIRED');
 fail(()=>issuePrivatePaperReadGrant({...payload,operation:'trade'},{env}),'READ_GRANT_SCOPE_INVALID');
 fail(()=>issuePrivatePaperReadGrant({...payload,operatorApproval:'yes'},{env}),'READ_GRANT_SCOPE_INVALID');
 fail(()=>issuePrivatePaperReadGrant({...payload,expiresAtMs:now+500000},{env}),'READ_GRANT_SCOPE_INVALID');
});
test('B206 GET allowlist includes only the official Alpaca Paper reads already used by B166/B201',async()=>{
 const calls=[];const read=createOfficialPaperGetBoundary(async(u,o)=>{calls.push([u,o.method]);return Response.json({ok:true});});
 for(const url of ['https://paper-api.alpaca.markets/v2/account',
  'https://paper-api.alpaca.markets/v2/positions',
  'https://paper-api.alpaca.markets/v2/orders?status=open&limit=500',
  'https://paper-api.alpaca.markets/v2/orders:by_client_order_id?client_order_id=abc']){
  await read(url,{method:'GET',redirect:'error',cache:'no-store'});
 }
 assert.equal(read.count,4);assert.equal(calls.length,4);
});
test('B206 refuses arbitrary hosts, Live, POST, DELETE, redirects, transfers and duplicate params',async()=>{
 let attempted=0;const fetcher=async()=>{attempted++;return Response.json({});};
 const read=createOfficialPaperGetBoundary(fetcher);
 const scope={method:'GET',redirect:'error',cache:'no-store'};
 const cases=[['https://api.alpaca.markets/v2/account',scope],
  ['https://paper-api.alpaca.markets/v2/orders',{...scope,method:'POST'}],
  ['https://paper-api.alpaca.markets/v2/account',{...scope,redirect:'follow'}],
  ['http://paper-api.alpaca.markets/v2/account',scope],
  ['https://evil.example/v2/account',scope],
  ['https://paper-api.alpaca.markets/v2/account%2fwithdraw',scope],
  ['https://paper-api.alpaca.markets/v2/orders:by_client_order_id?client_order_id=a&client_order_id=b',scope],
  ['https://paper-api.alpaca.markets/v2/orders?status=closed&limit=500',scope],
  ['https://paper-api.alpaca.markets/v2/positions/ABC',scope],
  ['https://paper-api.alpaca.markets/v2/orders/123/cancel',scope]];
 for(const [url,options] of cases)await assert.rejects(read(url,options));
 assert.equal(attempted,0);
});
test('B206 imposes finite read budget, sanitizes upstream exceptions and never retries',async()=>{
 let calls=0;
 const read=createOfficialPaperGetBoundary(async()=>{calls++;return Response.json({});},{maxCalls:1});
 const url='https://paper-api.alpaca.markets/v2/account',scope={method:'GET',redirect:'error',cache:'no-store'};
 await read(url,scope);
 await assert.rejects(read(url,scope),/PAPER_READ_BUDGET_EXCEEDED/);
 assert.equal(calls,1);
 const broken=createOfficialPaperGetBoundary(async()=>{throw Error('apiKey SECRET MUST NEVER APPEAR')});
 await assert.rejects(broken(url,scope),e=>e.code==='PAPER_OFFICIAL_GET_FAILED'&&
  !e.message.includes('SECRET'));
});
