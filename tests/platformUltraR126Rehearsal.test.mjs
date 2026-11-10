import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REHEARSAL_ROUTES,rehearsalReport,OPERATION_STATES} from '../lib/platform/ultra/rehearsal-r126.mjs';
import {socialAuthReturnPath} from '../app/components/social-auth-return.mjs';
import {rehearseR126} from '../scripts/platform/ultra/rehearse-r126.mjs';
const now=new Date('2026-11-10T20:00:00Z');
for(const route of REHEARSAL_ROUTES)test('R126 fixture accounting and states: '+route.id,()=>{
 const r=rehearsalReport(route.id,now);assert.equal(r.evidence,'synthetic_ui_fixture_only');assert.equal(r.accountConnected,false);assert.equal(r.ordersSentToBroker,0);assert.equal(r.billingEnabled,false);
 assert.equal(r.report.environment,'demo');assert.equal(r.view.count,9);assert.equal(r.view.openCount,2);assert.equal(r.view.uncertainCount,2);assert.equal(r.view.awaitingCosts,1);
 assert.equal(r.view.totals.length,1);assert.equal(r.view.totals[0].currency,route.currency);assert.equal(r.view.totals[0].net,'0.19000000');assert.equal(r.view.totals[0].operations,1);
 assert.deepEqual([...new Set(r.view.operations.map(o=>o.state))].sort(),Object.keys(OPERATION_STATES).sort());assert.ok(r.report.operations.every(o=>o.id.startsWith('FIXTURE_')&&o.market!=='forex'));
});
test('R126 repeated examples are isolated and invalid routes cannot substitute a broker',()=>{
 const a=rehearsalReport('mt5',now);a.report.operations[0].symbol='MUTATED';const b=rehearsalReport('mt5',now);assert.notEqual(b.report.operations[0].symbol,'MUTATED');
 for(const invalid of ['','genial','forex','live',{},null])assert.throws(()=>rehearsalReport(invalid,now),/INVALID_REHEARSAL_ROUTE/);
 assert.throws(()=>rehearsalReport('mt5',new Date('invalid')),/INVALID_REHEARSAL_ROUTE/);
});
test('R126 runtime rehearsal covers 18 checks with no native execution',async()=>{
 const result=await rehearseR126();assert.equal(result.report.passed,true);assert.equal(result.report.checks.length,18);assert.equal(result.report.ordersSentToBroker,0);
 for(const flag of ['nativeValidated','liveExecutionEnabled','externalPaperEnabled','billingEnabled'])assert.equal(result.report[flag],false);
 assert.ok(result.report.checks.every(c=>c.passed&&c.ordersSentToBroker===0));assert.equal(new Set(result.report.checks.map(c=>c.provider+'/'+c.scenario)).size,18);
 const again=await rehearseR126();assert.notEqual(result.directory,again.directory);
});
test('R126 UI uses dedicated existing authentication, no network or persistent fixture storage',()=>{
 const page=readFileSync('app/platform/ultra/teste/page.js','utf8'),ui=readFileSync('app/components/platform/UltraRehearsalR126.js','utf8');
 assert.match(page,/PlatformAuthGuard returnTo="\/platform\/ultra\/teste" requireDedicated/);assert.match(ui,/EXEMPLO|exemplo fictício/);assert.match(ui,/onChange=\{event=>\{reset\(\);setRoute/);
 assert.doesNotMatch(ui,/fetch\(|localStorage|sessionStorage|telemetry|WebSocket|supabase/i);assert.match(ui,/nenhuma ordem ou cobrança/);assert.match(ui,/Limpar teste/);assert.match(ui,/Voltar ao Ultra/);
});

test('R126 login return accepts only the exact test destination',()=>{assert.equal(socialAuthReturnPath('/platform/ultra/teste'),'/platform/ultra/teste');for(const p of ['/platform/ultra/teste/other','//external.example','https://external.example'])assert.equal(socialAuthReturnPath(p),'/social');});

test('R126 test login remains dedicated after interrupted navigation',()=>{const login=readFileSync('app/platform/entrar/page.js','utf8');assert.match(login,/target==='\/platform\/ultra\/teste'/);assert.match(login,/destination!=='\/platform\/ultra'&&destination!=='\/platform\/ultra\/teste'&&<button/);});
