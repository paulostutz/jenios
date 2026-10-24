import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const guardPath = fileURLToPath(new URL('../scripts/vercel-ignore-research.mjs', import.meta.url));
const currentBranch = 'research/jenios-robot-r60-operational-closeout-20261024';
const backupBranch = 'backup/jenios-robot-r60-operational-closeout-certified-20261024';

function invoke(ref, { cwd = root, script = null } = {}) {
  const env = { ...process.env };
  delete env.VERCEL_GIT_COMMIT_REF;
  if (ref !== undefined) env.VERCEL_GIT_COMMIT_REF = ref;
  const result = script
    ? spawnSync(process.execPath, [script], { cwd, env, encoding: 'utf8' })
    : spawnSync('sh', ['-c', config.ignoreCommand], { cwd, env, encoding: 'utf8' });
  assert.equal(result.error, undefined, 'the configured guard process must actually execute');
  return result;
}

test('R60 fixes the actual Vercel schema limit and blocks both refs before any branch push', () => {
  assert.equal(typeof config.ignoreCommand, 'string');
  assert.ok(config.ignoreCommand.length <= 256);
  assert.equal(config.git.deploymentEnabled[currentBranch], false);
  assert.equal(config.git.deploymentEnabled[backupBranch], false);
  for (const pattern of ['fix/jenios-robot-*', 'research/jenios-robot-*', 'backup/jenios-robot-*']) {
    assert.equal(config.git.deploymentEnabled[pattern], false);
  }
  assert.ok(Object.values(config.git.deploymentEnabled).every((value) => value === false));
});

test('R60 configured command skips past, current and future robot research and backup branches', () => {
  const refs = [
    'research/jenios-robot-block-c-r59-final-certification-20261023',
    currentBranch,
    backupBranch,
    'research/jenios-robot-r61-future-research',
    'backup/jenios-robot-r999-future-certified',
    'fix/jenios-robot-r1-adversarial-qa-20261021',
  ];
  for (const ref of refs) {
    const result = invoke(ref);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, ref + ': ' + result.stderr);
    assert.match(result.stdout, /Build skipped/);
  }
});

test('R60 preserves every existing exact branch exclusion including B297-B301', () => {
  const legacyRefs = Object.keys(config.git.deploymentEnabled).filter((ref) => !ref.includes('*'));
  assert.ok(legacyRefs.includes('fix/jenios-b297-private-original-readonly-audit-20261021'));
  assert.ok(legacyRefs.includes('fix/jenios-b301-private-durable-cohort-20261021'));
  for (const ref of legacyRefs) assert.equal(invoke(ref).status, 0, ref);
});

test('R60 leaves normal release, production and unrelated feature build decisions unchanged', () => {
  for (const ref of [
    'main', 'master', 'release/jenios-public',
    'fix/jenios-b305-finance-email-20261022',
    'feature/platform-settings', 'feature/research/jenios-robot-example',
  ]) {
    const result = invoke(ref);
    assert.equal(result.status, 1, ref + ': ' + result.stderr);
    assert.match(result.stdout, /normal build policy continues/);
  }
});

test('R60 missing or ambiguous branch identity cannot permit a build', () => {
  for (const ref of [undefined, '', ' ', 'research/jenios-robot-r60\nmain']) {
    const result = invoke(ref);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /no unambiguous Git branch/);
  }
});

test('R60 missing or damaged repository policy fails closed before a build', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'jenios-r60-no-deploy-'));
  try {
    mkdirSync(join(fixture, 'scripts'));
    const script = join(fixture, 'scripts/vercel-ignore-research.mjs');
    copyFileSync(guardPath, script);
    for (const contents of [null, '{bad json', '{"git":{"deploymentEnabled":[]}}']) {
      if (contents !== null) writeFileSync(join(fixture, 'vercel.json'), contents);
      const result = invoke(currentBranch, { cwd: fixture, script });
      assert.equal(result.status, 0);
      assert.match(result.stdout, /could not be verified/);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('R60 policy resolution does not depend on the caller working directory', () => {
  const result = invoke(currentBranch, { cwd: tmpdir(), script: guardPath });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /isolated research/);
});
