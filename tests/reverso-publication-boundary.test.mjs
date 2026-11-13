import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReversoPublishedStateSource, createReversoPublishedSubscriptionSource, REVERSO_WEB_PUBLICATION_V1} from '../lib/platform/reverso/publication-boundary-v1.mjs';
import {createReversoStateHandler} from '../lib/platform/reverso/http.mjs';
import {createReversoSubscriptionHandlerV2} from '../lib/platform/reverso/subscription/http-v2.mjs';
import {emptyReversoState} from '../lib/platform/reverso/state-contract.mjs';
const subject = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const now = () => Date.parse('2026-11-13T12:00:00Z');
const flags = {REVERSO_RUNTIME_READ_ENABLED: 'true', REVERSO_SUBSCRIPTION_DEMO_ENABLED: 'true', ULTRA_RUNTIME_ORIGIN: 'https://synthetic-runtime.invalid', ULTRA_RUNTIME_SERVICE_KEY: 'x'.repeat(48)};
const request = (suffix = '') => new Request('https://jenios.test/api/platform/reverso/state' + suffix);
const subscriptionRequest = action => new Request('https://jenios.test/api/platform/reverso/subscription', {
  method: 'POST', headers: {Origin: 'https://jenios.test', 'Content-Type': 'application/json', 'X-Jenios-Reverso-Intent': 'subscription'},
  body: JSON.stringify({action, orderId: other}),
});

test('publication policy permits information while keeping all real financial capabilities false', () => {
  assert.equal(REVERSO_WEB_PUBLICATION_V1.webInformationPublished, true);
  for (const key of ['realFinancialSourceQualified', 'productiveSubscriptionEnabled', 'realBillingAllowed', 'realDebitAuthorized', 'actualExecutionAuthorized']) assert.equal(REVERSO_WEB_PUBLICATION_V1[key], false);
  assert.ok(Object.isFrozen(REVERSO_WEB_PUBLICATION_V1));
});
for (const environment of [{VERCEL: '1'}, {VERCEL_ENV: 'production'}, {VERCEL_ENV: 'preview'}, {VERCEL_ENV: 'development'}]) {
  test('hosted boundary never forwards requests: ' + JSON.stringify(environment), async () => {
    let calls = 0;
    const options = {env: {...flags, ...environment}, fetchImpl: async () => {calls++; throw Error('unexpected external request');}};
    const state = createReversoPublishedStateSource(options), subscription = createReversoPublishedSubscriptionSource(options);
    const results = await Promise.all(Array.from({length: 8}, () => Promise.all([state({subject}), subscription({subject, input: {action: 'cancel', orderId: other}})])));
    assert.ok(results.flat().every(value => value === null)); assert.equal(calls, 0);
  });
}
test('hosted client retains dedicated auth and unavailable data, never false zero or access', async () => {
  const readState = createReversoPublishedStateSource({env: {...flags, VERCEL: '1'}});
  const handler = createReversoStateHandler({getUser: async () => ({id: subject}), readState, now});
  const response = await handler(request()), state = await response.json();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.ok(Object.values(state.sections).every(s => s.status === 'unavailable' && s.data === null));
  assert.ok(Object.values(state.capabilities).every(value => value === false));
  assert.deepEqual(state.offers.map(o => [o.priceMinor, o.months]), [[1990, 1], [19900, 12]]);
  assert.equal((await handler(request('?subject=' + other))).status, 400);
  assert.equal((await createReversoStateHandler({getUser: async () => null, readState, now})(request())).status, 401);
});
test('hosted Admin retains original grant, selected owner and post-read authorization recheck', async () => {
  const readState = createReversoPublishedStateSource({env: {...flags, VERCEL: '1'}}); let checks = 0;
  const create = requireAdmin => createReversoStateHandler({admin: true, getUser: async () => ({id: subject}), requireAdmin, readState, now});
  const allowed = create(async () => ({user: {id: subject}, permissions: ['platform.admin']}));
  const response = await allowed(request('?subject=' + other));
  assert.equal(response.status, 200); assert.equal((await response.json()).owner.subject, other);
  const revoked = create(async () => ({user: {id: subject}, permissions: ++checks === 1 ? ['platform.admin'] : []}));
  assert.equal((await revoked(request('?subject=' + other))).status, 403); assert.equal(checks, 2);
});
test('hosted repeated and concurrent subscription mutations remain unavailable without transport calls', async () => {
  let calls = 0;
  const source = createReversoPublishedSubscriptionSource({env: {...flags, VERCEL: '1'}, fetchImpl: async () => {calls++; throw Error('unexpected transport');}});
  const handler = createReversoSubscriptionHandlerV2({getUser: async () => ({id: subject}), source, now});
  const responses = await Promise.all(['cancel', 'cancel', 'refresh', 'void_unsent'].map(action => handler(subscriptionRequest(action))));
  for (const response of responses) {
    assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const value = await response.json(); assert.equal(value.error, 'REVERSO_SUBSCRIPTION_UNAVAILABLE');
    assert.equal(value.uncertain, true); // Preserve the existing conservative recovery contract.
  }
  const status = await handler(new Request('https://jenios.test/api/platform/reverso/subscription'));
  assert.deepEqual(await status.json(), {error: 'REVERSO_SUBSCRIPTION_UNAVAILABLE', uncertain: false});
  assert.equal(calls, 0);
});
test('hosted subscription detects session changes before responding even with no financial source', async () => {
  let checks = 0;
  const handler = createReversoSubscriptionHandlerV2({getUser: async () => ({id: ++checks < 3 ? subject : other}),
    source: createReversoPublishedSubscriptionSource({env: {VERCEL: '1'}}), now});
  assert.equal((await handler(subscriptionRequest('cancel'))).status, 409);
});
test('local isolated laboratory retains nonce-bound original state transport and disabled default', async () => {
  let calls = 0;
  const fetchImpl = async (_url, options) => {
    calls++; const body = JSON.parse(options.body);
    return Response.json({nonce: body.nonce, state: emptyReversoState({subject, now: now()})});
  };
  const source = createReversoPublishedStateSource({env: flags, fetchImpl, now});
  assert.equal((await source({subject})).owner.subject, subject); assert.equal(calls, 1);
  assert.equal(await createReversoPublishedStateSource({fetchImpl})({subject}), null);
  assert.equal(await createReversoPublishedSubscriptionSource({fetchImpl})({subject, input: {action: 'status'}}), null);
  assert.equal(calls, 1);
});
test('all hosted Reverso entry points compose the publication boundary', () => {
  for (const [path, factory] of [
    ['app/api/platform/reverso/state/route.js', 'createReversoPublishedStateSource'],
    ['app/api/platform/admin/robots/reverso/route.js', 'createReversoPublishedStateSource'],
    ['app/api/platform/reverso/subscription/route.js', 'createReversoPublishedSubscriptionSource'],
  ]) {
    const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    assert.ok(source.includes('publication-boundary-v1.mjs')); assert.ok(source.includes(factory + '({'));
    assert.doesNotMatch(source, /from ['"].*runtime-source/);
  }
});
