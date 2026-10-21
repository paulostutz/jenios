import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectReleaseCiReceipt} from '../lib/platform/release260/b251-ci-receipt.mjs';
import {privateReadinessHttp} from '../lib/platform/release260/b252-private-review-http.mjs';
import {reviewPreviewHttpEvidence} from '../lib/platform/release260/b253-preview-acceptance.mjs';
const sha='a'.repeat(40),base='b'.repeat(40);
const run={id:123,head_sha:sha,status:'completed',conclusion:'success',event:'push'};
const req=new Request('https://preview.example/api/platform/homologacao/readiness',{headers:{authorization:'Bearer qa-token'}});
const env={VERCEL_ENV:'preview',JENIOS_QA_CANDIDATE_ENABLED:'true',JENIOS_QA_ADMIN_READONLY_ENABLED:'true'};
test('B251 matching CI record remains a human-reviewed claim, not automatic release',()=>{
 const v=inspectReleaseCiReceipt({expectedSha:sha,baseSha:base,workflow:run});
 assert.equal(v.checksReportedPassing,true);assert.equal(v.productionPromotionAuthorized,false);
 assert.equal(v.independentlyIssuerAuthenticated,false);
});
test('B251 wrong head, failed run or event never becomes proof',()=>{
 for(const patch of [{head_sha:base},{conclusion:'failure'},{event:'pull_request'},{status:'queued'}]){
  const v=inspectReleaseCiReceipt({expectedSha:sha,baseSha:base,workflow:{...run,...patch}});
  assert.equal(v.checksReportedPassing,false);
 }
 assert.throws(()=>inspectReleaseCiReceipt({expectedSha:sha,baseSha:sha,workflow:run}),/INVALID_CI_RECORD/);
});
test('B252 production or disabled QA gate returns 404 before accessing DB',async()=>{
 let calls=0;
 const injected={createDb:()=>{calls++;return {};},authorize:async()=>{calls++;}};
 for(const patch of [{VERCEL_ENV:'production'},{JENIOS_QA_ADMIN_READONLY_ENABLED:'false'},{JENIOS_QA_CANDIDATE_ENABLED:'false'}]){
  const r=await privateReadinessHttp(req,{...injected,env:{...env,...patch}});assert.equal(r.status,404);
  assert.equal(r.headers.get('cache-control')?.includes('no-store'),true);
 }
 assert.equal(calls,0);
});
test('B252 role checked against Platform admin and independent auth',async()=>{
 const injected={env,createDb:()=>({dedicatedPlatformDb:true}),
  authorize:async(_req,db,perm)=>{assert.equal(db.dedicatedPlatformDb,true);assert.equal(perm,'platform.admin');
    return {user:{id:'server-only-id'},permissions:['platform.admin']};}};
 const resp=await privateReadinessHttp(req,injected);assert.equal(resp.status,200);
 const body=await resp.json();assert.equal(body.productionPromotionAuthorized,false);
 assert.equal(body.ordersSent,0);assert.equal(JSON.stringify(body).includes('server-only-id'),false);
});
test('B252 without admin or with revoked token fails with sanitized status',async()=>{
 const deps={env,createDb:()=>({}),authorize:async()=>({user:{id:'u'},permissions:['platform.reports']})};
 assert.equal((await privateReadinessHttp(req,deps)).status,403);
 assert.equal((await privateReadinessHttp(req,{...deps,authorize:async()=>{throw {status:401,message:'sensitive token'}}})).status,401);
 const response=await privateReadinessHttp(req,{...deps,authorize:async()=>{throw Error('secret db traceback')}});
 assert.equal(response.status,503);assert.equal(JSON.stringify(await response.json()).includes('secret'),false);
});
test('B252 GET only, endpoint imports dedicated admin auth not Social',async()=>{
 assert.equal((await privateReadinessHttp(new Request(req.url,{method:'POST'}),{env})).status,405);
 const src=readFileSync(new URL('../app/api/platform/homologacao/readiness/route.js',import.meta.url),'utf8');
 assert.match(src,/requirePlatformAdmin/);assert.match(src,/getJeniosPlatformAdmin/);
 assert.doesNotMatch(src,/getJeniosPayAdmin|getSocial|checkoutService/);
});
test('B253 browser evidence is informational; no claim of remote session',()=>{
 const rows=['/integracoes','/api/platform/broker-readiness','/api/platform/broker-providers']
  .map(path=>({path,status:200,cacheControl:'no-store',bodyRedacted:true}));
 const out=reviewPreviewHttpEvidence({responses:rows,previewAdminStatus:401,nowMs:1792573000000});
 assert.equal(out.expectedRoutesVerifiedLocally,true);assert.equal(out.actualUserSessionTested,false);
 assert.equal(out.productionReleaseApproved,false);
 assert.equal(reviewPreviewHttpEvidence({responses:rows.map(x=>x.path==='/integracoes'?{...x,status:500}:x),previewAdminStatus:401,nowMs:1792573000000}).expectedRoutesVerifiedLocally,false);
});
