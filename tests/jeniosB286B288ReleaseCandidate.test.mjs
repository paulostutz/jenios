import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('B286 sales surfaces are shared without granting subscriptions',()=>{
 assert.match(read('app/social/layout.js'),/SocialFreeLauncher/);
 assert.match(read('app/lp/layout.js'),/SocialFreeLauncher/);
 assert.match(read('app/platform/assistente/page.js'),/FreeAssistantRoom/);
 assert.match(read('lib/assistant/sales-provider.mjs'),/subscriptionGranted:false/);
});
test('B286 advanced access is server gated and prepaid credits disabled',()=>{
 assert.match(read('lib/assistant/pro-service.mjs'),/ADVANCED_PLAN_REQUIRED/);
 for(const x of ['access','chat','quote'])assert.match(read('app/api/assistant/pro/'+x+'/route.js'),/planOnly:true/);
 for(const x of ['checkout','quote','status'])assert.match(read('app/api/assistant/pro/credits/'+x+'/route.js'),/AI_CREDITS_SALES_DISABLED/);
});
test('B287 payment provider and sandbox cannot grant live entitlement',()=>{
 assert.match(read('lib/platform/b285r2-subscription-sandbox.mjs'),/realEntitlementGranted:false/);
 assert.match(read('lib/pay/checkout.mjs'),/Assinaturas ainda não estão disponíveis/);
 assert.match(read('app/planos/page.js'),/redirect/);
});
test('B287 bank secrets restricted to admin and Vault',()=>{
 assert.match(read('app/api/admin/inter/setup/route.js'),/requireAdminPermission/);
 assert.match(read('lib/pay/inter-vault.mjs'),/jenios_inter_load_b283/);
 assert.match(read('lib/pay/inter-vault.mjs'),/chargesEnabled:false/);
});
test('B288 no trading release or production promotion in candidate',()=>{
 const doc=read('docs/platform/B286-B288-RELEASE-CANDIDATE.md');
 assert.match(doc,/Produção B177-R3 intocada/);
 assert.match(doc,/Não publicar em produção/);
 assert.match(read('lib/platform/research/b281-first-hour-observation.mjs'),/realExecutionAllowed:false/);
});
