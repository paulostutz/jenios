import test from 'node:test';
import assert from 'node:assert/strict';
import {
  R61_ULTRA_ASSETS, R61_ULTRA_SCENARIOS, R61_ULTRA_LIMITS,
  createR61UltraSession, stepR61UltraSession, restartR61UltraSession,
} from '../lib/platform/research/robot-r61-ultrafast-acceptance.mjs';
import { ultrafastEntitlement } from '../lib/platform/ultrafast-entitlement.mjs';
import { planUltrafastSession, decideUltrafastDirection } from '../lib/platform/research/robot-r18-ultrafast-foundation.mjs';
import { evaluateRecoveryRegimeInterlock } from '../lib/platform/research/robot-r31-recovery-regime-interlock.mjs';
import { hysteresisStep, sessionRiskStep } from '../lib/platform/research/robot-r33-hysteresis-session-risk.mjs';
import { createR47FeedState, beginR47Connection, ingestR47MarketData, authorizeR47Decision } from '../lib/platform/research/robot-r47-marketdata-freshness-fence.mjs';
import { evaluateR50ShockSnapshot } from '../lib/platform/research/robot-r50-economic-shock-cliffs.mjs';
import { evaluateR52Lifecycle } from '../lib/platform/research/robot-r52-market-symbol-lifecycle.mjs';
import { rankR53Assets } from '../lib/platform/research/robot-r53-dynamic-asset-selection.mjs';

const config = (overrides = {}) => ({
  evidenceKind: 'SYNTHETIC_FIXTURE', sessionId: 'r61-test-1',
  planCode: 'platform-global-crypto', symbol: 'BTC-USD', capital: 1000, leverage: 2,
  ...overrides,
});
const snapshot = (session, scenario = 'normal') => stepR61UltraSession(session, { type: 'snapshot', scenario });
const ready = (overrides) => snapshot(snapshot(createR61UltraSession(config(overrides))));
const roundtrip = (value) => JSON.parse(JSON.stringify(value));
const denies = (fn, code) => assert.throws(fn, (error) => error.name === 'ValidationError' && (!code || error.code === code));
function invariant(session) {
  assert.equal(session.evidenceKind, 'SYNTHETIC_FIXTURE');
  assert.equal(session.provenance.entitlementSource, 'SIMULATED_PLAN_CODE_ONLY');
  assert.equal(session.provenance.marketObservation, false);
  assert.equal(session.provenance.accountObservation, false);
  for (const field of ['ordersSent', 'paperOrdersSent', 'realOrdersSent', 'externalPaperOrdersSent']) assert.equal(session[field], 0);
  for (const field of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy']) assert.equal(session[field], null);
  for (const field of ['executed', 'liveExecutionEnabled', 'externalPaperEnabled', 'commercialPerformanceCertified', 'platformPerTradeFee']) assert.equal(session[field], false);
}

test('R61 UltraFast creates a blocked fixture; two explicit fresh snapshots enable only preview', () => {
  const start = createR61UltraSession(config());
  assert.equal(start.status, 'RUNNING');
  assert.equal(start.allowSyntheticDecision, false);
  assert.equal(start.eventCount, 0);
  assert.deepEqual(start.reasons, ['R61_AWAITING_SNAPSHOT']);
  const first = snapshot(start);
  assert.equal(first.allowSyntheticDecision, false);
  assert.ok(first.reasons.includes('R47_FRESH_CONFIRMATION_PENDING'));
  assert.ok(first.reasons.includes('R33_CONFIRMATION_PENDING'));
  const second = snapshot(first);
  assert.equal(second.allowSyntheticDecision, true);
  assert.equal(second.suggestedSide, 'buy');
  assert.equal(second.eventCount, 2);
  assert.deepEqual(second.reasons, []);
  assert.equal(second.gates.risk.equityR, 0);
  assert.equal(second.fixtureInputs.riskEventKind, 'NO_TRADE');
  [start, first, second].forEach(invariant);
  assert.equal(start.events.length, 0);
  assert.ok(Object.isFrozen(second.gates.ranking));
});

test('R61 UltraFast exposes unchanged R18/R31/R33/R47/R50/R52/R53 policy decisions', () => {
  const first = snapshot(createR61UltraSession(config()));
  const second = snapshot(first);
  const inputs = second.fixtureInputs;
  assert.deepEqual(second.gates.entitlement, ultrafastEntitlement(config().planCode));
  assert.deepEqual(second.gates.plan, planUltrafastSession(inputs.plan));
  assert.deepEqual(second.gates.direction, decideUltrafastDirection(inputs.direction));
  assert.deepEqual(second.gates.economic, evaluateR50ShockSnapshot(inputs.economics));
  assert.deepEqual(second.gates.lifecycle, evaluateR52Lifecycle(inputs.lifecycle));
  assert.deepEqual(second.gates.recovery, evaluateRecoveryRegimeInterlock({ recoverySequence: inputs.recoverySequence, regime: inputs.regime }));
  assert.deepEqual(second.gates.risk, sessionRiskStep(inputs.risk));
  assert.deepEqual(second.gates.hysteresis, hysteresisStep({ ...first.gates.hysteresis, regime: inputs.regime }));
  const rows = second.gates.ranking.map(({ eligible, score, ...row }) => row);
  assert.deepEqual(second.gates.ranking, rankR53Assets(rows));
  const feed = createR47FeedState({ maxAgeMs: 750, minConsecutiveFresh: 2 });
  beginR47Connection(feed, { sourceEpoch: 1, fencingToken: 1 });
  ingestR47MarketData(feed, first.fixtureInputs.marketData);
  const ingest = ingestR47MarketData(feed, inputs.marketData);
  const authorization = authorizeR47Decision(feed, { authorityNowMs: inputs.marketData.authorityNowMs, sourceEpoch: 1, fencingToken: 1 });
  assert.deepEqual(second.gates.freshness, { ...authorization, ingest });
});

for (const { symbol } of R61_ULTRA_ASSETS) {
  test(`R61 UltraFast preserves selected ${symbol}, capital and leverage with synthetic R18 sizing`, () => {
    const session = ready({ symbol, capital: 2345, leverage: 10 });
    assert.equal(session.config.symbol, symbol);
    assert.equal(session.gates.asset.symbol, symbol);
    assert.equal(session.gates.asset.eligible, true);
    assert.equal(session.allowSyntheticDecision, true);
    assert.equal(session.gates.plan.notional, 2345 * 0.05 * 10);
    assert.equal(session.fixtureInputs.plan.accountEquity, 2345);
    assert.equal(session.fixtureInputs.plan.leverage, 10);
    invariant(session);
  });
}

for (const planCode of ['platform-global-crypto', 'platform-internacional-pro']) {
  test(`R61 UltraFast simulated intermediate+ entitlement ${planCode} permits preview only`, () => {
    const session = ready({ planCode });
    assert.equal(session.gates.entitlement.allowed, true);
    assert.equal(session.allowSyntheticDecision, true);
    invariant(session);
  });
}

test('R61 UltraFast a simulated plan without entitlement stays blocked', () => {
  const session = ready({ planCode: 'fixture-basic' });
  assert.equal(session.gates.entitlement.allowed, false);
  assert.equal(session.allowSyntheticDecision, false);
  assert.equal(session.suggestedSide, null);
  assert.ok(session.reasons.includes('REQUIRES_GLOBAL_CRYPTO_OR_PRO'));
  invariant(session);
});

for (const [scenario, expectedReason] of [
  ['stale_book', 'R47_STALE_MARKET_DATA'],
  ['cost_shock', 'R53_ASSET_NOT_ELIGIBLE'],
  ['maintenance', 'MARKET_NOT_OPEN'],
  ['unknown_exposure', 'RECOVERY_NOT_READY'],
  ['missing_entitlement', 'REQUIRES_GLOBAL_CRYPTO_OR_PRO'],
]) {
  test(`R61 UltraFast ${scenario} revokes a ready preview and requires two fresh recovery snapshots`, () => {
    const blocked = snapshot(ready(), scenario);
    assert.equal(blocked.allowSyntheticDecision, false);
    assert.equal(blocked.suggestedSide, null);
    assert.ok(blocked.reasons.includes(expectedReason), blocked.reasons.join(','));
    assert.equal(blocked.gates.risk.equityR, 0);
    const first = snapshot(roundtrip(blocked));
    assert.equal(first.allowSyntheticDecision, false);
    const second = snapshot(roundtrip(first));
    assert.equal(second.allowSyntheticDecision, true);
    [blocked, first, second].forEach(invariant);
  });
}

test('R61 UltraFast cost shock uses R50 economics and cannot replace the selected asset', () => {
  const session = snapshot(ready({ symbol: 'SOL-USD' }), 'cost_shock');
  assert.equal(session.gates.asset.symbol, 'SOL-USD');
  assert.equal(session.gates.asset.eligible, false);
  assert.notEqual(session.gates.ranking[0].symbol, 'SOL-USD');
  assert.equal(session.gates.economic.allow, false);
  assert.equal(session.gates.hysteresis.state, 'BLOCKED');
  assert.equal(session.gates.plan.allowed, false);
  assert.deepEqual(session.gates.economic, evaluateR50ShockSnapshot(session.fixtureInputs.economics));
});

test('R61 UltraFast pause/JSON/resume invalidates readiness and never processes paused snapshots', () => {
  const paused = stepR61UltraSession(ready(), { type: 'pause' });
  assert.equal(paused.status, 'PAUSED');
  assert.equal(paused.allowSyntheticDecision, false);
  assert.equal(paused.suggestedSide, null);
  const held = snapshot(roundtrip(paused), 'risk_halt');
  assert.equal(held.status, 'PAUSED');
  assert.equal(held.allowSyntheticDecision, false);
  const resumed = stepR61UltraSession(roundtrip(held), { type: 'resume' });
  assert.equal(resumed.status, 'RUNNING');
  assert.equal(resumed.allowSyntheticDecision, false);
  assert.equal(snapshot(resumed).allowSyntheticDecision, false);
  assert.equal(snapshot(snapshot(resumed)).allowSyntheticDecision, true);
  [paused, held, resumed].forEach(invariant);
});

test('R61 UltraFast risk halt is sticky across JSON, resume, pause and normal snapshots', () => {
  let session = snapshot(ready(), 'risk_halt');
  assert.equal(session.status, 'HALTED');
  assert.equal(session.gates.risk.halted, true);
  assert.equal(session.gates.risk.equityR, -12);
  assert.equal(session.fixtureInputs.riskEventKind, 'INJECTED_SYNTHETIC_LOSS_LIMIT');
  assert.ok(session.reasons.includes('SESSION_DRAWDOWN_LIMIT'));
  for (const event of [{ type: 'resume' }, { type: 'pause' }, { type: 'snapshot', scenario: 'normal' }]) {
    session = stepR61UltraSession(roundtrip(session), event);
    assert.equal(session.status, 'HALTED');
    assert.equal(session.allowSyntheticDecision, false);
    assert.equal(session.suggestedSide, null);
    assert.ok(session.reasons.includes('R61_NEW_SESSION_REQUIRED'));
    invariant(session);
  }
  denies(() => restartR61UltraSession(session, config()), 'R61_ULTRA_NEW_SESSION_ID_REQUIRED');
  const restarted = restartR61UltraSession(session, config({ sessionId: 'r61-test-2' }));
  assert.equal(restarted.status, 'RUNNING');
  assert.equal(restarted.allowSyntheticDecision, false);
  assert.equal(restarted.eventCount, 0);
  assert.equal(snapshot(snapshot(restarted)).allowSyntheticDecision, true);
  invariant(restarted);
});

test('R61 UltraFast risk halt also blocks before the initial freshness confirmation', () => {
  const halted = snapshot(createR61UltraSession(config()), 'risk_halt');
  assert.equal(halted.status, 'HALTED');
  assert.equal(halted.allowSyntheticDecision, false);
  assert.equal(snapshot(halted).status, 'HALTED');
  invariant(halted);
});

test('R61 UltraFast every catalog scenario preserves zero/null execution invariants', () => {
  for (const { id } of R61_ULTRA_SCENARIOS) {
    const session = snapshot(ready(), id);
    invariant(session);
    assert.deepEqual(roundtrip(session), session);
  }
});

for (const [field, invalidValues] of [
  ['evidenceKind', [undefined, 'LIVE', 'synthetic_fixture']],
  ['sessionId', ['', '../session', 'a'.repeat(97), 1]],
  ['planCode', [undefined, '', {}, ' platform-global-crypto']],
  ['symbol', [undefined, 'BTC-USDT', 'INVALID']],
  ['capital', [undefined, null, '1000', NaN, Infinity, -1, 0, R61_ULTRA_LIMITS.maxCapital + 1]],
  ['leverage', [undefined, null, '2', NaN, Infinity, 0, 10.01]],
]) {
  test(`R61 UltraFast denies malformed/missing ${field}`, () => {
    for (const value of invalidValues) denies(() => createR61UltraSession(config({ [field]: value })), 'R61_ULTRA_INVALID_CONFIG');
    const missing = config();
    delete missing[field];
    denies(() => createR61UltraSession(missing), 'R61_ULTRA_INVALID_CONFIG');
  });
}

test('R61 UltraFast rejects unknown fields, prototypes, accessors, arrays and live/account input', () => {
  for (const input of [null, undefined, [], new Date(), Object.create(config()), config({ apiKey: 'fixture' }), config({ live: true }), config({ actualBrokerPnl: 1 })]) {
    denies(() => createR61UltraSession(input), 'R61_ULTRA_INVALID_CONFIG');
  }
  let getterCalls = 0;
  const getter = { ...config(), get capital() { getterCalls += 1; return 1000; } };
  denies(() => createR61UltraSession(getter), 'R61_ULTRA_INVALID_CONFIG');
  assert.equal(getterCalls, 0);
  const poison = JSON.parse('{"__proto__":{"allowed":true}}');
  denies(() => createR61UltraSession({ ...config(), ...poison }), 'R61_ULTRA_INVALID_CONFIG');
});

test('R61 UltraFast denies malformed events without mutating the ready session', () => {
  const session = ready();
  for (const event of [undefined, null, {}, [], { type: 'snapshot' }, { type: 'snapshot', scenario: 'real' }, { type: 'snapshot', scenario: 'normal', price: 100 }, { type: 'resume', scenario: 'normal' }, { type: 'submit_order' }, Object.create({ type: 'resume' })]) {
    denies(() => stepR61UltraSession(session, event), 'R61_ULTRA_INVALID_EVENT');
  }
  assert.equal(session.eventCount, 2);
  assert.equal(session.allowSyntheticDecision, true);
});

test('R61 UltraFast verifies serialized status, history, entitlement and gate decisions by replay', () => {
  const mutations = [
    (state) => { state.status = 'PAUSED'; },
    (state) => { state.allowSyntheticDecision = false; },
    (state) => { state.gates.economic.allow = false; },
    (state) => { state.gates.entitlement.allowed = false; },
    (state) => { state.events.pop(); },
    (state) => { state.config.capital = 2000; },
    (state) => { state.actualBrokerPnl = 50; },
    (state) => { state.provenance.kind = 'REAL'; },
    (state) => { state.extra = true; },
  ];
  for (const mutate of mutations) {
    const state = roundtrip(ready());
    mutate(state);
    denies(() => stepR61UltraSession(state, { type: 'resume' }));
  }
  const forgedAllow = roundtrip(snapshot(ready(), 'risk_halt'));
  forgedAllow.status = 'RUNNING';
  forgedAllow.allowSyntheticDecision = true;
  denies(() => stepR61UltraSession(forgedAllow, { type: 'snapshot', scenario: 'normal' }), 'R61_ULTRA_SESSION_STATE_MISMATCH');
});

test('R61 UltraFast replay rejects sparse history and getters without executing them', () => {
  const state = roundtrip(ready());
  delete state.events[0];
  denies(() => stepR61UltraSession(state, { type: 'resume' }), 'R61_ULTRA_INVALID_HISTORY');
  const getterState = roundtrip(ready());
  let calls = 0;
  Object.defineProperty(getterState.gates, 'economic', { get() { calls += 1; return {}; }, enumerable: true });
  denies(() => stepR61UltraSession(getterState, { type: 'resume' }), 'R61_ULTRA_SESSION_STATE_MISMATCH');
  assert.equal(calls, 0);
});

test('R61 UltraFast accepts capital/leverage bounds without nonfinite output', () => {
  for (const capital of [R61_ULTRA_LIMITS.minCapital, R61_ULTRA_LIMITS.maxCapital]) {
    for (const leverage of [R61_ULTRA_LIMITS.minLeverage, R61_ULTRA_LIMITS.maxLeverage]) {
      const session = ready({ capital, leverage });
      assert.equal(session.allowSyntheticDecision, true);
      assert.deepEqual(roundtrip(session), session);
      invariant(session);
    }
  }
});

test('R61 UltraFast bounded histories reject oversized snapshot and event envelopes', () => {
  const tooManyEvents = roundtrip(createR61UltraSession(config()));
  tooManyEvents.events = Array.from({ length: R61_ULTRA_LIMITS.maxEvents + 1 }, () => ({ type: 'pause' }));
  denies(() => stepR61UltraSession(tooManyEvents, { type: 'resume' }), 'R61_ULTRA_INVALID_HISTORY');
  const tooManySnapshots = roundtrip(createR61UltraSession(config()));
  tooManySnapshots.events = Array.from({ length: R61_ULTRA_LIMITS.maxSnapshots + 1 }, () => ({ type: 'snapshot', scenario: 'normal' }));
  denies(() => stepR61UltraSession(tooManySnapshots, { type: 'resume' }), 'R61_ULTRA_SNAPSHOT_LIMIT');
});
