import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';
const base='659846c457241e03f86650667664fdf65aab540e';
const allow=new Set([
 'lib/platform/connections/demo-vault.mjs',
 'lib/platform/connections/demo-broker-reader.mjs',
 'lib/platform/connections/demo-store.mjs',
 'lib/platform/connections/demo-service.mjs',
 'lib/platform/connections/demo-http.mjs',
 'app/api/platform/broker-connections/route.js',
 'app/api/platform/broker-connections/[id]/route.js',
 'app/api/platform/broker-connections/[id]/sync/route.js',
 'app/components/platform/DemoBrokerConnector.js',
 'app/components/platform/demo-broker-connector.module.css',
 'app/integracoes/page.js',
 'tests/platformDemoVault.test.mjs',
 'tests/platformDemoBrokerReader.test.mjs',
 'tests/platformDemoService.test.mjs',
 'tests/platformDemoUi.test.mjs',
 'supabase/review/20261020_jenios_platform_broker_demo_B165_B169_QA_ONLY.sql',
 'docs/platform/B165-B169-SELF-SERVICE-DEMO-APIS.md',
 'scripts/platform/connections/b169-integrity.mjs',
 '.github/workflows/jenios-b169-demo-broker-api.yml'
]);
const rows=execFileSync('git',['diff','--no-renames','--name-status',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const row of rows){const [status,path]=row.split('\t');assert.ok(allow.has(path),'B169 unauthorized change: '+row);assert.ok(status==='A'||(status==='M'&&path==='app/integracoes/page.js'),'B169 unsafe edit: '+row);}
for(const file of ['package.json','package-lock.json','lib/platform/connections/read-only-client.mjs','lib/platform/connections/demo-association.mjs','lib/platform/connections/demo-reconciliation.mjs','lib/platform/pilot-prep/paper-ledger.mjs','lib/platform/pilot-prep/risk.mjs','lib/platform/admin-db.mjs','lib/release/environment-scope.mjs']){
 const a=execFileSync('git',['show',base+':'+file]);const b=execFileSync('git',['show','HEAD:'+file]);assert.ok(a.equals(b),'Protected B164 source changed: '+file);
}
const reader=readFileSync('lib/platform/connections/demo-broker-reader.mjs','utf8');
assert.doesNotMatch(reader,/api\.binance\.com|api\.alpaca\.markets\/v2|\bPOST\b|\bDELETE\b|\bPATCH\b|withdraw|sendOrder\(/);
assert.match(reader,/method:'GET'/);assert.match(reader,/testnet\.binance\.vision/);assert.match(reader,/paper-api\.alpaca\.markets/);
const service=readFileSync('lib/platform/connections/demo-service.mjs','utf8');assert.match(service,/env\.VERCEL_ENV!=='production'/);
console.log('B169_ALLOWED_CHANGES='+rows.length+'; original engines, balances and PAY unchanged');
