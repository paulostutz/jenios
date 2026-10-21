import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const runner=readFileSync(new URL('../scripts/platform/b291-qa-test-context.mjs',import.meta.url),'utf8');
test('B291 release build preserves production preflight and original S05 regression',()=>{
 assert.equal(pkg.scripts.build,'node scripts/check-s05-env-scope.mjs && npm test && npm run test:release-s05 && next build');
 assert.equal(pkg.scripts.test,'node scripts/platform/b291-qa-test-context.mjs');
 assert.match(runner,/B291_STAGE_STRICT_RECEIPT_TESTS/);
 assert.match(runner,/tests\/jeniosB290QaFinancialProof\.test\.mjs/);
 assert.match(runner,/tests\/jeniosB291QaIntegratedPreview\.test\.mjs/);
});
test('B291 only synthetic legacy fixtures disable strict evidence; never QA runtime Next build',()=>{
 assert.match(runner,/process\.env\.VERCEL_ENV==='preview'/);
 assert.match(runner,/process\.env\.VERCEL_GIT_COMMIT_REF===BRANCH/);
 assert.match(runner,/if\(qa&&strict!=='true'\)/);
 assert.match(runner,/JENIOS_QA_CANNOT_BUILD_WITHOUT_FINANCIAL_PROOF/);
 assert.match(runner,/JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'false'/);
 assert.match(runner,/else[\s\S]*?\bconst env=qa\?/);
 assert.doesNotMatch(runner,/\bprocess\.env\.JENIOS_QA_STRICT_SUBSCRIPTION_PROOF\s*=/);
 assert.doesNotMatch(runner,/NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY|OPENAI_API_KEY|INTER_CLIENT_SECRET/);
});
