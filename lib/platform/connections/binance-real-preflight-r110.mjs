/** Private operator preflight for an existing Binance SPOT account.
 * Network allowlist: official GETs and POST /api/v3/order/test ONLY.
 * No real order sender, cancellation, transfers, withdrawals, retry or credential storage.
 */
import {createHmac} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const ORIGIN = 'https://api.binance.com';
const KEY = /^[A-Za-z0-9]{32,256}$/;
const ASSET = /^[A-Z0-9]{1,20}$/;
const SYMBOL = /^[A-Z0-9]{2,40}$/;
const DECIMAL = /^(0|[1-9]\d{0,19})(\.\d{1,18})?$/;
const SCALE = 10n ** 18n;
const GETS = new Set(['/api/v3/time', '/api/v3/account', '/api/v3/openOrders',
  '/api/v3/exchangeInfo', '/sapi/v1/account/apiRestrictions']);
const PRIVATE = new Set(['/api/v3/account', '/api/v3/openOrders', '/sapi/v1/account/apiRestrictions', '/api/v3/order/test']);
const INTERNAL = Symbol('R110InternalError');
const fail = (code, details = {}) => { throw Object.assign(new Error(code), {code, [INTERNAL]: true, ...details}); };
const exact = (value, allowed) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) fail('R110_INVALID_REQUEST');
};
function fixed(value) {
  if (typeof value !== 'string' || !DECIMAL.test(value)) fail('R110_INVALID_DECIMAL');
  const [a, b = ''] = value.split('.'); return BigInt(a) * SCALE + BigInt(b.padEnd(18, '0'));
}
function uid(value) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail('R110_ACCOUNT_ID_UNVERIFIED');
    value = String(value);
  }
  if (typeof value !== 'string' || !/^[1-9]\d{0,19}$/.test(value)) fail('R110_ACCOUNT_ID_UNVERIFIED');
  return value;
}
function stamp(value) {
  if (!Number.isSafeInteger(value) || value <= 0) fail('R110_CLOCK_UNVERIFIED'); return value;
}
function fields(input) {
  exact(input, ['credentials', 'expectedAccountUid', 'consent', 'action', 'order']);
  exact(input.credentials, ['apiKey', 'secret']);
  if (!KEY.test(input.credentials.apiKey || '') || !KEY.test(input.credentials.secret || '')) fail('R110_INVALID_CREDENTIALS');
  uid(input.expectedAccountUid);
  if (!['inspect', 'validate_order'].includes(input.action) || input.consent !== 'CHECK_MY_BINANCE_REAL_ACCOUNT_WITHOUT_TRADING') fail('R110_CONSENT_REQUIRED');
  if (input.action === 'inspect' && input.order !== undefined) fail('R110_INVALID_REQUEST');
  if (input.action === 'validate_order') validateOrderShape(input.order);
}
function validateOrderShape(order) {
  exact(order, ['symbol', 'side', 'type', 'quantity', 'price']);
  if (!SYMBOL.test(order.symbol || '') || !['BUY', 'SELL'].includes(order.side) || order.type !== 'LIMIT') fail('R110_UNSUPPORTED_TEST_ORDER');
  if (fixed(order.quantity) <= 0n || fixed(order.price) <= 0n) fail('R110_INVALID_DECIMAL');
}

/** Account canWithdraw is NOT the API key's withdrawal permission. Audit the key itself. */
export function auditR110BinancePermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('R110_PERMISSIONS_UNVERIFIED');
  const required = ['ipRestrict', 'enableReading', 'enableWithdrawals', 'enableInternalTransfer',
    'enableMargin', 'enableFutures', 'permitsUniversalTransfer', 'enableSpotAndMarginTrading'];
  if (required.some(k => typeof value[k] !== 'boolean')) fail('R110_PERMISSIONS_UNVERIFIED');
  if (!value.enableReading) fail('R110_READ_PERMISSION_REQUIRED');
  const forbidden = ['enableWithdrawals', 'enableInternalTransfer', 'enableMargin', 'enableFutures',
    'permitsUniversalTransfer', 'enableVanillaOptions', 'enableFixApiTrade', 'enablePortfolioMarginTrading'];
  if (forbidden.some(k => value[k] === true)) fail('R110_EXCESSIVE_KEY_PERMISSIONS');
  if (forbidden.some(k => value[k] !== undefined && typeof value[k] !== 'boolean')) fail('R110_PERMISSIONS_UNVERIFIED');
  const known = new Set([...required, ...forbidden, 'createTime', 'enableFixReadOnly']);
  if (Object.keys(value).some(k => !known.has(k) && value[k] !== false)) fail('R110_UNKNOWN_KEY_PERMISSION');
  return Object.freeze({readAllowed: true, spotTradingAllowed: value.enableSpotAndMarginTrading,
    ipRestricted: value.ipRestrict, withdrawalAllowed: false, transfersAllowed: false,
    marginAllowed: false, futuresAllowed: false});
}

function parseAccount(value, expected) {
  if (!value || value.accountType !== 'SPOT' || typeof value.canTrade !== 'boolean' || uid(value.uid) !== uid(expected)) fail('R110_ACCOUNT_MISMATCH');
  if (!Array.isArray(value.balances) || value.balances.length > 5000 || !Array.isArray(value.permissions) || !value.permissions.includes('SPOT')) fail('R110_ACCOUNT_RESPONSE_INVALID');
  const balances = new Map();
  for (const row of value.balances) {
    if (!ASSET.test(row?.asset || '') || balances.has(row.asset)) fail('R110_ACCOUNT_RESPONSE_INVALID');
    const free = fixed(row.free), locked = fixed(row.locked);
    balances.set(row.asset, {free, locked});
  }
  return {canTrade: value.canTrade, balances};
}
function inspectOrders(value) {
  if (!Array.isArray(value) || value.length >= 5000) fail('R110_ORDER_INVENTORY_INCOMPLETE');
  const ids = new Set();
  for (const order of value) {
    if (!order || !SYMBOL.test(order.symbol || '') || !['BUY', 'SELL'].includes(order.side) || typeof order.status !== 'string') fail('R110_ORDER_RESPONSE_INVALID');
    const id = uid(order.orderId), key = order.symbol + ':' + id;
    if (ids.has(key) || fixed(order.executedQty) > fixed(order.origQty)) fail('R110_ORDER_RESPONSE_INVALID');
    ids.add(key);
  }
  return value.length;
}

/** Applies deterministic exchange filters locally. Dynamic and account filters are still
 * checked by Binance /order/test; passing this function alone is never an API approval.
 */
export function validateR110BinanceLimit(order, exchange, account) {
  validateOrderShape(order);
  if (!exchange || !Array.isArray(exchange.symbols) || exchange.symbols.length !== 1) fail('R110_SYMBOL_UNVERIFIED');
  const meta = exchange.symbols[0];
  if (meta.symbol !== order.symbol || meta.status !== 'TRADING' || meta.isSpotTradingAllowed !== true ||
      !ASSET.test(meta.baseAsset || '') || !ASSET.test(meta.quoteAsset || '') ||
      !Array.isArray(meta.orderTypes) || !meta.orderTypes.includes('LIMIT') || !Array.isArray(meta.filters)) fail('R110_SYMBOL_UNVERIFIED');
  const filters = new Map();
  for (const filter of meta.filters) {
    if (!filter || typeof filter.filterType !== 'string' || filters.has(filter.filterType)) fail('R110_FILTERS_UNVERIFIED');
    filters.set(filter.filterType, filter);
  }
  const p = filters.get('PRICE_FILTER'), q = filters.get('LOT_SIZE');
  if (!p || !q || !filters.has('MIN_NOTIONAL') && !filters.has('NOTIONAL')) fail('R110_FILTERS_UNVERIFIED');
  const price = fixed(order.price), quantity = fixed(order.quantity), notional = price * quantity;
  const minimumPrice = fixed(p.minPrice), maximumPrice = fixed(p.maxPrice), tick = fixed(p.tickSize);
  if (minimumPrice > 0n && price < minimumPrice || maximumPrice > 0n && price > maximumPrice || tick > 0n && price % tick !== 0n) fail('R110_PRICE_FILTER');
  const minimumQuantity = fixed(q.minQty), maximumQuantity = fixed(q.maxQty), step = fixed(q.stepSize);
  if (quantity < minimumQuantity || maximumQuantity <= 0n || quantity > maximumQuantity || step <= 0n || quantity % step !== 0n) fail('R110_QUANTITY_FILTER');
  for (const name of ['MIN_NOTIONAL', 'NOTIONAL']) {
    const f = filters.get(name); if (!f) continue;
    if (notional < fixed(f.minNotional) * SCALE || name === 'NOTIONAL' && fixed(f.maxNotional) > 0n && notional > fixed(f.maxNotional) * SCALE) fail('R110_NOTIONAL_FILTER');
  }
  if (!account?.balances || typeof account.balances.get !== 'function') fail('R110_ACCOUNT_RESPONSE_INVALID');
  const available = account.balances.get(order.side === 'BUY' ? meta.quoteAsset : meta.baseAsset)?.free || 0n;
  if (order.side === 'BUY' ? available * SCALE < notional : available < quantity) fail('R110_INSUFFICIENT_SPOT_BALANCE');
  return Object.freeze({symbol: order.symbol, baseAsset: meta.baseAsset, quoteAsset: meta.quoteAsset,
    // Informational only: /order/test does not validate a protective order list.
    ocoAdvertised: meta.ocoAllowed === true, otoAdvertised: meta.otoAllowed === true,
    opoAdvertised: meta.opoAllowed === true, protectiveOrderListTested: false});
}

const errorCodes = new Map([[-1021, 'R110_PROVIDER_CLOCK_REJECTED'], [-1022, 'R110_SIGNATURE_REJECTED'],
  [-2014, 'R110_API_KEY_REJECTED'], [-2015, 'R110_API_KEY_OR_IP_REJECTED'],
  [-1013, 'R110_PROVIDER_FILTER_REJECTED'], [-1121, 'R110_SYMBOL_UNVERIFIED'],
  [-2010, 'R110_PROVIDER_ORDER_TEST_REJECTED'], [-1003, 'R110_RATE_LIMITED']]);

export async function runR110BinancePreflight(request, {fetcher = fetch, clock = Date.now,
  monotonicNow = () => performance.now()} = {}) {
  fields(request);
  // Copy caller data before the first await; mutations cannot switch account or order later.
  const input = structuredClone(request);
  let signedRequests = 0;
  async function call(method, path, params = {}) {
    if (!(method === 'GET' && GETS.has(path) || method === 'POST' && path === '/api/v3/order/test')) fail('R110_DESTINATION_FORBIDDEN');
    const isPrivate = PRIVATE.has(path);
    const form = new URLSearchParams(params);
    const headers = {accept: 'application/json'};
    if (isPrivate) {
      const elapsed = monotonicNow() - anchorMono;
      if (!Number.isFinite(elapsed) || elapsed < previousElapsed || elapsed > 30000) fail('R110_CLOCK_UNVERIFIED');
      previousElapsed = elapsed;
      form.set('recvWindow', '5000'); form.set('timestamp', String(stamp(anchorTime + Math.floor(elapsed))));
      form.set('signature', createHmac('sha256', input.credentials.secret).update(form.toString()).digest('hex'));
      headers['X-MBX-APIKEY'] = input.credentials.apiKey; signedRequests++;
    }
    if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const query = method === 'GET' && form.size ? '?' + form.toString() : '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let response;
    try {
      response = await fetcher(ORIGIN + path + query, {method, redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers, ...(method === 'POST' ? {body: form.toString()} : {})});
      if (response?.redirected) { await response.body?.cancel?.(); fail('R110_REDIRECT_DENIED'); }
      if ([403, 418, 429, 451].includes(response?.status)) {
        const wait = Number(response.headers?.get?.('retry-after'));
        await response.body?.cancel?.();
        fail([418, 429].includes(response.status) ? 'R110_RATE_LIMITED' : response.status === 451 ? 'R110_REGION_RESTRICTED' : 'R110_PROVIDER_FORBIDDEN',
          {retryAfterSeconds: Number.isSafeInteger(wait) && wait > 0 && wait <= 86400 ? wait : null});
      }
      const reader = response?.body?.getReader?.(); if (!reader) fail('R110_PROVIDER_RESPONSE_INVALID');
      const chunks = []; let size = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > 524288) { await reader.cancel(); fail('R110_PROVIDER_RESPONSE_TOO_LARGE'); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      let value;
      try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { fail('R110_PROVIDER_RESPONSE_INVALID'); }
      if (!response.ok || value && typeof value === 'object' && Number.isInteger(value.code) && value.code < 0) {
        fail(errorCodes.get(value?.code) || (response.status === 401 ? 'R110_API_KEY_REJECTED' : 'R110_PROVIDER_REJECTED'));
      }
      return value;
    } catch (error) {
      if (error?.[INTERNAL]) throw error;
      fail(controller.signal.aborted ? 'R110_PROVIDER_TIMEOUT' : 'R110_NETWORK_UNAVAILABLE');
    } finally { clearTimeout(timer); }
  }
  let anchorTime = 0, anchorMono = 0, previousElapsed = 0;
  const start = monotonicNow(), localTime = stamp(clock());
  const server = await call('GET', '/api/v3/time');
  anchorMono = monotonicNow(); anchorTime = stamp(server?.serverTime);
  if (!Number.isFinite(start) || !Number.isFinite(anchorMono) || anchorMono < start || anchorMono - start > 2000 || Math.abs(anchorTime - localTime) > 30000) fail('R110_CLOCK_UNVERIFIED');
  const permissions = auditR110BinancePermissions(await call('GET', '/sapi/v1/account/apiRestrictions'));
  const account = parseAccount(await call('GET', '/api/v3/account', {omitZeroBalances: 'true'}), input.expectedAccountUid);
  const openOrderCount = inspectOrders(await call('GET', '/api/v3/openOrders'));
  let nativeOrderTestPassed = false, instrument = null;
  if (input.action === 'validate_order') {
    if (!permissions.spotTradingAllowed || !account.canTrade) fail('R110_ORDER_TEST_PERMISSION_REQUIRED');
    if (!permissions.ipRestricted) fail('R110_IP_RESTRICTION_REQUIRED');
    // Tests on an active account must not be mistaken for a clean robot rehearsal.
    if (openOrderCount > 0) fail('R110_EXISTING_ORDERS_REQUIRE_REVIEW');
    const exchange = await call('GET', '/api/v3/exchangeInfo', {symbol: input.order.symbol});
    instrument = validateR110BinanceLimit(input.order, exchange, account);
    const result = await call('POST', '/api/v3/order/test', {...input.order, timeInForce: 'GTC', computeCommissionRates: 'false'});
    if (!result || typeof result !== 'object' || Array.isArray(result) || Object.keys(result).length !== 0) fail('R110_ORDER_TEST_UNVERIFIED');
    nativeOrderTestPassed = true;
  }
  return Object.freeze({schema: 'JENIOS_R110_BINANCE_REAL_PREFLIGHT', provider: 'binance', environment: 'live',
    accountMatched: true, keyPermissionsAudited: true, permissions, openOrderCount,
    nonZeroBalanceAssetCount: [...account.balances.values()].filter(b => b.free + b.locked > 0n).length,
    accountCanTrade: account.canTrade, nativeOrderTestPassed, instrument, signedRequests,
    accountOwnershipLegallyVerified: false, robotActivated: false, realOrdersSent: 0,
    protectiveOrderListTested: false, positionLifecycleCertified: false,
    credentialsStored: false, custody: false, withdrawals: false});
}
