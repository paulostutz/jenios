/**
 * JENIOS UltraFast V2 — Block 1, research-only market intelligence.
 * Pure deterministic analysis of caller-supplied historical/public snapshots.
 * No broker connection, order submission, personal recommendation, or PnL guarantee.
 */
const fail = code => { throw Object.assign(new Error(code), { code }); };
const finite = x => typeof x === 'number' && Number.isFinite(x);
const round = (x, n = 6) => Number(x.toFixed(n));
const clamp = (x, low, high) => Math.min(high, Math.max(low, x));
const SYMBOL = /^[A-Z0-9]{2,15}[-/][A-Z0-9]{2,15}$/;
export const ULTRA_V2_INTELLIGENCE = Object.freeze({
  schema: 'JENIOS_ULTRA_V2_INTELLIGENCE_V1',
  kind: 'OFFLINE_RESEARCH', liveExecutionEnabled: false,
  externalPaperEnabled: false, autoParameterPromotion: false
});

export function normalizeUltraSnapshot(x, nowMs) {
  if (!x || !SYMBOL.test(x.symbol) || typeof x.venue !== 'string' || !/^[a-z0-9_-]{2,30}$/i.test(x.venue) ||
    !Number.isSafeInteger(nowMs) || !Number.isSafeInteger(x.timestampMs) || x.timestampMs > nowMs ||
    nowMs - x.timestampMs > 86_400_000 || !finite(x.bid) || x.bid <= 0 ||
    !finite(x.ask) || x.ask < x.bid || !finite(x.last) || x.last <= 0 ||
    !finite(x.referencePrice) || x.referencePrice <= 0 ||
    !finite(x.shortVolatilityBps) || x.shortVolatilityBps < 0 ||
    !finite(x.bidDepthUsd) || x.bidDepthUsd < 0 || !finite(x.askDepthUsd) || x.askDepthUsd < 0 ||
    !finite(x.tradesPerMinute) || x.tradesPerMinute < 0 ||
    !finite(x.aggressiveBuyUsd) || x.aggressiveBuyUsd < 0 ||
    !finite(x.aggressiveSellUsd) || x.aggressiveSellUsd < 0 ||
    !finite(x.roundTripCostBps) || x.roundTripCostBps < 0 ||
    !finite(x.expectedSlippageBps) || x.expectedSlippageBps < 0 ||
    !finite(x.fillProbability) || x.fillProbability < 0 || x.fillProbability > 1 ||
    !finite(x.stabilityRatio) || x.stabilityRatio < 0 || x.stabilityRatio > 1 ||
    typeof x.marketOpen !== 'boolean' || typeof x.symbolOnline !== 'boolean' ||
    typeof x.maintenance !== 'boolean') fail('ULTRA_V2_INVALID_SNAPSHOT');
  const spreadBps = (x.ask - x.bid) / ((x.ask + x.bid) / 2) * 10_000;
  const changeBps = (x.last / x.referencePrice - 1) * 10_000;
  const totalDepthUsd = x.bidDepthUsd + x.askDepthUsd;
  return Object.freeze({ ...x, spreadBps: round(spreadBps), changeBps: round(changeBps),
    depthUsd: totalDepthUsd, quoteAgeMs: nowMs - x.timestampMs,
    estimatedTotalFrictionBps: round(x.roundTripCostBps + x.expectedSlippageBps),
    observationOnly: true });
}

export function classifyUltraRegime(prices, options = {}) {
  if (!Array.isArray(prices) || prices.length < 6 || prices.length > 400 ||
    prices.some(p => !finite(p) || p <= 0)) fail('ULTRA_V2_INVALID_PRICE_SERIES');
  const returns = prices.slice(1).map((p, i) => (p / prices[i] - 1) * 10000);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdBps = Math.sqrt(returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length);
  const moveBps = (prices.at(-1) / prices[0] - 1) * 10000;
  const prior = prices.slice(0, -1);
  const last = prices.at(-1);
  const volatilityThresholdBps = finite(options.volatilityThresholdBps) && options.volatilityThresholdBps > 0
    ? options.volatilityThresholdBps : 35;
  let regime = 'RANGE';
  if (stdBps >= volatilityThresholdBps) regime = 'HIGH_VOLATILITY';
  else if (last > Math.max(...prior) || last < Math.min(...prior)) regime = 'BREAKOUT';
  else if (Math.abs(moveBps) >= 25 && Math.abs(mean) >= 3) regime = moveBps > 0 ? 'UPTREND' : 'DOWNTREND';
  return Object.freeze({ regime, moveBps: round(moveBps), returnStdBps: round(stdBps),
    direction: moveBps > 0 ? 'UP' : moveBps < 0 ? 'DOWN' : 'FLAT',
    certainty: 'HEURISTIC_NOT_PROBABILITY', observations: prices.length });
}

export function analyzeUltraOrderFlow(snapshot) {
  const x = snapshot;
  if (!x || [x.bidDepthUsd, x.askDepthUsd, x.aggressiveBuyUsd, x.aggressiveSellUsd]
    .some(v => !finite(v) || v < 0)) fail('ULTRA_V2_INVALID_FLOW');
  const book = x.bidDepthUsd + x.askDepthUsd;
  const traded = x.aggressiveBuyUsd + x.aggressiveSellUsd;
  const bookImbalance = book === 0 ? 0 : (x.bidDepthUsd - x.askDepthUsd) / book;
  const aggressionImbalance = traded === 0 ? 0 : (x.aggressiveBuyUsd - x.aggressiveSellUsd) / traded;
  const score = clamp(0.55 * aggressionImbalance + 0.45 * bookImbalance, -1, 1);
  return Object.freeze({ bookImbalance: round(bookImbalance), aggressionImbalance: round(aggressionImbalance),
    directionalScore: round(score), direction: score > .16 ? 'BUY_PRESSURE' : score < -.16 ? 'SELL_PRESSURE' : 'NEUTRAL',
    evidenceSufficient: book >= 100_000 && traded >= 5_000 });
}

export function flagUltraManipulationRisk(snapshot) {
  if (!snapshot || !finite(snapshot.depthUsd) || !finite(snapshot.spreadBps) ||
    !finite(snapshot.shortVolatilityBps) || !finite(snapshot.tradesPerMinute) ||
    !finite(snapshot.changeBps) || !finite(snapshot.stabilityRatio) ||
    [snapshot.depthUsd, snapshot.spreadBps, snapshot.shortVolatilityBps,
      snapshot.tradesPerMinute].some(v => v < 0)) fail('ULTRA_V2_INVALID_RISK_SIGNAL');
  const flags = [];
  if (snapshot.depthUsd < 150_000) flags.push('THIN_BOOK');
  if (snapshot.spreadBps > 12) flags.push('WIDE_SPREAD');
  if (snapshot.shortVolatilityBps > 90 && snapshot.depthUsd < 1_000_000) flags.push('EXTREME_MOVE_THIN_LIQUIDITY');
  if (Math.abs(snapshot.changeBps) > 500 && snapshot.stabilityRatio < .6) flags.push('ISOLATED_PRICE_SPIKE');
  if (snapshot.tradesPerMinute < 10 && Math.abs(snapshot.changeBps) > 100) flags.push('LOW_ACTIVITY_PRICE_JUMP');
  // Suspicion flags only: order-book data alone cannot establish wash trading or market manipulation.
  return Object.freeze({ flagged: flags.length > 0, flags: Object.freeze(flags),
    evidenceType: 'RISK_HEURISTICS_NOT_PROOF_OF_MANIPULATION' });
}

export function assessUltraCrossAssetContext(reference, target) {
  if (!reference || !target || !Array.isArray(reference.returnsBps) || !Array.isArray(target.returnsBps) ||
    reference.returnsBps.length !== target.returnsBps.length || reference.returnsBps.length < 6 ||
    reference.returnsBps.length > 1000 ||
    [...reference.returnsBps, ...target.returnsBps].some(x => !finite(x))) fail('ULTRA_V2_INVALID_CROSS_ASSET');
  const n = reference.returnsBps.length;
  const avg = x => x.reduce((a, b) => a + b, 0) / n;
  const a = reference.returnsBps, b = target.returnsBps, ma = avg(a), mb = avg(b);
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
  const aa = a.reduce((s, x) => s + (x - ma) ** 2, 0);
  const bb = b.reduce((s, x) => s + (x - mb) ** 2, 0);
  const correlation = aa && bb ? clamp(cov / Math.sqrt(aa * bb), -1, 1) : null;
  return Object.freeze({ correlation: correlation === null ? null : round(correlation),
    correlationRisk: correlation !== null && Math.abs(correlation) >= .8,
    referenceMomentumBps: round(a.reduce((s, x) => s + x, 0)),
    sampleSize: n, alignedPeriodsRequired: true });
}

export function scanUltraOpportunities(markets, { nowMs, maxQuoteAgeMs = 1000, minimumFrictionMarginBps = 2 } = {}) {
  if (!Array.isArray(markets) || markets.length < 1 || markets.length > 300 ||
    !Number.isSafeInteger(maxQuoteAgeMs) || maxQuoteAgeMs < 1 ||
    !finite(minimumFrictionMarginBps) || minimumFrictionMarginBps < 0) fail('ULTRA_V2_INVALID_SCAN');
  const seen = new Set();
  const evaluated = markets.map(m => {
    const x = normalizeUltraSnapshot(m, nowMs);
    const key = x.venue + ':' + x.symbol;
    if (seen.has(key)) fail('ULTRA_V2_DUPLICATE_MARKET');
    seen.add(key);
    const flow = analyzeUltraOrderFlow(x);
    const manipulation = flagUltraManipulationRisk(x);
    const reasons = [];
    if (!x.marketOpen || !x.symbolOnline || x.maintenance) reasons.push('MARKET_UNAVAILABLE');
    if (x.quoteAgeMs > maxQuoteAgeMs) reasons.push('STALE_QUOTE');
    if (x.depthUsd < 150_000 || x.tradesPerMinute < 10) reasons.push('LOW_LIQUIDITY');
    if (x.stabilityRatio < .67) reasons.push('UNSTABLE_MULTIWINDOW');
    if (x.fillProbability < .5) reasons.push('LOW_FILL_PROBABILITY');
    if (manipulation.flagged) reasons.push('MANIPULATION_RISK_FLAGS');
    const movementEdgeBps = x.shortVolatilityBps - (x.estimatedTotalFrictionBps + x.spreadBps);
    if (movementEdgeBps < minimumFrictionMarginBps) reasons.push('INSUFFICIENT_MOVEMENT_AFTER_FRICTION');
    if (!flow.evidenceSufficient) reasons.push('WEAK_ORDERFLOW_EVIDENCE');
    const score = round(clamp(movementEdgeBps, 0, 100) * .35 +
      clamp(x.depthUsd / 100_000, 0, 25) + x.fillProbability * 20 +
      x.stabilityRatio * 20 + Math.abs(flow.directionalScore) * 10 -
      (manipulation.flagged ? 25 : 0));
    return Object.freeze({ symbol: x.symbol, venue: x.venue, eligible: reasons.length === 0,
      reasons: Object.freeze(reasons), score, movementEdgeBps: round(movementEdgeBps),
      flow, manipulation, preferredResearchSide: flow.direction === 'BUY_PRESSURE' ? 'buy'
        : flow.direction === 'SELL_PRESSURE' ? 'sell' : 'wait', quoteAgeMs: x.quoteAgeMs,
      fillProbability: x.fillProbability, shortVolatilityBps: x.shortVolatilityBps,
      estimatedFrictionBps: round(x.estimatedTotalFrictionBps + x.spreadBps),
      liveExecution: false, ordersSent: 0 });
  });
  return Object.freeze(evaluated.sort((a, b) => Number(b.eligible) - Number(a.eligible) ||
    b.score - a.score || a.symbol.localeCompare(b.symbol)));
}

export function designUltraScalp(candidate, { stopLossBps, expectedWinRate, fillProbability,
  maxTakeProfitBps = 120, spotOnly = true } = {}) {
  if (!candidate || typeof candidate.eligible !== 'boolean' ||
    !finite(candidate.shortVolatilityBps) || !finite(candidate.estimatedFrictionBps) ||
    !finite(stopLossBps) || stopLossBps <= 0 || !finite(expectedWinRate) ||
    expectedWinRate < 0 || expectedWinRate > 1 || !finite(fillProbability) ||
    fillProbability < 0 || fillProbability > 1 || !finite(maxTakeProfitBps) ||
    maxTakeProfitBps <= 0) fail('ULTRA_V2_INVALID_SCALP_PLAN');
  const targetBps = round(Math.min(maxTakeProfitBps, Math.max(0, candidate.shortVolatilityBps * .65)));
  const expectedBps = round(fillProbability * (expectedWinRate * targetBps -
    (1 - expectedWinRate) * stopLossBps - candidate.estimatedFrictionBps));
  const reasons = [...(candidate.reasons || [])];
  if (!candidate.eligible) reasons.push('CANDIDATE_NOT_ELIGIBLE');
  if (spotOnly && candidate.preferredResearchSide === 'sell') reasons.push('SPOT_SELL_REQUIRES_INVENTORY');
  if (candidate.preferredResearchSide === 'wait') reasons.push('NO_DIRECTIONAL_EDGE');
  if (targetBps <= candidate.estimatedFrictionBps * 1.5) reasons.push('TARGET_BELOW_FRICTION_GATE');
  if (expectedBps <= 2) reasons.push('NO_POSITIVE_EXPECTED_EDGE');
  return Object.freeze({ classification: reasons.length === 0 ? 'RESEARCH_CANDIDATE' : 'WAIT',
    targetBps, stopLossBps, expectedBps, reasons: Object.freeze([...new Set(reasons)]),
    requiresOutOfSampleCalibration: true, liveExecution: false, ordersSent: 0 });
}