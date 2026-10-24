/** Durability with signed public protocol fixtures; original core is not used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, chmodSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createR71ProtocolFixture } from './fixtures/r71-private-protocol-fixture.mjs';
import { createR71PrivateCaptureOutbox, R71_OUTBOX_FILE, r71DeliveryState } from '../lib/platform/research/robot-r71-private-capture-outbox.mjs';
import { r71CaptureInputDigest, createR71IntakeAcknowledgement } from '../lib/platform/research/robot-r71-private-protocol.mjs';
import { checkR71RuntimeContinuity } from '../lib/platform/research/robot-r71-private-source.mjs';
import { diagnoseR68Outbox } from '../lib/platform/research/robot-r68-outbox-doctor.mjs';
import { r71CandidateVersion, r71ReferenceVersion, createR71Plan } from '../lib/platform/research/robot-r71-policy.mjs';
const denied = fn => assert.rejects(fn, e => /^R71_/.test(e.code || ''));
async function setup(t) {
  const f = await createR71ProtocolFixture(), directory = mkdtempSync(join(tmpdir(), 'jenios-r71-public-outbox-'));
  chmodSync(directory, 0o700); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const config = { directory, key: '71'.repeat(32), trustedSource: f.trustedSource };
  const outbox = createR71PrivateCaptureOutbox(config);
  outbox.reserveSession({ sessionId: f.record.annotation.sessionId, startedAtMs: f.record.annotation.capturedAtMs });
  return { f, config, outbox };
}
const digest = f => r71CaptureInputDigest(f.record.annotation.purpose === 'VALIDATION' ?
  { purpose: 'VALIDATION', planId: f.record.annotation.planId } :
  { purpose: 'OBSERVATION', scenarios: f.scenarios, positionContexts: f.positionContexts });
const capture = (outbox, f, produce = async () => ({ record: f.record, runtimeView: f.runtimeView })) => outbox.capture({
  operationId: f.record.originalRecord.provenance.operationId, inputDigest: digest(f), sessionId: f.record.annotation.sessionId, produce });

test('R71 persists native and sidecar before delivery and retries after reopening without invoking a producer', async t => {
  const { f, config, outbox } = await setup(t); let calls = 0;
  await capture(outbox, f, async ({ lastRuntimeView }) => { calls++; assert.equal(lastRuntimeView, null); return { record: f.record, runtimeView: f.runtimeView }; });
  const path = join(config.directory, R71_OUTBOX_FILE), before = readFileSync(path);
  const reopened = createR71PrivateCaptureOutbox(config);
  const replay = await capture(reopened, f, () => { calls++; throw Error('must never execute'); });
  assert.equal(replay.replayed, true); assert.deepEqual(replay.record, f.record); assert.equal(calls, 1);
  assert.deepEqual(readFileSync(path), before); assert.equal(reopened.read().entries[0].attempts.length, 0);
  await denied(() => reopened.capture({ operationId: f.record.originalRecord.provenance.operationId,
    inputDigest: '00'.repeat(32), sessionId: f.record.annotation.sessionId, produce: () => { throw Error('must not run'); } }));
});

test('R71 persists minimum consumed state and refuses revision generation and same-revision conflicts', async t => {
  const { f, config, outbox } = await setup(t);
  const candidateView = { ...f.runtimeView, revision: 2, stateDigest: '72'.repeat(32), activeVersion: r71CandidateVersion(1) };
  const candidate = await createR71ProtocolFixture({ privateKeyPem: f.privateKeyPem, runtimeView: candidateView,
    nowMs: f.record.annotation.capturedAtMs });
  await capture(outbox, candidate);
  const persisted = createR71PrivateCaptureOutbox(config).read().lastRuntimeView;
  assert.deepEqual(persisted, candidateView);
  for (const mutation of [v => { v.revision--; }, v => { v.activeVersion = r71ReferenceVersion(0); },
    v => { v.stateDigest = '00'.repeat(32); }, v => { v.activeVersion = r71ReferenceVersion(1); }]) {
    const bad = structuredClone(candidateView); mutation(bad);
    assert.throws(() => checkR71RuntimeContinuity(persisted, bad, f.trustedSource), e => e.code === 'R71_SOURCE_STATE_REGRESSION');
  }
  const rollback = { ...candidateView, revision: 3, stateDigest: '73'.repeat(32), activeVersion: r71ReferenceVersion(2) };
  assert.deepEqual(checkR71RuntimeContinuity(persisted, rollback, f.trustedSource), rollback);
});

test('R71 uncertain ACK retains exact record and accepts only matching ALREADY_STORED on retry', async t => {
  const { f, config, outbox } = await setup(t); await capture(outbox, f);
  const operationId = f.record.originalRecord.provenance.operationId, at = f.receipt.admittedAtMs;
  const first = outbox.beginAttempt({ operationId, nowMs: at + 1 });
  outbox.resolveAttempt({ operationId, attemptId: first.attemptId, nowMs: at + 2 });
  const reopened = createR71PrivateCaptureOutbox(config), next = reopened.beginAttempt({ operationId, nowMs: at + 3 });
  assert.deepEqual(next.record, first.record);
  const ack = createR71IntakeAcknowledgement({ receipt: f.receipt, record: f.record }, 'ALREADY_STORED');
  const wrong = { ...ack, recordDigest: '00'.repeat(32) };
  assert.throws(() => reopened.resolveAttempt({ operationId, attemptId: next.attemptId, nowMs: at + 4,
    acknowledgement: { httpStatus: 200, body: wrong } }));
  reopened.resolveAttempt({ operationId, attemptId: next.attemptId, nowMs: at + 4,
    acknowledgement: { httpStatus: 200, body: ack } });
  const entry = reopened.read().entries[0]; assert.equal(r71DeliveryState(entry), 'ACKNOWLEDGED');
  assert.deepEqual(entry.record, f.record); assert.deepEqual(entry.attempts.map(a => a.outcome), ['UNCERTAIN', 'ACKNOWLEDGED']);
});

test('R71 read-only doctor observes expiration with no rewrite and retained expired predecessor blocks delivery', async t => {
  const { f, config, outbox } = await setup(t); await capture(outbox, f);
  const later = await createR71ProtocolFixture({ privateKeyPem: f.privateKeyPem, nowMs: f.receipt.admittedAtMs + 1,
    sequence: 2, operationId: 'op:' + '72'.repeat(16), runtimeView: f.runtimeView });
  await capture(outbox, later);
  const path = join(config.directory, R71_OUTBOX_FILE), before = readFileSync(path), nowMs = f.record.annotation.expiresAtMs;
  const report = diagnoseR68Outbox({ profile: 'R71_PRIVATE_EVOLUTION', ...config, nowMs });
  assert.equal(report.queue.newlyObservedExpired, 1); assert.equal(report.queue.expiredPredecessorBlockedEntries, 1);
  assert.equal(report.recoveryAuthorized, false); assert.deepEqual(readFileSync(path), before);
  outbox.expire({ nowMs });
  assert.throws(() => outbox.beginAttempt({ operationId: later.record.originalRecord.provenance.operationId, nowMs }),
    e => e.code === 'R71_OUTBOX_PRIOR_SEQUENCE_UNCONFIRMED');
  assert.deepEqual(outbox.read().entries[0].record, f.record);
});

test('R71 validation capture binds the registered plan and retains its original window across exact replay', async t => {
  const { f, outbox } = await setup(t), nowMs = f.receipt.admittedAtMs;
  const plan = createR71Plan({ snapshotId: '71717171-7171-4171-8171-717171717171', studyDigest: '71'.repeat(32),
    activeVersion: f.runtimeView.activeVersion, nowMs: nowMs - 1500 });
  const runtimeView = { ...f.runtimeView, revision: 2, pendingEvaluation: plan };
  const validation = await createR71ProtocolFixture({ privateKeyPem: f.privateKeyPem, runtimeView, purpose: 'VALIDATION', nowMs });
  await capture(outbox, validation);
  const replay = await capture(outbox, validation, () => { throw Error('closed plan must not be read'); });
  assert.equal(replay.replayed, true); assert.deepEqual(replay.record, validation.record);
  const future = await createR71ProtocolFixture({ privateKeyPem: f.privateKeyPem, runtimeView, purpose: 'VALIDATION',
    nowMs: plan.endsAtMs, sequence: 2, operationId: 'op:' + '73'.repeat(16) });
  await denied(() => capture(outbox, future)); assert.equal(outbox.read().entries.length, 1);
});
