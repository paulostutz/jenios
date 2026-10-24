/**
 * R61 — offline, interactive UltraFast acceptance adapter.
 * Every input below is a named synthetic fixture, including plan entitlement,
 * book, reconciliation, economics and risk. No market/account observation,
 * clock, transport, order, external Paper or realized PnL is implemented here.
 * Certified policy modules are called unchanged; this is not an integration of
 * every R18–R55 module. Serialized history is replayed to verify derived state.
 */
import { ultrafastEntitlement } from '../ultrafast-entitlement.mjs';
import { R18_ULTRAFAST_SPEC, planUltrafastSession, decideUltrafastDirection } from './robot-r18-ultrafast-foundation.mjs';
import { evaluateRecoveryRegimeInterlock } from './robot-r31-recovery-regime-interlock.mjs';
import { hysteresisStep, sessionRiskStep } from './robot-r33-hysteresis-session-risk.mjs';
import { createR47FeedState, beginR47Connection, ingestR47MarketData, authorizeR47Decision } from './robot-r47-marketdata-freshness-fence.mjs';
import { evaluateR50ShockSnapshot } from './robot-r50-economic-shock-cliffs.mjs';
import { evaluateR52Lifecycle } from './robot-r52-market-symbol-lifecycle.mjs';
import { rankR53Assets } from './robot-r53-dynamic-asset-selection.mjs';

const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const fail = (code) => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const unique = (values) => [...new Set(values.filter(Boolean))];
const SCHEMA = 'JENIOS_R61_ULTRAFAST_ACCEPTANCE_V1';
const CONFIG_KEYS = ['evidenceKind', 'sessionId', 'planCode', 'symbol', 'capital', 'leverage'];

export const R61_ULTRA_ASSETS = freeze([
  { symbol: 'BTC-USD', label: 'BTC / USD — fixture sintética' },
  { symbol: 'ETH-USD', label: 'ETH / USD — fixture sintética' },
  { symbol: 'SOL-USD', label: 'SOL / USD — fixture sintética' },
]);
export const R61_ULTRA_SCENARIOS = freeze([
  { id: 'normal', label: 'Book fresco e custos elegíveis (sintético)' },
  { id: 'stale_book', label: 'Book vencido (sintético)' },
  { id: 'cost_shock', label: 'Choque de custos e liquidez (sintético)' },
  { id: 'maintenance', label: 'Mercado em manutenção (sintético)' },
  { id: 'unknown_exposure', label: 'Reconciliação com exposição desconhecida (sintético)' },
  { id: 'risk_halt', label: 'Injeção de limite de risco (sintético)' },
  { id: 'missing_entitlement', label: 'Plano sem UltraFast (sintético)' },
]);
export const R61_ULTRA_LIMITS = freeze({
  minCapital: 1,
  maxCapital: 1000000000,
  minLeverage: 1,
  maxLeverage: R18_ULTRAFAST_SPEC.maxLeverage,
  maxEvents: 1000,
  maxSnapshots: 500,
});

const ASSET_FIXTURES = freeze([
  { symbol: 'BTC-USD', volatilityBps: 24, spreadBps: 1.2, depthUsd: 3000000, fillProbability: 0.92, roundTripCostBps: 3, adverseSelectionBps: 1, stabilityRatio: 0.9 },
  { symbol: 'ETH-USD', volatilityBps: 30, spreadBps: 1.8, depthUsd: 1800000, fillProbability: 0.88, roundTripCostBps: 4, adverseSelectionBps: 1.5, stabilityRatio: 0.86 },
  { symbol: 'SOL-USD', volatilityBps: 42, spreadBps: 3, depthUsd: 900000, fillProbability: 0.8, roundTripCostBps: 5, adverseSelectionBps: 2, stabilityRatio: 0.82 },
]);
const POLICY_MODULES = freeze([
  'ULTRAFAST_SIMULATED_ENTITLEMENT', 'R18_SESSION_PLAN_AND_DIRECTION',
  'R26_RECOVERY_STATE', 'R27_DYNAMIC_BREAKEVEN', 'R28_ADAPTIVE_BREAKEVEN',
  'R30_REGIME_GATE', 'R31_RECOVERY_REGIME_INTERLOCK',
  'R33_HYSTERESIS_AND_SESSION_RISK', 'R47_MARKETDATA_FRESHNESS',
  'R50_ECONOMIC_SHOCK', 'R52_MARKET_SYMBOL_LIFECYCLE', 'R53_ASSET_ELIGIBILITY',
]);
const INVARIANTS = freeze({
  executed: false,
  liveExecutionEnabled: false,
  externalPaperEnabled: false,
  ordersSent: 0,
  paperOrdersSent: 0,
  realOrdersSent: 0,
  externalPaperOrdersSent: 0,
  actualBrokerPnl: null,
  actualLossesAvoided: null,
  realTradeAccuracy: null,
  commercialPerformanceCertified: false,
  platformPerTradeFee: false,
});

function record(value, allowedKeys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(code);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !allowedKeys.includes(key) || !Object.hasOwn(descriptor, 'value')) fail(code);
  }
  return value;
}

function configInput(input) {
  record(input, CONFIG_KEYS, 'R61_ULTRA_INVALID_CONFIG');
  if (Object.keys(input).length !== CONFIG_KEYS.length ||
      input.evidenceKind !== 'SYNTHETIC_FIXTURE' ||
      typeof input.sessionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(input.sessionId) ||
      typeof input.planCode !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.planCode) ||
      !R61_ULTRA_ASSETS.some((asset) => asset.symbol === input.symbol) ||
      !finite(input.capital) || input.capital < R61_ULTRA_LIMITS.minCapital || input.capital > R61_ULTRA_LIMITS.maxCapital ||
      !finite(input.leverage) || input.leverage < R61_ULTRA_LIMITS.minLeverage || input.leverage > R61_ULTRA_LIMITS.maxLeverage) {
    fail('R61_ULTRA_INVALID_CONFIG');
  }
  return Object.fromEntries(CONFIG_KEYS.map((key) => [key, input[key]]));
}

function eventInput(input) {
  record(input, ['type', 'scenario'], 'R61_ULTRA_INVALID_EVENT');
  if (input.type === 'snapshot') {
    if (Object.keys(input).length !== 2 || !R61_ULTRA_SCENARIOS.some((scenario) => scenario.id === input.scenario)) fail('R61_ULTRA_INVALID_EVENT');
    return { type: 'snapshot', scenario: input.scenario };
  }
  if (!['pause', 'resume'].includes(input.type) || Object.keys(input).length !== 1) fail('R61_ULTRA_INVALID_EVENT');
  return { type: input.type };
}

function eventsInput(input) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || input.length > R61_ULTRA_LIMITS.maxEvents ||
      Reflect.ownKeys(input).length !== input.length + 1) fail('R61_ULTRA_INVALID_HISTORY');
  const events = [];
  for (let index = 0; index < input.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('R61_ULTRA_INVALID_HISTORY');
    events.push(eventInput(descriptor.value));
  }
  if (events.filter((event) => event.type === 'snapshot').length > R61_ULTRA_LIMITS.maxSnapshots) fail('R61_ULTRA_SNAPSHOT_LIMIT');
  return events;
}

// Compare to the canonical replay without evaluating getters or inherited fields.
function sameData(actual, expected) {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const prototype = Object.getPrototypeOf(actual);
  if (Array.isArray(expected) ? prototype !== Array.prototype : ![Object.prototype, null].includes(prototype)) return false;
  const keys = Reflect.ownKeys(expected);
  if (Reflect.ownKeys(actual).length !== keys.length) return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key);
    return descriptor && Object.hasOwn(descriptor, 'value') && sameData(descriptor.value, expected[key]);
  });
}

function replay(config, events) {
  const feed = createR47FeedState({ maxAgeMs: 750, minConsecutiveFresh: 2 });
  let sourceEpoch = 1;
  const connect = () => beginR47Connection(feed, { sourceEpoch, fencingToken: 1 });
  connect();
  let status = 'RUNNING';
  let snapshotCount = 0;
  let lastScenario = null;
  let allowSyntheticDecision = false;
  let suggestedSide = null;
  let hysteresis = { state: 'BLOCKED', goodStreak: 0, badStreak: 0 };
  let risk = sessionRiskStep({ tradeNetR: 0, maxDrawdownR: 12, maxLossStreak: 5 });
  let gates = { entitlement: ultrafastEntitlement(config.planCode) };
  let reasons = unique([gates.entitlement.reason, 'R61_AWAITING_SNAPSHOT']);
  let fixtureInputs = null;

  const resetConfirmation = () => {
    sourceEpoch += 1;
    connect();
    hysteresis = { state: 'BLOCKED', goodStreak: 0, badStreak: 0 };
  };

  for (const event of events) {
    allowSyntheticDecision = false;
    suggestedSide = null;
    if (event.type === 'snapshot') snapshotCount += 1;
    if (status === 'HALTED') {
      reasons = unique([...risk.haltReasons, 'R61_RISK_HALTED', 'R61_NEW_SESSION_REQUIRED']);
      continue;
    }
    if (event.type === 'pause') {
      status = 'PAUSED';
      resetConfirmation();
      gates = { entitlement: ultrafastEntitlement(config.planCode) };
      fixtureInputs = null;
      reasons = unique([gates.entitlement.reason, 'R61_SESSION_PAUSED']);
      continue;
    }
    if (event.type === 'resume') {
      // Even an explicit resume on a running session invalidates previous readiness.
      status = 'RUNNING';
      resetConfirmation();
      gates = { entitlement: ultrafastEntitlement(config.planCode) };
      fixtureInputs = null;
      reasons = unique([gates.entitlement.reason, 'R61_AWAITING_FRESH_CONFIRMATION']);
      continue;
    }
    if (status === 'PAUSED') {
      reasons = unique([gates.entitlement.reason, 'R61_SESSION_PAUSED']);
      continue;
    }

    const scenario = event.scenario;
    lastScenario = scenario;
    const authorityNowMs = 10000 + snapshotCount * 100;
    const quoteAgeMs = scenario === 'stale_book' ? 1001 : 50;
    const marketOpen = scenario !== 'maintenance';
    const unknownExposure = scenario === 'unknown_exposure';
    const entitlement = ultrafastEntitlement(scenario === 'missing_entitlement' ? 'fixture-without-ultrafast' : config.planCode);
    const assetRows = ASSET_FIXTURES.map((asset) => asset.symbol === config.symbol && scenario === 'cost_shock'
      ? { ...asset, spreadBps: 14, depthUsd: 90000, fillProbability: 0.2, roundTripCostBps: 12, adverseSelectionBps: 8 }
      : { ...asset });
    const ranking = rankR53Assets(assetRows);
    const asset = ranking.find((row) => row.symbol === config.symbol);

    // A market/account/permission interruption invalidates the previous feed epoch.
    if (!marketOpen || unknownExposure || !entitlement.allowed) resetConfirmation();
    const marketDataInput = {
      sourceEpoch, sequence: (feed.lastSequence ?? 0) + 1,
      exchangeTsMs: authorityNowMs - quoteAgeMs, authorityNowMs, fencingToken: 1,
    };
    const ingest = ingestR47MarketData(feed, marketDataInput);
    const freshness = authorizeR47Decision(feed, { authorityNowMs, sourceEpoch, fencingToken: 1 });
    const economicInput = {
      regime: scenario === 'cost_shock' ? 'cost_shock' : 'normal', epoch: snapshotCount,
      baseFeeBps: scenario === 'cost_shock' ? 8 : 1,
      spreadBps: scenario === 'cost_shock' ? 14 : 1,
      slippageBps: scenario === 'cost_shock' ? 1.5 : 1,
      adverseSelectionBps: scenario === 'cost_shock' ? 8 : 0.5,
      depthRatio: scenario === 'cost_shock' ? 0.1 : 1.2,
      baseFillProbability: 0.95, estimatedWinRate: 0.62, grossWinBps: 15, grossLossBps: 9,
    };
    const economic = evaluateR50ShockSnapshot(economicInput);
    const regime = {
      regime: economicInput.regime, epoch: snapshotCount,
      totalCostBps: economic.totalCostBps, fillProbability: economic.effectiveFillProbability,
      estimatedWinRate: economicInput.estimatedWinRate, grossWinBps: economicInput.grossWinBps, grossLossBps: economicInput.grossLossBps,
    };
    const recoverySequence = [
      { transportConnected: true },
      { marketDataFresh: freshness.allow, sequenceContinuous: ingest.accepted },
      { openOrdersKnown: !unknownExposure, positionsKnown: !unknownExposure },
      { riskLedgerMatches: !unknownExposure, unknownExposure },
    ];
    const recovery = evaluateRecoveryRegimeInterlock({ recoverySequence, regime });
    const lifecycleInput = {
      marketStatus: marketOpen ? 'open' : 'maintenance', symbolStatus: 'online',
      hasOpenExposure: false, accountReconciled: !unknownExposure, marketDataResynced: freshness.allow,
    };
    const lifecycle = evaluateR52Lifecycle(lifecycleInput);
    const planInput = {
      sessionMode: 'timed_session', accountEquity: config.capital,
      tradeValue: config.capital * 0.05, leverage: config.leverage,
      stopLossBps: 10, takeProfitBps: 15, roundTripCostBps: economic.totalCostBps,
      slippageBufferBps: 1, maxTrades: 20, durationMinutes: 1, marketOpen,
    };
    const plan = planUltrafastSession(planInput);
    const directionInput = {
      microMomentumBps: 8, orderBookImbalance: 0.4, shortVolatilityBps: asset.volatilityBps,
      roundTripCostBps: economic.totalCostBps, spreadBps: asset.spreadBps, quoteAgeMs,
    };
    const direction = decideUltrafastDirection(directionInput);
    hysteresis = hysteresisStep({ ...hysteresis, regime });
    const riskInput = {
      equityR: risk.equityR, peakR: risk.peakR, sessionDrawdownR: risk.sessionDrawdownR,
      lossStreak: risk.lossStreak, tradeNetR: scenario === 'risk_halt' ? -12 : 0,
      maxDrawdownR: 12, maxLossStreak: 5,
    };
    risk = sessionRiskStep(riskInput);
    gates = { entitlement, asset, ranking, freshness: { ...freshness, ingest }, economic, recovery, lifecycle, plan, direction, hysteresis, risk };
    fixtureInputs = {
      marketData: marketDataInput, economics: economicInput, regime, recoverySequence,
      lifecycle: lifecycleInput, plan: planInput, direction: directionInput, risk: riskInput,
      riskEventKind: scenario === 'risk_halt' ? 'INJECTED_SYNTHETIC_LOSS_LIMIT' : 'NO_TRADE',
      sizingAssumption: 'Five percent of fictitious capital per planned slot; no slot is executed.',
    };
    reasons = unique([
      entitlement.reason,
      !asset.eligible && 'R53_ASSET_NOT_ELIGIBLE',
      !freshness.allow && (ingest.reason || freshness.reason),
      ...economic.reasons, ...recovery.reasons, ...lifecycle.reasons,
      ...plan.issues, ...direction.issues,
      hysteresis.state !== 'ALLOWED' && 'R33_CONFIRMATION_PENDING',
      ...risk.haltReasons,
    ]);
    if (risk.halted) {
      status = 'HALTED';
      reasons = unique([...reasons, 'R61_RISK_HALTED', 'R61_NEW_SESSION_REQUIRED']);
    }
    allowSyntheticDecision = status === 'RUNNING' && entitlement.allowed && asset.eligible && freshness.allow &&
      economic.allow && recovery.allowNewEntries && lifecycle.allowNewEntries && plan.allowed &&
      direction.classification === 'ULTRAFAST_PREVIEW' && hysteresis.state === 'ALLOWED' && !risk.halted;
    if (allowSyntheticDecision) suggestedSide = direction.side;
    // The interrupted fixture itself cannot count toward recovery confirmation.
    if (!marketOpen || unknownExposure || !entitlement.allowed) resetConfirmation();
  }

  return {
    schema: SCHEMA, evidenceKind: 'SYNTHETIC_FIXTURE', config, events,
    status, eventCount: events.length, snapshotCount, lastScenario,
    allowSyntheticDecision, suggestedSide, reasons, reasonCodes: reasons,
    gates, fixtureInputs,
    provenance: {
      kind: 'SYNTHETIC_FIXTURE', marketObservation: false, accountObservation: false,
      entitlementSource: 'SIMULATED_PLAN_CODE_ONLY', policyModules: POLICY_MODULES,
      clockSource: 'DETERMINISTIC_FIXTURE', historyVerifiedByReplay: true,
    },
    ...INVARIANTS,
  };
}

const STATE_KEYS = Object.keys(replay({ evidenceKind: 'SYNTHETIC_FIXTURE', sessionId: 'schema', planCode: 'fixture', symbol: 'BTC-USD', capital: 1000, leverage: 1 }, []));
function validatedSession(input) {
  record(input, STATE_KEYS, 'R61_ULTRA_INVALID_SESSION');
  const expected = replay(configInput(input.config), eventsInput(input.events));
  if (!sameData(input, expected)) fail('R61_ULTRA_SESSION_STATE_MISMATCH');
  return expected;
}

/** Start only the local fixture session; two explicit fresh snapshots are needed. */
export function createR61UltraSession(config) {
  return freeze(replay(configInput(config), []));
}

/** Explicit single event: snapshot, pause or resume. No timer or external effect. */
export function stepR61UltraSession(session, event) {
  const previous = validatedSession(session);
  if (previous.events.length >= R61_ULTRA_LIMITS.maxEvents) fail('R61_ULTRA_EVENT_LIMIT');
  const events = eventsInput([...previous.events, eventInput(event)]);
  return freeze(replay(previous.config, events));
}

/** A halt cannot be cleared by pause/resume. Restart requires a different ID. */
export function restartR61UltraSession(previous, config) {
  const current = validatedSession(previous);
  const next = configInput(config);
  if (next.sessionId === current.config.sessionId) fail('R61_ULTRA_NEW_SESSION_ID_REQUIRED');
  return createR61UltraSession(next);
}
