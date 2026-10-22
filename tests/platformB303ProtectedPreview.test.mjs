import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
import {inspectB303PreviewReadiness,b303BrokerPreflightHttp,B303_QA_BRANCH,B303_QA_PROJECT}
 from '../lib/platform/connections/b303-private-preview-readiness.mjs';
const stage='https://rebzztxlzofxpfwjvbee.supabase.co';
const platform='https://xaicvhagftzjkqphnbgx.supabase.co';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:B303_QA_BRANCH,
 VERCEL_PROJECT_ID:B303_QA_PROJECT,NEXT_PUBLIC_SUPABASE_URL:stage,
 SOCIAL_SUPABASE_URL:stage,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public_qa_stub_key',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:platform,
 NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'public_platform_qa_stub_key',
 PLATFORM_SUPABASE_URL:platform,
 JENIOS_B303_READONLY_ENABLED:'true',JENIOS_QA_CANDIDATE_ENABLED:'true',
 JENIOS_QA_ADMIN_READONLY_ENABLED:'true',NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED:'false',
 NEXT_PUBLIC_JENIOS_DEMO_CONNECTORS_UI:'false',JENIOS_DEMO_CONNECTORS_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
 JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PAY_PAYMENTS_ENABLED:'false'};
const request=new Request('https://private-preview.invalid/api/platform/homologacao/b303-broker-preflight',
 {headers:{authorization:'Bearer qa-admin-token'}});

test('B303 exact branch QA preview scope allowed without authorizing trading',()=>{
 const a=checkS05DeploymentScope(env);assert.deepEqual(a,{ok:true,mode:'preview-b303-protected-readonly'});
 const b=inspectB303PreviewReadiness(env);
 assert.equal(b.previewBranchValidated,true);assert.equal(b.demoConnectorEnabled,false);
 assert.equal(b.platformServerAdminConfigurationPresent,false);
 assert.equal(b.brokerAccountOwnershipVerified,false);
 assert.equal(b.actualBrokerRealizedPnl,null);assert.equal(b.ordersSent,0);
 assert.equal(b.chargesCreated,0);assert.match(b.releaseStatus,/NO_GO/);
});
test('B303 refuses any other preview branch, missing QA config or wrong Vercel project',()=>{
 const variants=[{VERCEL_GIT_COMMIT_REF:'fix/other'},{NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://prod.invalid'},
  {PLATFORM_SUPABASE_URL:'https://prod.invalid'},{VERCEL_PROJECT_ID:'prj_wrong'},
  {NEXT_PUBLIC_SUPABASE_URL:'https://prod.invalid'},
  {JENIOS_B303_READONLY_ENABLED:'false'}, {JENIOS_QA_CANDIDATE_ENABLED:'false'}];
 for(const patch of variants){const x=checkS05DeploymentScope({...env,...patch});assert.equal(x.ok,false,JSON.stringify(patch));}
});
test('B303 denies real/Paper order transport, payment, signups and connector premature enablement',()=>{
 for(const key of ['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
 'JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PAY_PAYMENTS_ENABLED',
 'JENIOS_DEMO_CONNECTORS_ENABLED','NEXT_PUBLIC_JENIOS_DEMO_CONNECTORS_UI',
 'NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED']){
  assert.equal(checkS05DeploymentScope({...env,[key]:'true'}).ok,false,key);
 }
});
test('B303 never changes the production release constraints',()=>{
 for(const patch of [{VERCEL_ENV:'production'},
  {VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:B303_QA_BRANCH}]){
  const a=checkS05DeploymentScope({...env,...patch});assert.equal(a.ok,false);
 }
});
test('B303 preflight 404 before touching DB except exact gated preview',async()=>{
 let calls=0;
 const d={createDb:()=>{calls++;return {};},authorize:async()=>{calls++;return {};}};
 for(const patch of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'fix/other'},
  {JENIOS_B303_READONLY_ENABLED:'false'}]){
  const response=await b303BrokerPreflightHttp(request,{...d,env:{...env,...patch}});
  assert.equal(response.status,404);assert.equal(response.headers.get('cache-control')?.includes('no-store'),true);
 }
 assert.equal(calls,0);
});
test('B303 requires GET and dedicated administrator, no tokens or account identifiers',async()=>{
 const method=await b303BrokerPreflightHttp(new Request(request.url,{method:'POST'}),{env});
 assert.equal(method.status,405);
 const ok=await b303BrokerPreflightHttp(request,{env,createDb:()=>({dedicatedPlatform:true}),
  authorize:async(_r,db,permission)=>{
   assert.equal(db.dedicatedPlatform,true);assert.equal(permission,'platform.admin');
   return {user:{id:'private-user-not-for-output'},permissions:['platform.admin']};
  }});
 assert.equal(ok.status,200);const body=await ok.json();
 assert.equal(body.providerGetPerformedByModule,false);
 assert.equal(body.alpacaPaperConnected,false);
 const json=JSON.stringify(body);
 assert.ok(!json.includes('private-user-not-for-output'));assert.ok(!json.includes('qa-admin-token'));
 assert.equal(body.ordersSent,0);
});
test('B303 rejects missing permission, unauthorized session, unavailable backend without leaks',async()=>{
 const db=()=>({});
 const forbidden=await b303BrokerPreflightHttp(request,{env,createDb:db,
  authorize:async()=>({user:{id:'x'},permissions:['platform.reports']})});
 assert.equal(forbidden.status,403);
 const unauth=await b303BrokerPreflightHttp(request,{env,createDb:db,
  authorize:async()=>{throw {status:401,message:'private token'};}});
 assert.equal(unauth.status,401);
 const fail=await b303BrokerPreflightHttp(request,{env,createDb:()=>{throw Error('secret key error');},
  authorize:async()=>{}});
 assert.equal(fail.status,503);assert.ok(!JSON.stringify(await fail.json()).includes('secret'));
});
test('B303 route uses dedicated Platform auth, never Social or JENIOS Pay',()=>{
 const route=readFileSync(new URL('../app/api/platform/homologacao/b303-broker-preflight/route.js',import.meta.url),'utf8');
 assert.match(route,/requirePlatformAdmin/);assert.match(route,/getJeniosPlatformAdmin/);
 assert.doesNotMatch(route,/Social|Pay|checkout|POST/);
 const gate=readFileSync(new URL('../lib/platform/connections/b303-private-preview-readiness.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(gate,/fetch\(|\.insert\(|\.update\(|orders:submit|createOrder\(/);
});
test('B303 preview is blocked on all linked projects except manual protected QA',()=>{
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 assert.equal(config.git.deploymentEnabled[B303_QA_BRANCH],false);
 assert.match(config.ignoreCommand,/b303-protected-readonly-preview-20261021/);
});