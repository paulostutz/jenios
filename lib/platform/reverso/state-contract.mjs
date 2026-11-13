import { available, unavailable, emptyOwnerState, validateOwnerState } from '../ultra/web/state-contract.mjs';
import { decimal8, format8 } from '../ultra/client/reporting.mjs';
import { units12, OPERATION_STATES } from '../ultra/operation.mjs';
import { assertReceipt } from '../../pay/central-billing-client.mjs';
import { REVERSO_OFFERS } from './access.mjs';
export { available, unavailable };
export const REVERSO_STATE_SCHEMA = 'REVERSO_OWNER_STATE_V1';
export const REVERSO_SECTION_NAMES = Object.freeze(['entitlement', 'wallet', 'operations', 'performance', 'cycles', 'obligations', 'policy']);
const fail = () => { throw Error('REVERSO_INVALID_OWNER_STATE'); };
const text = (v, max = 160) => { if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u001f]/.test(v)) fail(); return v; };
const bool = v => { if (typeof v !== 'boolean') fail(); return v; };
const integer = v => { if (!Number.isSafeInteger(v) || v < 0) fail(); return v; };
const nullable = (v, fn) => v == null ? null : fn(v);
const time = v => { text(v, 40); if (!Number.isFinite(Date.parse(v))) fail(); return v; };
const choice = (v, values) => { if (!values.includes(v)) fail(); return v; };
const month = v => { if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) fail(); return v; };
const array = (v, fn, max = 200) => { if (!Array.isArray(v) || v.length > max) fail(); return v.map(x => fn(x)); };
const decimal = v => { decimal8(v); return v; };
const quantity = v => { units12(v); return v; };
const nonnegative = v => { decimal(v); if (decimal8(v) < 0n) fail(); return v; };
const robot = v => { if (v !== 'reverso') fail(); return v; };
const environment = v => choice(v, ['live', 'demo']);
const currency = v => choice(v, ['BRL', 'USD', 'EUR', 'USDT']);
const rate = v => choice(v, [null, 10, 20]);
const reason = v => nullable(v, x => text(x, 500));
const unique = (rows, key) => { const keys = rows.map(key); if (new Set(keys).size !== keys.length) fail(); return rows; };
export const reversoOperationScopeKey = r => JSON.stringify([r.robotId, r.provider, r.accountId, r.connectionId, r.environment, r.month, r.id]);
export const reversoPeriodScopeKey = p => JSON.stringify([p.robotId, p.month, p.provider, p.environment, p.currency, [...p.accountIds].sort()]);

export function emptyReversoState({ subject, now = Date.now() } = {}) {
  text(subject);
  return { schema: REVERSO_STATE_SCHEMA, robotId: 'reverso', owner: { platform: 'jenios', subject }, generatedAt: new Date(now).toISOString(),
    offers: REVERSO_OFFERS.map(o => ({ id: o.planId, interval: o.interval, name: o.planName, priceMinor: o.amountCents, currency: o.currency, months: o.months })),
    sections: Object.fromEntries(REVERSO_SECTION_NAMES.map(name => [name, unavailable()])),
    capabilities: { liveExecutionVerified: false, realBillingVerified: false, checkoutEnabled: false } };
}

function projectEntitlement(d) {
  if (!d || typeof d !== 'object') fail();
  const r = { robotId: robot(d.robotId), planId: nullable(d.planId, text), planName: nullable(d.planName, text),
    amountCents: nullable(d.amountCents, integer), currency: choice(d.currency ?? 'BRL', ['BRL']),
    interval: choice(d.interval ?? null, [null, 'month', 'year', 'contract']),
    status: choice(d.status, ['active', 'pending', 'uncertain', 'expired', 'revoked', 'blocked', 'unavailable', 'cancelled', 'scheduled']),
    paymentStatus: choice(d.paymentStatus, ['confirmed', 'not_started', 'paid', 'pending', 'uncertain', 'unavailable', 'cancelled', 'refunded', 'void', 'expired']),
    accessGranted: bool(d.accessGranted), accessObserved: bool(d.accessObserved ?? false), periodStart: nullable(d.periodStart, time), periodEnd: nullable(d.periodEnd, time),
    performanceRate: rate(d.performanceRate ?? null), reason: reason(d.reason), cancelAtPeriodEnd: bool(d.cancelAtPeriodEnd ?? false),
    sourceValidUntil: nullable(d.sourceValidUntil ?? d.source?.validUntil, time) };
  if (r.accessGranted && (r.status !== 'active' || !['paid', 'confirmed'].includes(r.paymentStatus) || !r.periodStart || !r.periodEnd)) fail();
  if (r.periodStart && r.periodEnd && Date.parse(r.periodEnd) <= Date.parse(r.periodStart)) fail();
  return r;
}

export function projectReversoOperation(o, { mode, observedAt } = {}) {
    environment(mode); time(observedAt);
    const r = { id: text(o.id), robotId: robot(o.robotId), connectionId: text(o.connectionId), accountId: text(o.accountId),
      provider: choice(o.provider, ['binance', 'profit', 'mt5']), environment: environment(o.environment), currency: currency(o.currency),
      month: nullable(o.month, month), symbol: text(o.symbol, 50), state: choice(o.state, Object.keys(OPERATION_STATES)), side: choice(o.side, ['buy', 'sell']),
      quantity: quantity(o.quantity), openedAt: nullable(o.openedAt, time), closedAt: nullable(o.closedAt, time),
      gross: nullable(o.gross, decimal), fees: nullable(o.fees, decimal), financing: nullable(o.financing, decimal),
      net: null, costsComplete: bool(o.costsComplete) };
    if (mode === 'demo' && r.environment !== 'demo') fail();
    if (r.openedAt && Date.parse(r.openedAt) > Date.parse(observedAt) || r.closedAt && Date.parse(r.closedAt) > Date.parse(observedAt) ||
        r.openedAt && r.closedAt && Date.parse(r.closedAt) < Date.parse(r.openedAt)) fail();
    if (r.state === 'closed' && r.costsComplete && r.closedAt && [r.gross, r.fees, r.financing].every(x => x !== null)) {
      const net = format8(decimal8(r.gross) - decimal8(r.fees) - decimal8(r.financing));
      if (o.net != null && decimal8(decimal(o.net)) !== decimal8(net)) fail();
      r.net = net;
    }
    return r;
}

function projectOperations(d, mode, observedAt) {
  if (!d || typeof d !== 'object') fail();
  const rows = array(d.rows, o => projectReversoOperation(o, { mode, observedAt }));
  unique(rows, reversoOperationScopeKey);
  return { rows, hasMore: bool(d.hasMore), costsPending: nullable(d.costsPending, integer) };
}

export function projectReversoPerformancePeriod(p, { mode } = {}) {
    environment(mode);
    const r = { id: text(p.id), obligationId: nullable(p.obligationId, text), robotId: robot(p.robotId), month: month(p.month),
      accountId: nullable(p.accountId, text), accountIds: array(p.accountIds ?? (p.accountId ? [p.accountId] : []), text, 20),
      provider: nullable(p.provider, v => choice(v, ['binance', 'profit', 'mt5', 'multiple'])),
      environment: environment(p.environment), currency: currency(p.currency),
      gains: nullable(p.gains, nonnegative), losses: nullable(p.losses, nonnegative), fees: nullable(p.fees, decimal),
      financing: nullable(p.financing, decimal), eligiblePlatformCosts: nullable(p.eligiblePlatformCosts, nonnegative),
      brokerNet: nullable(p.brokerNet, decimal), costs: nullable(p.costs, decimal), net: nullable(p.net, decimal),
      eligibleNet: nullable(p.eligibleNet, decimal), performanceRate: rate(p.performanceRate ?? null), participation: null,
      status: choice(p.status, ['pending', 'unavailable', 'ready_in_test', 'no_performance_due_in_test', 'assessed', 'no_performance_due']),
      reason: reason(p.reason), pendingReasons: array(p.pendingReasons ?? [], v => text(v, 120), 100), timeZone: nullable(p.timeZone, v => text(v, 80)) };
    unique(r.accountIds, x => x);
    if (r.obligationId !== null && r.obligationId !== r.id) fail();
    if (mode === 'demo' && (r.environment !== 'demo' || ['assessed', 'no_performance_due'].includes(r.status))) fail();
    if ([r.fees, r.financing, r.eligiblePlatformCosts, r.costs].every(x => x !== null) && decimal8(r.fees) + decimal8(r.financing) + decimal8(r.eligiblePlatformCosts) !== decimal8(r.costs)) fail();
    if ([r.gains, r.losses, r.fees, r.financing, r.brokerNet].every(x => x !== null) && decimal8(r.gains) - decimal8(r.losses) - decimal8(r.fees) - decimal8(r.financing) !== decimal8(r.brokerNet)) fail();
    if ([r.gains, r.losses, r.costs, r.net].every(x => x !== null) && decimal8(r.gains) - decimal8(r.losses) - decimal8(r.costs) !== decimal8(r.net)) fail();
    const complete = ['ready_in_test', 'no_performance_due_in_test', 'assessed', 'no_performance_due'].includes(r.status);
    if (complete) {
      if (r.currency !== 'BRL') fail();
      if (r.pendingReasons.length || [r.gains, r.losses, r.fees, r.financing, r.eligiblePlatformCosts, r.costs, r.net, r.eligibleNet, r.performanceRate].some(x => x === null)) fail();
      const net = decimal8(r.net), maximum = net > 0n ? net : 0n;
      if (decimal8(r.eligibleNet) > maximum) fail();
      const eligible = decimal8(r.eligibleNet), numerator = (eligible > 0n ? eligible : 0n) * BigInt(r.performanceRate);
      if (numerator % 100n !== 0n) fail();
      const expected = numerator / 100n;
      if (p.participation == null || decimal8(nonnegative(p.participation)) !== expected) fail();
      if (r.status.startsWith('no_performance_due') && expected !== 0n) fail();
      r.participation = format8(expected);
    }
    return r;
}

function projectPerformance(d, mode) {
  if (!d || typeof d !== 'object') fail();
  const periods = array(d.periods, p => projectReversoPerformancePeriod(p, { mode }), 120);
  unique(periods, r => r.id);
  unique(periods, reversoPeriodScopeKey);
  return { periods };
}

// Server adapter used before public projection: the existing central receipt
// validator requires the original obligation. Assessment is never payment.
export function confirmedReversoObligation(o, { customerId, binding, now = Date.now() } = {}) {
  const result = { ...o, paymentConfirmed: false, paidAt: null };
  const proof = o.paymentEvidence;
  if (o.paymentStatus === 'paid') {
    result.paymentStatus = 'uncertain';
    const expected = binding?.expected;
    if (proof?.robotId === 'reverso' && proof.obligationId === o.id && binding?.robotId === 'reverso' &&
        binding.obligationId === o.id && binding.customerId === customerId && binding.month === o.month && binding.confirmed === true &&
        expected?.external_invoice_id === o.id && expected.customer_id === customerId && expected.purpose === 'reverso_monthly_performance' &&
        expected.product === 'jenios' && expected.amount_cents === o.amountMinor && expected.currency === o.currency && validObligationPeriod(binding)) {
      assertReceipt(proof.receipt, expected);
      if (proof.receipt.state === 'paid' && proof.receipt.verified_paid === true && Date.parse(proof.receipt.confirmed_at) <= now &&
          Date.parse(proof.receipt.confirmed_at) >= Date.parse(expected.period_end)) {
        result.paymentStatus = 'paid'; result.paymentConfirmed = true; result.paidAt = time(proof.receipt.confirmed_at);
      }
    }
  }
  delete result.paymentEvidence;
  return result;
}

function validObligationPeriod(binding) {
  try {
    const start = Date.parse(binding.expected.period_start), end = Date.parse(binding.expected.period_end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !binding.timeZone) return false;
    const parts = value => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: binding.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(value).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    const a = parts(start), b = parts(end), next = new Date(Date.UTC(Number(a.year), Number(a.month), 1));
    return `${a.year}-${a.month}` === binding.month && a.day === '01' && b.day === '01' &&
      [a.hour, a.minute, a.second, b.hour, b.minute, b.second].every(v => v === '00') &&
      `${b.year}-${b.month}` === next.toISOString().slice(0, 7);
  } catch { return false; }
}

function projectObligations(rows, mode) {
  return unique(array(rows, o => {
    const r = { id: text(o.id), robotId: robot(o.robotId), month: month(o.month), currency: choice(o.currency, ['BRL']),
      amountMinor: nullable(o.amountMinor, integer), status: text(o.status, 80),
      paymentStatus: choice(o.paymentStatus ?? 'unavailable', ['pending', 'uncertain', 'paid', 'unavailable', 'cancelled']),
      paymentConfirmed: false, paidAt: null };
    if (r.paymentStatus === 'paid') {
      if (mode === 'live' && o.paymentConfirmed === true && o.paidAt) { r.paymentConfirmed = true; r.paidAt = time(o.paidAt); }
      else r.paymentStatus = 'uncertain';
    }
    return r;
  }), r => r.id);
}

export function validateReversoState(raw, { subject, now = Date.now(), maxAgeMs = 60000 } = {}) {
  if (raw?.schema !== REVERSO_STATE_SCHEMA || raw.robotId !== 'reverso' || raw.owner?.platform !== 'jenios' || raw.owner.subject !== subject) fail();
  time(raw.generatedAt);
  if (Date.parse(raw.generatedAt) > now + 5000 || now - Date.parse(raw.generatedAt) > maxAgeMs) fail();
  const state = emptyReversoState({ subject, now }); state.generatedAt = raw.generatedAt;
  for (const name of REVERSO_SECTION_NAMES) {
    const s = raw.sections?.[name];
    if (!s || s.status === 'unavailable') { state.sections[name] = unavailable(s?.reason ? text(s.reason, 500) : undefined); continue; }
    if (s.status !== 'available') fail();
    const observedAt = time(s.observedAt), mode = environment(s.mode);
    if (Date.parse(observedAt) > now + 5000 || now - Date.parse(observedAt) > maxAgeMs) fail();
    let data;
    if (name === 'entitlement') {
      data = projectEntitlement(s.data);
      if (data.status !== 'unavailable' && (!data.sourceValidUntil || Date.parse(data.sourceValidUntil) <= now)) fail();
      if (mode === 'demo') data.accessGranted = false;
      if (data.accessGranted && (Date.parse(data.periodStart) > now || Date.parse(data.periodEnd) <= now)) fail();
    } else if (name === 'operations') data = projectOperations(s.data, mode, observedAt);
    else if (name === 'performance') data = projectPerformance(s.data, mode);
    else if (name === 'obligations') { data = projectObligations(s.data, mode); if (data.some(o => o.paidAt && Date.parse(o.paidAt) > now)) fail(); }
    else if (name === 'policy') data = { status: choice(s.data?.status, ['approved', 'pending', 'unavailable']), reason: reason(s.data?.reason) };
    else if (name === 'wallet') {
      const w = s.data;
      data = { currency: choice(w?.currency, ['BRL']), balanceMinor: nullable(w.balanceMinor, integer),
        availableMinor: nullable(w.availableMinor, integer), reservedMinor: nullable(w.reservedMinor, integer),
        pendingMinor: nullable(w.pendingMinor, integer), suspended: bool(w.suspended ?? false), debitAuthorized: false };
      if (data.balanceMinor !== null && data.availableMinor !== null && data.reservedMinor !== null && data.balanceMinor - data.reservedMinor !== data.availableMinor) fail();
    }
    else {
      // Reuse established wallet/cycle field validation without reading or
      // relabelling any Ultra identity, entitlement or financial state.
      const shared = emptyOwnerState({ platform: 'jenios', subject, now }); shared.sections[name] = s;
      data = validateOwnerState(shared, { platform: 'jenios', subject, now, maxAgeMs }).sections[name].data;
      if (name === 'cycles') { for (const cycle of s.data) robot(cycle.robotId); data = data.map(c => ({ ...c, robotId: 'reverso' })); }
    }
    state.sections[name] = available(data, { mode, observedAt });
  }
  return state;
}
