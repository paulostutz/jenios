import test from 'node:test';
import assert from 'node:assert/strict';
import { sign, createPrivateKey, generateKeyPairSync, createHash } from 'node:crypto';
import { createR67ProtocolFixture } from './fixtures/r67-private-protocol-fixture.mjs';
import { canonicalR67Json, verifyR67PrivateObservationRecord, inspectR67StoredObservation,
  createR67IntakeAcknowledgement, inspectR67IntakeAcknowledgement, R67_PAYLOAD_DOMAIN,
  R67_PROVENANCE_DOMAIN, r67ProvenanceForPayload, inspectR67Scenarios, inspectR67TrustedSource } from '../lib/platform/research/robot-r67-private-protocol.mjs';
import { verifyR65ObservationRecord } from '../lib/platform/research/robot-r65-observation-source.mjs';
const clone = v => JSON.parse(JSON.stringify(v));
const nowMs = 1792864800000;
const verifyFixture = f => verifyR67PrivateObservationRecord(f.record, { trustedSource: f.trustedSource, nowMs });
function resign(record, keyPem, rebuild = true) {
  const key = createPrivateKey(keyPem);
  if (rebuild) record.provenance = r67ProvenanceForPayload(record.envelope.payload, record.provenance.operationId);
  record.envelope.signatureBase64 = sign(null, Buffer.from(R67_PAYLOAD_DOMAIN + canonicalR67Json(record.envelope.payload)), key).toString('base64');
  record.provenanceSignatureBase64 = sign(null, Buffer.from(R67_PROVENANCE_DOMAIN + canonicalR67Json(record.provenance)), key).toString('base64');
  return record;
}
test('R67 protocol fixture preserves native actions, three modes and nonfinancial provenance', async () => {
  const f = await createR67ProtocolFixture({ nowMs }), v = verifyFixture(f);
  assert.equal(f.fixtureEvidence, 'PUBLIC_PROTOCOL_FIXTURE_NO_PRIVATE_EXECUTION');
  assert.deepEqual(v.record.envelope.payload.capture.entries.map(e => e.action),
    ['manual_preview', 'wait_for_confluence', 'reverse_not_calibrated']);
  assert.equal(v.receipt.captureCount, 3);
  assert.equal(v.receipt.policyVersion, 'private:r67-v1');
  assert.equal(v.receipt.generation, 0);
  assert.equal(v.record.provenance.actualBrokerPnl, null);
  assert.equal(v.record.provenance.automaticPromotionAllowed, false);
  assert.equal(v.independentRuntimeAttestation, false);
  assert.equal(v.record.envelope.payload.capture.executableBytesVerifiedByAdapter, false);
});
test('R67 transport canonical key ordering preserves the original B297 chain semantics', async () => {
  const f = await createR67ProtocolFixture({ nowMs });
  const canonical = JSON.parse(canonicalR67Json(f.record));
  assert.deepEqual(verifyR67PrivateObservationRecord(canonical, { trustedSource: f.trustedSource, nowMs }).receipt,
    verifyFixture(f).receipt);
});
test('R67 requires both independent signature domains under the pinned source key', async () => {
  const f = await createR67ProtocolFixture({ nowMs });
  for (const field of ['payload', 'provenance']) {
    const record = clone(f.record);
    const otherKey = generateKeyPairSync('ed25519').privateKey;
    if (field === 'payload') record.envelope.signatureBase64 = sign(null,
      Buffer.from(R67_PAYLOAD_DOMAIN + canonicalR67Json(record.envelope.payload)), otherKey).toString('base64');
    else record.provenanceSignatureBase64 = sign(null,
      Buffer.from(R67_PROVENANCE_DOMAIN + canonicalR67Json(record.provenance)), otherKey).toString('base64');
    assert.throws(() => verifyFixture({ ...f, record }), /R67_(PAYLOAD|PROVENANCE)_SIGNATURE/);
  }
  const swapped = clone(f.record);
  [swapped.envelope.signatureBase64, swapped.provenanceSignatureBase64] =
    [swapped.provenanceSignatureBase64, swapped.envelope.signatureBase64];
  assert.throws(() => verifyFixture({ ...f, record: swapped }), /R67_PAYLOAD_SIGNATURE/);
});
test('R67 rejects another source/scope and the R65 intake rejects the private protocol', async () => {
  const f = await createR67ProtocolFixture({ nowMs });
  for (const [key, value] of [['scopeId', 'scope:' + 'ab'.repeat(8)], ['sourceId', 'source:' + 'ab'.repeat(8)]])
    assert.throws(() => verifyR67PrivateObservationRecord(f.record,
      { trustedSource: { ...f.trustedSource, [key]: value }, nowMs }), /R67_SOURCE_BINDING/);
  assert.throws(() => verifyR65ObservationRecord(f.record, { trustedSource: f.trustedSource, nowMs }));
});
test('R67 binds operation, sequence and session to the event id', async () => {
  const f = await createR67ProtocolFixture({ nowMs });
  for (const field of ['sequence', 'sessionId', 'eventId']) {
    const record = clone(f.record);
    record.envelope.payload[field] = field === 'sequence' ? 2 : field === 'sessionId' ?
      'session:' + 'aa'.repeat(8) : 'evt:' + 'aa'.repeat(8);
    assert.throws(() => resign(record, f.privateKeyPem), /R67_PROVENANCE_EVENT/);
  }
  const record = clone(f.record); record.provenance.operationId = 'op:' + 'aa'.repeat(16);
  assert.throws(() => verifyFixture({ ...f, record }), /R67_PROVENANCE_EVENT/);
});
test('R67 requires complete bounded batches with exactly the three supported modes', async () => {
  const f = await createR67ProtocolFixture({ nowMs });
  for (const scenarios of [f.scenarios.slice(0, 2), [...f.scenarios, ...f.scenarios],
    f.scenarios.map(s => s.mode === 'reverse' ? { ...s, mode: 'ultrafast' } : s)])
    assert.throws(() => inspectR67Scenarios(scenarios));
  assert.throws(() => inspectR67Scenarios(f.scenarios.map(s => ({ ...s, sourceMode: 'market' }))));
  assert.throws(() => inspectR67Scenarios(f.scenarios.map(s => ({ ...s, paused: 'false' }))));
});
test('R67 binds declared inputs to each original entry and its digest', async () => {
  const f = await createR67ProtocolFixture({ nowMs }), record = clone(f.record);
  record.envelope.payload.scenarios[0].intent = 'sell';
  assert.throws(() => resign(record, f.privateKeyPem), /R67_CAPTURE_ENTRY_VALUE/);
  const changed = clone(f.record); changed.provenance.inputDigest = '0'.repeat(64);
  resign(changed, f.privateKeyPem, false);
  assert.throws(() => verifyFixture({ ...f, record: changed }), /R67_PROVENANCE_BINDING/);
});
test('R67 refuses edited native chain, counts, executable hashes and original version', async () => {
  const f = await createR67ProtocolFixture({ nowMs });
  for (const mutate of [r => r.envelope.payload.capture.entries[0].rawOutputSha256 = '1'.repeat(64),
    r => r.envelope.payload.capture.counts.manual = 2,
    r => r.envelope.payload.capture.engineSha256Expected = '1'.repeat(64),
    r => r.envelope.payload.capture.entries[0].originalVersion = 'fake',
    r => r.provenance.serviceSha256 = '1'.repeat(64)]) {
    const record = clone(f.record); mutate(record);
    assert.throws(() => verifyFixture({ ...f, record }));
  }
});
test('R67 enforces original mode/side restrictions even if a test key re-signs', async () => {
  const f = await createR67ProtocolFixture({ nowMs });
  for (const mutate of [e => e.suggestedSide = 'sell', e => e.action = 'reverse_preview', e => e.action = 'ALLOW']) {
    const record = clone(f.record); mutate(record.envelope.payload.capture.entries[0]);
    assert.throws(() => resign(record, f.privateKeyPem), /R67_CAPTURE_ENTRY_VALUE/);
  }
});
test('R67 cannot upgrade lab flags or independent attestation through a signed claim', async () => {
  const f = await createR67ProtocolFixture({ nowMs });
  for (const key of ['executionAllowed', 'automaticPromotionAllowed', 'customerMonitoringActive',
    'privateOperationalSourceActive', 'independentRuntimeAttestation', 'independentBrokerAttestation']) {
    const record = clone(f.record); record.provenance[key] = true; resign(record, f.privateKeyPem, false);
    assert.throws(() => verifyFixture({ ...f, record }), /R67_PROVENANCE_BINDING/);
  }
  const record = clone(f.record); record.envelope.payload.capture.executableBytesVerifiedByAdapter = true;
  assert.throws(() => resign(record, f.privateKeyPem), /R67_CAPTURE_VALUE/);
});
test('R67 freshness is exact, bounded and cannot be renewed by editing expiry', async () => {
  const f = await createR67ProtocolFixture({ nowMs });
  for (const time of [nowMs - 1, nowMs + 120000, NaN]) assert.throws(() =>
    verifyR67PrivateObservationRecord(f.record, { trustedSource: f.trustedSource, nowMs: time }), /R67_RECORD_TIME/);
  assert.equal(verifyR67PrivateObservationRecord(f.record,
    { trustedSource: f.trustedSource, nowMs: nowMs + 119999 }).receipt.captureCount, 3);
  const record = clone(f.record); record.envelope.payload.expiresAtMs++;
  assert.throws(() => resign(record, f.privateKeyPem), /R67_PAYLOAD_VALUE/);
});
test('R67 refuses getters, extra fields, noncanonical signatures and wrong key kinds', async () => {
  const f = await createR67ProtocolFixture({ nowMs }); let touched = false;
  const record = { ...f.record, get surprise() { touched = true; return 1; } };
  assert.throws(() => verifyFixture({ ...f, record })); assert.equal(touched, false);
  assert.throws(() => verifyFixture({ ...f, record: { ...f.record, trustedSource: f.trustedSource } }));
  const changed = clone(f.record); changed.provenanceSignatureBase64 += '\n';
  assert.throws(() => verifyFixture({ ...f, record: changed }), /R67_SIGNATURE_FORMAT/);
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' });
  assert.throws(() => inspectR67TrustedSource({ ...f.trustedSource, publicKeyPem: rsa }), /R67_TRUST_ROOT/);
});
test('R67 historical inspection preserves signed evidence without claiming independent verification', async () => {
  const f = await createR67ProtocolFixture({ nowMs }), v = verifyFixture(f);
  const stored = inspectR67StoredObservation({ receipt: v.receipt, record: v.record });
  assert.equal(stored.receipt.admittedAtMs, nowMs);
  assert.equal(stored.record.provenance.independentRuntimeAttestation, false);
  assert.throws(() => inspectR67StoredObservation({ receipt: { ...v.receipt, recordDigest: '0'.repeat(64) }, record: v.record }));
  assert.throws(() => inspectR67StoredObservation({ receipt: { ...v.receipt, admittedAtMs: nowMs + 120000 }, record: v.record }));
});
test('R67 ACK binds the entire batch, signatures, source, session, sequence and status', async () => {
  const f = await createR67ProtocolFixture({ nowMs }), v = verifyFixture(f), stored = { receipt: v.receipt, record: v.record };
  const ack = createR67IntakeAcknowledgement(stored, 'STORED');
  assert.equal(inspectR67IntakeAcknowledgement(ack, f.record, 202).body.captureCount, 3);
  assert.throws(() => inspectR67IntakeAcknowledgement(ack, f.record, 200));
  for (const [key, value] of [['recordDigest', '0'.repeat(64)], ['captureCount', 1], ['sequence', 2],
    ['sourceId', 'source:' + '11'.repeat(8)], ['sessionId', 'session:' + '11'.repeat(8)]])
    assert.throws(() => inspectR67IntakeAcknowledgement({ ...ack, [key]: value }, f.record, 202));
  assert.throws(() => inspectR67IntakeAcknowledgement({ ...ack, receipts: [] }, f.record, 202));
});
