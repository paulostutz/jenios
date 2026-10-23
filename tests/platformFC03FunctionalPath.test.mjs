import test from 'node:test';
import assert from 'node:assert/strict';
import { readDemoBroker } from '../lib/platform/connections/demo-broker-reader.mjs';
import { digestDemoAccount } from '../lib/platform/connections/demo-vault.mjs';
import { nativeCustomerBinding, strategyToNativePaperProposal, submitNativeBrokerOrder, submitRealBrokerOrder } from '../lib/platform/connections/native-broker-bridge.mjs';
import { lookupOwnAlpacaPaperOrder } from '../lib/platform/connections/alpaca-native-paper-order-lookup.mjs';
import { orderRisk } from '../lib/platform/pilot-prep/risk.mjs';
import { CORE_SHA } from '../lib/platform/pilot-prep/contracts.mjs';
import { createR49OrderBook, submitR49Order, applyR49Fill, reconcileR49Order, authorizeR49NextOrder } from '../lib/platform/research/robot-r49-order-reconciliation-races.mjs';

// Every upstream response and credential is a local fixture. No private engine is injected.
const owner = '4d238a7a-8c7b-4d8e-9a10-1c5c82db59a7', other = 'b8e32748-9c47-4eb1-9c5f-1a7cc0d2e496';
const now = Date.parse('2026-10-23T12:00:00Z');
const env = { VERCEL_ENV: 'preview', JENIOS_DEMO_CONNECTORS_ENABLED: 'true', JENIOS_DEMO_VAULT_KEY_B64: Buffer.alloc(32, 8).toString('base64') };
const credentials = { apiKey: 'fixture_api_key_1234567890', secret: 'fixture_secret_1234567890' };
const order = { clientOrderId: 'fc03-fixture-order', symbol: 'AAPL', side: 'buy', quantity: '2', entry: '100', stop: '98', target: '104' };
const connection = { id: '50b85e9d-339c-4d32-b2bf-82c467673832', user_id: owner, provider: 'alpaca', environment: 'paper', status: 'active', external_digest: digestDemoAccount('account-FC03', { userId: owner, provider: 'alpaca', environment: 'paper' }, env), last_sync_at: new Date(now).toISOString() };
function fixtureTransport({ lookup = 'partial', account = 'FC03' } = {}) {
  const requests = [];
  const fetcher = async (url, options) => {
    const u = new URL(url);
    assert.equal(u.origin, 'https://paper-api.alpaca.markets');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    requests.push(u.pathname);
    if (u.pathname === '/v2/account') return Response.json({ id: account, status: 'ACTIVE', trading_blocked: false, cash: '1000', equity: '1000' });
    if (u.pathname === '/v2/positions' || u.pathname === '/v2/orders') return Response.json([]);
    assert.equal(u.pathname, '/v2/orders:by_client_order_id');
    assert.equal(u.searchParams.get('client_order_id'), order.clientOrderId);
    if (lookup === 'missing') return new Response('', { status: 404 });
    if (lookup === 'timeout') throw Error('fixture timeout');
    return Response.json({ id: 'fc03-provider-fixture', client_order_id: order.clientOrderId, symbol: order.symbol, qty: '2', filled_qty: '0.5', status: 'partially_filled' });
  };
  return { requests, fetcher };
}
const query = (storedConnection = connection, verifiedUserId = owner) => ({ verifiedUserId, storedConnection, credentials, clientOrderId: order.clientOrderId, symbol: order.symbol });

test('FC03 fixture journey connects account reader, binding, proposal, risk and reconciliation without submission', async () => {
  const trace = [], transport = fixtureTransport();
  const account = await readDemoBroker({ provider: 'alpaca', environment: 'paper', ...credentials }, { fetcher: transport.fetcher, now: () => now });
  trace.push({ event: 'account_read', source: 'LOCAL_FIXTURE', complete: account.snapshot.complete });
  const binding = nativeCustomerBinding(owner, { ...connection, external_digest: digestDemoAccount(account.accountRef, { userId: owner, provider: 'alpaca', environment: 'paper' }, env) });
  assert.equal(binding.orderSubmissionEnabled, false);
  trace.push({ event: 'customer_bound', orderSubmissionEnabled: false });
  for (const mode of ['direct', 'hybrid', 'reverse']) {
    const proposal = strategyToNativePaperProposal({ binding, userId: owner, mode,
      signal: { originalCoreSha256: CORE_SHA.engine, executionEnabled: false, mode, side: 'buy', contextDigest: 'a'.repeat(64), reviewStatus: 'allow' },
      order, source: { provider: 'alpaca', environment: 'paper', accountAuthenticated: true, ownershipVerified: true, permissionsVerified: true, marketDataVerified: true, prospective: true, liveAccount: false } });
    assert.equal(proposal.canSubmit, false);
    assert.equal(proposal.brokerRequestSent, false);
    const { symbol, ...riskOrder } = order;
    const risk = orderRisk({ ...riskOrder, mode }, { provider: 'alpaca', id: symbol, marketType: 'spot', base: 'AAPL', quote: 'USD', settlement: 'USD', contractSize: '1', qtyStep: '1', minQty: '1', maxQty: '100', tickSize: '0.01', capturedAtMs: now, sourceSha256: 'b'.repeat(64), quantityUnit: 'base' }, { now, roundTripFeeBps: 20, slippageBps: 10 });
    assert.equal(risk.risk, '4.6');
    assert.equal(risk.notionalUnits, '20000000000');
    trace.push({ event: 'proposal_and_risk', mode, hypotheticalRisk: risk.risk, canSubmit: proposal.canSubmit, genuineCoreDecision: false });
  }
  const observed = await lookupOwnAlpacaPaperOrder(query(), { env, fetcher: transport.fetcher, now: () => now });
  assert.equal(observed.state, 'PARTIAL');
  assert.equal(observed.event.cumulativeQuantity, '0.5');
  assert.equal(observed.automaticResubmissionAllowed, false);
  trace.push({ event: 'fixture_partial_observed', cumulativeQuantity: observed.event.cumulativeQuantity });
  const book = createR49OrderBook();
  submitR49Order(book, { orderId: order.clientOrderId, qty: 2, createdAtMs: now - 100 });
  applyR49Fill(book, { eventId: observed.event.id, orderId: order.clientOrderId, fillQty: 0.5, executionAtMs: now - 1, receivedAtMs: now });
  assert.equal(reconcileR49Order(book, { orderId: order.clientOrderId, brokerFilledQty: Number(observed.event.cumulativeQuantity), brokerStatus: 'PARTIALLY_FILLED' }).match, true);
  assert.equal(reconcileR49Order(book, { orderId: order.clientOrderId, brokerFilledQty: 0.75, brokerStatus: 'PARTIALLY_FILLED' }).match, false);
  assert.equal(authorizeR49NextOrder(book).allow, false);
  trace.push({ event: 'mismatch_blocks_next_order', nextOrderAllowed: false });
  assert.throws(() => submitNativeBrokerOrder(), /NATIVE_ORDER_TRANSPORT_NOT_CERTIFIED/);
  assert.throws(() => submitRealBrokerOrder(), /LIVE_EXECUTION_NOT_AUTHORIZED/);
  assert.equal(transport.requests.length, 7);
  console.log('FC03_FIXTURE_TRACE ' + JSON.stringify({ source: 'LOCAL_FIXTURE_ONLY', trace, fixtureGetCount: 7, externalRequests: 0, privateEngineLoaded: false, realOrdersSent: 0, externalPaperOrdersSent: 0 }));
});
test('FC03 cross-customer, revoked and live connections stop before the injected transport is reached', async () => {
  for (const q of [query(connection, other), query({ ...connection, revoked: true }), query({ ...connection, environment: 'live' })]) {
    const transport = fixtureTransport();
    await assert.rejects(lookupOwnAlpacaPaperOrder(q, { env, fetcher: transport.fetcher, now: () => now }), /BROKER_OWNER_MISMATCH|BROKER_CONNECTION_INACTIVE|BROKER_NATIVE_ADAPTER_NOT_HOMOLOGATED/);
    assert.equal(transport.requests.length, 0);
  }
});
test('FC03 changed account identity prevents order lookup even when credentials return a valid fixture account', async () => {
  const transport = fixtureTransport({ account: 'OTHER-FIXTURE' });
  await assert.rejects(lookupOwnAlpacaPaperOrder(query(), { env, fetcher: transport.fetcher, now: () => now }), /BROKER_ACCOUNT_CHANGED/);
  assert.equal(transport.requests.length, 3);
  assert.equal(transport.requests.includes('/v2/orders:by_client_order_id'), false);
});
test('FC03 missing or timed-out lookup never grants automatic resubmission', async () => {
  const transport = fixtureTransport({ lookup: 'missing' });
  const missing = await lookupOwnAlpacaPaperOrder(query(), { env, fetcher: transport.fetcher, now: () => now });
  assert.equal(missing.state, 'UNKNOWN');
  assert.equal(missing.manualReview, true);
  assert.equal(missing.automaticResubmissionAllowed, false);
  const timed = fixtureTransport({ lookup: 'timeout' });
  await assert.rejects(lookupOwnAlpacaPaperOrder(query(), { env, fetcher: timed.fetcher, now: () => now }), /BROKER_NETWORK_UNKNOWN/);
  assert.equal(timed.requests.filter(x => x === '/v2/orders:by_client_order_id').length, 1);
});
