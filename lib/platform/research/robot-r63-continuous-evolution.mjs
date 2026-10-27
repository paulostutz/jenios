/**
 * R63 — owner-preapproved, bounded evolution of SYNTHETIC research settings.
 *
 * Every candidate is frozen before its independently scheduled fixture window.
 * R47 evaluates the baseline and candidate; caller-supplied pass flags, metrics,
 * code, prompts or production targets are never accepted. The only candidate
 * currently supported is maxAgeMs 750 -> 500. Certified algorithms are unchanged.
 *
 * Replay proves internal consistency, not external data provenance or authorship.
 * A durable host must additionally enforce scope, authoritative time and journal
 * prefix continuity. Nothing in this module authorizes a broker or a deployment.
 */
import {
  createR47FeedState, beginR47Connection, ingestR47MarketData, authorizeR47Decision,
} from './robot-r47-marketdata-freshness-fence.mjs';
import { studyR63Observations } from './robot-r63-observation-study.mjs';

const SCHEMA = 'JENIOS_R63_EVOLUTION_STATE_V1';
const FIXTURE = 'SYNTHETIC_FIXTURE';
const SCOPE = /^fixture:[a-f0-9]{8}$/;
const PLAN = /^plan:[a-f0-9]{8}$/;
const CASE = /^case:[a-f0-9]{8}$/;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const matches = (pattern, value) => typeof value === 'string' && value.match(pattern)?.[0] === value;
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const invariants = () => ({
  evidenceKind: FIXTURE, environment: 'research', liveExecutionAllowed: false,
  externalPaperExecutionAllowed: false, deploymentPerformed: false,
  actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
  realOrdersSent: 0, externalPaperOrdersSent: 0,
});
export const R63_EVOLUTION_POLICY = freeze({
  schema: 'JENIOS_R63_OWNER_PREAPPROVAL_V1',
  authorizationId: 'OWNER_PREAPPROVAL_20261024', autoApprovalGranted: true,
  allowedEnvironment: 'research', allowedEvidenceKind: FIXTURE,
  allowedChange: 'TIGHTEN_MARKET_FRESHNESS', baselineMaxAgeMs: 750, candidateMaxAgeMs: 500,
  minConsecutiveFresh: 2, alignmentGuardThreshold: 0.65,
  minValidationCases: 6, minCasesPerClass: 2, maxValidationCases: 200,
  maxWindowMs: 86400000, minCycleIntervalMs: 3600000, maxJournalCommands: 32,
  maxPromotions: 1, privacyDisclosureRequiredForOperationalData: true,
  operationalDataAccepted: false, arbitraryCodeAllowed: false,
  liveExecutionAllowed: false, externalPaperExecutionAllowed: false,
  automaticDeploymentAllowed: false,
});

function record(input, fields, code) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail(code);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key)) ||
      keys.some(key => !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) fail(code);
  return Object.fromEntries(fields.map(key => [key, descriptors[key].value]));
}

// Validates plain JSON before reading it: no accessors, symbols, sparse arrays,
// exotic prototypes, non-finite values or hidden properties are evaluated.
function canonical(value, depth = 0) {
  if (depth > 20) fail('R63_EVOLUTION_VALUE_TOO_DEEP');
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('R63_EVOLUTION_NON_JSON_VALUE');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (!value || typeof value !== 'object') fail('R63_EVOLUTION_NON_JSON_VALUE');
  const properties = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value)) {
    if (value.length > 10000 || Reflect.ownKeys(properties).length !== value.length + 1)
      fail('R63_EVOLUTION_INVALID_ARRAY');
    const items = [];
    for (let i = 0; i < value.length; i++) {
      const p = properties[String(i)];
      if (!p || !Object.hasOwn(p, 'value') || !p.enumerable) fail('R63_EVOLUTION_INVALID_ARRAY');
      items.push(canonical(p.value, depth + 1));
    }
    return `[${items.join(',')}]`;
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('R63_EVOLUTION_NON_JSON_VALUE');
  const keys = Reflect.ownKeys(properties);
  if (keys.some(key => typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key) ||
      !Object.hasOwn(properties[key], 'value') || !properties[key].enumerable)) fail('R63_EVOLUTION_NON_JSON_VALUE');
  return `{${keys.sort().map(key => `${JSON.stringify(key)}:${canonical(properties[key].value, depth + 1)}`).join(',')}}`;
}
const same = (a, b) => canonical(a) === canonical(b);
const clone = value => JSON.parse(canonical(value));

function baseState(scopeId, nowMs) {
  if (!matches(SCOPE, scopeId) || !integer(nowMs)) fail('R63_INVALID_EVOLUTION_CONTEXT');
  return {
    schema: SCHEMA, scopeId, createdAtMs: nowMs, updatedAtMs: nowMs, revision: 0,
    policy: clone(R63_EVOLUTION_POLICY),
    activeVersion: { versionId: 'research:r63-v1', maxAgeMs: 750, activatedAtMs: nowMs, activationGeneration: 0 },
    versions: [{ versionId: 'research:r63-v1', maxAgeMs: 750, createdAtMs: nowMs,
      parentVersionId: null, evaluationPlanId: null }],
    pendingEvaluation: null, evaluations: [], history: [], journal: [],
    retiredCandidateMaxAgeMs: [], ...invariants(),
  };
}

export function createR63EvolutionState(input) {
  const { scopeId, nowMs } = record(input, ['scopeId', 'nowMs'], 'R63_INVALID_EVOLUTION_CONTEXT');
  return freeze(baseState(scopeId, nowMs));
}

function ages(input) {
  canonical(input);
  if (!Array.isArray(input) || input.length !== 2 || input.some(value => !integer(value) || value > 60000))
    fail('R63_INVALID_FRESHNESS_PAIR');
  return [...input];
}

function freshness(maxAgeMs, snapshotAgesMs) {
  const samples = ages(snapshotAgesMs);
  const feed = createR47FeedState({ maxAgeMs, minConsecutiveFresh: 2 });
  beginR47Connection(feed, { sourceEpoch: 1, fencingToken: 1 });
  let authorityNowMs;
  // These isolated fixture clocks preserve increasing exchange and authority
  // times for the full admitted age range. This tests R47 freshness only.
  for (let index = 0; index < 2; index++) {
    const exchangeTsMs = 1000000 + index * 61000;
    authorityNowMs = exchangeTsMs + samples[index];
    ingestR47MarketData(feed, { sourceEpoch: 1, sequence: index + 1,
      exchangeTsMs, authorityNowMs, fencingToken: 1 });
  }
  return authorizeR47Decision(feed, { authorityNowMs, fencingToken: 1, sourceEpoch: 1 });
}

function verifiedStudy(input, state, nowMs) {
  canonical(input);
  if (!input || input.scopeId !== state.scopeId || input.evidenceKind !== FIXTURE ||
      !integer(input.asOfMs) || input.asOfMs > nowMs) fail('R63_STUDY_SCOPE_OR_TIME_MISMATCH');
  const derived = studyR63Observations(input.events, {
    scopeId: state.scopeId, nowMs: input.asOfMs, windowStartMs: input.windowStartMs,
  });
  if (!same(input, derived)) fail('R63_STUDY_REPLAY_MISMATCH');
  if (derived.events.some(event => event.observedAtMs >= nowMs)) fail('R63_STUDY_MUST_PRECEDE_REGISTRATION');
  return derived;
}

function normalizePlan(input, state, nowMs) {
  const p = record(input, ['planId', 'scopeId', 'evidenceKind', 'startsAtMs', 'endsAtMs', 'caseDefinitions'],
    'R63_INVALID_EVALUATION_PLAN');
  canonical(p);
  if (!matches(PLAN, p.planId) || p.scopeId !== state.scopeId || p.evidenceKind !== FIXTURE ||
      !integer(p.startsAtMs) || !integer(p.endsAtMs) || p.startsAtMs <= nowMs ||
      p.endsAtMs <= p.startsAtMs || p.endsAtMs - p.startsAtMs > R63_EVOLUTION_POLICY.maxWindowMs)
    fail('R63_PLAN_SCOPE_OR_TIME_MISMATCH');
  if (!Array.isArray(p.caseDefinitions) || p.caseDefinitions.length < R63_EVOLUTION_POLICY.minValidationCases ||
      p.caseDefinitions.length > R63_EVOLUTION_POLICY.maxValidationCases) fail('R63_INSUFFICIENT_PREREGISTERED_CASES');
  const ids = new Set();
  const definitions = p.caseDefinitions.map(item => {
    const c = record(item, ['caseId', 'snapshotAgesMs', 'expectedAllow'], 'R63_INVALID_CASE_DEFINITION');
    if (!matches(CASE, c.caseId) || typeof c.expectedAllow !== 'boolean' || ids.has(c.caseId))
      fail('R63_INVALID_OR_REUSED_CASE_ID');
    ids.add(c.caseId);
    return { caseId: c.caseId, snapshotAgesMs: ages(c.snapshotAgesMs), expectedAllow: c.expectedAllow };
  }).sort((a, b) => a.caseId.localeCompare(b.caseId));
  const positives = definitions.filter(c => c.expectedAllow).length;
  if (positives < R63_EVOLUTION_POLICY.minCasesPerClass || definitions.length - positives < R63_EVOLUTION_POLICY.minCasesPerClass)
    fail('R63_PREREGISTERED_CLASSES_REQUIRED');
  return { ...p, caseDefinitions: definitions };
}

function normalizeCases(input, pending, state, nowMs) {
  canonical(input);
  if (!Array.isArray(input) || input.length > R63_EVOLUTION_POLICY.maxValidationCases)
    fail('R63_INVALID_VALIDATION_BATCH');
  const ids = new Set();
  const definitions = new Map(pending.plan.caseDefinitions.map(c => [c.caseId, c]));
  return input.map(item => {
    const c = record(item, ['caseId', 'scopeId', 'evidenceKind', 'occurredAtMs', 'snapshotAgesMs', 'expectedAllow'],
      'R63_INVALID_VALIDATION_CASE');
    if (c.scopeId !== state.scopeId || c.evidenceKind !== FIXTURE) fail('R63_VALIDATION_SCOPE_MISMATCH');
    if (!integer(c.occurredAtMs) || c.occurredAtMs < pending.plan.startsAtMs ||
        c.occurredAtMs >= pending.plan.endsAtMs || c.occurredAtMs > nowMs)
      fail('R63_VALIDATION_TIME_MISMATCH');
    if (!matches(CASE, c.caseId) || ids.has(c.caseId) || !definitions.has(c.caseId))
      fail('R63_INVALID_OR_REUSED_CASE_ID');
    ids.add(c.caseId);
    const definition = { caseId: c.caseId, snapshotAgesMs: ages(c.snapshotAgesMs), expectedAllow: c.expectedAllow };
    if (!same(definition, definitions.get(c.caseId))) fail('R63_PREREGISTERED_CASE_CHANGED');
    return { ...c, snapshotAgesMs: definition.snapshotAgesMs };
  }).sort((a, b) => a.caseId.localeCompare(b.caseId));
}

function score(cases, maxAgeMs) {
  const result = { total: cases.length, positiveCases: 0, negativeCases: 0, allowed: 0,
    blocked: 0, correct: 0, falseAllows: 0, falseBlocks: 0 };
  for (const c of cases) {
    const allow = freshness(maxAgeMs, c.snapshotAgesMs).allow;
    result[c.expectedAllow ? 'positiveCases' : 'negativeCases']++;
    result[allow ? 'allowed' : 'blocked']++;
    if (allow === c.expectedAllow) result.correct++;
    else result[allow ? 'falseAllows' : 'falseBlocks']++;
  }
  return result;
}

function advance(state, command) {
  if (!integer(command.atMs) || command.atMs < state.updatedAtMs) fail('R63_EVOLUTION_CLOCK_REGRESSION');
  if (state.journal.length >= R63_EVOLUTION_POLICY.maxJournalCommands) fail('R63_EVOLUTION_JOURNAL_LIMIT');
  const next = clone(state);
  next.updatedAtMs = command.atMs;
  next.revision++;
  if (command.action === 'REGISTER') {
    record(command, ['action', 'atMs', 'study', 'plan'], 'R63_INVALID_EVOLUTION_COMMAND');
    if (next.pendingEvaluation) fail('R63_EVALUATION_ALREADY_PENDING');
    if (next.activeVersion.maxAgeMs !== 750 || next.retiredCandidateMaxAgeMs.includes(500))
      fail('R63_NO_FURTHER_AUTOMATIC_CHANGE');
    const study = verifiedStudy(command.study, next, command.atMs);
    const plan = normalizePlan(command.plan, next, command.atMs);
    const prior = state.journal.filter(c => c.action === 'REGISTER');
    if (prior.some(c => c.plan.planId === plan.planId)) fail('R63_EVALUATION_PLAN_ALREADY_USED');
    if (prior.length && command.atMs - prior.at(-1).atMs < R63_EVOLUTION_POLICY.minCycleIntervalMs)
      fail('R63_EVOLUTION_COOLDOWN');
    const usedEvents = new Set(prior.flatMap(c => c.study.evidenceEventIds));
    if (study.evidenceEventIds.some(id => usedEvents.has(id))) fail('R63_STUDY_EVIDENCE_ALREADY_USED');
    if (prior.length && study.events.some(event => event.occurredAtMs <= prior.at(-1).atMs))
      fail('R63_NEW_STUDY_MUST_BE_PROSPECTIVE');
    const proposal = study.proposals.find(p => p.kind === 'TIGHTEN_MARKET_FRESHNESS' && p.maxAgeMs === 500);
    if (!proposal) fail('R63_NO_ELIGIBLE_STUDY_PROPOSAL');
    const evidence = study.events.filter(event => proposal.evidenceEventIds.includes(event.eventId));
    if (evidence.some(event => event.policyVersion !== next.activeVersion.versionId))
      fail('R63_STUDY_POLICY_VERSION_MISMATCH');
    next.pendingEvaluation = { plan, study: clone(study), baselineVersionId: next.activeVersion.versionId,
      candidateMaxAgeMs: 500, registeredAtMs: command.atMs };
    next.history.push({ action: 'EVALUATION_REGISTERED', atMs: command.atMs, planId: plan.planId,
      fromVersionId: next.activeVersion.versionId, toVersionId: null, reason: 'FROZEN_SYNTHETIC_HYPOTHESIS' });
    command = { ...command, study: clone(study), plan };
  } else if (command.action === 'EVALUATE') {
    record(command, ['action', 'atMs', 'validationCases'], 'R63_INVALID_EVOLUTION_COMMAND');
    const pending = next.pendingEvaluation;
    if (!pending) fail('R63_NO_PENDING_EVALUATION');
    if (command.atMs < pending.plan.endsAtMs) fail('R63_EVALUATION_WINDOW_NOT_CLOSED');
    const cases = normalizeCases(command.validationCases, pending, next, command.atMs);
    let reason = 'INCOMPLETE_PREREGISTERED_WINDOW', baseline = null, candidate = null;
    if (cases.length === pending.plan.caseDefinitions.length) {
      baseline = score(cases, next.activeVersion.maxAgeMs);
      candidate = score(cases, pending.candidateMaxAgeMs);
      reason = candidate.falseAllows > 0 ? 'CANDIDATE_FALSE_ALLOWS_REMAIN' :
        candidate.falseBlocks > baseline.falseBlocks ? 'CANDIDATE_FALSE_BLOCK_REGRESSION' :
        candidate.falseAllows >= baseline.falseAllows ? 'NO_MEASURABLE_IMPROVEMENT' : 'INDEPENDENT_SYNTHETIC_IMPROVEMENT';
    }
    const applied = reason === 'INDEPENDENT_SYNTHETIC_IMPROVEMENT';
    const candidateVersionId = applied ? `research:r63-v${next.versions.length + 1}` : null;
    const evaluation = { planId: pending.plan.planId, status: applied ? 'AUTO_APPLIED' : 'REJECTED', reason,
      atMs: command.atMs, baselineVersionId: pending.baselineVersionId, candidateVersionId,
      baseline, candidate, registeredAtMs: pending.registeredAtMs,
      validationStartsAtMs: pending.plan.startsAtMs, validationEndsAtMs: pending.plan.endsAtMs,
      candidateMaxAgeMs: pending.candidateMaxAgeMs, ...invariants() };
    if (applied) {
      next.versions.push({ versionId: candidateVersionId, maxAgeMs: pending.candidateMaxAgeMs,
        createdAtMs: command.atMs, parentVersionId: next.activeVersion.versionId,
        evaluationPlanId: pending.plan.planId });
      next.activeVersion = { versionId: candidateVersionId, maxAgeMs: pending.candidateMaxAgeMs,
        activatedAtMs: command.atMs, activationGeneration: next.activeVersion.activationGeneration + 1 };
    }
    next.evaluations.push(evaluation);
    next.history.push({ action: evaluation.status, atMs: command.atMs, planId: pending.plan.planId,
      fromVersionId: pending.baselineVersionId, toVersionId: candidateVersionId, reason });
    next.pendingEvaluation = null;
    command = { ...command, validationCases: cases };
  } else if (command.action === 'ROLLBACK') {
    record(command, ['action', 'atMs', 'reason'], 'R63_INVALID_EVOLUTION_COMMAND');
    if (!['REGRESSION_DETECTED', 'TECHNICAL_FAILURE', 'OWNER_REQUEST'].includes(command.reason))
      fail('R63_INVALID_ROLLBACK_REASON');
    const current = next.versions.find(v => v.versionId === next.activeVersion.versionId);
    if (next.pendingEvaluation || !current?.parentVersionId) fail('R63_NO_PREVIOUS_VERSION');
    const previous = next.versions.find(v => v.versionId === current.parentVersionId);
    next.retiredCandidateMaxAgeMs = [...new Set([...next.retiredCandidateMaxAgeMs, current.maxAgeMs])];
    next.activeVersion = { versionId: previous.versionId, maxAgeMs: previous.maxAgeMs,
      activatedAtMs: command.atMs, activationGeneration: next.activeVersion.activationGeneration + 1 };
    next.history.push({ action: 'ROLLED_BACK', atMs: command.atMs, planId: current.evaluationPlanId,
      fromVersionId: current.versionId, toVersionId: previous.versionId, reason: command.reason });
  } else fail('R63_INVALID_EVOLUTION_COMMAND');
  next.journal.push(clone(command));
  return next;
}

export function inspectR63EvolutionState(input) {
  const encoded = canonical(input);
  if (encoded.length > 8000000) fail('R63_EVOLUTION_STATE_TOO_LARGE');
  if (!input || input.schema !== SCHEMA || !matches(SCOPE, input.scopeId) || !integer(input.createdAtMs) ||
      !Array.isArray(input.journal) || input.journal.length > R63_EVOLUTION_POLICY.maxJournalCommands)
    fail('R63_INVALID_EVOLUTION_STATE');
  let derived = baseState(input.scopeId, input.createdAtMs);
  for (const command of input.journal) derived = advance(derived, command);
  if (encoded !== canonical(derived)) fail('R63_EVOLUTION_REPLAY_MISMATCH');
  return freeze(derived);
}

export function registerR63Evaluation(input) {
  const args = record(input, ['state', 'study', 'plan', 'nowMs'], 'R63_INVALID_REGISTRATION_INPUT');
  const state = inspectR63EvolutionState(args.state);
  if (!integer(args.nowMs) || args.nowMs < state.updatedAtMs) fail('R63_EVOLUTION_CLOCK_REGRESSION');
  const study = verifiedStudy(args.study, state, args.nowMs);
  // Repeated registration of the exact pending protocol is an idempotent read.
  if (state.pendingEvaluation?.registeredAtMs === args.nowMs && same(study, state.pendingEvaluation.study) &&
      same(args.plan, state.pendingEvaluation.plan)) return state;
  const plan = normalizePlan(args.plan, state, args.nowMs);
  return freeze(advance(state, { action: 'REGISTER', atMs: args.nowMs, study, plan }));
}

export function runR63EvolutionCycle(input) {
  const args = record(input, ['state', 'validationCases', 'nowMs'], 'R63_INVALID_EVOLUTION_CYCLE');
  const state = inspectR63EvolutionState(args.state);
  if (!integer(args.nowMs) || args.nowMs < state.updatedAtMs) fail('R63_EVOLUTION_CLOCK_REGRESSION');
  canonical(args.validationCases);
  if (!Array.isArray(args.validationCases)) fail('R63_INVALID_VALIDATION_BATCH');
  if (!state.pendingEvaluation) return freeze({ state, evaluation: {
    status: 'NO_CHANGE', reason: 'NO_PENDING_EVALUATION', atMs: args.nowMs, ...invariants(),
  } });
  const next = freeze(advance(state, { action: 'EVALUATE', atMs: args.nowMs, validationCases: args.validationCases }));
  return freeze({ state: next, evaluation: next.evaluations.at(-1) });
}

export function rollbackR63Evolution(input) {
  const args = record(input, ['state', 'reason', 'nowMs'], 'R63_INVALID_ROLLBACK_INPUT');
  return freeze(advance(inspectR63EvolutionState(args.state), { action: 'ROLLBACK', atMs: args.nowMs, reason: args.reason }));
}

export function evaluateR63ActiveFreshness(input) {
  const args = record(input, ['state', 'snapshotAgesMs'], 'R63_INVALID_ACTIVE_EVALUATION');
  const state = inspectR63EvolutionState(args.state);
  const result = freshness(state.activeVersion.maxAgeMs, args.snapshotAgesMs);
  return freeze({ ...result, version: state.activeVersion.versionId, maxAgeMs: state.activeVersion.maxAgeMs,
    activationGeneration: state.activeVersion.activationGeneration,
    decisionScope: 'R47_FRESHNESS_SYNTHETIC_ONLY', orderAuthorized: false, ...invariants() });
}
