import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  R73_BRANCH, isR73AdministrationEnabled, createR73AdminStatusHandler
} from '../lib/platform/research/robot-r73-definitive-status.mjs';

const prod = {
  VERCEL_ENV:'production',
  VERCEL_PROJECT_ID:'prj_44ipBY3R9sHlQDAXY7NUn1zDguw4',
  VERCEL_GIT_COMMIT_REF:'release/jenios-genios-g44-20261024',
  JENIOS_ROBOT_R73_ADMIN_ENABLED:'true',
  PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
  NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://xaicvhagftzjkqphnbgx.supabase.co',
  JENIOS_REAL_EXECUTION_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED:'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR:'false',
  JENIOS_ROBOT_ANALYST_PAID_ENABLED:'false',
};
const contentAt = path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('R75 retains exact active G49 release and dedicated Platform only',()=>{
  assert.equal(R73_BRANCH,prod.VERCEL_GIT_COMMIT_REF);
  assert.equal(isR73AdministrationEnabled(prod),true);
  for(const patch of [
    {VERCEL_ENV:'preview'},
    {VERCEL_PROJECT_ID:'another-project'},
    {VERCEL_GIT_COMMIT_REF:'main'},
    {VERCEL_GIT_COMMIT_REF:'release/jenios-robot-r73-definitive-app-20261024'},
    {PLATFORM_SUPABASE_URL:'https://other.supabase.co'},
    {NEXT_PUBLIC_PLATFORM_SUPABASE_URL:'https://other.supabase.co'},
    {JENIOS_ROBOT_R73_ADMIN_ENABLED:'false'},
    {JENIOS_ROBOT_R73_ADMIN_ENABLED:undefined},
    ...['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
      'JENIOS_PRIVATE_PAPER_EXECUTOR','JENIOS_ROBOT_ANALYST_PAID_ENABLED']
      .flatMap(key=>[{[key]:'true'},{[key]:undefined}])
  ]) assert.equal(isR73AdministrationEnabled({...prod,...patch}),false,JSON.stringify(patch));
});

test('R75 unauthenticated GET never initializes dedicated privileged database',async()=>{
  let opened=0;
  const handler=createR73AdminStatusHandler({
    env:prod, getDb(){opened++;throw Error('R75_PRIVILEGED_DB_MUST_NOT_OPEN')}
  });
  const response=await handler(new Request('https://jenios.test/api/platform/admin/robots/status'));
  assert.equal(response.status,401);
  assert.equal(opened,0);
  assert.doesNotMatch(await response.text(),/R75_PRIVILEGED_DB_MUST_NOT_OPEN/);
});

test('R75 keeps robot administration read-only and separated from web trading',()=>{
  const api=contentAt('app/api/platform/admin/robots/status/route.js');
  const page=contentAt('app/platform/admin/robos/page.js');
  const component=contentAt('app/components/platform/PlatformRobotDefinitiveAdmin.js');
  const hub=contentAt('app/platform/admin/page.js');
  const login=contentAt('app/platform/entrar/page.js');
  assert.match(api,/export const GET = createR73AdminStatusHandler/);
  assert.doesNotMatch(api,/export const (POST|PUT|DELETE|PATCH)/);
  assert.match(page,/PlatformRobotDefinitiveAdmin/);
  assert.match(hub,/\/platform\/admin\/robos/);
  assert.match(component,/\/api\/platform\/admin\/robots\/status/);
  assert.doesNotMatch(component,/PLATFORM_SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/);
  assert.match(login,/params\.get\('dedicated'\)==='1'/);
  assert.match(login,/if\(!dedicatedRequested\)/);
});

test('R75 restores certified R73 read-only interface without treating R74 synthetic cycles as Live',()=>{
  const s=contentAt('lib/platform/research/robot-r73-definitive-status.mjs');
  assert.match(s,/customerMonitoringActive: false/);
  assert.match(s,/realOrdersEnabled: false/);
  assert.match(s,/actualBrokerPnl: null/);
  assert.match(s,/requirePlatformAdmin\(request, db, 'platform\.admin'\)/);
});
