import test from 'node:test';
import assert from 'node:assert/strict';
import { createR67ObservationHandler, createR67AdminHandler } from '../lib/platform/research/robot-r67-http.mjs';
import { verifyR67PrivateObservationRecord, R67_INVARIANTS } from '../lib/platform/research/robot-r67-private-protocol.mjs';
import { createR67ProtocolFixture } from './fixtures/r67-private-protocol-fixture.mjs';

const T = Date.UTC(2026, 9, 24, 18);
const env = () => ({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' });
const request = (method = 'POST', { body, type = 'application/json', token, search = '' } = {}) =>
  new Request('http://127.0.0.1/api/platform/robot-private-observations' + search, { method,
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    headers: { 'Content-Type': type, ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
const db = ({ admin = true, invalid = false, anonymous = false } = {}) => ({
  auth: { async getUser() { return { data: { user: invalid ? null : { id: 'r67-fixture-user',
    is_anonymous: anonymous, app_metadata: { platform_role: admin ? 'admin' : 'user' } } }, error: null }; } },
  from() { return { select() { return { async eq() { return { data: [{ permission: 'platform.admin' }, { permission: 'platform.reports' }], error: null }; } }; } }; },
});
async function fixture(options = {}) {
  const f = await createR67ProtocolFixture({ nowMs: T }), calls = [];
  const { receipt, record } = verifyR67PrivateObservationRecord(f.record, { trustedSource: f.trustedSource, nowMs: T + 1 });
  const store = { async ingest(input) { calls.push(input); return { status: 'STORED', ...input }; },
    async read(input) { calls.push(input); return [{ receipt, record }]; } };
  const runtime = { store, scopeId: f.trustedSource.scopeId, sourceId: f.trustedSource.sourceId };
  return { ...f, receipt, calls, store, runtime,
    intake: createR67ObservationHandler({ env: env(), getSource: () => f.trustedSource, getStore: () => store, now: () => T + 1 }),
    admin: createR67AdminHandler({ env: env(), getDb: () => db(options), getRuntime: () => runtime, now: () => T + 2 }) };
}

test('R67 disabled, production and paid modes stop before authentication, source or database dependencies', async () => {
  let calls = 0; const forbidden = () => { calls++; throw Error('must not execute'); };
  for (const candidate of [{}, { ...env(), VERCEL_ENV: 'production' }, { ...env(), JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'true' },
    { ...env(), JENIOS_REAL_EXECUTION_ENABLED: 'true' }, { ...env(), JENIOS_PRIVATE_PAPER_EXECUTOR: 'true' }]) {
    const intake = createR67ObservationHandler({ env: candidate, getSource: forbidden, getStore: forbidden });
    const admin = createR67AdminHandler({ env: candidate, getDb: forbidden, getRuntime: forbidden });
    assert.equal((await intake(request('POST', { body: {} }))).status, 404);
    assert.equal((await admin(request('GET', { token: 'fixture-admin' }))).status, 404);
  }
  assert.equal(calls, 0);
});

test('R67 intake rejects wrong method, media, oversized body, signatures and expired records without store access', async () => {
  const f = await fixture(), corrupt = structuredClone(f.record);
  corrupt.provenance.independentRuntimeAttestation = true;
  assert.equal((await f.intake(request('GET'))).status, 405);
  assert.equal((await f.intake(request('POST', { body: f.record, type: 'text/plain' }))).status, 415);
  assert.equal((await f.intake(request('POST', { body: ' '.repeat(262145) }))).status, 400);
  assert.equal((await f.intake(request('POST', { body: corrupt }))).status, 400);
  const expired = createR67ObservationHandler({ env: env(), getSource: () => f.trustedSource, getStore: () => f.store, now: () => T + 120000 });
  assert.equal((await expired(request('POST', { body: f.record }))).status, 400);
  assert.equal(f.calls.length, 0);
});

test('R67 signed batch acknowledgement is emitted only after confirmed persistence and stays synthetic', async () => {
  const f = await fixture();
  for (const [status, code] of [['STORED', 202], ['ALREADY_STORED', 200]]) {
    f.store.ingest = async input => { f.calls.push(input); return { ...input, status }; };
    const result = await f.intake(request('POST', { body: f.record }));
    assert.equal(result.status, code);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    const ack = await result.json();
    assert.equal(ack.recordDigest, f.receipt.recordDigest);
    assert.equal(ack.captureCount, 3);
    assert.equal(ack.runtimeOrigin, 'ORIGINAL_PRIVATE_CORE_SYNTHETIC_RUNTIME');
    for (const [key, value] of Object.entries(R67_INVARIANTS)) assert.equal(ack[key], value);
    assert.equal('signatureBase64' in ack, false);
  }
  assert.equal(f.calls.length, 2);
});

test('R67 intake never acknowledges a conflicting, failed or foreign database response', async () => {
  const f = await fixture();
  f.store.ingest = async () => { throw Object.assign(Error('internal secret'), { code: 'R67_DATABASE_OPERATION_CONFLICT' }); };
  let result = await f.intake(request('POST', { body: f.record }));
  assert.equal(result.status, 409); assert.equal((await result.text()).includes('secret'), false);
  f.store.ingest = async () => { throw Error('postgres credential'); };
  assert.equal((await f.intake(request('POST', { body: f.record }))).status, 503);
  const other = await createR67ProtocolFixture({ nowMs: T, operationId: 'op:' + '12'.repeat(16) });
  const v = verifyR67PrivateObservationRecord(other.record, { trustedSource: other.trustedSource, nowMs: T + 1 });
  f.store.ingest = async () => ({ status: 'STORED', receipt: v.receipt, record: v.record });
  assert.equal((await f.intake(request('POST', { body: f.record }))).status, 503);
});

test('R67 administrative feed requires verified nonanonymous platform.admin identity', async () => {
  const f = await fixture();
  assert.equal((await f.admin(request('GET'))).status, 401);
  assert.equal((await f.admin(request('POST', { token: 'fixture-admin', body: {} }))).status, 405);
  for (const [options, expected] of [[{ invalid: true }, 401], [{ anonymous: true }, 401], [{ admin: false }, 403]]) {
    const denied = await fixture(options);
    assert.equal((await denied.admin(request('GET', { token: 'fixture-token' }))).status, expected);
    assert.equal(denied.calls.length, 0);
  }
  assert.equal(f.calls.length, 0);
});

test('R67 admin projection exposes original actions with server scope and no keys, signatures or raw scenarios', async () => {
  const f = await fixture();
  const response = await f.admin(request('GET', { token: 'fixture-admin' })), body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.returnedBatches, 1); assert.equal(body.returnedCaptures, 3);
  assert.deepEqual(body.observations[0].originalActions.map(x => x.action), ['manual_preview', 'wait_for_confluence', 'reverse_not_calibrated']);
  assert.equal(body.scopeId, f.trustedSource.scopeId);
  assert.equal(body.currentPrivateHostIndependentlyObserved, false);
  for (const [key, value] of Object.entries(R67_INVARIANTS)) assert.equal(body[key], value);
  const text = JSON.stringify(body);
  for (const forbidden of ['signatureBase64', 'publicKeyPem', 'scenarios', 'scan', 'rawOutputSha256']) assert.equal(text.includes(forbidden), false);
  assert.deepEqual(f.calls, [{ limit: 30 }]);
  assert.equal((await f.admin(request('GET', { token: 'fixture-admin', search: '?scopeId=scope:ffffffffffffffff' }))).status, 400);
  assert.equal(f.calls.length, 1);
});

test('R67 admin fails closed on cross-scope history or broken historical digest', async () => {
  const f = await fixture();
  const other = await createR67ProtocolFixture({ nowMs: T, scopeId: 'scope:ffffffffffffffff' });
  const v = verifyR67PrivateObservationRecord(other.record, { trustedSource: other.trustedSource, nowMs: T + 1 });
  f.store.read = async () => [{ receipt: v.receipt, record: v.record }];
  assert.equal((await f.admin(request('GET', { token: 'fixture-admin' }))).status, 503);
  const broken = structuredClone({ receipt: f.receipt, record: f.record }); broken.record.envelope.payload.capture.entries[0].action = 'buy';
  f.store.read = async () => [broken];
  assert.equal((await f.admin(request('GET', { token: 'fixture-admin' }))).status, 503);
});
