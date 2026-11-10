/** Offline REST-contract exercises only. No credentials, I/O, timers or executor integration. */
import {createHash, createHmac} from 'node:crypto';

const fail = code => { throw Object.assign(new Error(code), {code}); };
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const PRODUCTS = ['spot', 'usds_m_futures'];
const ROUTES = freeze({
  spot: {POST: ['/api/v3/order', '/api/v3/orderList/oco', '/api/v3/orderList/otoco'],
    GET: ['/api/v3/order', '/api/v3/orderList'], DELETE: ['/api/v3/order', '/api/v3/orderList']},
  usds_m_futures: {POST: ['/fapi/v1/order', '/fapi/v1/algoOrder'],
    GET: ['/fapi/v1/order', '/fapi/v1/algoOrder'], DELETE: ['/fapi/v1/order', '/fapi/v1/algoOrder']},
});
// Reference labels, never destinations for a network client. Spot "demo" means Spot Testnet here.
const ORIGINS = freeze({spot: 'https://testnet.binance.vision', usds_m_futures: 'https://demo-fapi.binance.com'});
const PUBLIC_SYNTHETIC_HMAC = 'JENIOS_R120_PUBLIC_SYNTHETIC_HMAC_NOT_AN_ACCOUNT';
const PARAMS = new Set(('symbol side type timeInForce quantity price newClientOrderId newOrderRespType '
  + 'origClientOrderId orderId orderListId listClientOrderId aboveType aboveClientOrderId abovePrice '
  + 'belowType belowClientOrderId belowPrice belowStopPrice belowTimeInForce workingType workingSide '
  + 'workingPrice workingQuantity workingClientOrderId workingTimeInForce pendingSide pendingQuantity '
  + 'pendingAboveType pendingAbovePrice pendingAboveClientOrderId pendingBelowType pendingBelowPrice '
  + 'pendingBelowStopPrice pendingBelowClientOrderId pendingBelowTimeInForce positionSide reduceOnly '
  + 'algoType triggerPrice priceProtect clientAlgoId algoId timestamp recvWindow').split(' '));
const CIRCUITS = ['CLOSED', 'OPEN_UNCERTAIN', 'OPEN_RATE_LIMIT', 'OPEN_AUTH', 'OPEN_CLOCK', 'OPEN_PROVIDER'];
const OUTCOMES = ['HTTP_ACK_ONLY', 'REJECTED_THIS_ATTEMPT', 'UNKNOWN'];
const REASONS = ['RECEIPT_RECONCILIATION_REQUIRED', 'EXECUTION_UNKNOWN', 'RATE_LIMIT', 'IP_BANNED',
  'AUTH_OR_ACCESS_REJECTED', 'CLOCK_RESYNC_REQUIRED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_OVERLOAD',
  'REJECTION_REQUIRES_REVIEW', 'ABSENCE_OR_DUPLICATE_UNRESOLVED', 'REDIRECT_DENIED'];

function record(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) fail('R120_FIXTURE_JSON_OBJECT_REQUIRED');
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !d.enumerable || !Object.hasOwn(d, 'value')) fail('R120_FIXTURE_DATA_FIELDS_REQUIRED');
  }
  return value;
}
function exact(value, keys) {
  record(value);
  if (Object.keys(value).some(key => !keys.includes(key))) fail('R120_FIXTURE_UNSUPPORTED_FIELD');
}
function jsonOnly(value, depth = 0) {
  if (depth > 8) fail('R120_FIXTURE_DATA_TOO_DEEP');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string' && value.length <= 1024) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { if (value.length > 100) fail('R120_FIXTURE_DATA_TOO_LARGE'); value.forEach(v => jsonOnly(v, depth + 1)); return; }
  record(value);
  if (Object.keys(value).length > 64) fail('R120_FIXTURE_DATA_TOO_LARGE');
  for (const [key, child] of Object.entries(value)) {
    if (/secret|password|signature|apikey|authorization|token|credential|headers|url|origin|host/i.test(key)) fail('R120_FIXTURE_CREDENTIAL_OR_ROUTE_REJECTED');
    jsonOnly(child, depth + 1);
  }
}
function scope(product, environment) {
  if (!PRODUCTS.includes(product) || environment !== 'demo') fail('R120_FIXTURE_DEMO_PRODUCT_REQUIRED');
}
function route(product, method, path) {
  if (!PRODUCTS.includes(product) || typeof method !== 'string' || typeof path !== 'string'
    || !Object.hasOwn(ROUTES[product], method) || !ROUTES[product][method].includes(path)) fail('R120_FIXTURE_ROUTE_REJECTED');
}
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const monotonic = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;

/** Only known R119 parameter names; amounts remain strings. This is NOT native order validation. */
export function canonicalizeBinanceFixtureParamsR120(params) {
  record(params);
  if (Object.keys(params).length > 64) fail('R120_FIXTURE_PARAMS_TOO_LARGE');
  const pairs = Object.keys(params).sort().map(key => {
    if (!PARAMS.has(key)) fail('R120_FIXTURE_PARAMETER_REJECTED');
    const value = params[key];
    if (['timestamp', 'recvWindow'].includes(key)) {
      if (!integer(value, 1)) fail('R120_FIXTURE_INVALID_TIME_PARAMETER');
    } else if (typeof value !== 'string' || !value.length || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value)) {
      fail('R120_FIXTURE_STRING_PARAMETER_REQUIRED');
    }
    // RFC 3986 percent-encoding, including delimiters. Signing never reserializes these bytes.
    const encode = v => encodeURIComponent(String(v)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    try { return encode(key) + '=' + encode(value); } catch { fail('R120_FIXTURE_INVALID_UNICODE'); }
  });
  const canonicalQuery = pairs.join('&');
  if (canonicalQuery.length > 8192) fail('R120_FIXTURE_PARAMS_TOO_LARGE');
  return canonicalQuery;
}

/** Public synthetic key only. No argument for a real secret and no HTTP header output. */
export function signBinanceFixtureR120(params) {
  const canonicalQuery = canonicalizeBinanceFixtureParamsR120(params);
  return freeze({canonicalQuery, fixtureSignature: createHmac('sha256', PUBLIC_SYNTHETIC_HMAC).update(canonicalQuery).digest('hex'),
    algorithm: 'HMAC-SHA256', fixtureOnly: true, executable: false, nativeVerified: false});
}

export function binanceFixtureBindingR120(product) {
  scope(product, 'demo');
  return freeze({product, environment: 'demo', keyFingerprint: createHash('sha256')
    .update('jenios-r120-public-synthetic-binding:' + product + ':demo').digest('hex')});
}

function descriptor(value, product) {
  record(value); jsonOnly(value);
  const common = ['schema', 'product', 'method', 'path', 'params', 'signed', 'binding'];
  exact(value, product === 'spot' ? [...common, 'executable', 'liveAuthorized', 'validation', 'reservedOrderSlots',
    'partialEntryProtected', 'activationRequires', 'baseCommissionReserve', 'stopLimitExecutionGuaranteed'] : [...common, 'canSubmit']);
  if (value.product !== product || value.signed !== false || (product === 'spot'
    ? value.schema !== 'JENIOS_R119_SPOT_DESCRIPTOR' || value.executable !== false || value.liveAuthorized !== false
    : value.schema !== 'JENIOS_ULTRA_BINANCE_UNSIGNED_REQUEST_R119' || value.canSubmit !== false)) fail('R120_FIXTURE_UNSIGNED_DESCRIPTOR_REQUIRED');
  route(product, value.method, value.path);
  canonicalizeBinanceFixtureParamsR120(value.params);
  if (product === 'usds_m_futures' || value.binding !== undefined) {
    exact(value.binding, ['product', 'environment', 'keyFingerprint']);
    const expected = binanceFixtureBindingR120(product);
    if (Object.keys(expected).some(key => value.binding[key] !== expected[key])) fail('R120_FIXTURE_SYNTHETIC_BINDING_REQUIRED');
  }
  return structuredClone(value);
}

function observation(value) {
  exact(value, ['httpStatus', 'code', 'message', 'transportFailure', 'headers']);
  if (value.httpStatus !== undefined && (!integer(value.httpStatus, 100) || value.httpStatus > 599)) fail('R120_FIXTURE_STATUS_INVALID');
  if (value.code !== undefined && !Number.isSafeInteger(value.code)) fail('R120_FIXTURE_CODE_INVALID');
  if (value.message !== undefined && (typeof value.message !== 'string' || value.message.length > 1024)) fail('R120_FIXTURE_MESSAGE_INVALID');
  if (value.transportFailure !== undefined && !['timeout', 'disconnect', 'response_lost'].includes(value.transportFailure)) fail('R120_FIXTURE_FAILURE_INVALID');
  if (value.transportFailure === undefined && value.httpStatus === undefined) fail('R120_FIXTURE_STATUS_REQUIRED');
  if (value.headers !== undefined) {
    record(value.headers);
    if (Object.keys(value.headers).length > 32) fail('R120_FIXTURE_HEADERS_INVALID');
    const names = new Set();
    for (const [key, val] of Object.entries(value.headers)) {
      const name = key.toLowerCase();
      if (names.has(name) || !/^[a-z0-9-]{1,80}$/.test(name) || typeof val !== 'string' || val.length > 256) fail('R120_FIXTURE_HEADERS_INVALID');
      names.add(name);
    }
  }
  return value;
}
function rateEvidence(headers = {}) {
  const counts = {}; let retryAfterMs = null;
  for (const [key, value] of Object.entries(headers)) {
    const name = key.toLowerCase();
    if (name === 'retry-after') {
      // REST delta-seconds only. Never confuse this with WS retryAfter (an absolute timestamp).
      if (/^\d{1,6}$/.test(value) && integer(Number(value)) && Number(value) <= 259200) retryAfterMs = Number(value) * 1000;
    } else if (/^x-mbx-(used-weight|order-count)-[1-9]\d{0,4}[smhd]$/.test(name) && /^\d{1,16}$/.test(value) && integer(Number(value))) {
      counts[name] = Number(value);
    }
  }
  return freeze({retryAfterMs, counts, limitsVerified: false, remainingBudget: null});
}

/** Classification, not exchange evidence. Every case prohibits automatic resubmission. */
export function classifyBinanceFixtureOutcomeR120(product, input) {
  scope(product, 'demo'); observation(input);
  const {httpStatus: status, code, message, transportFailure} = input;
  let outcome = 'UNKNOWN', reason = 'EXECUTION_UNKNOWN', circuit = 'OPEN_UNCERTAIN';
  if (status === 418 || status === 429) {
    reason = status === 418 ? 'IP_BANNED' : 'RATE_LIMIT'; circuit = 'OPEN_RATE_LIMIT';
  } else if (transportFailure || status === 408 || [-1000, -1001, -1006, -1007].includes(code)) {
    // A lost reply overrides even a nominal success/rejection on the same scripted observation.
  } else if (status >= 300 && status < 400) {
    reason = 'REDIRECT_DENIED'; circuit = 'OPEN_AUTH';
  } else if (status === 401 || status === 403 || status === 451 || [-1022, -2014, -2015].includes(code)) {
    reason = 'AUTH_OR_ACCESS_REJECTED'; circuit = 'OPEN_AUTH';
  } else if (code === -1021 && status >= 400 && status < 500) {
    outcome = 'REJECTED_THIS_ATTEMPT'; reason = 'CLOCK_RESYNC_REQUIRED'; circuit = 'OPEN_CLOCK';
  } else if (product === 'usds_m_futures' && status === 503 && (code === -1008 || ['Service Unavailable.',
    'Internal error; unable to process your request. Please try again.'].includes(message))) {
    outcome = 'REJECTED_THIS_ATTEMPT'; reason = code === -1008 ? 'PROVIDER_OVERLOAD' : 'PROVIDER_UNAVAILABLE'; circuit = 'OPEN_PROVIDER';
  } else if (status >= 500) {
    // Unknown 5xx responses must never be treated as a safe retry.
  } else if ([-2010, -2011, -2013].includes(code)) {
    reason = 'ABSENCE_OR_DUPLICATE_UNRESOLVED';
  } else if (status >= 200 && status < 300 && (code === undefined || code === 0 || code === 200)) {
    outcome = 'HTTP_ACK_ONLY'; reason = 'RECEIPT_RECONCILIATION_REQUIRED'; circuit = 'CLOSED';
  } else if (status >= 400 && status < 500 && [-1013, -1014, -1015, -1100, -1101, -1102, -1103, -1111, -1121].includes(code)) {
    outcome = 'REJECTED_THIS_ATTEMPT'; reason = 'REJECTION_REQUIRES_REVIEW'; circuit = 'CLOSED';
  }
  return freeze({product, environment: 'demo', outcome, reason, circuit, httpStatus: status ?? null, code: code ?? null,
    rates: rateEvidence(input.headers), automaticRetryAllowed: false, requiresReconciliation: true,
    protectionInstalled: false, nativeVerified: false, executable: false, fixtureOnly: true});
}

/** Log allowlist: never emits raw messages, query strings, IDs, bodies, headers or credentials. */
export function redactBinanceFixtureLogR120(input) {
  record(input);
  const out = {scope: 'offline_fixture', nativeVerified: false, executable: false};
  const enums = {product: PRODUCTS, environment: ['demo'], method: ['GET', 'POST', 'DELETE'],
    outcome: OUTCOMES, reason: REASONS, circuit: CIRCUITS};
  for (const [key, values] of Object.entries(enums)) if (values.includes(input[key])) out[key] = input[key];
  if (PRODUCTS.includes(input.product) && typeof input.method === 'string' && Object.hasOwn(ROUTES[input.product], input.method)
    && ROUTES[input.product][input.method].includes(input.path)) out.path = input.path;
  if (integer(input.httpStatus, 100) && input.httpStatus <= 599) out.httpStatus = input.httpStatus;
  if (Number.isSafeInteger(input.code)) out.code = input.code;
  return freeze(out);
}

/** Closed, synchronous JSON-script harness. Intentionally NOT a R119 adapter transport. */
export class BinanceAuthFixtureR120 {
  #product; #clock; #lastMono; #responses; #logs = []; #circuit = 'CLOSED'; #notBefore = null;
  constructor(config) {
    exact(config, ['product', 'environment', 'clock', 'responses']);
    scope(config.product, config.environment);
    exact(config.clock, ['serverTimeMs', 'monotonicMs']);
    if (!integer(config.clock.serverTimeMs, 1) || !monotonic(config.clock.monotonicMs)) fail('R120_FIXTURE_CLOCK_INVALID');
    if (!Array.isArray(config.responses) || config.responses.length > 1000) fail('R120_FIXTURE_SCRIPT_INVALID');
    this.#responses = config.responses.map(row => {
      exact(row, ['method', 'path', 'observation']); route(config.product, row.method, row.path); observation(row.observation);
      return structuredClone(row);
    });
    this.#product = config.product; this.#clock = {...config.clock}; this.#lastMono = config.clock.monotonicMs;
    Object.freeze(this);
  }
  get binding() { return binanceFixtureBindingR120(this.#product); }
  get status() { return freeze({product: this.#product, environment: 'demo', circuit: this.#circuit,
    notBeforeMonotonicMs: this.#notBefore, pendingResponses: this.#responses.length, simulatedRequests: this.#logs.length,
    ordersSent: 0, executable: false, nativeVerified: false, fixtureOnly: true}); }
  get logs() { return freeze(structuredClone(this.#logs)); }
  simulate(unsignedDescriptor, timing) {
    exact(timing, ['monotonicMs']);
    const mono = timing.monotonicMs;
    if (!monotonic(mono) || mono < this.#lastMono || mono - this.#clock.monotonicMs > 300000) fail('R120_FIXTURE_CLOCK_STALE_OR_REGRESSED');
    this.#lastMono = mono;
    if (this.#circuit !== 'CLOSED') fail('R120_FIXTURE_CIRCUIT_LATCHED');
    const request = descriptor(unsignedDescriptor, this.#product), params = {...request.params};
    const nowMs = this.#clock.serverTimeMs + Math.floor(mono - this.#clock.monotonicMs);
    if (!integer(nowMs, 1)) fail('R120_FIXTURE_CLOCK_INVALID');
    const timestamp = params.timestamp ?? nowMs, recvWindow = params.recvWindow ?? 5000;
    if (!integer(recvWindow, 1) || recvWindow > 5000) fail('R120_FIXTURE_RECV_WINDOW_INVALID');
    if (!integer(timestamp, 1) || timestamp > nowMs || nowMs - timestamp > recvWindow) fail('R120_FIXTURE_REQUEST_STALE_OR_FUTURE');
    const row = this.#responses[0];
    if (!row || row.method !== request.method || row.path !== request.path) fail('R120_FIXTURE_SCRIPT_MISMATCH');
    const signed = signBinanceFixtureR120({...params, timestamp, recvWindow});
    const result = classifyBinanceFixtureOutcomeR120(this.#product, row.observation);
    this.#responses.shift(); this.#circuit = result.circuit;
    if (result.circuit === 'OPEN_RATE_LIMIT' && result.rates.retryAfterMs !== null) {
      const until = mono + result.rates.retryAfterMs;
      this.#notBefore = Number.isFinite(until) && until <= Number.MAX_SAFE_INTEGER ? until : null;
    }
    const log = redactBinanceFixtureLogR120({...result, method: request.method, path: request.path});
    this.#logs.push(log);
    return freeze({...result, fixtureBinding: this.binding, referenceOrigin: ORIGINS[this.#product], method: request.method, path: request.path,
      timestamp, recvWindow, syntheticHmacComputed: signed.fixtureSignature.length === 64,
      signatureScope: 'PUBLIC_SYNTHETIC_HMAC_ONLY', ordersSent: 0, notBeforeMonotonicMs: this.#notBefore});
  }
}
