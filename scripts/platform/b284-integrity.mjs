/** B284 exact-scope proof from B281. Existing S05, University, research,
 * commercial audit, core robots and all protected modules remain byte-identical.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const BASE='2633bb6654c64bb956207fd28605e4ac30888380';
const additions=[
 '.github/workflows/jenios-b284-sales-inter.yml',
 'app/api/admin/inter/setup/route.js',
 'app/components/InterSetupForm.js','app/lp/layout.js',
 'docs/platform/B282-B284-SALES-INTER-DELIVERY.md',
 'lib/assistant/sales-policy.mjs','lib/assistant/sales-provider.mjs',
 'lib/pay/inter-material.mjs','lib/pay/inter-vault.mjs',
 'scripts/platform/b284-integrity.mjs',
 'supabase/migrations/20261021170000_jenios_b282_b283_sales_inter_vault.sql',
 'tests/jeniosB282B284SalesInter.test.mjs'
];
const modifications=[
 'app/api/assistant/free/route.js',
 'app/api/assistant/pro/access/route.js',
 'app/api/assistant/pro/chat/route.js',
 'app/api/assistant/pro/quote/route.js',
 'app/api/assistant/pro/credits/checkout/route.js',
 'app/api/assistant/pro/credits/quote/route.js',
 'app/api/assistant/pro/credits/status/route.js',
 'app/components/InterAdminPanel.js',
 'app/components/assistant/AssistantEntry.js',
 'app/components/assistant/FreeAssistantRoom.js',
 'app/genios-pro/page.js','app/planos/page.js','app/platform/assistente/page.js',
 'lib/assistant/pro-service.mjs','lib/pay/gateway.mjs',
 'lib/pay/checkout.mjs','lib/pay/pix-status.mjs',
 'tests/jeniosProAccessB139.test.mjs'
];
const permitted=new Map([...additions.map(x=>[x,'A']),...modifications.map(x=>[x,'M'])]);
const diff=execFileSync('git',['diff','--name-status','--no-renames',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.deepEqual(diff.map(([,p])=>p).sort(),[...permitted.keys()].sort(),'B284_UNAPPROVED_CODE_CHANGE');
for(const [type,path] of diff)assert.equal(type,permitted.get(path),'B284_FILE_ACTION_CHANGED '+path);
for(const p of [
 'package.json','package-lock.json','app/layout.js','app/social/layout.js',
 'app/social/page.js','app/social/simulador/page.js','app/social/configuracoes/page.js',
 'app/impulsionar/page.js','app/dashboard/page.js','app/dashboard-logado/page.js',
 'app/dashboard-logado/layout.js','app/dashboard/layout.js',
 'app/mesa-operacoes/page.js','app/mesa-operacoes/layout.js',
 'app/components/assistant/SocialFreeLauncher.js',
 'app/components/assistant/AssistantRoom.js',
 'app/components/assistant/FreeAssistantRoom.module.css',
 'app/components/assistant/AssistantEntry.module.css',
 'app/components/SocialChargeButton.js','app/checkout/page.js',
 'lib/assistant/pro-pricing.mjs','lib/assistant/pro-provider.mjs',
 'lib/assistant/pro-topups.mjs','lib/assistant/pro-wallet-contract.mjs',
 'lib/assistant/pro-access.mjs','lib/assistant/knowledge.mjs',
 'lib/assistant/service.mjs','lib/pay/inter-pix.mjs',
 'lib/pay/access.mjs','lib/pay/catalog.mjs',
 'lib/platform/research/b281-first-hour-observation.mjs',
 'lib/platform/research/b280-forward-protocol.mjs',
 'lib/platform/research/b279-retrospective-replay.mjs',
 'lib/platform/research/b278-historical-ingest.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/learning/catalog.mjs','lib/learning/engine.mjs',
 'lib/learning/service.mjs',
 'app/api/platform/broker-connections/route.js','app/api/platform/learning/route.js',
 'app/api/jenios-pay/admin/route.js','app/api/jenios-pay/checkout/route.js',
 'app/api/jenios-pay/pix/route.js',
 'app/api/assistant/university/checkout/route.js',
 'docs/platform/evidence/B280_FORWARD_HOUR_SEALED_SNAPSHOT.json'
]){
 assert.ok(readFileSync(p).equals(execFileSync('git',['show',BASE+':'+p])),
 'B284_PROTECTED_BASELINE_DRIFT '+p);
}
for(const p of ['app/api/platform/live-trading/route.js',
 'app/api/platform/broker-execution/route.js','app/api/platform/paper-execution/route.js',
 'nucleo-privado/engine.mjs'])
 assert.equal(existsSync(p),false,'B284_FORBIDDEN_TRADING_SURFACE '+p);
const sales=readFileSync('lib/assistant/sales-provider.mjs','utf8');
const inter=readFileSync('lib/pay/inter-vault.mjs','utf8');
const sql=readFileSync('supabase/migrations/20261021170000_jenios_b282_b283_sales_inter_vault.sql','utf8');
assert.match(sales,/jenios_sales_budget_hold_b282/);
assert.match(sales,/JENIOS_SALES_GENERATIVE_ENABLED/);
assert.match(inter,/jenios_inter_store_b283/);
assert.match(inter,/jenios_inter_load_b283/);
assert.match(sql,/supabase|vault\.create_secret/);
assert.match(sql,/from PUBLIC,anon,authenticated/);
assert.match(readFileSync('app/planos/page.js','utf8'),/redirect\('\/checkout'\)/);
assert.doesNotMatch(readFileSync('app/planos/page.js','utf8'),/000201010211|LETTER LETTER/);
assert.match(readFileSync('lib/assistant/pro-service.mjs','utf8'),/ADVANCED_PLAN_REQUIRED/);
assert.equal(additions.length,12);assert.equal(modifications.length,18);
console.log('B284_SCOPE_PASS 12 new + 18 modified files, Social, University, B281 and robots preserved; AI and Inter fail closed');
