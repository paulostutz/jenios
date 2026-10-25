import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyPlatformPlan,projectPlatformCatalog,PLATFORM_PLAN_CODES} from '../lib/platform/checkout-readiness.mjs';
const product={id:'11111111-1111-4111-8111-111111111111',code:'platform-nacional',category:'platform',currency:'BRL',billing_type:'monthly',price_cents:9990,active:true,configured:true};
const catalogue={checkoutScope:'platform',checkoutReady:true,paymentsEnabled:true};
test('R35 public: fallback plans without DB row never allow checkout',()=>{
 assert.equal(classifyPlatformPlan({...product,id:null,configured:false},catalogue).canCheckout,false);
});
test('R35 public: even configured gateway cannot charge without verified recurring lifecycle',()=>{
 assert.equal(classifyPlatformPlan(product,catalogue).canCheckout,false);
 assert.equal(classifyPlatformPlan(product,{...catalogue,subscriptionLifecycleReady:false}).canCheckout,false);
});
test('R35 public: bad currency, invalid ID and wrong billing type block checkout',()=>{
 for(const fields of [{currency:'USD'},{id:'fake'},{billing_type:'one_time'},{price_cents:0},{active:false}])
 assert.equal(classifyPlatformPlan({...product,...fields},{...catalogue,subscriptionLifecycleReady:true}).canCheckout,false);
});
test('R35 public: plans are in approved order, no social product can appear',()=>{
 const input=[{...product,code:'social-bankscore-report'},{...product,code:'platform-internacional-pro'},{...product,code:'platform-global-crypto'},product];
 const plans=projectPlatformCatalog({...catalogue,products:input});
 assert.deepEqual(plans.map(p=>p.code),PLATFORM_PLAN_CODES);
});
test('R35 public: API defaults cannot give proof of availability',()=>{
 assert.equal(classifyPlatformPlan(product,{...catalogue,subscriptionLifecycleReady:true,catalogStatus:'defaults'}).canCheckout,false);
 assert.deepEqual(projectPlatformCatalog({}),[]);
});
test('G47 public: charge control requires authenticated server billing readiness and explicit consent',()=>{
 const src=readFileSync('app/checkout/page.js','utf8');
 assert.match(src,/projectPlatformCatalog\(catalog\)/);
 assert.match(src,/MonthlyPix plan=\{chosen\}/);
 assert.doesNotMatch(src,/SocialChargeButton/);
 const billing=readFileSync('app/checkout/MonthlyPix.js','utf8');
 assert.match(billing,/state\?\.canPurchase&&platform&&plan&&selectedMatches/);
 assert.match(billing,/disabled=\{busy\|\|!accepted\}/);
 assert.match(billing,/termsVersion:PLATFORM_MONTHLY_TERMS,acceptTerms:true/);
 assert.doesNotMatch(src,/process\.env\.|SUPABASE_SERVICE_ROLE_KEY/);
});
