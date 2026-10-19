import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluatePrivateAcceptance,OFFLINE_CRITERIA,AUTH_CRITERIA,TRADING_CRITERIA} from '../lib/platform/private-acceptance.mjs';
import {getJeniosPlatformAdmin} from '../lib/platform/admin-db.mjs';
import {adminPermissions,requireAdminPermission} from '../lib/admin-access.mjs';
import {classifyServerDiagnostic} from '../lib/platform/diagnostic-server.mjs';
import {summarizeVerifiedRisk} from '../lib/platform/risk-evidence.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const offline=Object.fromEntries(OFFLINE_CRITERIA.map(k=>[k,true]));
const all=Object.fromEntries([...OFFLINE_CRITERIA,...AUTH_CRITERIA,...TRADING_CRITERIA].map(k=>[k,true]));

test('B67 reports missing evidence, not fake success',()=>{
 const s=evaluatePrivateAcceptance();
 assert.equal(s.privateOfflineReady,false);
 assert.equal(s.authenticatedHomologationReady,false);
 assert.equal(s.realTradingReady,false);
 assert.equal(s.noGoForMoney,true);
});
test('B67 offline pass never implies authenticated Supabase',()=>{
 const s=evaluatePrivateAcceptance(offline);
 assert.equal(s.privateOfflineReady,true);
 assert.equal(s.authenticatedHomologationReady,false);
 assert.equal(s.realTradingReady,false);
 assert.deepEqual(s.unverifiedCriteria.authentication,[...AUTH_CRITERIA]);
});
test('B67 partial auth evidence does not certify authentication',()=>{
 const s=evaluatePrivateAcceptance({...offline,dedicatedPlatformSupabase:true});
 assert.equal(s.authenticatedHomologationReady,false);
});
test('B67 truthy strings do not count as evidence',()=>{
 const s=evaluatePrivateAcceptance({...offline,nextBuild:'yes'});
 assert.equal(s.privateOfflineReady,false);
});
test('B67 authentication alone does not approve real trading',()=>{
 const auth=Object.fromEntries(AUTH_CRITERIA.map(k=>[k,true]));
 const s=evaluatePrivateAcceptance({...offline,...auth});
 assert.equal(s.authenticatedHomologationReady,true);
 assert.equal(s.realTradingReady,false);
});
test('B67 real-trading eligibility requires all independently verified gates',()=>{
 const s=evaluatePrivateAcceptance(all);
 assert.equal(s.realTradingReady,true);
 assert.equal(s.noGoForMoney,false);
 assert.equal(s.unverifiedCriteria.trading.length,0);
});
test('B67 standalone Platform DB connection requires own server secrets',()=>{
 assert.throws(()=>getJeniosPlatformAdmin({}),{status:503});
 assert.throws(()=>getJeniosPlatformAdmin({NEXT_PUBLIC_SUPABASE_URL:'https://example.com',SUPABASE_SERVICE_ROLE_KEY:'x'}),{status:503});
});
test('B67 invalid Platform URL cannot create database connector',()=>{
 assert.throws(()=>getJeniosPlatformAdmin({PLATFORM_SUPABASE_URL:'http://example.com',PLATFORM_SUPABASE_SERVICE_ROLE_KEY:'fake'}),{status:503});
});
test('B67 platform-only API routes import only its own DB helper',()=>{
 for(const path of ['app/api/platform/diagnostico/route.js','app/api/platform/risk-summary/route.js']){
  const s=read(path);
  assert.match(s,/getJeniosPlatformAdmin/);
  assert.doesNotMatch(s,/getJeniosPayAdmin|jenios-pay-admin|SUPABASE_SERVICE_ROLE_KEY/);
 }
});
test('B67 risk summary is GET-only, no public mutations',()=>{
 const s=read('app/api/platform/risk-summary/route.js');
 assert.match(s,/export async function GET/);
 assert.doesNotMatch(s,/export async function POST|export async function DELETE|export async function PATCH/);
});
test('B67 diagnostic POST requires authenticated server user',()=>{
 const s=read('app/api/platform/diagnostico/route.js');
 assert.match(s,/requirePayUser\(request,db\)/);
 assert.match(s,/readPlatformJson\(request\)/);
});
test('B67 unverified report cannot enable a broker order',()=>{
 const c=classifyServerDiagnostic({answers:[4,4,4,4,4],timeframe:'SWING'});
 assert.equal(c.initial_mode,'manual');
 assert.equal('executionAuthorized' in c,false);
 assert.equal('allowRealTrade' in c,false);
});
test('B67 risk blocks cannot be equated with real savings',()=>{
 const s=summarizeVerifiedRisk([{id:'x',kind:'risk_block',source:'broker_confirmed',verified_at:'2026-10-19T02:00:00Z'}]);
 assert.equal(s.verifiedBlocks,1);
 assert.equal(s.avoidedLossBRL,null);
});
test('B67 administrator privileges remain outside client profile fields',async()=>{
 const user={id:'A',user_metadata:{role:'admin'},app_metadata:{}};
 const db={from(){return{select(){return{eq(){return Promise.resolve({data:[],error:null});}};}};}};
 assert.deepEqual(await adminPermissions(db,user,{}),[]);
});
test('B67 no Social functionality was modified in CP67 scope',()=>{
 const s=read('app/admin/page.js');
 assert.match(s,/AdminAccess/);
 assert.doesNotMatch(s,/Carlos Silva|admin123|R\$ 142\.850/);
});
test('B67 diagnostic and Mesa never promise real execution via client',()=>{
 const d=read('app/dashboard/page.js'),m=read('app/mesa-operacoes/page.js');
 assert.match(d,/tipoConta !== 'simulada'/);
 assert.match(m,/tipoConta !== 'simulada'/);
 assert.doesNotMatch(d,/Roteamento HFT via API executado/);
 assert.doesNotMatch(m,/Conta real conectada com sucesso/);
});
test('B67 browser smoke covers desktop, tablet and mobile',()=>{
 const s=read('scripts/platform/cp67-browser-smoke.mjs');
 assert.match(s,/width:1440/);assert.match(s,/width:768/);assert.match(s,/width:390/);
 assert.match(s,/Returning to Dashboard preserves both fictitious decisions/);
});
test('B67 session scopes are separated across both trading interfaces',()=>{
 const d=read('app/dashboard/page.js'),m=read('app/mesa-operacoes/page.js');
 assert.match(d,/readSimJournal\(window.sessionStorage,status.userId\)/);
 assert.match(m,/readSimJournal\(window.sessionStorage,status.userId\)/);
});
