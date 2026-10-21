import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
import {B290_STRICT_QA_FLAG,attestVerifiedPlatformB290} from '../lib/assistant/verified-subscription-b290.mjs';
import {projectPlatformCatalog} from '../lib/platform/checkout-readiness.mjs';
const STAGE='https://rebzztxlzofxpfwjvbee.supabase.co';
const PLATFORM='https://xaicvhagftzjkqphnbgx.supabase.co';
const BRANCH='fix/jenios-b291qa-integrated-preview-20261021';
const fixed={
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:BRANCH,
 NEXT_PUBLIC_SUPABASE_URL:STAGE,SOCIAL_SUPABASE_URL:STAGE,
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_qa-fake-not-a-real-key',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:PLATFORM,
 NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_qa-platform-fake',
 NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED:'false',
 JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'true',JENIOS_PAY_PROVIDER:'disabled',
 JENIOS_SALES_GENERATIVE_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',
 JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',
 JENIOS_PRIVATE_PAPER_EXECUTOR:'false',JENIOS_PRO_GENERATION_ENABLED:'false',
 JENIOS_QA_CANDIDATE_ENABLED:'false'
};
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('B291 explicit QA branch can build ONLY isolated Social and dedicated Platform QA',()=>{
 assert.deepEqual(checkS05DeploymentScope(fixed),{ok:true,mode:'preview-isolated-b291-integrated-qa'});
 for(const patch of [
  {NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'},
  {SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'},
  {NEXT_PUBLIC_PLATFORM_SUPABASE_URL:STAGE},
  {NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},
  {NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:''}
 ])assert.equal(checkS05DeploymentScope({...fixed,...patch}).ok,false);
});
test('B291 requires independent confirmed financial proof and blocks unapproved signup',()=>{
 assert.equal(B290_STRICT_QA_FLAG,'JENIOS_QA_STRICT_SUBSCRIPTION_PROOF');
 assert.deepEqual(checkS05DeploymentScope({...fixed,JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'false'}),
  {ok:false,reason:'B291_QA_REQUIRES_STRICT_PROOF_AND_DISABLED_EXTERNAL_SERVICES'});
 for(const patch of [
  {JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:''},
  {NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED:'true'},
  {JENIOS_PAY_PROVIDER:'inter_pix'},{JENIOS_PAY_PROVIDER:'custom'},
  {JENIOS_PAY_PROVIDER:undefined},
  {JENIOS_PRO_GENERATION_ENABLED:'true'},
  {JENIOS_QA_CANDIDATE_ENABLED:'true'}
 ])assert.equal(checkS05DeploymentScope({...fixed,...patch}).ok,false);
});
test('B291 no external money, model or broker operations in Preview',()=>{
 for(const key of ['JENIOS_SALES_GENERATIVE_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
  'JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR']){
  assert.equal(checkS05DeploymentScope({...fixed,[key]:'true'}).ok,false,key);
 }
});
test('B291 unknown branches and production remain forbidden',()=>{
 assert.equal(checkS05DeploymentScope({...fixed,VERCEL_GIT_COMMIT_REF:'fix/not-reviewed'}).ok,false);
 assert.equal(checkS05DeploymentScope({...fixed,VERCEL_ENV:'production'}).ok,false);
});
test('B291 R26 and canonical B147 only in QA, no client financial writes',()=>{
 const sql=read('supabase/qa/jenios_b291qa_university_inactive.sql');
 assert.match(sql,/B291_NOT_ISOLATED_JENIOS_QA/);
 assert.match(sql,/B291_QA_NOT_EMPTY/);
 assert.match(sql,/VALUES\('social-university-monthly'[^\n]*'monthly',false\)/);
 assert.match(sql,/REVOKE ALL ON public\.jenios_university_invoices_b147 FROM PUBLIC,anon,authenticated,service_role/);
 assert.match(sql,/GRANT SELECT,INSERT,UPDATE ON public\.jenios_university_invoices_b147 TO service_role/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.jenios_university_prepare_b147/);
 assert.match(sql,/COMMIT;/);
 assert.doesNotMatch(sql,/VALUES\('social-university-monthly'[^\n]*'monthly',true\)/);
});
test('B291 synthetic paid subscription without confirmed Inter receipt cannot grant Pro',()=>{
 const user='00000000-0000-4000-8000-000000000111',product='00000000-0000-4000-8000-000000000112';
 const order='00000000-0000-4000-8000-000000000113',sub='00000000-0000-4000-8000-000000000114';
 const now=Date.parse('2026-10-21T18:00:00Z'),at=x=>new Date(x).toISOString();
 const p={userId:user,now,subscription:{
  id:sub,user_id:user,product_id:product,latest_order_id:order,status:'active',
  current_period_start:at(now-3600000),current_period_end:at(now+86400000)
 },order:{id:order,user_id:user,product_id:product,status:'paid',provider:'inter_pix',
  currency:'BRL',amount_cents:14990,created_at:at(now-7200000)},
  product:{id:product,code:'platform-global-crypto',category:'platform'},receipts:[]};
 assert.equal(attestVerifiedPlatformB290(p).verified,false);
});
test('B291 QA public platform plans remain unpurchasable without bank release',()=>{
 const codes=['platform-nacional','platform-global-crypto','platform-internacional-pro'];
 const products=codes.map((code,i)=>({
  id:'00000000-0000-4000-8000-00000000012'+i,code,name:code,category:'platform',
  currency:'BRL',billing_type:'monthly',price_cents:[9990,14990,19990][i],
  active:false,configured:true
 }));
 const plans=projectPlatformCatalog({products,paymentsEnabled:false,
  checkoutReady:false,checkoutScope:'platform',subscriptionLifecycleReady:false});
 assert.equal(plans.length,3);
 assert.ok(plans.every(p=>p.canCheckout===false));
 assert.deepEqual(plans.map(p=>p.price_cents),[9990,14990,19990]);
});
test('B291 existing Social University and Pro route boundaries are unchanged',()=>{
 assert.match(read('app/lp/layout.js'),/SocialFreeLauncher/);
 assert.match(read('app/social/layout.js'),/SocialFreeLauncher/);
 assert.match(read('app/platform/assistente/page.js'),/FreeAssistantRoom/);
 assert.match(read('app/api/platform/learning/route.js'),/handleLearning/);
 assert.match(read('app/api/assistant/pro/access/route.js'),/planOnly:true/);
 assert.match(read('lib/assistant/pro-access.mjs'),/verifiedPlatformEvidenceB290/);
});
