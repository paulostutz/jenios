/**
 * R65 — bounded configuration evolution in the offline QA research domain.
 *
 * Observation receipts keep their SIGNED_QA_REPLAY classification. Independent
 * validation cases keep their SYNTHETIC_FIXTURE classification. Neither is live
 * market evidence. Stored R64 admission receipts must come from the pinned host
 * store: their structural/digest replay is not a new signature verification.
 *
 * A hypothesis only requests evaluation. The sole candidate tightens the R47
 * cutoff from 750 to 500 ms; all acceptance labels are frozen prospectively.
 * State inspection reconstructs every command, including activation and rollback.
 * The host additionally enforces durable scope, authoritative time and CAS.
 */
import {
  inspectR64TelemetryReceipt, studyR64AcceptedTelemetry,
} from './robot-r64-telemetry.mjs';
import {
  createR47FeedState, beginR47Connection, ingestR47MarketData, authorizeR47Decision,
} from './robot-r47-marketdata-freshness-fence.mjs';

const SCHEMA = 'JENIOS_R65_EVOLUTION_STATE_V1';
const OBSERVATION = 'SIGNED_QA_REPLAY';
const VALIDATION = 'SYNTHETIC_FIXTURE';
const SCOPE = /^scope:[a-f0-9]{16}$/;
const PLAN = /^plan:[a-f0-9]{16}$/;
const CASE = /^case:[a-f0-9]{16}$/;
const EVENT = /^evt:[a-f0-9]{16}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const matches = (pattern, value) => typeof value === 'string' && pattern.test(value);
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};

export const R65_EVOLUTION_POLICY = freeze({
  schema: 'JENIOS_R65_OWNER_PREAPPROVAL_V1',
  authorizationId: 'OWNER_PREAPPROVAL_20261024', autoApprovalGranted: true,
  allowedEnvironment: 'QA_RESEARCH_ONLY', observationEvidenceKind: OBSERVATION,
  validationEvidenceKind: VALIDATION, allowedChange: 'TIGHTEN_MARKET_FRESHNESS',
  baselineMaxAgeMs: 750, candidateMaxAgeMs: 500, minConsecutiveFresh: 2,
  minDistinctStaleEpisodes: 3, minValidationCases: 6, minCasesPerClass: 2,
  maxValidationCases: 200, maxReceipts: 5000, maxWindowMs: 86400000,
  minCycleIntervalMs: 3600000, maxJournalCommands: 32, maxStateBytes: 8 * 1024 * 1024,
  maxPromotions: 1, alignmentGuardThreshold: 0.65,
  operationalDataAccepted: false, arbitraryCodeAllowed: false,
  liveExecutionAllowed: false, externalPaperExecutionAllowed: false,
  automaticDeploymentAllowed: false,
});

const invariants = () => ({
  observationEvidenceKind: OBSERVATION, validationEvidenceKind: VALIDATION,
  applicationEnvironment: 'QA_RESEARCH_ONLY', operationalDataAccepted: false,
  liveExecutionAllowed: false, externalPaperExecutionAllowed: false,
  productionConfigurationChanged: false, productionMonitoringStarted: false,
  deploymentPerformed: false, manualOperatorControlPreserved: true,
  alignmentGuardThreshold: 0.65, losseshometroSyntheticOnly: true,
  r15ProspectiveBackfill: false, realOrdersSent: 0, externalPaperOrdersSent: 0,
  actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
  commercialPerformanceCertified: false,
});

function record(input, required, optional, code) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail(code);
  const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(descriptors);
  if (required.some(key => !Object.hasOwn(descriptors, key)) ||
      keys.some(key => typeof key !== 'string' || ![...required, ...optional].includes(key) ||
        !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) fail(code);
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
const exact = (input, keys, code) => record(input, keys, [], code);

// Inspect descriptors before reading data; no getters, sparse arrays, cycles or
// prototype-bearing inputs can acquire authority during state reconstruction.
function canonical(input) {
  let nodes = 0;
  const active = new Set();
  function encode(value, depth) {
    if (++nodes > 600000 || depth > 24) fail('R65_EVOLUTION_VALUE_LIMIT');
    if (value === null || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
    if (typeof value === 'string') {
      if (value.length > 65536) fail('R65_EVOLUTION_VALUE_LIMIT');
      return JSON.stringify(value);
    }
    if (!value || typeof value !== 'object' || active.has(value)) fail('R65_EVOLUTION_NON_JSON_VALUE');
    active.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    let result;
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || value.length > 10000 ||
          keys.length !== value.length + 1) fail('R65_EVOLUTION_INVALID_ARRAY');
      const items = [];
      for (let i = 0; i < value.length; i++) {
        const p = descriptors[String(i)];
        if (!p || !Object.hasOwn(p, 'value') || !p.enumerable) fail('R65_EVOLUTION_INVALID_ARRAY');
        items.push(encode(p.value, depth + 1));
      }
      result = '[' + items.join(',') + ']';
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(value)) || keys.length > 10000 ||
          keys.some(key => typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key) ||
            !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable))
        fail('R65_EVOLUTION_NON_JSON_VALUE');
      result = '{' + keys.sort().map(key => JSON.stringify(key) + ':' + encode(descriptors[key].value, depth + 1)).join(',') + '}';
    }
    active.delete(value);
    return result;
  }
  const encoded = encode(input, 0);
  if (Buffer.byteLength(encoded, 'utf8') > R65_EVOLUTION_POLICY.maxStateBytes) fail('R65_EVOLUTION_STATE_TOO_LARGE');
  return encoded;
}
const clone = value => JSON.parse(canonical(value));
const same = (a, b) => canonical(a) === canonical(b);

function baseState(scopeId, nowMs) {
  if (!matches(SCOPE, scopeId) || !integer(nowMs)) fail('R65_INVALID_EVOLUTION_CONTEXT');
  return {
    schema: SCHEMA, scopeId, createdAtMs: nowMs, updatedAtMs: nowMs, revision: 0,
    policy: clone(R65_EVOLUTION_POLICY),
    activeVersion: { versionId: 'research:r65-v1', maxAgeMs: 750,
      activatedAtMs: nowMs, activationGeneration: 0 },
    versions: [{ versionId: 'research:r65-v1', maxAgeMs: 750, createdAtMs: nowMs,
      parentVersionId: null, evaluationPlanId: null }],
    pendingEvaluation: null, evaluations: [], history: [], journal: [],
    retiredCandidateMaxAgeMs: [], ...invariants(),
  };
}

export function createR65EvolutionState(input) {
  const { scopeId, nowMs } = exact(input, ['scopeId', 'nowMs'], 'R65_INVALID_EVOLUTION_CONTEXT');
  return freeze(baseState(scopeId, nowMs));
}

function ages(input) {
  canonical(input);
  if (!Array.isArray(input) || input.length !== 2 || input.some(n => !integer(n) || n > 60000))
    fail('R65_INVALID_FRESHNESS_PAIR');
  return [...input];
}

function freshness(maxAgeMs, snapshotAgesMs) {
  const feed = createR47FeedState({ maxAgeMs, minConsecutiveFresh: 2 });
  beginR47Connection(feed, { sourceEpoch: 1, fencingToken: 1 });
  let authorityNowMs;
  ages(snapshotAgesMs).forEach((age, i) => {
    const exchangeTsMs = 1000000 + i * 61000;
    authorityNowMs = exchangeTsMs + age;
    ingestR47MarketData(feed, { sourceEpoch: 1, sequence: i + 1,
      exchangeTsMs, authorityNowMs, fencingToken: 1 });
  });
  return authorizeR47Decision(feed, { authorityNowMs, sourceEpoch: 1, fencingToken: 1 });
}

function normalizePlan(input, state, nowMs) {
  const p = exact(input, ['planId', 'scopeId', 'evidenceKind', 'startsAtMs', 'endsAtMs', 'caseDefinitions'],
    'R65_INVALID_EVALUATION_PLAN');
  canonical(p);
  if (!matches(PLAN, p.planId) || p.scopeId !== state.scopeId || p.evidenceKind !== VALIDATION ||
      !integer(p.startsAtMs) || !integer(p.endsAtMs) || p.startsAtMs <= nowMs ||
      p.endsAtMs <= p.startsAtMs || p.endsAtMs - p.startsAtMs > R65_EVOLUTION_POLICY.maxWindowMs)
    fail('R65_PLAN_SCOPE_OR_TIME_MISMATCH');
  if (!Array.isArray(p.caseDefinitions) || p.caseDefinitions.length < R65_EVOLUTION_POLICY.minValidationCases ||
      p.caseDefinitions.length > R65_EVOLUTION_POLICY.maxValidationCases) fail('R65_INSUFFICIENT_PREREGISTERED_CASES');
  const ids = new Set();
  const definitions = p.caseDefinitions.map(raw => {
    const c = exact(raw, ['caseId', 'snapshotAgesMs', 'expectedAllow'], 'R65_INVALID_CASE_DEFINITION');
    if (!matches(CASE, c.caseId) || typeof c.expectedAllow !== 'boolean' || ids.has(c.caseId))
      fail('R65_INVALID_OR_REUSED_CASE_ID');
    ids.add(c.caseId);
    return { caseId: c.caseId, snapshotAgesMs: ages(c.snapshotAgesMs), expectedAllow: c.expectedAllow };
  }).sort((a, b) => a.caseId.localeCompare(b.caseId));
  const positives = definitions.filter(c => c.expectedAllow).length;
  if (positives < R65_EVOLUTION_POLICY.minCasesPerClass ||
      definitions.length - positives < R65_EVOLUTION_POLICY.minCasesPerClass)
    fail('R65_PREREGISTERED_CLASSES_REQUIRED');
  return { ...p, caseDefinitions: definitions };
}

function normalizeHypothesis(input, support) {
  if (input === null) return null;
  const h = exact(input, ['kind', 'maxAgeMs', 'evidenceEventIds', 'assessment'], 'R65_INVALID_ANALYST_HYPOTHESIS');
  canonical(h);
  if (h.kind !== 'TIGHTEN_MARKET_FRESHNESS' || h.maxAgeMs !== 500 ||
      h.assessment !== 'HYPOTHESIS_REQUIRES_INDEPENDENT_VALIDATION' || !Array.isArray(h.evidenceEventIds) ||
      h.evidenceEventIds.length < 3 || h.evidenceEventIds.length > 48 ||
      new Set(h.evidenceEventIds).size !== h.evidenceEventIds.length ||
      h.evidenceEventIds.some(id => !matches(EVENT, id) || !support.has(id)))
    fail('R65_UNSUPPORTED_ANALYST_HYPOTHESIS');
  if (new Set(h.evidenceEventIds.map(id => support.get(id).event.occurredAtMs)).size < 3)
    fail('R65_UNSUPPORTED_ANALYST_HYPOTHESIS');
  return { ...h, evidenceEventIds: [...h.evidenceEventIds].sort() };
}

function registration(input, state, nowMs) {
  if (!matches(UUID, input.sourceCycleId) || !integer(input.studyAtMs) || input.studyAtMs > nowMs)
    fail('R65_INVALID_OBSERVATION_CONTEXT');
  canonical(input.receipts);
  if (!Array.isArray(input.receipts) || input.receipts.length > R65_EVOLUTION_POLICY.maxReceipts)
    fail('R65_INVALID_RECEIPT_BATCH');
  const receipts = input.receipts.map(inspectR64TelemetryReceipt);
  // Reconstruct from every admitted receipt, including observations outside the
  // analyst's latest-48 sample. A caller-supplied aggregate is never accepted.
  const study = studyR64AcceptedTelemetry(receipts, {
    scopeId: state.scopeId, period: input.period, generatedAtMs: input.studyAtMs,
  });
  if (receipts.some(r => r.admittedAtMs >= nowMs || r.event.capturedAtMs >= nowMs))
    fail('R65_OBSERVATION_MUST_PRECEDE_REGISTRATION');
  if (study.metrics.byIssue.CONTROL_VIOLATION > 0) fail('R65_CONTROL_VIOLATION_REQUIRES_REVIEW');
  const unique = new Map(receipts.map(r => [r.eventId, r]));
  const ordered = [...unique.values()].sort((a, b) => a.eventId.localeCompare(b.eventId));
  const support = ordered.filter(r => r.event.robot === 'ultrafast' &&
    r.event.issue === 'STALE_CONTEXT' && r.event.marketAgeMs > 500);
  if (new Set(support.map(r => r.event.occurredAtMs)).size < R65_EVOLUTION_POLICY.minDistinctStaleEpisodes)
    fail('R65_NO_ELIGIBLE_OBSERVATION_HYPOTHESIS');
  if (ordered.some(r => r.event.policyVersion !== state.activeVersion.versionId))
    fail('R65_OBSERVATION_POLICY_VERSION_MISMATCH');
  const analystHypothesis = normalizeHypothesis(input.analystHypothesis ?? null,
    new Map(support.map(r => [r.eventId, r])));
  const proposal = { kind: 'TIGHTEN_MARKET_FRESHNESS', maxAgeMs: 500,
    evidenceEventIds: support.map(r => r.eventId), assessment: 'HYPOTHESIS_REQUIRES_INDEPENDENT_VALIDATION',
    origin: analystHypothesis ? 'MODEL_PROPOSAL_INDEPENDENTLY_RECHECKED' : 'DETERMINISTIC_OBSERVATION_RULE' };
  return {
    sourceCycleId: input.sourceCycleId, receipts: ordered,
    period: clone(study.period), studyAtMs: input.studyAtMs,
    study, proposal, analystHypothesis, plan: normalizePlan(input.plan, state, nowMs),
  };
}

function normalizeCases(input, pending, state, nowMs) {
  canonical(input);
  if (!Array.isArray(input) || input.length > R65_EVOLUTION_POLICY.maxValidationCases)
    fail('R65_INVALID_VALIDATION_BATCH');
  const definitions = new Map(pending.plan.caseDefinitions.map(c => [c.caseId, c])), ids = new Set();
  return input.map(raw => {
    const c = exact(raw, ['caseId', 'scopeId', 'evidenceKind', 'occurredAtMs', 'snapshotAgesMs', 'expectedAllow'],
      'R65_INVALID_VALIDATION_CASE');
    if (c.scopeId !== state.scopeId || c.evidenceKind !== VALIDATION) fail('R65_VALIDATION_SCOPE_MISMATCH');
    if (!integer(c.occurredAtMs) || c.occurredAtMs < pending.plan.startsAtMs ||
        c.occurredAtMs >= pending.plan.endsAtMs || c.occurredAtMs > nowMs) fail('R65_VALIDATION_TIME_MISMATCH');
    if (!matches(CASE, c.caseId) || ids.has(c.caseId) || !definitions.has(c.caseId))
      fail('R65_INVALID_OR_REUSED_CASE_ID');
    ids.add(c.caseId);
    const definition = { caseId: c.caseId, snapshotAgesMs: ages(c.snapshotAgesMs), expectedAllow: c.expectedAllow };
    if (!same(definition, definitions.get(c.caseId))) fail('R65_PREREGISTERED_CASE_CHANGED');
    return { ...c, snapshotAgesMs: definition.snapshotAgesMs };
  }).sort((a, b) => a.caseId.localeCompare(b.caseId));
}

function score(cases, maxAgeMs) {
  const result = { total: cases.length, positiveCases: 0, negativeCases: 0,
    allowed: 0, blocked: 0, correct: 0, falseAllows: 0, falseBlocks: 0 };
  for (const c of cases) {
    const allow = freshness(maxAgeMs, c.snapshotAgesMs).allow;
    result[c.expectedAllow ? 'positiveCases' : 'negativeCases']++;
    result[allow ? 'allowed' : 'blocked']++;
    if (allow === c.expectedAllow) result.correct++;
    else result[allow ? 'falseAllows' : 'falseBlocks']++;
  }
  return result;
}

function advance(state, raw) {
  canonical(raw);
  if (!integer(raw.atMs) || raw.atMs < state.updatedAtMs) fail('R65_EVOLUTION_CLOCK_REGRESSION');
  if (state.journal.length >= R65_EVOLUTION_POLICY.maxJournalCommands) fail('R65_EVOLUTION_JOURNAL_LIMIT');
  const next = clone(state);
  next.updatedAtMs = raw.atMs; next.revision++;
  let command = raw;
  if (raw.action === 'REGISTER') {
    exact(raw, ['action', 'atMs', 'receipts', 'period', 'studyAtMs', 'sourceCycleId', 'plan', 'analystHypothesis'],
      'R65_INVALID_EVOLUTION_COMMAND');
    if (state.pendingEvaluation) fail('R65_EVALUATION_ALREADY_PENDING');
    if (state.activeVersion.maxAgeMs !== 750 || state.retiredCandidateMaxAgeMs.includes(500) ||
        state.versions.length > 1) fail('R65_NO_FURTHER_AUTOMATIC_CHANGE');
    const r = registration(raw, state, raw.atMs);
    const prior = state.journal.filter(c => c.action === 'REGISTER');
    if (prior.some(c => c.sourceCycleId === r.sourceCycleId)) fail('R65_SOURCE_CYCLE_ALREADY_USED');
    if (prior.some(c => c.plan.planId === r.plan.planId)) fail('R65_EVALUATION_PLAN_ALREADY_USED');
    const usedCases = new Set(prior.flatMap(c => c.plan.caseDefinitions.map(item => item.caseId)));
    if (r.plan.caseDefinitions.some(item => usedCases.has(item.caseId))) fail('R65_VALIDATION_CASE_ALREADY_USED');
    const usedEvents = new Set(prior.flatMap(c => c.receipts.map(receipt => receipt.eventId)));
    if (r.receipts.some(receipt => usedEvents.has(receipt.eventId))) fail('R65_OBSERVATION_EVIDENCE_ALREADY_USED');
    if (prior.length && raw.atMs - prior.at(-1).atMs < R65_EVOLUTION_POLICY.minCycleIntervalMs)
      fail('R65_EVOLUTION_COOLDOWN');
    if (prior.length && r.receipts.some(receipt => receipt.event.occurredAtMs <= prior.at(-1).atMs))
      fail('R65_NEW_OBSERVATION_MUST_BE_PROSPECTIVE');
    next.pendingEvaluation = { plan: r.plan,
      observation: { sourceCycleId: r.sourceCycleId, study: r.study,
        proposal: r.proposal, analystHypothesis: r.analystHypothesis },
      baselineVersionId: state.activeVersion.versionId, candidateMaxAgeMs: 500, registeredAtMs: raw.atMs };
    next.history.push({ revision: next.revision, action: 'EVALUATION_REGISTERED', atMs: raw.atMs,
      planId: r.plan.planId, fromVersionId: state.activeVersion.versionId, toVersionId: null,
      reason: 'FROZEN_SIGNED_QA_HYPOTHESIS' });
    command = { action: 'REGISTER', atMs: raw.atMs, receipts: r.receipts, period: r.period,
      studyAtMs: r.studyAtMs, sourceCycleId: r.sourceCycleId, plan: r.plan, analystHypothesis: r.analystHypothesis };
  } else if (raw.action === 'EVALUATE') {
    exact(raw, ['action', 'atMs', 'validationCases'], 'R65_INVALID_EVOLUTION_COMMAND');
    const pending = state.pendingEvaluation;
    if (!pending) fail('R65_NO_PENDING_EVALUATION');
    if (raw.atMs < pending.plan.endsAtMs) fail('R65_EVALUATION_WINDOW_NOT_CLOSED');
    const cases = normalizeCases(raw.validationCases, pending, state, raw.atMs);
    let reason = 'INCOMPLETE_PREREGISTERED_WINDOW', baseline = null, candidate = null;
    if (cases.length === pending.plan.caseDefinitions.length) {
      baseline = score(cases, state.activeVersion.maxAgeMs);
      candidate = score(cases, pending.candidateMaxAgeMs);
      reason = candidate.falseAllows > 0 ? 'CANDIDATE_FALSE_ALLOWS_REMAIN' :
        candidate.falseBlocks > baseline.falseBlocks ? 'CANDIDATE_FALSE_BLOCK_REGRESSION' :
        candidate.falseAllows >= baseline.falseAllows ? 'NO_MEASURABLE_IMPROVEMENT' : 'INDEPENDENT_SYNTHETIC_IMPROVEMENT';
    }
    const applied = reason === 'INDEPENDENT_SYNTHETIC_IMPROVEMENT';
    const versionId = applied ? 'research:r65-v2' : null;
    const evaluation = { planId: pending.plan.planId, status: applied ? 'AUTO_APPLIED' : 'REJECTED',
      reason, atMs: raw.atMs, baselineVersionId: pending.baselineVersionId, candidateVersionId: versionId,
      sourceCycleId: pending.observation.sourceCycleId, observationInputDigest: pending.observation.study.inputDigest,
      registeredAtMs: pending.registeredAtMs, validationStartsAtMs: pending.plan.startsAtMs,
      validationEndsAtMs: pending.plan.endsAtMs, candidateMaxAgeMs: pending.candidateMaxAgeMs,
      baseline, candidate, ...invariants() };
    if (applied) {
      next.versions.push({ versionId, maxAgeMs: 500, createdAtMs: raw.atMs,
        parentVersionId: state.activeVersion.versionId, evaluationPlanId: pending.plan.planId });
      next.activeVersion = { versionId, maxAgeMs: 500, activatedAtMs: raw.atMs,
        activationGeneration: state.activeVersion.activationGeneration + 1 };
    }
    next.evaluations.push(evaluation);
    next.history.push({ revision: next.revision, action: evaluation.status, atMs: raw.atMs,
      planId: pending.plan.planId, fromVersionId: pending.baselineVersionId,
      toVersionId: versionId, reason });
    next.pendingEvaluation = null;
    command = { action: 'EVALUATE', atMs: raw.atMs, validationCases: cases };
  } else if (raw.action === 'ROLLBACK') {
    exact(raw, ['action', 'atMs', 'reason'], 'R65_INVALID_EVOLUTION_COMMAND');
    if (!['REGRESSION_DETECTED', 'TECHNICAL_FAILURE', 'OWNER_REQUEST'].includes(raw.reason))
      fail('R65_INVALID_ROLLBACK_REASON');
    const current = state.versions.find(v => v.versionId === state.activeVersion.versionId);
    if (state.pendingEvaluation || !current?.parentVersionId) fail('R65_NO_PREVIOUS_VERSION');
    const previous = state.versions.find(v => v.versionId === current.parentVersionId);
    next.retiredCandidateMaxAgeMs = [...new Set([...state.retiredCandidateMaxAgeMs, current.maxAgeMs])];
    next.activeVersion = { versionId: previous.versionId, maxAgeMs: previous.maxAgeMs,
      activatedAtMs: raw.atMs, activationGeneration: state.activeVersion.activationGeneration + 1 };
    next.history.push({ revision: next.revision, action: 'ROLLED_BACK', atMs: raw.atMs,
      planId: current.evaluationPlanId, fromVersionId: current.versionId, toVersionId: previous.versionId,
      reason: raw.reason });
  } else fail('R65_INVALID_EVOLUTION_COMMAND');
  next.journal.push(clone(command));
  canonical(next);
  return next;
}

export function inspectR65EvolutionState(input) {
  const encoded = canonical(input);
  if (!input || input.schema !== SCHEMA || !matches(SCOPE, input.scopeId) || !integer(input.createdAtMs) ||
      !Array.isArray(input.journal) || input.journal.length > R65_EVOLUTION_POLICY.maxJournalCommands)
    fail('R65_INVALID_EVOLUTION_STATE');
  let derived = baseState(input.scopeId, input.createdAtMs);
  for (const command of input.journal) derived = advance(derived, command);
  if (encoded !== canonical(derived)) fail('R65_EVOLUTION_REPLAY_MISMATCH');
  return freeze(derived);
}

export function registerR65Evaluation(input) {
  const args = record(input, ['state', 'receipts', 'period', 'studyAtMs', 'sourceCycleId', 'plan', 'nowMs'],
    ['analystHypothesis'], 'R65_INVALID_REGISTRATION_INPUT');
  const state = inspectR65EvolutionState(args.state);
  if (!integer(args.nowMs) || args.nowMs < state.updatedAtMs) fail('R65_EVOLUTION_CLOCK_REGRESSION');
  const r = registration(args, state, args.nowMs);
  const command = { action: 'REGISTER', atMs: args.nowMs, receipts: r.receipts, period: r.period,
    studyAtMs: r.studyAtMs, sourceCycleId: r.sourceCycleId, plan: r.plan, analystHypothesis: r.analystHypothesis };
  if (state.pendingEvaluation && same(state.journal.at(-1), command)) return state;
  return freeze(advance(state, command));
}

export function runR65EvolutionCycle(input) {
  const args = exact(input, ['state', 'validationCases', 'nowMs'], 'R65_INVALID_EVOLUTION_CYCLE');
  const state = inspectR65EvolutionState(args.state);
  if (!integer(args.nowMs) || args.nowMs < state.updatedAtMs) fail('R65_EVOLUTION_CLOCK_REGRESSION');
  canonical(args.validationCases);
  if (!Array.isArray(args.validationCases)) fail('R65_INVALID_VALIDATION_BATCH');
  if (!state.pendingEvaluation) return freeze({ state,
    evaluation: { status: 'NO_CHANGE', reason: 'NO_PENDING_EVALUATION', atMs: args.nowMs, ...invariants() } });
  const next = freeze(advance(state, { action: 'EVALUATE', atMs: args.nowMs, validationCases: args.validationCases }));
  return freeze({ state: next, evaluation: next.evaluations.at(-1) });
}

/** Execute a frozen fixture while its prospective window is actually open.
 * The durable host records its own occurrence clock and the frozen definition;
 * final scoring independently re-executes R47 and never accepts these booleans
 * as approval or as caller-supplied evaluation metrics.
 */
export function executeR65ValidationCase(input) {
  const args = exact(input, ['state', 'caseId', 'nowMs'], 'R65_INVALID_VALIDATION_EXECUTION');
  const state = inspectR65EvolutionState(args.state), pending = state.pendingEvaluation;
  if (!pending) fail('R65_NO_PENDING_EVALUATION');
  if (!integer(args.nowMs) || args.nowMs < pending.plan.startsAtMs || args.nowMs >= pending.plan.endsAtMs)
    fail('R65_VALIDATION_WINDOW_NOT_OPEN');
  const definition = pending.plan.caseDefinitions.find(c => c.caseId === args.caseId);
  if (!matches(CASE, args.caseId) || !definition) fail('R65_INVALID_OR_REUSED_CASE_ID');
  return freeze({ baselineAllow: freshness(state.activeVersion.maxAgeMs, definition.snapshotAgesMs).allow,
    candidateAllow: freshness(pending.candidateMaxAgeMs, definition.snapshotAgesMs).allow });
}

export function rollbackR65Evolution(input) {
  const args = exact(input, ['state', 'reason', 'nowMs'], 'R65_INVALID_ROLLBACK_INPUT');
  return freeze(advance(inspectR65EvolutionState(args.state),
    { action: 'ROLLBACK', atMs: args.nowMs, reason: args.reason }));
}
