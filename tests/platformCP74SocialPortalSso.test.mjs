import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {socialSimulationOwner,resolveSocialPortalEntry,loadUnifiedSimulationDiagnostic}
 from '../lib/platform/unified-entry.mjs';
import {readSimJournal,appendSimIntention} from '../lib/platform/simulation-journal.mjs';
import {readSimulatedBalance,writeSimulatedBalance} from '../lib/platform/simulation-account.mjs';

const id='123e4567-e89b-42d3-a456-426614174000';
const other='123e4567-e89b-42d3-a456-426614174001';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const client=(ids=[id,id])=>{
 let calls=0;
 return {auth:{async getUser(){return{data:{user:{id:ids[Math.min(calls++,ids.length-1)],
  email:'ficticio@example.com',is_anonymous:false}},error:null};}},
 from(){return{}}};
};
const ready=async()=>({status:'ready',userId:id});
const memory=()=>{const m=new Map();return{setItem:(k,v)=>m.set(k,String(v)),getItem:k=>m.get(k)||null,removeItem:k=>m.delete(k)};};

test('B74 only remotely validated Social identity with an existing Social profile enters control room',async()=>{
 const access=await resolveSocialPortalEntry(client(),ready);
 assert.equal(access.source,'social');
 assert.equal(access.userId,'social_'+id);
 assert.equal(access.authUserId,id);
 assert.equal(access.label,'ficticio');
});
test('B74 signed-in user without Social profile cannot enter via Social fallback',async()=>{
 assert.equal(await resolveSocialPortalEntry(client(),async()=>({status:'profile-missing',userId:id})),null);
 assert.equal(await resolveSocialPortalEntry(client(),async()=>({status:'guest',userId:''})),null);
 assert.equal(await resolveSocialPortalEntry(client(),async()=>({status:'unavailable',userId:''})),null);
});
test('B74 changing identity between profile check and second verification denies access',async()=>{
 assert.equal(await resolveSocialPortalEntry(client([other]),ready),null);
 const anonymous={auth:{async getUser(){return{data:{user:{id,is_anonymous:true}}};}},from(){return{}}};
 assert.equal(await resolveSocialPortalEntry(anonymous,ready),null);
});
test('B74 Social simulation data remain account scoped and never become orders',()=>{
 assert.equal(socialSimulationOwner(id),'social_'+id);
 assert.equal(socialSimulationOwner(other),'social_'+other);
 assert.equal(socialSimulationOwner('../../invalid'),null);
 const storage=memory();
 assert.equal(writeSimulatedBalance(storage,socialSimulationOwner(id),85000),true);
 assert.equal(readSimulatedBalance(storage,socialSimulationOwner(other)),100000);
 const recorded=appendSimIntention(storage,socialSimulationOwner(id),
  {ativo:'WIN1!',direcao:'COMPRA',modo:'manual',valor:1200},
  new Date('2026-10-19T12:00:00Z'));
 assert.equal(recorded.ok,true);
 assert.equal(readSimJournal(storage,socialSimulationOwner(other)).length,0);
 assert.equal(recorded.events[0].executed,false);
});
test('B74 Social entry never fabricates a verified Platform diagnostic',async()=>{
 let platformCalled=false;
 const r=await loadUnifiedSimulationDiagnostic({},async()=>{platformCalled=true;return{};},
  async()=>({source:'social',userId:socialSimulationOwner(id)}));
 assert.equal(platformCalled,false);
 assert.equal(r.userId,socialSimulationOwner(id));
 assert.equal(r.verified,false);
 assert.equal(r.reason,'social_simulation_only');
});
test('B74 Platform diagnostic remains independent when no verified Social identity',async()=>{
 const expected={verified:true,userId:'platform-account',mode:'manual'};
 const r=await loadUnifiedSimulationDiagnostic({},async()=>expected,async()=>null);
 assert.deepEqual(r,expected);
});
test('B74 logged control room checks both accounts but never uses Social role as Platform admin',()=>{
 const guard=read('app/components/platform/PlatformAuthGuard.js');
 const dashboard=read('app/dashboard-logado/page.js');
 assert.match(guard,/resolveSocialPortalEntry\(\)/);
 assert.match(guard,/platformSupabase\.auth\.getUser\(\)/);
 assert.match(guard,/router\.replace\('\/platform\/entrar'\)/);
 assert.match(dashboard,/usePlatformPortalEntry/);
 assert.match(dashboard,/socialSession/);
 assert.match(dashboard,/PlatformSimulationSummary/);
 assert.match(dashboard,/!socialSession\s*&&\s*<PlatformAdminShortcut/);
 assert.match(dashboard,/!socialSession\s*&&\s*<PlatformBillingStatus/);
});
test('B74 public Dashboard and Mesa use verified Social owner but remain demo-only',()=>{
 for(const path of ['app/dashboard/page.js','app/mesa-operacoes/page.js']){
  const source=read(path);
  assert.match(source,/loadUnifiedSimulationDiagnostic/);
  assert.match(source,/tipoConta !== 'simulada'/);
  assert.doesNotMatch(source,/fetch\('\/api\/broker\/place-order'\)/);
 }
});
test('B74 BankScore and Token Validator use same server-verified profile gate',()=>{
 const bank=read('app/api/bankscore/detailed/route.js');
 const crypto=read('app/api/crypto-validator/detailed/route.js');
 const gate=read('lib/reports/prelaunch-access.mjs');
 for(const api of [bank,crypto]){
  assert.match(api,/requirePrelaunchReportAccess/);
  assert.match(api,/requirePayUser\(request,db\)/);
 }
 assert.match(gate,/db\.from\('profiles'\)\.select\('id'\)/);
 assert.match(gate,/profile\?\.id !== user\.id/);
});
test('B74 production profile grant is server-only, column-limited, reversible',()=>{
 const d=read('docs/platform/B74-SOCIAL-SSO-RELATORIOS.md');
 assert.match(d,/GRANT SELECT \(id\) ON TABLE public\.profiles TO service_role/);
 assert.match(d,/REVOKE SELECT \(id\) ON TABLE public\.profiles FROM service_role/);
 assert.doesNotMatch(d,/GRANT .* TO anon/);
});
