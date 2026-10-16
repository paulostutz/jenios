import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { detailedCryptoReport } from '../lib/crypto/detailed.mjs';
import { deliverCryptoReport } from '../lib/pay/crypto-delivery.mjs';
import { purchaseQuote, purchaseFingerprint } from '../lib/pay/purchase.mjs';
import { DEFAULT_PRODUCTS } from '../lib/pay/catalog.mjs';
import { publicOrder } from '../lib/pay/orders.mjs';
import { createCryptoReportPdf } from '../lib/crypto/report-pdf.mjs';

const orderId = '11111111-1111-4111-8111-111111111111';
const target = { network: 'ethereum', type: 'wallet', identifier: '0x' + '1'.repeat(40) };
const product = { ...DEFAULT_PRODUCTS[1], id: 'product' };
const quote = purchaseQuote({ target }, product, 'social');
const external_reference = JSON.stringify({ productCode: product.code, scope: 'social', fingerprint: purchaseFingerprint(quote) });
function fixture(changes = {}) {
  const order = { id: orderId, user_id: 'buyer', product_id: product.id, status: 'paid', currency: 'BRL', amount_cents: 990, external_reference, ...changes };
  const db = { from(table) { const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { return { data: table === 'jenios_pay_orders' ? order : product, error: null }; } }; return q; } };
  return { db, user: { id: 'buyer' }, orderId, target };
}
const observed = { ...target, networkLabel: 'Ethereum', supported: true, found: true, status: 'atividade ou saldo observado', checkedAt: '2026-10-14T23:00:00Z', evidence: { saldoWei: '10' } };

test('paid delivery queries source only after owner, payment and target authorization', async () => {
  let calls = 0;
  const validate = async input => { calls++; assert.deepEqual(input, target); return observed; };
  const result = await deliverCryptoReport({ ...fixture(), validate });
  assert.equal(calls, 1); assert.equal(result.detail.orderId, orderId);
  assert.ok(result.detail.findings.some(f => f.code === 'wallet-inventory'));
  for (const args of [fixture({ user_id: 'other' }), fixture({ status: 'refunded' }), fixture({ status: 'pending' }), { ...fixture(), target: { ...target, identifier: '0x' + '2'.repeat(40) } }]) {
    await assert.rejects(deliverCryptoReport({ ...args, validate }));
    assert.equal(calls, 1);
  }
});
test('source failure does not produce a paid report; same order can be retried', async () => {
  await assert.rejects(deliverCryptoReport({ ...fixture(), validate: async () => ({ ...observed, providerError: 'offline' }) }), { status: 503 });
  const next = await deliverCryptoReport({ ...fixture(), validate: async () => observed });
  assert.equal(next.detail.orderId, orderId);
});
test('inventory is never queried before payment/resource checks or after a failed primary source', async () => {
  let calls=0;const inventory=async()=>{calls++;return {available:true,complete:true,tokens:[],warnings:[],scope:'QA'};};
  await assert.rejects(deliverCryptoReport({...fixture({status:'pending'}),validate:async()=>observed,inventory}),{status:403});
  await assert.rejects(deliverCryptoReport({...fixture(),validate:async()=>({...observed,providerError:'offline'}),inventory}),{status:503});
  assert.equal(calls,0);
  const result=await deliverCryptoReport({...fixture(),validate:async()=>observed,inventory});
  assert.equal(calls,1);assert.equal(result.inventory.complete,true);
});
test('refuses mismatched source identity and unsupported network', async () => {
  await assert.rejects(deliverCryptoReport({ ...fixture(), validate: async () => ({ ...observed, network: 'base' }) }), { status: 502 });
  assert.throws(() => detailedCryptoReport({ ...observed, supported: false }, orderId), { status: 503 });
});
test('negative observation is not called fraud or positive identity', () => {
  const report = detailedCryptoReport({ ...observed, found: false }, orderId);
  assert.equal(report.detail.findings.find(f => f.code === 'no-evidence').level, 'attention');
  assert.ok(report.detail.findings.find(f => f.code === 'no-evidence').explanation.includes('não prova fraude'));
});
test('failed transaction cannot be described as confirmed settlement', () => {
  const report = detailedCryptoReport({ ...observed, type: 'transaction', status: 'falhou on-chain' }, orderId);
  assert.ok(report.detail.findings.some(f => f.code === 'execution-failed'));
  assert.ok(!report.detail.findings.some(f => f.code === 'confirmed'));
});
test('TRON found does not imply finality', () => {
  const report = detailedCryptoReport({ ...observed, network: 'tron', type: 'transaction', status: 'encontrado on-chain', evidence: { resultadoExecucao: 'SUCCESS' } }, orderId);
  assert.ok(report.detail.findings.some(f => f.code === 'finality-unknown'));
});
for (const [status, level] of [['issuer_address_match', 'observed'], ['issuer_address_match_chain_unconfirmed', 'inconclusive'], ['not_in_reference_registry', 'inconclusive'], ['symbol_address_mismatch', 'attention']]) test('token detail preserves identity uncertainty: ' + status, () => {
  const report = detailedCryptoReport({ ...observed, type: 'token', authenticity: { status, label: 'Resultado de referência' } }, orderId);
  assert.equal(report.detail.findings.find(f => f.code === 'token-reference').level, level);
});
test('order listing only reveals safe product labels, never target, reference or tokens', () => {
  const result = publicOrder({ id: orderId, external_reference: JSON.stringify({ productCode: product.code, target, fingerprint: 'secret' }), user_id: 'buyer', access_token: 'secret' });
  assert.equal(result.productCode, product.code);
  assert.equal(result.external_reference, undefined); assert.equal(result.target, undefined); assert.equal(result.user_id, undefined);
  assert.ok(!JSON.stringify(result).includes('secret'));
  for (const ref of ['null', '{', '{"productCode":"invented"}']) assert.equal(publicOrder({ external_reference: ref }).productCode, null);
});
test('paid PDF includes paginated detailed interpretation', async () => {
  const report = detailedCryptoReport(observed, orderId);
  const bytes = await createCryptoReportPdf(report);
  assert.ok(bytes.length > 2000);
  assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 2);
});
test('UI reaches paid route and never accepts a paid browser query parameter', () => {
  const page = readFileSync(new URL('../app/components/PaidCryptoReport.js', import.meta.url), 'utf8');
  assert.match(page, /\/api\/crypto-validator\/detailed/); assert.match(page, /authorization:/);
  assert.doesNotMatch(page, /search\.get\(['"](?:paid|status)['"]\)/);
  assert.match(page, /version !== epoch.current/);
});
