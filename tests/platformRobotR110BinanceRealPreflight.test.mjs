import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {runR110BinancePreflight, auditR110BinancePermissions} from '../lib/platform/connections/binance-real-preflight-r110.mjs';
import {r110Prompt, runR110Interactive, r110SafeFailure} from '../scripts/platform/connections/r110-binance-real-preflight.mjs';

const now = 1793232000000;
const credentials = {apiKey: 'A'.repeat(64), secret: 'B'.repeat(64)};
const permission = {ipRestrict: true, enableReading: true, enableWithdrawals: false,
  enableInternalTransfer: false, enableMargin: false, enableFutures: false,
  permitsUniversalTransfer: false, enableSpotAndMarginTrading: false, createTime: now - 100000,
  enableVanillaOptions: false, enableFixApiTrade: false, enableFixReadOnly: true, enablePortfolioMarginTrading: false};
const account = {uid: 123456789, accountType: 'SPOT', canTrade: true, canWithdraw: true,
  permissions: ['SPOT'], balances: [{asset: 'USDT', free: '1000', locked: '0'}, {asset: 'TEST', free: '10', locked: '2'}]};
const exchange = {symbols: [{symbol: 'TESTUSDT', baseAsset: 'TEST', quoteAsset: 'USDT', status: 'TRADING',
  isSpotTradingAllowed: true, orderTypes: ['LIMIT'], ocoAllowed: true, otoAllowed: true, opoAllowed: true,
  filters: [{filterType: 'PRICE_FILTER', minPrice: '0.01', maxPrice: '1000000', tickSize: '0.01'},
    {filterType: 'LOT_SIZE', minQty: '0.1', maxQty: '100000', stepSize: '0.1'},
    {filterType: 'MIN_NOTIONAL', minNotional: '5'}]}]};
const order = {symbol: 'TESTUSDT', side: 'BUY', type: 'LIMIT', quantity: '1', price: '10'};
const request = {credentials, expectedAccountUid: '123456789',
  consent: 'CHECK_MY_BINANCE_REAL_ACCOUNT_WITHOUT_TRADING', action: 'inspect'};
const tradeRequest = {...request, action: 'validate_order', order};
const rejects = (fn, code) => assert.rejects(fn, {code});

function rig({permissions = permission, accountData = account, orders = [], meta = exchange, post = {}, hook} = {}) {
  const calls = []; let monotonic = 0;
  const fetcher = async (raw, options) => {
    const url = new URL(raw); const path = url.pathname;
    calls.push({path, options, url});
    assert.equal(url.origin, 'https://api.binance.com');
    assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    if (path !== '/api/v3/time' && path !== '/api/v3/exchangeInfo') {
      const params = options.method === 'GET' ? url.searchParams : new URLSearchParams(options.body);
      assert.equal(options.headers['X-MBX-APIKEY'], credentials.apiKey);
      const signature = params.get('signature'); params.delete('signature');
      assert.equal(signature, createHmac('sha256', credentials.secret).update(params.toString()).digest('hex'));
      assert.equal(params.get('recvWindow'), '5000');
      assert.ok(Number(params.get('timestamp')) >= now);
    } else assert.equal(options.headers['X-MBX-APIKEY'], undefined);
    if (hook) { const result = await hook(path, options, url); if (result !== undefined) return result; }
    monotonic += 100;
    const values = {'/api/v3/time': {serverTime: now}, '/sapi/v1/account/apiRestrictions': permissions,
      '/api/v3/account': accountData, '/api/v3/openOrders': orders, '/api/v3/exchangeInfo': meta, '/api/v3/order/test': post};
    if (!Object.hasOwn(values, path)) throw Error('UNEXPECTED_PATH');
    return Response.json(values[path]);
  };
  return {calls, options: {fetcher, clock: () => now, monotonicNow: () => monotonic},
    advance: n => { monotonic += n; }};
}

test('R110 actual-account inspection signs only the fixed official GET endpoints', async () => {
  const r = rig(); const result = await runR110BinancePreflight(request, r.options);
  assert.deepEqual(r.calls.map(c => c.path), ['/api/v3/time', '/sapi/v1/account/apiRestrictions', '/api/v3/account', '/api/v3/openOrders']);
  assert.ok(r.calls.every(c => c.options.method === 'GET'));
  assert.equal(result.environment, 'live'); assert.equal(result.accountMatched, true);
  assert.equal(result.keyPermissionsAudited, true); assert.equal(result.nativeOrderTestPassed, false);
  assert.equal(result.permissions.withdrawalAllowed, false); // account.canWithdraw can legitimately be true
  assert.equal(result.nonZeroBalanceAssetCount, 2); assert.equal(result.realOrdersSent, 0);
  for (const text of [credentials.apiKey, credentials.secret, request.expectedAccountUid, '1000', 'TEST_ACCOUNT']) assert.ok(!JSON.stringify(result).includes(text));
});

test('R110 order validation can only POST to /order/test and excludes matching-engine endpoints', async () => {
  const r = rig({permissions: {...permission, enableSpotAndMarginTrading: true}});
  const result = await runR110BinancePreflight(tradeRequest, r.options);
  const posts = r.calls.filter(c => c.options.method === 'POST');
  assert.equal(posts.length, 1); assert.equal(posts[0].path, '/api/v3/order/test');
  assert.equal(posts[0].url.search, '');
  const body = new URLSearchParams(posts[0].options.body);
  assert.equal(body.get('timeInForce'), 'GTC'); assert.equal(body.get('computeCommissionRates'), 'false');
  assert.equal(body.get('side'), 'BUY'); assert.equal(body.get('quantity'), '1');
  assert.equal(result.nativeOrderTestPassed, true); assert.equal(result.protectiveOrderListTested, false);
  assert.equal(result.robotActivated, false); assert.equal(result.realOrdersSent, 0);
});

for (const key of ['enableWithdrawals', 'enableInternalTransfer', 'permitsUniversalTransfer', 'enableMargin',
  'enableFutures', 'enableVanillaOptions', 'enableFixApiTrade', 'enablePortfolioMarginTrading']) {
  test('R110 rejects excessive permission before private account data: ' + key, async () => {
    const r = rig({permissions: {...permission, [key]: true}});
    await rejects(() => runR110BinancePreflight(request, r.options), 'R110_EXCESSIVE_KEY_PERMISSIONS');
    assert.equal(r.calls.length, 2);
  });
}

test('R110 missing, malformed, or new permissions never become implicit permission', async () => {
  for (const p of [{...permission, enableWithdrawals: undefined}, {...permission, enableReading: 'true'}]) {
    await rejects(() => runR110BinancePreflight(request, rig({permissions: p}).options), 'R110_PERMISSIONS_UNVERIFIED');
  }
  assert.throws(() => auditR110BinancePermissions({...permission, futureTradingCapability: true}), {code: 'R110_UNKNOWN_KEY_PERMISSION'});
  assert.throws(() => auditR110BinancePermissions({...permission, enableReading: false}), {code: 'R110_READ_PERMISSION_REQUIRED'});
});

test('R110 authentication failures, wrong account and unsafe UID precision are rejected', async () => {
  await rejects(() => runR110BinancePreflight({...request, expectedAccountUid: '999'}, rig().options), 'R110_ACCOUNT_MISMATCH');
  await rejects(() => runR110BinancePreflight(request, rig({accountData: {...account, uid: 9007199254740992}}).options), 'R110_ACCOUNT_ID_UNVERIFIED');
  for (const code of [-1021, -1022, -2014, -2015]) {
    const r = rig({hook: path => path.includes('apiRestrictions') ? Response.json({code, msg: credentials.secret}, {status: 400}) : undefined});
    await assert.rejects(() => runR110BinancePreflight(request, r.options), e => !String(e).includes(credentials.secret));
    assert.equal(r.calls.length, 2);
  }
});

test('R110 clock drift, slow samples and monotonic regression stop without signing stale requests', async () => {
  const drift = rig(); drift.options.clock = () => now - 31000;
  await rejects(() => runR110BinancePreflight(request, drift.options), 'R110_CLOCK_UNVERIFIED');
  assert.equal(drift.calls.length, 1);
  const slow = rig({hook: path => { if (path.endsWith('/time')) slow.advance(2001); }});
  await rejects(() => runR110BinancePreflight(request, slow.options), 'R110_CLOCK_UNVERIFIED');
  assert.equal(slow.calls.length, 1);
  const old = rig({hook: path => { if (path.endsWith('/account')) old.advance(30001); }});
  await rejects(() => runR110BinancePreflight(request, old.options), 'R110_CLOCK_UNVERIFIED');
  assert.ok(!old.calls.some(c => c.path.endsWith('/openOrders')));
  const reverse = rig(); let calls = 0;
  reverse.options.monotonicNow = () => [0, 100, 50][Math.min(calls++, 2)];
  await rejects(() => runR110BinancePreflight(request, reverse.options), 'R110_CLOCK_UNVERIFIED');
});

for (const status of [403, 418, 429, 451]) {
  test('R110 upstream restrictions have no retry, proxy, or alternate host: ' + status, async () => {
    const r = rig({hook: () => new Response(credentials.secret, {status, headers: {'Retry-After': '60'}})});
    await assert.rejects(() => runR110BinancePreflight(request, r.options), e => {
      assert.ok(!e.message.includes(credentials.secret));
      if ([418, 429].includes(status)) assert.equal(e.retryAfterSeconds, 60);
      return true;
    });
    assert.equal(r.calls.length, 1); assert.equal(r.calls[0].options.headers['X-MBX-APIKEY'], undefined);
  });
}

test('R110 redacts transport errors and forbids redirected or oversized responses', async () => {
  const injected = rig({hook: () => { throw Object.assign(Error(credentials.secret), {code: 'R110_' + credentials.secret}); }});
  await rejects(() => runR110BinancePreflight(request, injected.options), 'R110_NETWORK_UNAVAILABLE');
  const redirected = rig({hook: () => ({redirected: true, body: {cancel: async () => {}}})});
  await rejects(() => runR110BinancePreflight(request, redirected.options), 'R110_REDIRECT_DENIED');
  const large = rig({hook: () => new Response('x'.repeat(524289))});
  await rejects(() => runR110BinancePreflight(request, large.options), 'R110_PROVIDER_RESPONSE_TOO_LARGE');
});

test('R110 field injection, non-HMAC credentials and absent consent fail before any request', async () => {
  for (const [patch, code] of [[{url: 'https://evil.invalid'}, 'R110_INVALID_REQUEST'],
    [{action: 'submit'}, 'R110_CONSENT_REQUIRED'], [{consent: 'yes'}, 'R110_CONSENT_REQUIRED'],
    [{credentials: {...credentials, secret: '-----BEGIN PRIVATE KEY-----'}}, 'R110_INVALID_CREDENTIALS'],
    [{order}, 'R110_INVALID_REQUEST']]) {
    const r = rig(); await rejects(() => runR110BinancePreflight({...request, ...patch}, r.options), code);
    assert.equal(r.calls.length, 0);
  }
});

test('R110 the inspection accepts read-only keys; order-test checks account, key and IP permissions', async () => {
  for (const [options, code] of [[{}, 'R110_ORDER_TEST_PERMISSION_REQUIRED'],
    [{permissions: {...permission, enableSpotAndMarginTrading: true, ipRestrict: false}}, 'R110_IP_RESTRICTION_REQUIRED'],
    [{permissions: {...permission, enableSpotAndMarginTrading: true}, accountData: {...account, canTrade: false}}, 'R110_ORDER_TEST_PERMISSION_REQUIRED']]) {
    const r = rig(options); await rejects(() => runR110BinancePreflight(tradeRequest, r.options), code);
    assert.ok(r.calls.every(c => c.options.method === 'GET'));
  }
});

test('R110 active orders require operator review without automatic cancellation', async () => {
  const orders = [{symbol: 'TESTUSDT', orderId: 987654, side: 'SELL', status: 'NEW', origQty: '1', executedQty: '0'}];
  const inspect = await runR110BinancePreflight(request, rig({orders}).options);
  assert.equal(inspect.openOrderCount, 1);
  const r = rig({permissions: {...permission, enableSpotAndMarginTrading: true}, orders});
  await rejects(() => runR110BinancePreflight(tradeRequest, r.options), 'R110_EXISTING_ORDERS_REQUIRE_REVIEW');
  assert.ok(r.calls.every(c => c.options.method === 'GET'));
});

test('R110 validates exact decimal ticks, lots, min/max notionals and available Spot inventory', async () => {
  for (const [patch, code] of [[{price: '10.001'}, 'R110_PRICE_FILTER'],
    [{quantity: '0.11'}, 'R110_QUANTITY_FILTER'], [{quantity: '0.1', price: '10'}, 'R110_NOTIONAL_FILTER'],
    [{quantity: '1000'}, 'R110_INSUFFICIENT_SPOT_BALANCE'],
    [{side: 'SELL', quantity: '11'}, 'R110_INSUFFICIENT_SPOT_BALANCE']]) {
    const r = rig({permissions: {...permission, enableSpotAndMarginTrading: true}});
    await rejects(() => runR110BinancePreflight({...tradeRequest, order: {...order, ...patch}}, r.options), code);
    assert.ok(r.calls.every(c => c.options.method !== 'POST'));
  }
  const meta = structuredClone(exchange); meta.symbols[0].filters.push({filterType: 'NOTIONAL', minNotional: '1', maxNotional: '9'});
  await rejects(() => runR110BinancePreflight(tradeRequest, rig({permissions: {...permission, enableSpotAndMarginTrading: true}, meta}).options), 'R110_NOTIONAL_FILTER');
});

test('R110 validates SELL against owned Spot assets, preserving the supplied final side', async () => {
  const r = rig({permissions: {...permission, enableSpotAndMarginTrading: true}});
  const result = await runR110BinancePreflight({...tradeRequest, order: {...order, side: 'SELL'}}, r.options);
  assert.equal(result.nativeOrderTestPassed, true);
  assert.equal(new URLSearchParams(r.calls.at(-1).options.body).get('side'), 'SELL');
});

test('R110 incomplete metadata or nonempty test reply never earns a success report', async () => {
  const p = {...permission, enableSpotAndMarginTrading: true};
  await rejects(() => runR110BinancePreflight(tradeRequest, rig({permissions: p, meta: {symbols: []}}).options), 'R110_SYMBOL_UNVERIFIED');
  const noFilters = structuredClone(exchange); noFilters.symbols[0].filters = [];
  await rejects(() => runR110BinancePreflight(tradeRequest, rig({permissions: p, meta: noFilters}).options), 'R110_FILTERS_UNVERIFIED');
  for (const post of [{orderId: 42}, [], null]) {
    await rejects(() => runR110BinancePreflight(tradeRequest, rig({permissions: p, post}).options), 'R110_ORDER_TEST_UNVERIFIED');
  }
});

test('R110 captures immutable request data before asynchronous provider responses', async () => {
  const input = structuredClone(tradeRequest);
  const r = rig({permissions: {...permission, enableSpotAndMarginTrading: true}, hook: path => {
    if (path.endsWith('/time')) { input.order.side = 'SELL'; input.credentials.secret = 'C'.repeat(64); input.expectedAccountUid = '999'; }
  }});
  const result = await runR110BinancePreflight(input, r.options);
  assert.equal(result.nativeOrderTestPassed, true);
  assert.equal(new URLSearchParams(r.calls.at(-1).options.body).get('side'), 'BUY');
});

function tty() {
  const input = new EventEmitter(); input.isTTY = true; input.isRaw = false;
  input.setRawMode = v => { input.isRaw = v; }; input.resume = () => {}; input.pause = () => {};
  let output = ''; const stdout = {isTTY: true, write: v => { output += v; }};
  return {input, stdout, output: () => output};
}

test('R110 interactive hidden input never echoes a secret and restores terminal mode', async () => {
  const t = tty(); const pending = r110Prompt('Chave: ', {secret: true, stdin: t.input, stdout: t.stdout});
  assert.equal(t.input.isRaw, true); t.input.emit('data', Buffer.from(credentials.secret + '\r'));
  assert.equal(await pending, credentials.secret); assert.equal(t.input.isRaw, false);
  assert.equal(t.output(), 'Chave: \n'); assert.equal(t.input.listenerCount('data'), 0);
});

test('R110 interactive cancellation, timeout, backspace and paste do not leave raw mode enabled', async () => {
  const t = tty(); const cancel = r110Prompt('Secret: ', {secret: true, stdin: t.input, stdout: t.stdout});
  t.input.emit('data', Buffer.from('secret\x03'));
  await rejects(() => cancel, 'R110_CANCELLED'); assert.equal(t.input.isRaw, false);
  const back = r110Prompt('Nome: ', {stdin: t.input, stdout: t.stdout});
  t.input.emit('data', Buffer.from('AB\x7fC\rignored-pasted-tail'));
  assert.equal(await back, 'AC'); assert.ok(!t.output().includes('ignored-pasted-tail'));
  const expired = r110Prompt('Secret: ', {secret: true, stdin: t.input, stdout: t.stdout, timeoutMs: 5});
  await rejects(() => expired, 'R110_INPUT_TIMEOUT'); assert.equal(t.input.isRaw, false);
  const nonTTY = r110Prompt('Secret: ', {stdin: {...t.input, isTTY: false}, stdout: t.stdout});
  await rejects(() => nonTTY, 'R110_TTY_REQUIRED');
});

test('R110 CLI forwards exact consent/parameters, uses hidden prompts and clears its credentials', async () => {
  const answers = ['CONFERIR', '123456789', '2', 'TESTUSDT', 'SELL', '1', '10', credentials.apiKey, credentials.secret];
  const prompts = []; let received, output = '';
  await runR110Interactive({ask: async (label, options) => { prompts.push({label, options}); return answers.shift(); },
    output: value => { output += value; }, runner: async input => { received = input; return {nativeOrderTestPassed: true, realOrdersSent: 0}; }});
  assert.equal(received.action, 'validate_order'); assert.equal(received.order.side, 'SELL');
  assert.equal(received.consent, request.consent);
  assert.deepEqual(received.credentials, {apiKey: '', secret: ''});
  assert.ok(prompts.slice(-2).every(p => p.options.secret === true));
  assert.ok(!output.includes(credentials.secret)); assert.ok(!output.includes(credentials.apiKey));
  const safe = r110SafeFailure({code: 'UNTRUSTED_' + credentials.secret, message: credentials.secret});
  assert.ok(!JSON.stringify(safe).includes(credentials.secret));
});
