import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boostDestination, validateBoostTarget, audienceInput, visibleBoostCampaign, prepareBoostCampaign, boostAction, boostEnabled } from '../lib/social/boost.mjs';
import { signBoostDelivery, verifyBoostDelivery } from '../lib/social/boost-proof.mjs';
import { serveBoost, recordBoostEvent } from '../lib/social/boost-serving.mjs';
import { normalizePurchase, DEFAULT_PRODUCTS } from '../lib/pay/catalog.mjs';
const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', postId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const owner = '11111111-1111-4111-8111-111111111111', viewer = '22222222-2222-4222-8222-222222222222';
const target = { postId, dailyCents: 1000, days: 3, objective: 'profile', country: 'Brasil', region: 'Bahia', city: '' };
const campaign = { order_id: orderId, owner_id: owner, post_id: postId, target, amount_cents: 3000, state: 'pending', revision: 0 };
const env = { JENIOS_BOOST_SIGNING_SECRET: 'test-secret-only-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }, now = Date.parse('2026-10-15T00:00:00Z');
test('campaigns are disabled until explicitly installed and enabled', () => { assert.equal(boostEnabled({}), false); assert.equal(boostEnabled({ JENIOS_BOOST_CAMPAIGNS_ENABLED: 'true' }), true); });
test('destinations reject unsafe schemes and credentials', () => {
  for (const value of ['javascript:alert(1)', 'http://example.test', 'https://a:b@example.test', 'not a URL']) assert.throws(() => boostDestination(value, 'website'), { status: 400 });
  assert.equal(boostDestination('https://example.test', 'website'), 'https://example.test/');
});
test('WhatsApp destination requires wa.me and full international phone', () => {
  for (const value of ['https://evil.test/5573999999999', 'https://wa.me/not-a-phone', 'https://wa.me/123', 'https://wa.me/5573999999999#bad']) assert.throws(() => boostDestination(value, 'whatsapp'), { status: 400 });
  assert.equal(boostDestination('https://wa.me/5573999999999', 'whatsapp'), 'https://wa.me/5573999999999');
});
test('activated non-profile objectives require a real destination', () => {
  for (const objective of ['website', 'whatsapp', 'copy']) assert.throws(() => validateBoostTarget({ ...target, objective }), { status: 400 });
  assert.equal(validateBoostTarget(target).dailyCents, 1000);
});
test('audience is explicit and bounded; no inferred location', () => {
  for (const body of [{}, { country: '' }, { country: 123 }, { country: 'x'.repeat(81) }]) assert.throws(() => audienceInput(body), { status: 400 });
  assert.deepEqual(audienceInput({ country: ' Brasil ', region: '', city: '' }), { country: 'Brasil', region: '', city: '' });
});
test('quote recalculates variable total and binds a safe destination', () => {
  const quote = normalizePurchase({ target: { ...target, dailyBudget: '17,25', days: 7, objective: 'website', destination: 'https://example.test' }, amount_cents: 1 }, DEFAULT_PRODUCTS[2], 'social');
  assert.equal(quote.amount_cents, 12075); assert.equal(quote.target.destination, 'https://example.test/');
});
test('campaign preparation is idempotent across PostgreSQL JSON key ordering', async () => {
  const existing = { ...campaign, target: Object.fromEntries(Object.entries(target).reverse()) };
  const db = { from() { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: existing }), insert() { throw Error('No duplicate'); } }; } };
  const args = { db, order: { id: orderId, user_id: owner }, quote: { target, amount_cents: 3000 } };
  assert.equal((await prepareBoostCampaign(args)).order_id, orderId);
  await assert.rejects(prepareBoostCampaign({ ...args, quote: { target: { ...target, days: 4 }, amount_cents: 4000 } }), { status: 409 });
});
test('campaign actions reflect payment and deadline, not browser paid flags', () => {
  assert.deepEqual(visibleBoostCampaign(campaign, owner, 'paid').actions, ['start', 'cancel']);
  assert.deepEqual(visibleBoostCampaign(campaign, owner, 'awaiting_payment').actions, []);
  const ended = visibleBoostCampaign({ ...campaign, state: 'active', ends_at: '2026-10-14T00:00:00Z' }, owner, 'paid', {}, now);
  assert.equal(ended.state, 'ended'); assert.deepEqual(ended.actions, []);
  assert.throws(() => visibleBoostCampaign(campaign, viewer, 'paid'), { status: 404 });
});
test('delivery proof binds campaign, account, revision and expiry', () => {
  const token = signBoostDelivery(campaign, viewer, { env, now });
  assert.equal(verifyBoostDelivery(token, viewer, { env, now: now + 1 }).orderId, orderId);
  assert.throws(() => verifyBoostDelivery(token, owner, { env, now }), { status: 403 });
  assert.throws(() => verifyBoostDelivery(token, viewer, { env, now: now + 600000 }), { status: 403 });
  assert.throws(() => verifyBoostDelivery(token, viewer, { env: { JENIOS_BOOST_SIGNING_SECRET: 'a'.repeat(40) }, now }), { status: 403 });
});
test('tampered or malformed delivery proofs do not authorize metrics', () => {
  const token = signBoostDelivery(campaign, viewer, { env, now });
  for (const value of [null, '', 'fake', token + 'x', token.replace(/^./, token[0] === 'a' ? 'b' : 'a'), 'x'.repeat(3000)]) assert.throws(() => verifyBoostDelivery(value, viewer, { env, now }), { status: 403 });
  assert.throws(() => signBoostDelivery(campaign, viewer, { env: {}, now }), { status: 503 });
});
test('serving reads post through viewer RLS and returns no financial/private metadata', async () => {
  const db = { rpc: async () => ({ data: [campaign] }) };
  const viewerDb = { from(table) { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: table === 'posts' ? { id: postId, author_id: owner, body: 'Patrocinado', media_path: null } : { display_name: 'Anunciante', handle: '@anunciante' } }; } }; } };
  const result = await serveBoost({ db, viewerDb, user: { id: viewer }, body: { country: 'Brasil' }, env, now });
  assert.equal(result.ad.destination, '/social/perfil/' + owner); assert.equal(result.ad.post.body, 'Patrocinado'); assert.equal(result.ad.amount_cents, undefined); assert.equal(result.ad.target, undefined);
  assert.equal(verifyBoostDelivery(result.ad.proof, viewer, { env, now }).revision, 0);
});
test('RLS-hidden post is never served even when privileged candidate lookup returns it', async () => {
  const result = await serveBoost({ db: { rpc: async () => ({ data: [campaign] }) }, viewerDb: { from() { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null }) }; } }, user: { id: viewer }, body: { country: 'Brasil' }, env, now });
  assert.equal(result.ad, null);
});
test('event derives account and campaign from verified token, not client fields', async () => {
  let sent;
  const db = { rpc: async (_name, body) => { sent = body; return { data: true }; } };
  const proof = signBoostDelivery(campaign, viewer, { env, now });
  assert.equal((await recordBoostEvent({ db, user: { id: viewer }, body: { proof, kind: 'click', viewerId: owner, orderId: 'fake' }, env, now })).recorded, true);
  assert.equal(sent.p_viewer_id, viewer); assert.equal(sent.p_order_id, orderId);
  await assert.rejects(recordBoostEvent({ db, user: { id: viewer }, body: { proof, kind: 'refund' }, env, now }), { status: 400 });
});
test('owner action derives actor from session and maps concurrency errors', async () => {
  let sent; const args = { user: { id: owner }, body: { orderId, revision: 0, action: 'start', ownerId: viewer } };
  await boostAction({ ...args, db: { rpc: async (_name, body) => { sent = body; return { data: [] }; } } });
  assert.equal(sent.p_actor_id, owner);
  for (const [code, status] of [['P0002', 404], ['40001', 409], ['42501', 403]]) await assert.rejects(boostAction({ ...args, db: { rpc: async () => ({ error: { code } }) } }), { status });
});
test('ad renderer labels sponsorship and metrics are optional, not a financial counter', () => {
  const source = readFileSync(new URL('../app/components/PromotedPost.js', import.meta.url), 'utf8');
  assert.match(source, /Patrocinado/); assert.match(source, /IntersectionObserver/); assert.match(source, /NEXT_PUBLIC_SOCIAL_PROMOTIONS_ENABLED/); assert.match(source, /onAuthStateChange/);
  assert.doesNotMatch(source, /service_role|JENIOS_BOOST_SIGNING_SECRET/);
});
