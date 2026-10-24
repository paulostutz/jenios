import test from 'node:test';
import assert from 'node:assert/strict';
import { createR70PreflightFixture } from './fixtures/r70-preflight-fixture.mjs';
import { createR70PreflightRequest, inspectR70PreflightResponse, canonicalR70Json,
  R70_PREFLIGHT_PATH } from '../lib/platform/research/robot-r70-preflight-protocol.mjs';
import { handleR70PreflightRequest } from '../lib/platform/research/robot-r70-preflight-http.mjs';

const NOW = 1792868400000;
const challenge = (f, extra = {}) => createR70PreflightRequest({ targetPins: f.targetPins,
  trustedSource: f.trustedSource, privateKeyPem: f.privateKeyPem, nowMs: NOW, ...extra });
const http = (body, { method = 'POST', contentType = 'application/json', query = '', headers = {} } = {}) =>
  new Request('https://untrusted-forwarded-host.invalid' + R70_PREFLIGHT_PATH + query, {
    method, headers: { 'content-type': contentType, ...headers }, ...(method === 'GET' ? {} : { body: canonicalR70Json(body) }) });
async function status(f, request, expected, env = f.env) {
  const response = await handleR70PreflightRequest(request, { env, nowMs: NOW });
  assert.equal(response.status, expected); assert.equal(response.headers.get('cache-control'), 'no-store');
  return response;
}

test('R70 gates deny before touching a body or source/deployment configuration', async () => {
  const f = createR70PreflightFixture(); let bodyReads = 0, configReads = 0;
  const request = { get body() { bodyReads++; throw Error(); } };
  const env = { ...f.env, JENIOS_ROBOT_R70_PREFLIGHT_ENABLED: 'false',
    get JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY() { configReads++; throw Error(); } };
  await status(f, request, 404, env); assert.equal(bodyReads, 0); assert.equal(configReads, 0);
  for (const [key, value] of [['VERCEL_ENV', 'production'], ['JENIOS_ROBOT_R67_ENABLED', 'false'],
    ['JENIOS_ROBOT_ANALYST_PAID_ENABLED', 'true'], ['JENIOS_REAL_EXECUTION_ENABLED', 'true']])
    await status(f, request, 404, { ...f.env, [key]: value });
  assert.equal(bodyReads, 0);
});

test('R70 authenticates its source and responds with server pins while ignoring Host, Forwarded and database credentials', async () => {
  const f = createR70PreflightFixture(), signed = challenge(f); let secretsRead = 0;
  for (const key of ['PLATFORM_SUPABASE_URL', 'PLATFORM_SUPABASE_SERVICE_ROLE_KEY', 'PLATFORM_ADMIN_USER_IDS'])
    Object.defineProperty(f.env, key, { enumerable: true, get() { secretsRead++; throw Error('not required'); } });
  const response = await status(f, http(signed, { headers: { host: 'attacker.invalid',
    forwarded: 'host=attacker.invalid', 'x-forwarded-host': 'attacker.invalid', cookie: 'unused', authorization: 'Bearer unused' } }), 200);
  const body = await response.json();
  inspectR70PreflightResponse(body, { request: signed, targetPins: f.targetPins, nowMs: NOW });
  assert.equal(body.targetPins.origin, f.targetPins.origin); assert.equal(secretsRead, 0);
  assert.equal(body.remoteQaDeploymentVerified, false); assert.equal(body.operationalReady, false);
  for (const key of ['observations', 'record', 'scenarios', 'privateKeyPem', 'publicKeyPem', 'credentials'])
    assert.equal(Object.hasOwn(body, key), false);
});

test('R70 requires complete preview runtime metadata before reading a challenge', async () => {
  const f = createR70PreflightFixture();
  for (const key of ['VERCEL_URL', 'VERCEL_PROJECT_ID', 'VERCEL_DEPLOYMENT_ID', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL_TARGET_ENV']) {
    const env = { ...f.env }; delete env[key];
    await status(f, http({}), 503, env);
  }
  for (const change of [{ VERCEL_TARGET_ENV: 'production' }, { VERCEL_URL: 'https://r70-fixture.vercel.app' },
    { VERCEL_URL: 'www.jenios.com.br' }, { VERCEL_URL: 'localhost:1234' }, { VERCEL_DEPLOYMENT_ID: 'unknown' }])
    await status(f, http({}), 503, { ...f.env, ...change });
});

test('R70 mismatched signed deployment is rejected instead of echoed and a foreign configured source is unauthorized', async () => {
  const f = createR70PreflightFixture();
  for (const change of [{ deploymentId: 'dpl_other' }, { projectId: 'prj_other' },
    { commitSha: '0'.repeat(40) }, { origin: 'https://other.vercel.app' }]) {
    const signed = challenge(f, { targetPins: { ...f.targetPins, ...change } });
    await status(f, http(signed), 409);
  }
  const foreign = createR70PreflightFixture();
  await status(f, http(challenge(foreign)), 401);
});

test('R70 rejects invalid signatures, stale challenges and unsupported HTTP shapes without private fields in errors', async () => {
  const f = createR70PreflightFixture(), signed = challenge(f);
  const invalid = { ...signed, signatureBase64: 'A'.repeat(86) + '==' };
  await status(f, http(invalid), 401);
  await status(f, http(challenge(f, { nowMs: NOW - 15000 })), 400);
  await status(f, http(challenge(f, { nowMs: NOW + 1001 })), 400);
  await status(f, http(signed, { contentType: 'text/plain' }), 415);
  await status(f, http(signed, { method: 'GET' }), 405);
  const rejected = await status(f, http(signed, { query: '?scopeId=override' }), 400);
  assert.deepEqual(Object.keys(await rejected.json()), ['error']);
});

test('R70 bounds both advertised and streamed request bodies before signature processing', async () => {
  const f = createR70PreflightFixture(), signed = challenge(f);
  await status(f, http(signed, { headers: { 'content-length': '4097' } }), 400);
  const oversized = new Request('https://r70-fixture.vercel.app' + R70_PREFLIGHT_PATH,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: ' '.repeat(4097) });
  await status(f, oversized, 400);
  const invalidUtf8 = new Request('https://r70-fixture.vercel.app' + R70_PREFLIGHT_PATH,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: Uint8Array.from([0xc3, 0x28]) });
  await status(f, invalidUtf8, 400);
});

test('R70 rereads gates and receiver metadata after awaiting a complete request body', async () => {
  const f = createR70PreflightFixture(), signed = challenge(f);
  for (const action of ['disable', 'changeDeployment']) {
    const env = { ...f.env }; let control;
    const stream = new ReadableStream({ start(controller) { control = controller; } });
    const request = new Request('https://r70-fixture.vercel.app' + R70_PREFLIGHT_PATH,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half' });
    const pending = handleR70PreflightRequest(request, { env, nowMs: NOW });
    if (action === 'disable') env.JENIOS_ROBOT_R70_PREFLIGHT_ENABLED = 'false';
    else env.VERCEL_DEPLOYMENT_ID = 'dpl_changedWhileReading';
    control.enqueue(new TextEncoder().encode(canonicalR70Json(signed))); control.close();
    const response = await pending;
    assert.equal(response.status, action === 'disable' ? 404 : 409);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});
