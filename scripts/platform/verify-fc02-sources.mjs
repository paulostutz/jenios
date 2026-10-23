import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const manifest = JSON.parse(readFileSync('docs/platform/evidence/FC02_SOURCE_MANIFEST.json'));
for (const entry of manifest.sources) {
  assert.equal(createHash('sha256').update(readFileSync(entry.path)).digest('hex'), entry.sha256, `Certified source changed: ${entry.path}`);
}
const config = JSON.parse(readFileSync('vercel.json'));
for (const branch of ['research/jenios-fc02-consolidation-20261023', 'backup/jenios-fc02-consolidation-certified-20261023']) {
  assert.equal(config.git.deploymentEnabled[branch], false);
  assert.ok(config.ignoreCommand.includes(branch));
}
console.log(`FC02: ${manifest.sources.length} source hashes preserved; deployment disabled.`);
