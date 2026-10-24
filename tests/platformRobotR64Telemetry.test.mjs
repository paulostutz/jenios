import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { verifyR64TelemetryEnvelope, inspectR64TelemetryReceipt, studyR64AcceptedTelemetry,
  inspectR64TelemetryStudy, scheduleR64TelemetryPeriod, canonicalR64Json, digestR64Value,
} from '../lib/platform/research/robot-r64-telemetry.mjs';
import { studyR63Observations } from '../lib/platform/research/robot-r63-observation-study.mjs';
import { createR64TelemetryFixture, signR64QaPayload } from '../scripts/platform/research/r64-telemetry-fixtures.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const fixture = options => createR64TelemetryFixture(options);
const verify = (f, envelope = f.envelopes[0], options = {}) => verifyR64TelemetryEnvelope(envelope,
  { trustedSource: f.trustedSource, nowMs: f.generatedAtMs, ...options });
const study = (f, receipts = f.receipts, options = {}) => studyR64AcceptedTelemetry(receipts,
  { scopeId: f.trustedSource.scopeId, period: f.period, generatedAtMs: f.generatedAtMs, ...options });
const signedChange = (f, mutate) => { const p = clone(f.envelopes[0].payload); mutate(p); return signR64QaPayload(p, f.privateKey); };
const denied = (fn, code) => assert.throws(fn, error => code ? error.code === code : Boolean(error.code));

test('R64 pinned Ed25519 admission preserves QA classification and yields a minimized immutable receipt', () => {
  const f = fixture(), r = verify(f);
  assert.equal(r.schema, 'JENIOS_R64_TELEMETRY_ADMISSION_V1');
  assert.equal(r.evidenceKind, 'SIGNED_QA_REPLAY');
  assert.equal(r.proof.configuredSourceSignatureVerified, true);
  assert.equal(r.proof.independentBrokerAttestation, false);
  assert.equal(r.proof.independentCustomerConsentVerified, false);
  assert.match(r.payloadDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(inspectR64TelemetryReceipt(clone(r)), r);
  assert(Object.isFrozen(r) && Object.isFrozen(r.event) && Object.isFrozen(r.proof));
  assert.equal(JSON.stringify(r).includes('publicKeyPem'), false);
  assert.equal(JSON.stringify(r).includes('signatureBase64'), false);
});

test('R64 detects signature tampering, wrong pinned key and unsupported key types', () => {
  const f = fixture(), changed = clone(f.envelopes[0]);
  changed.payload.event.marketAgeMs++;
  denied(() => verify(f, changed), 'R64_TELEMETRY_SIGNATURE');
  const other = fixture();
  denied(() => verify(f, f.envelopes[0], { trustedSource: other.trustedSource }), 'R64_TELEMETRY_SIGNATURE');
  const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'pem', type: 'spki' });
  denied(() => verify(f, f.envelopes[0], { trustedSource: { ...f.trustedSource, publicKeyPem: ec } }), 'R64_TELEMETRY_PUBLIC_KEY');
  denied(() => verify(f, { ...f.envelopes[0], signatureBase64: 'x'.repeat(88) }), 'R64_TELEMETRY_SIGNATURE');
});

test('R64 server trust configuration binds the source, scope and QA-only evidence kind', () => {
  const f = fixture();
  for (const patch of [{ enabled: false }, { scopeId: 'scope:ffffffffffffffff' },
    { sourceId: 'source:ffffffffffffffff' }, { evidenceKind: 'VERIFIED_CLIENT_OPERATION' }]) {
    denied(() => verify(f, f.envelopes[0], { trustedSource: { ...f.trustedSource, ...patch } }),
      'R64_TELEMETRY_SOURCE_OR_SCOPE');
  }
  const customer = clone(f.envelopes[0]); customer.payload.evidenceKind = 'VERIFIED_CLIENT_OPERATION';
  denied(() => verify(f, customer), 'R64_TELEMETRY_PAYLOAD_VALUE');
});

test('R64 intake rejects future, expired and overlong envelopes with explicit replay chronology', () => {
  const f = fixture(), p = f.envelopes[0].payload;
  denied(() => verify(f, f.envelopes[0], { nowMs: p.event.capturedAtMs - 1 }), 'R64_TELEMETRY_STALE_OR_FUTURE');
  denied(() => verify(f, f.envelopes[0], { nowMs: p.expiresAtMs }), 'R64_TELEMETRY_STALE_OR_FUTURE');
  const overlong = clone(f.envelopes[0]); overlong.payload.expiresAtMs = p.event.capturedAtMs + 120001;
  denied(() => verify(f, overlong), 'R64_TELEMETRY_ENVELOPE_VALIDITY');
  const impossible = clone(f.envelopes[0]); impossible.payload.event.occurredAtMs = p.event.capturedAtMs + 1;
  denied(() => verify(f, impossible), 'R64_TELEMETRY_EVENT_TIME');
  const ancient = clone(f.envelopes[0]); ancient.payload.event.occurredAtMs = p.event.capturedAtMs - 86400001;
  denied(() => verify(f, ancient), 'R64_TELEMETRY_EVENT_TIME');
  assert(f.receipts[0].event.occurredAtMs < f.receipts[0].event.capturedAtMs);
});

test('R64 schema rejects identities, free text, getters and inherited records without invoking them', () => {
  const f = fixture();
  for (const field of ['email', 'accountId', 'comment', 'actualBrokerPnl']) {
    const raw = clone(f.envelopes[0]); raw.payload.event[field] = 'not permitted';
    denied(() => verify(f, raw), 'R64_TELEMETRY_EVENT_SCHEMA');
  }
  let getterCalls = 0;
  const raw = clone(f.envelopes[0]);
  Object.defineProperty(raw.payload.event, 'marketAgeMs', { enumerable: true, get() { getterCalls++; return 100; } });
  denied(() => verify(f, raw), 'R64_TELEMETRY_EVENT_SCHEMA');
  assert.equal(getterCalls, 0);
  const inherited = Object.assign(Object.create({ inherited: true }), f.envelopes[0]);
  denied(() => verify(f, inherited), 'R64_TELEMETRY_ENVELOPE_SCHEMA');
});

test('R64 canonical signatures and receipt digests ignore caller object-key ordering', () => {
  const f = fixture(), original = f.envelopes[0];
  const reordered = { signatureBase64: original.signatureBase64,
    payload: Object.fromEntries(Object.entries(original.payload).reverse()) };
  reordered.payload.event = Object.fromEntries(Object.entries(original.payload.event).reverse());
  assert.deepEqual(verify(f, reordered), verify(f));
});

test('R64 stored receipts retain historical admissions after transport expiry without a new signature claim', () => {
  const f = fixture(), later = f.generatedAtMs + 3600000;
  denied(() => verify(f, f.envelopes[0], { nowMs: later }), 'R64_TELEMETRY_STALE_OR_FUTURE');
  const result = study(f, f.receipts, { generatedAtMs: later });
  assert.equal(result.receiptCount, 7);
  assert.equal(result.evidenceKind, 'SIGNED_QA_REPLAY');
  assert.equal(result.automaticPromotionAllowed, false);
  assert.equal(result.executionAllowed, false);
});

test('R64 receipt validation rejects digest changes, forged independent attestations and invalid admission clocks', () => {
  const f = fixture();
  const changed = clone(f.receipts[0]); changed.event.marketAgeMs++;
  denied(() => inspectR64TelemetryReceipt(changed), 'R64_TELEMETRY_RECEIPT_INTEGRITY');
  const claim = clone(f.receipts[0]); claim.proof.independentCustomerConsentVerified = true;
  denied(() => inspectR64TelemetryReceipt(claim), 'R64_TELEMETRY_RECEIPT_INTEGRITY');
  const expired = clone(f.receipts[0]); expired.admittedAtMs = expired.expiresAtMs;
  denied(() => inspectR64TelemetryReceipt(expired), 'R64_TELEMETRY_RECEIPT_INTEGRITY');
});

test('R64 uses the existing São Paulo 09h calendar and rejects unclosed or backfilled report periods', () => {
  const f = fixture();
  const before = scheduleR64TelemetryPeriod({ nowMs: Date.UTC(2026, 9, 24, 11, 59, 59) });
  assert.equal(before.due, false);
  assert.equal(before.periodKey, 'r64:daily:2026-10-23');
  const at = scheduleR64TelemetryPeriod({ nowMs: f.generatedAtMs });
  assert.equal(at.due, true);
  assert.equal(at.period.startMs, Date.UTC(2026, 9, 23, 3));
  denied(() => study(f, [], { generatedAtMs: before.scheduledAtMs - 1 }), 'R64_TELEMETRY_CLOSED_DAILY_PERIOD_REQUIRED');
  denied(() => study(f, [], { period: { startMs: f.period.startMs - 86400000, endMs: f.period.endMs - 86400000 } }),
    'R64_TELEMETRY_CLOSED_DAILY_PERIOD_REQUIRED');
});

test('R64 deduplicates identical accepted receipts but rejects conflicting replay and reused session sequence', () => {
  const f = fixture();
  assert.equal(study(f, [...f.receipts, clone(f.receipts[0])]).receiptCount, 7);
  const conflict = verify(f, signedChange(f, p => { p.event.marketAgeMs = 200; }));
  denied(() => study(f, [...f.receipts, conflict]), 'R64_TELEMETRY_CONFLICTING_RECEIPT');
  const sequence = verify(f, signedChange(f, p => { p.eventId = 'evt:ffffffffffffffff'; p.event.occurredAtMs++; }));
  denied(() => study(f, [...f.receipts, sequence]), 'R64_TELEMETRY_SESSION_SEQUENCE');
});

test('R64 studies cannot mix scopes, include future admissions or admit events from outside the report day', () => {
  const f = fixture(), other = fixture({ scopeId: 'scope:ffffffffffffffff' });
  denied(() => study(f, [...f.receipts, ...other.receipts]), 'R64_TELEMETRY_STUDY_SCOPE');
  const futureAdmission = verify(f, f.envelopes[0], { nowMs: f.generatedAtMs + 1 });
  denied(() => study(f, [futureAdmission]), 'R64_TELEMETRY_STUDY_TIME');
  const outside = verify(f, signedChange(f, p => { p.event.occurredAtMs = f.period.endMs; }));
  denied(() => study(f, [outside]), 'R64_TELEMETRY_STUDY_TIME');
});

test('R64 aggregate distinguishes all receipt counts from the bounded latest-48 evidence sample', () => {
  const f = fixture({ count: 55 }), result = inspectR64TelemetryStudy(clone(f.study));
  assert.equal(result.receiptCount, 55);
  assert.equal(result.metrics.eventCount, 55);
  assert.equal(result.evidenceEvents.length, 48);
  assert.equal(result.evidenceEvents[0].eventId, 'evt:0000000000000008');
  assert.equal(result.evidenceSelection.totalEvents, 55);
  assert.equal(result.findings[0].eventCount, 51);
  assert.equal(result.findings[0].evidenceEventIds.length, 48);
  assert.equal(result.evidenceEvents.some(e => 'sourceId' in e || 'scopeId' in e || 'sessionId' in e), false);
});

test('R64 inspection rejects inconsistent aggregates, unsupported financial claims and invented evidence references', () => {
  const f = fixture();
  const mismatch = clone(f.study); mismatch.metrics.byRobot.manual++;
  denied(() => inspectR64TelemetryStudy(mismatch), 'R64_TELEMETRY_METRICS');
  const refs = clone(f.study); refs.findings[0].evidenceEventIds = ['evt:ffffffffffffffff'];
  denied(() => inspectR64TelemetryStudy(refs), 'R64_TELEMETRY_FINDING');
  const financial = clone(f.study); financial.actualBrokerPnl = 100;
  denied(() => inspectR64TelemetryStudy(financial), 'R64_TELEMETRY_UNSUPPORTED_CLAIM');
  const promote = clone(f.study); promote.automaticPromotionAllowed = true;
  denied(() => inspectR64TelemetryStudy(promote), 'R64_TELEMETRY_UNSUPPORTED_CLAIM');
  const freeText = clone(f.study); freeText.comment = 'hidden narrative';
  denied(() => inspectR64TelemetryStudy(freeText), 'R64_TELEMETRY_STUDY_SCHEMA');
});

test('R64 empty periods stay explicit and malformed or oversized batches fail without partial studies', () => {
  const f = fixture({ count: 0 });
  assert.equal(inspectR64TelemetryStudy(f.study).receiptCount, 0);
  assert.deepEqual(f.study.findings, []);
  const regular = fixture();
  denied(() => study(regular, new Array(2)), 'R64_TELEMETRY_BATCH');
  denied(() => study(regular, Array(5001).fill(regular.receipts[0])), 'R64_TELEMETRY_BATCH');
  const accessor = [regular.receipts[0]];
  Object.defineProperty(accessor, '0', { get() { throw new Error('Must not execute'); }, enumerable: true });
  denied(() => study(regular, accessor), 'R64_TELEMETRY_BATCH');
});

test('R64 fingerprints plain JSON deterministically and rejects accessors, toJSON, cycles and excessive depth', () => {
  assert.equal(canonicalR64Json({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(digestR64Value({ b: 2, a: 1 }), digestR64Value({ a: 1, b: 2 }));
  let calls = 0;
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { calls++; return 1; } });
  denied(() => canonicalR64Json(accessor));
  denied(() => canonicalR64Json({ toJSON() { calls++; return {}; } }));
  assert.equal(calls, 0);
  const cyclic = {}; cyclic.self = cyclic; denied(() => canonicalR64Json(cyclic));
  let deep = {}; for (let i = 0; i < 18; i++) deep = { child: deep };
  denied(() => canonicalR64Json(deep));
});

test('R64 signed QA replay cannot be promoted by relabeling it through the R63 observation intake', () => {
  const f = fixture();
  const event = { evidenceKind: 'SIGNED_QA_REPLAY', scopeId: 'fixture:00000001', eventId: 'evt:00000001',
    policyVersion: 'research:r63-v1', robot: 'ultrafast', kind: 'incident', decision: 'BLOCK',
    issue: 'STALE_CONTEXT', marketAgeMs: 650, occurredAtMs: f.generatedAtMs - 1000, observedAtMs: f.generatedAtMs };
  denied(() => studyR63Observations([event], { scopeId: 'fixture:00000001', nowMs: f.generatedAtMs }),
    'R63_UNVERIFIED_OBSERVATION_SOURCE');
  assert.equal(f.study.actualBrokerPnl, null);
  assert.equal(f.study.actualLossesAvoided, null);
  assert.equal(f.study.realTradeAccuracy, null);
});
