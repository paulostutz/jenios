import test from 'node:test';
import assert from 'node:assert/strict';
import { requirePaidPurchase } from '../lib/pay/access.mjs';
import { purchaseQuote, purchaseFingerprint } from '../lib/pay/purchase.mjs';
import { DEFAULT_PRODUCTS } from '../lib/pay/catalog.mjs';
import { saveReceipt, readReceipt } from '../lib/pay/browser-receipts.mjs';
import { createGatewayCheckout } from '../lib/pay/gateway.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const product = { ...DEFAULT_PRODUCTS[0], id: 'product' };
const target = { codigo: '123', periodo: '202606' };
const quote = purchaseQuote({ target }, product, 'social');
const reference = JSON.stringify({ fingerprint: purchaseFingerprint(quote), productCode: product.code, scope: 'social' });
function fixture(changes = {}, changedProduct = {}) {
  const order = { id, user_id: 'owner', product_id: product.id, status: 'paid', amount_cents: 990, currency: 'BRL', external_reference: reference, ...changes };
  const db = { from(table) { const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: table === 'jenios_pay_orders' ? order : { ...product, ...changedProduct }, error: null }; } }; return query; } };
  return { db, user: { id: 'owner' }, orderId: id, productCode: product.code, target };
}
test('paid purchase authorizes only its exact resource despite later price/deactivation', async () => {
  assert.equal((await requirePaidPurchase(fixture({}, { price_cents: 1500, active: false }))).authorized, true);
});
for (const status of ['pending', 'awaiting_payment', 'cancelled', 'expired', 'refunded']) test('rejects payment status ' + status, async () => {
  await assert.rejects(requirePaidPurchase(fixture({ status })), { status: 403 });
});
test('rejects other account even if database query is misconfigured', async () => {
  await assert.rejects(requirePaidPurchase(fixture({ user_id: 'other' })), { status: 404 });
});
test('rejects another institution or reporting period', async () => {
  for (const other of [{ codigo: '124', periodo: '202606' }, { codigo: '123', periodo: '202603' }]) await assert.rejects(requirePaidPurchase({ ...fixture(), target: other }), { status: 403 });
});
test('rejects corrupt reference, missing fingerprint, wrong product and platform order', async () => {
  for (const external_reference of ['{', 'null', '{}', JSON.stringify({ ...JSON.parse(reference), productCode: 'other' }), JSON.stringify({ ...JSON.parse(reference), scope: 'platform' })]) await assert.rejects(requirePaidPurchase(fixture({ external_reference })), { status: 409 });
});
test('rejects invalid UUID before querying', async () => {
  await assert.rejects(requirePaidPurchase({ ...fixture(), orderId: 'fake-paid' }), { status: 400 });
});
test('receipt storage is session/account scoped and never grants authority', () => {
  const data = new Map(); const storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  assert.equal(saveReceipt(storage, 'owner', id, { productCode: product.code, target }), true);
  assert.deepEqual(readReceipt(storage, 'owner', id), { productCode: product.code, target });
  assert.equal(readReceipt(storage, 'other', id), null);
  assert.equal(saveReceipt({ getItem() { throw Error(); } }, 'owner', id, {}), false);
});
for (const [code, selected] of [
  ['social-crypto-validator', { network: 'ethereum', type: 'wallet', identifier: '0x1234567890123456789012345678901234567890' }],
  ['social-boost', { postId: id, dailyBudget: '10', days: 3, objective: 'profile', country: 'Brasil', region: '', city: '' }],
  ['social-specialist-offer', { specialistId: id, offerId: '22222222-2222-4222-8222-222222222222' }],
]) test('canonical purchase binding for ' + code, async () => {
  const base=DEFAULT_PRODUCTS.find(item=>item.code===code);
  assert.ok(base,'The original paid product must remain in the catalog');
  const item = { ...base, id: 'product', price_cents: code === 'social-specialist-offer' ? 15000 : base.price_cents };
  const quoted = purchaseQuote({ target: selected }, item, 'social');
  const args = fixture({ amount_cents: quoted.amount_cents, external_reference: JSON.stringify({ fingerprint: purchaseFingerprint(quoted), productCode: item.code, scope: 'social' }) }, item);
  assert.equal((await requirePaidPurchase({ ...args, productCode: item.code, target: selected })).authorized, true);
});
test('return URL comes from server config and keeps Platform separate', async () => {
  for (const scope of ['social', 'platform']) {
    let sent;
    await createGatewayCheckout({ orderId: id, amount_cents: 990, scope, returnUrl: 'https://evil.test' }, {
      env: { JENIOS_PAY_CHECKOUT_URL: 'https://pay.test/checkout', JENIOS_PAY_API_TOKEN: 'test', JENIOS_APP_ORIGIN: 'https://social.test' },
      fetchImpl: async (_url, options) => { sent = JSON.parse(options.body); return { ok: true, json: async () => ({ orderId: id, amount_cents: 990, currency: 'BRL', checkoutUrl: 'https://pay.test/order' }) }; },
    });
    assert.equal(sent.returnUrl, 'https://social.test' + (scope === 'platform' ? '/checkout' : '/social/cobrancas'));
  }
});
