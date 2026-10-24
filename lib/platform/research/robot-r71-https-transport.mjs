/** Fixed R71 TLS paths: signed policy observation and separately source-signed
 * state query. A response is a configured TLS/DB declaration, not independent
 * runtime attestation. No callback, path, credential header, CA or clock override.
 */
import { readBoundedJson } from '../bounded-response.mjs';
import { inspectR67TrustedSource } from './robot-r67-private-protocol.mjs';
import { inspectR70TargetPins } from './robot-r70-preflight-protocol.mjs';
import { createR71HttpsPolicyPoster, createR71HttpsStatePoster } from './robot-r69-https-transport.mjs';
import { fieldsR71, canonicalR71Json } from './robot-r71-policy.mjs';
import { verifyR71PrivateObservationRecord, createR71SourceStateQuery,
  inspectR71SourceStateResult } from './robot-r71-private-protocol.mjs';
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
export function createR71HttpsObservationSender(input) {
  const c = fieldsR71(input, ['origin', 'trustedSource', 'timeoutMs'], ['origin', 'trustedSource'], 'R71_HTTPS_CONFIG');
  const trustedSource = inspectR67TrustedSource(c.trustedSource);
  const post = createR71HttpsPolicyPoster({ origin: c.origin,
    ...(c.timeoutMs === undefined ? {} : { timeoutMs: c.timeoutMs }) });
  return async record => {
    const verified = verifyR71PrivateObservationRecord(record, { trustedSource, nowMs: Date.now() });
    return post(canonicalR71Json(verified.record));
  };
}
export function createR71SourceStateClient(input) {
  const c = fieldsR71(input, ['targetPins', 'trustedSource', 'privateKeyPem', 'timeoutMs'],
    ['targetPins', 'trustedSource', 'privateKeyPem'], 'R71_STATE_CLIENT_CONFIG');
  const targetPins = inspectR70TargetPins(c.targetPins), trustedSource = inspectR67TrustedSource(c.trustedSource);
  const signing = { targetPins, trustedSource, privateKeyPem: c.privateKeyPem };
  // Offline construction confirms the configured signing identity. This query
  // is discarded; each real read below creates its own nonce and deadline.
  createR71SourceStateQuery(signing);
  const post = createR71HttpsStatePoster({ origin: targetPins.origin,
    ...(c.timeoutMs === undefined ? {} : { timeoutMs: c.timeoutMs }) });
  return async function getActiveState() {
    const query = createR71SourceStateQuery(signing), response = await post(canonicalR71Json(query));
    if (!(response instanceof Response) || response.status !== 200) fail('R71_STATE_HTTP_RESPONSE');
    let body;
    try { body = await readBoundedJson(response, 8192); }
    catch { fail('R71_STATE_RESPONSE_JSON'); }
    return inspectR71SourceStateResult(body, { query, trustedSource, targetPins }).runtimeView;
  };
}
