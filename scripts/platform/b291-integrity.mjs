/** B291 release inventory and zero-drift assertion from last READY B288-R2. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const BASE='581058b8195c75d941185dc028fff057110ab311';
const additions=[
 '.github/workflows/jenios-b289qa-schema.yml',
 '.github/workflows/jenios-b290qa-proof.yml',
 '.github/workflows/jenios-b291qa-final.yml',
 'docs/platform/B289-QA-SCHEMA-ISOLATED.md',
 'docs/platform/B290-QA-FINANCIAL-PROOF.md',
 'docs/platform/B291-QA-INTEGRATED-LAUNCH-CANDIDATE.md',
 'lib/assistant/verified-subscription-b290.mjs',
 'scripts/platform/b291-integrity.mjs',
 'scripts/platform/b291-qa-public-acceptance.mjs',
 'supabase/qa/jenios_b289qa_financial_preflight.sql',
 'supabase/qa/jenios_b289qa_assert.sql',
 'supabase/qa/jenios_b290qa_receipt_schema.sql',
 'tests/jeniosB289QaSchema.test.mjs',
 'tests/jeniosB290QaFinancialProof.test.mjs',
 'tests/jeniosB291QaPreviewRelease.test.mjs'
];
const changes=['lib/assistant/pro-access.mjs','lib/release/environment-scope.mjs'];
const allow=new Map([...additions.map(x=>[x,'A']),...changes.map(x=>[x,'M'])]);
const diff=execFileSync('git',['diff','--name-status','--no-renames',BASE,'HEAD'],{encoding:'utf8'})
 .trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.deepEqual(diff.map(([,path])=>path).sort(),[...allow.keys()].sort(),'B291_UNEXPECTED_SOURCE_PATH');
for(const [action,path] of diff)assert.equal(action,allow.get(path),'B291_UNAPPROVED_ACTION '+path);
const preserved=[
 'package.json','package-lock.json','app/layout.js','app/page.js',
 'app/social/page.js','app/social/layout.js','app/lp/page.js','app/lp/layout.js',
 'app/planos/page.js','app/checkout/page.js','app/genios-pro/page.js',
 'app/dashboard-logado/page.js','app/platform/entrar/page.js','app/platform/redefinir/page.js',
 'app/components/InterAdminPanel.js','app/components/InterSetupForm.js',
 'app/components/assistant/SocialFreeLauncher.js',
 'app/components/assistant/FreeAssistantRoom.js',
 'app/components/assistant/AssistantEntry.js',
 'app/api/admin/inter/setup/route.js','app/api/assistant/free/route.js',
 'app/api/assistant/pro/chat/route.js','app/api/assistant/pro/access/route.js',
 'app/api/assistant/pro/quote/route.js',
 'app/api/platform/learning/route.js','app/api/platform/admin/access/route.js',
 'app/api/jenios-pay/checkout/route.js',
 'lib/assistant/pro-service.mjs','lib/assistant/sales-provider.mjs',
 'lib/assistant/knowledge.mjs','lib/assistant/university-subscription.mjs',
 'lib/learning/catalog.mjs','lib/learning/engine.mjs',
 'lib/learning/access.mjs','lib/learning/repository.mjs',
 'lib/pay/checkout.mjs','lib/pay/gateway.mjs','lib/pay/inter-pix.mjs',
 'lib/pay/pix-status.mjs','lib/pay/auth.mjs','lib/pay/catalog.mjs',
 'lib/pay/inter-vault.mjs',
 'lib/platform/account-access.mjs',
 'lib/platform/b285r2-subscription-sandbox.mjs',
 'lib/platform/research/b281-first-hour-observation.mjs',
 'lib/platform/research/b280-forward-protocol.mjs',
 'lib/platform/research/b279-retrospective-replay.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/pilot-prep/paper-ledger.mjs',
 'supabase/migrations/20261012_jenios_pay_v1.sql',
 'supabase/migrations/20261021170000_jenios_b282_b283_sales_inter_vault.sql',
 'db/schema/learning-r26.sql',
 'docs/platform/evidence/B280_FORWARD_HOUR_SEALED_SNAPSHOT.json'
];
for(const path of preserved){
 assert.ok(existsSync(path),'B291_PROTECTED_FILE_MISSING '+path);
 assert.ok(readFileSync(path).equals(execFileSync('git',['show',BASE+':'+path])),
  'B291_PROTECTED_BASELINE_DRIFT '+path);
}
for(const path of ['app/api/platform/live-trading/route.js',
 'app/api/platform/broker-execution/route.js','app/api/platform/paper-execution/route.js',
 'nucleo-privado/engine.mjs'])
 assert.equal(existsSync(path),false,'B291_EXTERNAL_ORDER_SURFACE_FORBIDDEN '+path);
const routeGuard=readFileSync('lib/release/environment-scope.mjs','utf8');
assert.match(routeGuard,/B291_QA_RELEASE_BRANCH/);
assert.match(routeGuard,/B291_QA_FINANCIAL_EVIDENCE_REQUIRED/);
assert.match(routeGuard,/B291_QA_PAY_PROVIDER_MUST_BE_DISABLED/);
assert.match(routeGuard,/S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED/);
const planCode=readFileSync('lib/assistant/pro-access.mjs','utf8');
assert.match(planCode,/JENIOS_QA_STRICT_SUBSCRIPTION_PROOF/);
assert.match(planCode,/verifiedPlatformEvidenceB290/);
const evidence=readFileSync('lib/assistant/verified-subscription-b290.mjs','utf8');
assert.match(evidence,/bank_end_to_end_id/);
assert.doesNotMatch(evidence,/\bfetch\s*\(|\bXMLHttpRequest\b/);
assert.equal(additions.length,15);
assert.equal(changes.length,2);
console.log('B291_RELEASE_SCOPE_PASS 15 additive + 2 QA-only changed; no PAY, proprietary engines, Social or University drift');
