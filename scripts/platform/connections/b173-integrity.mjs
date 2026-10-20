import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base='1174cb6bdc97f0eaa8294896d1ac836ae4c96db3';
const allow=new Set([
 'lib/platform/connections/provider-paths.mjs',
 'lib/platform/connections/paper-order-proposal.mjs',
 'lib/platform/connections/paper-order-observation.mjs',
 'app/api/platform/broker-readiness/route.js',
 'tests/platformProviderPaths.test.mjs',
 'tests/platformPaperOrderProposal.test.mjs',
 'tests/platformPaperOrderObservation.test.mjs',
 'docs/platform/B171-B173-CONNECTOR-GAPS-AND-PAPER-REHEARSAL.md',
 'scripts/platform/connections/b173-integrity.mjs',
 '.github/workflows/jenios-b173-broker-paper.yml'
]);
const changes=execFileSync('git',['diff','--name-status','--no-renames',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const row of changes){const [s,p]=row.split('\t');assert.equal(s,'A','Refuse modification/deletion of B170: '+row);assert.ok(allow.has(p),'Unexpected file: '+row);}
for(const file of ['package.json','package-lock.json','lib/platform/connections/demo-http.mjs','lib/platform/connections/demo-service.mjs','lib/platform/connections/demo-vault.mjs','lib/platform/connections/demo-broker-reader.mjs','lib/platform/pilot-prep/paper-ledger.mjs','lib/platform/pilot-prep/risk.mjs','lib/platform/pilot-prep/contracts.mjs','app/integracoes/page.js','lib/release/environment-scope.mjs']){
 assert.ok(execFileSync('git',['show',base+':'+file]).equals(execFileSync('git',['show','HEAD:'+file])),'Protected source changed: '+file);
}
const draft=readFileSync('lib/platform/connections/paper-order-proposal.mjs','utf8');
for(const expected of ['canSubmit:false','sent:false','PAPER_ORDER_SENDER_DISABLED','REAL_ORDER_SENDER_DISABLED'])assert.ok(draft.includes(expected));
const privateFiles=execFileSync('git',['ls-files'],{encoding:'utf8'});
assert.doesNotMatch(privateFiles,/(^|\/)nucleo-privado\//m);
console.log('B173: protected B170 source unchanged; '+changes.length+' additive files; no private engines');
