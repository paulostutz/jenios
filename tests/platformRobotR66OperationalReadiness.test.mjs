import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { inspectR66OperationalReadiness } from '../lib/platform/research/robot-r66-operational-readiness.mjs';

function fixture() {
  const { publicKey } = generateKeyPairSync('ed25519');
  return { env: {
    VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
    JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_R65_ENABLED: 'true',
    JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
    JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false',
    PLATFORM_SUPABASE_URL: 'https://platform-qa.invalid',
    PLATFORM_SUPABASE_SERVICE_ROLE_KEY: 'private-test-value-never-to-be-printed',
    JENIOS_ROBOT_R64_SCOPE_ID: 'scope:0000000000000001', JENIOS_ROBOT_R64_SOURCE_ID: 'source:0000000000000001',
    JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }),
    JENIOS_ROBOT_R65_ADMIN_ORIGIN: 'https://robots-qa.invalid',
    JENIOS_ROBOT_R65_SCHEDULER_TOKEN: 'test-only-scheduler-credential-that-is-not-printed',
  }, host: { storageKind: 'persistent_private_volume', workerKind: 'persistent_process', wakeStrategy: 'next_at_ms' } };
}
const invalid = (fn, code) => assert.throws(fn, error => error.code === code);

test('R66 empty offline preflight leaves all operational acceptance pending', () => {
  const report = inspectR66OperationalReadiness();
  assert.equal(report.configurationComplete, false);
  assert.equal(report.operationalReady, false);
  assert.equal(report.actualHostStateObserved, false);
  assert.equal(report.pendingOwnerOperationalAcceptance, true);
  assert.equal(report.actionsPerformed.networkCalls, 0);
  assert.equal(report.actionsPerformed.hostedDatabaseChanges, 0);
  assert(report.needsEvidence.every(item => item.status === 'NOT_VERIFIED_BY_THIS_PREFLIGHT'));
  assert.equal(report.preparedActivation.customerMonitoringActive, false);
});

test('R66 complete declarations never certify a private source, real admin or deployed host', () => {
  const report = inspectR66OperationalReadiness(fixture());
  assert.equal(report.configurationComplete, true);
  assert.equal(report.status, 'BLOCKED_PENDING_OPERATIONAL_EVIDENCE');
  assert.equal(report.operationalReady, false);
  assert(report.configuration.every(item => item.verifiedAgainstHost === false));
  for (const id of ['PRIVATE_EXECUTABLE_TO_EMITTER', 'REAL_PLATFORM_ADMIN_IDENTITY',
    'HOSTED_PLATFORM_DATABASE', 'OWNER_OPERATIONAL_ACCEPTANCE'])
    assert(report.needsEvidence.some(item => item.id === id));
  assert.equal(report.existingIntegration.ultrafastOrigin, 'R61_SYNTHETIC_RUNTIME');
  assert.deepEqual(report.existingIntegration.privateCoreRobots, ['manual', 'hybrid', 'reverse']);
  assert.equal(report.preservedPolicy.from, 750);
  assert.equal(report.preservedPolicy.to, 500);
});

test('R66 production target cannot pass with all QA toggles declared', () => {
  const input = fixture(); input.env.VERCEL_ENV = 'production';
  const report = inspectR66OperationalReadiness(input);
  assert.equal(report.configurationComplete, false);
  assert(report.missingConfiguration.includes('PREVIEW_REQUIRED'));
  assert(report.missingConfiguration.includes('QA_BOUNDARY_NOT_CONFIGURED'));
});

test('R66 real orders, external Paper and paid generation must remain explicitly disabled', () => {
  for (const key of ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
    'JENIOS_PRIVATE_PAPER_EXECUTOR', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED']) {
    for (const value of ['true', '1', 'FALSE', undefined]) {
      const input = fixture();
      if (value === undefined) delete input.env[key]; else input.env[key] = value;
      const report = inspectR66OperationalReadiness(input);
      assert.equal(report.configurationComplete, false, key + ':' + value);
      assert.equal(report.preparedActivation.paidGenerationEnabled, false);
      assert.equal(report.actionsPerformed.providerCalls, 0);
    }
  }
});

test('R66 config claims cannot override mandatory evidence or run callbacks', () => {
  const input = fixture();
  invalid(() => inspectR66OperationalReadiness({ ...input, operationalReady: true }), 'R66_PREFLIGHT_INPUT_INVALID');
  invalid(() => inspectR66OperationalReadiness({ ...input, evidence: { adminVerified: true } }), 'R66_PREFLIGHT_INPUT_INVALID');
  invalid(() => inspectR66OperationalReadiness({ ...input, host: { ...input.host, verified: true } }), 'R66_PREFLIGHT_HOST_INVALID');
  let calls = 0;
  invalid(() => inspectR66OperationalReadiness({ ...input, analyzeRequest() { calls++; } }), 'R66_PREFLIGHT_INPUT_INVALID');
  assert.equal(calls, 0);
});

test('R66 cannot inspect configuration accessors or truthy object flags', () => {
  const input = fixture(); let calls = 0;
  Object.defineProperty(input.env, 'JENIOS_ROBOT_R65_ENABLED', { enumerable: true, get() { calls++; return 'true'; } });
  invalid(() => inspectR66OperationalReadiness(input), 'R66_PREFLIGHT_ENV_INVALID');
  const other = fixture(); other.env.JENIOS_ROBOT_R65_ENABLED = true;
  invalid(() => inspectR66OperationalReadiness(other), 'R66_PREFLIGHT_ENV_INVALID');
  const host = {}; Object.defineProperty(host, 'storageKind', { enumerable: true, get() { calls++; return 'persistent_private_volume'; } });
  invalid(() => inspectR66OperationalReadiness({ env: fixture().env, host }), 'R66_PREFLIGHT_HOST_INVALID');
  assert.equal(calls, 0);
});

test('R66 report never includes supplied secrets, public key bytes, identifiers or account URL', () => {
  const input = fixture(); const encoded = JSON.stringify(inspectR66OperationalReadiness(input));
  for (const key of ['PLATFORM_SUPABASE_SERVICE_ROLE_KEY', 'JENIOS_ROBOT_R65_SCHEDULER_TOKEN',
    'JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY', 'JENIOS_ROBOT_R64_SCOPE_ID', 'PLATFORM_SUPABASE_URL'])
    assert.equal(encoded.includes(input.env[key]), false, key);
  assert.equal(Object.isFrozen(inspectR66OperationalReadiness(input).configuration), true);
});

test('R66 source and origin declarations reject malformed keys and noncanonical hosted origins', () => {
  for (const origin of ['http://robots-qa.invalid', 'https://robots-qa.invalid/',
    'https://user:secret@robots-qa.invalid', 'https://robots-qa.invalid/path', 'https://robots-qa.invalid?x=1']) {
    const input = fixture(); input.env.JENIOS_ROBOT_R65_ADMIN_ORIGIN = origin;
    assert(inspectR66OperationalReadiness(input).missingConfiguration.includes('CANONICAL_HTTPS_ADMIN_ORIGIN_REQUIRED'));
  }
  const input = fixture(); input.env.JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\ninvalid';
  assert(inspectR66OperationalReadiness(input).missingConfiguration.includes('VALID_ED25519_QA_SOURCE_REQUIRED'));
  const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).publicKey;
  input.env.JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY = rsa.export({ type: 'spki', format: 'pem' });
  assert(inspectR66OperationalReadiness(input).missingConfiguration.includes('VALID_ED25519_QA_SOURCE_REQUIRED'));
});

test('R66 ephemeral storage and fixed-minute cron cannot meet the durable 10-second-window plan', () => {
  const input = fixture(); input.host.storageKind = 'ephemeral_filesystem';
  assert(inspectR66OperationalReadiness(input).missingConfiguration.includes('PERSISTENT_PRIVATE_HOST_REQUIRED'));
  input.host.storageKind = 'persistent_private_volume'; input.host.workerKind = 'external_scheduler'; input.host.wakeStrategy = 'fixed_minute';
  assert(inspectR66OperationalReadiness(input).missingConfiguration.includes('WORKER_WITH_NEXT_AT_MS_REQUIRED'));
  input.host.wakeStrategy = 'next_at_ms';
  assert.equal(inspectR66OperationalReadiness(input).configurationComplete, true);
  assert.equal(inspectR66OperationalReadiness(input).operationalReady, false);
});

test('R66 CLI exits pending even for complete declarations and does not print credentials', () => {
  const input = fixture();
  const child = spawnSync(process.execPath, ['scripts/platform/research/r66-operational-preflight.mjs', '--json',
    '--storage', input.host.storageKind, '--worker', input.host.workerKind, '--wake', input.host.wakeStrategy],
  { env: { PATH: process.env.PATH, ...input.env }, encoding: 'utf8' });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 2, child.stderr);
  assert.equal(child.stderr, '');
  const report = JSON.parse(child.stdout);
  assert.equal(report.configurationComplete, true);
  assert.equal(report.operationalReady, false);
  assert.equal(child.stdout.includes(input.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY), false);
});
