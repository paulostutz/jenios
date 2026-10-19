import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readSimJournal,appendSimIntention} from '../lib/platform/simulation-journal.mjs';
import {
 DEFAULT_SIMULATED_BALANCE,readSimulatedBalance,writeSimulatedBalance,
 readSimulationPaused,writeSimulationPaused
} from '../lib/platform/simulation-account.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const memory=()=>{const map=new Map();return{
 getItem:key=>map.has(key)?map.get(key):null,
 setItem:(key,value)=>map.set(key,String(value)),
 removeItem:key=>map.delete(key)
};};

test('R45-B71 Platform logged dashboard inherits independent authenticated guard from layout',()=>{
 const layout=read('app/dashboard-logado/layout.js');
 const guard=read('app/components/platform/PlatformAuthGuard.js');
 const page=read('app/dashboard-logado/page.js');
 assert.match(layout,/import PlatformAuthGuard/);
 assert.match(layout,/<PlatformAuthGuard>\{children\}<\/PlatformAuthGuard>/);
 assert.match(guard,/platformSupabase\.auth\.getUser\(\)/);
 assert.match(guard,/router\.replace\('\/platform\/entrar'\)/);
 assert.doesNotMatch(guard,/from ['"](?:\.\.\/)+lib\/supabase['"]/);
 assert.match(page,/PlatformSimulationSummary/);
 assert.match(page,/setPlatformUserId\(status\.userId\|\|null\)/);
 assert.match(page,/<PlatformSimulationSummary userId=\{platformUserId\}/);
});

test('R45-B71 summary shares same virtual account and journal, never browser trading API',()=>{
 const component=read('app/components/platform/PlatformSimulationSummary.js');
 for(const expression of [
  /readSimJournal\(storage,userId\)/,
  /readSimulatedBalance\(storage,userId\)/,
  /readSimulationPaused\(storage,userId\)/,
  /writeSimulationPaused\(window\.sessionStorage,userId/,
  /writeSimulatedBalance\(window\.sessionStorage,userId/,
  /clearSimJournal\(window\.sessionStorage,userId\)/
 ])assert.match(component,expression);
 assert.match(component,/Últimas intenções simuladas/);
 assert.match(component,/Saldo virtual da sessão/);
 assert.match(component,/Sair da Platform apaga/);
 assert.doesNotMatch(component,/\/api\/broker|signInWithPassword|service_role|getJeniosPayAdmin|localStorage/);
});

test('R45-B71 one account sees its capital and pause in both trading screens',()=>{
 const store=memory();
 assert.equal(readSimulatedBalance(store,'account-a'),DEFAULT_SIMULATED_BALANCE);
 assert.equal(writeSimulatedBalance(store,'account-a',63000),true);
 assert.equal(writeSimulationPaused(store,'account-a',true),true);
 assert.equal(readSimulatedBalance(store,'account-a'),63000);
 assert.equal(readSimulationPaused(store,'account-a'),true);
 assert.equal(readSimulatedBalance(store,'account-b'),DEFAULT_SIMULATED_BALANCE);
 assert.equal(readSimulationPaused(store,'account-b'),false);
 assert.equal(writeSimulationPaused(store,'account-a',false),true);
 assert.equal(readSimulationPaused(store,'account-a'),false);
});
test('R45-B71 journal cannot cross user identity or invent executed trades',()=>{
 const store=memory();
 const recorded=appendSimIntention(store,'account-a',{ativo:'WIN1!',direcao:'COMPRA',modo:'manual',valor:1500},
  new Date('2026-10-19T12:00:00.000Z'));
 assert.equal(recorded.ok,true);
 assert.equal(readSimJournal(store,'account-a').length,1);
 assert.deepEqual(readSimJournal(store,'account-b'),[]);
 assert.equal(readSimJournal(store,'account-a')[0].executed,false);
 assert.equal(readSimJournal(store,'account-a')[0].verified,false);
});
test('R45-B71 browser regression never displays private account summary without isolated auth',()=>{
 const browser=read('scripts/platform/cp69-browser-smoke.mjs');
 assert.match(browser,/Isolated Platform simulation portal is never painted/);
 assert.match(browser,/Unauthenticated Platform user is redirected/);
 const layout=read('app/dashboard-logado/layout.js');
 assert.doesNotMatch(layout,/SocialAuthGuard/);
});
