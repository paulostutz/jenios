import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';import {readFileSync,existsSync} from 'node:fs';
const base='caaffece04649a6dc1ca6c8012d7502887771529';
const additions=[
 'lib/platform/connections/alpaca-paper-dispatch-journal.mjs',
 'lib/platform/connections/alpaca-paper-dispatch-grant.mjs',
 'lib/platform/connections/alpaca-paper-native-submit.mjs',
 'lib/platform/connections/alpaca-paper-private-executor.mjs',
 'lib/platform/connections/alpaca-paper-bracket-audit.mjs',
 'tests/platformAlpacaPaperDispatchJournal.test.mjs',
 'tests/platformAlpacaPaperDispatchGrant.test.mjs',
 'tests/platformAlpacaPaperNativeSubmit.test.mjs',
 'tests/platformAlpacaPaperPrivateExecutor.test.mjs',
 'tests/platformAlpacaPaperBracketAudit.test.mjs',
 'docs/platform/B178-B184-PRIVATE-PAPER-NATIVE-EXECUTION.md',
 'scripts/platform/connections/b184-integrity.mjs',
 '.github/workflows/jenios-b184-private-paper.yml'
];
const allowed=new Set(additions);
const rows=execFileSync('git',['diff','--no-renames','--name-status',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
assert.equal(rows.length,additions.length,'B184 unexpected number of files');
for(const row of rows){const [kind,file]=row.split('\t');assert.equal(kind,'A','B184 must be additive');assert.ok(allowed.has(file),'B184 unexpected public source change '+file);}
for(const f of ['package.json','package-lock.json','lib/platform/pilot-prep/paper-ledger.mjs','lib/platform/pilot-prep/risk.mjs',
 'lib/platform/connections/alpaca-paper-risk-rehearsal.mjs','lib/platform/connections/alpaca-paper-ledger-reconcile.mjs',
 'lib/platform/connections/demo-vault.mjs','lib/platform/connections/demo-http.mjs',
 'scripts/platform/connections/browser-smoke.mjs','app/integracoes/page.js','app/api/platform/broker-connections/route.js']){
 assert.ok(readFileSync(f).equals(execFileSync('git',['show',base+':'+f])),'Protected B177 source changed: '+f);
}
const post=readFileSync('lib/platform/connections/alpaca-paper-native-submit.mjs','utf8');
assert.match(post,/https:\/\/paper-api\.alpaca\.markets\/v2\/orders/);
assert.match(post,/method:'POST'/);assert.match(post,/assertPrivatePaperRuntime/);
assert.doesNotMatch(post,/https:\/\/api\.alpaca\.markets\/|https:\/\/api\.binance\.com|\bwithdraw\s*\(/i);
for(const file of ['lib/platform/connections/alpaca-paper-private-executor.mjs','lib/platform/connections/alpaca-paper-bracket-audit.mjs']){
 const body=readFileSync(file,'utf8');assert.match(body,/assertPrivatePaperRuntime/);assert.doesNotMatch(body,/https:\/\/api\.alpaca\.markets\//);
}
const src=readFileSync('lib/platform/connections/alpaca-paper-private-executor.mjs','utf8');
for(const marker of ['ACCOUNT_REVOCATION_FENCE_REQUIRED','verifyPaperGrant','journal.claim','PAPER_DUPLICATE_RESERVATION','automaticResubmissionAllowed:false','REAL_EXECUTION_NOT_AUTHORIZED'])assert.ok(src.includes(marker),'Fail-closed marker missing '+marker);
assert.equal(existsSync('nucleo-privado/engine.mjs'),false,'Original core must not be copied into public GitHub');
console.log('B184_PUBLIC_SCOPE_PASS='+rows.length+' additions; B177 source preserved; Vercel no PAPER sender route, no live order endpoint');
