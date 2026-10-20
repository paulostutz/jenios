import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base='dc320f8fcbec74d2ea1dcf923bed923bdf4377d9';
const allowed=new Set([
 'docs/platform/B161-RELEASE-B160.md',
 'docs/platform/B161-B164-DEMO-ASSOCIATION.md',
 'lib/platform/connections/demo-association.mjs',
 'lib/platform/connections/demo-reconciliation.mjs',
 'tests/platformDemoAssociation.test.mjs',
 'tests/platformDemoReconciliation.test.mjs',
 'scripts/platform/connections/b164-integrity.mjs',
 '.github/workflows/jenios-b164-demo-association.yml'
]);
const rows=execFileSync('git',['diff','--no-renames','--name-status',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const row of rows){const [status,path]=row.split('\t');assert.equal(status,'A','B164 cannot modify or delete B160 path: '+row);assert.ok(allowed.has(path),'B164 path outside scope: '+path);}
for(const path of ['package.json','package-lock.json','lib/platform/connections/read-only-client.mjs','lib/platform/connections/support.mjs','lib/platform/connections/catalog.mjs','lib/release/environment-scope.mjs','lib/platform/pilot-prep/adapters.mjs','lib/platform/pilot-prep/paper-ledger.mjs','app/integracoes/page.js']){
 const before=execFileSync('git',['show',base+':'+path]);const after=execFileSync('git',['show','HEAD:'+path]);assert.ok(before.equals(after),'Protected B160 path changed: '+path);
}
const names=rows.map(row=>row.split('\t')[1]).join('\n');
assert.doesNotMatch(names,/(?:^|\/)(?:\.env|.*\.(?:sqlite|db|pem|key|zip))$/i);
console.log('B164_PRESERVATION_PASS='+rows.length+' additive paths; B160 tracked source unchanged');
