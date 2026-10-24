import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { isRobotR67QaEnabled, requireR67QaEnabled, readR67SourceConfiguration } from '../lib/platform/research/robot-r67-access.mjs';
import { createR67Runtime } from '../lib/platform/research/robot-r67-runtime.mjs';
import { R67_EVIDENCE } from '../lib/platform/research/robot-r67-private-protocol.mjs';

const publicKey = () => generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
const env = () => ({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' });
const configured = () => ({ ...env(), JENIOS_ROBOT_R67_SCOPE_ID: 'scope:6767676767676767',
  JENIOS_ROBOT_R67_SOURCE_ID: 'source:6767676767676767', JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY: publicKey() });

test('R67 gates require explicit isolated QA and paid/execution off before runtime construction', () => {
  assert.equal(isRobotR67QaEnabled(env()), true);
  for (const changed of [{}, { ...env(), VERCEL_ENV: 'production' }, { ...env(), JENIOS_ROBOT_R67_ENABLED: 'false' },
    { ...env(), JENIOS_REAL_EXECUTION_ENABLED: 'true' }, { ...env(), JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'true' },
    { ...env(), JENIOS_PRIVATE_PAPER_EXECUTOR: 'true' }, { ...env(), JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'true' },
    { ...env(), JENIOS_ROBOT_ANALYST_PAID_ENABLED: undefined }]) {
    assert.equal(isRobotR67QaEnabled(changed), false);
    assert.throws(() => requireR67QaEnabled(changed), { code: 'R67_DISABLED', status: 404 });
    assert.throws(() => createR67Runtime(changed), { code: 'R67_DISABLED', status: 404 });
  }
});

test('R67 configuration never executes accessors or treats a declaration as a private runtime proof', () => {
  let invoked = 0;
  const candidate = env();
  Object.defineProperty(candidate, 'JENIOS_ROBOT_R67_ENABLED', { get() { invoked++; return 'true'; } });
  assert.equal(isRobotR67QaEnabled(candidate), false);
  const sourceEnv = configured();
  Object.defineProperty(sourceEnv, 'JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY', { get() { invoked++; throw Error('secret'); } });
  assert.throws(() => readR67SourceConfiguration(sourceEnv), { code: 'R67_SOURCE_NOT_CONFIGURED' });
  assert.equal(invoked, 0);
  const source = readR67SourceConfiguration(configured());
  assert.deepEqual(Object.keys(source).sort(), ['enabled', 'evidenceKind', 'publicKeyPem', 'scopeId', 'sourceId']);
  assert.equal(source.evidenceKind, R67_EVIDENCE);
});

test('R67 domain identity must be distinct from configured R64/R65 source ID and key bytes', () => {
  const candidate = configured(), distinct = publicKey();
  assert.equal(readR67SourceConfiguration({ ...candidate, JENIOS_ROBOT_R65_ENABLED: 'true',
    JENIOS_ROBOT_R64_SOURCE_ID: 'source:6464646464646464', JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY: distinct }).sourceId,
  candidate.JENIOS_ROBOT_R67_SOURCE_ID);
  for (const previous of [
    { JENIOS_ROBOT_R64_SOURCE_ID: candidate.JENIOS_ROBOT_R67_SOURCE_ID, JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY: distinct },
    { JENIOS_ROBOT_R64_SOURCE_ID: 'source:6464646464646464', JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY: candidate.JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY.replaceAll('\n', '\r\n') },
    { JENIOS_ROBOT_R65_ENABLED: 'true' },
    { JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_R64_SOURCE_ID: 'source:6464646464646464' },
  ]) assert.throws(() => readR67SourceConfiguration({ ...candidate, ...previous }), { code: 'R67_SOURCE_NOT_CONFIGURED', status: 503 });
});

test('R67 malformed source configuration fails closed without leaking key material', () => {
  const candidate = configured();
  for (const changed of [{ JENIOS_ROBOT_R67_SCOPE_ID: 'client-controlled' }, { JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY: 'secret-invalid-key' },
    { JENIOS_ROBOT_R67_SOURCE_ID: undefined }]) {
    assert.throws(() => readR67SourceConfiguration({ ...candidate, ...changed }), error =>
      error.message === 'R67_SOURCE_NOT_CONFIGURED' && !error.message.includes('secret'));
  }
});
