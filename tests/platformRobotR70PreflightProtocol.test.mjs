import test from 'node:test';
import assert from 'node:assert/strict';
import { sign } from 'node:crypto';
import { createR70PreflightFixture } from './fixtures/r70-preflight-fixture.mjs';
import { canonicalR70Json, R70_CHALLENGE_DOMAIN, R70_PREFLIGHT_BOUNDARIES,
  inspectR70TargetPins, classifyR70TargetPins, r70TargetPinsDigest,
  createR70PreflightRequest, verifyR70PreflightRequest, createR70PreflightResponse,
  inspectR70PreflightResponse } from '../lib/platform/research/robot-r70-preflight-protocol.mjs';

const NOW = 1792868400000;
const nonce = '70'.repeat(32);
const denied = (fn, code) => assert.throws(fn, error => error.code === code);
const request = (f, extra = {}) => createR70PreflightRequest({ targetPins: f.targetPins,
  trustedSource: f.trustedSource, privateKeyPem: f.privateKeyPem, nowMs: NOW, nonce, ...extra });
const response = (f, req) => createR70PreflightResponse(req,
  { targetPins: f.targetPins, trustedSource: f.trustedSource, nowMs: NOW });

test('R70 signs every declared target pin in a separate source-authenticated challenge and freezes the exact result', () => {
  const f = createR70PreflightFixture(), req = request(f);
  const verified = verifyR70PreflightRequest(JSON.parse(canonicalR70Json(req)), { trustedSource: f.trustedSource, nowMs: NOW });
  assert.deepEqual(verified.request, req); assert.match(verified.requestDigest, /^[a-f0-9]{64}$/);
  assert.equal(req.payload.expiresAtMs - req.payload.issuedAtMs, 15000);
  assert.equal(Object.isFrozen(req.payload.targetPins), true);
  assert.deepEqual(Object.keys(req.payload).sort(), ['expiresAtMs', 'issuedAtMs', 'nonce', 'schema', 'targetPins']);
  const observed = inspectR70PreflightResponse(response(f, req), { request: req, targetPins: f.targetPins, nowMs: NOW });
  assert.equal(observed.requestDigest, verified.requestDigest); assert.equal(observed.status, 'CONFIGURATION_MATCH');
  for (const [key, value] of Object.entries(R70_PREFLIGHT_BOUNDARIES)) assert.equal(observed[key], value);
});

test('R70 pins allow literal TLS loopback or declared Vercel origin without elevating hostname syntax to evidence', () => {
  const f = createR70PreflightFixture();
  for (const origin of ['https://127.0.0.1:12345', 'https://[::1]:12345']) {
    const pins = inspectR70TargetPins({ ...f.targetPins, origin });
    assert.equal(classifyR70TargetPins(pins), 'LOCAL_TLS_ACCEPTANCE_FIXTURE');
  }
  assert.equal(classifyR70TargetPins(f.targetPins), 'DECLARED_VERCEL_ORIGIN_NOT_INDEPENDENTLY_BOUND');
  for (const origin of ['http://r70-fixture.vercel.app', 'https://localhost:12345', 'https://127.0.0.2:12345',
    'https://example.invalid', 'https://r70-fixture.vercel.app:444', 'https://r70-fixture.vercel.app/',
    'https://r70-fixture.vercel.app?x=1', 'https://user@r70-fixture.vercel.app', 'https://r70-fixture.vercel.app.'])
    denied(() => inspectR70TargetPins({ ...f.targetPins, origin }), 'R70_TARGET_ORIGIN');
  for (const origin of ['https://jenios.com.br', 'https://www.jenios.com.br.'])
    denied(() => inspectR70TargetPins({ ...f.targetPins, origin }), 'R70_TARGET_PRODUCTION_ORIGIN');
  assert.equal(r70TargetPinsDigest(f.targetPins), r70TargetPinsDigest(JSON.parse(canonicalR70Json(f.targetPins))));
});

test('R70 closed pins and signing options reject substitutions and accessors without evaluating them', () => {
  const f = createR70PreflightFixture(); let reads = 0;
  for (const change of [{ deploymentId: 'dpl_bad-id' }, { projectId: 'prj_' }, { commitSha: 'A'.repeat(40) },
    { sourceId: 'source:bad' }, { sourceKeySha256: '0'.repeat(63) }, { approved: true }])
    denied(() => inspectR70TargetPins({ ...f.targetPins, ...change }), 'R70_TARGET_PINS');
  denied(() => inspectR70TargetPins({ ...f.targetPins, get origin() { reads++; return f.targetPins.origin; } }), 'R70_TARGET_PINS');
  denied(() => createR70PreflightRequest({ targetPins: f.targetPins, trustedSource: f.trustedSource,
    privateKeyPem: f.privateKeyPem, get nonce() { reads++; return nonce; } }), 'R70_PREFLIGHT_SIGN_CONFIG');
  assert.equal(reads, 0);
});

test('R70 source identity and signature domain cannot be substituted with another key, source or signature', () => {
  const f = createR70PreflightFixture(), other = createR70PreflightFixture();
  denied(() => request(f, { privateKeyPem: other.privateKeyPem }), 'R70_PREFLIGHT_SIGNING_KEY_MISMATCH');
  denied(() => request(f, { targetPins: { ...f.targetPins, sourceKeySha256: '0'.repeat(64) } }), 'R70_PREFLIGHT_SOURCE_BINDING');
  const req = request(f), wrongDomain = { ...req, signatureBase64: sign(null,
    Buffer.from('JENIOS_R67_SIGNED_PRIVATE_QA_TELEMETRY_V1\0' + canonicalR70Json(req.payload)), f.privateKeyPem).toString('base64') };
  denied(() => verifyR70PreflightRequest(wrongDomain, { trustedSource: f.trustedSource, nowMs: NOW }), 'R70_PREFLIGHT_SIGNATURE');
  for (const field of ['deploymentId', 'projectId', 'commitSha', 'origin']) {
    const values = { deploymentId: 'dpl_other', projectId: 'prj_other', commitSha: '0'.repeat(40), origin: 'https://other.vercel.app' };
    const edited = structuredClone(req); edited.payload.targetPins[field] = values[field];
    denied(() => verifyR70PreflightRequest(edited, { trustedSource: f.trustedSource, nowMs: NOW }), 'R70_PREFLIGHT_SIGNATURE');
  }
});

test('R70 enforces fixed challenge lifetime and at most one second of future clock skew', () => {
  const f = createR70PreflightFixture(), req = request(f);
  verifyR70PreflightRequest(req, { trustedSource: f.trustedSource, nowMs: NOW - 1000 });
  verifyR70PreflightRequest(req, { trustedSource: f.trustedSource, nowMs: NOW + 14999 });
  denied(() => verifyR70PreflightRequest(req, { trustedSource: f.trustedSource, nowMs: NOW - 1001 }), 'R70_PREFLIGHT_REQUEST_TIME');
  denied(() => verifyR70PreflightRequest(req, { trustedSource: f.trustedSource, nowMs: NOW + 15000 }), 'R70_PREFLIGHT_REQUEST_TIME');
  const changed = structuredClone(req); changed.payload.expiresAtMs++;
  denied(() => verifyR70PreflightRequest(changed, { trustedSource: f.trustedSource, nowMs: NOW }), 'R70_PREFLIGHT_REQUEST');
  for (const nowMs of [-1, NaN, 1.5]) denied(() => request(f, { nowMs }), 'R70_PREFLIGHT_CLOCK');
});

test('R70 response is bound to nonce, signed request digest, every expected target pin and unchanged expiry', () => {
  const f = createR70PreflightFixture(), req = request(f), res = response(f, req);
  for (const change of [{ nonce: '0'.repeat(64) }, { requestDigest: '0'.repeat(64) },
    { expiresAtMs: res.expiresAtMs + 1 }, { targetPins: { ...f.targetPins, deploymentId: 'dpl_other' } }])
    denied(() => inspectR70PreflightResponse({ ...res, ...change }, { request: req, targetPins: f.targetPins, nowMs: NOW }), 'R70_PREFLIGHT_RESPONSE_BINDING');
  denied(() => createR70PreflightResponse(req, { targetPins: { ...f.targetPins, deploymentId: 'dpl_other' },
    trustedSource: f.trustedSource, nowMs: NOW }), 'R70_PREFLIGHT_TARGET_MISMATCH');
  for (const observedAtMs of [NOW - 1001, NOW + 1001, res.expiresAtMs, -1])
    denied(() => inspectR70PreflightResponse({ ...res, observedAtMs }, { request: req, targetPins: f.targetPins, nowMs: NOW }), 'R70_PREFLIGHT_RESPONSE_TIME');
});

test('R70 refuses capability escalation and raw observation or credential fields in the closed wire schemas', () => {
  const f = createR70PreflightFixture(), req = request(f), res = response(f, req);
  for (const extra of ['observation', 'provenance', 'scenarios', 'databaseKey', 'adminToken']) {
    denied(() => verifyR70PreflightRequest({ ...req, [extra]: 'forbidden' }, { trustedSource: f.trustedSource, nowMs: NOW }), 'R70_PREFLIGHT_REQUEST');
    denied(() => inspectR70PreflightResponse({ ...res, [extra]: 'forbidden' }, { request: req, targetPins: f.targetPins, nowMs: NOW }), 'R70_PREFLIGHT_RESPONSE');
  }
  for (const field of ['remoteQaDeploymentVerified', 'independentRuntimeAttestation', 'operationalReady'])
    denied(() => inspectR70PreflightResponse({ ...res, [field]: true }, { request: req, targetPins: f.targetPins, nowMs: NOW }), 'R70_PREFLIGHT_RESPONSE');
});

test('R70 repeats a valid read-only challenge without a mutation claim but rejects a response from another nonce', () => {
  const f = createR70PreflightFixture(), first = request(f), second = request(f, { nonce: '71'.repeat(32) });
  assert.deepEqual(response(f, first), response(f, first));
  denied(() => inspectR70PreflightResponse(response(f, first), { request: second, targetPins: f.targetPins, nowMs: NOW }), 'R70_PREFLIGHT_RESPONSE_BINDING');
  const bad = { ...first, signatureBase64: 'A'.repeat(86) + '==' };
  denied(() => verifyR70PreflightRequest(bad, { trustedSource: f.trustedSource, nowMs: NOW }), 'R70_PREFLIGHT_SIGNATURE');
  assert.notEqual(R70_CHALLENGE_DOMAIN, 'JENIOS_R67_SIGNED_PRIVATE_QA_TELEMETRY_V1\0');
});
