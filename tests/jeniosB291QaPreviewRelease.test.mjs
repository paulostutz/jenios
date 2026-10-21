import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';

const B291='fix/jenios-b291qa-launch-candidate-20261021';
const SQA='https://rebzztxlzofxpfwjvbee.supabase.co';
const PQA='https://xaicvhagftzjkqphnbgx.supabase.co';
const OFF=[
 'JENIOS_SALES_GENERATIVE_ENABLED','JENIOS_INTER_CHARGES_ENABLED',
 'JENIOS_PAY_PAYMENTS_ENABLED','JENIOS_REAL_EXECUTION_ENABLED',
 'JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
 'JENIOS_PRO_GENERATION_ENABLED','JENIOS_PRO_PAYMENTS_ENABLED',
 'JENIOS_QA_CANDIDATE_ENABLED','JENIOS_DEMO_CONNECTORS_ENABLED'
];
const env=()=>({
 VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:B291,
 NEXT_PUBLIC_SUPABASE_URL:SQA,SOCIAL_SUPABASE_URL:SQA,
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_qa_test_public_key',
 NEXT_PUBLIC_PLATFORM_SUPABASE_URL:PQA,
 NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_qa_platform_public_key',
 NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED:'false',
 JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'true',
 JENIOS_PAY_PROVIDER:'disabled',
 ...Object.fromEntries(OFF.map(k=>[k,'false']))
});
test('B291 exact preview branch with QA Social and Platform and no external execution is allowed',()=>{
 assert.deepEqual(checkS05DeploymentScope(env()),{ok:true,mode:'preview-isolated-b291-qa'});
});
test('B291 no unknown, research, prior future or fake release branch may inherit Preview',()=>{
 for(const value of ['fix/b291-other','fix/jenios-b290qa-financial-proof-20261021',
  'fix/jenios-b289-reverse-operator-stress-lab-20261021','main','release/unreviewed'])
  assert.equal(checkS05DeploymentScope({...env(),VERCEL_GIT_COMMIT_REF:value}).ok,false);
});
test('B291 new Preview branch can never reach production, even with production-looking values',()=>{
 const candidate={...env(),VERCEL_ENV:'production'};
 assert.equal(checkS05DeploymentScope(candidate).ok,false);
 const prod='https://igayfjorjmucthlfoasf.supabase.co';
 assert.equal(checkS05DeploymentScope({...candidate,NEXT_PUBLIC_SUPABASE_URL:prod,SOCIAL_SUPABASE_URL:prod}).ok,false);
});
test('B291 wrong Social QA, production URL, mixed Platform or missing public keys are blocked',()=>{
 for(const patch of [
 {NEXT_PUBLIC_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'},
 {SOCIAL_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'},
 {NEXT_PUBLIC_PLATFORM_SUPABASE_URL:SQA},
 {NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://igayfjorjmucthlfoasf.supabase.co'},
 {NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:''},
 {NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''}
 ])assert.equal(checkS05DeploymentScope({...env(),...patch}).ok,false);
});
test('B291 every model, money, paper and demo execution flag must be explicitly false',()=>{
 for(const key of OFF){
  assert.equal(checkS05DeploymentScope({...env(),[key]:'true'}).ok,false,key);
  assert.equal(checkS05DeploymentScope({...env(),[key]:undefined}).ok,false,key);
 }
});
test('B291 strict receipt gate must be explicitly enabled; signup and payment gateway disabled',()=>{
 const patches=[
 {JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'false'},
 {JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:undefined},
 {NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED:'true'},
 {NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED:undefined},
 {JENIOS_PAY_PROVIDER:'inter_pix'},
 {JENIOS_PAY_PROVIDER:undefined}
 ];
 for(const patch of patches)assert.equal(checkS05DeploymentScope({...env(),...patch}).ok,false);
});
test('B291 existing B288 isolated preview permission remains untouched',()=>{
 const previous={...env(),VERCEL_GIT_COMMIT_REF:'fix/jenios-b288-r2-preview-isolation-20261021',
  JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:undefined,JENIOS_PAY_PROVIDER:undefined};
 assert.equal(checkS05DeploymentScope(previous).ok,true);
});
test('B291 only expected files may differ and all high-risk systems remain protected',()=>{
 const scope=readFileSync(new URL('../scripts/platform/b291-integrity.mjs',import.meta.url),'utf8');
 for(const path of [
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs','lib/learning/engine.mjs',
 'app/social/page.js','app/api/jenios-pay/checkout/route.js',
 'lib/platform/research/b281-first-hour-observation.mjs'
 ])assert.ok(scope.includes(path),path);
 const pdf=readFileSync(new URL('../docs/platform/B291-QA-INTEGRATED-LAUNCH-CANDIDATE.md',import.meta.url),'utf8');
 assert.match(pdf,/não autoriza o lançamento comercial/i);
});

test('B291 all production service entrypoints propagate explicit strict QA receipt flag',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 for(const path of ['lib/learning/access.mjs','lib/assistant/university-subscription.mjs','lib/assistant/pro-service.mjs']){
  const source=read(path);
  assert.ok(source.includes("strict:env?.JENIOS_QA_STRICT_SUBSCRIPTION_PROOF==='true'"),path);
 }
 const legacy=read('tests/learningR26.test.mjs');
 assert.ok(legacy.includes("JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'false'"));
 assert.ok(read('lib/assistant/pro-access.mjs').includes("verifiedPlatformEvidenceB290"));
});
