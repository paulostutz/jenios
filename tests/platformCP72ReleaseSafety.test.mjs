import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkS05DeploymentScope} from '../lib/release/environment-scope.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const SOCIAL='https://igayfjorjmucthlfoasf.supabase.co';
const QA='https://rebzztxlzofxpfwjvbee.supabase.co';
const PLATFORM='https://xaicvhagftzjkqphnbgx.supabase.co';
const integration='release/jenios-s05-platform-cp70-integracao-20261019';
const production={
 VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:integration,
 NEXT_PUBLIC_SUPABASE_URL:SOCIAL,SOCIAL_SUPABASE_URL:SOCIAL,
 SUPABASE_SECRET_KEY:'fixture-social-not-real',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture',
 JENIOS_S05_SCHEMA_CERTIFIED:'true',JENIOS_S05_E2E_CERTIFIED:'true',
 PLATFORM_SUPABASE_URL:PLATFORM,NEXT_PUBLIC_PLATFORM_SUPABASE_URL:PLATFORM,
 NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:'fixture',
 PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'fixture-only-not-real-private-key'
};
const check=(p={})=>checkS05DeploymentScope({...production,...p});

test('R45-B72 release readiness fixtures are never actual credentials',()=>{
 assert.deepEqual(check(),{ok:true,mode:'production-s05-platform-dedicated-auth-ready'});
 assert.match(production.PLATFORM_SUPABASE_SERVICE_ROLE_KEY,/^fixture-only/);
});
test('R45-B72 missing private Platform server secret blocks production release',()=>{
 for(const key of [undefined,'','short'])assert.equal(
  check({PLATFORM_SUPABASE_SERVICE_ROLE_KEY:key}).reason,'PLATFORM_PRODUCTION_SERVER_SECRET_MISSING');
});
test('R45-B72 dedicated Platform backend never accepts the Social instances',()=>{
 for(const url of [SOCIAL,QA,'https://example.invalid']){
  assert.equal(check({PLATFORM_SUPABASE_URL:url}).reason,'PLATFORM_PRODUCTION_DEDICATED_SUPABASE_URL_MISSING');
  assert.equal(check({NEXT_PUBLIC_PLATFORM_SUPABASE_URL:url}).reason,'PLATFORM_PRODUCTION_DEDICATED_SUPABASE_URL_MISSING');
 }
 assert.equal(check({NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY:undefined}).reason,'PLATFORM_PRODUCTION_PUBLIC_KEY_MISSING');
});
test('R45-B72 production never uses Social QA as its backend',()=>{
 assert.equal(check({NEXT_PUBLIC_SUPABASE_URL:QA}).reason,'S05_PRODUCTION_SUPABASE_SCOPE_NOT_CONFIRMED');
 assert.equal(check({SOCIAL_SUPABASE_URL:QA}).reason,'S05_PRODUCTION_SUPABASE_SCOPE_NOT_CONFIRMED');
});
test('R45-B72 existing Social S05 product safety requirements remain enforced',()=>{
 assert.equal(check({JENIOS_S05_SCHEMA_CERTIFIED:'false'}).reason,'S05_PRODUCTION_GATES_NOT_CERTIFIED');
 assert.equal(check({JENIOS_S05_E2E_CERTIFIED:'false'}).reason,'S05_PRODUCTION_GATES_NOT_CERTIFIED');
 assert.equal(check({JENIOS_TRIAL_ENABLED:'true'}).reason,'S05_TRIAL_NOT_CERTIFIED');
 assert.equal(check({JENIOS_TRIAL_ACTIVATION_APPROVED:'true'}).reason,'S05_TRIAL_NOT_CERTIFIED');
 assert.equal(check({NEXT_PUBLIC_SOCIAL_OPTIMIZED_VIDEO:'true'}).reason,'S05_FFMPEG_OPTIMIZATION_NOT_CERTIFIED');
 assert.equal(check({JENIOS_PAY_PAYMENTS_ENABLED:'true'}).reason,'S05_PRODUCTION_ACTIVE_INTER_CREDENTIALS_MISSING');
});
test('R45-B72 production is branch locked and has documented domain rollback',()=>{
 assert.equal(check({VERCEL_GIT_COMMIT_REF:'main'}).reason,'S05_PRODUCTION_RELEASE_BRANCH_NOT_CONFIRMED');
 const guide=read('docs/platform/R45-B72-PUBLICACAO-CONTROLADA.md');
 for(const str of ['jenios-ecossistem','prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
  'f4232312a6704aa27ba4d2fc0d0e6181bba0a426',
  '7710ab233765eb3568a1af7dfa8125f2a94799dc',
  'sem associar o domínio antes da validação'])assert.ok(guide.includes(str),str);
});
test('R45-B72 private dashboard cannot reuse the Social account session',()=>{
 const client=read('lib/platform/supabase-client.js');
 const guard=read('app/components/platform/PlatformAuthGuard.js');
 const layout=read('app/dashboard-logado/layout.js');
 assert.match(client,/storageKey:'jenios-platform-auth-v1'/);
 assert.doesNotMatch(client,/SOCIAL_SUPABASE/);
 assert.match(guard,/platformSupabase\.auth\.getUser\(\)/);
 assert.match(guard,/router\.replace\('\/platform\/entrar'\)/);
 assert.match(layout,/<PlatformAuthGuard>\{children\}<\/PlatformAuthGuard>/);
});
test('R45-B72 backend without exclusive server key fails closed',()=>{
 const database=read('lib/platform/admin-db.mjs');
 const api=read('app/api/platform/diagnostico/route.js');
 assert.match(database,/env\.PLATFORM_SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(database,/env\.PLATFORM_SUPABASE_URL/);
 assert.doesNotMatch(database,/SOCIAL_SUPABASE|JENIOS_PAY|env\.SUPABASE_SECRET_KEY/);
 assert.match(database,/status:503/);
 assert.match(api,/getJeniosPlatformAdmin\(\)/);
 assert.match(api,/requirePayUser\(request,db\)/);
});
test('R45-B72 release regression retains protection of Social and the simulation',()=>{
 const workflow=read('.github/workflows/jenios-s05-platform-cp70-integration.yml');
 assert.match(workflow,/Assert original Social financial routes and files remain unchanged/);
 assert.match(workflow,/Social S05 release and API integrity regression/);
 assert.match(workflow,/Integration Chrome smoke across Simulator, Mesa and Admin/);
 assert.match(workflow,/Save integrity manifest of integrated source changes/);
 const ui=read('app/components/platform/PlatformSimulationSummary.js');
 assert.match(ui,/readSimJournal\(storage,userId\)/);
 assert.match(ui,/writeSimulationPaused\(window\.sessionStorage,userId/);
 assert.doesNotMatch(ui,/\/api\/broker\/|executeTrade|submitRealOrder/);
});
