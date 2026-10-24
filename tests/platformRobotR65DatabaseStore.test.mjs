import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createR65DatabaseStore, R65_DATABASE_RPCS, R65_DATABASE_DIGEST_ALGORITHM } from '../lib/platform/research/robot-r65-database-store.mjs';
import { createR65EvolutionState } from '../lib/platform/research/robot-r65-evolution-engine.mjs';
import { createR65ObservationSource, verifyR65ObservationRecord } from '../lib/platform/research/robot-r65-observation-source.mjs';

const scopeId = 'scope:0000000000000065', foreignScope = 'scope:ffffffffffffffff';
const cycleId = '65000000-0000-4000-8000-000000000001';
const archiveId = '65000000-0000-4000-8000-000000000002';
const actorId = 'user:65000000-0000-4000-8000-000000000003';
const operationId = 'op:' + '1'.repeat(32), digest = 'a'.repeat(64);
const logical = { archiveMode: 'LOGICAL_COPY_ONLY', physicalDeletionPerformed: false, spaceReclaimedBytes: 0 };
const resolution = { kind: 'CONFIRMED_NO_CHARGE', costNanoUsd: 0, providerResponseId: null };
const reconcile = () => ({ scopeId, cycleId, actorId, operationId, resolution,
  expectedFingerprint: digest, evidenceDigest: 'b'.repeat(64) });
const state = createR65EvolutionState({ scopeId, nowMs: 1000 });
const stateRow = () => ({ scopeId, revision: 0, stateDigest: digest, state });
const append = () => ({ scopeId, operationId, expectedRevision: -1, previousDigest: null, state, actorId: 'system:r65' });
const planId = 'plan:' + '1'.repeat(16), caseId = 'case:' + '1'.repeat(16);
const validation = () => ({ scopeId, caseId, evidenceKind: 'SYNTHETIC_FIXTURE', occurredAtMs: 2000,
  snapshotAgesMs: [650, 650], expectedAllow: false });
function fake(responder) {
  const calls = [];
  const store = createR65DatabaseStore({ db: { rpc: async (name, args) => {
    calls.push({ name, args }); return { data: await responder(name, args.p_input), error: null };
  } } });
  return { store, calls };
}

test('R65 requires only an injected RPC client and exposes eleven named bounded operations', () => {
  assert.throws(() => createR65DatabaseStore(), /R65_DATABASE_CLIENT_REQUIRED/);
  assert.equal(Object.keys(R65_DATABASE_RPCS).length, 11);
  assert.equal(R65_DATABASE_DIGEST_ALGORITHM, 'SHA256_POSTGRESQL_JSONB_TEXT_UTF8_V1');
});

test('R65 refuses getters without invoking user code or starting an RPC', async () => {
  let reads = 0; const f = fake(() => null);
  await assert.rejects(f.store.readEvolution({ get scopeId() { reads++; return scopeId; } }), /R64_CANONICAL/);
  assert.equal(reads, 0); assert.equal(f.calls.length, 0);
});

function observation() {
  const { privateKey } = generateKeyPairSync('ed25519');
  const sessionId = 'session:0000000000000065';
  const source = createR65ObservationSource({ enabled: true, domain: 'R61_SYNTHETIC_RUNTIME', scopeId,
    sourceId: 'source:0000000000000065', sessionId, privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }),
    getActiveState: () => state, initialSequence: 1, now: () => 2000,
    ultraConfig: { evidenceKind: 'SYNTHETIC_FIXTURE', sessionId, planCode: 'platform-global-crypto',
      symbol: 'BTC-USD', capital: 1000, leverage: 2 } });
  const record = source.captureUltra({ operationId, event: { type: 'snapshot', scenario: 'normal', marketAgeMs: 900 } });
  const admitted = verifyR65ObservationRecord(record, { trustedSource: source.trustedSource, nowMs: 2000 });
  return { receipt: admitted.receipt, provenance: admitted.provenance };
}

test('R65 observation ingestion sends only a verified-bound receipt and synthetic provenance to one RPC', async () => {
  const args = observation();
  const f = fake(() => ({ status: 'STORED', scopeId, eventId: args.receipt.eventId }));
  assert.equal((await f.store.ingestObservation(args)).status, 'STORED');
  assert.equal(f.calls[0].name, R65_DATABASE_RPCS.ingestObservation);
  assert.deepEqual(f.calls[0].args.p_input, args);
});

test('R65 observation ingestion rejects source escalation and mismatched sidecars before RPC', async () => {
  const args = observation(), f = fake(() => null);
  for (const patch of [{ origin: 'OPERATIONAL' }, { payloadDigest: 'f'.repeat(64) },
    { policyVersion: 'research:r65-v2' }, { executionAllowed: true }])
    await assert.rejects(f.store.ingestObservation({ ...args, provenance: { ...args.provenance, ...patch } }), /R65_/);
  assert.equal(f.calls.length, 0);
});

test('R65 reconciliation rejects system actors, invented evidence and unknown outcomes before RPC', async () => {
  const f = fake(() => null);
  await assert.rejects(f.store.reconcileCost({ ...reconcile(), actorId: 'system:r65' }), /R65_DATABASE_ACTOR/);
  await assert.rejects(f.store.reconcileCost({ ...reconcile(), evidenceDigest: '' }), /R65_DATABASE_RECONCILIATION/);
  await assert.rejects(f.store.reconcileCost({ ...reconcile(), resolution: { ...resolution, kind: 'UNKNOWN' } }), /R65_DATABASE_RECONCILIATION/);
  await assert.rejects(f.store.reconcileCost({ ...reconcile(), resolution: { ...resolution, costNanoUsd: 1 } }), /R65_DATABASE_RECONCILIATION/);
  assert.equal(f.calls.length, 0);
});

test('R65 accepts confirmed costs above a reservation without hiding the incident', async () => {
  const args = { ...reconcile(), resolution: { kind: 'CONFIRMED_USAGE', costNanoUsd: 2000000, providerResponseId: 'resp_confirmed_65' } };
  const f = fake(() => ({ status: 'RECONCILED', scopeId, cycleId, replayed: false,
    resolutionKind: 'CONFIRMED_USAGE', costNanoUsd: 2000000, overReservation: true, generationEnabled: false }));
  const result = await f.store.reconcileCost(args);
  assert.equal(result.overReservation, true); assert.equal(result.costNanoUsd, 2000000);
  assert.equal(f.calls[0].name, R65_DATABASE_RPCS.reconcileCost);
  assert.deepEqual(f.calls[0].args.p_input, args);
});

test('R65 rejects reconciliation response that re-enables generation or changes scope', async () => {
  const base = { status: 'RECONCILED', scopeId, cycleId, replayed: false, resolutionKind: resolution.kind,
    costNanoUsd: 0, overReservation: false, generationEnabled: false };
  for (const patch of [{ generationEnabled: true }, { scopeId: foreignScope }, { costNanoUsd: 5 }]) {
    await assert.rejects(fake(() => ({ ...base, ...patch })).store.reconcileCost(reconcile()), /R65_DATABASE_RESPONSE/);
  }
});

test('R65 archive preview and commit preserve the explicit logical-copy contract', async () => {
  const preview = { scopeId, archiveId, status: 'PREVIEW', manifestDigest: digest, eventCount: 2, cycleCount: 1,
    expiresAtMs: 10000, ...logical };
  const f = fake(name => name === R65_DATABASE_RPCS.previewArchive ? preview :
    { scopeId, archiveId, status: 'COMMITTED', manifestDigest: digest, replayed: false, ...logical });
  assert.equal((await f.store.previewArchive({ scopeId, cutoffMs: 2000 })).spaceReclaimedBytes, 0);
  assert.equal(f.calls[0].args.p_input.limit, 10);
  assert.equal((await f.store.commitArchive({ scopeId, archiveId, operationId, actorId, manifestDigest: digest })).status, 'COMMITTED');
  assert.equal(f.calls.length, 2);
});

test('R65 cannot claim purging or reclaimed space in an archive response', async () => {
  const base = { scopeId, archiveId, status: 'PREVIEW', manifestDigest: digest, eventCount: 1, cycleCount: 0,
    expiresAtMs: 10000, ...logical };
  for (const patch of [{ physicalDeletionPerformed: true }, { spaceReclaimedBytes: 500 }, { archiveMode: 'PURGED' }])
    await assert.rejects(fake(() => ({ ...base, ...patch })).store.previewArchive({ scopeId, cutoffMs: 2000 }), /R65_DATABASE_RESPONSE/);
});

test('R65 archive requests reject excessive batches, additional fields and divergent manifest acknowledgements', async () => {
  const f = fake(() => ({ scopeId, archiveId, status: 'COMMITTED', manifestDigest: 'f'.repeat(64), replayed: false, ...logical }));
  await assert.rejects(f.store.previewArchive({ scopeId, cutoffMs: 2000, limit: 11 }), /R65_DATABASE_ARCHIVE_REQUEST/);
  await assert.rejects(f.store.previewArchive({ scopeId, cutoffMs: 2000, purge: true }), /R65_DATABASE_ARCHIVE_REQUEST/);
  await assert.rejects(f.store.commitArchive({ scopeId, archiveId, operationId, actorId, manifestDigest: digest }), /R65_DATABASE_RESPONSE/);
  assert.equal(f.calls.length, 1);
});

test('R65 archive reads validate scope, item identity and the declared verification algorithm', async () => {
  const row = { scopeId, archiveId, status: 'COMMITTED', manifestDigest: digest,
    digestAlgorithm: R65_DATABASE_DIGEST_ALGORITHM, verified: true,
    manifest: { schema: 'JENIOS_R65_LOGICAL_ARCHIVE_V1', scopeId, ...logical, cutoffMs: 2000,
      cycles: [{ cycleId, snapshot: { cycle_id: cycleId, scope_id: scopeId }, reconciliation: null }], events: [] } };
  const f = fake(() => row); assert.equal((await f.store.readArchive({ scopeId, archiveId })).verified, true);
  assert.equal(await fake(() => null).store.readArchive({ scopeId, archiveId }), null);
  const other = structuredClone(row); other.manifest.cycles[0].snapshot.scope_id = foreignScope;
  await assert.rejects(fake(() => other).store.readArchive({ scopeId, archiveId }), /R65_DATABASE_RESPONSE/);
  await assert.rejects(fake(() => ({ ...row, verified: false })).store.readArchive({ scopeId, archiveId }), /R65_DATABASE_RESPONSE/);
});

test('R65 state reads replay the engine and reject forged active configurations', async () => {
  assert.deepEqual((await fake(() => stateRow()).store.readEvolution({ scopeId })).state, state);
  assert.equal(await fake(() => null).store.readEvolution({ scopeId }), null);
  const forged = stateRow(); forged.state = structuredClone(state); forged.state.activeVersion.maxAgeMs = 500;
  await assert.rejects(fake(() => forged).store.readEvolution({ scopeId }), /R65_EVOLUTION_REPLAY_MISMATCH/);
  await assert.rejects(fake(() => ({ ...stateRow(), scopeId: foreignScope })).store.readEvolution({ scopeId }), /R65_DATABASE_RESPONSE/);
});

test('R65 appends require the initial revision and exact state acknowledgement', async () => {
  const f = fake(() => ({ ...stateRow(), replayed: false }));
  assert.equal((await f.store.appendEvolution(append())).revision, 0);
  await assert.rejects(f.store.appendEvolution({ ...append(), previousDigest: digest }), /R65_DATABASE_STATE_DIGEST/);
  await assert.rejects(f.store.appendEvolution({ ...append(), expectedRevision: 0, previousDigest: digest }), /R65_DATABASE_EVOLUTION_STATE/);
  await assert.rejects(f.store.appendEvolution({ ...append(), scopeId: foreignScope }), /R65_DATABASE_EVOLUTION_STATE/);
  assert.equal(f.calls.length, 1);
});

test('R65 propagates typed CAS and archival errors but sanitizes database error text', async () => {
  for (const [message, expected] of [['R65_DATABASE_REVISION_CONFLICT', /R65_DATABASE_REVISION_CONFLICT/],
    ['password or provider payload leaked', /R65_DATABASE_UNAVAILABLE/]]) {
    const store = createR65DatabaseStore({ db: { rpc: async () => ({ data: null, error: { message } }) } });
    await assert.rejects(store.appendEvolution(append()), expected);
  }
  const throwing = createR65DatabaseStore({ db: { rpc: async () => { throw Error('secret'); } } });
  await assert.rejects(throwing.readEvolution({ scopeId }), /R65_DATABASE_UNAVAILABLE/);
});

test('R65 validation capture sends decisions but cannot submit its own timestamp or case definition', async () => {
  const f = fake(() => ({ status: 'STORED', case: validation() }));
  const args = { scopeId, planId, caseId, baselineAllow: true, candidateAllow: false };
  assert.deepEqual((await f.store.recordValidationCase(args)).case, validation());
  await assert.rejects(f.store.recordValidationCase({ ...args, occurredAtMs: 1 }), /R65_DATABASE_VALIDATION_CASE/);
  await assert.rejects(f.store.recordValidationCase({ ...args, expectedAllow: true }), /R65_DATABASE_VALIDATION_CASE/);
  assert.equal(f.calls.length, 1);
});

test('R65 reads only scoped synthetic validation evidence and rejects duplicate cases', async () => {
  assert.deepEqual(await fake(() => [validation()]).store.readValidationCases({ scopeId, planId }), [validation()]);
  for (const rows of [[validation(), validation()], [{ ...validation(), scopeId: foreignScope }],
    [{ ...validation(), evidenceKind: 'SIGNED_QA_REPLAY' }], [{ ...validation(), baselineAllow: true }]])
    await assert.rejects(fake(() => rows).store.readValidationCases({ scopeId, planId }), /R65_DATABASE_RESPONSE/);
});

test('R65 overview cannot leak raw provider results or mark one cycle resolved and pending', async () => {
  const overview = { scopeId, ...logical, archives: [], reconciliations: [], pendingReconciliations: [], evolution: null };
  assert.deepEqual(await fake(() => overview).store.readOverview({ scopeId }), overview);
  await assert.rejects(fake(() => ({ ...overview, result: { secret: true } })).store.readOverview({ scopeId }), /R65_DATABASE_RESPONSE/);
  const duplicate = { ...overview, reconciliations: [{ cycleId, resolutionKind: resolution.kind,
    costNanoUsd: 0, resolvedAtMs: 1000, overReservation: false }],
    pendingReconciliations: [{ cycleId, requestFingerprint: digest, reservationNanoUsd: 1350000 }] };
  await assert.rejects(fake(() => duplicate).store.readOverview({ scopeId }), /R65_DATABASE_RESPONSE/);
});

test('R65 hypothesis lookup returns only bounded independent-validation proposals', async () => {
  const proposal = { kind: 'TIGHTEN_MARKET_FRESHNESS', maxAgeMs: 500,
    evidenceEventIds: ['evt:0000000000000001', 'evt:0000000000000002', 'evt:0000000000000003'],
    assessment: 'HYPOTHESIS_REQUIRES_INDEPENDENT_VALIDATION' };
  const base = { cycleId, analysisDigest: digest, proposals: [proposal] };
  assert.deepEqual(await fake(() => base).store.readCycleHypothesis({ scopeId, cycleId }), base);
  assert.equal(await fake(() => null).store.readCycleHypothesis({ scopeId, cycleId }), null);
  for (const bad of [{ ...base, prompt: 'not allowed' }, { ...base, proposals: [{ ...proposal, maxAgeMs: 250 }] },
    { ...base, proposals: [{ ...proposal, assessment: 'PROMOTE_NOW' }] },
    { ...base, proposals: [{ ...proposal, evidenceEventIds: ['invalid'] }] }])
    await assert.rejects(fake(() => bad).store.readCycleHypothesis({ scopeId, cycleId }), /R65_DATABASE_RESPONSE/);
});

test('R65 returned state is deeply immutable and isolated from transport objects', async () => {
  const source = structuredClone(stateRow()); const row = await fake(() => source).store.readEvolution({ scopeId });
  source.state.activeVersion.maxAgeMs = 250;
  assert.equal(row.state.activeVersion.maxAgeMs, 750);
  assert.throws(() => { row.state.activeVersion.maxAgeMs = 250; }, TypeError);
});
