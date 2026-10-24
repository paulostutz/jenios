import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('R70 research, progress and certified refs are excluded from deployment', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const branch of ['research/jenios-robot-r70-target-preflight-20261024',
    'backup/jenios-robot-r70-target-preflight-progress-20261024',
    'backup/jenios-robot-r70-target-preflight-certified-20261024']) {
    assert.equal(config.git.deploymentEnabled[branch], false);
    const run = spawnSync(process.execPath, ['scripts/vercel-ignore-research.mjs'],
      { env: { ...process.env, VERCEL_GIT_COMMIT_REF: branch }, encoding: 'utf8' });
    assert.equal(run.error, undefined); assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /Build skipped/);
  }
});
