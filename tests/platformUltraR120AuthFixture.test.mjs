import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BinanceAuthFixtureR120, binanceFixtureBindingR120, canonicalizeBinanceFixtureParamsR120,
  signBinanceFixtureR120, classifyBinanceFixtureOutcomeR120, redactBinanceFixtureLogR120}
  from '../lib/platform/ultra/client/binance-auth-fixture-r120.mjs';
import {buildSpotQueryRequest} from '../lib/platform/ultra/client/binance-spot-protocol-r119.mjs';

const NOW = 1700000000000;
const query = () => buildSpotQueryRequest({product: 'spot', symbol: 'BTCUSDT', origClientOrderId: 'fixture-120'});
const entry = () => ({...query(), method: 'POST', params: {symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT',
  timeInForce: 'GTC', quantity: '0.010', price: '100.00', newClientOrderId: 'fixture-120'}});
const futures = () => ({schema: 'JENIOS_ULTRA_BINANCE_UNSIGNED_REQUEST_R119', product: 'usds_m_futures',
  binding: binanceFixtureBindingR120('usds_m_futures'), method: 'POST', path: '/fapi/v1/order', signed: false, canSubmit: false,
  params: {symbol: 'BTCUSDT', side: 'SELL', positionSide: 'BOTH', type: 'MARKET', quantity: '0.001',
    reduceOnly: 'true', newClientOrderId: 'jc_fixture120', timestamp: NOW, recvWindow: 5000}});
const row = (request = query(), observation = {httpStatus: 200}) => ({method: request.method, path: request.path, observation});
const config = (rows = [row()], product = 'spot') => ({product, environment: 'demo', clock: {serverTimeMs: NOW, monotonicMs: 100}, responses: rows});
const harness = (observation = {httpStatus: 200}, request = query()) => new BinanceAuthFixtureR120(config([row(request, observation)], request.product));
const rejects = (fn, code) => assert.throws(fn, {code});

test('R120 HMAC known vector uses a public synthetic constant and stable sorted encoded bytes', () => {
  const params = {symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', timeInForce: 'GTC', quantity: '0.010', price: '100.00', timestamp: NOW, recvWindow: 5000};
  const result = signBinanceFixtureR120(params);
  assert.equal(result.canonicalQuery, 'price=100.00&quantity=0.010&recvWindow=5000&side=BUY&symbol=BTCUSDT&timeInForce=GTC&timestamp=1700000000000&type=LIMIT');
  // Independently verified with Python's hmac/hashlib; not a Binance account or server response.
  assert.equal(result.fixtureSignature, 'ced3c0c812d606ae9078886f4d24c297d7be4636ca7b0c78d1e38f4e84ce9d03');
  assert.deepEqual(signBinanceFixtureR120(Object.fromEntries(Object.entries(params).reverse())), result);
  assert.equal(result.fixtureOnly, true); assert.equal(result.nativeVerified, false); assert.equal(result.executable, false);
  assert.ok(Object.isFrozen(result));
});

test('R120 canonicalization encodes delimiters/unicode once and preserves exact decimal/id strings', () => {
  assert.equal(canonicalizeBinanceFixtureParamsR120({symbol: '１２３', origClientOrderId: "a/b:c &='!*()", orderId: '9007199254740993'}),
    'orderId=9007199254740993&origClientOrderId=a%2Fb%3Ac%20%26%3D%27%21%2A%28%29&symbol=%EF%BC%91%EF%BC%92%EF%BC%93');
  assert.equal(canonicalizeBinanceFixtureParamsR120({origClientOrderId: '%26'}), 'origClientOrderId=%2526');
  for (const value of [0.1, null, true, [], {}, () => '1']) rejects(() => canonicalizeBinanceFixtureParamsR120({quantity: value}), 'R120_FIXTURE_STRING_PARAMETER_REQUIRED');
  for (const key of ['apiKey', 'secret', 'signature', 'headers', 'url', 'unknown']) rejects(() => signBinanceFixtureR120({[key]: 'x'}), 'R120_FIXTURE_PARAMETER_REJECTED');
  rejects(() => signBinanceFixtureR120({symbol: '\ud800'}), 'R120_FIXTURE_INVALID_UNICODE');
  rejects(() => signBinanceFixtureR120({symbol: 'BTC\nUSDT'}), 'R120_FIXTURE_STRING_PARAMETER_REQUIRED');
  rejects(() => signBinanceFixtureR120({timestamp: '1700000000000'}), 'R120_FIXTURE_INVALID_TIME_PARAMETER');
  rejects(() => signBinanceFixtureR120({timestamp: Number.MAX_SAFE_INTEGER + 1}), 'R120_FIXTURE_INVALID_TIME_PARAMETER');
});

test('R120 accepts only data records, not getter/prototype/callback objects', () => {
  let invoked = false;
  const input = Object.defineProperty({}, 'symbol', {enumerable: true, get() { invoked = true; return 'BTCUSDT'; }});
  rejects(() => signBinanceFixtureR120(input), 'R120_FIXTURE_DATA_FIELDS_REQUIRED'); assert.equal(invoked, false);
  rejects(() => signBinanceFixtureR120(Object.create({symbol: 'BTCUSDT'})), 'R120_FIXTURE_JSON_OBJECT_REQUIRED');
  rejects(() => signBinanceFixtureR120({[Symbol('symbol')]: 'BTCUSDT'}), 'R120_FIXTURE_DATA_FIELDS_REQUIRED');
  for (const key of ['env', 'credentials', 'apiKey', 'secret', 'fetchImpl', 'transport', 'socket', 'origin', 'now']) {
    rejects(() => new BinanceAuthFixtureR120({...config(), [key]: () => { invoked = true; }}), 'R120_FIXTURE_UNSUPPORTED_FIELD');
  }
  assert.equal(invoked, false);
});

test('R120 scope cannot be switched to live, margin, COIN-M or a caller origin', () => {
  for (const environment of ['live', 'production', 'testnet', undefined]) rejects(() => new BinanceAuthFixtureR120({...config(), environment}), 'R120_FIXTURE_DEMO_PRODUCT_REQUIRED');
  for (const product of ['margin', 'coin_m_futures', 'futures', undefined]) rejects(() => new BinanceAuthFixtureR120({...config(), product}), 'R120_FIXTURE_DEMO_PRODUCT_REQUIRED');
  assert.notEqual(binanceFixtureBindingR120('spot').keyFingerprint, binanceFixtureBindingR120('usds_m_futures').keyFingerprint);
});

test('R120 R119 descriptors stay unsigned and unchanged; default output/logs contain no signed envelope', () => {
  const request = entry(), before = structuredClone(request), fixture = harness({httpStatus: 200}, request);
  const result = fixture.simulate(request, {monotonicMs: 125.9});
  assert.deepEqual(request, before); assert.equal(request.signed, false); assert.equal(request.executable, false);
  assert.equal(result.timestamp, NOW + 25); assert.equal(result.recvWindow, 5000);
  assert.equal(result.outcome, 'HTTP_ACK_ONLY'); assert.equal(result.syntheticHmacComputed, true);
  assert.equal(result.referenceOrigin, 'https://testnet.binance.vision');
  for (const value of [result, fixture.logs, fixture.status]) {
    assert.doesNotMatch(JSON.stringify(value), /canonicalQuery|fixtureSignature|X-MBX-APIKEY|JENIOS_R120_PUBLIC_SYNTHETIC_HMAC_NOT_AN_ACCOUNT|fixture-120/);
    assert.ok(Object.isFrozen(value));
  }
  assert.equal(result.nativeVerified, false); assert.equal(result.protectionInstalled, false);
  assert.equal(result.ordersSent, 0); assert.equal(result.automaticRetryAllowed, false);
  assert.equal(result.requiresReconciliation, true); assert.equal(fixture.status.simulatedRequests, 1);
});

test('R120 futures binds only to its explicit synthetic identity and product-specific demo label', () => {
  const request = futures(), fixture = harness({httpStatus: 200}, request);
  assert.equal(fixture.simulate(request, {monotonicMs: 100}).referenceOrigin, 'https://demo-fapi.binance.com');
  assert.deepEqual(fixture.binding, request.binding);
  for (const patch of [{environment: 'live'}, {product: 'spot'}, {keyFingerprint: 'a'.repeat(64)}]) {
    rejects(() => harness({}, request), 'R120_FIXTURE_STATUS_REQUIRED');
    rejects(() => harness({httpStatus: 200}, request).simulate({...request, binding: {...request.binding, ...patch}}, {monotonicMs: 100}), 'R120_FIXTURE_SYNTHETIC_BINDING_REQUIRED');
  }
  rejects(() => harness({httpStatus: 200}, request).simulate({...request, binding: undefined}, {monotonicMs: 100}), 'R120_FIXTURE_JSON_OBJECT_REQUIRED');
});

test('R120 rejects cross-product routing, nonallowlisted paths and executable descriptors', () => {
  for (const path of ['/fapi/v1/order', '/api/v3/order?signature=x', '/api/v3/order/../account', 'https://api.binance.com/api/v3/order', '/sapi/v1/margin/order']) {
    rejects(() => harness().simulate({...query(), path}, {monotonicMs: 100}), 'R120_FIXTURE_ROUTE_REJECTED');
  }
  for (const patch of [{product: 'usds_m_futures'}, {signed: true}, {executable: true}, {liveAuthorized: true}, {schema: 'some-other-format'}]) {
    rejects(() => harness().simulate({...query(), ...patch}, {monotonicMs: 100}), 'R120_FIXTURE_UNSIGNED_DESCRIPTOR_REQUIRED');
  }
  for (const patch of [{url: 'https://example.com'}, {params: {...query().params, signature: 'x'}}]) {
    rejects(() => harness().simulate({...query(), ...patch}, {monotonicMs: 100}), 'R120_FIXTURE_CREDENTIAL_OR_ROUTE_REJECTED');
  }
  rejects(() => harness().simulate({...query(), transport: () => {}}, {monotonicMs: 100}), 'R120_FIXTURE_JSON_OBJECT_REQUIRED');
});

test('R120 recvWindow and timestamp checks are strict, preserve aged bytes and never refresh a stale intent', () => {
  const request = {...query(), params: {...query().params, timestamp: NOW, recvWindow: 5000}};
  assert.equal(harness({httpStatus: 200}, request).simulate(request, {monotonicMs: 5100}).timestamp, NOW);
  rejects(() => harness({httpStatus: 200}, request).simulate(request, {monotonicMs: 5101}), 'R120_FIXTURE_REQUEST_STALE_OR_FUTURE');
  rejects(() => harness().simulate({...query(), params: {...query().params, timestamp: NOW + 1}}, {monotonicMs: 100}), 'R120_FIXTURE_REQUEST_STALE_OR_FUTURE');
  for (const recvWindow of [5001, 60000]) rejects(() => harness().simulate({...query(), params: {...query().params, recvWindow}}, {monotonicMs: 100}), 'R120_FIXTURE_RECV_WINDOW_INVALID');
  for (const recvWindow of [0, -1, 1.5, '5000']) rejects(() => harness().simulate({...query(), params: {...query().params, recvWindow}}, {monotonicMs: 100}), 'R120_FIXTURE_INVALID_TIME_PARAMETER');
});

test('R120 monotonic anchor rejects regression/staleness/unsafe time without wall-clock callbacks', () => {
  const fixture = new BinanceAuthFixtureR120(config([row(), row()]));
  fixture.simulate(query(), {monotonicMs: 101});
  rejects(() => fixture.simulate(query(), {monotonicMs: 100}), 'R120_FIXTURE_CLOCK_STALE_OR_REGRESSED');
  for (const monotonicMs of [NaN, Infinity, -1, 300101]) rejects(() => harness().simulate(query(), {monotonicMs}), 'R120_FIXTURE_CLOCK_STALE_OR_REGRESSED');
  assert.equal(harness().simulate(query(), {monotonicMs: 300100}).timestamp, NOW + 300000);
  const overflow = {...config(), clock: {serverTimeMs: Number.MAX_SAFE_INTEGER, monotonicMs: 100}};
  rejects(() => new BinanceAuthFixtureR120(overflow).simulate(query(), {monotonicMs: 101}), 'R120_FIXTURE_CLOCK_INVALID');
});

test('R120 scripted observations are copied and invalid/local mismatches never consume a response', () => {
  const source = config(), fixture = new BinanceAuthFixtureR120(source);
  source.responses[0].observation.httpStatus = 500;
  rejects(() => fixture.simulate(entry(), {monotonicMs: 100}), 'R120_FIXTURE_SCRIPT_MISMATCH');
  assert.equal(fixture.status.pendingResponses, 1); assert.equal(fixture.logs.length, 0);
  assert.equal(fixture.simulate(query(), {monotonicMs: 100}).outcome, 'HTTP_ACK_ONLY');
  rejects(() => fixture.simulate(query(), {monotonicMs: 100}), 'R120_FIXTURE_SCRIPT_MISMATCH');
  assert.equal(fixture.logs.length, 1);
});

test('R120 transport loss and ambiguous 5xx/timeout/absence never permit replay', () => {
  for (const observation of [{transportFailure: 'timeout'}, {transportFailure: 'disconnect'}, {transportFailure: 'response_lost', httpStatus: 200},
    {httpStatus: 408}, {httpStatus: 500}, {httpStatus: 503}, {httpStatus: 504}, {httpStatus: 400, code: -1007},
    {httpStatus: 400, code: -2013}, {httpStatus: 400, code: -2010}, {httpStatus: 400, code: -2011}, {httpStatus: 200, code: -1021}]) {
    const fixture = harness(observation), result = fixture.simulate(query(), {monotonicMs: 100});
    assert.equal(result.outcome, 'UNKNOWN'); assert.equal(result.requiresReconciliation, true);
    assert.equal(result.automaticRetryAllowed, false); assert.equal(result.circuit, 'OPEN_UNCERTAIN');
    rejects(() => fixture.simulate(query(), {monotonicMs: 101}), 'R120_FIXTURE_CIRCUIT_LATCHED');
  }
});

test('R120 Futures 503 known failures are separated from unknown executions without an auto retry', () => {
  for (const observation of [{httpStatus: 503, message: 'Service Unavailable.'},
    {httpStatus: 503, message: 'Internal error; unable to process your request. Please try again.'}, {httpStatus: 503, code: -1008}]) {
    const result = classifyBinanceFixtureOutcomeR120('usds_m_futures', observation);
    assert.equal(result.outcome, 'REJECTED_THIS_ATTEMPT'); assert.equal(result.circuit, 'OPEN_PROVIDER');
    assert.equal(result.automaticRetryAllowed, false); assert.equal(result.requiresReconciliation, true);
    assert.equal(classifyBinanceFixtureOutcomeR120('spot', observation).outcome, 'UNKNOWN');
  }
  assert.equal(classifyBinanceFixtureOutcomeR120('usds_m_futures', {httpStatus: 503, message: 'Unknown error, please check your request or try again later.'}).outcome, 'UNKNOWN');
  assert.equal(classifyBinanceFixtureOutcomeR120('usds_m_futures', {httpStatus: 503, code: -1008, transportFailure: 'response_lost'}).outcome, 'UNKNOWN');
});

test('R120 rate-limit/bans honor REST delta-seconds and latch even after the wait expires', () => {
  for (const status of [418, 429]) {
    const fixture = harness({httpStatus: status, headers: {'Retry-After': '12', 'X-MBX-USED-WEIGHT-1M': '6000', 'X-MBX-ORDER-COUNT-10S': '50'}});
    const result = fixture.simulate(query(), {monotonicMs: 100});
    assert.equal(result.circuit, 'OPEN_RATE_LIMIT'); assert.equal(result.outcome, 'UNKNOWN');
    assert.equal(result.notBeforeMonotonicMs, 12100); assert.equal(result.rates.retryAfterMs, 12000);
    assert.deepEqual(result.rates.counts, {'x-mbx-used-weight-1m': 6000, 'x-mbx-order-count-10s': 50});
    assert.equal(result.rates.limitsVerified, false); assert.equal(result.rates.remainingBudget, null);
    rejects(() => fixture.simulate(query(), {monotonicMs: 12101}), 'R120_FIXTURE_CIRCUIT_LATCHED');
  }
  for (const value of ['-1', '1.5', 'Wed, 21 Oct 2026 07:28:00 GMT', '1700000000000', '259201', 'bad']) {
    assert.equal(classifyBinanceFixtureOutcomeR120('spot', {httpStatus: 429, headers: {'retry-after': value}}).rates.retryAfterMs, null);
  }
  rejects(() => harness({httpStatus: 429, headers: {'Retry-After': '1', 'retry-after': '2'}}), 'R120_FIXTURE_HEADERS_INVALID');
});

test('R120 auth, access, redirects and clock failures latch without claiming prior orders absent', () => {
  for (const observation of [{httpStatus: 401}, {httpStatus: 403}, {httpStatus: 451}, {httpStatus: 302},
    {httpStatus: 400, code: -1022}, {httpStatus: 400, code: -2014}, {httpStatus: 400, code: -2015}]) {
    const result = classifyBinanceFixtureOutcomeR120('spot', observation);
    assert.equal(result.circuit, 'OPEN_AUTH'); assert.equal(result.automaticRetryAllowed, false); assert.equal(result.requiresReconciliation, true);
  }
  const clock = classifyBinanceFixtureOutcomeR120('spot', {httpStatus: 400, code: -1021});
  assert.equal(clock.circuit, 'OPEN_CLOCK'); assert.equal(clock.outcome, 'REJECTED_THIS_ATTEMPT');
  const filter = classifyBinanceFixtureOutcomeR120('spot', {httpStatus: 400, code: -1013});
  assert.equal(filter.outcome, 'REJECTED_THIS_ATTEMPT'); assert.equal(filter.requiresReconciliation, true);
});

test('R120 safe logs are a strict allowlist, including secret-like data in unrecognized fields', () => {
  const marker = 'DO_NOT_LOG_SYNTHETIC_SECRET';
  const log = redactBinanceFixtureLogR120({product: 'spot', environment: 'demo', method: 'GET', path: '/api/v3/order',
    httpStatus: 429, code: -1003, outcome: 'UNKNOWN', circuit: 'OPEN_RATE_LIMIT', reason: 'RATE_LIMIT',
    apiKey: marker, headers: {authorization: marker}, error: marker, message: marker, url: '?signature=' + marker,
    params: {newClientOrderId: marker}, body: {secret: marker}, signature: marker, fixtureSignature: marker});
  assert.doesNotMatch(JSON.stringify(log), /DO_NOT_LOG|headers|apiKey|signature|params|body/);
  assert.equal(log.httpStatus, 429); assert.equal(log.path, '/api/v3/order');
  assert.deepEqual(redactBinanceFixtureLogR120({product: marker, path: marker, reason: marker}),
    {scope: 'offline_fixture', nativeVerified: false, executable: false});
  const result = harness({httpStatus: 500, message: marker, headers: {'x-debug': marker}}).simulate(query(), {monotonicMs: 100});
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_LOG/);
});

test('R120 no native network/clock/environment dependencies and no transport integration', () => {
  const source = readFileSync(new URL('../lib/platform/ultra/client/binance-auth-fixture-r120.mjs', import.meta.url), 'utf8');
  assert.deepEqual([...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]), ['node:crypto']);
  assert.doesNotMatch(source, /process\.env|\bfetch\s*\(|\bWebSocket\s*\(|Date\.now\s*\(|setTimeout\s*\(|node:https|node:http|node:net|node:tls/);
  const oldFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch'), oldWs = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
  try {
    for (const name of ['fetch', 'WebSocket']) Object.defineProperty(globalThis, name, {configurable: true, get() { throw Error('NETWORK_FORBIDDEN'); }});
    assert.equal(harness({httpStatus: 200}, entry()).simulate(entry(), {monotonicMs: 100}).ordersSent, 0);
  } finally {
    for (const [name, old] of [['fetch', oldFetch], ['WebSocket', oldWs]]) {
      if (old) Object.defineProperty(globalThis, name, old); else delete globalThis[name];
    }
  }
});
