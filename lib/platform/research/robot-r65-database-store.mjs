/** Dedicated Platform RPC adapter. Authorization pins scope/actor in the server.
 * No connection, provider request, order or physical retention operation is made.
 * SQL snapshots use a DB-owned digest; never confuse it with R64 canonical JSON.
 */
import { canonicalR64Json, inspectR64TelemetryReceipt } from './robot-r64-telemetry.mjs';
import { inspectR65EvolutionState } from './robot-r65-evolution-engine.mjs';
import { inspectR65StoredProvenance } from './robot-r65-observation-source.mjs';

export const R65_DATABASE_DIGEST_ALGORITHM = 'SHA256_POSTGRESQL_JSONB_TEXT_UTF8_V1';
export const R65_DATABASE_RPCS = Object.freeze({
  ingestObservation: 'jenios_robot_r65_ingest_observation',
  previewArchive: 'jenios_robot_r65_archive_preview',
  commitArchive: 'jenios_robot_r65_archive_commit',
  readArchive: 'jenios_robot_r65_read_archive',
  reconcileCost: 'jenios_robot_r65_reconcile_cost',
  readOverview: 'jenios_robot_r65_read_overview',
  readEvolution: 'jenios_robot_r65_read_evolution',
  appendEvolution: 'jenios_robot_r65_append_evolution',
  recordValidationCase: 'jenios_robot_r65_record_validation_case',
  readValidationCases: 'jenios_robot_r65_read_validation_cases',
  readCycleHypothesis: 'jenios_robot_r65_read_cycle_hypothesis',
});
export const R65_DATABASE_LIMITS = Object.freeze({ stateBytes: 1048576, archiveBytes: 16777216,
  archiveBatch: 10, overview: 30, validationCases: 200, revisions: 32 });
const SCOPE = /^scope:[a-f0-9]{16}$/;
const HEX = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const OP = /^op:[a-f0-9]{32}$/;
const PLAN = /^plan:[a-f0-9]{16}$/;
const CASE = /^case:[a-f0-9]{16}$/;
const EVENT = /^evt:[a-f0-9]{16}$/;
const RESPONSE = /^resp_[A-Za-z0-9_-]{1,160}$/;
const INTAKE_R64_ERRORS = new Set(['R64_DATABASE_RECEIPT', 'R64_DATABASE_RECEIPT_CONFLICT', 'R64_DATABASE_SEQUENCE_REPLAY']);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && Object.keys(value).every(k => keys.includes(k));
const frozen = value => { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; };
function snapshot(value, maximum = R65_DATABASE_LIMITS.stateBytes + 4096) {
  const encoded = canonicalR64Json(value);
  if (Buffer.byteLength(encoded, 'utf8') > maximum) fail('R65_DATABASE_INPUT_LIMIT');
  return JSON.parse(encoded);
}
function scope(value) { if (typeof value !== 'string' || !SCOPE.test(value)) fail('R65_DATABASE_SCOPE'); }
function actor(value, human = false) {
  if (!(typeof value === 'string' && value.startsWith('user:') && UUID.test(value.slice(5))) &&
      !(value === 'system:r65' && !human)) fail('R65_DATABASE_ACTOR');
}
function operation(value) { if (typeof value !== 'string' || !OP.test(value)) fail('R65_DATABASE_OPERATION'); }
function identity(value) { if (typeof value !== 'string' || !UUID.test(value)) fail('R65_DATABASE_IDENTITY'); }
function logical(value) {
  return value.archiveMode === 'LOGICAL_COPY_ONLY' && value.physicalDeletionPerformed === false && value.spaceReclaimedBytes === 0;
}
function activeVersion(value) {
  return exact(value, ['versionId', 'maxAgeMs', 'activatedAtMs', 'activationGeneration']) &&
    ['research:r65-v1', 'research:r65-v2'].includes(value.versionId) && [500, 750].includes(value.maxAgeMs) &&
    integer(value.activatedAtMs) && integer(value.activationGeneration, 0, 2);
}
function evolutionRow(value, ownerScope, append = false) {
  if (!exact(value, ['scopeId', 'revision', 'stateDigest', 'state', ...(append ? ['replayed'] : [])]) ||
      value.scopeId !== ownerScope || !integer(value.revision, 0, 32) || !HEX.test(value.stateDigest || '') ||
      append && typeof value.replayed !== 'boolean') fail('R65_DATABASE_RESPONSE');
  const state = inspectR65EvolutionState(value.state);
  if (state.scopeId !== ownerScope || state.revision !== value.revision) fail('R65_DATABASE_RESPONSE');
  if (Buffer.byteLength(canonicalR64Json(state), 'utf8') > R65_DATABASE_LIMITS.stateBytes) fail('R65_DATABASE_INPUT_LIMIT');
  return { ...value, state };
}
function validationCase(value, ownerScope) {
  if (!exact(value, ['caseId', 'scopeId', 'evidenceKind', 'occurredAtMs', 'snapshotAgesMs', 'expectedAllow']) ||
      !CASE.test(value.caseId || '') || value.scopeId !== ownerScope || value.evidenceKind !== 'SYNTHETIC_FIXTURE' ||
      !integer(value.occurredAtMs, 1) || typeof value.expectedAllow !== 'boolean' ||
      !Array.isArray(value.snapshotAgesMs) || value.snapshotAgesMs.length !== 2 ||
      value.snapshotAgesMs.some(n => !integer(n, 0, 60000))) fail('R65_DATABASE_RESPONSE');
  return value;
}

export function createR65DatabaseStore({ db } = {}) {
  if (!db || typeof db.rpc !== 'function') fail('R65_DATABASE_CLIENT_REQUIRED');
  async function rpc(method, args, { allowNull = false, maximum } = {}) {
    let response;
    try { response = await db.rpc(R65_DATABASE_RPCS[method], { p_input: snapshot(args) }); }
    catch { fail('R65_DATABASE_UNAVAILABLE'); }
    if (response?.error) {
      const code = typeof response.error.message === 'string' && response.error.message.match(/^(R65_[A-Z0-9_]{1,80})$/)?.[1];
      const intakeCode = method === 'ingestObservation' && INTAKE_R64_ERRORS.has(response.error.message) && response.error.message;
      fail(code || intakeCode || 'R65_DATABASE_UNAVAILABLE');
    }
    if (!response || !Object.hasOwn(response, 'data') || response.data === null && !allowNull) fail('R65_DATABASE_RESPONSE');
    if (response.data === null) return null;
    return snapshot(response.data, maximum);
  }
  return Object.freeze({
    async ingestObservation(args = {}) {
      const safe = snapshot(args);
      if (!exact(safe, ['receipt', 'provenance'])) fail('R65_DATABASE_PROVENANCE');
      safe.receipt = inspectR64TelemetryReceipt(safe.receipt);
      safe.provenance = inspectR65StoredProvenance(safe.provenance, safe.receipt);
      const data = await rpc('ingestObservation', safe);
      if (!exact(data, ['status', 'scopeId', 'eventId']) || !['STORED', 'ALREADY_STORED'].includes(data.status) ||
          data.scopeId !== safe.receipt.scopeId || data.eventId !== safe.receipt.eventId) fail('R65_DATABASE_RESPONSE');
      return frozen(data);
    },
    async previewArchive(args = {}) {
      const safe = snapshot(args); if (!Object.hasOwn(safe, 'limit')) safe.limit = 10;
      if (!exact(safe, ['scopeId', 'cutoffMs', 'limit']) || !integer(safe.cutoffMs) || !integer(safe.limit, 1, 10))
        fail('R65_DATABASE_ARCHIVE_REQUEST');
      scope(safe.scopeId);
      const data = await rpc('previewArchive', safe);
      if (!exact(data, ['scopeId', 'archiveId', 'status', 'manifestDigest', 'eventCount', 'cycleCount',
        'archiveMode', 'physicalDeletionPerformed', 'spaceReclaimedBytes', 'expiresAtMs']) || data.scopeId !== safe.scopeId ||
        !UUID.test(data.archiveId || '') || data.status !== 'PREVIEW' || !HEX.test(data.manifestDigest || '') ||
        !integer(data.eventCount, 0, safe.limit) || !integer(data.cycleCount, 0, safe.limit) ||
        data.eventCount + data.cycleCount === 0 || !integer(data.expiresAtMs, 1) || !logical(data)) fail('R65_DATABASE_RESPONSE');
      return frozen(data);
    },
    async commitArchive(args = {}) {
      const safe = snapshot(args);
      if (!exact(safe, ['scopeId', 'archiveId', 'operationId', 'manifestDigest', 'actorId']) || !HEX.test(safe.manifestDigest || ''))
        fail('R65_DATABASE_ARCHIVE_REQUEST');
      scope(safe.scopeId); identity(safe.archiveId); operation(safe.operationId); actor(safe.actorId);
      const data = await rpc('commitArchive', safe);
      if (!exact(data, ['scopeId', 'archiveId', 'status', 'manifestDigest', 'replayed', 'archiveMode', 'physicalDeletionPerformed', 'spaceReclaimedBytes']) ||
        data.scopeId !== safe.scopeId || data.archiveId !== safe.archiveId || data.status !== 'COMMITTED' ||
        data.manifestDigest !== safe.manifestDigest || typeof data.replayed !== 'boolean' || !logical(data)) fail('R65_DATABASE_RESPONSE');
      return frozen(data);
    },
    async readArchive(args = {}) {
      const safe = snapshot(args);
      if (!exact(safe, ['scopeId', 'archiveId'])) fail('R65_DATABASE_ARCHIVE_REQUEST');
      scope(safe.scopeId); identity(safe.archiveId);
      const data = await rpc('readArchive', safe, { allowNull: true, maximum: R65_DATABASE_LIMITS.archiveBytes + 4096 });
      if (data === null) return null;
      const manifest = data.manifest;
      if (!exact(data, ['scopeId', 'archiveId', 'status', 'manifestDigest', 'digestAlgorithm', 'verified', 'manifest']) ||
          data.scopeId !== safe.scopeId || data.archiveId !== safe.archiveId || data.status !== 'COMMITTED' ||
          !HEX.test(data.manifestDigest || '') || data.digestAlgorithm !== R65_DATABASE_DIGEST_ALGORITHM || data.verified !== true ||
          !exact(manifest, ['schema', 'scopeId', 'archiveMode', 'physicalDeletionPerformed', 'spaceReclaimedBytes', 'cutoffMs', 'cycles', 'events']) ||
          manifest.schema !== 'JENIOS_R65_LOGICAL_ARCHIVE_V1' || manifest.scopeId !== safe.scopeId || !logical(manifest) || !integer(manifest.cutoffMs) ||
          !Array.isArray(manifest.cycles) || manifest.cycles.length > 10 || !Array.isArray(manifest.events) || manifest.events.length > 10 ||
          manifest.cycles.length + manifest.events.length === 0) fail('R65_DATABASE_RESPONSE');
      if (manifest.cycles.some(row => !exact(row, ['cycleId', 'snapshot', 'reconciliation']) || !UUID.test(row.cycleId || '') ||
          !record(row.snapshot) || row.snapshot.scope_id !== safe.scopeId || row.snapshot.cycle_id !== row.cycleId ||
          row.reconciliation !== null && (!record(row.reconciliation) || row.reconciliation.scope_id !== safe.scopeId || row.reconciliation.cycle_id !== row.cycleId)) ||
          manifest.events.some(row => !exact(row, ['eventId', 'snapshot', 'provenance']) || !EVENT.test(row.eventId || '') ||
            !record(row.snapshot) || row.snapshot.scope_id !== safe.scopeId || row.snapshot.event_id !== row.eventId ||
            row.provenance !== null && (!record(row.provenance) || row.provenance.eventId !== row.eventId ||
              row.provenance.payloadDigest !== row.snapshot.payload_digest)) ||
          new Set(manifest.cycles.map(row => row.cycleId)).size !== manifest.cycles.length ||
          new Set(manifest.events.map(row => row.eventId)).size !== manifest.events.length) fail('R65_DATABASE_RESPONSE');
      for (const row of manifest.events) if (row.provenance !== null)
        inspectR65StoredProvenance(row.provenance, row.snapshot.receipt);
      return frozen(data);
    },
    async reconcileCost(args = {}) {
      const safe = snapshot(args);
      if (!exact(safe, ['scopeId', 'cycleId', 'operationId', 'expectedFingerprint', 'resolution', 'evidenceDigest', 'actorId']) ||
          !HEX.test(safe.expectedFingerprint || '') || !HEX.test(safe.evidenceDigest || '') ||
          !exact(safe.resolution, ['kind', 'costNanoUsd', 'providerResponseId'])) fail('R65_DATABASE_RECONCILIATION');
      scope(safe.scopeId); identity(safe.cycleId); operation(safe.operationId); actor(safe.actorId, true);
      const r = safe.resolution;
      if (!integer(r.costNanoUsd) || !(r.kind === 'CONFIRMED_USAGE' && RESPONSE.test(r.providerResponseId || '') ||
        r.kind === 'CONFIRMED_NO_CHARGE' && r.costNanoUsd === 0 && r.providerResponseId === null)) fail('R65_DATABASE_RECONCILIATION');
      const data = await rpc('reconcileCost', safe);
      if (!exact(data, ['status', 'cycleId', 'scopeId', 'replayed', 'resolutionKind', 'costNanoUsd', 'overReservation', 'generationEnabled']) ||
          data.status !== 'RECONCILED' || data.cycleId !== safe.cycleId || data.scopeId !== safe.scopeId || typeof data.replayed !== 'boolean' ||
          data.resolutionKind !== r.kind || data.costNanoUsd !== r.costNanoUsd || typeof data.overReservation !== 'boolean' ||
          data.generationEnabled !== false) fail('R65_DATABASE_RESPONSE');
      return frozen(data);
    },
    async readOverview(args = {}) {
      const safe = snapshot(args); if (!Object.hasOwn(safe, 'limit')) safe.limit = 30;
      if (!exact(safe, ['scopeId', 'limit']) || !integer(safe.limit, 1, 30)) fail('R65_DATABASE_OVERVIEW_LIMIT');
      scope(safe.scopeId);
      const data = await rpc('readOverview', safe);
      if (!exact(data, ['scopeId', 'archiveMode', 'physicalDeletionPerformed', 'spaceReclaimedBytes', 'archives',
        'reconciliations', 'pendingReconciliations', 'evolution']) || data.scopeId !== safe.scopeId || !logical(data) ||
        !['archives', 'reconciliations', 'pendingReconciliations'].every(key => Array.isArray(data[key]) && data[key].length <= safe.limit))
        fail('R65_DATABASE_RESPONSE');
      if (data.archives.some(row => !exact(row, ['archiveId', 'status', 'manifestDigest', 'eventCount', 'cycleCount', 'createdAtMs']) ||
        !UUID.test(row.archiveId || '') || !['PREVIEW', 'COMMITTED'].includes(row.status) || !HEX.test(row.manifestDigest || '') ||
        !integer(row.eventCount, 0, 10) || !integer(row.cycleCount, 0, 10) || !integer(row.createdAtMs, 1)) ||
        data.reconciliations.some(row => !exact(row, ['cycleId', 'resolutionKind', 'costNanoUsd', 'resolvedAtMs', 'overReservation']) ||
          !UUID.test(row.cycleId || '') || !['CONFIRMED_USAGE', 'CONFIRMED_NO_CHARGE'].includes(row.resolutionKind) ||
          !integer(row.costNanoUsd) || !integer(row.resolvedAtMs, 1) || typeof row.overReservation !== 'boolean') ||
        data.pendingReconciliations.some(row => !exact(row, ['cycleId', 'requestFingerprint', 'reservationNanoUsd']) ||
          !UUID.test(row.cycleId || '') || !HEX.test(row.requestFingerprint || '') || !integer(row.reservationNanoUsd, 1, 1000000000)))
        fail('R65_DATABASE_RESPONSE');
      for (const [key, id] of [['archives', 'archiveId'], ['reconciliations', 'cycleId'], ['pendingReconciliations', 'cycleId']])
        if (new Set(data[key].map(row => row[id])).size !== data[key].length) fail('R65_DATABASE_RESPONSE');
      if (data.pendingReconciliations.some(row => data.reconciliations.some(r => r.cycleId === row.cycleId))) fail('R65_DATABASE_RESPONSE');
      if (data.evolution !== null && (!exact(data.evolution, ['revision', 'stateDigest', 'activeVersion']) ||
        !integer(data.evolution.revision, 0, 32) || !HEX.test(data.evolution.stateDigest || '') || !activeVersion(data.evolution.activeVersion)))
        fail('R65_DATABASE_RESPONSE');
      return frozen(data);
    },
    async readEvolution(args = {}) {
      const safe = snapshot(args);
      if (!exact(safe, ['scopeId'])) fail('R65_DATABASE_SCOPE'); scope(safe.scopeId);
      const data = await rpc('readEvolution', safe, { allowNull: true });
      return data === null ? null : frozen(evolutionRow(data, safe.scopeId));
    },
    async appendEvolution(args = {}) {
      const safe = snapshot(args);
      if (!exact(safe, ['scopeId', 'operationId', 'expectedRevision', 'previousDigest', 'state', 'actorId']) ||
          !integer(safe.expectedRevision, -1, 31) || !(safe.expectedRevision === -1 ? safe.previousDigest === null : HEX.test(safe.previousDigest || '')))
        fail('R65_DATABASE_STATE_DIGEST');
      scope(safe.scopeId); operation(safe.operationId); actor(safe.actorId);
      safe.state = inspectR65EvolutionState(safe.state);
      if (safe.state.scopeId !== safe.scopeId || safe.state.revision !== safe.expectedRevision + 1 ||
          Buffer.byteLength(canonicalR64Json(safe.state), 'utf8') > R65_DATABASE_LIMITS.stateBytes) fail('R65_DATABASE_EVOLUTION_STATE');
      const data = evolutionRow(await rpc('appendEvolution', safe), safe.scopeId, true);
      if (data.revision !== safe.state.revision || canonicalR64Json(data.state) !== canonicalR64Json(safe.state)) fail('R65_DATABASE_RESPONSE');
      return frozen(data);
    },
    async recordValidationCase(args = {}) {
      const safe = snapshot(args);
      if (!exact(safe, ['scopeId', 'planId', 'caseId', 'baselineAllow', 'candidateAllow']) ||
        !PLAN.test(safe.planId || '') || !CASE.test(safe.caseId || '') || typeof safe.baselineAllow !== 'boolean' || typeof safe.candidateAllow !== 'boolean')
        fail('R65_DATABASE_VALIDATION_CASE');
      scope(safe.scopeId);
      const data = await rpc('recordValidationCase', safe);
      if (!exact(data, ['status', 'case']) || !['STORED', 'ALREADY_STORED'].includes(data.status) ||
          validationCase(data.case, safe.scopeId).caseId !== safe.caseId) fail('R65_DATABASE_RESPONSE');
      return frozen(data);
    },
    async readValidationCases(args = {}) {
      const safe = snapshot(args);
      if (!exact(safe, ['scopeId', 'planId']) || !PLAN.test(safe.planId || '')) fail('R65_DATABASE_VALIDATION_PLAN');
      scope(safe.scopeId);
      const data = await rpc('readValidationCases', safe);
      if (!Array.isArray(data) || data.length > 200 || new Set(data.map(row => row?.caseId)).size !== data.length)
        fail('R65_DATABASE_RESPONSE');
      data.forEach(row => validationCase(row, safe.scopeId));
      return frozen(data);
    },
    async readCycleHypothesis(args = {}) {
      const safe = snapshot(args);
      if (!exact(safe, ['scopeId', 'cycleId'])) fail('R65_DATABASE_HYPOTHESIS');
      scope(safe.scopeId); identity(safe.cycleId);
      const data = await rpc('readCycleHypothesis', safe, { allowNull: true });
      if (data === null) return null;
      if (!exact(data, ['cycleId', 'analysisDigest', 'proposals']) || data.cycleId !== safe.cycleId ||
          !HEX.test(data.analysisDigest || '') || !Array.isArray(data.proposals) || data.proposals.length > 1 ||
          data.proposals.some(p => !exact(p, ['kind', 'maxAgeMs', 'evidenceEventIds', 'assessment']) ||
            p.kind !== 'TIGHTEN_MARKET_FRESHNESS' || p.maxAgeMs !== 500 || p.assessment !== 'HYPOTHESIS_REQUIRES_INDEPENDENT_VALIDATION' ||
            !Array.isArray(p.evidenceEventIds) || p.evidenceEventIds.length < 1 || p.evidenceEventIds.length > 48 ||
            p.evidenceEventIds.some(id => !EVENT.test(id)) || new Set(p.evidenceEventIds).size !== p.evidenceEventIds.length))
        fail('R65_DATABASE_RESPONSE');
      return frozen(data);
    },
  });
}
