/**
 * R63 — bounded, browser-safe observation study for synthetic research.
 *
 * The accepted envelope has no free-text, account identity, credentials, broker
 * payload or claimed economic outcome. A finding describes a fixture label; it
 * does not establish a real incident or its cause. A proposal is a hypothesis
 * requiring an independently registered evaluation, never execution authority.
 * Historical R15 cohorts and the certified policy modules are not modified.
 */

export const R63_DEFAULT_FIXTURE_SCOPE = 'fixture:00000001';
export const R63_OBSERVATION_LIMITS = Object.freeze({
  maxEvents: 5000,
  maxWindowMs: 24 * 60 * 60 * 1000,
  maxMarketAgeMs: 60000,
  proposedMaxAgeMs: 500,
  minDistinctStaleEpisodes: 3,
});
export const R63_OBSERVATION_ROBOTS = Object.freeze(['manual', 'hybrid', 'reverse', 'ultrafast']);
const ISSUES = Object.freeze(['NONE', 'STALE_CONTEXT', 'SEQUENCE_GAP', 'CONNECTION_FAILURE', 'CONTROL_VIOLATION']);
const DECISIONS = Object.freeze(['ALLOW', 'BLOCK', 'ADVISE', 'KEEP']);
const EVENT_KEYS = Object.freeze([
  'evidenceKind', 'scopeId', 'eventId', 'policyVersion', 'robot', 'kind',
  'decision', 'issue', 'marketAgeMs', 'occurredAtMs', 'observedAtMs',
]);
const OPTION_KEYS = Object.freeze(['scopeId', 'nowMs', 'windowStartMs']);
const SCOPE = /^fixture:[a-f0-9]{8}$/;
const EVENT_ID = /^evt:[a-f0-9]{8}$/;
const POLICY_VERSION = /^research:r[1-9][0-9]{0,2}-v[1-9][0-9]{0,5}$/;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };

function record(input, allowed, required, code) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail(code);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== 'string' || !allowed.includes(key)) ||
      required.some(key => !Object.hasOwn(descriptors, key)) ||
      keys.some(key => !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) fail(code);
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}

function options(input) {
  const values = record(input, OPTION_KEYS, ['scopeId', 'nowMs'], 'R63_INVALID_STUDY_CONTEXT');
  if (typeof values.scopeId !== 'string' || !SCOPE.test(values.scopeId) || !integer(values.nowMs))
    fail('R63_INVALID_STUDY_CONTEXT');
  const earliest = Math.max(0, values.nowMs - R63_OBSERVATION_LIMITS.maxWindowMs);
  const start = Object.hasOwn(values, 'windowStartMs') ? values.windowStartMs : earliest;
  if (!integer(start) || start < earliest || start > values.nowMs) fail('R63_INVALID_OBSERVATION_WINDOW');
  return { scopeId: values.scopeId, nowMs: values.nowMs, windowStartMs: start };
}

function normalize(event, context) {
  const value = record(event, EVENT_KEYS, EVENT_KEYS, 'R63_INVALID_OBSERVATION_SCHEMA');
  if (value.evidenceKind !== 'SYNTHETIC_FIXTURE') fail('R63_UNVERIFIED_OBSERVATION_SOURCE');
  if (value.scopeId !== context.scopeId) fail('R63_OBSERVATION_SCOPE_MISMATCH');
  if (typeof value.eventId !== 'string' || !EVENT_ID.test(value.eventId) ||
      typeof value.policyVersion !== 'string' || !POLICY_VERSION.test(value.policyVersion))
    fail('R63_INVALID_SYNTHETIC_IDENTIFIER');
  if (!R63_OBSERVATION_ROBOTS.includes(value.robot) || !['decision', 'incident'].includes(value.kind) ||
      !DECISIONS.includes(value.decision) || !ISSUES.includes(value.issue) ||
      (value.kind === 'incident' && value.issue === 'NONE')) fail('R63_INVALID_OBSERVATION_CATEGORY');
  if (!integer(value.marketAgeMs) || value.marketAgeMs > R63_OBSERVATION_LIMITS.maxMarketAgeMs)
    fail('R63_INVALID_MARKET_AGE');
  if (!integer(value.occurredAtMs) || !integer(value.observedAtMs) ||
      value.occurredAtMs < context.windowStartMs || value.observedAtMs < value.occurredAtMs ||
      value.observedAtMs > context.nowMs) fail('R63_INVALID_OBSERVATION_TIME');
  // Rebuild in fixed order. Input key ordering cannot change deduplication.
  return Object.freeze(Object.fromEntries(EVENT_KEYS.map(key => [key, value[key]])));
}

export function normalizeR63Observation(event, input) {
  return normalize(event, options(input));
}

const emptyCounts = values => Object.fromEntries(values.map(value => [value, 0]));
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const ordered = (a, b) => a.occurredAtMs - b.occurredAtMs || a.observedAtMs - b.observedAtMs ||
  (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0);

export function studyR63Observations(inputEvents, input) {
  const context = options(input);
  if (!Array.isArray(inputEvents) || inputEvents.length > R63_OBSERVATION_LIMITS.maxEvents)
    fail('R63_INVALID_OBSERVATION_BATCH');
  const unique = new Map();
  // Do not skip holes or tolerate non-data entries in an array supplied by code.
  for (let index = 0; index < inputEvents.length; index++) {
    const property = Object.getOwnPropertyDescriptor(inputEvents, String(index));
    if (!property || !Object.hasOwn(property, 'value')) fail('R63_INVALID_OBSERVATION_BATCH');
    const event = normalize(property.value, context);
    const previous = unique.get(event.eventId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(event)) fail('R63_CONFLICTING_EVENT_REPLAY');
    if (!previous) unique.set(event.eventId, event);
  }
  const events = [...unique.values()].sort(ordered);
  const metrics = {
    eventCount: events.length,
    decisionCount: 0,
    incidentCount: 0,
    byRobot: emptyCounts(R63_OBSERVATION_ROBOTS),
    byIssue: emptyCounts(ISSUES),
    blockedDecisions: 0,
    firstOccurredAtMs: events[0]?.occurredAtMs ?? null,
    lastOccurredAtMs: events.at(-1)?.occurredAtMs ?? null,
  };
  for (const event of events) {
    metrics.byRobot[event.robot]++;
    metrics.byIssue[event.issue]++;
    if (event.kind === 'incident') metrics.incidentCount++;
    else {
      metrics.decisionCount++;
      if (event.decision === 'BLOCK') metrics.blockedDecisions++;
    }
  }
  const findings = [];
  for (const robot of R63_OBSERVATION_ROBOTS) {
    for (const issue of ISSUES.slice(1)) {
      const evidence = events.filter(event => event.robot === robot && event.issue === issue);
      if (evidence.length) findings.push({
        code: issue,
        robot,
        classification: 'OBSERVED_SYNTHETIC_SIGNAL',
        severity: issue === 'CONTROL_VIOLATION' ? 'HIGH' : 'REVIEW',
        eventCount: evidence.length,
        distinctOccurredAtCount: new Set(evidence.map(event => event.occurredAtMs)).size,
        evidenceEventIds: evidence.map(event => event.eventId),
      });
    }
  }
  const stale = events.filter(event => event.robot === 'ultrafast' && event.issue === 'STALE_CONTEXT' &&
    event.marketAgeMs > R63_OBSERVATION_LIMITS.proposedMaxAgeMs);
  const distinctStale = new Set(stale.map(event => event.occurredAtMs)).size;
  const proposals = [];
  if (metrics.byIssue.CONTROL_VIOLATION === 0 && distinctStale >= R63_OBSERVATION_LIMITS.minDistinctStaleEpisodes) {
    proposals.push({
      kind: 'TIGHTEN_MARKET_FRESHNESS',
      maxAgeMs: R63_OBSERVATION_LIMITS.proposedMaxAgeMs,
      evidenceEventIds: stale.map(event => event.eventId),
      assessment: 'HYPOTHESIS_REQUIRES_INDEPENDENT_VALIDATION',
    });
  }
  return freeze({
    schema: 'JENIOS_R63_OBSERVATION_STUDY_V1',
    scopeId: context.scopeId,
    evidenceKind: 'SYNTHETIC_FIXTURE',
    asOfMs: context.nowMs,
    windowStartMs: context.windowStartMs,
    events,
    evidenceEventIds: events.map(event => event.eventId),
    metrics,
    findings,
    proposals,
    realOrdersSent: 0,
    externalPaperOrdersSent: 0,
    actualBrokerPnl: null,
    actualLossesAvoided: null,
    realTradeAccuracy: null,
  });
}
