import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {platformAdminPermissions,requirePlatformAdmin} from '../lib/platform/admin-permissions.mjs';
import {currentPlatformSession,loadAccountDiagnostic} from '../lib/platform/diagnostic-client.mjs';
import {getJeniosPlatformAdmin} from '../lib/platform/admin-db.mjs';

const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const user=(id,app_metadata={},user_metadata={})=>({id,app_metadata,user_metadata});
const db=(u,permissions=[])=>({
 auth:{async getUser(token){return token==='good'?{data:{user:u},error:null}:{data:null,error:{message:'invalid'}};}},
 from(name){
  assert.equal(name,'jenios_platform_admin_permissions');
  return {select(column){assert.equal(column,'permission');return{eq(field,id){
   assert.equal(field,'user_id');assert.equal(id,u.id);
   return Promise.resolve({data:permissions.map(permission=>({permission})),error:null});
  }};}};
 }
});
const req=token=>new Request('https://private.example/api/platform/admin/access',{headers:{authorization:'Bearer '+token}});

test('B67R1 client has no Social fallback or service_role key',()=>{
 const s=get('lib/platform/supabase-client.js');
 assert.match(s,/NEXT_PUBLIC_PLATFORM_SUPABASE_URL/);
 assert.match(s,/NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY/);
 assert.doesNotMatch(s,/process\.env\.NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(s,/storageKey:'jenios-platform-auth-v1'/);
});
test('B67R1 all four Platform surfaces use dedicated browser auth',()=>{
 for(const path of ['app/dashboard/page.js','app/dashboard-logado/page.js','app/mesa-operacoes/page.js','app/diagnostico/page.js']){
  const s=get(path);
  assert.match(s,/platformSupabase as supabase/);
  assert.doesNotMatch(s,/from ['"]\.\.\/\.\.\/lib\/supabase['"]/);
 }
});
test('B67R1 logged-in Dashboard guard cannot use Social AuthGuard',()=>{
 const s=get('app/dashboard-logado/layout.js');
 assert.match(s,/PlatformAuthGuard/);
 assert.doesNotMatch(s,/AuthGuard from ['"]\.\.\/components\/AuthGuard/);
 const g=get('app/components/platform/PlatformAuthGuard.js');
 assert.match(g,/platformSupabase\.auth\.getUser/);
 assert.match(g,/router\.replace\('\/platform\/entrar'\)/);
});
test('B67R1 public simulated trading remains accessible',()=>{
 const s=get('app/dashboard/page.js');
 assert.match(s,/tipoConta !== 'simulada'/);
 assert.match(s,/SIMULAR COMPRA/);
});
test('B67R1 separate login does not register or expose social password',()=>{
 const s=get('app/platform/entrar/page.js');
 assert.match(s,/platformSupabase\.auth\.signInWithPassword/);
 assert.doesNotMatch(s,/lib\/supabase['"]|admin123|signUp\(/);
 assert.match(s,/href="\/dashboard"/);
});
test('B67R1 Platform admin permissions never inherit Social role or user metadata',async()=>{
 const u=user('u1',{role:'admin'},{platform_role:'admin',permissions:['platform.admin']});
 assert.deepEqual(await platformAdminPermissions(db(u),u,{PLATFORM_ADMIN_USER_IDS:''}),[]);
});
test('B67R1 server-owned app metadata permits only dedicated Platform admin',async()=>{
 const u=user('a',{platform_role:'admin'});
 assert.deepEqual(await platformAdminPermissions(db(u),u,{}),['platform.admin','platform.reports']);
});
test('B67R1 allowlisted admin ID is Platform-scoped',async()=>{
 const u=user('user-a');
 assert.deepEqual(await platformAdminPermissions(db(u),u,{PLATFORM_ADMIN_USER_IDS:'user-b,user-a'}),['platform.admin','platform.reports']);
});
test('B67R1 assigned reporting role does not become administrator',async()=>{
 const u=user('a');
 assert.deepEqual(await platformAdminPermissions(db(u,['platform.reports','platform.admin']),u,{PLATFORM_ADMIN_USER_IDS:''}),['platform.reports']);
});
test('B67R1 anonymous and malicious browser claims have no permission',async()=>{
 const u=user('a',{},{});u.is_anonymous=true;
 assert.deepEqual(await platformAdminPermissions(db(u),u,{}),[]);
});
test('B67R1 missing token cannot pass admin control',async()=>{
 const u=user('a',{platform_role:'admin'});
 const request=new Request('https://qa.invalid/api/platform/admin/access');
 await assert.rejects(()=>requirePlatformAdmin(request,db(u),'platform.admin'),{status:401});
});
test('B67R1 user with wrong token cannot pass admin control',async()=>{
 const u=user('a',{platform_role:'admin'});
 await assert.rejects(()=>requirePlatformAdmin(req('bad'),db(u),'platform.admin'),{status:401});
});
test('B67R1 authenticated user cannot self-elevate to admin',async()=>{
 const u=user('a',{role:'admin'},{platform_role:'admin'});
 await assert.rejects(()=>requirePlatformAdmin(req('good'),db(u),'platform.admin'),{status:403});
});
test('B67R1 verified Platform admin passes only dedicated endpoint',async()=>{
 const u=user('a',{platform_role:'admin'});
 const result=await requirePlatformAdmin(req('good'),db(u),'platform.admin');
 assert.equal(result.user.id,'a');
});
test('B67R1 risk and diagnostic APIs require only Platform database variables',()=>{
 for(const path of ['app/api/platform/diagnostico/route.js','app/api/platform/risk-summary/route.js','app/api/platform/admin/access/route.js']){
  const s=get(path);
  assert.match(s,/getJeniosPlatformAdmin/);
  assert.doesNotMatch(s,/getJeniosPayAdmin|jenios-pay-admin/);
 }
 assert.throws(()=>getJeniosPlatformAdmin({NEXT_PUBLIC_SUPABASE_URL:'https://social.example',SUPABASE_SERVICE_ROLE_KEY:'social'}),{status:503});
});
test('B67R1 new admin home is gated by dedicated roles',()=>{
 const s=get('app/platform/admin/page.js');
 assert.match(s,/PlatformAdminAccess/);
 assert.match(s,/permission="platform.admin"/);
 assert.doesNotMatch(s,/SocialModeration|PaymentStatement|jenios-pay/);
});
test('B67R1 migration does not grant browser roles access to privileged tables',()=>{
 const s=get('supabase/migrations/20261019113500_platform_dedicated_admin_roles_cp67r1.sql');
 assert.match(s,/revoke all privileges on table public.jenios_platform_diagnostics from service_role/);
 assert.match(s,/grant select,insert on table public.jenios_platform_risk_events to service_role/);
 assert.match(s,/enable row level security/);
 assert.doesNotMatch(s,/grant .* to authenticated/);
});
test('B67R1 auth sessions are checked on dedicated instance only',async()=>{
 const supabase={auth:{async getSession(){return{data:{session:{user:{id:'platform-user'},access_token:'platformToken'}}}}}};
 const session=await currentPlatformSession(supabase);
 assert.equal(session.user.id,'platform-user');
 const res=await loadAccountDiagnostic(supabase,async(url,options)=>{
   assert.equal(url,'/api/platform/diagnostico');
   assert.equal(options.headers.authorization,'Bearer platformToken');
   return {ok:true,json:async()=>({verified:true,completed:true,mode:'manual'})};
 });
 assert.equal(res.verified,true);
});
