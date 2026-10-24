import test from 'node:test';
import assert from 'node:assert/strict';
import { createR71DatabaseStore, R71_DATABASE_RPCS } from '../lib/platform/research/robot-r71-database-store.mjs';
import { createR71ProtocolFixture } from './fixtures/r71-private-protocol-fixture.mjs';
import { createR71EvolutionState } from '../lib/platform/research/robot-r71-evolution-engine.mjs';
import { r71MembershipDigest } from '../lib/platform/research/robot-r71-private-study.mjs';

// Explicit public signed protocol fixture. No original executable or hosted DB.
const fixture = await createR71ProtocolFixture({ nowMs: 100000 });
const identity = { scopeId: fixture.trustedSource.scopeId, sourceId: fixture.trustedSource.sourceId,
  sourceKeySha256: fixture.receipt.sourceKeySha256 };
const state = createR71EvolutionState({ ...identity, nowMs: 90000 });
const stateRow = { scopeId: identity.scopeId, sourceId: identity.sourceId, revision: 0, stateDigest: '71'.repeat(32), state };
const clone = value => structuredClone(value);
const pair = () => ({ receipt: clone(fixture.receipt), record: clone(fixture.record) });
const make = callback => createR71DatabaseStore({ ...identity, db: { rpc: callback } });
const snapshot = { schema: 'JENIOS_R71_PRIVATE_STUDY_SNAPSHOT_V1', snapshotId: '71717171-7171-4717-8717-717171717171',
  ...identity, period: { startMs: 99999, endMs: 100001 }, frozenAtMs: 100002, totalRecords: 1, totalEntries: 8,
  membershipDigest: r71MembershipDigest([{ ordinal: 1, eventId: fixture.record.annotation.eventId,
    recordDigest: fixture.receipt.recordDigest, annotationDigest: fixture.receipt.annotationDigest }]) };

test('R71 DB binds its closed source configuration and has no case-writing RPC', () => {
  assert.throws(() => createR71DatabaseStore({ ...identity, db: {} }), /R71_DATABASE_CLIENT_REQUIRED/);
  assert.throws(() => createR71DatabaseStore({ ...identity, db: { rpc() {} }, sourceKeySha256: null }), /R71_DATABASE_SCOPE_REQUIRED/);
  assert.throws(() => createR71DatabaseStore({ ...identity, db: { rpc() {} }, arbitrary: true }), /R71_DATABASE_CONFIG/);
  assert.equal(Object.keys(R71_DATABASE_RPCS).length, 8);
  assert.equal(Object.hasOwn(R71_DATABASE_RPCS, 'recordValidationCase'), false);
});
test('R71 now and nullable readState use only pinned source RPC arguments', async () => {
  const calls = [];
  const store = make(async (name, args) => { calls.push({ name, args });
    return { data: name === R71_DATABASE_RPCS.now ? { nowMs: 100005 } : null, error: null }; });
  assert.deepEqual(await store.now(), { nowMs: 100005 }); assert.equal(await store.readState(), null);
  assert.deepEqual(calls.map(c => c.args), [{ p_input: identity }, { p_input: identity }]);
});
test('R71 ingest accepts only the two matching DB-owned admission times', async () => {
  const saved = pair(); saved.receipt.admittedAtMs = 100100; saved.receipt.nativeReceipt.admittedAtMs = 100100;
  const store = make(async (name, args) => {
    assert.equal(name, R71_DATABASE_RPCS.ingest); assert.deepEqual(args.p_input.record, fixture.record);
    return { data: { status: 'STORED', ...saved } }; });
  const result = await store.ingest(pair());
  assert.equal(result.receipt.admittedAtMs, 100100); assert.deepEqual(result.record, fixture.record);
  assert.ok(Object.isFrozen(result.receipt.nativeReceipt));
});
test('R71 retry preserves the first receipt and refuses unpaired receipt timestamps', async () => {
  const retry = pair(); retry.receipt.admittedAtMs = 100100; retry.receipt.nativeReceipt.admittedAtMs = 100100;
  const store = make(async () => ({ data: { status: 'ALREADY_STORED', ...pair() } }));
  assert.equal((await store.ingest(retry)).receipt.admittedAtMs, 100000);
  const broken = pair(); broken.receipt.admittedAtMs++;
  await assert.rejects(make(async () => ({ data: { status: 'STORED', ...broken } })).ingest(pair()), /R71_RECEIPT_BINDING/);
});
test('R71 ingest rejects a valid but substituted signed record and a foreign source', async () => {
  const other = await createR71ProtocolFixture({ nowMs: 100000, privateKeyPem: fixture.privateKeyPem,
    operationId: 'op:' + '72'.repeat(16) });
  await assert.rejects(make(async () => ({ data: { status: 'STORED', receipt: other.receipt, record: other.record } }))
    .ingest(pair()), /R71_DATABASE_RESPONSE_BINDING/);
  const source = await createR71ProtocolFixture({ nowMs: 100000, sourceId: 'source:' + '72'.repeat(8) });
  await assert.rejects(make(async () => { throw Error('must not call'); })
    .ingest({ receipt: source.receipt, record: source.record }), /R71_DATABASE_SCOPE/);
});
test('R71 immutable page requires exact ordinals, count, period and terminal cursor', async () => {
  const page = { snapshot, rows: [{ ordinal: 1, ...pair() }], nextOrdinal: null };
  const request = { snapshotId: snapshot.snapshotId, afterOrdinal: 0, limit: 10 };
  assert.deepEqual(await make(async () => ({ data: page })).readStudyPage(request), page);
  for (const change of [p => { p.rows[0].ordinal = 2; }, p => { p.rows = []; }, p => { p.nextOrdinal = 1; },
    p => { p.snapshot.period.endMs = 100000; }]) {
    const invalid = clone(page); change(invalid);
    await assert.rejects(make(async () => ({ data: invalid })).readStudyPage(request), /R71_DATABASE_PAGE_BINDING/);
  }
});
test('R71 freeze refuses altered period response and oversized page requests before RPC', async () => {
  await assert.rejects(make(async () => ({ data: snapshot })).freezeStudy({ operationId: 'op:' + '71'.repeat(16),
    period: { startMs: 0, endMs: 100001 } }), /R71_DATABASE_RESPONSE_BINDING/);
  await assert.rejects(make(async () => { throw Error('must not call'); }).readStudyPage({ snapshotId: snapshot.snapshotId,
    afterOrdinal: 0, limit: 11 }), /R71_DATABASE_PAGE_REQUEST/);
});
test('R71 state is deterministically reconstructed and a different source key is refused', async () => {
  assert.deepEqual(await make(async () => ({ data: stateRow })).readState(), stateRow);
  const forged = clone(stateRow); forged.state.promotions = 1;
  await assert.rejects(make(async () => ({ data: forged })).readState(), /R71_STATE_RECONSTRUCTION/);
  const other = createR71EvolutionState({ ...identity, sourceKeySha256: '72'.repeat(32), nowMs: 90000 });
  await assert.rejects(make(async () => ({ data: { ...stateRow, state: other } })).readState(), /R71_DATABASE_SCOPE/);
});
test('R71 append validates CAS form, actor and exact returned state', async () => {
  const input = { operationId: 'op:' + '71'.repeat(16), expectedRevision: -1, previousDigest: null, state, actorId: 'system:r71' };
  const store = make(async () => ({ data: { ...stateRow, replayed: false } }));
  assert.equal((await store.appendState(input)).replayed, false);
  await assert.rejects(store.appendState({ ...input, previousDigest: '71'.repeat(32) }), /R71_DATABASE_STATE_REQUEST/);
  await assert.rejects(store.appendState({ ...input, actorId: 'anonymous' }), /R71_DATABASE_STATE_REQUEST/);
  const changed = createR71EvolutionState({ ...identity, nowMs: 90001 });
  await assert.rejects(make(async () => ({ data: { ...stateRow, state: changed, replayed: false } })).appendState(input), /R71_DATABASE_RESPONSE_BINDING/);
});
test('R71 validation reads reject duplicates and cross-plan data', async () => {
  const planId = 'plan:' + '71'.repeat(8), decision = { action: 'manual_confirm', side: 'buy', mayClose: true };
  const row = { planId, caseId: 'case:' + '71'.repeat(8), eventId: fixture.record.annotation.eventId,
    recordDigest: fixture.receipt.recordDigest, capturedAtMs: 100000, admittedAtMs: 100001,
    nativeDecision: decision, effectiveDecision: decision };
  assert.deepEqual(await make(async () => ({ data: [row] })).readValidationCases({ planId }), [row]);
  await assert.rejects(make(async () => ({ data: [row, row] })).readValidationCases({ planId }), /R71_DATABASE_CASE_BINDING/);
  await assert.rejects(make(async () => ({ data: [row] })).readValidationCases({ planId: 'plan:' + '72'.repeat(8) }), /R71_DATABASE_CASE_BINDING/);
});
test('R71 overview is scoped and rejects extra raw feed fields and repeated operation revisions', async () => {
  const op = { operationId: 'op:' + '71'.repeat(16), revision: 0, actorId: 'system:r71',
    stateDigest: stateRow.stateDigest, storedAtMs: 90000, action: 'INITIALIZE' };
  const result = { ...identity, snapshots: [snapshot], operations: [op], state: stateRow };
  assert.deepEqual(await make(async () => ({ data: result })).readOverview({ limit: 1 }), result);
  await assert.rejects(make(async () => ({ data: { ...result, rawRecords: [fixture.record] } })).readOverview(), /R71_DATABASE_RESPONSE/);
  await assert.rejects(make(async () => ({ data: { ...result, operations: [op, op] } })).readOverview(), /R71_DATABASE_RESPONSE_BINDING/);
});
test('R71 DB errors keep only recognized closed error codes, never backend details', async () => {
  await assert.rejects(make(async () => { throw Error('private backend secret'); }).now(), /^Error: R71_DATABASE_UNAVAILABLE$/);
  await assert.rejects(make(async () => ({ error: { message: 'R71_DATABASE_STALE_STATE' } })).now(), /R71_DATABASE_STALE_STATE/);
  await assert.rejects(make(async () => ({ error: { message: 'R71_DATABASE_STALE_STATE private backend secret' } })).now(), /^Error: R71_DATABASE_UNAVAILABLE$/);
  await assert.rejects(make(async () => ({ data: { nowMs: null } })).now(), /R71_DATABASE_CLOCK/);
});
