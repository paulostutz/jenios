/** Complete immutable contextual study. Bare historical R67 captures have no
 * position context and cannot be upgraded into this evidence retrospectively.
 * Signatures authenticate the configured QA source, not a broker or an
 * independent assertion that the private core ran on a hosted machine.
 */
import { createHash } from 'node:crypto';
import { inspectR67TrustedSource, r67SourceKeyDigest } from './robot-r67-private-protocol.mjs';
import { inspectR71StoredObservation, verifyR71PrivateObservationRecord } from './robot-r71-private-protocol.mjs';
import { R71_POLICY, R71_LIMITS, copyR71, sameR71, digestR71Value, fieldsR71, freezeR71,
  inspectR71Version, r71ExpectedRouting } from './robot-r71-policy.mjs';

const fail = code => { throw Object.assign(Error(code), { name: 'ValidationError', code }); };
const exact = (v, keys, code) => fieldsR71(v, keys, keys, code);
const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= min && n <= max;
const SHA = /^[a-f0-9]{64}$/, EVENT = /^evt:[a-f0-9]{16}$/, CASE = /^case:[a-f0-9]{16}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function inspectR71Snapshot(input) {
  const s = exact(copyR71(input), ['schema', 'snapshotId', 'scopeId', 'sourceId', 'sourceKeySha256',
    'period', 'frozenAtMs', 'totalRecords', 'totalEntries', 'membershipDigest'], 'R71_SNAPSHOT');
  exact(s.period, ['startMs', 'endMs'], 'R71_SNAPSHOT_PERIOD');
  if (s.schema !== 'JENIOS_R71_PRIVATE_STUDY_SNAPSHOT_V1' || !UUID.test(s.snapshotId || '') ||
      !/^scope:[a-f0-9]{16}$/.test(s.scopeId || '') || !/^source:[a-f0-9]{16}$/.test(s.sourceId || '') ||
      !SHA.test(s.sourceKeySha256 || '') || !SHA.test(s.membershipDigest || '') ||
      !integer(s.period.startMs) || !integer(s.period.endMs, s.period.startMs + 1) ||
      !integer(s.frozenAtMs, s.period.endMs) || !integer(s.totalRecords, 0, R71_LIMITS.snapshotRecords) ||
      !integer(s.totalEntries, 0, R71_LIMITS.snapshotEntries)) fail('R71_SNAPSHOT');
  return freezeR71(s);
}

/** PostgreSQL jsonb text has a different canonical form from our signed JSON.
 * This implementation is deliberately confined to the four ASCII fields of
 * the membership tuple. Key order: byte length, then byte order; PG spaces.
 * The acceptance suite compares it with the database's actual digest.
 */
export function r71MembershipDigest(members) {
  if (!Array.isArray(members) || members.length > R71_LIMITS.snapshotRecords) fail('R71_MEMBERSHIP');
  const text = '[' + members.map((raw, index) => {
    const m = exact(raw, ['ordinal', 'eventId', 'recordDigest', 'annotationDigest'], 'R71_MEMBERSHIP');
    if (m.ordinal !== index + 1 || !EVENT.test(m.eventId || '') || !SHA.test(m.recordDigest || '') ||
        !SHA.test(m.annotationDigest || '')) fail('R71_MEMBERSHIP');
    return '{"eventId": ' + JSON.stringify(m.eventId) + ', "ordinal": ' + m.ordinal +
      ', "recordDigest": ' + JSON.stringify(m.recordDigest) + ', "annotationDigest": ' +
      JSON.stringify(m.annotationDigest) + '}';
  }).join(', ') + ']';
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
const routed = decision => decision.action === 'manage_existing_position' && decision.side === null && decision.mayClose === true;
export function inspectR71Decision(input) {
  const d = exact(copyR71(input), ['action', 'side', 'mayClose'], 'R71_DECISION');
  if (typeof d.action !== 'string' || !/^[a-z_]{1,80}$/.test(d.action) ||
      ![null, 'buy', 'sell'].includes(d.side) || d.mayClose !== true) fail('R71_DECISION');
  return freezeR71(d);
}
export const isR71ExistingPositionRouted = routed;

function inspectFacts(raw, snapshot) {
  if (!Array.isArray(raw) || raw.length !== snapshot.totalRecords) fail('R71_STUDY_COVERAGE');
  const events = new Set(); let last = null, entriesCount = 0;
  const records = raw.map((input, index) => {
    const r = exact(copyR71(input), ['ordinal', 'eventId', 'recordDigest', 'annotationDigest', 'purpose',
      'wrapperVersion', 'capturedAtMs', 'admittedAtMs', 'entryCount', 'entries'], 'R71_STUDY_RECORD');
    r.wrapperVersion = inspectR71Version(r.wrapperVersion);
    if (r.ordinal !== index + 1 || !EVENT.test(r.eventId || '') || events.has(r.eventId) ||
        !SHA.test(r.recordDigest || '') || !SHA.test(r.annotationDigest || '') ||
        !['OBSERVATION', 'VALIDATION'].includes(r.purpose) ||
        !integer(r.capturedAtMs, snapshot.period.startMs, snapshot.period.endMs - 1) ||
        !integer(r.admittedAtMs, r.capturedAtMs, r.capturedAtMs + R71_LIMITS.lifetimeMs) ||
        !integer(r.entryCount, 3, 60) || !Array.isArray(r.entries) || r.entries.length !== r.entryCount ||
        (last && (r.capturedAtMs < last.capturedAtMs || r.capturedAtMs === last.capturedAtMs && r.eventId <= last.eventId)))
      fail('R71_STUDY_RECORD');
    // A transaction can acquire its MVCC snapshot before another commits. The
    // frozen membership is authoritative; never infer it from admittedAtMs.
    last = r; events.add(r.eventId); entriesCount += r.entryCount;
    const ids = new Set();
    r.entries = r.entries.map(input => {
      const e = exact(input, ['scenarioId', 'mode', 'intent', 'horizon', 'paused', 'positionOpen', 'caseId',
        'nativeDecision', 'effectiveDecision', 'nativeRawOutputSha256'], 'R71_STUDY_ENTRY');
      if (typeof e.scenarioId !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(e.scenarioId) || ids.has(e.scenarioId) ||
          !['manual', 'hybrid', 'reverse'].includes(e.mode) || !['buy', 'sell'].includes(e.intent) ||
          !['day', 'swing'].includes(e.horizon) || typeof e.paused !== 'boolean' || typeof e.positionOpen !== 'boolean' ||
          !SHA.test(e.nativeRawOutputSha256 || '') ||
          (r.purpose === 'OBSERVATION' ? e.caseId !== null : !CASE.test(e.caseId || '')))
        fail('R71_STUDY_ENTRY');
      ids.add(e.scenarioId);
      e.nativeDecision = inspectR71Decision(e.nativeDecision); e.effectiveDecision = inspectR71Decision(e.effectiveDecision);
      const shouldRoute = r.wrapperVersion.forwardPositionOpen && r71ExpectedRouting(e, e.positionOpen) === 'MANAGE_EXISTING_POSITION' &&
        e.nativeDecision.action !== 'pause_new_entries';
      const expected = shouldRoute ? { action: 'manage_existing_position', side: null, mayClose: true } : e.nativeDecision;
      if (!sameR71(e.effectiveDecision, expected)) fail('R71_STUDY_POLICY');
      return e;
    });
    return r;
  });
  if (entriesCount !== snapshot.totalEntries || r71MembershipDigest(records.map(r => ({ ordinal: r.ordinal,
    eventId: r.eventId, recordDigest: r.recordDigest, annotationDigest: r.annotationDigest }))) !== snapshot.membershipDigest)
    fail('R71_STUDY_MEMBERSHIP');
  return records;
}
function summarize(records) {
  const metrics = { totalRecords: records.length, totalEntries: 0, observationRecords: 0, observationEntries: 0,
    validationRecords: 0, validationEntries: 0, baselineMissedExistingPositionRouting: 0, protectedCaseChanges: 0,
    nativeActionCounts: {}, effectiveActionCounts: {}, byVersion: [] };
  const versions = new Map(), missedByMode = { hybrid: 0, reverse: 0 };
  for (const record of records) {
    metrics.totalEntries += record.entryCount;
    const observation = record.purpose === 'OBSERVATION';
    metrics[observation ? 'observationRecords' : 'validationRecords']++;
    metrics[observation ? 'observationEntries' : 'validationEntries'] += record.entryCount;
    const key = record.wrapperVersion.versionId + ':' + record.wrapperVersion.activationGeneration;
    if (observation && !versions.has(key)) versions.set(key, { versionId: record.wrapperVersion.versionId,
      activationGeneration: record.wrapperVersion.activationGeneration, records: 0, entries: 0,
      missedExistingPositionRouting: 0, protectedCaseChanges: 0, missedByMode: { hybrid: 0, reverse: 0 } });
    const version = observation ? versions.get(key) : null;
    if (version) { version.records++; version.entries += record.entryCount; }
    for (const entry of record.entries) {
      metrics.nativeActionCounts[entry.nativeDecision.action] = (metrics.nativeActionCounts[entry.nativeDecision.action] || 0) + 1;
      metrics.effectiveActionCounts[entry.effectiveDecision.action] = (metrics.effectiveActionCounts[entry.effectiveDecision.action] || 0) + 1;
      const required = r71ExpectedRouting(entry, entry.positionOpen) === 'MANAGE_EXISTING_POSITION';
      const changed = !required && !sameR71(entry.nativeDecision, entry.effectiveDecision);
      if (changed) { metrics.protectedCaseChanges++; if (version) version.protectedCaseChanges++; }
      if (version && !record.wrapperVersion.forwardPositionOpen && required && !routed(entry.nativeDecision)) {
        metrics.baselineMissedExistingPositionRouting++; version.missedExistingPositionRouting++;
        version.missedByMode[entry.mode]++; missedByMode[entry.mode]++;
      }
    }
  }
  metrics.byVersion = [...versions.values()].sort((a, b) => a.activationGeneration - b.activationGeneration ||
    (a.versionId < b.versionId ? -1 : a.versionId > b.versionId ? 1 : 0));
  const findings = ['hybrid', 'reverse'].filter(mode => missedByMode[mode] > 0)
    .map(mode => ({ code: 'MISSING_EXISTING_POSITION_CONTEXT', mode, count: missedByMode[mode] }));
  const eligibleGenerations = metrics.byVersion.filter(v => v.versionId === R71_POLICY.baselineVersionId &&
    v.missedExistingPositionRouting >= R71_POLICY.minimumMissedContexts && v.protectedCaseChanges === 0 &&
    v.missedByMode.hybrid > 0 && v.missedByMode.reverse > 0).map(v => v.activationGeneration);
  return { metrics, findings, hypothesis: { source: 'BOUNDED_DETERMINISTIC_POLICY', kind: R71_POLICY.kind,
    eligibleGenerations, providerEnabled: false, paidProviderCalls: 0 } };
}
function build(snapshot, rawRecords) {
  const records = inspectFacts(rawRecords, snapshot), summary = summarize(records);
  const body = { schema: 'JENIOS_R71_PRIVATE_STUDY_V1', scopeId: snapshot.scopeId, sourceId: snapshot.sourceId,
    sourceKeySha256: snapshot.sourceKeySha256, snapshot, generatedAtMs: snapshot.frozenAtMs, records, ...summary };
  return freezeR71({ ...body, studyDigest: digestR71Value(body) });
}
export function inspectR71PrivateStudy(input) {
  const s = exact(copyR71(input), ['schema', 'scopeId', 'sourceId', 'sourceKeySha256', 'snapshot', 'generatedAtMs',
    'records', 'metrics', 'findings', 'hypothesis', 'studyDigest'], 'R71_STUDY');
  const expected = build(inspectR71Snapshot(s.snapshot), s.records);
  if (!sameR71(s, expected)) fail('R71_STUDY_RECONSTRUCTION');
  return expected;
}
export async function collectR71PrivateStudy({ store, snapshot: rawSnapshot, trustedSource }) {
  const snapshot = inspectR71Snapshot(rawSnapshot), source = inspectR67TrustedSource(trustedSource);
  if (source.scopeId !== snapshot.scopeId || source.sourceId !== snapshot.sourceId ||
      r67SourceKeyDigest(source) !== snapshot.sourceKeySha256) fail('R71_STUDY_SOURCE');
  const records = []; let afterOrdinal = 0;
  do {
    const page = exact(await store.readStudyPage({ snapshotId: snapshot.snapshotId, afterOrdinal,
      limit: R71_LIMITS.pageSize }), ['snapshot', 'rows', 'nextOrdinal'], 'R71_STUDY_PAGE');
    if (!sameR71(inspectR71Snapshot(page.snapshot), snapshot) || !Array.isArray(page.rows) ||
        page.rows.length > R71_LIMITS.pageSize || page.rows.length !== Math.min(R71_LIMITS.pageSize, snapshot.totalRecords - records.length))
      fail('R71_STUDY_PAGE');
    for (const row of page.rows) {
      exact(row, ['ordinal', 'receipt', 'record'], 'R71_STUDY_ROW');
      if (row.ordinal !== records.length + 1) fail('R71_STUDY_ORDINAL');
      const stored = inspectR71StoredObservation({ receipt: row.receipt, record: row.record });
      const verified = verifyR71PrivateObservationRecord(stored.record, { trustedSource: source, nowMs: stored.receipt.admittedAtMs });
      if (!sameR71(stored, verified)) fail('R71_STUDY_RECEIPT');
      const a = stored.record.annotation, p = stored.record.originalRecord.envelope.payload;
      records.push({ ordinal: row.ordinal, eventId: a.eventId, recordDigest: stored.receipt.recordDigest,
        annotationDigest: stored.receipt.annotationDigest, purpose: a.purpose, wrapperVersion: a.wrapperVersion,
        capturedAtMs: a.capturedAtMs, admittedAtMs: stored.receipt.admittedAtMs, entryCount: a.entries.length,
        entries: a.entries.map((e, i) => ({ scenarioId: e.scenarioId, mode: p.scenarios[i].mode,
          intent: p.scenarios[i].intent, horizon: p.scenarios[i].horizon, paused: p.scenarios[i].paused === true,
          positionOpen: e.positionOpen, caseId: e.caseId, nativeDecision: e.nativeDecision,
          effectiveDecision: e.effectiveDecision, nativeRawOutputSha256: e.nativeRawOutputSha256 })) });
    }
    const expectedNext = records.length < snapshot.totalRecords ? records.length : null;
    if (page.nextOrdinal !== expectedNext || (expectedNext !== null && expectedNext <= afterOrdinal)) fail('R71_STUDY_CURSOR');
    afterOrdinal = page.nextOrdinal;
  } while (afterOrdinal !== null);
  return build(snapshot, records);
}
