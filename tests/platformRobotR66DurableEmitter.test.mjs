import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, chmodSync, unlinkSync, existsSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createR66DurableEmitter } from '../lib/platform/research/robot-r66-durable-emitter.mjs';
import { createR66ObservationOutbox, R66_OUTBOX_FILE, R66_OUTBOX_LOCK } from '../lib/platform/research/robot-r66-observation-outbox.mjs';
import { createR65EvolutionState } from '../lib/platform/research/robot-r65-evolution-engine.mjs';
import { verifyR65ObservationRecord } from '../lib/platform/research/robot-r65-observation-source.mjs';
const NOW = Date.UTC(2026, 9, 24, 18), SCOPE = 'scope:0000000000000066';
const op = n => 'op:' + n.toString(16).padStart(32, '0');
const snapshot = age => ({ type: 'snapshot', scenario: 'normal', marketAgeMs: age });
const assisted = (mode = 'manual') => ({ source: 'synthetic_fixture', mode, operatorSide: 'buy', technicalSide: 'sell', confidence: 0.85 });
const denied = (fn, code) => assert.throws(fn, e => !code || e.code === code);
function fixture(t, patch = {}) {
  const directory = mkdtempSync('/tmp/jenios-r66-emitter-');
  t.after(() => { chmodSync(directory, 0o700); rmSync(directory, { recursive: true, force: true }); });
  const { privateKey } = generateKeyPairSync('ed25519');
  const state = createR65EvolutionState({ scopeId: SCOPE, nowMs: NOW - 1000 });
  const config = { enabled: true, domain: 'R61_SYNTHETIC_RUNTIME', directory, key: 'd'.repeat(64),
    scopeId: SCOPE, sourceId: 'source:0000000000000066',
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }), getActiveState: () => state, now: () => NOW,
    ultraConfig: { evidenceKind: 'SYNTHETIC_FIXTURE', planCode: 'platform-global-crypto', symbol: 'BTC-USD', capital: 1000, leverage: 2 }, ...patch };
  return { directory, state, config, emitter: createR66DurableEmitter(config) };
}
function ack(record, status = 'STORED', patch = {}) {
  return new Response(JSON.stringify({ schema: 'JENIOS_R65_INTAKE_RESULT_V1', status,
    eventId: record.envelope.payload.eventId, scopeId: record.envelope.payload.scopeId,
    observationEvidenceKind: 'SIGNED_QA_REPLAY', runtimeOrigin: 'R61_SYNTHETIC_RUNTIME',
    validationEvidenceKind: 'SYNTHETIC_FIXTURE', customerMonitoringActive: false,
    privateEngineConnected: false, realOrdersSent: 0, externalPaperOrdersSent: 0, ...patch }),
    { status: status === 'STORED' ? 202 : 200, headers: { 'content-type': 'application/json' } });
}

test('R66 capture commits exact dual signatures before returning without storing keys or raw inputs', t => {
  const { emitter, directory, config } = fixture(t);
  const record = emitter.captureAssisted({ operationId: op(1), input: assisted('reverse') });
  const storedText = readFileSync(`${directory}/${R66_OUTBOX_FILE}`, 'utf8');
  assert.deepEqual(JSON.parse(storedText).payload.entries[0].record, record);
  assert.equal(storedText.includes('PRIVATE KEY'), false);
  assert.equal(storedText.includes(config.key), false);
  for (const field of ['operatorSide', 'capital', 'leverage']) assert.equal(storedText.includes(field), false);
  verifyR65ObservationRecord(record, { trustedSource: emitter.trustedSource, nowMs: NOW });
  assert.equal(existsSync(`${directory}/${R66_OUTBOX_LOCK}`), false);
  assert.deepEqual(emitter.inspect().queue, { total: 1, pending: 1, acknowledged: 0, unconfirmed: 0, expiredUnconfirmed: 0 });
});

test('R66 exact operation retries survive reopen without recapture, and conflicts fail', t => {
  let clockReads = 0, stateReads = 0;
  const f = fixture(t);
  const first = f.emitter.captureUltra({ operationId: op(1), event: snapshot(100) });
  const second = createR66DurableEmitter({ ...f.config, now: () => { clockReads++; return NOW; },
    getActiveState: () => { stateReads++; return f.state; } });
  const before = [clockReads, stateReads];
  const retry = second.captureUltra({ operationId: op(1), event: snapshot(100) });
  assert.deepEqual(retry, first); assert.deepEqual([clockReads, stateReads], before);
  assert.notEqual(second.sessionId, f.emitter.sessionId);
  assert.equal(second.inspect().nextSequence, 1); assert.equal(second.inspect().ultraEventCount, 0);
  denied(() => second.captureUltra({ operationId: op(1), event: snapshot(101) }), 'R66_OUTBOX_OPERATION_CONFLICT');
  denied(() => second.captureAssisted({ operationId: op(1), input: assisted() }), 'R66_OUTBOX_OPERATION_CONFLICT');
  assert.equal(second.inspect().ultraEventCount, 0);
});

test('R66 restarting resets freshness; old operation retries never become new confirmations', t => {
  const f = fixture(t);
  const first = f.emitter.captureUltra({ operationId: op(1), event: snapshot(100) });
  assert.equal(first.envelope.payload.event.decision, 'BLOCK');
  assert.equal(f.emitter.captureUltra({ operationId: op(2), event: snapshot(100) }).envelope.payload.event.decision, 'ALLOW');
  const reopened = createR66DurableEmitter(f.config);
  reopened.captureUltra({ operationId: op(2), event: snapshot(100) });
  const next = reopened.captureUltra({ operationId: op(3), event: snapshot(100) });
  assert.equal(next.envelope.payload.sequence, 1); assert.equal(next.envelope.payload.event.decision, 'BLOCK');
  assert.equal(reopened.captureUltra({ operationId: op(4), event: snapshot(100) }).envelope.payload.event.decision, 'ALLOW');
  assert.equal(reopened.inspect().runtimeRestored, false);
});

test('R66 a different operating-system process resumes exact outbox bytes and uses a new session', t => {
  const f = fixture(t);
  const command = { operationId: op(1), event: snapshot(100) };
  const original = f.emitter.captureUltra(command);
  const childCode = `
    import { readFileSync } from 'node:fs';
    import { createR66DurableEmitter } from './lib/platform/research/robot-r66-durable-emitter.mjs';
    const d=JSON.parse(readFileSync(0,'utf8'));
    const e=createR66DurableEmitter({...d.config,getActiveState:()=>d.state,now:()=>d.now});
    const retried=e.captureUltra(d.command);
    process.stdout.write(JSON.stringify({record:retried,state:e.inspect()}));
  `;
  const config = { ...f.config }; delete config.now; delete config.getActiveState;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', childCode], {
    cwd: process.cwd(), input: JSON.stringify({ config, state: f.state, now: NOW, command }), encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.deepEqual(result.record, original); assert.notEqual(result.state.sessionId, f.emitter.sessionId);
  assert.equal(result.state.ultraEventCount, 0); assert.equal(result.state.nextSequence, 1);
});

test('R66 loss of HTTP acknowledgement persists uncertainty and retries exact record once', async t => {
  const f = fixture(t);
  const record = f.emitter.captureAssisted({ operationId: op(1), input: assisted() });
  const received = [];
  const lost = await f.emitter.flush({ send: async r => { received.push(JSON.stringify(r)); throw Error('response lost after receiver commit'); } });
  assert.equal(lost.attempted, 1); assert.equal(lost.acknowledged, 0); assert.equal(lost.unconfirmed, 1);
  const reopened = createR66DurableEmitter(f.config);
  const retried = await reopened.flush({ send: async r => { received.push(JSON.stringify(r)); return ack(r, 'ALREADY_STORED'); } });
  assert.equal(retried.acknowledged, 1); assert.deepEqual(received, [JSON.stringify(record), JSON.stringify(record)]);
  assert.equal(reopened.inspect().queue.acknowledged, 1);
  let calls = 0;
  assert.equal((await reopened.flush({ send: async () => { calls++; } })).attempted, 0); assert.equal(calls, 0);
});

test('R66 FIFO stops on uncertain head and never sends a later record prematurely', async t => {
  const f = fixture(t);
  const a = f.emitter.captureAssisted({ operationId: op(1), input: assisted() });
  const b = f.emitter.captureAssisted({ operationId: op(2), input: assisted('hybrid') });
  const seen = [];
  await f.emitter.flush({ send: async r => { seen.push(r.envelope.payload.eventId); return new Response('{}', { status: 503 }); } });
  assert.deepEqual(seen, [a.envelope.payload.eventId]);
  await f.emitter.flush({ send: async r => { seen.push(r.envelope.payload.eventId); return ack(r); } });
  assert.deepEqual(seen, [a.envelope.payload.eventId, a.envelope.payload.eventId, b.envelope.payload.eventId]);
});

test('R66 expired uncertain records remain auditable and do not block newer records', async t => {
  let clock = NOW;
  const f = fixture(t, { now: () => clock });
  const stale = f.emitter.captureAssisted({ operationId: op(1), input: assisted() });
  await f.emitter.flush({ send: async () => { throw Error('lost reply'); } });
  clock += 120000;
  const fresh = f.emitter.captureAssisted({ operationId: op(2), input: assisted('hybrid') });
  const seen = [];
  const result = await f.emitter.flush({ send: async r => { seen.push(r); return ack(r); } });
  assert.equal(result.expired, 1); assert.equal(result.acknowledged, 1); assert.deepEqual(seen, [fresh]);
  const outbox = createR66ObservationOutbox({ directory: f.directory, key: f.config.key, trustedSource: f.emitter.trustedSource });
  const [old] = outbox.read().entries;
  assert.deepEqual(old.record, stale); assert.equal(old.expiredAtMs, clock); assert.equal(old.attempts[0].outcome, 'UNCERTAIN');
  assert.equal(f.emitter.inspect().queue.expiredUnconfirmed, 1);
  assert.deepEqual(f.emitter.captureAssisted({ operationId: op(1), input: assisted() }), stale);
});

test('R66 batch expiry can preserve several records in a single durable transaction', async t => {
  let clock = NOW;
  const f = fixture(t, { now: () => clock });
  for (let n = 1; n <= 4; n++) f.emitter.captureAssisted({ operationId: op(n), input: assisted() });
  clock += 120000;
  const result = await f.emitter.flush({ send: async () => assert.fail('expired records cannot be sent') });
  assert.equal(result.expired, 4); assert.equal(result.attempted, 0);
  assert.equal(f.emitter.inspect().queue.expiredUnconfirmed, 4);
});

test('R66 only exact native HTTP status/schema/identity/invariants can acknowledge a record', async t => {
  const badReplies = [
    r => ack(r, 'STORED', { eventId: 'evt:ffffffffffffffff' }),
    r => ack(r, 'STORED', { scopeId: 'scope:ffffffffffffffff' }),
    r => ack(r, 'STORED', { privateEngineConnected: true }),
    r => ack(r, 'STORED', { runtimeOrigin: 'OPERATIONAL' }),
    r => new Response(JSON.stringify({ schema: 'JENIOS_R65_INTAKE_RESULT_V1', status: 'STORED' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    () => ({ status: 202, json: async () => ({ status: 'STORED' }) }),
    () => new Response('x'.repeat(8193), { status: 202, headers: { 'content-type': 'application/json' } }),
    () => new Response('{}', { status: 202, headers: { 'content-type': 'text/plain' } }),
  ];
  for (const response of badReplies) {
    const f = fixture(t); f.emitter.captureAssisted({ operationId: op(1), input: assisted() });
    const result = await f.emitter.flush({ send: async r => response(r) });
    assert.equal(result.acknowledged, 0); assert.equal(result.unconfirmed, 1); assert.equal(f.emitter.inspect().queue.acknowledged, 0);
  }
});

test('R66 delivery is serialized across emitter instances while capture remains available', async t => {
  const f = fixture(t), other = createR66DurableEmitter(f.config);
  f.emitter.captureAssisted({ operationId: op(1), input: assisted() });
  let release, entered;
  const ready = new Promise(r => { entered = r; });
  let sendCount = 0;
  const first = f.emitter.flush({ send: async r => { if (++sendCount === 1) { entered(); await new Promise(done => { release = done; }); } return ack(r); } });
  await ready;
  await assert.rejects(other.flush({ send: async r => ack(r) }), e => e.code === 'R66_OUTBOX_LOCKED');
  other.captureAssisted({ operationId: op(2), input: assisted() });
  release(); assert.equal((await first).acknowledged, 2);
});

test('R66 uncertain persistence invalidates local runtime until reopened; no uncommitted result escapes', t => {
  const f = fixture(t);
  let reads = 0;
  const emitter = createR66DurableEmitter({ ...f.config, getActiveState: () => {
    if (++reads === 2) chmodSync(f.directory, 0o755);
    return f.state;
  } });
  denied(() => emitter.captureUltra({ operationId: op(1), event: snapshot(100) }));
  assert.equal(emitter.inspect().invalidated, true);
  denied(() => emitter.captureUltra({ operationId: op(2), event: snapshot(100) }), 'R66_EMITTER_REOPEN_REQUIRED');
  chmodSync(f.directory, 0o700);
  // Explicit test-host recovery after the captured synchronous operation ended.
  assert.equal(existsSync(`${f.directory}/${R66_OUTBOX_LOCK}`), true);
  unlinkSync(`${f.directory}/${R66_OUTBOX_LOCK}`);
  const recovered = createR66DurableEmitter(f.config);
  assert.equal(recovered.inspect().queue.total, 0);
  assert.equal(recovered.captureUltra({ operationId: op(1), event: snapshot(100) }).envelope.payload.event.decision, 'BLOCK');
});

test('R66 rejects caller-selected sessions/sequences/operational domains and never activates external code', t => {
  const f = fixture(t);
  for (const domain of ['OPERATIONAL', 'LIVE', 'PRIVATE_CORE_SYNTHETIC_CAPTURE']) denied(() => createR66DurableEmitter({ ...f.config, domain }), 'R66_OPERATIONAL_SOURCE_INACTIVE');
  denied(() => createR66DurableEmitter({ ...f.config, sessionId: 'session:0000000000000001' }), 'R66_EMITTER_CONFIG');
  denied(() => createR66DurableEmitter({ ...f.config, initialSequence: 3 }), 'R66_EMITTER_CONFIG');
  denied(() => createR66DurableEmitter({ ...f.config, ultraConfig: { ...f.config.ultraConfig, sessionId: 'session:0000000000000001' } }), 'R66_EMITTER_SESSION_MUST_BE_NEW');
  let calls = 0;
  denied(() => createR66DurableEmitter({ ...f.config, analyzeRequest() { calls++; } }));
  assert.equal(calls, 0);
  for (const key of ['customerMonitoringActive', 'privateEngineConnected', 'executionAllowed', 'commercialPerformanceCertified']) assert.equal(f.emitter.inspect()[key], false);
  for (const key of ['realOrdersSent', 'externalPaperOrdersSent', 'paidProviderCalls']) assert.equal(f.emitter.inspect()[key], 0);
  for (const key of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy']) assert.equal(f.emitter.inspect()[key], null);
});
