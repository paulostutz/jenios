import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 DEFAULT_SIMULATED_BALANCE,MAX_SIMULATED_BALANCE,
 simulationBalanceKey,simulationPauseKey,readSimulatedBalance,writeSimulatedBalance,
 readSimulationPaused,writeSimulationPaused
} from '../lib/platform/simulation-account.mjs';

function memory(){
 const m=new Map();
 return {getItem:key=>m.has(key)?m.get(key):null,
  setItem:(key,val)=>m.set(key,String(val)),removeItem:key=>m.delete(key)};
}
const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('CP68 fake capital starts at 100000 without inherited Social values',()=>{
 const s=memory();s.setItem('jenios_saldo_simulado','99999999');
 assert.equal(readSimulatedBalance(s,'guest'),DEFAULT_SIMULATED_BALANCE);
 assert.equal(readSimulatedBalance(s,'userA'),DEFAULT_SIMULATED_BALANCE);
 assert.notEqual(simulationBalanceKey('userA'),'jenios_saldo_simulado');
});
test('CP68 simulated balances never mix between two user accounts',()=>{
 const s=memory();
 assert.equal(writeSimulatedBalance(s,'u-1',8000),true);
 assert.equal(writeSimulatedBalance(s,'u-2',4000),true);
 assert.equal(readSimulatedBalance(s,'u-1'),8000);
 assert.equal(readSimulatedBalance(s,'u-2'),4000);
 assert.equal(readSimulatedBalance(s,'guest'),DEFAULT_SIMULATED_BALANCE);
 assert.notEqual(simulationBalanceKey('u-1'),simulationBalanceKey('u-2'));
});
test('CP68 session pause is per account and starts off',()=>{
 const s=memory();
 assert.equal(readSimulationPaused(s,'a'),false);
 assert.equal(writeSimulationPaused(s,'a',true),true);
 assert.equal(readSimulationPaused(s,'a'),true);
 assert.equal(readSimulationPaused(s,'b'),false);
 assert.equal(readSimulationPaused(s,'guest'),false);
 assert.equal(writeSimulationPaused(s,'a',false),true);
 assert.equal(readSimulationPaused(s,'a'),false);
 assert.notEqual(simulationPauseKey('a'),simulationPauseKey('b'));
});
test('CP68 rejects unrepresentable fake capital and invalid pause inputs',()=>{
 const s=memory();
 for(const n of [-1,NaN,Infinity,MAX_SIMULATED_BALANCE+1,null,undefined,'', ' ','abc']){
  assert.equal(writeSimulatedBalance(s,'a',n),false);
 }
 assert.equal(readSimulatedBalance(s,'a'),DEFAULT_SIMULATED_BALANCE);
 assert.equal(writeSimulationPaused(s,'a','true'),false);
});
test('CP68 malformed previous state does not produce fictitious wealth',()=>{
 const s=memory();
 s.setItem(simulationBalanceKey('a'),'NaN');
 assert.equal(readSimulatedBalance(s,'a'),DEFAULT_SIMULATED_BALANCE);
 s.setItem(simulationBalanceKey('a'),'100000000000000');
 assert.equal(readSimulatedBalance(s,'a'),DEFAULT_SIMULATED_BALANCE);
});
test('CP68 local storage failure is safe and does not assert a saved pause',()=>{
 const s={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.equal(readSimulatedBalance(s,'a'),DEFAULT_SIMULATED_BALANCE);
 assert.equal(readSimulationPaused(s,'a'),false);
 assert.equal(writeSimulatedBalance(s,'a',123),false);
 assert.equal(writeSimulationPaused(s,'a',true),false);
});
test('CP68 both trading screens use same owner-specific virtual balance and pause',()=>{
 const d=text('app/dashboard/page.js'),m=text('app/mesa-operacoes/page.js');
 for(const screen of [d,m]){
  assert.match(screen,/readSimulatedBalance\(window\.sessionStorage,status\.userId\)/);
  assert.match(screen,/readSimulationPaused\(window\.sessionStorage,status\.userId\)/);
  assert.match(screen,/writeSimulatedBalance\(window\.sessionStorage,operadorId/);
  assert.match(screen,/writeSimulationPaused\(window\.sessionStorage,operadorId/);
  assert.match(screen,/readSimulationPaused\(window\.sessionStorage,operadorId\)/);
  assert.doesNotMatch(screen,/jenios_saldo_simulado|localStorage\.setItem\(/);
 }
});
test('CP68 only Platform account sees its own billing state',()=>{
 const d=text('app/dashboard-logado/page.js');
 const billing=text('app/components/platform/PlatformBillingStatus.js');
 assert.match(d,/PlatformBillingStatus/);
 assert.doesNotMatch(d,/PaymentStatement embedded|from '..\/components\/PaymentStatement'/);
 assert.doesNotMatch(billing,/jenios-pay\/orders|from ['"]\.\.\/\.\.\/\.\.\/lib\/supabase/);
 assert.match(billing,/O extrato da Social não é utilizado/);
});
test('CP68 preserves Social PaymentStatement source unchanged',()=>{
 const social=text('app/components/PaymentStatement.js');
 assert.match(social,/import \{ supabase \} from '..\/..\/lib\/supabase'/);
 assert.match(social,/api\/jenios-pay\/orders/);
});
test('CP68 Platform admin links require independent server permission',()=>{
 const shortcut=text('app/components/platform/PlatformAdminShortcut.js');
 assert.match(shortcut,/currentPlatformSession\(platformSupabase\)/);
 assert.match(shortcut,/api\/platform\/admin\/access/);
 assert.match(shortcut,/permissions\.includes\('platform\.admin'\)/);
 assert.match(text('app/dashboard-logado/page.js'),/PlatformAdminShortcut/);
});
test('CP68 Platform admin overview reads only dedicated server tables',()=>{
 const overview=text('app/api/platform/admin/overview/route.js');
 assert.match(overview,/requirePlatformAdmin\(request,db,'platform\.admin'\)/);
 for(const name of ['jenios_platform_diagnostics','jenios_platform_risk_events','jenios_platform_admin_permissions'])
  assert.match(overview,new RegExp(name));
 assert.doesNotMatch(overview,/getJeniosPayAdmin|from .*social|SocialModeration|export async function POST/);
 assert.match(overview,/count:'exact',head:true/);
});
test('CP68 admin overview UI refuses to invent monetary performance',()=>{
 const s=text('app/components/platform/PlatformAdminOverview.js');
 assert.match(s,/result\.verified!==true/);
 assert.match(s,/Number\.isSafeInteger\(result\[key\]\)/);
 assert.match(s,/Nenhum número foi presumido/);
 assert.match(s,/não é um valor de losses evitados/);
 const admin=text('app/platform/admin/page.js');
 assert.match(admin,/PlatformAdminOverview/);
});
test('CP68 real order gateway remains inaccessible to browser simulation',()=>{
 for(const screen of ['app/dashboard/page.js','app/mesa-operacoes/page.js']){
  const s=text(screen);assert.match(s,/tipoConta !== 'simulada'/);
  assert.doesNotMatch(s,/fetch\('\/api\/broker\/place-order'\)/);
 }
});
