/**
 * R65 — active, offline QA adapter around unchanged R61 and R47 policies.
 * Every step reads a replay-verified evolution state. The extra R47 gate can
 * only restrict the recomputed R61 decision, never overrule any R61 block.
 * Configuration generation changes discard prior freshness confirmation.
 *
 * R61's named synthetic market fixtures remain unchanged. The additional age
 * is an explicit synthetic context fixture for this adapter. No proprietary
 * external robot, market transport, account, broker or execution is connected.
 */
import { inspectR65EvolutionState } from './robot-r65-evolution-engine.mjs';
import {
  createR61UltraSession, stepR61UltraSession, R61_ULTRA_SCENARIOS, R61_ULTRA_LIMITS,
} from './robot-r61-ultrafast-acceptance.mjs';
import {
  createR47FeedState, beginR47Connection, ingestR47MarketData, authorizeR47Decision,
} from './robot-r47-marketdata-freshness-fence.mjs';

const SCHEMA = 'JENIOS_R65_ACTIVE_RUNTIME_V1';
const trusted = new WeakSet();
const integer = value => Number.isSafeInteger(value) && value >= 0;
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const unique = values => [...new Set(values.filter(Boolean))];
function exact(value, fields, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(code);
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key) ||
      !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) fail(code);
  return Object.fromEntries(fields.map(key => [key, descriptors[key].value]));
}
function sameData(actual, expected) {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const prototype = Object.getPrototypeOf(actual);
  if (Array.isArray(expected) ? prototype !== Array.prototype : ![Object.prototype, null].includes(prototype)) return false;
  const keys = Reflect.ownKeys(expected);
  if (Reflect.ownKeys(actual).length !== keys.length) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key);
    return descriptor && Object.hasOwn(descriptor, 'value') &&
      descriptor.enumerable === Object.getOwnPropertyDescriptor(expected, key).enumerable &&
      sameData(descriptor.value, expected[key]);
  });
}
function eventInput(input) {
  // Determine the discriminant from its descriptor, never from a getter.
  if (!input || typeof input !== 'object') fail('R65_INVALID_RUNTIME_EVENT');
  const type = Object.getOwnPropertyDescriptor(input, 'type');
  if (!type || !Object.hasOwn(type, 'value')) fail('R65_INVALID_RUNTIME_EVENT');
  if (type.value === 'snapshot') {
    const event = exact(input, ['type', 'scenario', 'marketAgeMs'], 'R65_INVALID_RUNTIME_EVENT');
    if (!R61_ULTRA_SCENARIOS.some(s => s.id === event.scenario) ||
        !integer(event.marketAgeMs) || event.marketAgeMs > 60000) fail('R65_INVALID_RUNTIME_EVENT');
    return event;
  }
  const event = exact(input, ['type'], 'R65_INVALID_RUNTIME_EVENT');
  if (!['pause', 'resume'].includes(event.type)) fail('R65_INVALID_RUNTIME_EVENT');
  return event;
}
function eventsInput(input) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype ||
      input.length > R61_ULTRA_LIMITS.maxEvents || Reflect.ownKeys(input).length !== input.length + 1)
    fail('R65_INVALID_RUNTIME_HISTORY');
  let snapshots = 0;
  const result = [];
  for (let i = 0; i < input.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
      fail('R65_INVALID_RUNTIME_HISTORY');
    const item = descriptor.value;
    if (!item || typeof item !== 'object') fail('R65_INVALID_RUNTIME_HISTORY');
    const revision = Object.getOwnPropertyDescriptor(item, 'evolutionRevision');
    const type = Object.getOwnPropertyDescriptor(item, 'type');
    if (!revision || !Object.hasOwn(revision, 'value') || !integer(revision.value) ||
        !type || !Object.hasOwn(type, 'value')) fail('R65_INVALID_RUNTIME_HISTORY');
    const keys = type.value === 'snapshot' ? ['type', 'scenario', 'marketAgeMs', 'evolutionRevision'] : ['type', 'evolutionRevision'];
    const record = exact(item, keys, 'R65_INVALID_RUNTIME_HISTORY');
    const { evolutionRevision, ...rawEvent } = record;
    const event = eventInput(rawEvent);
    if (event.type === 'snapshot') snapshots++;
    result.push({ ...event, evolutionRevision });
  }
  if (snapshots > R61_ULTRA_LIMITS.maxSnapshots) fail('R65_RUNTIME_SNAPSHOT_LIMIT');
  return result;
}

function configurationAt(state, revision) {
  if (!integer(revision) || revision > state.revision) fail('R65_RUNTIME_REVISION_INVALID');
  let config = { versionId: 'research:r65-v1', maxAgeMs: 750,
    activatedAtMs: state.createdAtMs, activationGeneration: 0 };
  for (const entry of state.history.slice(0, revision)) {
    if (!['AUTO_APPLIED', 'ROLLED_BACK'].includes(entry.action)) continue;
    const version = state.versions.find(v => v.versionId === entry.toVersionId);
    if (!version) fail('R65_RUNTIME_VERSION_INVALID');
    config = { versionId: version.versionId, maxAgeMs: version.maxAgeMs,
      activatedAtMs: entry.atMs, activationGeneration: config.activationGeneration + 1 };
  }
  return config;
}

const invariants = () => ({
  orderAuthorized: false, externalEngineConnected: false,
  liveExecutionAllowed: false, externalPaperExecutionAllowed: false,
  productionConfigurationChanged: false, realOrdersSent: 0, externalPaperOrdersSent: 0,
  actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
  manualOperatorControlPreserved: true, alignmentGuardThreshold: 0.65,
  losseshometroSyntheticOnly: true, r15ProspectiveBackfill: false,
});

function replay(evolutionState, rawConfig, initialEvolutionRevision, rawEvents) {
  const state = inspectR65EvolutionState(evolutionState);
  let session = createR61UltraSession(rawConfig);
  const config = session.config, events = eventsInput(rawEvents);
  let selected = configurationAt(state, initialEvolutionRevision), previousRevision = initialEvolutionRevision;
  if ((events.at(-1)?.evolutionRevision ?? initialEvolutionRevision) !== state.revision)
    fail('R65_RUNTIME_STATE_NOT_CONSUMED');
  let feed, sourceEpoch = 0, snapshotCount = 0;
  const reconnect = () => {
    sourceEpoch++;
    feed = createR47FeedState({ maxAgeMs: selected.maxAgeMs, minConsecutiveFresh: 2 });
    beginR47Connection(feed, { sourceEpoch, fencingToken: selected.activationGeneration + 1 });
  };
  reconnect();
  let freshness = { allow: false, reason: 'R65_AWAITING_SNAPSHOT', ingest: null };
  let marketAgeMs = null, configurationReadinessReset = false;
  let allowSyntheticDecision = false, issue = 'NONE';
  let reasons = unique([...session.reasons, freshness.reason]);

  for (const item of events) {
    if (item.evolutionRevision < previousRevision || item.evolutionRevision > state.revision)
      fail('R65_RUNTIME_REVISION_REGRESSION');
    previousRevision = item.evolutionRevision;
    const nextSelected = configurationAt(state, item.evolutionRevision);
    configurationReadinessReset = nextSelected.activationGeneration !== selected.activationGeneration;
    selected = nextSelected;
    if (configurationReadinessReset) reconnect();
    const { evolutionRevision, marketAgeMs: age, ...r61Event } = item;
    session = stepR61UltraSession(session, r61Event);
    marketAgeMs = item.type === 'snapshot' ? age : null;
    issue = 'NONE';
    if (item.type !== 'snapshot' || session.status !== 'RUNNING') {
      reconnect();
      freshness = { allow: false, reason: 'R65_AWAITING_FRESH_CONFIRMATION', ingest: null };
    } else {
      snapshotCount++;
      const interrupted = ['maintenance', 'unknown_exposure', 'missing_entitlement'].includes(item.scenario);
      if (interrupted) reconnect();
      // This explicit fixture clock remains increasing even if adjacent ages
      // vary across their full 0..60000 ms admitted range.
      const authorityNowMs = 1000000 + snapshotCount * 61000;
      const fencingToken = selected.activationGeneration + 1;
      const ingest = ingestR47MarketData(feed, { sourceEpoch, sequence: (feed.lastSequence ?? 0) + 1,
        exchangeTsMs: authorityNowMs - age, authorityNowMs, fencingToken });
      freshness = { ...authorizeR47Decision(feed, { authorityNowMs, sourceEpoch, fencingToken }), ingest };
      if (age > selected.maxAgeMs || session.gates.freshness?.ingest?.reason === 'R47_STALE_MARKET_DATA')
        issue = 'STALE_CONTEXT';
      // As in R61, an interrupted fixture cannot count toward reconnection.
      if (interrupted) reconnect();
    }
    allowSyntheticDecision = session.allowSyntheticDecision === true && freshness.allow === true;
    reasons = unique([...session.reasons,
      !freshness.allow && (freshness.ingest?.reason || freshness.reason)]);
  }
  return {
    schema: SCHEMA, scopeId: state.scopeId, robot: 'ultrafast',
    runtimeEvidenceKind: 'SYNTHETIC_FIXTURE', observationEvidenceKind: 'SIGNED_QA_REPLAY',
    evolutionState: state, initialEvolutionRevision, config, events,
    eventCount: events.length, snapshotCount: events.filter(e => e.type === 'snapshot').length,
    session, policyVersion: selected.versionId, activationGeneration: selected.activationGeneration,
    maxAgeMs: selected.maxAgeMs, marketAgeMs, freshness, configurationReadinessReset,
    allowSyntheticDecision, decision: allowSyntheticDecision ? 'ALLOW' : 'BLOCK', issue, reasons,
    suggestedSide: allowSyntheticDecision ? session.suggestedSide : null,
    ...invariants(),
  };
}

const RUNTIME_KEYS = ['schema', 'scopeId', 'robot', 'runtimeEvidenceKind', 'observationEvidenceKind',
  'evolutionState', 'initialEvolutionRevision', 'config', 'events', 'eventCount', 'snapshotCount',
  'session', 'policyVersion', 'activationGeneration', 'maxAgeMs', 'marketAgeMs', 'freshness',
  'configurationReadinessReset', 'allowSyntheticDecision', 'decision', 'issue', 'reasons', 'suggestedSide',
  ...Object.keys(invariants())];
function seal(value) { freeze(value); trusted.add(value); return value; }

export function createR65ActiveRuntime(input) {
  const { state: rawState, config } = exact(input, ['state', 'config'], 'R65_INVALID_RUNTIME_CONTEXT');
  const state = inspectR65EvolutionState(rawState);
  return seal(replay(state, config, state.revision, []));
}

export function inspectR65ActiveRuntime(input) {
  if (input && trusted.has(input)) return input;
  const r = exact(input, RUNTIME_KEYS, 'R65_INVALID_RUNTIME_STATE');
  const derived = replay(r.evolutionState, r.config, r.initialEvolutionRevision, r.events);
  if (!sameData(input, derived)) fail('R65_RUNTIME_REPLAY_MISMATCH');
  return seal(derived);
}

export function stepR65ActiveRuntime(input) {
  const args = exact(input, ['runtime', 'state', 'event'], 'R65_INVALID_RUNTIME_STEP');
  const runtime = inspectR65ActiveRuntime(args.runtime), state = inspectR65EvolutionState(args.state);
  if (state.scopeId !== runtime.scopeId || state.createdAtMs !== runtime.evolutionState.createdAtMs ||
      state.revision < runtime.evolutionState.revision ||
      !sameData(state.journal.slice(0, runtime.evolutionState.revision), runtime.evolutionState.journal))
    fail('R65_RUNTIME_EVOLUTION_CONTINUITY');
  if (runtime.events.length >= R61_ULTRA_LIMITS.maxEvents) fail('R65_RUNTIME_EVENT_LIMIT');
  const event = eventInput(args.event);
  return seal(replay(state, runtime.config, runtime.initialEvolutionRevision,
    [...runtime.events, { ...event, evolutionRevision: state.revision }]));
}
