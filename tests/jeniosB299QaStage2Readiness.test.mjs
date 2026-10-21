import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 B299_QA_SOCIAL_URL,B299_QA_PLATFORM_URL,B299_QA_DISABLED_FLAGS,
 inspectB299QaPreflight,inspectB299QaCatalog,inspectB299QaBrokerGuides
} from '../lib/platform/qa/b299-stage2-readiness.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const envFixture=()=>{
 const env={
  NEXT_PUBLIC_SUPABASE_URL:B299_QA_SOCIAL_URL,SOCIAL_SUPABASE_URL:B299_QA_SOCIAL_URL,
  NEXT_PUBLIC_PLATFORM_SUPABASE_URL:B299_QA_PLATFORM_URL,PLATFORM_SUPABASE_URL:B299_QA_PLATFORM_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_fixture_only',
  NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_platform_qa_fixture',
  SUPABASE_SECRET_KEY:'synthetic_qa_service_key_not_valid_0001',
  PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'synthetic_platform_key_not_valid_0001',
  JENIOS_PAY_PROVIDER:'disabled',JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'true'
 };
 for(const flag of B299_QA_DISABLED_FLAGS)env[flag]='false';
 return env;
};
const four=()=>[
 {code:'platform-nacional',category:'platform',price_cents:9990,active:false,billing_type:'monthly'},
 {code:'platform-global-crypto',category:'platform',price_cents:14990,active:false,billing_type:'monthly'},
 {code:'platform-internacional-pro',category:'platform',price_cents:19990,active:false,billing_type:'monthly'},
 {code:'social-university-monthly',category:'other',price_cents:4990,active:false,billing_type:'monthly'}
];
test('B299 QA private preflight keeps all paid, trial, broker and open signup flags disabled',()=>{
 const result=inspectB299QaPreflight(envFixture());
 assert.equal(result.safeQaConfiguration,true);
 assert.equal(result.qaServerKeysPresent,true);
 assert.deepEqual(result.blockers,[]);
 assert.deepEqual(result.missingCredentials,[]);
 assert.equal(result.canRunExistingCp69AuthenticatedQa,false);
 assert.equal(result.releaseAuthorized,false);
 assert.equal(result.authQaCurrentlyCertified,false);
});
test('B299 QA a missing or unknown external kill-switch state blocks readiness',()=>{
 const env=envFixture();
 for(const flag of B299_QA_DISABLED_FLAGS)for(const value of ['true','1','',undefined]){
  const copy={...env,[flag]:value};
  const result=inspectB299QaPreflight(copy);
  assert.equal(result.safeQaConfiguration,false,flag+' '+String(value));
  assert.ok(result.blockers.includes('UNSAFE_OR_UNCONFIRMED_FLAG:'+flag));
 }
});
test('B299 QA wrong databases or production context reject readiness',()=>{
 const env=envFixture();
 for(const change of [
  {NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'},
  {SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'},
  {PLATFORM_SUPABASE_URL:B299_QA_SOCIAL_URL},
  {NEXT_PUBLIC_PLATFORM_SUPABASE_URL:B299_QA_SOCIAL_URL},
  {VERCEL_ENV:'production'}, {VERCEL_ENV:'preview'}, {VERCEL:'1'},
  {JENIOS_PAY_PROVIDER:'inter_pix'},
  {JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'false'}
 ])assert.equal(inspectB299QaPreflight({...env,...change}).safeQaConfiguration,false);
});
test('B299 QA secrets absent produce names only and never grant readiness',()=>{
 const env=envFixture();
 delete env.SUPABASE_SECRET_KEY;delete env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY;
 const report=inspectB299QaPreflight(env);
 assert.equal(report.qaServerKeysPresent,false);
 assert.ok(report.missingCredentials.includes('PLATFORM_QA_SERVER_KEY'));
 assert.ok(report.missingCredentials.includes('SOCIAL_QA_SERVER_KEY'));
 assert.equal(report.canRunExistingCp69AuthenticatedQa,false);
 assert.ok(!JSON.stringify(report).includes('synthetic'));
});
test('B299 QA explicit auth E2E gate requires local port and cannot authorize billing or orders',()=>{
 const env=envFixture();
 env.JENIOS_QA_AUTH_E2E_APPROVED='true';env.PLATFORM_QA_NEXT_URL='http://127.0.0.1:3129';
 const result=inspectB299QaPreflight(env);
 assert.equal(result.canRunExistingCp69AuthenticatedQa,true);
 assert.equal(result.realOrPaperExternalOrdersAllowed,false);
 assert.equal(result.bankInterActivated,false);
 assert.equal(result.paidAiActivated,false);
 assert.equal(result.releaseAuthorized,false);
 for(const target of ['https://jenios.com.br','http://example.org:3129','http://127.0.0.1:3127','http://localhost:3129/something','javascript:alert(1)']){
  assert.equal(inspectB299QaPreflight({...env,PLATFORM_QA_NEXT_URL:target}).canRunExistingCp69AuthenticatedQa,false);
 }
});
test('B299 QA no backend proof from empty/default product catalog',()=>{
 assert.equal(inspectB299QaCatalog([], 'unknown').catalogQaRowsConsistent,false);
 assert.equal(inspectB299QaCatalog(four(),'fallback').catalogQaRowsConsistent,false);
});
test('B299 QA four inactive persisted prices can pass database-state check only',()=>{
 const state=inspectB299QaCatalog(four(),'verified_qa_sql_read');
 assert.equal(state.catalogQaRowsConsistent,true);
 assert.equal(state.actualBackendEndpointReadVerified,false);
 assert.equal(state.checkoutEnabled,false);
});
test('B299 QA any active, price drift, missing or duplicated product fails closed',()=>{
 const rows=four();
 for(const field of [{active:true},{price_cents:1},{billing_type:'annual'},{category:'other'}]){
  const copy=rows.map((x,i)=>i===0?{...x,...field}:x);
  assert.equal(inspectB299QaCatalog(copy,'verified_qa_sql_read').catalogQaRowsConsistent,false);
 }
 assert.equal(inspectB299QaCatalog(rows.slice(1),'verified_qa_sql_read').catalogQaRowsConsistent,false);
 assert.equal(inspectB299QaCatalog([...rows,rows[0]],'verified_qa_sql_read').catalogQaRowsConsistent,false);
});
test('B299 QA provider registry distinguishes guide from official verified account',()=>{
 const report=inspectB299QaBrokerGuides();
 assert.equal(report.totalGuides,12);
 assert.equal(report.readOnlyDemoDesigns,2);
 assert.equal(report.guideOnly,10);
 assert.equal(report.officialAuthenticatedAccounts,0);
 assert.equal(report.brokerPermissionCertification,false);
 assert.equal(report.brokerOrderTransmissionAuthorized,false);
});
test('B299 QA existing CP69 authenticated E2E is reused, not duplicated or run in CI',()=>{
 const script=read('scripts/platform/cp69-authenticated-e2e.mjs');
 assert.match(script,/PLATFORM_SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(script,/auth\.admin\.createUser/);
 assert.match(script,/auth\.admin\.deleteUser/);
 assert.match(script,/QA synthetic account cleanup verified/);
 assert.match(script,/3129/);
 const wf=read('.github/workflows/jenios-b299qa-stage2-private.yml');
 assert.doesNotMatch(wf,/node scripts\/platform\/cp69-authenticated-e2e\.mjs/);
 assert.doesNotMatch(wf,/\$\{\{\s*secrets\./);
});
test('B299 QA private branch blocks Git deploy, preserves B298 and no public execution',()=>{
 const branch='fix/jenios-b299qa-stage2-auth-pay-readiness-20261021';
 const v=JSON.parse(read('vercel.json'));
 assert.equal(v.git.deploymentEnabled[branch],false);
 assert.equal(v.git.deploymentEnabled['fix/jenios-b298-integrated-release-reconciliation-20261021'],false);
 assert.match(v.ignoreCommand,/jenios-b298-integrated-release-reconciliation/);
 assert.match(v.ignoreCommand,/jenios-b299qa-stage2-auth-pay-readiness/);
 for(const path of ['lib/assistant/verified-subscription-b290.mjs',
  'lib/pay/catalog.mjs','lib/platform/connections/read-only-client.mjs',
  'lib/platform/research/b299-private-consent-replay-journal.mjs'])
  assert.ok(read(path).length>500,path);
});
