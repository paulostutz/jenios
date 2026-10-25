import test from 'node:test';
import assert from 'node:assert/strict';
import {billingIdentities,verifyMonthlyBinding,handlePlatformMonthly,PLATFORM_MONTHLY_TERMS} from '../lib/platform/monthly-billing.mjs';
import {subscriptionDunningEmail} from '../lib/email/subscription-dunning.mjs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';
const A='47000000-0000-4000-8000-000000000001',P='47000000-0000-4000-8000-000000000002',L='47000000-0000-4000-8000-000000000003',O='47000000-0000-4000-8000-000000000004';
test('G47 independently verifies both providers and does not accept IDs/email claims from browser',async()=>{
 const social={name:'social'},platform={name:'platform'},calls=[];
 const request=new Request('https://jenios.test/api',{headers:{authorization:'Bearer social-token','x-platform-authorization':'Bearer platform-token'}});
 const result=await billingIdentities(request,{db:social,platformDb:platform,both:true,authorize:async(r,db)=>{calls.push([r.headers.get('authorization'),db.name]);return {id:db===social?A:P};}});
 assert.deepEqual(calls,[['Bearer social-token','social'],['Bearer platform-token','platform']]);assert.equal(result.platform.id,P);
 await assert.rejects(billingIdentities(new Request(request.url,{headers:{authorization:'Bearer social-token'}}),{db:social,platformDb:platform,both:true,authorize:async()=>({id:A})}),{status:401});
 await assert.rejects(billingIdentities(request,{db:social,platformDb:platform,both:true,authorize:async(r,db)=>db===social?{id:A}:{id:P,is_anonymous:true}}),{status:401});
});
const invoice={id:L,user_id:A,link_id:L,order_id:O,product_id:P,product_code:'platform-nacional',amount_cents:9990,currency:'BRL',terms_version:PLATFORM_MONTHLY_TERMS,request_key:'monthly_request_0001'};
const order={id:O,user_id:A,product_id:P,amount_cents:9990,currency:'BRL',provider:'inter_pix',idempotency_key:'platform:'+A+':'+invoice.request_key,
external_reference:JSON.stringify({scope:'platform',linkId:L,productCode:'platform-nacional',termsVersion:PLATFORM_MONTHLY_TERMS,billingType:'monthly',renewalMode:'manual_pix',fingerprint:'platform:'+A+':'+invoice.request_key})};
test('G47 immutable financial binding rejects cross-owner, currency, amount, product and terms tampering',()=>{
 const link={id:L,user_id:A};assert.equal(verifyMonthlyBinding(invoice,order,A,link),true);
 for(const patch of [{user_id:P},{amount_cents:1},{currency:'USD'},{product_id:L},{external_reference:'{}'}])assert.throws(()=>verifyMonthlyBinding(invoice,{...order,...patch},A,link),{code:'ORDER_MISMATCH'});
 assert.throws(()=>verifyMonthlyBinding({...invoice,terms_version:'other'},order,A,link));
 assert.throws(()=>verifyMonthlyBinding(invoice,order,A,{id:P,user_id:A}));
});
function dbState({enabled=false}={}){
 const rows={jenios_platform_billing_config_g47:{payments_enabled:enabled,terms_version:PLATFORM_MONTHLY_TERMS},jenios_pay_products:[],jenios_platform_payers_g47:{id:L,user_id:A,platform_user_id:P},jenios_platform_invoices_g47:[]};
 return {rpc:()=>assert.fail('No mutation permitted'),from(table){const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},maybeSingle(){return Promise.resolve({data:rows[table]})},then(a,b){return Promise.resolve({data:rows[table]}).then(a,b)}};return q;}};
}
const body={productCode:'platform-nacional',amountCents:9990,currency:'BRL',termsVersion:PLATFORM_MONTHLY_TERMS,requestKey:'monthly_request_0001',acceptTerms:true};
const req=(value=body)=>new Request('https://jenios.test/api',{method:'POST',headers:{authorization:'Bearer social','x-platform-authorization':'Bearer platform','content-type':'application/json'},body:JSON.stringify(value)});
test('G47 paused database/global payment gates and missing consent cannot create an invoice or call bank',async()=>{
 const env={JENIOS_PAY_PROVIDER:'inter_pix',JENIOS_PAY_PAYMENTS_ENABLED:'true',JENIOS_INTER_CHARGES_ENABLED:'true',INTER_CLIENT_ID:'fixture',INTER_CLIENT_SECRET:'fixture',INTER_CERTIFICATE:'fixture',INTER_PRIVATE_KEY:'fixture',INTER_PIX_KEY:'fixture'};
 for(const [enabled,global] of [[false,'true'],[true,'false']]){
  const db=dbState({enabled}),platformDb={};
  const result=await handlePlatformMonthly(req(),{action:'checkout',db,platformDb,env:{...env,JENIOS_PAY_PAYMENTS_ENABLED:global},authorize:async(r,d)=>({id:d===db?A:P}),clientFactory:()=>assert.fail('bank must not be touched')});
  assert.equal(result.status,503);assert.equal((await result.json()).code,'PAYMENTS_PAUSED');
 }
 const db=dbState();
 const bad=await handlePlatformMonthly(req({...body,acceptTerms:false}),{action:'checkout',db,platformDb:{},authorize:async(r,d)=>({id:d===db?A:P})});assert.equal(bad.status,400);
 const spoof=await handlePlatformMonthly(req({...body,userId:P}),{action:'checkout',db,platformDb:{},authorize:async(r,d)=>({id:d===db?A:P})});assert.equal(spoof.status,400);
});
test('G47 access is private, scope-limited and never claims paid rights without receipt',async()=>{
 const result=await handlePlatformMonthly(new Request('https://jenios.test/api'),{action:'access',db:dbState(),authorize:async()=>({id:A})});
 assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);
 const data=await result.json();assert.equal(data.access,null);assert.equal(data.available,false);assert.equal(data.link,undefined);
});
test('G47 manual renewal notices never present non-renewal as a debt or promise full-day access',()=>{
 for(const eventKind of ['due_soon_3d','due_today','past_due_1d','cancelled_7d']){
  const message=subscriptionDunningEmail({eventKind,subscriptionId:L,productName:'Nacional',dueAt:'2026-11-24T12:00:00Z',to:'fixture@example.invalid',renewalMode:'manual_pix'});
  assert.doesNotMatch(message.text,/Pagamento em atraso|Regularize|continua ativo hoje|por falta de pagamento/);
  assert.match(message.text,/Pix|renova|Nenhuma cobrança/);
 }
});
test('G47 review branch is preview-only, on the exact project and isolated database with every external action explicitly off',()=>{
 const actions=['JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_PRO_PAYMENTS_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
 'JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
 'JENIOS_EMAIL_PRODUCTION_ENABLED','JENIOS_EMAIL_DISPATCHER_ENABLED','JENIOS_PAYMENT_EMAILS_ENABLED',
 'JENIOS_TRANSACTIONAL_EMAILS_ENABLED','JENIOS_MARKETING_EMAILS_ENABLED','JENIOS_MARKETING_PLANNER_ENABLED',
 'JENIOS_SUBSCRIPTION_DUNNING_ENABLED','JENIOS_RESEND_WEBHOOK_ENABLED','JENIOS_PRO_GENERATION_ENABLED',
 'JENIOS_SALES_GENERATIVE_ENABLED','JENIOS_ASSISTANT_MEMORY_ENABLED','NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED'];
 const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/jenios-platform-pix-monthly-20261024',VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
 NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture',PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'fixture',
 ...Object.fromEntries(actions.map(key=>[key,'false']))};
 assert.equal(checkS05DeploymentScope(env).ok,true);
 for(const key of actions)for(const value of ['true',undefined])assert.equal(checkS05DeploymentScope({...env,[key]:value}).ok,false,key);
 assert.equal(checkS05DeploymentScope({...env,VERCEL_PROJECT_ID:'other'}).ok,false);
 assert.equal(checkS05DeploymentScope({...env,NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'}).ok,false);
 assert.equal(checkS05DeploymentScope({...env,VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co',SUPABASE_SECRET_KEY:'fixture'}).ok,false);
});
