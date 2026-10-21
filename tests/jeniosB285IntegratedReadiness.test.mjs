import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('B285 no Inter monthly activation without verified settlement',()=>{
 const checkout=read('lib/pay/checkout.mjs');
 assert.match(checkout,/paymentConfig\.provider==='inter_pix'&&scope!=='social'/);
 assert.match(checkout,/Assinaturas ainda não estão disponíveis/);
});
test('B285 public sales agents never directly create a subscription or order',()=>{
 const sales=read('lib/assistant/sales-provider.mjs');
 assert.match(sales,/subscriptionGranted:false/);
 assert.match(sales,/executionEnabled:false/);
 assert.match(sales,/jenios_sales_budget_hold_b282/);
 assert.doesNotMatch(sales,/submitOrder|createOrder|createSubscription|bank\.charge/);
});
test('B285 Inter setup requires Master authorization and explicit read-only bank test',()=>{
 const route=read('app/api/admin/inter/setup/route.js');
 assert.match(route,/requireAdminPermission\(request,db,'finance.manage'\)/);
 assert.match(route,/confirmBankConnection===true/);
 assert.match(route,/testJeniosInterAuth/);
});
test('B285 advanced assistants must verify plan and block prepaid credits',()=>{
 const pro=read('lib/assistant/pro-service.mjs');
 assert.match(pro,/ADVANCED_PLAN_REQUIRED/);
 for(const path of ['chat','quote','access'])
  assert.match(read('app/api/assistant/pro/'+path+'/route.js'),/planOnly:true/);
 for(const path of ['checkout','quote','status'])
  assert.match(read('app/api/assistant/pro/credits/'+path+'/route.js'),/AI_CREDITS_SALES_DISABLED/);
});
test('B285 no changes to public commercial surface in audit-only candidate',()=>{
 assert.match(read('app/planos/page.js'),/redirect\('\/checkout'\)/);
 assert.match(read('app/lp/layout.js'),/SocialFreeLauncher/);
 assert.match(read('app/platform/assistente/page.js'),/FreeAssistantRoom/);
});
