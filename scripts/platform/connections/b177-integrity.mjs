import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const base='4ed83bfb6de0d2805d54601268c7752c8827afdb';
const allow=new Set([
 'lib/platform/pilot-prep/contracts.mjs',
 'lib/platform/connections/alpaca-paper-risk-rehearsal.mjs',
 'lib/platform/connections/alpaca-paper-ledger-reconcile.mjs',
 'tests/platformAlpacaPaperRiskRehearsal.test.mjs',
 'tests/platformAlpacaPaperLedgerReconcile.test.mjs',
 'docs/platform/B175-B177-ALPACA-PAPER-RISK-CONTINUITY.md',
 'scripts/platform/connections/b177-integrity.mjs',
 'scripts/platform/connections/browser-smoke.mjs',
 '.github/workflows/jenios-b177-alpaca-risk.yml'
]);
const changes=execFileSync('git',['diff','--name-status','--no-renames',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const s of changes){const [status,path]=s.split('\t');assert.ok(allow.has(path),'B177 path not allowed '+s);
 const modified=path==='lib/platform/pilot-prep/contracts.mjs'||path==='scripts/platform/connections/browser-smoke.mjs';
 assert.ok((modified&&status==='M')||(!modified&&status==='A'),'B177 unexpected source edit: '+s);}
const protectedPaths=['package.json','package-lock.json','lib/platform/pilot-prep/paper-ledger.mjs',
 'lib/platform/pilot-prep/risk.mjs','lib/platform/connections/native-broker-bridge.mjs',
 'lib/platform/connections/demo-vault.mjs','lib/platform/connections/demo-http.mjs',
 'app/integracoes/page.js','app/api/platform/broker-connections/route.js','app/api/platform/broker-readiness/route.js'];
for(const path of protectedPaths)assert.ok(execFileSync('git',['show',base+':'+path]).equals(readFileSync(path)),'Protected B174 module changed: '+path);
const old=execFileSync('git',['show',base+':lib/platform/pilot-prep/contracts.mjs'],{encoding:'utf8'});
const expected=old
 .replace("['ctrader','kraken-futures'].includes(connection.provider),'PROVIDER_NOT_SUPPORTED'","['ctrader','kraken-futures','alpaca'].includes(connection.provider),'PROVIDER_NOT_SUPPORTED'")
 .replace("insist(['paper','demo','live'].includes(connection.environment),'INVALID_ENVIRONMENT');","insist(['paper','demo','live'].includes(connection.environment),'INVALID_ENVIRONMENT');\n if(connection.provider==='alpaca')insist(connection.environment==='paper','ALPACA_PAPER_ONLY');")
 .replace("['ctrader','kraken-futures','coinbase-exchange'].includes(input.provider),'PROVIDER_NOT_SUPPORTED'","['ctrader','kraken-futures','coinbase-exchange','alpaca'].includes(input.provider),'PROVIDER_NOT_SUPPORTED'")
 .replace("insist(input.marketType==='inverse'?input.settlement===input.base:input.settlement===input.quote,'SETTLEMENT_MISMATCH');","insist(input.marketType==='inverse'?input.settlement===input.base:input.settlement===input.quote,'SETTLEMENT_MISMATCH');\n if(input.provider==='alpaca')insist(input.marketType==='spot'&&input.quote==='USD'&&input.settlement==='USD'&&input.contractSize==='1'&&input.quantityUnit==='base','ALPACA_SPOT_USD_ONLY');");
assert.equal(readFileSync('lib/platform/pilot-prep/contracts.mjs','utf8'),expected,'B152 provider extension exceeds approved narrow scope');
for(const path of ['lib/platform/connections/alpaca-paper-risk-rehearsal.mjs','lib/platform/connections/alpaca-paper-ledger-reconcile.mjs']){
 const src=readFileSync(path,'utf8');assert.doesNotMatch(src,/\bfetch\s*\(|\bPOST\b|sendRealOrder\(|api\.alpaca\.markets\/v2\/orders|\bwithdraw\b/i,'No native order transport');
 assert.match(src,/VERCEL_ENV==='production'/);assert.match(src,/JENIOS_PRIVATE_PAPER_REHEARSAL/);
}
// Only the hydration-safe click retry may change the original B160 browser smoke.
const originalSmoke=execFileSync('git',['show',base+':scripts/platform/connections/browser-smoke.mjs'],{encoding:'utf8'});
const freshSmoke=readFileSync('scripts/platform/connections/browser-smoke.mjs','utf8');
assert.equal(freshSmoke.split('for(const g of CONNECTION_GUIDES){')[0],originalSmoke.split('for(const g of CONNECTION_GUIDES){')[0]);
const afterMarker='pass(await value(`document.querySelectorAll(\'input[type=\"password\"]\')';
assert.ok(originalSmoke.includes(afterMarker)&&freshSmoke.includes(afterMarker),'Missing unchanged browser regression tail');
assert.equal(freshSmoke.split(afterMarker)[1],originalSmoke.split(afterMarker)[1],'B160 browser tail must be unchanged');
assert.match(freshSmoke,/Retry the \*real browser action\*/);
assert.match(freshSmoke,/activated&&await value\(navigated\)/);
console.log('B177_SOURCE_INTEGRITY_PASS; preserved B174 and original paper-ledger/risk; no order transport');
