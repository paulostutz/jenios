import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handlePro} from '../lib/assistant/pro-service.mjs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const proofFlag="strict:env?.JENIOS_QA_STRICT_SUBSCRIPTION_PROOF==='true'";

test('B292: all paid-access server entrypoints propagate explicit strict receipt mode',()=>{
 const paths=[
  'lib/assistant/pro-service.mjs',
  'lib/assistant/university-subscription.mjs',
  'lib/learning/access.mjs'
 ];
 for(const path of paths)assert.ok(read(path).includes(proofFlag),path);
 assert.equal(read(paths[0]).split(proofFlag).length-1,2);
 assert.match(read('lib/assistant/pro-access.mjs'),/verifiedPlatformEvidenceB290/);
});

test('B292: Pro access resolver receives QA receipt flag and rejects unverified paid entitlement',async()=>{
 let strictSeen=null;
 const response=await handlePro(new Request('https://qa.invalid/api/assistant/pro/access'),{
  action:'access',db:{},planOnly:true,now:Date.parse('2026-10-21T20:00:00Z'),
  env:{JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'true',JENIOS_PRO_GENERATION_ENABLED:'false'},
  authorize:async()=>({id:'00000000-0000-4000-8000-000000009001',is_anonymous:false}),
  repository:()=>({config:async()=>({installed:false,generationEnabled:false,requiresReconciliation:false,allowedModels:[]})}),
  planResolver:async(_db,_user,_now,options)=>{strictSeen=options?.strict;return null;},
  passResolver:async()=>null
 });
 assert.equal(strictSeen,true);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.proIncluded,false);
 assert.equal(body.universityIncluded,false);
 assert.equal(body.paidGenerationEnabled,false);
});

test('B292: strict mode cannot be disabled at build scope for B291 Preview',()=>{
 const src=read('lib/release/environment-scope.mjs');
 const testScript=read('scripts/platform/b291-qa-test-context.mjs');
 assert.match(src,/B291_QA_REQUIRES_STRICT_PROOF_AND_DISABLED_EXTERNAL_SERVICES/);
 assert.match(testScript,/B291_QA_CANNOT_BUILD_WITHOUT_FINANCIAL_PROOF/);
 assert.match(testScript,/JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'false'/);
 assert.equal(checkS05DeploymentScope({
  VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'fix/jenios-b291qa-integrated-preview-20261021',
  NEXT_PUBLIC_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  SOCIAL_SUPABASE_URL:'https://rebzztxlzofxpfwjvbee.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'publishable_qa_fixture',
  NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
  NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'publishable_platform_fixture',
  JENIOS_QA_STRICT_SUBSCRIPTION_PROOF:'false',
  NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED:'false',
  JENIOS_PAY_PROVIDER:'disabled',JENIOS_PRO_GENERATION_ENABLED:'false',
  JENIOS_QA_CANDIDATE_ENABLED:'false',
  JENIOS_SALES_GENERATIVE_ENABLED:'false',JENIOS_INTER_CHARGES_ENABLED:'false',
  JENIOS_PAY_PAYMENTS_ENABLED:'false',JENIOS_REAL_EXECUTION_ENABLED:'false',JENIOS_PRIVATE_PAPER_EXECUTOR:'false'
 }).ok,false);
});
