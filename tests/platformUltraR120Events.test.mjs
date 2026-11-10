import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeBinanceEventR120 as normalize } from '../lib/platform/ultra/client/binance-events-r120.mjs';
import { canonicalProtocolJson } from '../lib/platform/ultra/client/binance-action-journal-r119.mjs';

const now = 1794300000000;
const binding = product => ({ product, environment: 'demo', keyFingerprint: 'a'.repeat(64), mode: 'offline_fixture' });
const spot = patch => ({ e: 'executionReport', E: now, T: now - 1, s: 'BTCUSDT', c: 'ju_fixture',
  S: 'BUY', o: 'LIMIT', f: 'GTC', q: '1.00000000', p: '100.00000000', P: '0', F: '0', g: -1,
  C: '', x: 'TRADE', X: 'PARTIALLY_FILLED', r: 'NONE', i: '90071992547409931',
  I: '90071992547409932', l: '0.20000000', z: '0.60000000', L: '100.00000000',
  n: '0.000000000000000001', N: 'BNB', t: '90071992547409933', w: true, m: false,
  M: false, O: now - 1000, Z: '60.00000000', Y: '20.00000000', Q: '0', ...patch });
const futures = (patch, outer = {}) => ({ e: 'ORDER_TRADE_UPDATE', E: now, T: now - 1,
  o: { s: 'BTCUSDT', c: 'ju_fixture', S: 'SELL', o: 'LIMIT', f: 'GTC', q: '1', p: '100', ap: '100',
    x: 'TRADE', X: 'PARTIALLY_FILLED', i: '90071992547409931', l: '0.2', z: '0.6', L: '100',
    N: 'USDT', n: '0.002', T: now - 2, t: '90071992547409934', m: false, R: false,
    ps: 'BOTH', cp: false, rp: '-0.000000000000000001', ...patch }, ...outer });
const algo = (patch, outer = {}) => ({ e: 'ALGO_UPDATE', E: now, T: now - 1,
  o: { caid: 'js_fixture', aid: '90071992547409935', at: 'CONDITIONAL', o: 'STOP_MARKET',
    s: 'BTCUSDT', S: 'SELL', ps: 'BOTH', f: 'GTC', q: '1', X: 'NEW', ai: '', tp: '95', p: '0',
    wt: 'MARK_PRICE', cp: false, pP: false, R: true, tt: 0, gtd: 0, ...patch }, ...outer });
const list = patch => ({ e: 'listStatus', E: now, T: now - 1, s: 'BTCUSDT', g: '90071992547409936',
  c: 'OCO', l: 'EXEC_STARTED', L: 'EXECUTING', r: 'NONE', C: 'jl_fixture',
  O: [{ s: 'BTCUSDT', i: '90071992547409937', c: 'js_fixture' },
    { s: 'BTCUSDT', i: '90071992547409938', c: 'jt_fixture' }], ...patch });
const n = (payload, product = 'spot', extra = {}) => normalize({ binding: binding(product), payload, ...extra });

test('Spot preserves exact native identities, last/cumulative fills and commission asset', () => {
  const event = n(spot());
  assert.equal(event.kind, 'order'); assert.equal(event.orderId, '90071992547409931');
  assert.equal(event.executionId, '90071992547409932'); assert.equal(event.tradeId, '90071992547409933');
  assert.equal(event.requestedQuantity, '1'); assert.equal(event.lastFilledQuantity, '0.2');
  assert.equal(event.cumulativeFilledQuantity, '0.6'); assert.equal(event.cumulativeQuoteQuantity, '60');
  assert.equal(event.lastQuoteQuantity, '20'); assert.equal(event.averagePrice, null);
  assert.deepEqual(event.commission, { amount: '0.000000000000000001', asset: 'BNB', tradeId: event.tradeId, scope: 'last_execution', convertedAmount: null });
  assert.equal(event.semanticStatus, 'partially_filled'); assert.equal(event.transactionTime, String(now - 1));
  assert.deepEqual(event.lookupReferences, [{ kind: 'order', symbol: 'BTCUSDT', clientId: 'ju_fixture', nativeId: event.orderId }]);
});
test('canonical object and digest match R119 inbox serialization without mutating caller', () => {
  const payload = spot(), before = structuredClone(payload), event = n(payload);
  assert.deepEqual(payload, before); assert.equal(Object.isFrozen(payload), false);
  assert.equal(Object.isFrozen(event), true); assert.equal(Object.isFrozen(event.canonicalPayload), true);
  assert.equal(Object.isFrozen(event.lookupReferences[0]), true);
  assert.equal(event.payloadDigest, createHash('sha256').update(canonicalProtocolJson(event.canonicalPayload)).digest('hex'));
  assert.throws(() => { event.canonicalPayload.z = '999'; });
});
test('Spot subscription envelopes are metadata, not event identity or conflict payload', () => {
  const bare = n(spot()), wrapped = n({ subscriptionId: 7, event: spot() }), resubscribed = n({ subscriptionId: '90071992547409939', event: spot() });
  assert.equal(wrapped.subscriptionId, '7'); assert.equal(resubscribed.subscriptionId, '90071992547409939');
  for (const event of [wrapped, resubscribed]) {
    assert.equal(event.identityKey, bare.identityKey); assert.equal(event.payloadDigest, bare.payloadDigest);
    assert.deepEqual(event.canonicalPayload, bare.canonicalPayload);
    assert.equal('subscriptionId' in event.canonicalPayload, false);
  }
});
test('field order and equivalent native decimal representations are deterministic', () => {
  const original = spot(), reversed = Object.fromEntries(Object.entries(original).reverse());
  const a = n(original), b = n({ ...reversed, q: '1', z: '0.600', E: String(now), T: String(now - 1) });
  assert.equal(a.identityKey, b.identityKey); assert.equal(a.payloadDigest, b.payloadDigest);
});
test('duplicate Spot execution identity with different content exposes a conflict', () => {
  const a = n(spot()), b = n(spot({ n: '0.1' })), c = n(spot({ z: '0.7' })), d = n(spot({ E: now + 1 }));
  for (const event of [b, c, d]) { assert.equal(event.identityKey, a.identityKey); assert.notEqual(event.payloadDigest, a.payloadDigest); }
  assert.notEqual(n(spot({ I: '90071992547409940' })).identityKey, a.identityKey);
});
test('out-of-order and replay normalization is stateless, never a cumulative fill delta', () => {
  const earlier = spot({ I: '10', t: '11', l: '0.2', z: '0.2', E: now - 5, T: now - 6 });
  const later = spot({ I: '12', t: '13', l: '0.4', z: '0.6' });
  const a = n(later), b = n(earlier), replay = n(later);
  assert.deepEqual(a, replay); assert.equal(b.cumulativeFilledQuantity, '0.2');
  assert.equal(a.lastFilledQuantity, '0.4'); assert.equal(a.sequenceGuaranteed, false); assert.equal(a.sequence, null);
  assert.equal(b.needsReconciliation, true);
});
test('cancel carries prior cumulative fills and original ID, never a fresh fill', () => {
  const event = n(spot({ c: 'cancel_fixture', C: 'ju_fixture', x: 'CANCELED', X: 'CANCELED', l: '0', L: '0', t: -1, n: '0', N: null }));
  assert.equal(event.lastFilledQuantity, '0'); assert.equal(event.cumulativeFilledQuantity, '0.6');
  assert.equal(event.tradeId, null); assert.equal(event.terminal, true); assert.equal(event.origClientOrderId, 'ju_fixture');
  assert.equal(event.lookupReferences.length, 2); assert.equal(event.lookupReferences[1].clientId, 'ju_fixture');
});
test('Spot list events retain child identities without implying protection or child fills', () => {
  const event = n(list()); assert.equal(event.kind, 'list'); assert.equal(event.lookupReferences.length, 3);
  assert.equal(event.lookupReferences[0].kind, 'list'); assert.equal(event.orderListId, '90071992547409936');
  assert.equal(event.lookupReferences[1].nativeId, '90071992547409937'); assert.equal(event.lastFilledQuantity, null);
  const done = n(list({ l: 'ALL_DONE', L: 'ALL_DONE' }));
  assert.equal(done.semanticStatus, 'finished_not_fill_proof'); assert.equal(done.positionClosed, false);
  assert.equal(done.protectionInstalled, false); assert.notEqual(event.identityKey, done.identityKey);
  assert.notEqual(event.payloadDigest, n(list({ r: 'OTHER' })).payloadDigest);
  assert.equal(event.identityKey, n(list({ r: 'OTHER' })).identityKey);
});
test('list children reject duplicated identifiers, foreign symbol or malformed shape', () => {
  for (const children of [null, [{ s: 'ETHUSDT', i: '1', c: 'a' }],
    [{ s: 'BTCUSDT', i: '1', c: 'a' }, { s: 'BTCUSDT', i: '1', c: 'b' }],
    [{ s: 'BTCUSDT', i: '1', c: 'a' }, { s: 'BTCUSDT', i: '2', c: 'a' }]]) assert.throws(() => n(list({ O: children })));
});
test('Futures nested fields distinguish trade, order time, reduce-only and reported gross result', () => {
  const event = n(futures(), 'usds_m_futures');
  assert.equal(event.tradeId, '90071992547409934'); assert.equal(event.eventTime, String(now));
  assert.equal(event.transactionTime, String(now - 1)); assert.equal(event.tradeTime, String(now - 2));
  assert.equal(event.lastFilledQuantity, '0.2'); assert.equal(event.cumulativeFilledQuantity, '0.6');
  assert.equal(event.reportedRealizedProfit, '-0.000000000000000001'); assert.equal(event.netProfit, null);
  assert.equal(event.positionSide, 'BOTH'); assert.equal(event.side, 'SELL'); assert.equal(event.averagePrice, '100');
});
test('Futures trade identity detects replay content changes independently of event delivery time', () => {
  const a = n(futures(), 'usds_m_futures'), b = n(futures({ z: '0.7' }), 'usds_m_futures');
  const c = n(futures({}, { E: now + 100 }), 'usds_m_futures');
  for (const event of [b, c]) { assert.equal(event.identityKey, a.identityKey); assert.notEqual(event.payloadDigest, a.payloadDigest); }
  assert.notEqual(n(futures({ t: '90071992547409940' }), 'usds_m_futures').identityKey, a.identityKey);
});
test('Futures non-trades have time tuples and sentinel trade ID is not a fill identity', () => {
  const payload = futures({ x: 'NEW', X: 'NEW', l: '0', z: '0', L: '0', t: 0, n: '0' });
  const a = n(payload, 'usds_m_futures'), b = n({ ...payload, E: now + 1 }, 'usds_m_futures');
  assert.equal(a.tradeId, null); assert.equal(a.identityStrength, 'conservative_native_tuple');
  assert.notEqual(a.identityKey, b.identityKey); assert.equal(a.positionClosed, false);
});
test('ALGO_UPDATE correctly separates conditional algo ID from actual matching-engine order', () => {
  const waiting = n(algo(), 'usds_m_futures');
  assert.equal(waiting.algoId, '90071992547409935'); assert.equal(waiting.clientAlgoId, 'js_fixture');
  assert.equal(waiting.actualOrderId, null); assert.equal(waiting.semanticStatus, 'waiting_trigger');
  const finished = n(algo({ X: 'FINISHED', ai: '90071992547409941', ap: '94.5', aq: '1', act: 'MARKET', tt: now - 5 }), 'usds_m_futures');
  assert.equal(finished.reportedActualExecutedQuantity, '1'); assert.equal(finished.cumulativeFilledQuantity, null);
  assert.equal(finished.lastFilledQuantity, null); assert.equal(finished.semanticStatus, 'finished_not_fill_proof');
  assert.deepEqual(finished.lookupReferences[1], { kind: 'order', symbol: 'BTCUSDT', clientId: null, nativeId: '90071992547409941' });
  assert.equal(finished.positionClosed, false); assert.equal(finished.financialRecordPending, true);
});
test('all documented algo states remain evidence only, including failed or canceled triggered orders', () => {
  for (const X of ['NEW', 'CANCELED', 'TRIGGERING', 'TRIGGERED', 'FINISHED', 'REJECTED', 'EXPIRED']) {
    const event = n(algo({ X }), 'usds_m_futures');
    assert.equal(event.status, X); assert.equal(event.protectionInstalled, false); assert.equal(event.netProfit, null);
    assert.equal(event.needsReconciliation, true); assert.equal(event.evidenceAuthenticated, false);
  }
  const a = n(algo(), 'usds_m_futures'), b = n(algo({ tp: '94' }), 'usds_m_futures');
  assert.equal(a.identityKey, b.identityKey); assert.notEqual(a.payloadDigest, b.payloadDigest);
});
test('unknown events are explicitly unsupported, with no synthetic order references', () => {
  const event = n({ e: 'FutureEvent', E: now, T: now - 1, s: 'BTCUSDT', i: '1', x: 'TRADE', amount: '42' });
  assert.equal(event.kind, 'unknown'); assert.equal(event.recognized, false); assert.equal(event.status, 'UNSUPPORTED_EVENT');
  assert.equal(event.identityStrength, 'payload_only'); assert.equal(event.symbol, null); assert.deepEqual(event.lookupReferences, []);
  assert.deepEqual(event, n({ e: 'FutureEvent', E: now, T: now - 1, s: 'BTCUSDT', i: '1', x: 'TRADE', amount: '42' }));
  assert.equal(n({ e: 'ACCOUNT_UPDATE', E: now, a: {} }, 'usds_m_futures').recognized, false);
});
test('stream termination is recognized but listen keys are never admitted', () => {
  for (const [product, e] of [['spot', 'eventStreamTerminated'], ['usds_m_futures', 'listenKeyExpired']]) {
    const event = n({ e, E: now }, product); assert.equal(event.kind, 'stream'); assert.equal(event.status, 'TERMINATED');
    assert.equal(event.needsReconciliation, true); assert.equal(event.protectionInstalled, false);
  }
  assert.throws(() => n({ e: 'listenKeyExpired', E: now, listenKey: 'must_not_enter' }, 'usds_m_futures'), /CREDENTIAL/);
});
test('strict synthetic context and event-family product binding reject mislabeling', () => {
  for (const patch of [{ product: 'coin_m_futures' }, { environment: 'live' }, { mode: 'live' },
    { mode: undefined }, { keyFingerprint: 'bad' }, { accountId: '1' }]) {
    assert.throws(() => normalize({ binding: { ...binding('spot'), ...patch }, payload: spot() }));
  }
  assert.throws(() => n(spot(), 'usds_m_futures'), /PRODUCT_MISMATCH/);
  assert.throws(() => n(futures(), 'spot'), /PRODUCT_MISMATCH/);
  assert.throws(() => n(algo(), 'spot'), /PRODUCT_MISMATCH/);
  assert.throws(() => n(spot({ product: 'usds_m_futures' })), /BINDING_REJECTED/);
  const a = n(spot()), b = n(spot(), 'spot', { binding: { ...binding('spot'), keyFingerprint: 'b'.repeat(64) } });
  assert.notEqual(a.identityKey, b.identityKey);
});
test('credentials, arbitrary wrappers, subscription confusion and REST ACK are rejected', () => {
  for (const payload of [{ subscriptionId: 0, event: spot(), e: 'executionReport' },
    { event: spot() }, { data: spot(), stream: 'not_an_event' },
    { ...spot(), subscriptionId: 0 }, { event: { event: spot() }, subscriptionId: 0 },
    { id: '1', status: 200, result: { orderId: '1' } }, spot({ extra: { secret: 'never_store' } }),
    spot({ headers: {} }), spot({ apiKey: 'never_store' })]) assert.throws(() => n(payload));
  assert.throws(() => n({ subscriptionId: 0, event: futures() }, 'usds_m_futures'), /ENVELOPE_PRODUCT_MISMATCH/);
});
test('unsafe integer IDs or timestamps are rejected instead of being rounded', () => {
  for (const key of ['E', 'T', 'i', 'I', 't', 'g']) {
    assert.throws(() => n(spot({ [key]: Number.MAX_SAFE_INTEGER + 1 })), /UNSAFE_NUMBER/);
    assert.throws(() => n(spot({ [key]: '9223372036854775808' })), /INTEGER_INVALID/);
  }
  const event = n(spot({ E: '90071992547409999', T: '90071992547409998', i: '9223372036854775807' }));
  assert.equal(event.eventTime, '90071992547409999'); assert.equal(event.orderId, '9223372036854775807');
  for (const value of ['01', '-2', 1.1, NaN, Infinity, 1n]) assert.throws(() => n(spot({ i: value })));
});
test('timestamps retain explicit units and Futures rejects Spot microsecond mode', () => {
  const payload = spot({ E: '1794300000000001', T: '1794300000000000' });
  const a = n(payload), b = n(payload, 'spot', { timeUnit: 'MICROSECOND' });
  assert.equal(b.eventTime, '1794300000000001'); assert.equal(b.timeUnit, 'MICROSECOND');
  assert.notEqual(a.identityKey, b.identityKey);
  assert.throws(() => n(futures(), 'usds_m_futures', { timeUnit: 'MICROSECOND' }));
});
test('precision-invalid quantities and inconsistent fill/status combinations fail closed', () => {
  for (const patch of [{ q: 1 }, { z: '1e-8' }, { l: '-0.1' }, { n: '0.0000000000000000001' },
    { q: '01' }, { z: '1.1' }, { l: '0.7' }, { X: 'FILLED' }, { X: 'NEW' },
    { x: 'TRADE', l: '0' }, { x: 'CANCELED' }, { L: '0' }, { X: 'UNRECOGNIZED' },
    { x: 'UNRECOGNIZED' }, { q: undefined }, { n: '1', N: null }]) assert.throws(() => n(spot(patch)));
});
test('commission retains asset-denominated rebates and never mixes gross PnL with fees', () => {
  const event = n(futures({ n: '-0.000000000000000001', N: 'BNB', rp: '8' }), 'usds_m_futures');
  assert.equal(event.commission.amount, '-0.000000000000000001'); assert.equal(event.commission.asset, 'BNB');
  assert.equal(event.reportedRealizedProfit, '8'); assert.equal(event.netProfit, null);
  const missing = futures(); delete missing.o.n; delete missing.o.N;
  assert.equal(n(missing, 'usds_m_futures').commission, null);
});
test('Spot MARKET quote sizing and Unicode symbols are preserved without numeric assumptions', () => {
  const event = n(spot({ s: '币USDT', o: 'MARKET', q: '0', Q: '60', z: '0.6', X: 'FILLED', N: '币' }));
  assert.equal(event.symbol, '币USDT'); assert.equal(event.requestedQuantity, '0');
  assert.equal(event.cumulativeFilledQuantity, '0.6'); assert.equal(event.positionClosed, false);
  assert.throws(() => n(futures({ o: 'MARKET', q: '0', Q: '60', z: '0.6', X: 'FILLED' }), 'usds_m_futures'), /QUANTITY_INCONSISTENT/);
  for (const X of ['PENDING_NEW', 'PENDING_CANCEL', 'REJECTED']) assert.throws(() => n(futures({ X }), 'usds_m_futures'), /ENUM_UNSUPPORTED/);
});
test('filled orders never authorize execution, prove protection, close an account position or finalize accounting', () => {
  for (const event of [n(spot({ z: '1', X: 'FILLED' })), n(futures({ z: '1', X: 'FILLED', R: true }), 'usds_m_futures')]) {
    assert.equal(event.terminal, true); assert.equal(event.semanticStatus, 'filled');
    assert.equal(event.canSubmit, false); assert.equal(event.ordersSent, 0); assert.equal(event.protectionInstalled, false);
    assert.equal(event.positionClosed, false); assert.equal(event.netProfit, null); assert.equal(event.financialRecordPending, true);
  }
});
test('non-JSON/accessor/prototype/cyclic/oversized data rejected without invoking accessors', () => {
  let invoked = false; const accessor = spot(); Object.defineProperty(accessor, 'malicious', { enumerable: true, get() { invoked = true; return 'bad'; } });
  assert.throws(() => n(accessor)); assert.equal(invoked, false);
  const cycle = spot(); cycle.other = cycle;
  const sparse = spot({ other: new Array(2) });
  for (const payload of [cycle, sparse, spot({ unknown: new Date() }),
    spot({ unknown: 'x'.repeat(4097) }), JSON.parse('{"e":"x","E":1,"__proto__":{}}')]) assert.throws(() => n(payload));
});
test('module is pure offline code with no transport, credential access, persistence or mutation endpoint', () => {
  const source = readFileSync(new URL('../lib/platform/ultra/client/binance-events-r120.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\s*\(|process\.env|node:(?:fs|https?|net)|localStorage|sessionStorage|\/fapi\/v1\/|\/api\/v3\//);
});
