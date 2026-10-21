import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const BASE='eabf9eab376bd201186ee339404563976063a92a';
const files=['tests/jeniosB276UniversityAcceptance.test.mjs','scripts/platform/learning/b276-browser-smoke.mjs','scripts/platform/learning/b276-integrity.mjs','docs/learning/B276-UNIVERSITY-HOMOLOGATION.md','.github/workflows/jenios-b276-university-homologation.yml'].sort();
const changes=execFileSync('git',['diff','--name-status','--no-renames',BASE,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
assert.deepEqual(changes.map(x=>x[1]).sort(),files,'B276_SCOPE_MISMATCH');
for(const [kind] of changes)assert.equal(kind,'A','B276_MUST_ONLY_ADD_TESTS');
for(const path of ['lib/learning/catalog.mjs','lib/learning/engine.mjs','lib/learning/service.mjs','lib/learning/repository.mjs','lib/learning/access.mjs','lib/learning/trade-study-workshops-b271.mjs','app/components/learning/LearningRoom.js','app/components/learning/LearningRoom.module.css','lib/platform/research/b272-walkforward-lab.mjs','lib/pay/checkout.mjs','lib/pay/inter-pix.mjs','app/universidade/page.js','app/social/page.js','package.json','package-lock.json']){
 assert.ok(readFileSync(path).equals(execFileSync('git',['show',BASE+':'+path])),'B276_PROTECTED_FILE_CHANGED '+path);
}
for(const route of ['app/api/platform/live-trading/route.js','app/api/platform/broker-execution/route.js','app/api/platform/paper-execution/route.js'])assert.equal(existsSync(route),false);
console.log('B276_HOMOLOGATION_SCOPE_PASS');
