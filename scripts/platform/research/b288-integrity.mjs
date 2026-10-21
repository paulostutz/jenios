/** B288 fail-closed diff boundary: no proprietary, access, payment or production mutation. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const repoBase='9e37aec07394db7eb03257d00b8d4229ce0be6c0';
const allowed=[
 'lib/platform/research/b288-paired-filter-audit.mjs',
 'tests/platformB288PairedFilterAudit.test.mjs',
 'docs/platform/B288-PAIRED-THREE-MODE-VALIDATION.md',
 'scripts/platform/research/b288-integrity.mjs',
 '.github/workflows/jenios-b288-paired-filter-audit.yml'
].sort();
const lines=execFileSync('git',['diff','--name-status','--no-renames',repoBase,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.deepEqual(lines.map(row=>row[1]).sort(),allowed,'B288_UNEXPECTED_FILES_MODIFIED');
for(const [status,path] of lines)assert.equal(status,'A','B288_ONLY_NEW_RESEARCH_FILES '+path);
const protectedFiles=[
 'package.json','package-lock.json',
 'lib/platform/research/b287-signal-witness.mjs',
 'lib/platform/research/b281-first-hour-observation.mjs',
 'lib/platform/research/b280-forward-protocol.mjs',
 'lib/platform/research/b280-statistical-gate.mjs',
 'docs/platform/evidence/B280_FORWARD_HOUR_SEALED_SNAPSHOT.json',
 'lib/platform/launch/b224-three-mode-ledger-lab.mjs',
 'lib/platform/launch/b226-prospective-witness-review.mjs',
 'lib/platform/private-core-bridge.mjs',
 'lib/platform/pilot-prep/contracts.mjs',
 'app/api/platform/broker-connections/route.js',
 'lib/pay/checkout.mjs','lib/pay/inter-pix.mjs'
];
for(const path of protectedFiles){
 const old=execFileSync('git',['show',repoBase+':'+path]);
 assert.ok(readFileSync(path).equals(old),'B288_PROTECTED_SOURCE_CHANGED '+path);
}
const research=readFileSync('lib/platform/research/b288-paired-filter-audit.mjs','utf8');
for(const pattern of [/ordersSent:0/,/liveExecutionEnabled:false/,/privateRobotCodeInvoked:false/,
 /lossNeutralizationVerified:false/,/noAutomatedParameterSelection:true/])
 assert.match(research,pattern);
assert.doesNotMatch(research,/\b(fetch|XMLHttpRequest|submitOrder|createOrder|sendTransaction|paymentIntent)\s*\(/);
console.log('B288_ISOLATION_PASS exactly five additive files, B287 protected, all research offline');
