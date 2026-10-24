/**
 * R69 explicit HTTPS transport for the unchanged signed R67 QA protocol.
 * The origin is a host declaration, not proof of a QA deployment or authority
 * to activate one. Source signatures authenticate the configured source; the
 * existing R67 emitter alone validates the exact ACK and changes queue state.
 * No credentials, transport callbacks, proxy, custom CA or TLS overrides can
 * be supplied through this API. No retry, outbox, strategy or receiver is added.
 */
import { Agent, request } from 'node:https';
import { canonicalR67Json, R67_LIMITS, inspectR67TrustedSource,
  verifyR67PrivateObservationRecord, fieldsR67 } from './robot-r67-private-protocol.mjs';
import { R67_OBSERVATION_PATH } from './robot-r67-loopback-transport.mjs';

export const R69_HTTPS_LIMITS = Object.freeze({ requestBytes: R67_LIMITS.maxBytes,
  responseBytes: 8192, minimumTimeoutMs: 50, maximumTimeoutMs: 10000, defaultTimeoutMs: 3000 });
export const R69_HTTPS_TRANSPORT_BOUNDARIES = Object.freeze({
  schema: 'JENIOS_R69_HTTPS_TRANSPORT_BOUNDARIES_V1', transport: 'HTTPS',
  targetDeclarationRequired: true, targetDeploymentQaVerified: false,
  targetDeploymentClassification: 'DECLARED_ORIGIN_NOT_VERIFIED_QA_DEPLOYMENT',
  operationalActivationAuthorized: false, sourceAuthentication: 'UNCHANGED_R67_DUAL_ED25519_SIGNATURES',
  acknowledgementAuthentication: 'TLS_PEER_AND_UNCHANGED_R67_RECORD_BINDINGS_NOT_SIGNED_RECEIPT',
  certificateVerificationRequired: true, hostnameVerificationRequired: true,
  redirectsAllowed: false, ambientProxyUsed: false, callerTransportOverridesAllowed: false,
  knownProductionAliasesBlocked: true, productionAliasBlockIsExhaustive: false,
  receiverCredentialsProvided: false, hostedEnvironmentCertified: false,
  customerMonitoringActive: false, privateOperationalSourceActive: false,
  realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0,
});
const error = code => Object.assign(new Error(code), { name: 'ValidationError', code });
const fail = code => { throw error(code); };
function requireTlsVerification() {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') fail('R69_HTTPS_TLS_VERIFICATION_REQUIRED');
}
function declaredOrigin(input) {
  if (typeof input !== 'string' || input.length > 2048) fail('R69_HTTPS_ORIGIN_REQUIRED');
  let parsed;
  try { parsed = new URL(input); } catch { fail('R69_HTTPS_ORIGIN_REQUIRED'); }
  if (parsed.protocol !== 'https:' || parsed.origin !== input || !parsed.hostname ||
      parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash)
    fail('R69_HTTPS_ORIGIN_REQUIRED');
  // DNS root dots cannot turn a known production alias into a QA declaration.
  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (['jenios.com.br', 'www.jenios.com.br'].includes(hostname)) fail('R69_HTTPS_PRODUCTION_ORIGIN_FORBIDDEN');
  return parsed.origin;
}

function transfer(target, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    // An isolated non-persistent agent avoids ambient proxy configuration and
    // global-agent changes. Default trusted CAs (including startup extra CAs)
    // remain active; neither ca nor checkServerIdentity is overridden.
    const agent = new Agent({ keepAlive: false, maxCachedSessions: 0, maxSockets: 1,
      maxTotalSockets: 1, proxyEnv: Object.freeze({}), rejectUnauthorized: true, minVersion: 'TLSv1.2' });
    const controller = new AbortController();
    let outgoing, incoming, completed = false;
    const finish = (failure, response) => {
      if (completed) return;
      completed = true; clearTimeout(timer);
      // Destroy before settling: the queue must not retry while this transport
      // can still initiate additional network writes. A remote commit may still
      // have happened; only the existing verified ACK path can resolve that.
      incoming?.destroy(); outgoing?.destroy(); agent.destroy();
      if (failure) reject(failure); else resolve(response);
    };
    // A socket inactivity timeout is insufficient. This deadline begins before
    // DNS/connect/TLS and remains armed through the complete response body.
    const timer = setTimeout(() => {
      controller.abort(); finish(error('R69_HTTPS_REQUEST_UNCONFIRMED'));
    }, timeoutMs);
    try {
      outgoing = request(target, { method: 'POST', agent, rejectUnauthorized: true, minVersion: 'TLSv1.2',
        signal: controller.signal, maxHeaderSize: 8192,
        headers: { 'content-type': 'application/json', accept: 'application/json',
          'accept-encoding': 'identity', 'content-length': String(Buffer.byteLength(body)) } }, response => {
        incoming = response;
        const status = response.statusCode;
        response.once('error', () => finish(error('R69_HTTPS_REQUEST_UNCONFIRMED')));
        response.once('aborted', () => finish(error('R69_HTTPS_REQUEST_UNCONFIRMED')));
        if (status >= 300 && status <= 399) { finish(error('R69_HTTPS_REDIRECT_FORBIDDEN')); return; }
        if (![200, 202].includes(status)) { finish(error('R69_HTTPS_RESPONSE_STATUS')); return; }
        const type = response.headers['content-type'], length = response.headers['content-length'];
        if (typeof type !== 'string' || !/^application\/json(?:\s*;|$)/i.test(type)) {
          finish(error('R69_HTTPS_RESPONSE_TYPE')); return;
        }
        if (length !== undefined && (typeof length !== 'string' || !/^(0|[1-9][0-9]*)$/.test(length) ||
            Number(length) > R69_HTTPS_LIMITS.responseBytes)) {
          finish(error('R69_HTTPS_RESPONSE_TOO_LARGE')); return;
        }
        const encoding = response.headers['content-encoding'];
        if (encoding !== undefined && encoding !== 'identity') { finish(error('R69_HTTPS_RESPONSE_ENCODING')); return; }
        const chunks = []; let size = 0;
        response.on('data', chunk => {
          if (completed) return;
          size += chunk.length;
          if (size > R69_HTTPS_LIMITS.responseBytes) { finish(error('R69_HTTPS_RESPONSE_TOO_LARGE')); return; }
          chunks.push(chunk);
        });
        response.once('end', () => {
          if (completed) return;
          if (!response.complete) { finish(error('R69_HTTPS_REQUEST_UNCONFIRMED')); return; }
          try { finish(null, new Response(Buffer.concat(chunks, size), { status, headers: { 'content-type': type } })); }
          catch { finish(error('R69_HTTPS_REQUEST_UNCONFIRMED')); }
        });
      });
      outgoing.once('error', () => finish(error('R69_HTTPS_REQUEST_UNCONFIRMED')));
      outgoing.once('upgrade', (_response, socket) => {
        socket.destroy(); finish(error('R69_HTTPS_RESPONSE_STATUS'));
      });
      outgoing.end(body);
    } catch { finish(error('R69_HTTPS_REQUEST_UNCONFIRMED')); }
  });
}

export function createR69HttpsObservationSender(input) {
  const c = fieldsR67(input, ['origin', 'trustedSource', 'timeoutMs'], ['origin', 'trustedSource'], 'R69_HTTPS_CONFIG');
  requireTlsVerification();
  const target = declaredOrigin(c.origin) + R67_OBSERVATION_PATH;
  const source = inspectR67TrustedSource(c.trustedSource);
  const timeoutMs = c.timeoutMs === undefined ? R69_HTTPS_LIMITS.defaultTimeoutMs : c.timeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < R69_HTTPS_LIMITS.minimumTimeoutMs ||
      timeoutMs > R69_HTTPS_LIMITS.maximumTimeoutMs) fail('R69_HTTPS_TIMEOUT_INVALID');
  return async record => {
    requireTlsVerification();
    const verified = verifyR67PrivateObservationRecord(record, { trustedSource: source, nowMs: Date.now() });
    const body = canonicalR67Json(verified.record);
    if (Buffer.byteLength(body) > R69_HTTPS_LIMITS.requestBytes) fail('R69_HTTPS_REQUEST_TOO_LARGE');
    return transfer(target, body, timeoutMs);
  };
}
