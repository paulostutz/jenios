import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const manifest = JSON.parse(readFileSync('docs/platform/evidence/FC02_SOURCE_MANIFEST.json'));
for (const entry of manifest.sources) {
  assert.equal(createHash('sha256').update(readFileSync(entry.path)).digest('hex'), entry.sha256, `Certified source changed: ${entry.path}`);
}
const config = JSON.parse(readFileSync('vercel.json'));
assert.ok(config.ignoreCommand.length <= 256, 'Vercel ignore command exceeds the B303 limit');
for (const branch of ['research/jenios-fc02-consolidation-20261023', 'backup/jenios-fc02-consolidation-certified-20261023']) {
  assert.equal(config.git.deploymentEnabled[branch], false);
}
for (const [branch, enabled] of Object.entries(config.git.deploymentEnabled)) {
  if (enabled !== false) continue;
  const result = spawnSync('/bin/sh', ['-c', config.ignoreCommand], { env: { VERCEL_GIT_COMMIT_REF: branch }, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `Deployment must be ignored for ${branch}`);
}
for (const branch of ['main', 'production', 'fix/unrelated-change']) {
  const result = spawnSync('/bin/sh', ['-c', config.ignoreCommand], { env: { VERCEL_GIT_COMMIT_REF: branch }, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 1, `FC02 ignore patterns must not expand to ${branch}`);
}
console.log(`FC02: ${manifest.sources.length} source hashes preserved; deployment disabled.`);
