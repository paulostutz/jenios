/**
 * JENIOS UltraFast V2 — Block 2. Deterministic execution planning, feed fences,
 * portfolio risk, replayable order observation. No network or order transport.
 */
const fail = code => { throw Object.assign(new Error(code), { code }); };
const n = x => typeof x === 'number' && Number.isFinite(x);
const round = x => Number(x.toFixed(8));
export const ULTRA_V2_EXECUTION_BOUNDARY = Object.freeze({
  schema: 'JENIOS_ULTRA_V2_EXECUTION_GUARD_V1',
  outboundOrdersEnabled: false, externalPaperOrdersEnabled: false,
  permittedActions: Object.freeze(['ANALYZE','OBSERVE','PROPOSE','RECONCILE_OFFLINE']),
  requiresSeparateBrokerCertification: true
});

export function assessUltraFeedHealth(samples, {nowMs, maxAgeMs = 1000, maxGapMs = 1500,
  maintenance = false, sourceOnline = true} = {}) {
  if (!Array.isArray(samples) || samples.length < 2 || samples.length > 10000 ||
    !Number.isSafeInteger(nowMs) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 ||
    !Number.isSafeInteger(maxGapMs) || maxGapMs < 1 ||
    typeof maintenance !== 'boolean' || typeof sourceOnline !== 'boolean') fail('ULTRA_V2_FEED_INVALID');
  let lastTime = -1, lastSequence = -1, maxGapObservedMs = 0;
  const issues = [];
  for (const row of samples) {
    if (!row || !Number.isSafeInteger(row.timestampMs) || !Number.isSafeInteger(row.sequence) ||
      row.sequence < 0 || row.timestampMs > nowMs || !n(row.bid) || row.bid <= 0 ||
      !n(row.ask) || row.ask < row.bid) fail('ULTRA_V2_FEED_INVALID');
    if (lastSequence >= 0 && row.sequence <= lastSequence) issues.push('OUT_OF_ORDER_OR_DUPLICATE_SEQUENCE');
    if (lastTime >= 0) {
      if (row.timestampMs <= lastTime) issues.push('NON_MONOTONIC_TIMESTAMP');
      else maxGapObservedMs = Math.max(maxGapObservedMs,row.timestampMs - lastTime);
    }
    lastTime = row.timestampMs;lastSequence = row.sequence;
  }
  if (nowMs - lastTime > maxAgeMs) issues.push('STALE_FEED');
  if (maxGapObservedMs > maxGapMs) issues.push('MARKET_DATA_GAP');
  if (maintenance) issues.push('EXCHANGE_MAINTENANCE');
  if (!sourceOnline) issues.push('EXCHANGE_OFFLINE');
  return Object.freeze({allow:issues.length===0,issues:Object.freeze([...new Set(issues)]),
    lastSequence,lastTimestampMs:lastTime,lastQuoteAgeMs:nowMs-lastTime,maxGapObservedMs,
    requiresResubscription:issues.length>0,ordersSent:0});
}

export function planUltraSmartExecution(x) {
  if (!x || !n(x.spreadBps) || x.spreadBps<0 || !n(x.makerFeeBps) || x.makerFeeBps < -5 ||
    !n(x.takerFeeBps) || x.takerFeeBps < 0 || !n(x.slippageBps) || x.slippageBps < 0 ||
    !n(x.adverseSelectionBps) || x.adverseSelectionBps < 0 ||
    !n(x.makerFillProbability) || x.makerFillProbability < 0 || x.makerFillProbability > 1 ||
    !n(x.expectedGrossEdgeBps) || x.expectedGrossEdgeBps < 0 ||
    !Number.isSafeInteger(x.latencyMs) || x.latencyMs < 0 ||
    !n(x.queueAheadUsd) || x.queueAheadUsd < 0 ||
    !n(x.availableDepthUsd) || x.availableDepthUsd < 0 ||
    !n(x.orderNotionalUsd) || x.orderNotionalUsd <= 0) fail('ULTRA_V2_EXECUTION_INVALID');
  const executionIssues = [];
  if (x.availableDepthUsd < Math.max(100000,x.orderNotionalUsd*20)) executionIssues.push('INSUFFICIENT_EXECUTABLE_DEPTH');
  if (x.latencyMs > 350) executionIssues.push('LATENCY_TOO_HIGH');
  // Maker may be abandoned only in future certified transport; plan assumes taker fallback cost, not a fill.
  const makerCost = x.makerFeeBps + (1-x.makerFillProbability) *
    (x.takerFeeBps + x.spreadBps/2 + x.slippageBps) +
    x.adverseSelectionBps*.7 + x.queueAheadUsd/Math.max(1,x.availableDepthUsd)*2;
  const takerCost = x.takerFeeBps + x.spreadBps/2 + x.slippageBps + x.adverseSelectionBps;
  const preferred = makerCost < takerCost && x.makerFillProbability >= .45 ? 'maker' : 'taker';
  const chosen = preferred==='maker'?makerCost:takerCost;
  const expectedNetEdgeBps = x.expectedGrossEdgeBps - chosen;
  if (expectedNetEdgeBps < 2) executionIssues.push('NO_NET_EXECUTION_EDGE');
  if (x.makerFillProbability < .15 && preferred === 'maker') executionIssues.push('LOW_MAKER_FILL_PROBABILITY');
  return Object.freeze({preferred,expectedMakerCostBps:round(makerCost),
    expectedTakerCostBps:round(takerCost),expectedNetEdgeBps:round(expectedNetEdgeBps),
    allowProposal:executionIssues.length===0,reasons:Object.freeze(executionIssues),
    expectedNotGuaranteed:true,liveExecution:false,ordersSent:0});
}

export function checkUltraPortfolioRisk(x) {
  if (!x || !n(x.accountEquityUsd) || x.accountEquityUsd<=0 ||
    !n(x.orderNotionalUsd) || x.orderNotionalUsd<=0 ||
    !n(x.stopLossBps) || x.stopLossBps<=0 ||
    !n(x.existingExposureUsd) || x.existingExposureUsd<0 ||
    !n(x.correlatedExposureUsd) || x.correlatedExposureUsd<0 ||
    !n(x.realizedSessionLossUsd) || x.realizedSessionLossUsd<0 ||
    !n(x.realizedDailyLossUsd) || x.realizedDailyLossUsd<0 ||
    !n(x.maxTradeLossPct) || x.maxTradeLossPct<=0 || x.maxTradeLossPct>5 ||
    !n(x.maxSessionLossPct) || x.maxSessionLossPct<=0 || x.maxSessionLossPct>10 ||
    !n(x.maxDailyLossPct) || x.maxDailyLossPct<=0 || x.maxDailyLossPct>15 ||
    !n(x.maxTotalExposurePct) || x.maxTotalExposurePct<=0 || x.maxTotalExposurePct>100 ||
    !n(x.maxCorrelatedExposurePct) || x.maxCorrelatedExposurePct<=0 || x.maxCorrelatedExposurePct>100 ||
    typeof x.userStopped!=='boolean' || typeof x.feedHealthy!=='boolean')
    fail('ULTRA_V2_PORTFOLIO_INVALID');
  const tradeLossUsd=x.orderNotionalUsd*x.stopLossBps/10000;
  const issues=[];
  if (x.userStopped) issues.push('USER_STOPPED');
  if (!x.feedHealthy) issues.push('FEED_UNHEALTHY');
  if (tradeLossUsd/x.accountEquityUsd*100>x.maxTradeLossPct) issues.push('TRADE_RISK_LIMIT');
  if ((x.realizedSessionLossUsd+tradeLossUsd)/x.accountEquityUsd*100>x.maxSessionLossPct) issues.push('SESSION_LOSS_LIMIT');
  if ((x.realizedDailyLossUsd+tradeLossUsd)/x.accountEquityUsd*100>x.maxDailyLossPct) issues.push('DAILY_LOSS_LIMIT');
  if ((x.existingExposureUsd+x.orderNotionalUsd)/x.accountEquityUsd*100>x.maxTotalExposurePct) issues.push('EXPOSURE_LIMIT');
  if ((x.correlatedExposureUsd+x.orderNotionalUsd)/x.accountEquityUsd*100>x.maxCorrelatedExposurePct) issues.push('CORRELATION_LIMIT');
  return Object.freeze({allow:issues.length===0,issues:Object.freeze(issues),
    estimatedStopLossUsd:round(tradeLossUsd),
    grossExposurePct:round((x.existingExposureUsd+x.orderNotionalUsd)/x.accountEquityUsd*100),
    actualBrokerPnl:null,ordersSent:0});
}

/** Replay only: event IDs are unique, fills are cumulative and monotonic, cancel requires exchange confirmation. */
export function replayUltraOrderObservations({clientOrderId,requestedQuantity,events}={}) {
  if (!/^[a-zA-Z0-9_-]{5,80}$/.test(clientOrderId||'') ||
    !n(requestedQuantity) || requestedQuantity<=0 || !Array.isArray(events) || events.length>10000)
    fail('ULTRA_V2_JOURNAL_INVALID');
  let status='PROPOSED',filledQuantity=0,lastTimestamp=-1;
  const seen=new Set(),issues=[];
  for (const e of events) {
    if (!e || typeof e.eventId!=='string' || e.eventId.length<1 ||
      !Number.isSafeInteger(e.timestampMs) || !['accepted','partial_fill','filled','cancel_confirmed','rejected'].includes(e.type) ||
      !n(e.cumulativeFilledQuantity) || e.cumulativeFilledQuantity<0)
      fail('ULTRA_V2_JOURNAL_INVALID');
    if (seen.has(e.eventId)) continue;
    if (e.timestampMs < lastTimestamp) {issues.push('NON_MONOTONIC_PROVIDER_EVENTS');break;}
    lastTimestamp=e.timestampMs;seen.add(e.eventId);
    if (['FILLED','CANCELED','REJECTED','INCONSISTENT'].includes(status)) {
      issues.push('EVENT_AFTER_TERMINAL_STATE');break;
    }
    if (e.cumulativeFilledQuantity + 1e-10 < filledQuantity ||
      e.cumulativeFilledQuantity - requestedQuantity > 1e-10) {
      issues.push('IMPOSSIBLE_FILL_QUANTITY');break;
    }
    if (e.type==='accepted') {
      if (status!=='PROPOSED' || e.cumulativeFilledQuantity!==0) {issues.push('INVALID_ACCEPTED_EVENT');break;}
      status='ACCEPTED';
    } else if (e.type==='partial_fill') {
      if (!['ACCEPTED','PARTIALLY_FILLED'].includes(status) ||
        e.cumulativeFilledQuantity<=filledQuantity || e.cumulativeFilledQuantity>=requestedQuantity) {
        issues.push('INVALID_PARTIAL_FILL');break;
      }
      filledQuantity=e.cumulativeFilledQuantity;status='PARTIALLY_FILLED';
    } else if (e.type==='filled') {
      if (!['ACCEPTED','PARTIALLY_FILLED'].includes(status) ||
        Math.abs(e.cumulativeFilledQuantity-requestedQuantity)>1e-10) {
        issues.push('INVALID_FULL_FILL');break;
      }
      filledQuantity=e.cumulativeFilledQuantity;status='FILLED';
    } else if (e.type==='cancel_confirmed') {
      if (!['ACCEPTED','PARTIALLY_FILLED'].includes(status) ||
        Math.abs(e.cumulativeFilledQuantity-filledQuantity)>1e-10) {
        issues.push('CANCEL_NOT_RECONCILED');break;
      }
      status='CANCELED';
    } else {
      if (e.cumulativeFilledQuantity!==filledQuantity) {issues.push('REJECT_NOT_RECONCILED');break;}
      status='REJECTED';
    }
  }
  if (issues.length) status='INCONSISTENT';
  return Object.freeze({schema:'JENIOS_ULTRA_V2_ORDER_OBSERVATION_V1',clientOrderId,status,
    filledQuantity,remainingQuantity:round(Math.max(0,requestedQuantity-filledQuantity)),
    observedEvents:seen.size,requiresManualReconciliation:issues.length>0||
      ['ACCEPTED','PARTIALLY_FILLED'].includes(status),
    issues:Object.freeze(issues),externalStateNotAsserted:true,ordersSent:0});
}

export function validateUltraExchangeReadiness(x) {
  if (!x || typeof x.venue!=='string' || !/^[a-z0-9_-]{2,30}$/i.test(x.venue) ||
    typeof x.publicMarketDataAvailable!=='boolean' ||
    typeof x.authenticatedPaperVerified!=='boolean' ||
    typeof x.realAccountApproved!=='boolean' ||
    typeof x.reconciliationCertified!=='boolean' ||
    typeof x.killSwitchCertified!=='boolean' ||
    typeof x.stopProtectionCertified!=='boolean' ||
    typeof x.regulatoryReviewComplete!=='boolean') fail('ULTRA_V2_EXCHANGE_INVALID');
  const missing=[];
  for (const [key,ok] of [
    ['PUBLIC_MARKET_DATA',x.publicMarketDataAvailable],
    ['EXTERNAL_PAPER_AUTH',x.authenticatedPaperVerified],
    ['REAL_ACCOUNT_APPROVAL',x.realAccountApproved],
    ['RECONCILIATION',x.reconciliationCertified],
    ['KILL_SWITCH',x.killSwitchCertified],
    ['STOP_PROTECTION',x.stopProtectionCertified],
    ['REGULATORY_REVIEW',x.regulatoryReviewComplete]
  ]) if(!ok) missing.push(key);
  return Object.freeze({venue:x.venue,publicDataCanBeStudied:x.publicMarketDataAvailable,
    blockers:Object.freeze(missing),brokerReadyOnEvidence:missing.length===0,
    // This module is deliberately read-only; even complete evidence never enables live orders.
    liveExecutionEnabled:false,activationRequiresSeparateOwnerApproval:true,ordersSent:0});
}

export function produceUltraExecutionProposal({candidate,feed,risk,execution,exchange}={}) {
  if (!candidate || !feed || !risk || !execution || !exchange ||
    typeof candidate.eligible!=='boolean' || typeof feed.allow!=='boolean' ||
    typeof risk.allow!=='boolean' || typeof execution.allowProposal!=='boolean' ||
    typeof exchange.publicDataCanBeStudied!=='boolean') fail('ULTRA_V2_PROPOSAL_INVALID');
  const blockers=[...(!candidate.eligible?['CANDIDATE_BLOCKED']:[]),...(!feed.allow?feed.issues:[]),
    ...(!risk.allow?risk.issues:[]),...(!execution.allowProposal?execution.reasons:[]),
    ...(!exchange.publicDataCanBeStudied?['PUBLIC_FEED_NOT_AVAILABLE']:[])];
  return Object.freeze({type:'ANALYST_ONLY_PROPOSAL',eligible:!blockers.length,
    blockers:Object.freeze([...new Set(blockers)]),preferredExecutionStyle:execution.preferred,
    externalPaperEnabled:false,liveExecutionEnabled:false,ordersSent:0});
}