import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {PRO_ALLOWANCE_APPROVAL_G45 as policy} from '../lib/assistant/pro-quota-activation.mjs';
import {PRO_MULTIPLIER} from '../lib/assistant/pro-pricing.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runner=fileURLToPath(new URL('../scripts/test-genios-quota-g45-postgres.mjs',import.meta.url));
test('G45 approved provider capacity maps to the existing 2x internal ledger without an additional-package price',()=>{
 assert.equal(policy.retailMultiplier,Number(PRO_MULTIPLIER));
 assert.deepEqual(policy.plans['platform-global-crypto'],{providerNanoUsd:2000000000,retailNanoUsd:4000000000});
 assert.deepEqual(policy.plans['platform-internacional-pro'],{providerNanoUsd:4000000000,retailNanoUsd:8000000000});
 assert.equal(policy.warningPercent,80);assert.equal(policy.additionalPackagePriceApproved,false);
 assert.ok(Object.isFrozen(policy)&&Object.isFrozen(policy.plans));
 for(const plan of Object.values(policy.plans))assert.equal(plan.retailNanoUsd,plan.providerNanoUsd*2);
});

for(const [label,url] of Object.entries({
 hosted:'postgresql://postgres:fixture@remote.example.invalid/jenios_genios_g45_quota_test',
 shared:'postgresql://postgres@127.0.0.1/postgres',
 query:'postgresql://postgres@127.0.0.1/jenios_genios_g45_quota_test?host=remote.example.invalid',
 wrongProtocol:'https://127.0.0.1/jenios_genios_g45_quota_test',
 encodedSlash:'postgresql://postgres@localhost/jenios_genios_g45_quota_test%2Fother'
}))test('G45 PostgreSQL runner refuses '+label+' before any database connection',()=>{
 const result=spawnSync(process.execPath,[runner],{cwd:root,encoding:'utf8',timeout:5000,
  env:{PATH:process.env.PATH,JENIOS_G45_QUOTA_TEST_DATABASE_URL:url}});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/G45_QUOTA_TEST_DATABASE_MUST_BE_DISPOSABLE_LOOPBACK/);
 assert.doesNotMatch(result.stderr,/G45_QUOTA_PSQL_FAILED|G45_QUOTA_PSQL_UNAVAILABLE/);
});

test('G45 migration alters only approved allowance defaults and preserves the financial reconciliation/funding bodies',async()=>{
 const files=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(name=>name.endsWith('_jenios_pro_allowances_g45.sql'));
 assert.equal(files.length,1);
 const sql=await readFile(new URL('../supabase/migrations/'+files[0],import.meta.url),'utf8');
 assert.doesNotMatch(sql,/\b(?:generation_enabled|payments_enabled|pricing_approved)\s*=\s*true/i);
 assert.doesNotMatch(sql,/\b(?:spent_nano_usd|reserved_nano_usd)\s*=\s*0\b/i);
 assert.doesNotMatch(sql,/INSERT\s+INTO\s+public\.jenios_pay_subscriptions/i);
 assert.doesNotMatch(sql,/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.jenios_pro_(?:settle|release|reconcile|confirm_paid_topup)_b143/i);
 assert.doesNotMatch(sql,/\bSECURITY\s+DEFINER\b/i);
 assert.match(sql,/crypto_allowance_nano_usd=4000000000,global_allowance_nano_usd=8000000000/);
});
