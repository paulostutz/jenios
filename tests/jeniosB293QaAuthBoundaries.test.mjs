import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requirePayToken,requirePayUser} from '../lib/pay/auth.mjs';
import {platformAdminPermissions,requirePlatformAdmin} from '../lib/platform/admin-permissions.mjs';
import {registerPlatformAccount,requestPlatformPasswordReset,changePlatformPassword,
 signOutPlatform} from '../lib/platform/account-access.mjs';
import {journalKey} from '../lib/platform/simulation-journal.mjs';
import {sessionModeKey} from '../lib/platform/diagnostic-client.mjs';
import {projectCatalogProducts} from '../lib/pay/catalog.mjs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';

const request=(token='token-qa-sintetico')=>new Request('https://qa.invalid/api/private',{
 headers:token?{authorization:'Bearer '+token}:{}
});
const uid='00000000-0000-4000-8000-00000000b293';
const owner={id:uid,is_anonymous:false};
const payDb=(user,error=null)=>({auth:{getUser:async()=>({data:{user},error})}});
const platformDb=(user,error=null,grants=[])=>({
 auth:{getUser:async()=>({data:{user},error})},
 from(name){
  assert.equal(name,'jenios_platform_admin_permissions');
  return {select(name){assert.equal(name,'permission');return this;},
   eq(col,value){assert.equal(col,'user_id');assert.equal(value,user?.id);return Promise.resolve({data:grants,error:null});}};
 }
});
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('B293 missing, malformed and expired PAY token never grant session',async()=>{
 for(const header of ['', 'JWT test', 'Bearer ', 'Bearer a b']){
  const req=new Request('https://qa.invalid',{headers:header?{authorization:header}:{}});
  assert.throws(()=>requirePayToken(req),e=>e.status===401);
 }
 await assert.rejects(requirePayUser(request(),payDb(null,new Error('expired JWT'))),e=>e.status===401);
});
test('B293 invalid PAY API key fails closed with infrastructure status',async()=>{
 await assert.rejects(requirePayUser(request(),payDb(null,new Error('Invalid API key'))),e=>e.status===503);
});
test('B293 anonymous and forged user_metadata cannot become PAY finance admin',async()=>{
 await assert.rejects(requirePayUser(request(),payDb({...owner,is_anonymous:true,app_metadata:{role:'admin'}}),true),e=>e.status===401);
 await assert.rejects(requirePayUser(request(),payDb({...owner,user_metadata:{role:'admin'}}),true),e=>e.status===403);
});
test('B293 finance role is server-controlled app_metadata',async()=>{
 assert.equal((await requirePayUser(request(),payDb({...owner,app_metadata:{role:'finance_admin'}}),true)).id,uid);
});
test('B293 Platform requires dedicated verified token, not Social identity',async()=>{
 await assert.rejects(requirePlatformAdmin(request(),platformDb(null,new Error('invalid JWT')),'platform.admin'),e=>e.status===401);
 await assert.rejects(requirePlatformAdmin(request(),platformDb({...owner,user_metadata:{platform_role:'admin'}}),'platform.admin'),e=>e.status===403);
 await assert.rejects(requirePlatformAdmin(request(),platformDb({...owner,is_anonymous:true,app_metadata:{platform_role:'admin'}}),'platform.admin'),e=>e.status===401);
});
test('B293 Platform app_metadata grants dedicated admin; reports grants never escalate to admin',async()=>{
 const privileged={...owner,app_metadata:{platform_role:'admin'}};
 assert.equal((await requirePlatformAdmin(request(),platformDb(privileged),'platform.admin')).user.id,uid);
 const reportOnly=platformDb(owner,null,[{permission:'platform.reports'},{permission:'platform.admin'}]);
 assert.deepEqual(await platformAdminPermissions(reportOnly,owner,{}),['platform.reports']);
 await assert.rejects(requirePlatformAdmin(request(),platformDb(owner,null,[{permission:'platform.reports'}]),'platform.admin'),e=>e.status===403);
});
test('B293 disabled registration never submits Auth signUp',async()=>{
 let submitted=false;
 await assert.rejects(registerPlatformAccount({signUp(){submitted=true;}},'tester@example.com','Strong#Test2026','Strong#Test2026','https://qa.example','false'),/Cadastros/);
 assert.equal(submitted,false);
});
test('B293 password reset response avoids user enumeration with safe redirect',async()=>{
 let received;
 const auth={resetPasswordForEmail:async(email,opts)=>{received={email,opts};return{error:null};}};
 const result=await requestPlatformPasswordReset(auth,' SOMEONE@EXAMPLE.COM ','https://qa.example');
 assert.match(result,/Se este endereço estiver cadastrado/);
 assert.deepEqual(received,{email:'someone@example.com',opts:{redirectTo:'https://qa.example/platform/redefinir'}});
});
test('B293 password change denies invalid and anonymous sessions',async()=>{
 let updated=false;
 const auth={getUser:async()=>({data:{user:{id:uid,is_anonymous:true}},error:null}),
  updateUser:async()=>{updated=true;return{error:null};}};
 await assert.rejects(changePlatformPassword(auth,'Strong#Test2026','Strong#Test2026'),/sessão é inválida/);
 assert.equal(updated,false);
});
test('B293 sign-out does not erase another Platform identity or Social state',async()=>{
 const values=new Map(),storage={
  setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),
  removeItem:k=>values.delete(k)
 };
 storage.setItem(journalKey(uid),'owned');
 storage.setItem(sessionModeKey(uid),'manual');
 storage.setItem(journalKey('other-qa'),'other');
 storage.setItem('social_prefs','preserved');
 await signOutPlatform({signOut:async()=>({error:null})},storage,uid);
 assert.equal(storage.getItem(journalKey(uid)),undefined);
 assert.equal(storage.getItem(sessionModeKey(uid)),undefined);
 assert.equal(storage.getItem(journalKey('other-qa')),'other');
 assert.equal(storage.getItem('social_prefs'),'preserved');
});
test('B293 financial catalog rejects unverified fallback as active',()=>{
 for(const scope of ['platform','social']){
  const products=projectCatalogProducts([],scope,false);
  assert.ok(products.length>0);
  assert.ok(products.every(p=>p.active===false&&p.configured===false));
 }
 const university=projectCatalogProducts([], 'social',false).find(p=>p.code==='social-university-monthly');
 assert.equal(university.price_cents,4990);
 assert.equal(university.active,false);
});
test('B293 catalog database outage never inherits DEFAULT_PRODUCTS active status',()=>{
 const rows=projectCatalogProducts(null,'platform',true);
 assert.ok(rows.every(p=>!p.active&&!p.configured));
});
test('B293 financial catalog honors persisted inactive state but not missing ids',()=>{
 const rows=[
  {id:'00000000-0000-4000-8000-000000000001',code:'platform-nacional',active:false,price_cents:9990},
  {code:'platform-global-crypto',active:true,price_cents:14990}
 ];
 const projected=projectCatalogProducts(rows,'platform',true);
 assert.equal(projected.length,3);
 assert.ok(projected.every(p=>p.active===false));
 assert.equal(projected.find(p=>p.code==='platform-nacional').configured,true);
 assert.equal(projected.find(p=>p.code==='platform-global-crypto').configured,false);
});
test('B293 a verified persisted active row remains representable without granting checkout',()=>{
 const result=projectCatalogProducts([{id:uid,code:'platform-global-crypto',active:true}],'platform',true);
 assert.equal(result.find(p=>p.code==='platform-global-crypto').active,true);
 assert.equal(result.find(p=>p.code==='platform-nacional').active,false);
});
test('B293 PAY API uses fail-closed catalogue projection on success and error',()=>{
 const source=read('app/api/jenios-pay/products/route.js');
 assert.match(source,/projectCatalogProducts\(data,scope,true\)/);
 assert.match(source,/projectCatalogProducts\(\[\],scope,false\)/);
 assert.match(source,/paymentsEnabled: false, checkoutReady: false/);
 assert.match(source,/catalogStatus: 'defaults'/);
});
test('B293 dedicated Admin, Pro, Learning and Bank Inter APIs guard before privileged DB access',()=>{
 for(const path of ['app/api/platform/learning/route.js','app/api/assistant/pro/access/route.js',
  'app/api/admin/inter/setup/route.js']){
  assert.match(read(path),/requirePayToken\(request\)/,path);
 }
 assert.match(read('app/api/platform/admin/access/route.js'),/if\(!token\)return Response\.json/);
});
test('B293 Preview still rejects real trades, bank charges, paid model and open signup',()=>{
 const branch='fix/jenios-b291qa-integrated-preview-20261021';
 const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:branch,
  NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'qa_public_fixture',
  NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
  NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'platform_fixture',
  JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'true',
  NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED:'false',JENIOS_PAY_PROVIDER:'disabled',
  JENIOS_PRO_GENERATION_ENABLED:'false',JENIOS_QA_CANDIDATE_ENABLED:'false',
  JENIOS_SALES_GENERATIVE_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',
  JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR:'false'};
 assert.equal(checkS05DeploymentScope(env).ok,true);
 for(const key of ['JENIOS_PRO_GENERATION_ENABLED','NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED',
  'JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED','JENIOS_REAL_EXECUTION_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_SALES_GENERATIVE_ENABLED','JENIOS_QA_CANDIDATE_ENABLED'])
  assert.equal(checkS05DeploymentScope({...env,[key]:'true'}).ok,false,key);
 assert.equal(checkS05DeploymentScope({...env,JENIOS_PAY_PROVIDER:'inter_pix'}).ok,false);
});
