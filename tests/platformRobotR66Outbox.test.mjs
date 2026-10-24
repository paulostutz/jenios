import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, chmodSync, readFileSync, writeFileSync, symlinkSync,
  linkSync, unlinkSync, lstatSync, mkdirSync, existsSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createR66ObservationOutbox, R66_OUTBOX_FILE, R66_OUTBOX_LOCK, R66_DELIVERY_LOCK,
  inspectR66IntakeAcknowledgement, r66DeliveryState } from '../lib/platform/research/robot-r66-observation-outbox.mjs';
import { createR65ObservationSource } from '../lib/platform/research/robot-r65-observation-source.mjs';
import { createR65EvolutionState } from '../lib/platform/research/robot-r65-evolution-engine.mjs';
import { digestR64Value } from '../lib/platform/research/robot-r64-telemetry.mjs';
const NOW = Date.UTC(2026, 9, 24, 18), SCOPE = 'scope:0000000000000066', SOURCE = 'source:0000000000000066', SESSION = 'session:0000000000000066';
const op = n => 'op:' + n.toString(16).padStart(32, '0');
const input = { source: 'synthetic_fixture', mode: 'manual', operatorSide: 'buy', technicalSide: 'sell', confidence: 0.85 };
const inputDigest = digestR64Value({ kind: 'assisted', input });
const denied = (fn, code) => assert.throws(fn, e => !code || e.code === code);
function fixture(t) {
  const directory = mkdtempSync('/tmp/jenios-r66-outbox-');
  t.after(() => { if (existsSync(directory)) { chmodSync(directory, 0o700); rmSync(directory, { force: true, recursive: true }); } });
  const { privateKey } = generateKeyPairSync('ed25519');
  const state = createR65EvolutionState({ scopeId: SCOPE, nowMs: NOW - 1000 });
  const source = createR65ObservationSource({ enabled: true, domain: 'R61_SYNTHETIC_RUNTIME', scopeId: SCOPE,
    sourceId: SOURCE, sessionId: SESSION, privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }),
    getActiveState: () => state, now: () => NOW, initialSequence: 1,
    ultraConfig: { sessionId: SESSION, evidenceKind: 'SYNTHETIC_FIXTURE', planCode: 'platform-global-crypto', symbol: 'BTC-USD', capital: 1000, leverage: 2 } });
  const config = { directory, key: 'c'.repeat(64), trustedSource: source.trustedSource };
  const outbox = createR66ObservationOutbox(config);
  outbox.reserveSession({ sessionId: SESSION, startedAtMs: NOW, evolutionState: state });
  const capture = n => outbox.capture({ operationId: op(n), inputDigest, sessionId: SESSION,
    produce: () => ({ record: source.captureAssisted({ operationId: op(n), input }), evolutionState: state }) });
  return { directory, config, state, source, outbox, capture };
}
function ackFor(record) {
  return { schema: 'JENIOS_R65_INTAKE_RESULT_V1', status: 'STORED', eventId: record.envelope.payload.eventId,
    scopeId: SCOPE, observationEvidenceKind: 'SIGNED_QA_REPLAY', runtimeOrigin: 'R61_SYNTHETIC_RUNTIME',
    validationEvidenceKind: 'SYNTHETIC_FIXTURE', customerMonitoringActive: false, privateEngineConnected: false,
    realOrdersSent: 0, externalPaperOrdersSent: 0 };
}

test('R66 durable files enforce private permissions and preserve all signed records after reopening', t => {
  const f = fixture(t); const a = f.capture(1).record, b = f.capture(2).record;
  assert.equal(lstatSync(f.directory).mode & 0o7777, 0o700);
  assert.equal(lstatSync(`${f.directory}/${R66_OUTBOX_FILE}`).mode & 0o7777, 0o600);
  const reopened = createR66ObservationOutbox(f.config).read();
  assert.deepEqual(reopened.entries.map(e => e.record), [a, b]); assert.equal(reopened.sessions.length, 1);
  assert.equal(existsSync(`${f.directory}/${R66_OUTBOX_LOCK}`), false);
});

test('R66 corrupt JSON, valid-JSON tampering and a substituted HMAC key fail closed', t => {
  const f = fixture(t); f.capture(1);
  const path = `${f.directory}/${R66_OUTBOX_FILE}`, original = readFileSync(path, 'utf8');
  writeFileSync(path, original.slice(0, -10)); denied(() => f.outbox.read(), 'R66_OUTBOX_INVALID_JSON');
  const tampered = JSON.parse(original); tampered.payload.entries[0].record.envelope.payload.event.decision = 'ALLOW';
  writeFileSync(path, JSON.stringify(tampered)); denied(() => f.outbox.read(), 'R66_OUTBOX_HMAC_MISMATCH');
  writeFileSync(path, original);
  denied(() => createR66ObservationOutbox({ ...f.config, key: 'a'.repeat(64) }), 'R66_OUTBOX_HMAC_MISMATCH');
  assert.equal(f.outbox.read().entries.length, 1);
});

test('R66 source identity/key/scope pinning rejects reopening a queue under different trust', t => {
  const f = fixture(t); f.capture(1);
  for (const patch of [{ sourceId: 'source:ffffffffffffffff' }, { scopeId: 'scope:ffffffffffffffff' }]) {
    denied(() => createR66ObservationOutbox({ ...f.config, trustedSource: { ...f.config.trustedSource, ...patch } }), 'R66_OUTBOX_INVALID_SNAPSHOT');
  }
  const { publicKey } = generateKeyPairSync('ed25519');
  denied(() => createR66ObservationOutbox({ ...f.config, trustedSource: { ...f.config.trustedSource,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) } }), 'R66_OUTBOX_INVALID_SNAPSHOT');
});

test('R66 world-readable files, symlinks and hard-linked queue files are rejected', t => {
  const f = fixture(t), path = `${f.directory}/${R66_OUTBOX_FILE}`, other = `${f.directory}/saved.json`;
  chmodSync(path, 0o644); denied(() => f.outbox.read(), 'R66_OUTBOX_FILE_UNSAFE'); chmodSync(path, 0o600);
  linkSync(path, other); denied(() => f.outbox.read(), 'R66_OUTBOX_FILE_UNSAFE'); unlinkSync(other);
  const bytes = readFileSync(path); unlinkSync(path); writeFileSync(other, bytes, { mode: 0o600 });
  symlinkSync(other, path); denied(() => f.outbox.read(), 'R66_OUTBOX_FILE_UNSAFE');
});

test('R66 rejects repository directories, public directories and symlinked directory paths', t => {
  const f = fixture(t);
  denied(() => createR66ObservationOutbox({ ...f.config, directory: process.cwd() }), 'R66_OUTBOX_IN_REPOSITORY_FORBIDDEN');
  chmodSync(f.directory, 0o755); denied(() => f.outbox.read(), 'R66_OUTBOX_DIRECTORY_UNSAFE'); chmodSync(f.directory, 0o700);
  const parent = mkdtempSync('/tmp/jenios-r66-path-'); t.after(() => rmSync(parent, { force: true, recursive: true }));
  const linked = `${parent}/linked`; symlinkSync(f.directory, linked);
  denied(() => createR66ObservationOutbox({ ...f.config, directory: linked }), 'R66_OUTBOX_DIRECTORY_UNSAFE');
});

test('R66 orphan transaction locks are retained and never automatically stolen or reset', t => {
  const f = fixture(t), path = `${f.directory}/${R66_OUTBOX_LOCK}`;
  const lock = JSON.stringify({ pid: 999999999, token: 'operator-review-required' });
  writeFileSync(path, lock, { mode: 0o600 });
  denied(() => f.outbox.read(), 'R66_OUTBOX_LOCKED');
  denied(() => f.capture(1), 'R66_OUTBOX_LOCKED');
  assert.equal(readFileSync(path, 'utf8'), lock);
});

test('R66 an orphan delivery lock blocks retransmission without deleting the queued records', async t => {
  const f = fixture(t); f.capture(1);
  const path = `${f.directory}/${R66_DELIVERY_LOCK}`;
  writeFileSync(path, '{"pid":999999999,"token":"review"}', { mode: 0o600 });
  let called = false;
  await assert.rejects(f.outbox.withDeliveryLease(async () => { called = true; }), e => e.code === 'R66_OUTBOX_LOCKED');
  assert.equal(called, false); assert.equal(f.outbox.read().entries.length, 1); assert(existsSync(path));
});

test('R66 no concurrent capture can enter the producer while the first transaction owns its lock', t => {
  const f = fixture(t); let secondRan = false;
  f.outbox.capture({ operationId: op(1), inputDigest, sessionId: SESSION, produce: () => {
    denied(() => f.outbox.capture({ operationId: op(2), inputDigest, sessionId: SESSION,
      produce: () => { secondRan = true; } }), 'R66_OUTBOX_LOCKED');
    return { record: f.source.captureAssisted({ operationId: op(1), input }), evolutionState: f.state };
  } });
  assert.equal(secondRan, false); assert.equal(f.outbox.read().entries.length, 1);
});

test('R66 retries are globally idempotent and a conflicting input never invokes the producer', t => {
  const f = fixture(t), original = f.capture(1).record, revision = f.outbox.read().revision;
  let calls = 0;
  const retry = f.outbox.capture({ operationId: op(1), inputDigest, sessionId: SESSION, produce: () => { calls++; } });
  assert.deepEqual(retry, { record: original, replayed: true }); assert.equal(calls, 0);
  assert.equal(f.outbox.read().revision, revision);
  denied(() => f.outbox.capture({ operationId: op(1), inputDigest: 'e'.repeat(64), sessionId: SESSION,
    produce: () => { calls++; } }), 'R66_OUTBOX_OPERATION_CONFLICT');
  assert.equal(calls, 0);
});

test('R66 unregistered/reused sessions and alternate evolution histories cannot replace durable history', t => {
  const f = fixture(t); f.capture(1);
  denied(() => f.outbox.reserveSession({ sessionId: SESSION, startedAtMs: NOW, evolutionState: f.state }), 'R66_OUTBOX_SESSION_REUSED');
  denied(() => f.outbox.capture({ operationId: op(2), inputDigest, sessionId: 'session:0000000000000002', produce: () => assert.fail('not called') }), 'R66_OUTBOX_SESSION');
  const alternate = createR65EvolutionState({ scopeId: SCOPE, nowMs: NOW - 500 });
  denied(() => f.outbox.reserveSession({ sessionId: 'session:0000000000000002', startedAtMs: NOW, evolutionState: alternate }), 'R66_OUTBOX_EVOLUTION_REGRESSION');
  assert.equal(f.outbox.read().sessions.length, 1);
});

test('R66 signed observations cannot be attached to a different operation ID or omit the preceding sequence', t => {
  const f = fixture(t), record = f.source.captureAssisted({ operationId: op(1), input });
  denied(() => f.outbox.capture({ operationId: op(2), inputDigest, sessionId: SESSION,
    produce: () => ({ record, evolutionState: f.state }) }), 'R66_OUTBOX_OPERATION_BINDING');
  const later = f.source.captureAssisted({ operationId: op(2), input });
  denied(() => f.outbox.capture({ operationId: op(2), inputDigest, sessionId: SESSION,
    produce: () => ({ record: later, evolutionState: f.state }) }), 'R66_OUTBOX_SEQUENCE_BINDING');
  assert.equal(f.outbox.read().entries.length, 0);
});

test('R66 ACK requires the current persisted attempt and exact endpoint identity; pending cannot silently become delivered', t => {
  const f = fixture(t), record = f.capture(1).record;
  const { attemptId } = f.outbox.beginAttempt({ operationId: op(1), nowMs: NOW });
  const acknowledgement = inspectR66IntakeAcknowledgement(ackFor(record), record, 202);
  denied(() => f.outbox.resolveAttempt({ operationId: op(1), attemptId: 'attempt:' + 'f'.repeat(32), nowMs: NOW, acknowledgement }), 'R66_OUTBOX_ATTEMPT_BINDING');
  denied(() => f.outbox.resolveAttempt({ operationId: op(1), attemptId, nowMs: NOW,
    acknowledgement: { httpStatus: 202, body: { ...ackFor(record), eventId: 'evt:ffffffffffffffff' } } }), 'R66_OUTBOX_ACK_BINDING');
  assert.equal(r66DeliveryState(f.outbox.read().entries[0]), 'UNCONFIRMED');
  f.outbox.resolveAttempt({ operationId: op(1), attemptId, nowMs: NOW, acknowledgement });
  assert.equal(r66DeliveryState(f.outbox.read().entries[0]), 'ACKNOWLEDGED');
  denied(() => f.outbox.beginAttempt({ operationId: op(1), nowMs: NOW }), 'R66_OUTBOX_ATTEMPT_FORBIDDEN');
});

test('R66 unresolved in-flight attempt remains uncertain after host recovery and cannot be retroactively acknowledged', t => {
  const f = fixture(t); f.capture(1);
  const first = f.outbox.beginAttempt({ operationId: op(1), nowMs: NOW });
  const second = createR66ObservationOutbox(f.config).beginAttempt({ operationId: op(1), nowMs: NOW + 1 });
  const attempts = f.outbox.read().entries[0].attempts;
  assert.equal(attempts[0].outcome, 'UNCERTAIN'); assert.equal(attempts[0].resolvedAtMs, NOW + 1);
  assert.equal(attempts[1].outcome, 'IN_FLIGHT'); assert.notEqual(first.attemptId, second.attemptId);
  denied(() => f.outbox.resolveAttempt({ operationId: op(1), attemptId: first.attemptId, nowMs: NOW + 1 }), 'R66_OUTBOX_ATTEMPT_BINDING');
});


test('R66 abrupt death of a real delivery-lock owner fails closed across processes until explicit host recovery', async t => {
  const f = fixture(t); f.capture(1);
  const childCode = `
    import { createR66ObservationOutbox } from './lib/platform/research/robot-r66-observation-outbox.mjs';
    const config=JSON.parse(process.env.JENIOS_R66_TEST_INPUT); delete process.env.JENIOS_R66_TEST_INPUT;
    const outbox=createR66ObservationOutbox(config);
    await outbox.withDeliveryLease(async()=>{
      process.stdout.write('LOCKED\\n'); process.stdin.resume();
      await new Promise(resolve=>process.stdin.once('end',resolve));
    });
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', childCode], {
    cwd: process.cwd(), env: { ...process.env, JENIOS_R66_TEST_INPUT: JSON.stringify(f.config) }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const ready = await Promise.race([
    once(child.stdout, 'data').then(([data]) => data.toString()),
    once(child, 'error').then(([error]) => { throw error; }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('child did not acquire lock')), 10000); timer.unref(); }),
  ]);
  assert.equal(ready, 'LOCKED\n');
  await assert.rejects(f.outbox.withDeliveryLease(async () => assert.fail('second sender forbidden')), e => e.code === 'R66_OUTBOX_LOCKED');
  const exited = once(child, 'exit'); child.kill('SIGKILL');
  const [, signal] = await exited; assert.equal(signal, 'SIGKILL');
  await assert.rejects(f.outbox.withDeliveryLease(async () => assert.fail('orphan must not be stolen')), e => e.code === 'R66_OUTBOX_LOCKED');
  assert.equal(f.outbox.read().entries.length, 1);
  // This test host has observed this exact child exit and performs explicit recovery.
  unlinkSync(`${f.directory}/${R66_DELIVERY_LOCK}`);
  let resumed = false; await f.outbox.withDeliveryLease(async () => { resumed = true; }); assert.equal(resumed, true);
});
