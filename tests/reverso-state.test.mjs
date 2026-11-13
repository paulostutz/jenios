import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyReversoState, validateReversoState, available, confirmedReversoObligation } from '../lib/platform/reverso/state-contract.mjs';
import { createReversoStateHandler } from '../lib/platform/reverso/http.mjs';
import { createReversoRuntimeSource, createReversoRuntimeStateService } from '../lib/platform/reverso/runtime-source.mjs';
import { createReversoOwnerStateReader } from '../lib/platform/reverso/state-reader.mjs';
const subject = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const NOW = Date.parse('2026-11-12T22:00:00Z'), stamp = new Date(NOW).toISOString();
const section = (data, mode = 'demo') => available(data, { mode, observedAt: stamp });
const empty = () => emptyReversoState({ subject, now: NOW });
const valid = raw => validateReversoState(raw, { subject, now: NOW });
const clone = structuredClone;
const entitlement = { robotId: 'reverso', planId: 'platform-reverso-monthly', planName: 'Reverso mensal', status: 'active',
  paymentStatus: 'confirmed', accessGranted: true, accessObserved: true, performanceRate: 20,
  amountCents: 1990, currency: 'BRL', interval: 'month',
  periodStart: '2026-11-01T12:00:00Z', periodEnd: '2026-12-01T12:00:00Z', reason: null, sourceValidUntil: new Date(NOW + 30000).toISOString() };
const operation = { id: 'op-1', robotId: 'reverso', accountId: 'account-1', connectionId: 'connection-1', provider: 'profit', environment: 'demo',
  currency: 'BRL', month: '2026-11', symbol: 'WIN', side: 'buy', state: 'closed', quantity: '1', openedAt: '2026-11-12T10:00:00Z',
  closedAt: '2026-11-12T10:01:00Z', gross: '100', fees: '5', financing: '0', net: '95', costsComplete: true };
const period = { id: 'period-1', robotId: 'reverso', month: '2026-10', accountIds: ['account-1'], provider: 'profit', environment: 'demo', currency: 'BRL',
  gains: '1500', losses: '300', fees: '200', financing: '0', eligiblePlatformCosts: '0', costs: '200', net: '1000', eligibleNet: '1000', performanceRate: 20,
  participation: '200', status: 'ready_in_test', pendingReasons: [], reason: null, timeZone: 'America/Bahia' };
const request = (suffix = '', method = 'GET') => new Request('https://jenios.test/api/platform/reverso/state' + suffix, { method });

test('missing sources stay unavailable and cannot activate checkout, billing or execution', () => {
  const state = valid(empty());
  assert.ok(Object.values(state.sections).every(s => s.status === 'unavailable' && s.data === null));
  assert.deepEqual(state.offers.map(o => [o.priceMinor, o.months]), [[1990, 1], [19900, 12]]);
  assert.ok(Object.values(state.capabilities).every(v => v === false));
});
test('contract rejects wrong owner, robot and stale observations; strips unknown private fields', () => {
  for (const modify of [s => s.owner.subject = other, s => s.robotId = 'ultra', s => s.generatedAt = '2026-01-01T00:00:00Z']) {
    const state = empty(); modify(state); assert.throws(() => valid(state));
  }
  const state = empty(); state.secret = 'private'; state.sections.entitlement = section({ ...entitlement, payer: 'private' });
  const result = valid(state); assert.equal(result.secret, undefined); assert.equal(result.sections.entitlement.data.payer, undefined);
  assert.equal(result.sections.entitlement.data.accessGranted, false); assert.equal(result.sections.entitlement.data.accessObserved, true);
  assert.equal(result.sections.entitlement.data.amountCents, 1990); assert.equal(result.sections.entitlement.data.interval, 'month');
});
test('real access requires active paid right and current period, demo access is never granted', () => {
  const state = empty(); state.sections.entitlement = section(entitlement, 'live'); assert.equal(valid(state).sections.entitlement.data.accessGranted, true);
  for (const patch of [{ paymentStatus: 'pending' }, { periodEnd: stamp }, { periodStart: '2026-12-01T00:00:00Z' }]) {
    state.sections.entitlement = section({ ...entitlement, ...patch }, 'live'); assert.throws(() => valid(state));
  }
});
test('source validity survives projection and is rechecked after the final authentication await', async () => {
  let clock = NOW, checks = 0;
  const state = empty(); state.sections.entitlement = section({...entitlement, sourceValidUntil: new Date(NOW + 1000).toISOString()}, 'live');
  const roundtrip = valid(state);
  assert.equal(roundtrip.sections.entitlement.data.sourceValidUntil, new Date(NOW + 1000).toISOString());
  assert.throws(() => validateReversoState(roundtrip, {subject, now: NOW + 1000}));
  const handler = createReversoStateHandler({now: () => clock, getUser: async () => {if (++checks === 2) clock += 2000; return {id: subject};}, readState: async () => state});
  assert.equal((await (await handler(request())).json()).sections.entitlement.status, 'unavailable');
});
test('operation presentation keeps shared 12-place quantities and signed fees without rounding or erasing rebates', () => {
  const state = empty(); state.sections.operations = section({rows: [{...operation, quantity: '0.123456789123', fees: '-1', net: '101'}], hasMore: false});
  const row = valid(state).sections.operations.data.rows[0];
  assert.equal(row.quantity, '0.123456789123'); assert.equal(row.fees, '-1'); assert.equal(row.net, '101.00000000');
  state.sections.performance = section({periods: [{...period, gains: '100', losses: '0', fees: '-1', costs: '-1', net: '101', eligibleNet: '101', participation: '20.2'}]});
  assert.equal(valid(state).sections.performance.data.periods[0].participation, '20.20000000');
});
test('operation net is realized after complete costs; attribution, chronology and duplicate scopes are enforced', () => {
  const state = empty(); state.sections.operations = section({ rows: [operation], hasMore: false });
  assert.equal(valid(state).sections.operations.data.rows[0].net, '95.00000000');
  state.sections.operations.data.rows = [{ ...operation, costsComplete: false }]; assert.equal(valid(state).sections.operations.data.rows[0].net, null);
  for (const patch of [{ robotId: 'ultra' }, { net: '100' }, { openedAt: '2026-11-13T00:00:00Z' }, { closedAt: '2026-11-11T00:00:00Z' }, { environment: 'live' }]) {
    state.sections.operations.data.rows = [{ ...operation, ...patch }]; assert.throws(() => valid(state));
  }
  state.sections.operations.data.rows = [operation, operation]; assert.throws(() => valid(state));
  state.sections.operations.data.rows = [operation, { ...operation, accountId: 'account-2' }]; assert.equal(valid(state).sections.operations.data.rows.length, 2);
});
test('monthly presentation verifies net and percent, keeps pending participation null and loss as zero due', () => {
  const state = empty(); state.sections.performance = section({ periods: [period] });
  assert.equal(valid(state).sections.performance.data.periods[0].participation, '200.00000000');
  for (const patch of [{ net: '1500' }, { participation: '300' }, { currency: 'USD' }, { eligiblePlatformCosts: null }, { costs: '200', eligiblePlatformCosts: '50' }, { status: 'no_performance_due_in_test' }, { eligibleNet: '1500', participation: '300' }]) {
    state.sections.performance.data.periods = [{ ...period, ...patch }]; assert.throws(() => valid(state));
  }
  state.sections.performance.data.periods = [{ ...period, status: 'pending', pendingReasons: ['PRIOR_LOSS_POLICY_PENDING'], participation: '200' }];
  assert.equal(valid(state).sections.performance.data.periods[0].participation, null);
  state.sections.performance.data.periods = [{ ...period, gains: '0', losses: '10', fees: '0', costs: '0', net: '-10', eligibleNet: '0', participation: '0', status: 'no_performance_due_in_test' }];
  assert.equal(valid(state).sections.performance.data.periods[0].participation, '0.00000000');
});
test('Letter wallet preserves available, reserved and pending without inventing total or debit authority', () => {
  const state = empty(); state.sections.wallet = section({ currency: 'BRL', balanceMinor: null, availableMinor: 100, reservedMinor: 20, pendingMinor: 300, debitAuthorized: true }, 'live');
  const w = valid(state).sections.wallet.data; assert.equal(w.balanceMinor, null); assert.equal(w.availableMinor, 100); assert.equal(w.pendingMinor, 300); assert.equal(w.debitAuthorized, false);
});

const customerId = 'financial-customer';
const expected = { product: 'jenios', company_id: 'company', purpose: 'reverso_monthly_performance', external_invoice_id: 'obligation-1', customer_id: customerId,
  receiver_id: 'receiver', legal_entity_id: 'entity', amount_cents: 20000, currency: 'BRL', period_start: '2026-10-01T03:00:00Z', period_end: '2026-11-01T03:00:00Z' };
const original = { robotId: 'reverso', obligationId: 'obligation-1', customerId, month: '2026-10', timeZone: 'America/Bahia', confirmed: true, expected };
const obligation = { id: 'obligation-1', robotId: 'reverso', month: '2026-10', currency: 'BRL', amountMinor: 20000, status: 'assessed', paymentStatus: 'paid',
  paymentEvidence: { robotId: 'reverso', obligationId: 'obligation-1', receipt: { ...expected, schema_version: 1, id: 'receipt-1', state: 'paid', verified_paid: true,
    proof_sha256: 'a'.repeat(64), confirmed_at: '2026-11-05T12:00:00Z' } } };
test('payment needs independently bound original obligation, exact owner/period and central confirmation', () => {
  const project = (o = obligation, b = original) => confirmedReversoObligation(o, { customerId, binding: b, now: NOW });
  const received = project(); assert.equal(received.paymentConfirmed, true); assert.equal(received.paymentEvidence, undefined);
  assert.equal(confirmedReversoObligation(obligation).paymentConfirmed, false);
  assert.equal(project(obligation, { ...original, customerId: 'other' }).paymentConfirmed, false);
  assert.equal(project(obligation, { ...original, month: '2026-09' }).paymentConfirmed, false);
  const future = clone(obligation); future.paymentEvidence.receipt.confirmed_at = '2030-01-01T00:00:00Z'; assert.equal(project(future).paymentConfirmed, false);
  const wrong = clone(obligation); wrong.paymentEvidence.receipt.customer_id = 'other'; assert.throws(() => project(wrong), /MISMATCH/);
  const invalidPeriod = { ...original, expected: { ...expected, period_start: '2025-01-01T03:00:00Z', period_end: '2025-02-01T03:00:00Z' } };
  assert.equal(project(obligation, invalidPeriod).paymentConfirmed, false);
  const state = empty(); state.sections.obligations = section([received], 'live'); assert.equal(valid(valid(state)).sections.obligations.data[0].paymentConfirmed, true);
  state.sections.obligations.data[0].paidAt = '2030-01-01T00:00:00Z'; assert.throws(() => valid(state));
});

test('HTTP owner route uses authenticated identity and never accepts client-selected owner', async () => {
  let calls = 0;
  const handler = createReversoStateHandler({ getUser: async () => ({ id: subject }), now: () => NOW,
    readState: async ctx => { calls++; assert.equal(ctx.subject, subject); assert.equal(ctx.robotId, 'reverso'); return empty(); } });
  assert.equal((await handler(request())).status, 200); assert.equal(calls, 1);
  assert.equal((await handler(request('?subject=' + other))).status, 400); assert.equal(calls, 1);
  assert.equal((await handler(request('', 'POST'))).status, 405);
  assert.equal((await handler(new Request('https://jenios.test/api', { headers: { origin: 'https://other.test' } }))).status, 403);
  const anonymous = createReversoStateHandler({ getUser: async () => null }); assert.equal((await anonymous(request())).status, 401);
});
test('HTTP revalidates session and expiration after awaits; invalid source is unavailable', async () => {
  let n = 0;
  const changed = createReversoStateHandler({ now: () => NOW, getUser: async () => ({ id: ++n === 1 ? subject : other }), readState: async () => empty() });
  assert.equal((await changed(request())).status, 409);
  let clock = NOW; n = 0;
  const state = empty(); state.sections.entitlement = section({ ...entitlement, periodEnd: new Date(NOW + 1000).toISOString() }, 'live');
  const expired = createReversoStateHandler({ now: () => clock, getUser: async () => { if (++n === 2) clock += 2000; return { id: subject }; }, readState: async () => state });
  const result = await (await expired(request())).json(); assert.equal(result.sections.entitlement.status, 'unavailable');
});
test('Admin uses existing platform.admin grant and revalidates it before returning data', async () => {
  let checks = 0;
  const admin = createReversoStateHandler({ admin: true, now: () => NOW, getUser: async () => ({ id: subject }),
    requireAdmin: async () => ({ user: { id: subject }, permissions: ++checks === 1 ? ['platform.admin'] : [] }),
    readState: async ctx => emptyReversoState({ subject: ctx.subject, now: NOW }) });
  assert.equal((await admin(request('?subject=' + other))).status, 403); assert.equal(checks, 2);
  const allowed = createReversoStateHandler({ admin: true, now: () => NOW, getUser: async () => ({ id: subject }),
    requireAdmin: async () => ({ user: { id: subject }, permissions: ['platform.admin'] }), readState: async ctx => emptyReversoState({ subject: ctx.subject, now: NOW }) });
  const response = await allowed(request('?subject=' + other)); assert.equal((await response.json()).owner.subject, other);
});

const key = 'x'.repeat(48), env = { REVERSO_RUNTIME_READ_ENABLED: 'true', ULTRA_RUNTIME_ORIGIN: 'https://runtime.test', ULTRA_RUNTIME_SERVICE_KEY: key };
test('existing runtime host serves only Reverso read scope and nonce-bound current state', async () => {
  const provider = { readState: async () => empty() };
  const service = createReversoRuntimeStateService({ serviceKey: key, now: () => NOW, resolve: async ctx => { assert.equal(ctx.robotId, 'reverso'); return provider; } });
  let calls = 0;
  const source = createReversoRuntimeSource({ env, now: () => NOW, fetchImpl: async (url, init) => { calls++; assert.equal(url, 'https://runtime.test/v1/reverso/state'); return service(new Request(url, init)); } });
  assert.equal((await source({ subject })).owner.subject, subject); assert.equal(calls, 1);
  const disabled = createReversoRuntimeSource({ env: {}, fetchImpl: () => { throw Error('must not call'); } }); assert.equal(await disabled({ subject }), null);
  assert.equal((await service(new Request('https://runtime.test/v1/ultra/state', { method: 'POST' }))).status, 404);
});
test('transport rejects nonce substitution, unknown identity, late source and changed runtime binding', async () => {
  const wrong = createReversoRuntimeSource({ env, now: () => NOW, fetchImpl: async () => Response.json({ nonce: 'wrong', state: empty() }) });
  await assert.rejects(wrong({ subject }), /CONTEXT_MISMATCH/);
  const slow = createReversoRuntimeSource({ env, now: () => NOW, timeoutMs: 5, fetchImpl: async () => new Promise(() => {}) });
  await assert.rejects(slow({ subject }), /TIMEOUT/);
  let n = 0; const provider = { readState: async () => empty() };
  const service = createReversoRuntimeStateService({ serviceKey: key, now: () => NOW, resolve: async () => ++n === 1 ? provider : null });
  const source = createReversoRuntimeSource({ env, now: () => NOW, fetchImpl: async (url, init) => service(new Request(url, init)) });
  await assert.rejects(source({ subject }), /UNAVAILABLE/);
});
test('runtime rechecks access expiry after final identity resolution', async () => {
  let clock = NOW, n = 0; const state = empty(); state.sections.entitlement = section({ ...entitlement, periodEnd: new Date(NOW + 1000).toISOString() }, 'live');
  const provider = { readState: async () => state };
  const service = createReversoRuntimeStateService({ serviceKey: key, now: () => clock, resolve: async () => { if (++n === 2) clock += 2000; return provider; } });
  const source = createReversoRuntimeSource({ env, now: () => clock, fetchImpl: async (url, init) => service(new Request(url, init)) });
  await assert.rejects(source({ subject }), /UNAVAILABLE/);
});

const owner = { active: true, platform: 'jenios', subject, robotId: 'reverso', customerId, revision: 'v1', bindingId: 'binding-1', ownerScope: 'owner-1' };
test('composition uses the existing Letter wallet reader, current owner and no substitute financial source', async () => {
  const reader = createReversoOwnerStateReader({ subject, now: () => NOW, readOwner: async () => owner,
    letterWallet: { readWallet: async ctx => { assert.deepEqual(ctx, { platform: 'jenios', subject }); return { source: 'letter_private.wallets', observedAt: stamp, currency: 'BRL',
      availableMinor: 100, reservedMinor: 20, pendingMinor: 300, suspended: false, debitAuthorized: false }; } } });
  const state = await reader.readState(); assert.equal(state.sections.wallet.data.availableMinor, 100); assert.equal(state.sections.wallet.data.balanceMinor, null);
  assert.equal(state.sections.entitlement.status, 'unavailable'); assert.equal(state.sections.obligations.status, 'unavailable'); assert.equal(state.sections.performance.status, 'unavailable');
});
test('composition preserves unknown payment and requires separately persisted original binding for receipts', async () => {
  const options = { subject, now: () => NOW, readOwner: async () => owner,
    readObligations: async () => ({ robotId: 'reverso', subject, customerId, status: 'available', mode: 'live', observedAt: stamp, items: [obligation] }) };
  const uncertain = await createReversoOwnerStateReader(options).readState(); assert.equal(uncertain.sections.obligations.data[0].paymentConfirmed, false);
  const verified = await createReversoOwnerStateReader({ ...options, readObligationBinding: async () => original }).readState();
  assert.equal(verified.sections.obligations.data[0].paymentConfirmed, true);
});
test('composition refuses identity revocation and allows retry after an unavailable read', async () => {
  let n = 0; const revoked = createReversoOwnerStateReader({ subject, now: () => NOW, readOwner: async () => ++n === 1 ? owner : { ...owner, revision: 'v2' } });
  await assert.rejects(revoked.readState(), /BINDING_CHANGED/);
  let ready = false; const reader = createReversoOwnerStateReader({ subject, now: () => NOW, readOwner: async () => ready ? owner : null });
  assert.ok(Object.values((await reader.readState()).sections).every(s => s.status === 'unavailable'));
  ready = true; assert.equal((await reader.readState()).owner.subject, subject);
});
