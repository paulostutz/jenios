import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { isRobotR71QaEnabled, requireR71QaEnabled, readR71SourceConfiguration,
  isR71AdminOriginAllowed, isR71SchedulerAuthorized } from '../lib/platform/research/robot-r71-access.mjs';

const qa = () => ({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R71_ENABLED: 'true', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' });
const token = 'r71-fixture-only-scheduler-token-00000000001';

test('R71 explicit QA opt-in refuses production, paid generation, real and Paper execution', () => {
  assert.equal(isRobotR71QaEnabled(qa()), true);
  for (const key of Object.keys(qa())) {
    const env = qa(); delete env[key]; assert.equal(isRobotR71QaEnabled(env), false, key);
  }
  for (const [key, value] of [['VERCEL_ENV', 'production'], ['JENIOS_ROBOT_ANALYST_PAID_ENABLED', 'true'],
    ['JENIOS_REAL_EXECUTION_ENABLED', 'true'], ['JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED', 'true'], ['JENIOS_PRIVATE_PAPER_EXECUTOR', 'true']]) {
    const env = { ...qa(), [key]: value }; assert.equal(isRobotR71QaEnabled(env), false);
    assert.throws(() => requireR71QaEnabled(env), /R71_DISABLED/);
  }
  let reads = 0; const env = qa(); Object.defineProperty(env, 'JENIOS_ROBOT_R71_ENABLED', { get() { reads++; return 'true'; } });
  assert.equal(isRobotR71QaEnabled(env), false); assert.equal(reads, 0);
});

test('R71 source remains the configured R67 identity and cannot reuse the R64/R65 key or ID', () => {
  const keys = generateKeyPairSync('ed25519');
  const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' });
  const env = { ...qa(), JENIOS_ROBOT_R67_SCOPE_ID: 'scope:' + '1'.repeat(16),
    JENIOS_ROBOT_R67_SOURCE_ID: 'source:' + '2'.repeat(16), JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY: publicKey };
  assert.equal(readR71SourceConfiguration(env).sourceId, env.JENIOS_ROBOT_R67_SOURCE_ID);
  for (const conflict of [{ JENIOS_ROBOT_R64_SOURCE_ID: env.JENIOS_ROBOT_R67_SOURCE_ID },
    { JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY: publicKey }]) assert.throws(() => readR71SourceConfiguration({ ...env, ...conflict }), /R67_SOURCE_NOT_CONFIGURED/);
  assert.throws(() => readR71SourceConfiguration({ ...env, JENIOS_ROBOT_R71_ENABLED: 'false' }), /R71_DISABLED/);
});

test('R71 mutations require an explicit canonical server origin despite Next rewriting loopback', () => {
  const origin = 'http://127.0.0.1:4371', env = { JENIOS_ROBOT_R71_ADMIN_ORIGIN: origin };
  const req = headers => new Request('http://localhost:4371/api/platform/admin/robot-private-evolution', { method: 'POST', headers });
  assert.equal(isR71AdminOriginAllowed(req({ Origin: origin }), env), true);
  assert.equal(isR71AdminOriginAllowed(req({}), env), true);
  for (const attempted of ['http://localhost:4371', 'https://untrusted.invalid', 'null'])
    assert.equal(isR71AdminOriginAllowed(req({ Origin: attempted, Host: '127.0.0.1:4371', Forwarded: 'host=127.0.0.1:4371;proto=http' }), env), false);
  for (const configured of [undefined, '', origin + '/', 'http://untrusted.invalid'])
    assert.equal(isR71AdminOriginAllowed(req({}), { JENIOS_ROBOT_R71_ADMIN_ORIGIN: configured }), false);
});

test('R71 scheduler token is bounded, exact and distinct from the certified R65 scheduler token', () => {
  const request = value => new Request('https://qa.invalid/api/platform/internal/robot-private-evolution', {
    method: 'POST', headers: value ? { Authorization: 'Bearer ' + value } : {} });
  const env = { JENIOS_ROBOT_R71_SCHEDULER_TOKEN: token };
  assert.equal(isR71SchedulerAuthorized(request(token), env), true);
  assert.equal(isR71SchedulerAuthorized(request(token), { ...env, JENIOS_ROBOT_R65_SCHEDULER_TOKEN: token }), false);
  for (const value of [undefined, '', 'short', 'x'.repeat(257), 'x'.repeat(32) + ' y'])
    assert.equal(isR71SchedulerAuthorized(request(token), { JENIOS_ROBOT_R71_SCHEDULER_TOKEN: value }), false);
  for (const value of [undefined, token + 'x', token.slice(1)]) assert.equal(isR71SchedulerAuthorized(request(value), env), false);
});
