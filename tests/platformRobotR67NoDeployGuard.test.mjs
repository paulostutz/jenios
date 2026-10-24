import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('R67 research and backups have explicit no-deploy guards and a read-only workflow', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  for (const branch of ['research/jenios-robot-r67-private-source-bridge-20261024',
    'backup/jenios-robot-r67-private-source-bridge-progress-20261024',
    'backup/jenios-robot-r67-private-source-bridge-certified-20261024'])
    assert.equal(config.git.deploymentEnabled[branch], false);
  assert.equal(config.git.deploymentEnabled['research/jenios-robot-*'], false);
  const workflow = readFileSync('.github/workflows/jenios-robot-r67-private-source-bridge.yml', 'utf8');
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /branches: \[research\/jenios-robot-r67-private-source-bridge-20261024\]/);
  assert.doesNotMatch(workflow, /secrets\.|vercel deploy|supabase db push|r67-private-source-acceptance|JENIOS_R67_PRIVATE_CORE_DIR/);
  assert.match(workflow, /127\.0\.0\.1:5432\/jenios_r67_qa/);
  assert.match(workflow, /JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false'/);
});
