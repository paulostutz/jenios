import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// R36 already certified the route-level duration. Protect its deployment
// restrictions and dunning schedule against the unrelated R37 replacement.
test('R38 preserves R36 deployment isolation and the scoped checkout duration',()=>{
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 const protectedBranches=[
  'fix/jenios-b297-private-original-readonly-audit-20261021',
  'fix/jenios-b298-signed-private-readonly-evidence-20261021',
  'fix/jenios-b299-private-consent-replay-gate-20261021',
  'fix/jenios-b300-private-evidence-correlation-gate-20261021',
  'fix/jenios-b301-private-durable-cohort-20261021',
  'fix/jenios-b303-protected-readonly-preview-20261021'
 ];
 assert.deepEqual(config.git,{deploymentEnabled:Object.fromEntries(protectedBranches.map(branch=>[branch,false]))});
 assert.equal(config.ignoreCommand,'case "$VERCEL_GIT_COMMIT_REF" in fix/jenios-b29[7-9]-*|fix/jenios-b30[01]-*) exit 0;; *) exit 1;; esac');
 assert.deepEqual(config.crons,[
  {path:'/api/internal/billing/dunning',schedule:'0 12 * * *'}
 ]);
 assert.match(readFileSync('app/api/jenios-pay/checkout/route.js','utf8'),/^export const maxDuration\s*=\s*60;\s*$/m);
 assert.equal(config.functions,undefined);
 assert.equal(config.buildCommand,undefined);
 assert.deepEqual(Object.keys(config).sort(),['$schema','crons','git','ignoreCommand']);
});
