import test from 'node:test';
import assert from 'node:assert/strict';
import { createR67DatabaseStore, R67_DATABASE_RPCS } from '../lib/platform/research/robot-r67-database-store.mjs';
import { verifyR67PrivateObservationRecord } from '../lib/platform/research/robot-r67-private-protocol.mjs';
import { createR67ProtocolFixture, R67_PROTOCOL_FIXTURE_KIND } from './fixtures/r67-private-protocol-fixture.mjs';

const T = Date.UTC(2026, 9, 24, 18), clone = value => structuredClone(value);
async function setup(responder) {
  const f = await createR67ProtocolFixture({ nowMs: T });
  assert.equal(f.fixtureEvidence, R67_PROTOCOL_FIXTURE_KIND);
  const { receipt, record } = verifyR67PrivateObservationRecord(f.record, { trustedSource: f.trustedSource, nowMs: T + 10 });
  const calls = [], input = { receipt, record };
  const db = { async rpc(name, args) { calls.push({ name, args }); return responder ? responder(name, args, input) :
    { data: name === R67_DATABASE_RPCS.ingest ? { status: 'STORED', ...input } : [input], error: null }; } };
  return { ...f, input, calls, store: createR67DatabaseStore({ db, ...f.trustedSource }) };
}

test('R67 database pins scope/source and retains the first committed receipt under reversed verifier timing', async () => {
  const f = await setup((name, args, input) => ({ data: { status: 'ALREADY_STORED',
    ...input, receipt: { ...input.receipt, admittedAtMs: T + 20 } }, error: null }));
  const result = await f.store.ingest(f.input);
  assert.equal(result.status, 'ALREADY_STORED');
  assert.equal(result.receipt.admittedAtMs, T + 20);
  assert.deepEqual(result.record, f.record);
  assert.equal(Object.isFrozen(result.record.envelope.payload), true);
  assert.equal(f.calls[0].name, R67_DATABASE_RPCS.ingest);
  assert.equal(f.calls[0].args.p_input.scopeId, f.trustedSource.scopeId);
  assert.equal(f.calls[0].args.p_input.sourceId, f.trustedSource.sourceId);
});

test('R67 database rejects caller-selected scope, changed evidence and extra receipt fields before RPC', async () => {
  const f = await setup();
  const other = await createR67ProtocolFixture({ nowMs: T, scopeId: 'scope:ffffffffffffffff' });
  const verified = verifyR67PrivateObservationRecord(other.record, { trustedSource: other.trustedSource, nowMs: T });
  await assert.rejects(f.store.ingest({ receipt: verified.receipt, record: verified.record }), /R67_DATABASE_SCOPE/);
  const corrupt = clone(f.input); corrupt.record.provenance.independentRuntimeAttestation = true;
  await assert.rejects(f.store.ingest(corrupt));
  const extra = clone(f.input); extra.receipt.trustedByCaller = true;
  await assert.rejects(f.store.ingest(extra));
  assert.equal(f.calls.length, 0);
});

test('R67 database refuses unbound, corrupt or unconfirmed acknowledgements', async () => {
  const other = await createR67ProtocolFixture({ nowMs: T, operationId: 'op:' + '99'.repeat(16) });
  const v = verifyR67PrivateObservationRecord(other.record, { trustedSource: other.trustedSource, nowMs: T });
  for (const result of [() => ({ status: 'STORED', receipt: v.receipt, record: v.record }),
    (_, __, input) => ({ ...input, status: 'PENDING' }),
    (_, __, input) => ({ ...input, status: 'STORED', sourceProof: true }),
    (_, __, input) => ({ ...input, receipt: { ...input.receipt, recordDigest: 'f'.repeat(64) }, status: 'STORED' })]) {
    const f = await setup((...args) => ({ data: result(...args), error: null }));
    await assert.rejects(f.store.ingest(f.input));
  }
});

test('R67 database surfaces bounded conflict codes and hides transport secrets', async () => {
  for (const [message, expected] of [['R67_DATABASE_EVENT_CONFLICT', 'R67_DATABASE_EVENT_CONFLICT'],
    ['url=postgres://secret:password@host token=secret', 'R67_DATABASE_UNAVAILABLE']]) {
    const f = await setup(() => ({ data: null, error: { message } }));
    await assert.rejects(f.store.ingest(f.input), { code: expected, message: expected });
  }
  const f = await setup(() => { throw Error('private database secret'); });
  await assert.rejects(f.store.read(), { code: 'R67_DATABASE_UNAVAILABLE' });
});

test('R67 database bounds reads and forbids caller scope overrides or duplicate rows', async () => {
  const f = await setup();
  assert.equal((await f.store.read({ limit: 1 })).length, 1);
  assert.deepEqual(f.calls[0].args.p_input, { limit: 1, scopeId: f.trustedSource.scopeId, sourceId: f.trustedSource.sourceId });
  for (const input of [{ limit: 0 }, { limit: 31 }, { limit: 1.5 }, { limit: 1, scopeId: f.trustedSource.scopeId }])
    await assert.rejects(f.store.read(input), /R67_DATABASE_READ_REQUEST/);
  assert.equal(f.calls.length, 1);
  const repeated = await setup((_, __, input) => ({ data: [input, input], error: null }));
  await assert.rejects(repeated.store.read(), /R67_DATABASE_RESPONSE_BINDING/);
});
