import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createR67PrivateCoreSource } from '../lib/platform/research/robot-r67-private-source.mjs';
import { createR67DurableEmitter } from '../lib/platform/research/robot-r67-durable-emitter.mjs';
import { R67_ORIGIN } from '../lib/platform/research/robot-r67-private-protocol.mjs';
const key = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
const sourceConfig = { enabled: true, domain: R67_ORIGIN, handle: {}, scopeId: 'scope:' + '67'.repeat(8),
  sourceId: 'source:' + '67'.repeat(8), sessionId: 'session:' + '67'.repeat(8), privateKeyPem: key };
test('R67 source cannot accept a fabricated branded handle or a supplied analyzeRequest', () => {
  let called = 0;
  assert.throws(() => createR67PrivateCoreSource({ ...sourceConfig,
    handle: { schema: 'JENIOS_R67_PRIVATE_CORE_HANDLE_V1', localExecutableBytesVerified: true,
      analyzeRequest: () => { called++; } } }), /R67_CORE_HANDLE/);
  assert.throws(() => createR67PrivateCoreSource({ ...sourceConfig, analyzeRequest: () => { called++; } }), /R67_SOURCE_CONFIG/);
  assert.equal(called, 0);
});
test('R67 factory refuses operational domains, generation injection and accessor configuration', () => {
  assert.throws(() => createR67PrivateCoreSource({ ...sourceConfig, domain: 'OPERATIONAL' }), /R67_SOURCE_DISABLED/);
  assert.throws(() => createR67PrivateCoreSource({ ...sourceConfig, enabled: false }), /R67_SOURCE_DISABLED/);
  assert.throws(() => createR67PrivateCoreSource({ ...sourceConfig, initialSequence: 7 }), /R67_SOURCE_CONFIG/);
  assert.throws(() => createR67PrivateCoreSource({ ...sourceConfig, generation: 7 }), /R67_SOURCE_CONFIG/);
  let touched = false;
  assert.throws(() => createR67PrivateCoreSource({ ...sourceConfig, get handle() { touched = true; return {}; } }), /R67_SOURCE_CONFIG/);
  assert.equal(touched, false);
});
test('R67 durable wrapper cannot bypass the source with caller record, callback or session', () => {
  const config = { enabled: true, domain: R67_ORIGIN, directory: '/tmp/never-created-r67-invalid-source',
    key: '67'.repeat(32), scopeId: sourceConfig.scopeId, sourceId: sourceConfig.sourceId, privateKeyPem: key, handle: {} };
  assert.throws(() => createR67DurableEmitter(config), /R67_CORE_HANDLE/);
  for (const value of [{ source: {} }, { sessionId: sourceConfig.sessionId }, { captureBatch: async () => ({}) }, { record: {} }])
    assert.throws(() => createR67DurableEmitter({ ...config, ...value }), /R67_EMITTER_CONFIG/);
});
