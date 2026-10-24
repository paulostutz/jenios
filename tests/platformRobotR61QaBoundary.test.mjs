import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isRobotR61QaEnabled } from '../lib/platform/research/robot-r61-qa-access.mjs';

const enabled = Object.freeze({
  VERCEL_ENV: 'preview',
  JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_REAL_EXECUTION_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false',
});

test('R61 console requires preview and both explicit QA gates', () => {
  assert.equal(isRobotR61QaEnabled(enabled), true);
  for (const key of ['VERCEL_ENV', 'JENIOS_QA_CANDIDATE_ENABLED', 'JENIOS_ROBOT_QA_ENABLED']) {
    for (const value of [undefined, '', 'false', 'production', true, false]) {
      assert.equal(isRobotR61QaEnabled({ ...enabled, [key]: value }), false, key + ':' + value);
    }
  }
});

test('R61 production and development never expose the acceptance route', () => {
  for (const value of ['production', 'development', 'test', undefined]) {
    assert.equal(isRobotR61QaEnabled({ ...enabled, VERCEL_ENV: value }), false);
  }
  assert.equal(isRobotR61QaEnabled(), false);
});

test('R61 every real or Paper transport must be explicitly disabled', () => {
  for (const key of ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED', 'JENIOS_PRIVATE_PAPER_EXECUTOR']) {
    for (const value of [undefined, '', 'true', true, false, '0']) {
      assert.equal(isRobotR61QaEnabled({ ...enabled, [key]: value }), false, key + ':' + value);
    }
  }
});

test('R61 independent child route enforces its server gate without bypassing parent access', () => {
  const child = readFileSync(new URL('../app/platform/homologacao/robos/page.js', import.meta.url), 'utf8');
  assert.match(child, /if\s*\(!isRobotR61QaEnabled\(process\.env\)\)\s*notFound\(\)/);
  assert.match(child, /force-dynamic/);
  assert.match(child, /index:\s*false/);
  const parent = readFileSync(new URL('../app/platform/homologacao/page.js', import.meta.url), 'utf8');
  assert.ok(parent.includes("process.env.VERCEL_ENV!=='preview'"));
  assert.ok(parent.includes("process.env.JENIOS_QA_CANDIDATE_ENABLED!=='true'"));
  assert.match(parent, /notFound\(\)/);
});
