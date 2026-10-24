/** Source-authenticated configuration comparison. No SDK, database, private
 * loader, observation parser, outbox or administrative identity is invoked.
 * Runtime metadata is a server declaration, not independent attestation.
 */
import { readBoundedJson } from '../bounded-response.mjs';
import { isRobotR67QaEnabled, readR67SourceConfiguration } from './robot-r67-access.mjs';
import { fieldsR67, r67SourceKeyDigest } from './robot-r67-private-protocol.mjs';
import { R70_TARGET_PINS_SCHEMA, R70_PREFLIGHT_LIMITS, inspectR70TargetPins,
  createR70PreflightResponse } from './robot-r70-preflight-protocol.mjs';

const respond = (body, status) => Response.json(body, { status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const value = (env, key) => {
  const descriptor = env && typeof env === 'object' ? Object.getOwnPropertyDescriptor(env, key) : null;
  return descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'string'
    ? descriptor.value : undefined;
};
const enabled = env => isRobotR67QaEnabled(env) && value(env, 'JENIOS_ROBOT_R70_PREFLIGHT_ENABLED') === 'true';
const disabled = () => respond({ error: 'R70_PREFLIGHT_DISABLED' }, 404);
const unavailable = () => respond({ error: 'R70_PREFLIGHT_SERVER_CONFIGURATION' }, 503);
function configuration(env) {
  if (value(env, 'VERCEL_TARGET_ENV') !== 'preview' || value(env, 'VERCEL_ENV') !== 'preview') throw Error();
  const url = value(env, 'VERCEL_URL');
  if (!url || url.includes('/') || url.includes('?') || url.includes('#')) throw Error();
  const source = readR67SourceConfiguration(env);
  const targetPins = inspectR70TargetPins({ schema: R70_TARGET_PINS_SCHEMA, origin: 'https://' + url,
    projectId: value(env, 'VERCEL_PROJECT_ID'), deploymentId: value(env, 'VERCEL_DEPLOYMENT_ID'),
    commitSha: value(env, 'VERCEL_GIT_COMMIT_SHA'), scopeId: source.scopeId, sourceId: source.sourceId,
    sourceKeySha256: r67SourceKeyDigest(source) });
  return { source, targetPins };
}

export async function handleR70PreflightRequest(request, input = {}) {
  const options = fieldsR67(input, ['env', 'nowMs'], [], 'R70_PREFLIGHT_HTTP_CONFIG');
  const env = options.env ?? process.env;
  // A disabled route never reads the request body or source configuration.
  if (!enabled(env)) return disabled();
  if (request.method !== 'POST') return respond({ error: 'R70_PREFLIGHT_METHOD' }, 405);
  if (new URL(request.url).search) return respond({ error: 'R70_PREFLIGHT_QUERY' }, 400);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || ''))
    return respond({ error: 'R70_PREFLIGHT_CONTENT_TYPE' }, 415);
  try { configuration(env); } catch { return unavailable(); }
  let body;
  try { body = await readBoundedJson(request, R70_PREFLIGHT_LIMITS.requestBytes); }
  catch { return respond({ error: 'R70_PREFLIGHT_BODY' }, 400); }
  // A slow incoming body must not retain a gate/configuration snapshot taken
  // earlier. Freshness uses the clock after complete bounded body admission.
  if (!enabled(env)) return disabled();
  let configured;
  try { configured = configuration(env); } catch { return unavailable(); }
  try {
    const response = createR70PreflightResponse(body, { trustedSource: configured.source,
      targetPins: configured.targetPins, ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs }) });
    return respond(response, 200);
  } catch (error) {
    if (error?.code === 'R70_PREFLIGHT_TARGET_MISMATCH') return respond({ error: 'R70_PREFLIGHT_TARGET_MISMATCH' }, 409);
    if (['R70_PREFLIGHT_SIGNATURE', 'R70_PREFLIGHT_SOURCE_BINDING'].includes(error?.code))
      return respond({ error: 'R70_PREFLIGHT_AUTHENTICATION' }, 401);
    return respond({ error: 'R70_PREFLIGHT_CHALLENGE' }, 400);
  }
}
