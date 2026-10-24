/** R70 source-authenticated configuration challenge. Pins are declarations
 * accepted outside this protocol, not independent deployment/runtime proof.
 * No observation, private executable, database or delivery state is involved.
 */
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import { canonicalR67Json, fieldsR67, freezeR67, inspectR67TrustedSource,
  r67SourceKeyDigest } from './robot-r67-private-protocol.mjs';

export const R70_PREFLIGHT_PATH = '/api/platform/robot-private-target-preflight';
export const R70_TARGET_PINS_SCHEMA = 'JENIOS_R70_TARGET_PINS_V1';
export const R70_CHALLENGE_DOMAIN = 'JENIOS_R70_SOURCE_TARGET_PREFLIGHT_V1\0';
export const R70_PREFLIGHT_LIMITS = Object.freeze({ requestBytes: 4096, responseBytes: 8192,
  lifetimeMs: 15000, maximumFutureSkewMs: 1000 });
export const R70_PREFLIGHT_BOUNDARIES = Object.freeze({
  remoteQaDeploymentVerified: false, independentRuntimeAttestation: false,
  hostedAuthenticationCertified: false, operationalReady: false,
  customerMonitoringActive: false, privateOperationalSourceActive: false,
  realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0,
});
export const canonicalR70Json = canonicalR67Json;
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const exact = (input, keys, code) => fieldsR67(input, keys, keys, code);
const sha = text => createHash('sha256').update(text).digest('hex');
const PINS_KEYS = ['schema', 'origin', 'projectId', 'deploymentId', 'commitSha', 'scopeId',
  'sourceId', 'sourceKeySha256'];
const PAYLOAD_KEYS = ['schema', 'nonce', 'issuedAtMs', 'expiresAtMs', 'targetPins'];
const REQUEST_KEYS = ['schema', 'payload', 'signatureBase64'];
const RESPONSE_KEYS = ['schema', 'status', 'nonce', 'requestDigest', 'observedAtMs', 'expiresAtMs',
  'targetPins', ...Object.keys(R70_PREFLIGHT_BOUNDARIES)];
const time = value => Number.isSafeInteger(value) && value >= 0;
const clock = value => {
  const result = value === undefined ? Date.now() : value;
  if (!time(result)) fail('R70_PREFLIGHT_CLOCK');
  return result;
};

export function inspectR70TargetPins(input) {
  const p = exact(input, PINS_KEYS, 'R70_TARGET_PINS');
  if (p.schema !== R70_TARGET_PINS_SCHEMA || typeof p.projectId !== 'string' ||
      !/^prj_[A-Za-z0-9]{1,80}$/.test(p.projectId) || typeof p.deploymentId !== 'string' ||
      !/^dpl_[A-Za-z0-9]{1,80}$/.test(p.deploymentId) || typeof p.commitSha !== 'string' ||
      !/^[a-f0-9]{40}$/.test(p.commitSha) || typeof p.scopeId !== 'string' ||
      !/^scope:[a-f0-9]{16}$/.test(p.scopeId) || typeof p.sourceId !== 'string' ||
      !/^source:[a-f0-9]{16}$/.test(p.sourceId) || typeof p.sourceKeySha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(p.sourceKeySha256)) fail('R70_TARGET_PINS');
  let url;
  try { if (typeof p.origin !== 'string' || p.origin.length > 2048) throw Error(); url = new URL(p.origin); }
  catch { fail('R70_TARGET_ORIGIN'); }
  if (url.protocol !== 'https:' || url.origin !== p.origin || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) fail('R70_TARGET_ORIGIN');
  const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
  if (['jenios.com.br', 'www.jenios.com.br'].includes(hostname)) fail('R70_TARGET_PRODUCTION_ORIGIN');
  const loopback = ['127.0.0.1', '[::1]'].includes(url.hostname);
  // This syntax restriction does NOT establish that a URL is an immutable
  // deployment URL. Its exact control-plane selection remains external.
  const vercel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(url.hostname) && !url.port;
  if (!loopback && !vercel) fail('R70_TARGET_ORIGIN');
  return freezeR67({ ...p });
}
export function classifyR70TargetPins(input) {
  const pins = inspectR70TargetPins(input);
  return ['127.0.0.1', '[::1]'].includes(new URL(pins.origin).hostname)
    ? 'LOCAL_TLS_ACCEPTANCE_FIXTURE' : 'DECLARED_VERCEL_ORIGIN_NOT_INDEPENDENTLY_BOUND';
}
export const r70TargetPinsDigest = input => sha('JENIOS_R70_TARGET_PINS_DIGEST_V1\0' +
  canonicalR70Json(inspectR70TargetPins(input)));
function sourceBinding(targetPins, trustedSource) {
  const source = inspectR67TrustedSource(trustedSource);
  if (targetPins.scopeId !== source.scopeId || targetPins.sourceId !== source.sourceId ||
      targetPins.sourceKeySha256 !== r67SourceKeyDigest(source)) fail('R70_PREFLIGHT_SOURCE_BINDING');
  return source;
}
function requestShape(input, nowMs) {
  const r = exact(input, REQUEST_KEYS, 'R70_PREFLIGHT_REQUEST');
  const p = exact(r.payload, PAYLOAD_KEYS, 'R70_PREFLIGHT_PAYLOAD');
  if (r.schema !== 'JENIOS_R70_SIGNED_PREFLIGHT_REQUEST_V1' ||
      p.schema !== 'JENIOS_R70_PREFLIGHT_CHALLENGE_V1' || typeof p.nonce !== 'string' ||
      !/^[a-f0-9]{64}$/.test(p.nonce) || !time(p.issuedAtMs) || !time(p.expiresAtMs) ||
      p.expiresAtMs - p.issuedAtMs !== R70_PREFLIGHT_LIMITS.lifetimeMs)
    fail('R70_PREFLIGHT_REQUEST');
  if (p.issuedAtMs > nowMs + R70_PREFLIGHT_LIMITS.maximumFutureSkewMs || nowMs >= p.expiresAtMs)
    fail('R70_PREFLIGHT_REQUEST_TIME');
  if (typeof r.signatureBase64 !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(r.signatureBase64))
    fail('R70_PREFLIGHT_SIGNATURE');
  const signature = Buffer.from(r.signatureBase64, 'base64');
  if (signature.length !== 64 || signature.toString('base64') !== r.signatureBase64)
    fail('R70_PREFLIGHT_SIGNATURE');
  const result = { schema: r.schema, payload: { ...p, targetPins: inspectR70TargetPins(p.targetPins) },
    signatureBase64: r.signatureBase64 };
  if (Buffer.byteLength(canonicalR70Json(result)) > R70_PREFLIGHT_LIMITS.requestBytes)
    fail('R70_PREFLIGHT_REQUEST_TOO_LARGE');
  return freezeR67(result);
}
const requestDigest = request => sha('JENIOS_R70_SIGNED_PREFLIGHT_DIGEST_V1\0' + canonicalR70Json(request));

export function createR70PreflightRequest(input) {
  const c = fieldsR67(input, ['targetPins', 'trustedSource', 'privateKeyPem', 'nowMs', 'nonce'],
    ['targetPins', 'trustedSource', 'privateKeyPem'], 'R70_PREFLIGHT_SIGN_CONFIG');
  const targetPins = inspectR70TargetPins(c.targetPins), source = sourceBinding(targetPins, c.trustedSource);
  const nowMs = clock(c.nowMs), nonce = c.nonce === undefined ? randomBytes(32).toString('hex') : c.nonce;
  if (typeof c.privateKeyPem !== 'string' || c.privateKeyPem.length > 4096) fail('R70_PREFLIGHT_SIGNING_KEY');
  let key;
  try { key = createPrivateKey(c.privateKeyPem); }
  catch { fail('R70_PREFLIGHT_SIGNING_KEY'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('R70_PREFLIGHT_SIGNING_KEY');
  if (!createPublicKey(key).export({ type: 'spki', format: 'der' }).equals(
    createPublicKey(source.publicKeyPem).export({ type: 'spki', format: 'der' }))) fail('R70_PREFLIGHT_SIGNING_KEY_MISMATCH');
  const payload = { schema: 'JENIOS_R70_PREFLIGHT_CHALLENGE_V1', nonce, issuedAtMs: nowMs,
    expiresAtMs: nowMs + R70_PREFLIGHT_LIMITS.lifetimeMs, targetPins };
  const request = { schema: 'JENIOS_R70_SIGNED_PREFLIGHT_REQUEST_V1', payload,
    signatureBase64: sign(null, Buffer.from(R70_CHALLENGE_DOMAIN + canonicalR70Json(payload)), key).toString('base64') };
  return requestShape(request, nowMs);
}
export function verifyR70PreflightRequest(input, options) {
  const c = fieldsR67(options, ['trustedSource', 'nowMs'], ['trustedSource'], 'R70_PREFLIGHT_VERIFY_CONFIG');
  const request = requestShape(input, clock(c.nowMs)), source = sourceBinding(request.payload.targetPins, c.trustedSource);
  let valid = false;
  try { valid = verify(null, Buffer.from(R70_CHALLENGE_DOMAIN + canonicalR70Json(request.payload)),
    createPublicKey(source.publicKeyPem), Buffer.from(request.signatureBase64, 'base64')); } catch { /* fail closed */ }
  if (!valid) fail('R70_PREFLIGHT_SIGNATURE');
  return freezeR67({ request, requestDigest: requestDigest(request) });
}
export function createR70PreflightResponse(input, options) {
  const c = fieldsR67(options, ['trustedSource', 'targetPins', 'nowMs'],
    ['trustedSource', 'targetPins'], 'R70_PREFLIGHT_RESPONSE_CONFIG');
  const nowMs = clock(c.nowMs), verified = verifyR70PreflightRequest(input, { trustedSource: c.trustedSource, nowMs });
  const targetPins = inspectR70TargetPins(c.targetPins);
  sourceBinding(targetPins, c.trustedSource);
  if (canonicalR70Json(targetPins) !== canonicalR70Json(verified.request.payload.targetPins))
    fail('R70_PREFLIGHT_TARGET_MISMATCH');
  return freezeR67({ schema: 'JENIOS_R70_PREFLIGHT_RESPONSE_V1', status: 'CONFIGURATION_MATCH',
    nonce: verified.request.payload.nonce, requestDigest: verified.requestDigest, observedAtMs: nowMs,
    expiresAtMs: verified.request.payload.expiresAtMs, targetPins, ...R70_PREFLIGHT_BOUNDARIES });
}
export function inspectR70PreflightResponse(input, options) {
  const c = fieldsR67(options, ['request', 'targetPins', 'nowMs'],
    ['request', 'targetPins'], 'R70_PREFLIGHT_INSPECT_CONFIG');
  const nowMs = clock(c.nowMs), request = requestShape(c.request, nowMs), targetPins = inspectR70TargetPins(c.targetPins);
  const response = exact(input, RESPONSE_KEYS, 'R70_PREFLIGHT_RESPONSE');
  if (response.schema !== 'JENIOS_R70_PREFLIGHT_RESPONSE_V1' || response.status !== 'CONFIGURATION_MATCH' ||
      Object.entries(R70_PREFLIGHT_BOUNDARIES).some(([key, value]) => response[key] !== value))
    fail('R70_PREFLIGHT_RESPONSE');
  const actualPins = inspectR70TargetPins(response.targetPins);
  if (response.nonce !== request.payload.nonce || response.requestDigest !== requestDigest(request) ||
      response.expiresAtMs !== request.payload.expiresAtMs ||
      canonicalR70Json(request.payload.targetPins) !== canonicalR70Json(targetPins) ||
      canonicalR70Json(actualPins) !== canonicalR70Json(targetPins)) fail('R70_PREFLIGHT_RESPONSE_BINDING');
  if (!time(response.observedAtMs) || response.observedAtMs >= response.expiresAtMs ||
      response.observedAtMs < request.payload.issuedAtMs - R70_PREFLIGHT_LIMITS.maximumFutureSkewMs ||
      response.observedAtMs > nowMs + R70_PREFLIGHT_LIMITS.maximumFutureSkewMs)
    fail('R70_PREFLIGHT_RESPONSE_TIME');
  const result = { ...response, targetPins: actualPins };
  if (Buffer.byteLength(canonicalR70Json(result)) > R70_PREFLIGHT_LIMITS.responseBytes)
    fail('R70_PREFLIGHT_RESPONSE_TOO_LARGE');
  return freezeR67(result);
}
