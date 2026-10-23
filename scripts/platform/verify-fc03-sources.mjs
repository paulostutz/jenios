import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const manifest = JSON.parse(readFileSync('docs/platform/evidence/FC03_SOURCE_MANIFEST.json'));
const inherited = JSON.parse(readFileSync(manifest.inheritedManifest));
for (const entry of inherited.sources) {
  const path = manifest.inheritedRelocations[entry.path] || entry.path;
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), entry.sha256, path);
}
for (const entry of manifest.sources) {
  assert.equal(createHash('sha256').update(readFileSync(entry.path)).digest('hex'), entry.sha256, entry.path);
}
const config = JSON.parse(readFileSync('vercel.json'));
assert.ok(config.ignoreCommand.length <= 256);
for (const branch of ['research/jenios-fc03-functional-path-20261023', 'backup/jenios-fc03-offline-path-verified-20261023']) {
  assert.equal(config.git.deploymentEnabled[branch], false);
}
for (const [branch, enabled] of Object.entries(config.git.deploymentEnabled)) {
  if (enabled !== false) continue;
  const result = spawnSync('/bin/sh', ['-c', config.ignoreCommand], { env: { VERCEL_GIT_COMMIT_REF: branch } });
  assert.ifError(result.error);
  assert.equal(result.status, 0, branch);
}
console.log(`FC03: ${inherited.sources.length} inherited hashes and ${manifest.sources.length} R59 source hashes preserved; deployment disabled.`);
