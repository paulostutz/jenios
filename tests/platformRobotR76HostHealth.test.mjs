import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createR76HostHealthHandler,projectR76HostHealth} from '../lib/platform/research/robot-r76-host-health.mjs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
const moment=Date.parse('2026-10-27T10:00:00Z');
const owner={id:'8d30c540-449d-4d91-8502-2aec4bdfe6c1',app_metadata:{platform_role:'admin'}};
const closed=['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_ROBOT_ANALYST_PAID_ENABLED'];
const prod={VERCEL_ENV:'production',VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
 VERCEL_GIT_COMMIT_REF:'release/jenios-genios-g44-20261024',JENIOS_ROBOT_R73_ADMIN_ENABLED:'true',
 PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 ...Object.fromEntries(closed.map(k=>[k,'false']))};
const current={status:'READY',last_heartbeat_at:'2026-10-27T09:59:00Z',
 last_cycle_at:'2026-10-27T09:59:00Z',last_error_code:null,real_orders_sent:0,external_paper_orders_sent:0,
 customer_monitoring_active:false,live_execution_enabled:false};
const request=(path='',method='GET',auth=true)=>new Request('https://jenios.test/api/platform/admin/robots/host-health'+path,{
 method,headers:auth?{authorization:'Bearer private-session'}:{}});
function fakeDb({row=current,user=owner,error=null}={}){
 const reads=[];return {reads,db:{
  auth:{async getUser(){return {data:{user},error:null}}},
  from(table){reads.push(table);
   if(table==='jenios_platform_admin_permissions')return {select(columns){assert.equal(columns,'permission');return this;},
    async eq(field,value){assert.equal(field,'user_id');assert.equal(value,user.id);return {data:[],error:null};}};
   assert.equal(table,'jenios_robot_private_hosts_r74');
   return {select(fields){assert.equal(fields,'status,last_heartbeat_at,last_cycle_at,last_error_code,real_orders_sent,external_paper_orders_sent,customer_monitoring_active,live_execution_enabled');return this;},
    order(field,options){assert.equal(field,'last_heartbeat_at');assert.deepEqual(options,{ascending:false});return this;},
    async limit(n){assert.equal(n,1);return {data:row?[row]:[],error};}};
  }
 }};
}
test('R76 unauthenticated, URL query and mutation never create privileged DB connection',async()=>{
 let calls=0;const h=createR76HostHealthHandler({env:prod,now:()=>moment,getDb(){calls++;throw Error('DB_MUST_NOT_OPEN')}});
 assert.equal((await h(request('','GET',false))).status,401);
 assert.equal((await h(request('?user=other'))).status,400);
 assert.equal((await h(request('','POST'))).status,405);
 assert.equal(calls,0);
});
test('R76 rejects wrong project, branch and enabled live execution before reading DB',async()=>{
 for(const patch of [{JENIOS_ROBOT_R73_ADMIN_ENABLED:'false'},{JENIOS_REAL_EXECUTION_ENABLED:'true'},
  {VERCEL_GIT_COMMIT_REF:'main'},{PLATFORM_SUPABASE_URL:'https://wrong.invalid'}]){
  const h=createR76HostHealthHandler({env:{...prod,...patch},getDb(){assert.fail('Opened privileged DB')}});
  assert.equal((await h(request())).status,404);
 }
});
test('R76 admin sees the actual host heartbeat without secrets or certified trades',async()=>{
 const {db,reads}=fakeDb(),h=createR76HostHealthHandler({env:prod,getDb:()=>db,now:()=>moment});
 const res=await h(request());assert.equal(res.status,200);
 assert.match(res.headers.get('cache-control'),/no-store/);assert.equal(res.headers.get('vary'),'Authorization');
 const body=await res.json();
 assert.equal(body.host.state,'SYNTHETIC_ACTIVE');
 assert.equal(body.host.heartbeatAgeSeconds,60);
 assert.equal(body.host.realOrdersSent,0);assert.equal(body.host.paperOrdersSent,0);
 assert.equal(body.canPlaceOrders,false);assert.equal(body.executionCertified,false);
 assert.equal(body.brokerAccountVerified,false);assert.equal(body.ownerFundsCustodied,false);
 assert.deepEqual(reads,['jenios_robot_private_hosts_r74']);
 const payload=JSON.stringify(body);
 for(const secret of ['private-session','engine_sha256','source_public_key_spki_b64','host_id','service_role','external_digest'])
  assert.ok(!payload.includes(secret),secret);
});
test('R76 user without Platform admin has no access to private host rows',async()=>{
 const {db,reads}=fakeDb({user:{id:owner.id,app_metadata:{}}});
 const h=createR76HostHealthHandler({env:prod,getDb:()=>db,now:()=>moment});
 assert.equal((await h(request())).status,403);
 assert.deepEqual(reads,['jenios_platform_admin_permissions']);
});
test('R76 stale, degraded, unexpected live flags and missing hosts never appear active',()=>{
 assert.equal(projectR76HostHealth({...current,last_heartbeat_at:'2026-10-27T09:45:00Z'},{now:moment}).state,'STALE');
 assert.equal(projectR76HostHealth({...current,last_cycle_at:'2026-10-27T09:45:00Z'},{now:moment}).state,'STALE');
 assert.equal(projectR76HostHealth({...current,last_cycle_at:null},{now:moment}).state,'UNVERIFIED');
 assert.equal(projectR76HostHealth({...current,status:'DEGRADED'},{now:moment}).state,'DEGRADED');
 assert.equal(projectR76HostHealth({...current,last_heartbeat_at:'2026-10-27T10:01:00Z'},{now:moment}).state,'UNVERIFIED');
 assert.equal(projectR76HostHealth({...current,live_execution_enabled:true},{now:moment}).state,'UNVERIFIED');
 assert.equal(projectR76HostHealth({...current,real_orders_sent:1},{now:moment}).configurationAlert,true);
 assert.equal(projectR76HostHealth(null,{now:moment}).state,'NOT_CONFIGURED');
});
test('R76 database errors fail closed without relaying internal broker or account details',async()=>{
 const {db}=fakeDb({error:{message:'internal secret or account'}});
 const h=createR76HostHealthHandler({env:prod,getDb:()=>db,now:()=>moment});
 const res=await h(request());assert.equal(res.status,503);
 assert.doesNotMatch(await res.text(),/internal secret or account/);
});
test('R76 source UI has read-only route, account switch handling and no keys',()=>{
 const api=readFileSync(new URL('../app/api/platform/admin/robots/host-health/route.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../app/components/platform/PlatformRobotHostHealth.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../app/platform/admin/robos/page.js',import.meta.url),'utf8');
 assert.match(api,/export const GET=/);assert.doesNotMatch(api,/export const (POST|PUT|DELETE|PATCH)/);
 assert.match(page,/PlatformRobotHostHealth/);
 assert.match(ui,/platformSupabase/);assert.match(ui,/onAuthStateChange/);
 assert.doesNotMatch(ui,/SUPABASE_SERVICE_ROLE_KEY|api_secret|submitNativeBrokerOrder/);
});
test('R76 preview branch requires same twenty external actions disabled as R75',()=>{
 const blocked=['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_ROBOT_ANALYST_PAID_ENABLED','JENIOS_ROBOT_R73_ADMIN_ENABLED','JENIOS_PAY_PAYMENTS_ENABLED',
  'JENIOS_PRO_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED','JENIOS_EMAIL_PRODUCTION_ENABLED',
  'JENIOS_EMAIL_DISPATCHER_ENABLED','JENIOS_PAYMENT_EMAILS_ENABLED','JENIOS_TRANSACTIONAL_EMAILS_ENABLED',
  'JENIOS_MARKETING_EMAILS_ENABLED','JENIOS_MARKETING_PLANNER_ENABLED','JENIOS_SUBSCRIPTION_DUNNING_ENABLED',
  'JENIOS_RESEND_WEBHOOK_ENABLED','JENIOS_PRO_GENERATION_ENABLED','JENIOS_SALES_GENERATIVE_ENABLED',
  'JENIOS_ASSISTANT_MEMORY_ENABLED','NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED'];
 const safe={VERCEL_ENV:'preview',VERCEL_PROJECT_ID:prod.VERCEL_PROJECT_ID,
  VERCEL_GIT_COMMIT_REF:'fix/jenios-r76-host-health-20261027',
  NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-public',
  PLATFORM_SUPABASE_URL:prod.PLATFORM_SUPABASE_URL,
  NEXT_PUBLIC_PLATFORM_SUPABASE_URL:prod.PLATFORM_SUPABASE_URL,
  NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'test-public',
  ...Object.fromEntries(blocked.map(k=>[k,'false']))};
 assert.deepEqual(checkS05DeploymentScope(safe),{ok:true,mode:'preview-isolated-robot-r75'});
 for(const key of blocked)
  assert.deepEqual(checkS05DeploymentScope({...safe,[key]:'true'}),{ok:false,reason:'R75_PREVIEW_EXTERNAL_ACTIONS_MUST_BE_DISABLED'});
});
