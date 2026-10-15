import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allowedSpecialistActions, specialistActionInput, visibleSpecialistOrder, prepareSpecialistOrder, listSpecialistOrders, updateSpecialistOrder, specialistOrdersEnabled } from '../lib/social/specialist-orders.mjs';

const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const row = { order_id: orderId, buyer_id: 'buyer', seller_id: 'seller', offer_id: 'offer', amount_cents: 1000, commission_cents: 100, seller_amount_cents: 900, state: 'pending', revision: 0, snapshot: { title: 'Oferta contratada', sellerName: 'Especialista', secret: 'hidden' }, history: [{ action: 'accept', role: 'seller', at: '2026-10-14T23:00:00Z', actorEmail: 'private@example.test' }] };

test('specialist feature must be explicitly enabled after installation', () => {
  assert.equal(specialistOrdersEnabled({}), false); assert.equal(specialistOrdersEnabled({ JENIOS_SPECIALIST_ORDERS_ENABLED: 'true' }), true);
});
test('seller actions follow lifecycle and payment, not browser claims', () => {
  assert.deepEqual(allowedSpecialistActions(row, 'seller', 'paid'), ['accept', 'decline']);
  assert.deepEqual(allowedSpecialistActions({ ...row, state: 'accepted' }, 'seller', 'paid'), ['schedule', 'deliver', 'decline']);
  assert.deepEqual(allowedSpecialistActions({ ...row, state: 'scheduled' }, 'seller', 'paid'), ['schedule', 'deliver']);
  assert.deepEqual(allowedSpecialistActions({ ...row, state: 'delivered' }, 'buyer', 'paid'), ['complete']);
  for (const status of ['pending', 'awaiting_payment', 'refunded', 'cancelled', 'expired', 'unknown']) assert.deepEqual(allowedSpecialistActions(row, 'seller', status), []);
  assert.deepEqual(allowedSpecialistActions(row, 'outsider', 'paid'), []);
});
test('delivered requires buyer confirmation; completed and declined are terminal', () => {
  assert.deepEqual(allowedSpecialistActions({ ...row, state: 'delivered' }, 'seller', 'paid'), []);
  for (const state of ['completed', 'declined']) for (const actor of ['buyer', 'seller']) assert.deepEqual(allowedSpecialistActions({ ...row, state }, actor, 'paid'), []);
});
test('output excludes party IDs, arbitrary snapshot fields and history contact data', () => {
  const visible = visibleSpecialistOrder(row, 'buyer', 'paid');
  assert.equal(visible.role, 'buyer'); assert.equal(visible.buyer_id, undefined); assert.equal(visible.seller_id, undefined); assert.equal(visible.commission_cents, undefined); assert.equal(visible.snapshot.secret, undefined); assert.equal(visible.history[0].actorEmail, undefined);
  assert.equal(visibleSpecialistOrder(row, 'seller', 'paid').commission_cents, 100);
  assert.throws(() => visibleSpecialistOrder(row, 'outsider', 'paid'), { status: 404 });
});
test('action validation rejects financial operations and malformed revisions', () => {
  for (const body of [null, {}, { orderId, revision: 0, action: 'refund' }, { orderId, revision: -1, action: 'accept' }, { orderId: 'fake', revision: 0, action: 'accept' }]) assert.throws(() => specialistActionInput(body), { status: 400 });
  assert.equal(specialistActionInput({ orderId, revision: 0, action: 'accept', status: 'paid', buyer_id: 'fake' }).status, undefined);
});
test('scheduling needs explicit future timezone and secure optional meeting URL', () => {
  const now = Date.parse('2026-10-15T00:00:00Z'), base = { orderId, revision: 0, action: 'schedule' };
  for (const scheduledAt of ['bad', '2026-10-15T00:00:00Z', '2028-01-01T00:00:00Z', '2026-10-16T12:00:00']) assert.throws(() => specialistActionInput({ ...base, scheduledAt }, now), { status: 400 });
  const scheduledAt = '2026-10-16T12:00:00-03:00';
  for (const meetingUrl of ['javascript:alert(1)', 'http://meeting.test', 'https://user:secret@meeting.test']) assert.throws(() => specialistActionInput({ ...base, scheduledAt, meetingUrl }, now), { status: 400 });
  assert.equal(specialistActionInput({ ...base, scheduledAt, meetingUrl: 'https://meeting.test/session' }, now).scheduledAt, '2026-10-16T15:00:00.000Z');
});
test('delivery and decline require useful bounded descriptions', () => {
  for (const action of ['deliver', 'decline']) {
    for (const deliveryNote of ['', 'short', 'x'.repeat(2001)]) assert.throws(() => specialistActionInput({ orderId, revision: 0, action, deliveryNote }), { status: 400 });
    assert.equal(specialistActionInput({ orderId, revision: 0, action, deliveryNote: '  Material disponibilizado ao cliente.  ' }).deliveryNote, 'Material disponibilizado ao cliente.');
  }
});
test('preparation is idempotent and refuses binding to other seller/price', async () => {
  const quote = { target: { specialistId: 'seller', offerId: 'offer' }, amount_cents: 1000, commission_cents: 100, seller_amount_cents: 900 };
  const args = { order: { id: orderId, user_id: 'buyer' }, quote, offer: { title: 'Changed title' }, sellerName: 'Changed name' };
  const db = { from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: row }; }, insert() { throw Error('Must not duplicate'); } }; } };
  assert.equal((await prepareSpecialistOrder({ ...args, db })).snapshot.title, 'Oferta contratada');
  await assert.rejects(prepareSpecialistOrder({ ...args, db, quote: { ...quote, amount_cents: 2000 } }), { status: 409 });
});
test('list uses participant filter and exposes only own rows', async () => {
  const filters = [];
  const db = { from(table) { const q = { select() { return q; }, eq(key, value) { filters.push([key, value]); return q; }, order() { return q; }, range() { return Promise.resolve({ data: [row] }); }, in() { return Promise.resolve({ data: [{ id: orderId, status: 'paid' }] }); } }; return q; } };
  const result = await listSpecialistOrders({ db, user: { id: 'seller' }, role: 'seller' });
  assert.deepEqual(filters, [['seller_id', 'seller']]); assert.equal(result.orders[0].role, 'seller'); assert.equal(result.nextPage, null);
  await assert.rejects(listSpecialistOrders({ db, user: { id: 'buyer' }, role: 'admin' }), { status: 400 });
});
test('RPC action derives actor from verified user, never submitted body', async () => {
  let sent;
  const db = { async rpc(name, body) { assert.equal(name, 'jenios_specialist_order_action'); sent = body; return { data: [{ ...row, state: 'accepted', revision: 1 }] }; } };
  const result = await updateSpecialistOrder({ db, user: { id: 'seller' }, body: { orderId, revision: 0, action: 'accept', actorId: 'buyer', status: 'paid' } });
  assert.equal(sent.p_actor_id, 'seller'); assert.equal(sent.status, undefined); assert.equal(result.revision, 1);
});
for (const [code, status] of [['P0002', 404], ['40001', 409], ['42501', 403], ['22023', 400]]) test('RPC maps expected error ' + code, async () => {
  await assert.rejects(updateSpecialistOrder({ db: { rpc: async () => ({ error: { code } }) }, user: { id: 'seller' }, body: { orderId, revision: 0, action: 'accept' } }), { status });
});
test('API authenticates and browser clears stale service data', () => {
  const api = readFileSync(new URL('../app/api/specialists/orders/route.js', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../app/especialistas/atendimentos/page.js', import.meta.url), 'utf8');
  assert.match(api, /requirePayUser/); assert.match(api, /specialistOrdersEnabled/); assert.match(ui, /epoch.current/); assert.match(ui, /onAuthStateChange/);
  assert.doesNotMatch(api, /\.from\('jenios_pay_orders'\)\.update/);
});
