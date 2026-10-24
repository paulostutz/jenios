/** A fresh, source-signed challenge over the closed existing TLS engine.
 * This client has no observation or queue API and never interprets a match as
 * approval, independent deployment proof or hosted authentication acceptance.
 */
import { readBoundedJson } from '../bounded-response.mjs';
import { fieldsR67, freezeR67, inspectR67TrustedSource } from './robot-r67-private-protocol.mjs';
import { createR69HttpsPreflightPoster } from './robot-r69-https-transport.mjs';
import { canonicalR70Json, inspectR70TargetPins, classifyR70TargetPins, r70TargetPinsDigest,
  createR70PreflightRequest, inspectR70PreflightResponse, R70_PREFLIGHT_LIMITS,
  R70_PREFLIGHT_BOUNDARIES } from './robot-r70-preflight-protocol.mjs';

const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
export function createR70PreflightClient(input) {
  const c = fieldsR67(input, ['targetPins', 'trustedSource', 'privateKeyPem', 'timeoutMs'],
    ['targetPins', 'trustedSource', 'privateKeyPem'], 'R70_PREFLIGHT_CLIENT_CONFIG');
  const targetPins = inspectR70TargetPins(c.targetPins), trustedSource = inspectR67TrustedSource(c.trustedSource);
  const signing = { targetPins, trustedSource, privateKeyPem: c.privateKeyPem };
  // Validate custody identity at construction, without retaining this discarded
  // challenge. Every actual probe below creates its own current random nonce.
  createR70PreflightRequest(signing);
  const post = createR69HttpsPreflightPoster({ origin: targetPins.origin,
    ...(c.timeoutMs === undefined ? {} : { timeoutMs: c.timeoutMs }) });
  return async function probe() {
    const request = createR70PreflightRequest(signing);
    const response = await post(canonicalR70Json(request));
    if (!(response instanceof Response) || response.status !== 200) fail('R70_PREFLIGHT_HTTP_RESPONSE');
    let body;
    try { body = await readBoundedJson(response, R70_PREFLIGHT_LIMITS.responseBytes); }
    catch { fail('R70_PREFLIGHT_RESPONSE_JSON'); }
    const observed = inspectR70PreflightResponse(body, { request, targetPins });
    return freezeR67({ schema: 'JENIOS_R70_PREFLIGHT_RESULT_V1', status: 'CONFIGURATION_MATCH',
      observedAtMs: observed.observedAtMs, expiresAtMs: observed.expiresAtMs,
      targetPinsSha256: r70TargetPinsDigest(targetPins), requestDigest: observed.requestDigest,
      targetClassification: classifyR70TargetPins(targetPins), configuredSourceChallengeSigned: true,
      ...R70_PREFLIGHT_BOUNDARIES });
  };
}
