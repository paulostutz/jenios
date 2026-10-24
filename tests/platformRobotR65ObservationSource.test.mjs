import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createR65ObservationSource, createR65ExternalObservationSource,
  projectR65AssistedObservation, projectR65UltraObservation, verifyR65ObservationRecord, inspectR65StoredProvenance,
  R65_EXTERNAL_ANALYZE_REQUEST_CONTRACT } from '../lib/platform/research/robot-r65-observation-source.mjs';
import { createR65EvolutionState, registerR65Evaluation, runR65EvolutionCycle,
  rollbackR65Evolution } from '../lib/platform/research/robot-r65-evolution-engine.mjs';
import { createR65ActiveRuntime, stepR65ActiveRuntime } from '../lib/platform/research/robot-r65-active-runtime.mjs';
import { verifyR64TelemetryEnvelope, scheduleR64TelemetryPeriod } from '../lib/platform/research/robot-r64-telemetry.mjs';

const NOW = Date.UTC(2026, 9, 24, 12);
const SCOPE = 'scope:0000000000000001';
const SOURCE = 'source:0000000000000001';
const SESSION = 'session:0000000000000001';
const clone = value => JSON.parse(JSON.stringify(value));
const op = n => 'op:' + n.toString(16).padStart(32, '0');
const denied = (fn, code) => assert.throws(fn, error =>
  error.name === 'ValidationError' && (code ? error.code === code : Boolean(error.code)));
const assisted = (mode = 'manual', patch = {}) => ({ source: 'synthetic_fixture', mode,
  operatorSide: 'buy', technicalSide: 'sell', confidence: 0.85, ...patch });
const snapshot = (marketAgeMs = 100, scenario = 'normal') => ({ type: 'snapshot', scenario, marketAgeMs });
const ultraConfig = () => ({ evidenceKind: 'SYNTHETIC_FIXTURE', sessionId: SESSION,
  planCode: 'platform-global-crypto', symbol: 'BTC-USD', capital: 1000, leverage: 2 });
function fixture(patch = {}) {
  const { privateKey } = generateKeyPairSync('ed25519');
  const state = createR65EvolutionState({ scopeId: SCOPE, nowMs: NOW - 86400000 });
  const config = { enabled: true, domain: 'R61_SYNTHETIC_RUNTIME', scopeId: SCOPE,
    sourceId: SOURCE, sessionId: SESSION, privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }),
    getActiveState: () => state, initialSequence: 1, now: () => NOW,
    ultraConfig: ultraConfig(), ...patch };
  return { state, config, source: createR65ObservationSource(config) };
}
const admitted = (source, record, nowMs = NOW) => verifyR65ObservationRecord(record,
  { trustedSource: source.trustedSource, nowMs });

test('R65 source requires explicit synthetic opt-in and never invokes the prepared external hook', () => {
  denied(() => createR65ObservationSource(), 'R65_SOURCE_DISABLED');
  const f = fixture();
  denied(() => createR65ObservationSource({ ...f.config, enabled: false }), 'R65_SOURCE_DISABLED');
  for (const domain of ['OPERATIONAL', 'LIVE', 'SIGNED_QA_REPLAY', 'SYNTHETIC_FIXTURE'])
    denied(() => createR65ObservationSource({ ...f.config, domain }), 'R65_OPERATIONAL_SOURCE_INACTIVE');
  let calls = 0;
  denied(() => createR65ExternalObservationSource({ domain: 'OPERATIONAL',
    analyzeRequest() { calls++; }, activated: true }), 'R65_OPERATIONAL_SOURCE_INACTIVE');
  assert.equal(calls, 0);
  assert.equal(R65_EXTERNAL_ANALYZE_REQUEST_CONTRACT.status, 'PREPARED_INACTIVE');
  assert.equal(R65_EXTERNAL_ANALYZE_REQUEST_CONTRACT.operationalSourceActivated, false);
  assert.equal(R65_EXTERNAL_ANALYZE_REQUEST_CONTRACT.originalExecutableIdentityVerified, false);
});

test('R65 four-robot source executes existing adapters and signs both R64 payload and explicit synthetic provenance', () => {
  const { source } = fixture();
  const records = ['manual', 'hybrid', 'reverse'].map((mode, index) =>
    source.captureAssisted({ operationId: op(index + 1), input: assisted(mode) }));
  records.push(source.captureUltra({ operationId: op(4), event: snapshot(650) }));
  records.push(source.captureUltra({ operationId: op(5), event: snapshot(650) }));
  assert.deepEqual(records.map(r => r.envelope.payload.event.decision), ['KEEP', 'ADVISE', 'ADVISE', 'BLOCK', 'ALLOW']);
  for (const [index, r] of records.entries()) {
    const v = admitted(source, clone(r));
    assert.equal(v.receipt.evidenceKind, 'SIGNED_QA_REPLAY');
    assert.equal(v.receipt.sequence, index + 1);
    assert.equal(v.receipt.event.policyVersion, 'research:r65-v1');
    assert.equal(v.provenance.origin, 'R61_SYNTHETIC_RUNTIME');
    assert.equal(v.provenance.runtimeEvidenceKind, 'SYNTHETIC_FIXTURE');
    assert.equal(v.provenance.transportEvidenceKind, 'SIGNED_QA_REPLAY');
    assert.equal(v.provenance.payloadDigest, v.receipt.payloadDigest);
    assert.equal(v.provenance.activationGeneration, 0);
    assert.equal(v.configuredRuntimeProvenanceSignatureVerified, true);
    assert.equal(v.independentRuntimeAttestation, false);
    assert.deepEqual(verifyR64TelemetryEnvelope(r.envelope,
      { trustedSource: source.trustedSource, nowMs: NOW }), v.receipt);
    assert(Object.isFrozen(r) && Object.isFrozen(r.envelope) && Object.isFrozen(r.envelope.payload.event));
    assert(Object.isFrozen(r.provenance));
    for (const flag of ['executionAllowed', 'customerMonitoringActive', 'independentBrokerAttestation',
      'independentCustomerConsentVerified', 'automaticPromotionAllowed']) assert.equal(v.provenance[flag], false);
    for (const count of ['realOrdersSent', 'externalPaperOrdersSent']) assert.equal(v.provenance[count], 0);
    for (const metric of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy']) assert.equal(v.provenance[metric], null);
  }
  assert.equal(source.inspect().ultraEventCount, 2);
  assert.equal(source.inspect().cachedOperations, 5);
});

test('R65 assisted projections preserve manual authority and the frozen 0.65 alignment boundary', () => {
  assert.equal(projectR65AssistedObservation(assisted('manual', { consecutiveLosses: 5,
    sessionDrawdownR: 10, operatorRequestedHelp: true })).decision, 'KEEP');
  assert.equal(projectR65AssistedObservation(assisted('hybrid', { confidence: 0.649999 })).decision, 'KEEP');
  assert.equal(projectR65AssistedObservation(assisted('hybrid', { confidence: 0.65 })).decision, 'ADVISE');
  assert.equal(projectR65AssistedObservation(assisted('reverse', { technicalSide: 'buy' })).decision, 'KEEP');
  denied(() => projectR65AssistedObservation(assisted('manual', { source: 'operational' })));
  denied(() => projectR65AssistedObservation({ decision: 'ALLOW', robot: 'manual', evidenceKind: 'SYNTHETIC_FIXTURE' }));
});

test('R65 envelopes exclude raw inputs, financial amounts, keys, sides and free text', () => {
  const { source, config } = fixture();
  const r = source.captureAssisted({ operationId: op(1), input: assisted('reverse', {
    consecutiveLosses: 4, syntheticLossIfFollowedR: 2.4 }) });
  assert.deepEqual(Object.keys(r.envelope.payload.event).sort(), ['policyVersion', 'robot', 'kind',
    'decision', 'issue', 'marketAgeMs', 'occurredAtMs', 'capturedAtMs'].sort());
  const text = JSON.stringify(r);
  for (const forbidden of ['privateKeyPem', 'BEGIN PRIVATE KEY', 'operatorSide', 'technicalSide',
    'syntheticLossIfFollowedR', 'capital', 'planCode', 'symbol', 'confidence', 'policyResult', 'reasonCodes'])
    assert.equal(text.includes(forbidden), false, forbidden);
  assert.equal(text.includes(config.privateKeyPem), false);
  assert.equal(r.envelope.payload.event.marketAgeMs, 0);
  assert.equal(r.provenance.marketAgeOrigin, 'NO_MARKET_OBSERVATION');
  assert.throws(() => { r.envelope.payload.event.decision = 'ALLOW'; }, TypeError);
  assert.throws(() => { r.provenance.origin = 'OPERATIONAL'; }, TypeError);
});

test('R65 detects payload tampering, sidecar tampering and substituted configured keys', () => {
  const { source } = fixture();
  const r = source.captureUltra({ operationId: op(1), event: snapshot(1000) });
  const altered = clone(r); altered.envelope.payload.event.marketAgeMs++;
  denied(() => admitted(source, altered), 'R64_TELEMETRY_SIGNATURE');
  const sidecar = clone(r); sidecar.provenance.activationGeneration++;
  denied(() => admitted(source, sidecar), 'R65_PROVENANCE_SIGNATURE');
  const operational = clone(r); operational.provenance.origin = 'OPERATIONAL';
  denied(() => admitted(source, operational), 'R65_PROVENANCE_VALUE');
  const wrongKey = fixture();
  denied(() => admitted(wrongKey.source, r), 'R64_TELEMETRY_SIGNATURE');
  const second = source.captureUltra({ operationId: op(2), event: snapshot(1050) });
  const swapped = { ...second, provenance: r.provenance, provenanceSignatureBase64: r.provenanceSignatureBase64 };
  denied(() => admitted(source, swapped), 'R65_PROVENANCE_VALUE');
});

test('R65 stored provenance inspection preserves historical binding without claiming a fresh signature admission', () => {
  const { source } = fixture();
  const r = source.captureAssisted({ operationId: op(1), input: assisted() });
  const { receipt } = admitted(source, r);
  assert.deepEqual(inspectR65StoredProvenance(clone(r.provenance), clone(receipt)), r.provenance);
  denied(() => admitted(source, r, NOW + 120000), 'R64_TELEMETRY_STALE_OR_FUTURE');
  assert.deepEqual(inspectR65StoredProvenance(r.provenance, receipt), r.provenance);
  const other = source.captureAssisted({ operationId: op(2), input: assisted('hybrid') });
  denied(() => inspectR65StoredProvenance(r.provenance, admitted(source, other).receipt), 'R65_PROVENANCE_VALUE');
  let calls = 0;
  const getter = clone(r.provenance);
  Object.defineProperty(getter, 'origin', { enumerable: true, get() { calls++; return 'R61_SYNTHETIC_RUNTIME'; } });
  denied(() => inspectR65StoredProvenance(getter, receipt));
  assert.equal(calls, 0);
});

test('R65 scope/source/session/sequence/version cannot be overridden by a capture caller', () => {
  const { source } = fixture({ initialSequence: 17 });
  const r = source.captureAssisted({ operationId: op(1), input: assisted() });
  assert.equal(r.envelope.payload.scopeId, SCOPE);
  assert.equal(r.envelope.payload.sourceId, SOURCE);
  assert.equal(r.envelope.payload.sessionId, SESSION);
  assert.equal(r.envelope.payload.sequence, 17);
  for (const [field, value] of [['scopeId', 'scope:ffffffffffffffff'], ['sourceId', 'source:ffffffffffffffff'],
    ['sessionId', 'session:ffffffffffffffff'], ['sequence', 100], ['policyVersion', 'research:r65-v2'],
    ['occurredAtMs', NOW - 1000], ['result', { decision: 'ALLOW' }]]) {
    denied(() => source.captureAssisted({ operationId: op(2), input: assisted(), [field]: value }), 'R65_SOURCE_COMMAND');
  }
  for (const patch of [{ scopeId: 'scope:ffffffffffffffff' }, { sourceId: 'source:ffffffffffffffff' }])
    denied(() => verifyR65ObservationRecord(r, { trustedSource: { ...source.trustedSource, ...patch }, nowMs: NOW }),
      'R64_TELEMETRY_SOURCE_OR_SCOPE');
  assert.equal(source.inspect().nextSequence, 18);
});

test('R65 identical retry returns the exact record without executing the runtime or reading newer clocks/state', () => {
  let stateReads = 0, clockReads = 0, occurrenceReads = 0, unavailable = false;
  const state = createR65EvolutionState({ scopeId: SCOPE, nowMs: NOW - 10000 });
  const { source } = fixture({ getActiveState: () => { stateReads++; if (unavailable) throw Error('Unavailable'); return state; },
    now: () => { clockReads++; return NOW; },
    getOccurrenceTimeMs: ({ capturedAtMs }) => { occurrenceReads++; return capturedAtMs; } });
  const command = { operationId: op(1), event: snapshot(650) };
  const r = source.captureUltra(command);
  const counts = [stateReads, clockReads, occurrenceReads];
  unavailable = true;
  const retry = source.captureUltra({ event: { marketAgeMs: 650, scenario: 'normal', type: 'snapshot' }, operationId: op(1) });
  assert.strictEqual(retry, r);
  assert.deepEqual([stateReads, clockReads, occurrenceReads], counts);
  assert.equal(source.inspect().ultraEventCount, 1);
  assert.equal(source.inspect().nextSequence, 2);
  denied(() => admitted(source, retry, NOW + 120000), 'R64_TELEMETRY_STALE_OR_FUTURE');
  assert.strictEqual(source.captureUltra(command), r);
});

test('R65 reused operation IDs reject changed inputs and method changes without consuming progress', () => {
  const { source } = fixture();
  source.captureUltra({ operationId: op(1), event: snapshot(650) });
  const before = source.inspect();
  denied(() => source.captureUltra({ operationId: op(1), event: snapshot(651) }), 'R65_SOURCE_OPERATION_CONFLICT');
  denied(() => source.captureAssisted({ operationId: op(1), input: assisted() }), 'R65_SOURCE_OPERATION_CONFLICT');
  assert.deepEqual(source.inspect(), before);
  const next = source.captureUltra({ operationId: op(2), event: snapshot(650) });
  assert.equal(next.envelope.payload.sequence, 2);
  assert.equal(next.envelope.payload.event.decision, 'ALLOW');
});

test('R65 malformed command/getters/private extra fields are refused before any state or clock callback', () => {
  let stateCalls = 0, clockCalls = 0, getterCalls = 0;
  const state = createR65EvolutionState({ scopeId: SCOPE, nowMs: NOW - 1000 });
  const { source } = fixture({ getActiveState: () => { stateCalls++; return state; },
    now: () => { clockCalls++; return NOW; } });
  const before = stateCalls;
  const getter = { operationId: op(1) };
  Object.defineProperty(getter, 'input', { enumerable: true, get() { getterCalls++; return assisted(); } });
  denied(() => source.captureAssisted(getter));
  denied(() => source.captureAssisted({ operationId: op(1), input: assisted(), email: 'private@example.test' }));
  denied(() => source.captureAssisted({ operationId: 'op:' + '1'.repeat(16), input: assisted() }), 'R65_SOURCE_OPERATION_ID');
  assert.equal(getterCalls, 0);
  assert.equal(stateCalls, before);
  assert.equal(clockCalls, 0);
  assert.equal(source.inspect().nextSequence, 1);
});

test('R65 failed runtime evaluation or invalid clock leaves sequence, cache and runtime unchanged', () => {
  let capturedAtMs = NOW;
  const { source } = fixture({ now: () => capturedAtMs });
  source.captureUltra({ operationId: op(1), event: snapshot() });
  const before = source.inspect();
  denied(() => source.captureUltra({ operationId: op(2), event: snapshot(60001) }));
  denied(() => source.captureUltra({ operationId: op(2), event: { ...snapshot(), decision: 'ALLOW' } }));
  capturedAtMs--;
  denied(() => source.captureUltra({ operationId: op(2), event: snapshot() }), 'R65_SOURCE_CLOCK');
  assert.deepEqual(source.inspect(), before);
  capturedAtMs = NOW + 1;
  const next = source.captureUltra({ operationId: op(2), event: snapshot() });
  assert.equal(next.envelope.payload.sequence, 2);
  assert.equal(next.envelope.payload.event.decision, 'ALLOW');
});

test('R65 pinned QA replay clock remains distinct from capture/admission and rejects future or overly old occurrence', () => {
  const occurredAtMs = NOW - 3600000;
  const { source } = fixture({ getOccurrenceTimeMs: () => occurredAtMs });
  const r = source.captureAssisted({ operationId: op(1), input: assisted() });
  assert.equal(r.envelope.payload.event.occurredAtMs, occurredAtMs);
  assert.equal(r.envelope.payload.event.capturedAtMs, NOW);
  assert.equal(r.provenance.clockSource, 'PINNED_QA_REPLAY_CLOCK');
  assert.equal(admitted(source, r).receipt.admittedAtMs, NOW);
  for (const offset of [1, -86400001]) {
    const f = fixture({ getOccurrenceTimeMs: () => NOW + offset });
    denied(() => f.source.captureAssisted({ operationId: op(1), input: assisted() }), 'R65_SOURCE_CLOCK');
    assert.equal(f.source.inspect().nextSequence, 1);
  }
  const immediate = fixture();
  assert.equal(immediate.source.captureAssisted({ operationId: op(1), input: assisted() })
    .provenance.clockSource, 'WALL_CLOCK_QA_EXECUTION');
});

test('R65 pause/resume produce blocking control projections without fabricating a CONTROL_VIOLATION incident', () => {
  const { source } = fixture();
  const capture = (n, event) => source.captureUltra({ operationId: op(n), event });
  capture(1, snapshot());
  assert.equal(capture(2, snapshot()).envelope.payload.event.decision, 'ALLOW');
  for (const [n, type] of [[3, 'pause'], [4, 'resume']]) {
    const r = capture(n, { type });
    assert.equal(r.envelope.payload.event.decision, 'BLOCK');
    assert.equal(r.envelope.payload.event.kind, 'decision');
    assert.equal(r.envelope.payload.event.issue, 'NONE');
    assert.equal(r.envelope.payload.event.marketAgeMs, 0);
    assert.equal(r.provenance.controlEvent, type);
    assert.equal(r.provenance.marketAgeOrigin, 'NO_MARKET_OBSERVATION');
    admitted(source, r);
  }
  assert.equal(capture(5, snapshot()).envelope.payload.event.decision, 'BLOCK');
  assert.equal(capture(6, snapshot()).envelope.payload.event.decision, 'ALLOW');
});

test('R65 source reports an actual stale gate and retains non-freshness R61 blocks', () => {
  const { source } = fixture();
  const stale = source.captureUltra({ operationId: op(1), event: snapshot(1000) });
  assert.equal(stale.envelope.payload.event.issue, 'STALE_CONTEXT');
  assert.equal(stale.envelope.payload.event.kind, 'incident');
  assert.equal(stale.envelope.payload.event.decision, 'BLOCK');
  source.captureUltra({ operationId: op(2), event: snapshot(100) });
  source.captureUltra({ operationId: op(3), event: snapshot(100) });
  const risk = source.captureUltra({ operationId: op(4), event: snapshot(100, 'risk_halt') });
  assert.equal(risk.envelope.payload.event.decision, 'BLOCK');
  assert.equal(risk.envelope.payload.event.issue, 'NONE');
  assert.equal(source.inspect().ultraStatus, 'HALTED');
  assert.equal(source.captureUltra({ operationId: op(5), event: snapshot(100) }).envelope.payload.event.decision, 'BLOCK');
});

test('R65 Ultra projection replays serialized runtime and rejects an arbitrary or altered allow decision', () => {
  const { state } = fixture();
  const start = createR65ActiveRuntime({ state, config: ultraConfig() });
  const runtime = stepR65ActiveRuntime({ runtime: start, state, event: snapshot(1000) });
  assert.equal(projectR65UltraObservation(clone(runtime)).decision, 'BLOCK');
  const forged = clone(runtime); forged.decision = 'ALLOW'; forged.allowSyntheticDecision = true;
  denied(() => projectR65UltraObservation(forged), 'R65_RUNTIME_REPLAY_MISMATCH');
  denied(() => projectR65UltraObservation({ robot: 'ultrafast', decision: 'ALLOW' }));
});

test('R65 pinned source rejects another scope or a replaced state history even for assisted captures', () => {
  let state = createR65EvolutionState({ scopeId: SCOPE, nowMs: NOW - 10000 });
  const { source } = fixture({ getActiveState: () => state });
  const before = source.inspect();
  state = createR65EvolutionState({ scopeId: 'scope:ffffffffffffffff', nowMs: NOW - 10000 });
  denied(() => source.captureAssisted({ operationId: op(1), input: assisted() }), 'R65_SOURCE_STATE_SCOPE');
  state = createR65EvolutionState({ scopeId: SCOPE, nowMs: NOW - 9999 });
  denied(() => source.captureAssisted({ operationId: op(1), input: assisted() }), 'R65_SOURCE_STATE_CONTINUITY');
  assert.deepEqual(source.inspect(), before);
});

test('R65 signing key/session/initial sequence validation and sequence exhaustion fail closed', () => {
  const f = fixture();
  const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'pem', type: 'pkcs8' });
  denied(() => createR65ObservationSource({ ...f.config, privateKeyPem: ec }), 'R65_SOURCE_SIGNING_KEY');
  denied(() => createR65ObservationSource({ ...f.config, privateKeyPem: 'invalid' }), 'R65_SOURCE_SIGNING_KEY');
  denied(() => createR65ObservationSource({ ...f.config, ultraConfig: { ...ultraConfig(), sessionId: 'session:ffffffffffffffff' } }),
    'R65_SOURCE_SESSION_PIN');
  for (const initialSequence of [undefined, 0, 1.5, 1000000001])
    denied(() => createR65ObservationSource({ ...f.config, initialSequence }), 'R65_SOURCE_CONFIG');
  const last = fixture({ initialSequence: 1000000000 }).source;
  const r = last.captureAssisted({ operationId: op(1), input: assisted() });
  assert.equal(r.envelope.payload.sequence, 1000000000);
  denied(() => last.captureAssisted({ operationId: op(2), input: assisted() }), 'R65_SOURCE_SEQUENCE_LIMIT');
  assert.strictEqual(last.captureAssisted({ operationId: op(1), input: assisted() }), r);
  assert.equal(last.inspect().durableOutbox, false);
});

test('R65 source consumes a validated policy promotion and rollback while retries preserve the old envelope', () => {
  let state = createR65EvolutionState({ scopeId: SCOPE, nowMs: NOW - 86400000 });
  let captureAt = NOW - 1000, occurrenceAt = NOW - 10000;
  const { period } = scheduleR64TelemetryPeriod({ nowMs: NOW });
  occurrenceAt = period.endMs - 10000;
  const { source } = fixture({ getActiveState: () => state, now: () => captureAt,
    getOccurrenceTimeMs: () => occurrenceAt });
  const records = [];
  for (let n = 1; n <= 3; n++) {
    occurrenceAt++;
    records.push(source.captureUltra({ operationId: op(n), event: snapshot(900 + n * 50) }));
  }
  const receipts = records.map(r => admitted(source, r, captureAt).receipt);
  const caseDefinitions = [100, 150, 650, 700, 900, 950].map((age, index) => ({
    caseId: 'case:' + (index + 1).toString(16).padStart(16, '0'),
    snapshotAgesMs: [age, age], expectedAllow: age < 500 }));
  const plan = { planId: 'plan:0000000000000001', scopeId: SCOPE, evidenceKind: 'SYNTHETIC_FIXTURE',
    startsAtMs: NOW + 2000, endsAtMs: NOW + 10000, caseDefinitions };
  state = registerR65Evaluation({ state, receipts, period, studyAtMs: NOW,
    sourceCycleId: '11111111-1111-4111-8111-111111111111', plan, nowMs: NOW + 1000 });
  const validationCases = caseDefinitions.map((definition, index) => ({ ...definition, scopeId: SCOPE,
    evidenceKind: 'SYNTHETIC_FIXTURE', occurredAtMs: plan.startsAtMs + index + 1 }));
  state = runR65EvolutionCycle({ state, validationCases, nowMs: plan.endsAtMs + 1 }).state;
  assert.equal(state.activeVersion.versionId, 'research:r65-v2');
  captureAt = plan.endsAtMs + 2; occurrenceAt = captureAt;
  const after = source.captureUltra({ operationId: op(4), event: snapshot(650) });
  assert.equal(after.envelope.payload.event.policyVersion, 'research:r65-v2');
  assert.equal(after.provenance.activationGeneration, 1);
  assert.equal(after.envelope.payload.event.decision, 'BLOCK');
  assert.equal(after.envelope.payload.event.issue, 'STALE_CONTEXT');
  assert.strictEqual(source.captureUltra({ operationId: op(1), event: snapshot(950) }), records[0]);
  state = rollbackR65Evolution({ state, reason: 'OWNER_REQUEST', nowMs: captureAt + 1 });
  captureAt += 2; occurrenceAt = captureAt;
  const reset = source.captureUltra({ operationId: op(5), event: snapshot(650) });
  assert.equal(reset.envelope.payload.event.policyVersion, 'research:r65-v1');
  assert.equal(reset.provenance.activationGeneration, 2);
  assert.equal(reset.envelope.payload.event.decision, 'BLOCK');
  const confirmed = source.captureUltra({ operationId: op(6), event: snapshot(650) });
  assert.equal(confirmed.envelope.payload.event.decision, 'ALLOW');
  assert.equal(confirmed.envelope.payload.event.issue, 'NONE');
  const report = admitted(source, confirmed, captureAt);
  assert.equal(report.provenance.runtimeEvidenceKind, 'SYNTHETIC_FIXTURE');
  assert.equal(report.receipt.evidenceKind, 'SIGNED_QA_REPLAY');
});
