import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, chmodSync, readFileSync, writeFileSync, lstatSync,
  existsSync, unlinkSync, copyFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createPrivateDurableFile } from '../lib/platform/research/robot-private-durable-file.mjs';
import { createR66ObservationOutbox, R66_OUTBOX_FILE } from '../lib/platform/research/robot-r66-observation-outbox.mjs';
import { createR67PrivateCaptureOutbox, R67_OUTBOX_FILE, R67_OUTBOX_LOCK,
  R67_DELIVERY_LOCK, r67DeliveryState } from '../lib/platform/research/robot-r67-private-capture-outbox.mjs';
import { createR67ProtocolFixture, R67_PROTOCOL_FIXTURE_KIND, R67_FIXTURE_SCENARIOS } from './fixtures/r67-private-protocol-fixture.mjs';
import { verifyR67PrivateObservationRecord, createR67IntakeAcknowledgement, R67_BINDING } from '../lib/platform/research/robot-r67-private-protocol.mjs';
const NOW = Date.UTC(2026, 9, 24, 20), SESSION = 'session:6767676767676767';
const op = n => 'op:' + n.toString(16).padStart(32, '0');
const clone = value => JSON.parse(JSON.stringify(value));
const denied = (fn, code) => assert.throws(fn, e => !code || e.code === code);
const rejected = (p, code) => assert.rejects(p, e => !code || e.code === code);
function directory(t) {
  const path = mkdtempSync('/tmp/jenios-r67-outbox-');
  t.after(() => { chmodSync(path, 0o700); rmSync(path, { force: true, recursive: true }); });
  return path;
}
async function fixture(t) {
  const dir = directory(t), first = await createR67ProtocolFixture({ nowMs: NOW, operationId: op(1) });
  assert.equal(first.fixtureEvidence, R67_PROTOCOL_FIXTURE_KIND);
  const config = { directory: dir, key: '7'.repeat(64), trustedSource: first.trustedSource };
  const outbox = createR67PrivateCaptureOutbox(config);
  outbox.reserveSession({ sessionId: SESSION, startedAtMs: NOW });
  const nextRecord = (n, patch = {}) => createR67ProtocolFixture({ nowMs: NOW, sequence: n,
    operationId: op(n), privateKeyPem: first.privateKeyPem, ...patch });
  const capture = record => outbox.capture({ operationId: record.provenance.operationId,
    inputDigest: record.provenance.inputDigest, sessionId: record.envelope.payload.sessionId,
    produce: async () => ({ record }) });
  return { dir, first, config, outbox, nextRecord, capture };
}
function acknowledgement(record, trustedSource, status = 'STORED') {
  const { receipt } = verifyR67PrivateObservationRecord(record, { trustedSource, nowMs: NOW });
  return { httpStatus: status === 'STORED' ? 202 : 200,
    body: createR67IntakeAcknowledgement({ receipt, record }, status) };
}
function acknowledge(f, record) {
  const operationId = record.provenance.operationId, { attemptId } = f.outbox.beginAttempt({ operationId, nowMs: NOW });
  f.outbox.resolveAttempt({ operationId, attemptId, nowMs: NOW,
    acknowledgement: acknowledgement(record, f.config.trustedSource) });
}

test('R67 extraction reads and rewrites the certified original R66 fixture byte-for-byte', t => {
  const golden = JSON.parse(readFileSync(new URL('./fixtures/r67-r66-certified-outbox.json', import.meta.url), 'utf8'));
  assert.equal(golden.originalCommit, '4110b424f09499221d6c7c50c9237ccfe5a47135');
  assert.equal(golden.originalBlob, '107b3018746ef86348a37614864eda42c3bdd3a2');
  assert.equal(golden.evidenceKind, 'SYNTHETIC_FIXTURE_ONLY_NO_PRIVATE_EXECUTION');
  const dir = directory(t), path = `${dir}/${R66_OUTBOX_FILE}`;
  writeFileSync(path, golden.before, { mode: 0o600 });
  const outbox = createR66ObservationOutbox({ directory: dir, key: golden.testOnlyHmacKey, trustedSource: golden.trustedSource });
  assert.deepEqual(outbox.read(), JSON.parse(golden.before).payload);
  const before = readFileSync(path);
  const retry = outbox.capture({ operationId: golden.operationId, inputDigest: golden.inputDigest,
    sessionId: golden.sessionId, produce: () => assert.fail('certified record must not be regenerated') });
  assert.equal(retry.replayed, true); assert.deepEqual(readFileSync(path), before);
  outbox.reserveSession(golden.nextSession);
  assert.equal(readFileSync(path, 'utf8'), golden.after);
});

test('R67 private batch queue persists all native captures atomically with its own immutable binding', async t => {
  const f = await fixture(t), result = await f.capture(f.first.record);
  assert.equal(result.replayed, false);
  const snapshot = f.outbox.read(), text = readFileSync(`${f.dir}/${R67_OUTBOX_FILE}`, 'utf8');
  assert.equal(snapshot.entries.length, 1); assert.equal(snapshot.entries[0].record.envelope.payload.capture.entries.length, 3);
  assert.deepEqual(snapshot.runtimeBinding, R67_BINDING); assert.equal(Object.hasOwn(snapshot, 'evolutionState'), false);
  assert.deepEqual(snapshot.entries[0].record, f.first.record);
  for (const forbidden of ['R61_SYNTHETIC_RUNTIME', 'JENIOS_R65_EVOLUTION_STATE', 'PRIVATE KEY']) assert.equal(text.includes(forbidden), false);
  assert.equal(text.includes(f.config.key), false);
  assert.equal(lstatSync(`${f.dir}/${R67_OUTBOX_FILE}`).mode & 0o7777, 0o600);
  assert.equal(existsSync(`${f.dir}/${R67_OUTBOX_LOCK}`), false);
});

test('R67 retry after reopen returns exact batch and never reexecutes its async producer', async t => {
  const f = await fixture(t); await f.capture(f.first.record);
  const reopened = createR67PrivateCaptureOutbox(f.config), nextSession = 'session:6767676767676768';
  reopened.reserveSession({ sessionId: nextSession, startedAtMs: NOW + 1 });
  let calls = 0;
  const result = await reopened.capture({ operationId: op(1), inputDigest: f.first.record.provenance.inputDigest,
    sessionId: nextSession, produce: async () => { calls++; } });
  assert.equal(result.replayed, true); assert.deepEqual(result.record, f.first.record); assert.equal(calls, 0);
  await rejected(reopened.capture({ operationId: op(1), inputDigest: 'a'.repeat(64), sessionId: nextSession,
    produce: async () => { calls++; } }), 'R67_OUTBOX_OPERATION_CONFLICT');
  assert.equal(calls, 0); assert.equal(reopened.read().entries.length, 1);
});

test('R67 transaction lock remains held across await and rejects concurrent producers and reads', async t => {
  const f = await fixture(t); let release, entered;
  const ready = new Promise(r => { entered = r; });
  const first = f.outbox.capture({ operationId: op(1), inputDigest: f.first.record.provenance.inputDigest,
    sessionId: SESSION, produce: async () => { entered(); await new Promise(r => { release = r; }); return { record: f.first.record }; } });
  await ready;
  denied(() => f.outbox.read(), 'R67_OUTBOX_LOCKED');
  let secondCalls = 0;
  await rejected(f.outbox.capture({ operationId: op(1), inputDigest: f.first.record.provenance.inputDigest,
    sessionId: SESSION, produce: async () => { secondCalls++; } }), 'R67_OUTBOX_LOCKED');
  assert.equal(secondCalls, 0); assert(existsSync(`${f.dir}/${R67_OUTBOX_LOCK}`));
  release(); await first; assert.equal(f.outbox.read().entries.length, 1);
});

test('R67 failed async capture and partially returned batches leave the committed queue unchanged', async t => {
  const f = await fixture(t), before = readFileSync(`${f.dir}/${R67_OUTBOX_FILE}`, 'utf8');
  await assert.rejects(f.outbox.capture({ operationId: op(1), inputDigest: f.first.record.provenance.inputDigest,
    sessionId: SESSION, produce: async () => { await Promise.resolve(); throw Error('private producer failed'); } }));
  assert.equal(readFileSync(`${f.dir}/${R67_OUTBOX_FILE}`, 'utf8'), before);
  const partial = clone(f.first.record); partial.envelope.payload.capture.entries.pop();
  await rejected(f.capture(partial));
  assert.equal(readFileSync(`${f.dir}/${R67_OUTBOX_FILE}`, 'utf8'), before);
  assert.equal(existsSync(`${f.dir}/${R67_OUTBOX_LOCK}`), false);
});

test('R67 signatures, engine identity, input digests and native batch actions cannot be substituted', async t => {
  const f = await fixture(t);
  for (const change of [r => { r.envelope.signatureBase64 = 'A'.repeat(86) + '=='; },
    r => { r.provenance.engineSha256 = '0'.repeat(64); },
    r => { r.provenance.inputDigest = '0'.repeat(64); },
    r => { r.envelope.payload.capture.entries[0].action = 'reverse_preview'; }]) {
    const changed = clone(f.first.record); change(changed); await rejected(f.capture(changed));
  }
  assert.equal(f.outbox.read().entries.length, 0);
});

test('R67 ordered session delivery rejects a later sequence while its predecessor is pending or uncertain', async t => {
  const f = await fixture(t), second = await f.nextRecord(2);
  await f.capture(f.first.record); await f.capture(second.record);
  denied(() => f.outbox.beginAttempt({ operationId: op(2), nowMs: NOW }), 'R67_OUTBOX_PRIOR_SEQUENCE_UNCONFIRMED');
  const { attemptId } = f.outbox.beginAttempt({ operationId: op(1), nowMs: NOW });
  f.outbox.resolveAttempt({ operationId: op(1), attemptId, nowMs: NOW });
  denied(() => f.outbox.beginAttempt({ operationId: op(2), nowMs: NOW }), 'R67_OUTBOX_PRIOR_SEQUENCE_UNCONFIRMED');
  acknowledge(f, f.first.record);
  assert.equal(f.outbox.beginAttempt({ operationId: op(2), nowMs: NOW }).record.envelope.payload.sequence, 2);
});

test('R67 an expired predecessor blocks only its own session and remains unconfirmed without re-signing', async t => {
  const f = await fixture(t); await f.capture(f.first.record);
  const late = await f.nextRecord(2, { nowMs: NOW + 1000 }); await f.capture(late.record);
  assert.equal(f.outbox.expire({ nowMs: NOW + 120000 }).expired, 1);
  denied(() => f.outbox.beginAttempt({ operationId: op(2), nowMs: NOW + 120000 }), 'R67_OUTBOX_PRIOR_SEQUENCE_UNCONFIRMED');
  const sessionId = 'session:6767676767676768'; f.outbox.reserveSession({ sessionId, startedAtMs: NOW + 120000 });
  const fresh = await f.nextRecord(3, { sequence: 1, sessionId, nowMs: NOW + 120000 }); await f.capture(fresh.record);
  assert.equal(f.outbox.beginAttempt({ operationId: op(3), nowMs: NOW + 120000 }).record.envelope.payload.sequence, 1);
  const expired = f.outbox.read().entries[0]; assert.equal(r67DeliveryState(expired), 'EXPIRED_UNCONFIRMED');
  assert.deepEqual(expired.record, f.first.record);
});

test('R67 ACKs bind the entire batch digest, count and runtime identity before confirming delivery', async t => {
  const f = await fixture(t); await f.capture(f.first.record);
  const { attemptId } = f.outbox.beginAttempt({ operationId: op(1), nowMs: NOW });
  const good = acknowledgement(f.first.record, f.config.trustedSource);
  for (const patch of [{ recordDigest: '0'.repeat(64) }, { captureCount: 2 }, { serviceSha256: '0'.repeat(64) },
    { generation: 1 }, { sourceId: 'source:ffffffffffffffff' }]) {
    denied(() => f.outbox.resolveAttempt({ operationId: op(1), attemptId, nowMs: NOW,
      acknowledgement: { ...good, body: { ...good.body, ...patch } } }), 'R67_OUTBOX_ACK_BINDING');
  }
  assert.equal(r67DeliveryState(f.outbox.read().entries[0]), 'UNCONFIRMED');
  f.outbox.resolveAttempt({ operationId: op(1), attemptId, nowMs: NOW, acknowledgement: good });
  assert.equal(r67DeliveryState(f.outbox.read().entries[0]), 'ACKNOWLEDGED');
});

test('R67 files reject HMAC tampering, changed keys and changed source identity', async t => {
  const f = await fixture(t); await f.capture(f.first.record);
  denied(() => createR67PrivateCaptureOutbox({ ...f.config, key: 'a'.repeat(64) }), 'R67_OUTBOX_HMAC_MISMATCH');
  denied(() => createR67PrivateCaptureOutbox({ ...f.config,
    trustedSource: { ...f.config.trustedSource, sourceId: 'source:ffffffffffffffff' } }), 'R67_OUTBOX_INVALID_SNAPSHOT');
  const file = `${f.dir}/${R67_OUTBOX_FILE}`, original = readFileSync(file, 'utf8'), bad = JSON.parse(original);
  bad.payload.entries[0].record.provenance.generation = 1; writeFileSync(file, JSON.stringify(bad));
  denied(() => f.outbox.read(), 'R67_OUTBOX_HMAC_MISMATCH');
  writeFileSync(file, original); chmodSync(file, 0o644); denied(() => f.outbox.read(), 'R67_OUTBOX_FILE_UNSAFE');
});

test('R66 and R67 can share a private directory but their envelopes cannot cross domains even with the same HMAC key', async t => {
  const f = await fixture(t); await f.capture(f.first.record);
  const golden = JSON.parse(readFileSync(new URL('./fixtures/r67-r66-certified-outbox.json', import.meta.url), 'utf8'));
  const kernel = createPrivateDurableFile({ profile: 'R66_OBSERVATION', directory: f.dir, key: f.config.key });
  kernel.transact(() => ({ changed: true, payload: JSON.parse(golden.before).payload, value: null }));
  const r66 = createR66ObservationOutbox({ directory: f.dir, key: f.config.key, trustedSource: golden.trustedSource });
  assert.equal(r66.read().entries.length, 1); assert.equal(f.outbox.read().entries.length, 1);
  copyFileSync(`${f.dir}/${R66_OUTBOX_FILE}`, `${f.dir}/${R67_OUTBOX_FILE}`);
  denied(() => f.outbox.read(), 'R67_OUTBOX_INVALID_ENVELOPE');
});

test('R67 private queue supports retained snapshots exceeding 1 MiB while individual signed batches stay bounded', async t => {
  const f = await fixture(t);
  const scenarios = Array.from({ length: 60 }, (_, n) => ({ ...R67_FIXTURE_SCENARIOS[n % 3],
    id: 'fixture-' + n.toString().padStart(2, '0') + '-' + 'q'.repeat(60) }));
  for (let n = 1; n <= 24; n++) {
    const next = await f.nextRecord(n, { scenarios }); await f.capture(next.record);
  }
  const size = lstatSync(`${f.dir}/${R67_OUTBOX_FILE}`).size;
  assert(size > 1024 * 1024, `expected a >1 MiB snapshot, received ${size}`);
  assert.equal(createR67PrivateCaptureOutbox(f.config).read().entries.length, 24);
});

test('R67 real process death while awaiting the producer retains its lock and commits no partial batch', async t => {
  const f = await fixture(t);
  const code = `
    import {createR67PrivateCaptureOutbox} from './lib/platform/research/robot-r67-private-capture-outbox.mjs';
    const d=JSON.parse(process.env.JENIOS_R67_TEST_INPUT);delete process.env.JENIOS_R67_TEST_INPUT;
    const outbox=createR67PrivateCaptureOutbox(d.config);
    await outbox.capture({operationId:d.operationId,inputDigest:d.inputDigest,sessionId:d.sessionId,produce:async()=>{
      process.stdout.write('CAPTURING\\n');process.stdin.resume();await new Promise(r=>process.stdin.once('end',r));
      throw Error('test never completes producer');
    }});
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(),
    env: { ...process.env, JENIOS_R67_TEST_INPUT: JSON.stringify({ config: f.config, operationId: op(1),
      inputDigest: f.first.record.provenance.inputDigest, sessionId: SESSION }) }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const ready = await Promise.race([once(child.stdout, 'data').then(([data]) => data.toString()),
    once(child, 'error').then(([error]) => { throw error; }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('producer did not enter lock')), 10000); timer.unref(); })]);
  assert.equal(ready, 'CAPTURING\n'); denied(() => f.outbox.read(), 'R67_OUTBOX_LOCKED');
  const exited = once(child, 'exit'); child.kill('SIGKILL'); const [, signal] = await exited; assert.equal(signal, 'SIGKILL');
  denied(() => f.outbox.read(), 'R67_OUTBOX_LOCKED');
  const stored = JSON.parse(readFileSync(`${f.dir}/${R67_OUTBOX_FILE}`, 'utf8')); assert.equal(stored.payload.entries.length, 0);
  // This test host observed this exact PID exit before the explicit recovery.
  unlinkSync(`${f.dir}/${R67_OUTBOX_LOCK}`);
  assert.equal(f.outbox.read().entries.length, 0); await f.capture(f.first.record);
  assert.equal(f.outbox.read().entries.length, 1);
});
