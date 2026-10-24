/** Public protocol/state fixtures only: no original private execution. */
import { createR71ProtocolFixture } from './r71-private-protocol-fixture.mjs';
import { r67SourceKeyDigest } from '../../lib/platform/research/robot-r67-private-protocol.mjs';
import { r71OperationId, digestR71Value, createR71Plan } from '../../lib/platform/research/robot-r71-policy.mjs';
import { collectR71PrivateStudy, r71MembershipDigest } from '../../lib/platform/research/robot-r71-private-study.mjs';
import { createR71EvolutionState, recordR71Study, registerR71Evaluation,
  projectR71RuntimeView } from '../../lib/platform/research/robot-r71-evolution-engine.mjs';

export const r71QaEnvironment = () => ({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R71_ENABLED: 'true',
  JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false', JENIOS_REAL_EXECUTION_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false' });
export const r71FixtureRow = state => ({ scopeId: state.scopeId, sourceId: state.sourceId,
  revision: state.revision, stateDigest: digestR71Value(state), state });
export async function makeR71StudyFixture({ count = 1, nowMs = 1792860000000 } = {}) {
  const rows = []; let first;
  for (let i = 0; i < count; i++) {
    const fixture = await createR71ProtocolFixture({ nowMs: nowMs + i, sequence: i + 1,
      operationId: r71OperationId('PUBLIC_PROTOCOL_FIXTURE', i), privateKeyPem: first?.privateKeyPem });
    first ??= fixture; rows.push({ ordinal: i + 1, receipt: fixture.receipt, record: fixture.record });
  }
  first ??= await createR71ProtocolFixture({ nowMs });
  const snapshot = { schema: 'JENIOS_R71_PRIVATE_STUDY_SNAPSHOT_V1',
    snapshotId: '71717171-7171-4171-8171-717171717171', scopeId: first.trustedSource.scopeId,
    sourceId: first.trustedSource.sourceId, sourceKeySha256: r67SourceKeyDigest(first.trustedSource),
    period: { startMs: nowMs - 1000, endMs: nowMs + count + 1 }, frozenAtMs: nowMs + count + 2,
    totalRecords: count, totalEntries: rows.reduce((n, r) => n + r.receipt.entryCount, 0),
    membershipDigest: r71MembershipDigest(rows.map(r => ({ ordinal: r.ordinal, eventId: r.receipt.nativeReceipt.eventId,
      recordDigest: r.receipt.recordDigest, annotationDigest: r.receipt.annotationDigest }))) };
  const calls = [];
  const store = { async readStudyPage({ snapshotId, afterOrdinal, limit }) {
    calls.push({ snapshotId, afterOrdinal, limit });
    const page = rows.slice(afterOrdinal, afterOrdinal + limit);
    return { snapshot, rows: page, nextOrdinal: afterOrdinal + page.length < rows.length ? afterOrdinal + page.length : null };
  } };
  const study = await collectR71PrivateStudy({ store, snapshot, trustedSource: first.trustedSource });
  const initialState = createR71EvolutionState({ scopeId: snapshot.scopeId, sourceId: snapshot.sourceId,
    sourceKeySha256: snapshot.sourceKeySha256, nowMs: nowMs - 100 });
  return { rows, snapshot, store, study, calls, first, initialState, trustedSource: first.trustedSource };
}
export async function makeR71RegisteredFixture() {
  const f = await makeR71StudyFixture();
  const studied = recordR71Study({ state: f.initialState, study: f.study, nowMs: f.snapshot.frozenAtMs });
  const plan = createR71Plan({ snapshotId: f.snapshot.snapshotId, studyDigest: f.study.studyDigest,
    activeVersion: studied.activeVersion, nowMs: f.snapshot.frozenAtMs + 1 });
  const state = registerR71Evaluation({ state: studied, plan, nowMs: plan.registeredAtMs });
  const fixture = await createR71ProtocolFixture({ nowMs: plan.startsAtMs + 1, privateKeyPem: f.first.privateKeyPem,
    sequence: 2, operationId: r71OperationId('PUBLIC_VALIDATION', plan.planId), purpose: 'VALIDATION',
    runtimeView: projectR71RuntimeView(r71FixtureRow(state)) });
  const cases = fixture.record.annotation.entries.map(e => ({ planId: plan.planId, caseId: e.caseId,
    eventId: fixture.record.annotation.eventId, recordDigest: fixture.receipt.recordDigest,
    capturedAtMs: fixture.record.annotation.capturedAtMs, admittedAtMs: fixture.receipt.admittedAtMs,
    nativeDecision: e.nativeDecision, effectiveDecision: e.effectiveDecision }));
  return { ...f, studied, state, plan, cases, validationFixture: fixture };
}
