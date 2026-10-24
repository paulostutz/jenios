/** Explicit QA worker. The private source, not this worker, executes and signs
 * validation cases. Database time governs registration, intake and evaluation.
 * This module neither starts a timer nor activates a hosted scheduler.
 */
import { requireR71QaEnabled } from './robot-r71-access.mjs';
import { inspectR67TrustedSource, r67SourceKeyDigest } from './robot-r67-private-protocol.mjs';
import { R71_POLICY, R71_BOUNDARIES, sameR71, r71OperationId, createR71Plan } from './robot-r71-policy.mjs';
import { collectR71PrivateStudy } from './robot-r71-private-study.mjs';
import { createR71EvolutionState, inspectR71EvolutionState, projectR71RuntimeView, recordR71Study,
  registerR71Evaluation, evaluateR71Evolution, rollbackR71Evolution } from './robot-r71-evolution-engine.mjs';

const fail = code => { throw Object.assign(Error(code), { code }); };
const result = (status, row, extra = {}) => ({ status, scopeId: row.scopeId, sourceId: row.sourceId,
  revision: row.revision, activeVersion: row.state.activeVersion, ...extra, ...R71_BOUNDARIES });
function checkedRow(row, source = null) {
  const view = projectR71RuntimeView(row), state = inspectR71EvolutionState(row.state);
  if (source && (view.scopeId !== source.scopeId || view.sourceId !== source.sourceId ||
      view.sourceKeySha256 !== r67SourceKeyDigest(source))) fail('R71_WORKER_SOURCE');
  return { scopeId: view.scopeId, sourceId: view.sourceId, revision: view.revision, stateDigest: view.stateDigest, state };
}
async function clock(store, env) {
  requireR71QaEnabled(env);
  const value = await store.now(); requireR71QaEnabled(env);
  if (!value || Object.keys(value).length !== 1 || !Number.isSafeInteger(value.nowMs) || value.nowMs < 1)
    fail('R71_DATABASE_CLOCK');
  return value.nowMs;
}
async function append({ store, current, state, operationId, actorId = 'system:r71', env }) {
  requireR71QaEnabled(env);
  await store.appendState({ operationId, expectedRevision: current?.revision ?? -1,
    previousDigest: current?.stateDigest ?? null, state, actorId });
  requireR71QaEnabled(env);
  const saved = checkedRow(await store.readState()); requireR71QaEnabled(env);
  if (saved.revision < state.revision || saved.scopeId !== state.scopeId || saved.sourceId !== state.sourceId ||
      !sameR71(saved.state.journal.slice(0, state.journal.length), state.journal)) fail('R71_DURABLE_STATE_UNCONFIRMED');
  return saved;
}
export async function ensureR71Evolution({ store, trustedSource, env = {} }) {
  requireR71QaEnabled(env); const source = inspectR67TrustedSource(trustedSource);
  const existing = await store.readState(); requireR71QaEnabled(env);
  if (existing) return checkedRow(existing, source);
  const nowMs = await clock(store, env), state = createR71EvolutionState({ scopeId: source.scopeId,
    sourceId: source.sourceId, sourceKeySha256: r67SourceKeyDigest(source), nowMs });
  try { return await append({ store, current: null, state, env,
    operationId: r71OperationId(source.scopeId, source.sourceId, 'INITIALIZE') }); }
  catch (error) {
    requireR71QaEnabled(env);
    // Concurrent initialization and uncertain initial writes are safe to read.
    const recovered = await store.readState(); requireR71QaEnabled(env);
    if (recovered) return checkedRow(recovered, source);
    throw error;
  }
}
export async function runR71EvolutionTick({ store, trustedSource, env = {} } = {}) {
  requireR71QaEnabled(env); const source = inspectR67TrustedSource(trustedSource);
  let current = await ensureR71Evolution({ store, trustedSource: source, env });
  let nowMs = await clock(store, env);
  const pending = current.state.pendingEvaluation;
  if (pending) {
    if (nowMs < pending.startsAtMs) return result('WAITING_VALIDATION_WINDOW', current,
      { planId: pending.planId, nextAtMs: pending.startsAtMs });
    if (nowMs < pending.endsAtMs) return result('WAITING_SOURCE_VALIDATION', current,
      { planId: pending.planId, nextAtMs: pending.endsAtMs });
    const cases = await store.readValidationCases({ planId: pending.planId }); requireR71QaEnabled(env);
    nowMs = await clock(store, env);
    const evaluated = evaluateR71Evolution({ state: current.state, cases, nowMs });
    current = await append({ store, current, state: evaluated.state, env,
      operationId: r71OperationId(source.scopeId, source.sourceId, 'EVALUATE', pending.planId) });
    return result(evaluated.evaluation.status, current, { evaluation: evaluated.evaluation });
  }
  if (current.state.promotions || current.state.candidateRetired || current.state.evaluations.length)
    return result('NO_NEW_AUTHORIZED_CANDIDATE', current);
  const period = { startMs: Math.max(0, nowMs - R71_POLICY.studyWindowMs), endMs: nowMs };
  const snapshot = await store.freezeStudy({ operationId: r71OperationId(source.scopeId, source.sourceId,
    'FREEZE', current.revision, period), period }); requireR71QaEnabled(env);
  const study = await collectR71PrivateStudy({ store, snapshot, trustedSource: source }); requireR71QaEnabled(env);
  if (!study.metrics.observationRecords) return result('WAITING_CONTEXTUAL_OBSERVATIONS', current,
    { snapshotId: snapshot.snapshotId, studyDigest: study.studyDigest });
  // Re-reading the same immutable members does not consume another revision.
  if (current.state.latestStudy?.snapshot.membershipDigest !== study.snapshot.membershipDigest) {
    nowMs = await clock(store, env);
    const state = recordR71Study({ state: current.state, study, nowMs });
    current = await append({ store, current, state, env,
      operationId: r71OperationId(source.scopeId, source.sourceId, 'STUDY', snapshot.snapshotId) });
  }
  if (!current.state.latestStudy?.hypothesis.eligibleGenerations.includes(current.state.activeVersion.activationGeneration))
    return result('NO_ELIGIBLE_OBSERVATION', current, { snapshotId: snapshot.snapshotId, studyDigest: study.studyDigest });
  nowMs = await clock(store, env);
  const registeredStudy = current.state.latestStudy;
  const plan = createR71Plan({ snapshotId: registeredStudy.snapshot.snapshotId,
    studyDigest: registeredStudy.studyDigest, activeVersion: current.state.activeVersion, nowMs });
  const state = registerR71Evaluation({ state: current.state, plan, nowMs });
  current = await append({ store, current, state, env,
    operationId: r71OperationId(source.scopeId, source.sourceId, 'REGISTER', plan.planId) });
  return result('EVALUATION_REGISTERED', current, { planId: plan.planId, nextAtMs: plan.startsAtMs,
    snapshotId: registeredStudy.snapshot.snapshotId, studyDigest: registeredStudy.studyDigest,
    hypothesisSource: registeredStudy.hypothesis.source });
}
export async function rollbackR71Durable({ store, operationId, expectedRevision, previousDigest,
  reason, actorId, env = {} }) {
  requireR71QaEnabled(env);
  if (!/^user:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(actorId || ''))
    fail('R71_ADMIN_ACTOR_REQUIRED');
  if (!/^op:[a-f0-9]{32}$/.test(operationId || '') || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
      !/^[a-f0-9]{64}$/.test(previousDigest || '')) fail('R71_ROLLBACK_CAS');
  const current = checkedRow(await store.readState()); requireR71QaEnabled(env);
  let state;
  if (current.revision === expectedRevision && current.stateDigest === previousDigest) {
    const nowMs = await clock(store, env); state = rollbackR71Evolution({ state: current.state, reason, nowMs });
  } else if (current.revision === expectedRevision + 1 && current.state.journal.at(-1)?.action === 'ROLLBACK' &&
      current.state.journal.at(-1)?.reason === reason) state = current.state;
  else fail('R71_EVOLUTION_CONFLICT');
  // Only the persisted operation receipt accepts a retry; another identical
  // looking rollback with a different operationId remains a CAS conflict.
  const saved = await append({ store, current: { revision: expectedRevision, stateDigest: previousDigest },
    state, operationId, actorId, env });
  return result('ROLLED_BACK', saved);
}
