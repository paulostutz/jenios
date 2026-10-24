import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { inspectR68DeclaredHandoff } from '../lib/platform/research/robot-r68-declared-handoff.mjs';

const pem = () => generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
function fixture() {
  return { env: {
    VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
    JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_R65_ENABLED: 'true', JENIOS_ROBOT_R67_ENABLED: 'true',
    JENIOS_ROBOT_R68_HOST_ENABLED: 'true', JENIOS_ROBOT_R68_WORKER_ENABLED: 'true',
    JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
    JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false',
    PLATFORM_SUPABASE_URL: 'https://platform-qa.invalid', NEXT_PUBLIC_PLATFORM_SUPABASE_URL: 'https://platform-qa.invalid',
    PLATFORM_SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test_only_private_value_123456789',
    NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only_public_value_123456789',
    JENIOS_ROBOT_R64_SCOPE_ID: 'scope:0000000000000001', JENIOS_ROBOT_R64_SOURCE_ID: 'source:0000000000000001',
    JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY: pem(), JENIOS_ROBOT_R67_SCOPE_ID: 'scope:0000000000000002',
    JENIOS_ROBOT_R67_SOURCE_ID: 'source:0000000000000002', JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY: pem(),
    JENIOS_ROBOT_R65_ADMIN_ORIGIN: 'https://robots-qa.invalid',
    JENIOS_ROBOT_R65_SCHEDULER_TOKEN: 'test_only_scheduler_token_not_for_external_use',
  }, host: { storageKind: 'persistent_private_volume', workerKind: 'persistent_process', wakeStrategy: 'next_at_ms' } };
}
const jwt = role => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role, ref: 'explicit-unverified-test-fixture' })).toString('base64url'),
  Buffer.from('not-a-valid-signature').toString('base64url')].join('.');
const missing = (input, status) => assert(inspectR68DeclaredHandoff(input).missingConfiguration.includes(status), status);

test('R68 complete declarations leave hosted identity, credentials and recovery unverified', () => {
  const report = inspectR68DeclaredHandoff(fixture());
  assert.equal(report.configurationComplete, true);
  assert.equal(report.status, 'BLOCKED_PENDING_HOSTED_EVIDENCE');
  for (const key of ['operationalReady', 'realAdminIdentityVerified', 'credentialsProjectBindingVerified',
    'credentialsVerified', 'hostedDatabaseVerified', 'actualHostStateObserved']) assert.equal(report[key], false, key);
  assert.equal(report.pendingOwnerOperationalAcceptance, true);
  assert(report.configuration.every(check => !check.verifiedAgainstHost));
  assert(report.adminAcceptance.every(check => check.status === 'NOT_EXECUTED'));
  assert(Object.values(report.hostRecovery).every(value => value === false));
  assert.equal(report.actionsPerformed.networkCalls, 0);
  assert.equal(report.metrics.actualBrokerPnl, null);
});

test('R68 detects browser/server project mismatch including noncanonical URLs', () => {
  for (const url of ['https://another-project.invalid', 'http://platform-qa.invalid', 'https://platform-qa.invalid/',
    'https://platform-qa.invalid/path', 'https://user:password@platform-qa.invalid', 'https://platform-qa.invalid?secret=x']) {
    const input = fixture(); input.env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL = url;
    missing(input, 'MATCHING_PLATFORM_BROWSER_SERVER_URL_REQUIRED');
  }
  const input = fixture(); delete input.env.NEXT_PUBLIC_PLATFORM_SUPABASE_URL;
  missing(input, 'MATCHING_PLATFORM_BROWSER_SERVER_URL_REQUIRED');
});

test('R68 rejects elevated or unknown public credential declarations', () => {
  for (const key of ['sb_secret_test_only_private_value_123456789', jwt('service_role'), jwt('authenticated'),
    'unclassified-key', 'sb_publishable_short', 'sb_publishable_test value with spaces']) {
    const input = fixture(); input.env.NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY = key;
    missing(input, 'PUBLIC_PLATFORM_KEY_FORMAT_REQUIRED');
  }
  const input = fixture(); input.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY = input.env.NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY;
  missing(input, 'PUBLIC_PLATFORM_KEY_FORMAT_REQUIRED'); missing(input, 'SERVER_PLATFORM_KEY_FORMAT_REQUIRED');
});

test('R68 legacy JWT roles are declarations only, never a signature or project verification', () => {
  const input = fixture(); input.env.NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY = jwt('anon');
  input.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY = jwt('service_role');
  const report = inspectR68DeclaredHandoff(input);
  assert.equal(report.configurationComplete, true);
  assert.equal(report.keyDeclaration.publicKind, 'LEGACY_ANON_DECLARED');
  assert.equal(report.keyDeclaration.privateKind, 'LEGACY_SERVICE_ROLE_DECLARED');
  assert.equal(report.credentialsVerified, false);
  assert.equal(report.credentialsProjectBindingVerified, false);
  input.env.NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY = jwt('anon').replace(/^[^.]+/, Buffer.from('{"alg":"none"}').toString('base64url'));
  missing(input, 'PUBLIC_PLATFORM_KEY_FORMAT_REQUIRED');
});

test('R68 checked public Platform secret slots fail closed', () => {
  for (const key of ['NEXT_PUBLIC_PLATFORM_SUPABASE_SECRET_KEY', 'NEXT_PUBLIC_PLATFORM_SUPABASE_SERVICE_ROLE_KEY']) {
    const input = fixture(); input.env[key] = 'value-must-not-be-exposed';
    missing(input, 'REMOVE_DECLARED_PUBLIC_PLATFORM_SECRET');
    assert.equal(JSON.stringify(inspectR68DeclaredHandoff(input)).includes(input.env[key]), false);
  }
});

test('R68 cannot declare a private source that shares the R64 identity or key', () => {
  const input = fixture(); input.env.JENIOS_ROBOT_R67_SOURCE_ID = input.env.JENIOS_ROBOT_R64_SOURCE_ID;
  missing(input, 'DISTINCT_PRIVATE_SOURCE_AND_KEY_REQUIRED');
  const other = fixture(); other.env.JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY = other.env.JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY;
  missing(other, 'DISTINCT_PRIVATE_SOURCE_AND_KEY_REQUIRED');
});

test('R68 production, execution, paid generation and absent opt-ins stay blocked', () => {
  for (const key of ['JENIOS_ROBOT_R68_HOST_ENABLED', 'JENIOS_ROBOT_R68_WORKER_ENABLED', 'JENIOS_ROBOT_R67_ENABLED']) {
    const input = fixture(); delete input.env[key]; assert.equal(inspectR68DeclaredHandoff(input).configurationComplete, false);
  }
  for (const key of ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
    'JENIOS_PRIVATE_PAPER_EXECUTOR', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED']) {
    const input = fixture(); input.env[key] = 'true'; assert.equal(inspectR68DeclaredHandoff(input).configurationComplete, false);
  }
  const input = fixture(); input.env.VERCEL_ENV = 'production'; assert.equal(inspectR68DeclaredHandoff(input).configurationComplete, false);
  const other = fixture(); other.host.workerKind = 'external_scheduler'; missing(other, 'R68_PERSISTENT_SUPERVISOR_REQUIRED');
});

test('R68 does not invoke input accessors or accept supplied readiness evidence', () => {
  let calls = 0; const input = fixture();
  Object.defineProperty(input.env, 'NEXT_PUBLIC_PLATFORM_SUPABASE_URL', { get() { calls++; return 'https://secret.invalid'; } });
  assert.throws(() => inspectR68DeclaredHandoff(input), { code: 'R68_HANDOFF_ENV_INVALID' });
  const outer = {}; Object.defineProperty(outer, 'env', { enumerable: true, get() { calls++; return {}; } });
  assert.throws(() => inspectR68DeclaredHandoff(outer), { code: 'R68_HANDOFF_INPUT_INVALID' });
  for (const key of ['evidence', 'operationalReady', 'adminIdentityVerified', 'callbacks'])
    assert.throws(() => inspectR68DeclaredHandoff({ ...fixture(), [key]: true }), { code: 'R68_HANDOFF_INPUT_INVALID' });
  assert.equal(calls, 0);
});

test('R68 offline report redacts supplied keys, identifiers, URLs and tokens', () => {
  const input = fixture(), report = inspectR68DeclaredHandoff(input), serialized = JSON.stringify(report);
  for (const key of ['PLATFORM_SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_PLATFORM_SUPABASE_PUBLISHABLE_KEY',
    'PLATFORM_SUPABASE_URL', 'JENIOS_ROBOT_R65_ADMIN_ORIGIN', 'JENIOS_ROBOT_R65_SCHEDULER_TOKEN',
    'JENIOS_ROBOT_R67_SOURCE_ID', 'JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY']) assert.equal(serialized.includes(input.env[key]), false, key);
  assert(Object.isFrozen(report.configuration)); assert(Object.isFrozen(report.adminAcceptance));
});

test('R68 CLI returns pending with complete declarations and rejects arguments without echoing them', () => {
  const input = fixture(); const run = args => spawnSync(process.execPath,
    ['scripts/platform/research/r68-declared-handoff.mjs', ...args], { env: { PATH: process.env.PATH, ...input.env }, encoding: 'utf8' });
  const unspecified = run(['--json']); assert.equal(unspecified.status, 1);
  assert.equal(JSON.parse(unspecified.stdout).hostPlan.storageKind, 'unspecified');
  const complete = run(['--json', '--storage', 'persistent_private_volume', '--worker', 'persistent_process', '--wake', 'next_at_ms']);
  assert.equal(complete.status, 2, complete.stderr);
  assert.equal(JSON.parse(complete.stdout).configurationComplete, true);
  assert.equal(JSON.parse(complete.stdout).operationalReady, false);
  assert.equal(complete.stdout.includes(input.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY), false);
  const invalid = run(['--verified-secret=not-for-logs']); assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, ''); assert.equal(invalid.stderr, 'R68_HANDOFF_INVALID\n');
});
