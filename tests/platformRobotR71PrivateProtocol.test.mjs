/** Signed public protocol fixtures only; no original execution is claimed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createR71ProtocolFixture } from './fixtures/r71-private-protocol-fixture.mjs';
import { createR70PreflightFixture } from './fixtures/r70-preflight-fixture.mjs';
import { verifyR67PrivateObservationRecord, r67SourceKeyDigest } from '../lib/platform/research/robot-r67-private-protocol.mjs';
import { digestR71Value, r71CandidateVersion, r71ReferenceVersion } from '../lib/platform/research/robot-r71-policy.mjs';
import { verifyR71PrivateObservationRecord, inspectR71StoredObservation, createR71PrivateObservationRecord,
  createR71IntakeAcknowledgement, inspectR71IntakeAcknowledgement, createR71SourceStateQuery,
  verifyR71SourceStateQuery, createR71SourceStateResult, inspectR71SourceStateResult,
  r71RecordDigest, r71CaptureInputDigest } from '../lib/platform/research/robot-r71-private-protocol.mjs';
const copy = v => structuredClone(v);
const denied = fn => assert.throws(fn, e => /^(?:R67|R70|R71)_/.test(e.code || ''));
const verify = f => verifyR71PrivateObservationRecord(f.record, { trustedSource: f.trustedSource, nowMs: f.record.annotation.capturedAtMs });

test('R71 separate signature binds the exact native R67 record without changing its generation or evidence', async () => {
  const f = await createR71ProtocolFixture(), native = f.record.originalRecord;
  const old = verifyR67PrivateObservationRecord(native, { trustedSource: f.trustedSource, nowMs: f.receipt.admittedAtMs });
  assert.deepEqual(verify(f).receipt.nativeReceipt, old.receipt);
  assert.equal(native.provenance.policyVersion, 'private:r67-v1'); assert.equal(native.provenance.generation, 0);
  assert.equal(f.receipt.entryCount, 8); assert.equal(f.fixtureEvidence, 'PUBLIC_PROTOCOL_FIXTURE_NO_PRIVATE_EXECUTION');
  for (const mutation of [r => { r.annotation.stateDigest = '00'.repeat(32); },
    r => { r.signatureBase64 = Buffer.alloc(64).toString('base64'); },
    r => { r.originalRecord.envelope.signatureBase64 = Buffer.alloc(64).toString('base64'); },
    r => { r.originalRecord.provenanceSignatureBase64 = Buffer.alloc(64).toString('base64'); }]) {
    const record = copy(f.record); mutation(record); denied(() => verify({ ...f, record }));
  }
});

test('R71 candidate changes only the three assisted OPEN unpaused modeled decisions', async () => {
  const base = await createR71ProtocolFixture();
  const runtimeView = { ...base.runtimeView, revision: 1, stateDigest: '72'.repeat(32), activeVersion: r71CandidateVersion(1) };
  const f = await createR71ProtocolFixture({ runtimeView, privateKeyPem: base.privateKeyPem });
  const changed = f.record.annotation.entries.filter(e => e.nativeDecisionDigest !== e.effectiveDecisionDigest);
  assert.equal(changed.length, 3);
  assert.ok(changed.every(e => e.positionOpen && e.effectiveDecision.action === 'manage_existing_position' && e.effectiveDecision.side === null));
  for (const i of [0, 1, 3, 5, 6]) {
    const entry = f.record.annotation.entries[i]; assert.deepEqual(entry.effectiveDecision, entry.nativeDecision);
    const annotation = copy(f.record.annotation);
    annotation.entries[i].effectiveDecision = { action: 'manage_existing_position', side: null, mayClose: true };
    annotation.entries[i].effectiveDecisionDigest = digestR71Value(annotation.entries[i].effectiveDecision);
    denied(() => createR71PrivateObservationRecord({ originalRecord: f.record.originalRecord, annotation, privateKeyPem: f.privateKeyPem }));
  }
});

test('R71 closed sidecar rejects contexts source identity native digests and unsupported policy edits even when signed', async () => {
  const f = await createR71ProtocolFixture();
  for (const mutation of [a => { a.entries[0].positionOpen = 'true'; }, a => { a.entries[0].scenarioId = 'other'; },
    a => { a.scopeId = 'scope:' + '00'.repeat(8); }, a => { a.entries[0].nativeRawOutputSha256 = '00'.repeat(32); },
    a => { a.wrapperVersion.forwardPositionOpen = true; }, a => { a.internalCoreRetuning = true; },
    a => { a.policyKind = 'UNLIMITED'; }, a => { a.forwardPositionOpen = true; }]) {
    const annotation = copy(f.record.annotation); mutation(annotation);
    denied(() => createR71PrivateObservationRecord({ originalRecord: f.record.originalRecord, annotation, privateKeyPem: f.privateKeyPem }));
  }
  denied(() => r71CaptureInputDigest({ purpose: 'OBSERVATION', scenarios: f.scenarios, positionContexts: f.positionContexts, forwardPositionOpen: true }));
});

test('R71 derived receipt clocks agree and ACK binds full record purpose version generation and HTTP status', async () => {
  const f = await createR71ProtocolFixture();
  assert.deepEqual(inspectR71StoredObservation({ receipt: f.receipt, record: f.record }).record, f.record);
  const wrong = copy(f.receipt); wrong.admittedAtMs++;
  denied(() => inspectR71StoredObservation({ receipt: wrong, record: f.record }));
  for (const [status, httpStatus] of [['STORED', 202], ['ALREADY_STORED', 200]]) {
    const ack = createR71IntakeAcknowledgement({ receipt: f.receipt, record: f.record }, status);
    assert.equal(inspectR71IntakeAcknowledgement(ack, f.record, httpStatus).body.recordDigest, r71RecordDigest(f.record));
    for (const mutation of [a => { a.wrapperVersion.activationGeneration++; }, a => { a.recordDigest = '00'.repeat(32); },
      a => { a.purpose = 'VALIDATION'; }, a => { a.operationalReady = true; }]) {
      const altered = copy(ack); mutation(altered); denied(() => inspectR71IntakeAcknowledgement(altered, f.record, httpStatus));
    }
    denied(() => inspectR71IntakeAcknowledgement(ack, f.record, httpStatus === 202 ? 200 : 202));
  }
});

test('R71 state-read requires its own signature domain in addition to the original R70 challenge', () => {
  const f = createR70PreflightFixture(), config = { targetPins: f.targetPins, trustedSource: f.trustedSource, privateKeyPem: f.privateKeyPem };
  const query = createR71SourceStateQuery(config), verified = verifyR71SourceStateQuery(query, { trustedSource: f.trustedSource });
  assert.equal(verified.nonce, query.challenge.payload.nonce);
  denied(() => verifyR71SourceStateQuery(query.challenge, { trustedSource: f.trustedSource }));
  denied(() => verifyR71SourceStateQuery({ ...query, signatureBase64: query.challenge.signatureBase64 }, { trustedSource: f.trustedSource }));
  const other = createR71SourceStateQuery(config);
  assert.notEqual(other.challenge.payload.nonce, query.challenge.payload.nonce);
  denied(() => verifyR71SourceStateQuery({ ...query, challenge: other.challenge }, { trustedSource: f.trustedSource }));
});

test('R71 runtime projection is source-bound fresh and tied to one complete state query', () => {
  const f = createR70PreflightFixture(), config = { targetPins: f.targetPins, trustedSource: f.trustedSource, privateKeyPem: f.privateKeyPem };
  const query = createR71SourceStateQuery(config), runtimeView = { schema: 'JENIOS_R71_RUNTIME_VIEW_V1',
    scopeId: f.trustedSource.scopeId, sourceId: f.trustedSource.sourceId, sourceKeySha256: r67SourceKeyDigest(f.trustedSource),
    revision: 0, stateDigest: '71'.repeat(32), activeVersion: r71ReferenceVersion(0), pendingEvaluation: null };
  const response = createR71SourceStateResult({ query, runtimeView, trustedSource: f.trustedSource });
  const options = { query, trustedSource: f.trustedSource, targetPins: f.targetPins };
  assert.deepEqual(inspectR71SourceStateResult(response, options).runtimeView, runtimeView);
  for (const mutation of [r => { r.nonce = '00'.repeat(32); }, r => { r.expiresAtMs++; },
    r => { r.runtimeView.scopeId = 'scope:' + '00'.repeat(8); }, r => { r.runtimeView.sourceKeySha256 = '00'.repeat(32); },
    r => { r.adminFeed = []; }]) { const value = copy(response); mutation(value); denied(() => inspectR71SourceStateResult(value, options)); }
  denied(() => inspectR71SourceStateResult(response, { ...options, query: createR71SourceStateQuery(config) }));
  denied(() => inspectR71SourceStateResult(response, { ...options, nowMs: query.challenge.payload.expiresAtMs }));
});
