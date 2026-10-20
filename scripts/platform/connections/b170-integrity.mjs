import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const prior='a9bccb96b3b2c5052de66af703d9266b98835941';
const allow=new Set([
 'lib/platform/connections/capabilities.mjs',
 'app/api/platform/broker-providers/route.js',
 'app/integracoes/page.js',
 'tests/platformBrokerCapabilities.test.mjs',
 'docs/platform/B170-FINAL-RELEASE-READINESS.md',
 'scripts/platform/connections/b170-integrity.mjs',
 '.github/workflows/jenios-b170-final-release.yml'
]);
const out=execFileSync('git',['diff','--no-renames','--name-status',prior,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const line of out){const [status,path]=line.split('\t');assert.ok(allow.has(path),'B170 outside scope: '+line);assert.ok(status==='A'||(status==='M'&&path==='app/integracoes/page.js'),'B170 unexpected status: '+line);}
for(const file of ['package.json','package-lock.json','lib/platform/connections/demo-vault.mjs','lib/platform/connections/demo-broker-reader.mjs','lib/platform/connections/demo-http.mjs','lib/platform/connections/demo-service.mjs','lib/platform/connections/demo-store.mjs','lib/release/environment-scope.mjs','lib/platform/pilot-prep/risk.mjs','lib/platform/pilot-prep/paper-ledger.mjs']){
 const a=execFileSync('git',['show',prior+':'+file]);const b=execFileSync('git',['show','HEAD:'+file]);assert.ok(a.equals(b),'Protected B169 code changed: '+file);
}
const cap=readFileSync('lib/platform/connections/capabilities.mjs','utf8');
assert.doesNotMatch(cap,/api\.binance\.com|api\.alpaca\.markets\/v2|fetch\(|sendOrder|withdraw\(/i);
assert.match(readFileSync('lib/platform/connections/demo-service.mjs','utf8'),/env\.VERCEL_ENV!=='production'/);
console.log('B170 source integrity verified: '+out.length+' changes, protected demo/security code unchanged.');
