/** Source-bound RPC adapter for the separate R71 contextual policy history.
 * It never mutates a prior R67 record. Application signature verification is
 * performed by intake before ingest; the stored inspector verifies historical
 * structure and bindings. PostgreSQL owns admission time, MVCC membership and
 * its explicitly distinct JSONB state digest. No hosted database is activated.
 */
import { canonicalR71Json, copyR71, sameR71, fieldsR71, freezeR71, R71_LIMITS } from './robot-r71-policy.mjs';
import { inspectR71StoredObservation } from './robot-r71-private-protocol.mjs';
import { inspectR71Snapshot, inspectR71Decision } from './robot-r71-private-study.mjs';
import { inspectR71EvolutionState } from './robot-r71-evolution-engine.mjs';

export const R71_DATABASE_RPCS = Object.freeze({ now: 'jenios_robot_r71_now',
  ingest: 'jenios_robot_r71_ingest_private_observation', freezeStudy: 'jenios_robot_r71_freeze_study',
  readStudyPage: 'jenios_robot_r71_read_study_page', readState: 'jenios_robot_r71_read_state',
  appendState: 'jenios_robot_r71_append_state', readValidationCases: 'jenios_robot_r71_read_validation_cases',
  readOverview: 'jenios_robot_r71_read_overview' });
export const R71_DATABASE_DIGEST_ALGORITHM = 'SHA256_POSTGRESQL_JSONB_TEXT_UTF8_V1';
const fail = code => { throw Object.assign(Error(code), { code }); };
const exact = (v, keys, code = 'R71_DATABASE_RESPONSE') => fieldsR71(v, keys, keys, code);
const SHA = /^[a-f0-9]{64}$/, OP = /^op:[a-f0-9]{32}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= min && n <= max;
const actor = value => value === 'system:r71' || typeof value === 'string' && /^user:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);

export function createR71DatabaseStore(input = {}) {
  const c = exact(input, ['db', 'scopeId', 'sourceId', 'sourceKeySha256'], 'R71_DATABASE_CONFIG');
  if (!c.db || typeof c.db.rpc !== 'function') fail('R71_DATABASE_CLIENT_REQUIRED');
  if (!/^scope:[a-f0-9]{16}$/.test(c.scopeId || '') || !/^source:[a-f0-9]{16}$/.test(c.sourceId || '') ||
      !SHA.test(c.sourceKeySha256 || '')) fail('R71_DATABASE_SCOPE_REQUIRED');
  const identity = { scopeId: c.scopeId, sourceId: c.sourceId, sourceKeySha256: c.sourceKeySha256 };
  function scoped(value) {
    if (value.scopeId !== identity.scopeId || value.sourceId !== identity.sourceId ||
        value.sourceKeySha256 !== identity.sourceKeySha256) fail('R71_DATABASE_SCOPE');
    return value;
  }
  function observation(value) {
    const checked = inspectR71StoredObservation(copyR71(value));
    scoped({ ...checked.receipt.nativeReceipt, sourceKeySha256: checked.receipt.sourceKeySha256 });
    return checked;
  }
  function stateRow(value, append = false) {
    const row = exact(copyR71(value), ['scopeId', 'sourceId', 'revision', 'stateDigest', 'state', ...(append ? ['replayed'] : [])]);
    const state = scoped(inspectR71EvolutionState(row.state));
    if (row.scopeId !== identity.scopeId || row.sourceId !== identity.sourceId || row.revision !== state.revision ||
        !SHA.test(row.stateDigest || '') || (append && typeof row.replayed !== 'boolean')) fail('R71_DATABASE_STATE_BINDING');
    return freezeR71({ ...row, state });
  }
  const snapshot = value => scoped(inspectR71Snapshot(value));
  async function rpc(method, input = {}) {
    let response;
    const p_input = copyR71({ ...identity, ...input });
    try { response = await c.db.rpc(R71_DATABASE_RPCS[method], { p_input }); }
    catch { fail('R71_DATABASE_UNAVAILABLE'); }
    if (response?.error) {
      const code = typeof response.error.message === 'string' && response.error.message.match(/^(R(?:67|71)_DATABASE_[A-Z0-9_]{1,64})$/)?.[1];
      fail(code || 'R71_DATABASE_UNAVAILABLE');
    }
    if (!response || !Object.hasOwn(response, 'data') || response.data === undefined) fail('R71_DATABASE_RESPONSE');
    if (response.data === null) {
      if (method === 'readState') return null;
      fail('R71_DATABASE_RESPONSE');
    }
    return copyR71(response.data);
  }
  return Object.freeze({
    async now() {
      const value = exact(await rpc('now'), ['nowMs']);
      if (!integer(value.nowMs, 1)) fail('R71_DATABASE_CLOCK');
      return freezeR71(value);
    },
    async ingest(input) {
      const safe = observation(input), raw = exact(await rpc('ingest', safe), ['status', 'receipt', 'record']);
      if (!['STORED', 'ALREADY_STORED'].includes(raw.status)) fail('R71_DATABASE_RESPONSE');
      const saved = observation({ receipt: raw.receipt, record: raw.record });
      const withoutTime = rawReceipt => {
        const { admittedAtMs, nativeReceipt, ...rest } = rawReceipt;
        const { admittedAtMs: nativeTime, ...nativeRest } = nativeReceipt;
        return { ...rest, nativeReceipt: nativeRest };
      };
      if (!sameR71(saved.record, safe.record) || !sameR71(withoutTime(saved.receipt), withoutTime(safe.receipt)))
        fail('R71_DATABASE_RESPONSE_BINDING');
      return freezeR71({ status: raw.status, ...saved });
    },
    async freezeStudy(input) {
      const value = exact(copyR71(input), ['operationId', 'period'], 'R71_DATABASE_SNAPSHOT_REQUEST');
      exact(value.period, ['startMs', 'endMs'], 'R71_DATABASE_SNAPSHOT_REQUEST');
      if (!OP.test(value.operationId || '') || !integer(value.period.startMs) || !integer(value.period.endMs, value.period.startMs + 1))
        fail('R71_DATABASE_SNAPSHOT_REQUEST');
      const saved = snapshot(await rpc('freezeStudy', value));
      if (!sameR71(saved.period, value.period)) fail('R71_DATABASE_RESPONSE_BINDING');
      return saved;
    },
    async readStudyPage(input) {
      const value = exact(copyR71(input), ['snapshotId', 'afterOrdinal', 'limit'], 'R71_DATABASE_PAGE_REQUEST');
      if (!UUID.test(value.snapshotId || '') || !integer(value.afterOrdinal, 0, R71_LIMITS.snapshotRecords) ||
          !integer(value.limit, 1, R71_LIMITS.pageSize)) fail('R71_DATABASE_PAGE_REQUEST');
      const page = exact(await rpc('readStudyPage', value), ['snapshot', 'rows', 'nextOrdinal']);
      const header = snapshot(page.snapshot);
      if (header.snapshotId !== value.snapshotId || value.afterOrdinal > header.totalRecords || !Array.isArray(page.rows) ||
          page.rows.length !== Math.min(value.limit, header.totalRecords - value.afterOrdinal)) fail('R71_DATABASE_PAGE_BINDING');
      const events = new Set();
      const rows = page.rows.map((raw, index) => {
        const row = exact(raw, ['ordinal', 'receipt', 'record']);
        const saved = observation({ receipt: row.receipt, record: row.record }), a = saved.record.annotation;
        if (row.ordinal !== value.afterOrdinal + index + 1 || events.has(a.eventId) || a.capturedAtMs < header.period.startMs ||
            a.capturedAtMs >= header.period.endMs) fail('R71_DATABASE_PAGE_BINDING');
        events.add(a.eventId);
        return { ordinal: row.ordinal, ...saved };
      });
      const lastOrdinal = value.afterOrdinal + rows.length;
      if (page.nextOrdinal !== (lastOrdinal < header.totalRecords ? lastOrdinal : null)) fail('R71_DATABASE_PAGE_BINDING');
      return freezeR71({ snapshot: header, rows, nextOrdinal: page.nextOrdinal });
    },
    async readState() {
      const value = await rpc('readState');
      return value === null ? null : stateRow(value);
    },
    async appendState(input) {
      const value = exact(copyR71(input), ['operationId', 'expectedRevision', 'previousDigest', 'state', 'actorId'], 'R71_DATABASE_STATE_REQUEST');
      const state = scoped(inspectR71EvolutionState(value.state));
      if (!OP.test(value.operationId || '') || !integer(value.expectedRevision, -1, R71_LIMITS.revisions - 2) ||
          (value.expectedRevision === -1 ? value.previousDigest !== null : !SHA.test(value.previousDigest || '')) ||
          state.revision !== value.expectedRevision + 1 || !actor(value.actorId)) fail('R71_DATABASE_STATE_REQUEST');
      const row = stateRow(await rpc('appendState', value), true);
      if (!sameR71(row.state, state)) fail('R71_DATABASE_RESPONSE_BINDING');
      return row;
    },
    async readValidationCases(input) {
      const value = exact(copyR71(input), ['planId'], 'R71_DATABASE_CASE_REQUEST');
      if (!/^plan:[a-f0-9]{16}$/.test(value.planId || '')) fail('R71_DATABASE_CASE_REQUEST');
      const rows = await rpc('readValidationCases', value);
      if (!Array.isArray(rows) || rows.length > R71_LIMITS.validationCases) fail('R71_DATABASE_RESPONSE');
      const ids = new Set(), events = new Map();
      return freezeR71(rows.map(raw => {
        const row = exact(raw, ['planId', 'caseId', 'eventId', 'recordDigest', 'capturedAtMs', 'admittedAtMs', 'nativeDecision', 'effectiveDecision']);
        if (row.planId !== value.planId || !/^case:[a-f0-9]{16}$/.test(row.caseId || '') || ids.has(row.caseId) ||
            !/^evt:[a-f0-9]{16}$/.test(row.eventId || '') || !SHA.test(row.recordDigest || '') || !integer(row.capturedAtMs, 1) ||
            !integer(row.admittedAtMs, row.capturedAtMs, row.capturedAtMs + R71_LIMITS.lifetimeMs - 1) ||
            (events.has(row.eventId) && events.get(row.eventId) !== row.recordDigest)) fail('R71_DATABASE_CASE_BINDING');
        ids.add(row.caseId); events.set(row.eventId, row.recordDigest);
        return { ...row, nativeDecision: inspectR71Decision(row.nativeDecision), effectiveDecision: inspectR71Decision(row.effectiveDecision) };
      }));
    },
    async readOverview(input = {}) {
      const value = fieldsR71(copyR71(input), ['limit'], [], 'R71_DATABASE_OVERVIEW_REQUEST');
      const limit = value.limit ?? 30;
      if (!integer(limit, 1, 30)) fail('R71_DATABASE_OVERVIEW_REQUEST');
      const result = exact(await rpc('readOverview', { limit }), ['scopeId', 'sourceId', 'sourceKeySha256', 'snapshots', 'operations', 'state']);
      scoped(result);
      if (!Array.isArray(result.snapshots) || result.snapshots.length > limit || !Array.isArray(result.operations) || result.operations.length > limit)
        fail('R71_DATABASE_RESPONSE');
      const snapshots = result.snapshots.map(snapshot), snapshotIds = new Set(), revisions = new Set();
      for (const row of snapshots) {
        if (snapshotIds.has(row.snapshotId)) fail('R71_DATABASE_RESPONSE_BINDING');
        snapshotIds.add(row.snapshotId);
      }
      const operations = result.operations.map(raw => {
        const op = exact(raw, ['operationId', 'revision', 'actorId', 'stateDigest', 'storedAtMs', 'action']);
        if (!OP.test(op.operationId || '') || !integer(op.revision, 0, R71_LIMITS.revisions - 1) || revisions.has(op.revision) ||
            !actor(op.actorId) || !SHA.test(op.stateDigest || '') || !integer(op.storedAtMs, 1) ||
            !['INITIALIZE', 'STUDY', 'REGISTER', 'EVALUATE', 'ROLLBACK'].includes(op.action)) fail('R71_DATABASE_RESPONSE_BINDING');
        revisions.add(op.revision); return op;
      });
      return freezeR71({ ...identity, snapshots, operations, state: result.state === null ? null : stateRow(result.state) });
    },
  });
}
