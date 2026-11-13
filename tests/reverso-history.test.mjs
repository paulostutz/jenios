import test from 'node:test';
import assert from 'node:assert/strict';
import {createReversoOwnerStateReader} from '../lib/platform/reverso/state-reader.mjs';
import {available, emptyReversoState, validateReversoState} from '../lib/platform/reverso/state-contract.mjs';
import {REVERSO_ACCESS_SOURCE_SCHEMA, REVERSO_OFFER_VERSION, reversoOffer, reversoPeriodFromConfirmation} from '../lib/platform/reverso/access.mjs';

const subject = '11111111-1111-4111-8111-111111111111';
const now = Date.parse('2026-11-12T22:00:00Z'), stamp = new Date(now).toISOString();
const owner = {active: true, platform: 'jenios', subject, robotId: 'reverso', customerId: 'synthetic:customer',
  ownerScope: 'synthetic:owner', revision: 'synthetic:revision', bindingId: 'synthetic:binding'};
const copy = structuredClone;

function operation(month, index = 0, {account = 'synthetic:account', connection = 'synthetic:connection', currency = 'BRL'} = {}) {
  const [year, number] = month.split('-').map(Number);
  return {robotId: 'reverso', customerId: owner.customerId, accountBinding: account, connectionId: connection,
    provider: 'profit', environment: 'demo', origin: {robot: 'reverso'}, operation: {
      id: month + ':operation:' + index, currency, symbol: 'WIN-FIXTURE', side: 'buy', state: 'closed', entryQuantity: '1',
      openedAt: new Date(Date.UTC(year, number - 1, 5, 9)).toISOString(),
      closedAt: new Date(Date.UTC(year, number - 1, 5, 10, 0, index)).toISOString(),
      gross: '100', fees: '5', financing: '0', net: '95', costsComplete: true,
    }};
}

function financial(month, {count = 1, account = 'synthetic:account', connection = 'synthetic:connection', currency = 'BRL', rateBps = 2000} = {}) {
  return {schema: 'JENIOS_REVERSO_FINANCIAL_STATE_V1', platform: 'jenios', robotId: 'reverso',
    customerId: owner.customerId, ownerScope: owner.ownerScope, environment: 'demo', evidenceMode: 'offline_fixture', syntheticOnly: true,
    currency, period: {month, timeZone: 'America/Bahia'},
    totals: {gains: String(count * 100), losses: '0', brokerFees: String(count * 5), financing: '0', eligiblePlatformCosts: '0', brokerNet: String(count * 95), eligibleNet: String(count * 95)},
    participation: {rateBps, amount: String(count * (rateBps === 2000 ? 19 : 9.5))},
    assessmentStatus: 'ready_in_test', assessmentPendingReasons: [], perAccount: [{binding: {broker_account_id: account}}],
    obligations: {proposedIntent: {proposedObligationId: ['synthetic:period', month, account, currency].join(':')}},
    operations: Array.from({length: count}, (_, index) => operation(month, index, {account, connection, currency})),
  };
}
function pending(finance) {
  finance.assessmentStatus = 'pending'; finance.assessmentPendingReasons = ['SOURCE_CONFIRMATION_PENDING']; finance.participation.amount = null;
  finance.totals = Object.fromEntries(Object.keys(finance.totals).map(key => [key, null])); return finance;
}
function history(periods) {
  return {schema: 'JENIOS_REVERSO_FINANCIAL_HISTORY_V1', platform: 'jenios', robotId: 'reverso',
    customerId: owner.customerId, ownerScope: owner.ownerScope, environment: 'demo', evidenceMode: 'offline_fixture', syntheticOnly: true, periods};
}
const read = finance => createReversoOwnerStateReader({subject, now: () => now, readOwner: async () => owner, readFinancialState: async () => finance}).readState();

test('single financial source remains supported with the original monthly amounts', async () => {
  const state = await read(financial('2026-10'));
  assert.equal(state.sections.performance.data.periods.length, 1);
  assert.equal(state.sections.performance.data.periods[0].participation, '19.00000000');
  assert.equal(state.sections.operations.data.rows[0].net, '95.00000000'); assert.equal(state.sections.operations.data.hasMore, false);
  assert.ok(Object.values(state.capabilities).every(value => value === false));
});

test('monthly history is newest first and never merges periods, currencies or participation', async () => {
  const october = financial('2026-10', {rateBps: 1000}), september = financial('2026-09');
  const dollars = pending(financial('2026-09', {account: 'synthetic:dollar-account', connection: 'synthetic:dollar-connection', currency: 'USDT'}));
  const source = history([dollars, september, october]), original = copy(source), state = await read(source);
  const periods = state.sections.performance.data.periods;
  assert.deepEqual(periods.map(p => [p.month, p.currency, p.participation]), [['2026-10', 'BRL', '9.50000000'], ['2026-09', 'BRL', '19.00000000'], ['2026-09', 'USDT', null]]);
  assert.equal(periods[0].net, '95.00000000'); assert.equal(periods[1].net, '95.00000000'); assert.equal(periods[2].net, null);
  assert.deepEqual(Object.keys(state.sections.performance.data), ['periods']); assert.equal(state.sections.operations.data.rows[0].month, '2026-10');
  assert.deepEqual(source, original);
});

test('one operation retains its open previous-month snapshot and closed later-month snapshot', async () => {
  const previous = pending(financial('2026-09')), later = financial('2026-10');
  previous.operations[0].operation = {...previous.operations[0].operation, id: 'synthetic:carried-operation', state: 'open',
    closedAt: null, gross: null, fees: null, financing: null, net: null, costsComplete: false};
  later.operations[0].operation.id = 'synthetic:carried-operation';
  later.operations[0].operation.openedAt = previous.operations[0].operation.openedAt;
  const state = await read(history([previous, later])), rows = state.sections.operations.data.rows;
  assert.deepEqual(rows.map(row => [row.id, row.month, row.state, row.net]), [
    ['synthetic:carried-operation', '2026-10', 'closed', '95.00000000'], ['synthetic:carried-operation', '2026-09', 'open', null],
  ]);
  assert.equal(state.sections.performance.data.periods[1].participation, null);
});

test('history limits displayed operations to 200 newest rows while retaining every performance period', async () => {
  const state = await read(history([financial('2026-09', {count: 110}), financial('2026-10', {count: 100})])), data = state.sections.operations.data;
  assert.equal(data.rows.length, 200); assert.equal(data.hasMore, true);
  assert.equal(data.rows[0].id, '2026-10:operation:99'); assert.equal(data.rows[99].id, '2026-10:operation:0');
  assert.equal(data.rows[100].id, '2026-09:operation:109'); assert.equal(data.rows[199].id, '2026-09:operation:10');
  assert.deepEqual(state.sections.performance.data.periods.map(p => [p.month, p.participation]), [['2026-10', '1900.00000000'], ['2026-09', '2090.00000000']]);
  assert.equal((await read(financial('2026-10', {count: 200}))).sections.operations.data.hasMore, false);
});

test('rows outside the displayed cut still require valid amounts, attribution and unique scope', async () => {
  const duplicate = financial('2026-10', {count: 201}); duplicate.operations.push(copy(duplicate.operations[0]));
  await assert.rejects(read(history([duplicate])), /DUPLICATE_FINANCIAL_OPERATION/);
  const malformed = financial('2026-10', {count: 201}); malformed.operations[0].operation.fees = 'not-a-decimal';
  await assert.rejects(read(history([malformed])));
  const crossed = financial('2026-10', {count: 201}); crossed.operations[0].customerId = 'synthetic:other-customer';
  await assert.rejects(read(history([crossed])), /OPERATION_SCOPE_MISMATCH/);
  const oldWrong = financial('2026-09'); oldWrong.totals.brokerNet = '999';
  await assert.rejects(read(history([financial('2026-10', {count: 200}), oldWrong])));
});

test('repeated period scope is rejected even with another ID or reordered accounts', async () => {
  const first = financial('2026-10'); first.perAccount.push({binding: {broker_account_id: 'synthetic:second-account'}});
  const second = copy(first); second.perAccount.reverse(); second.obligations.proposedIntent.proposedObligationId = 'synthetic:another-id';
  await assert.rejects(read(history([first, second])), /DUPLICATE_FINANCIAL_PERIOD/);
  const anotherMonth = financial('2026-09'); anotherMonth.obligations.proposedIntent.proposedObligationId = first.obligations.proposedIntent.proposedObligationId;
  await assert.rejects(read(history([first, anotherMonth])), /DUPLICATE_FINANCIAL_PERIOD/);
  assert.equal((await read(history([financial('2026-10'), financial('2026-10', {account: 'synthetic:other-account', connection: 'synthetic:other-connection'})]))).sections.performance.data.periods.length, 2);
});

test('history and every assessment retain the authorized owner, platform, robot and environment', async () => {
  for (const patch of [{customerId: 'synthetic:other'}, {ownerScope: 'synthetic:other'}, {robotId: 'ultra'}, {platform: 'flow'}, {environment: 'live'}, {syntheticOnly: false}, {evidenceMode: 'live'}]) {
    await assert.rejects(read({...history([financial('2026-10')]), ...patch}), /FINANCE_SCOPE_MISMATCH/);
    await assert.rejects(read(history([{...financial('2026-10'), ...patch}])), /FINANCE_SCOPE_MISMATCH/);
  }
  const wrong = financial('2026-10'); wrong.operations[0].robotId = 'ultra';
  await assert.rejects(read(history([wrong])), /OPERATION_SCOPE_MISMATCH/);
  const origin = financial('2026-10'); origin.operations[0].origin.robot = 'ultra';
  await assert.rejects(read(history([origin])), /OPERATION_SCOPE_MISMATCH/);
});

test('authorized empty history is distinct from unavailable source and the bound is 120 periods', async () => {
  const empty = await read(history([]));
  assert.equal(empty.sections.performance.status, 'available'); assert.deepEqual(empty.sections.performance.data.periods, []);
  assert.deepEqual(empty.sections.operations.data.rows, []); assert.equal(empty.sections.operations.data.hasMore, false);
  assert.equal((await read({status: 'unavailable'})).sections.performance.status, 'unavailable');
  const periods = Array.from({length: 120}, (_, index) => financial(new Date(Date.UTC(2016, index, 1)).toISOString().slice(0, 7)));
  const state = await read(history(periods));
  assert.equal(state.sections.performance.data.periods.length, 120); assert.equal(state.sections.performance.data.periods[0].month, '2025-12');
  await assert.rejects(read(history([...periods, financial('2026-01')])), /FINANCIAL_HISTORY_LIMIT/);
  await assert.rejects(read({...history([]), periods: null}), /FINANCIAL_HISTORY_LIMIT/);
});

test('a conflict never displays gross, costs or realized net from one selected variant', async () => {
  const finance = pending(financial('2026-10'));
  Object.assign(finance.operations[0].operation, {classification: 'conflict', state: 'closed', gross: '9876', fees: '0', financing: '0', net: null, costsComplete: true});
  const original = copy(finance), state = await read(history([finance])), row = state.sections.operations.data.rows[0];
  assert.equal(row.state, 'unknown'); assert.equal(row.closedAt, null); assert.equal(row.costsComplete, false);
  for (const field of ['gross', 'fees', 'financing', 'net']) assert.equal(row[field], null, field);
  assert.equal(state.sections.operations.data.costsPending, 1);
  const period = state.sections.performance.data.periods[0];
  assert.equal(period.gains, null); assert.equal(period.net, null); assert.equal(period.participation, null);
  assert.deepEqual(finance, original);
});

test('public operation uniqueness includes month and retains account/connection isolation', async () => {
  const projected = await read(financial('2026-10')), row = projected.sections.operations.data.rows[0];
  const state = emptyReversoState({subject, now});
  const validate = rows => {
    state.sections.operations = available({rows, hasMore: false}, {mode: 'demo', observedAt: stamp});
    return validateReversoState(state, {subject, now}).sections.operations.data.rows;
  };
  assert.equal(validate([row, {...row, month: '2026-09', state: 'open', closedAt: null, net: null}]).length, 2);
  assert.throws(() => validate([row, {...row, state: 'unknown', closedAt: null, net: null}]));
  assert.equal(validate([row, {...row, accountId: 'synthetic:other-account'}, {...row, connectionId: 'synthetic:other-connection'}]).length, 3);
});

test('public period validation rejects duplicate scope and an inconsistent persisted obligation ID', async () => {
  const state = await read(history([financial('2026-10')])), period = state.sections.performance.data.periods[0];
  state.sections.performance.data.periods.push({...period, id: 'synthetic:different-id'});
  assert.throws(() => validateReversoState(state, {subject, now}));
  state.sections.performance.data.periods = [{...period, obligationId: 'synthetic:other-obligation'}];
  assert.throws(() => validateReversoState(state, {subject, now}));
});

test('persisted period ID matches the original obligation without relabelling the proposed intent', async () => {
  const finance = financial('2026-10'), proposed = finance.obligations.proposedIntent.proposedObligationId;
  const first = (await read(finance)).sections.performance.data.periods[0];
  assert.equal(first.id, proposed); assert.equal(first.obligationId, null);
  finance.obligations.persistedObligationId = 'reverso-monthly:' + 'a'.repeat(64);
  const period = (await read(finance)).sections.performance.data.periods[0];
  assert.equal(period.id, finance.obligations.persistedObligationId); assert.equal(period.obligationId, period.id);
  assert.equal(finance.obligations.proposedIntent.proposedObligationId, proposed);
});

function accessSource() {
  const offer = reversoOffer('month'), confirmed = '2026-11-01T12:00:00Z', dates = reversoPeriodFromConfirmation(confirmed, 'month');
  const expected = {product: 'jenios', company_id: 'synthetic:company', purpose: 'jenios_platform_subscription', external_invoice_id: 'synthetic:order',
    customer_id: owner.customerId, receiver_id: 'synthetic:receiver', legal_entity_id: 'synthetic:entity', amount_cents: offer.amountCents, currency: 'BRL',
    period_start: '2026-10-25T12:00:00Z', period_end: '2026-11-25T12:00:00Z'};
  return {schema: REVERSO_ACCESS_SOURCE_SCHEMA, platform: 'jenios', subject, robotId: 'reverso', mode: 'live', observedAt: stamp,
    validUntil: new Date(now + 30000).toISOString(), revision: 'synthetic:access-revision',
    identity: {subject, customerId: owner.customerId, bindingId: owner.bindingId, revision: owner.revision}, contracts: [{
      id: 'synthetic:contract', orderId: 'synthetic:order', robotId: 'reverso', planId: offer.planId, planName: offer.planName, productCode: offer.productCode,
      kind: 'entry', interval: 'month', amountCents: offer.amountCents, currency: 'BRL', acceptedAt: '2026-10-25T12:00:00Z',
      termsVersion: 'synthetic:terms', offerVersion: REVERSO_OFFER_VERSION, cancelAtPeriodEnd: false, revoked: false, orderStatus: 'paid',
      policy: {approved: true, revoked: false, robotId: 'reverso', reference: 'synthetic:policy', performanceRate: 20, planId: offer.planId, productCode: offer.productCode, termsVersion: 'synthetic:terms'},
      expectedReceipt: expected, receipt: {...expected, schema_version: 1, id: 'synthetic:receipt', state: 'paid', verified_paid: true, proof_sha256: 'a'.repeat(64), confirmed_at: confirmed},
      accessBinding: {id: 'synthetic:grant', revision: 'synthetic:grant-revision', subject, robotId: 'reverso', orderId: 'synthetic:order', productCode: offer.productCode,
        state: 'granted', periodStart: dates.periodStart, periodEnd: dates.periodEnd},
    }]};
}

function persistedSnapshot(revision = 'a'.repeat(64)) {
  const finance = financial('2026-10'), id = 'reverso-monthly:' + 'b'.repeat(64);
  finance.obligations.persistedObligationId = id;
  return {schema: 'JENIOS_REVERSO_PERSISTED_SNAPSHOT_V1', robotId: 'reverso', subject, customerId: owner.customerId, ownerScope: owner.ownerScope,
    revision, financialState: history([finance]), obligations: {robotId: 'reverso', subject, customerId: owner.customerId,
      mode: 'demo', status: 'available', observedAt: stamp, items: [{id, robotId: 'reverso', month: '2026-10', currency: 'BRL',
        amountMinor: 1900, status: 'prepared', paymentStatus: 'pending', paymentConfirmed: false, paidAt: null}]}};
}
function snapshotOptions(readFinancialSnapshot) {
  return {subject, now: () => now, readOwner: async () => owner, readFinancialSnapshot, readAccessSource: async () => accessSource(),
    letterWallet: {readWallet: async () => ({source: 'letter_private.wallets', observedAt: stamp, currency: 'BRL', availableMinor: 500,
      pendingMinor: 20, reservedMinor: 50, suspended: false, debitAuthorized: false})},
    readCycles: async () => ({robotId: 'reverso', subject, customerId: owner.customerId, status: 'available', mode: 'demo', observedAt: stamp,
      items: [{id: 'synthetic:cycle', robotId: 'reverso', phase: 'paused', startedAt: '2026-11-12T10:00:00Z', endedAt: null, reservationMinor: null}]})};
}
function assertIndependentSourcesPreserved(state) {
  assert.equal(state.sections.entitlement.status, 'available'); assert.equal(state.sections.entitlement.data.accessGranted, true);
  assert.equal(state.sections.wallet.status, 'available'); assert.equal(state.sections.wallet.data.availableMinor, 500);
  assert.equal(state.sections.cycles.status, 'available'); assert.equal(state.sections.cycles.data[0].phase, 'paused');
  for (const key of ['operations', 'performance', 'obligations', 'policy']) {
    assert.equal(state.sections[key].status, 'unavailable', key); assert.equal(state.sections[key].data, null, key);
    assert.match(state.sections[key].reason, /atualização concorrente/);
  }
}

test('a persisted financial snapshot is exclusive and cannot be mixed with independent financial or obligation reads', () => {
  const base = snapshotOptions(async () => persistedSnapshot());
  for (const patch of [{readFinancialState: async () => null}, {readObligations: async () => null}, {readFinancialSnapshot: null}]) {
    assert.throws(() => createReversoOwnerStateReader({...base, ...patch}), /SNAPSHOT_EXCLUSIVE_SOURCE_REQUIRED/);
  }
});

test('one stable persisted snapshot composes assessment and obligation, then is rechecked after original bindings', async () => {
  const events = [];
  const reader = createReversoOwnerStateReader({...snapshotOptions(async context => {
    assert.deepEqual(context, {platform: 'jenios', subject, robotId: 'reverso'}); events.push('snapshot'); return persistedSnapshot();
  }), readObligationBinding: async () => {events.push('binding'); return null;}});
  const state = await reader.readState();
  assert.deepEqual(events, ['snapshot', 'binding', 'snapshot']);
  const period = state.sections.performance.data.periods[0], obligation = state.sections.obligations.data[0];
  assert.equal(period.obligationId, obligation.id); assert.equal(period.id, obligation.id);
  assert.equal(period.participation, '19.00000000'); assert.equal(obligation.paymentConfirmed, false);
});

test('a newer conflict revision discards all four financial sections and preserves valid access, wallet and cycles', async () => {
  let changed = false, reads = 0;
  const reader = createReversoOwnerStateReader({...snapshotOptions(async () => {
    reads++; const value = persistedSnapshot((changed ? 'b' : 'a').repeat(64));
    if (changed) value.obligations.items[0].status = 'reconciliation_pending'; return value;
  }), readObligationBinding: async () => {changed = true; return null;}});
  assertIndependentSourcesPreserved(await reader.readState()); assert.equal(reads, 2);
});

test('failed final snapshot read discards financial data without discarding independent sources', async () => {
  let reads = 0;
  const reader = createReversoOwnerStateReader(snapshotOptions(async () => {if (++reads === 2) throw Error('synthetic:source-lost'); return persistedSnapshot();}));
  assertIndependentSourcesPreserved(await reader.readState()); assert.equal(reads, 2);
});

test('both snapshot reads are bounded and recovery cannot combine a missing first read with a later response', async () => {
  for (const timeoutAt of [1, 2]) {
    let reads = 0;
    const reader = createReversoOwnerStateReader({...snapshotOptions(async () => ++reads === timeoutAt ? new Promise(() => {}) : persistedSnapshot()), timeoutMs: 5});
    assertIndependentSourcesPreserved(await reader.readState()); assert.equal(reads, 2);
  }
});

test('identity and a string SHA256 revision are required on the initial and final snapshot', async () => {
  const mutations = [s => s.robotId = 'ultra', s => s.subject = 'synthetic:other', s => s.customerId = 'synthetic:other',
    s => s.ownerScope = 'synthetic:other', s => s.revision = 'invalid', s => s.revision = ['a'.repeat(64)],
    s => s.financialState.ownerScope = 'synthetic:other', s => s.obligations.subject = 'synthetic:other'];
  for (const invalidAt of [1, 2]) for (const mutate of mutations) {
    let reads = 0;
    const reader = createReversoOwnerStateReader(snapshotOptions(async () => {const value = persistedSnapshot(); if (++reads === invalidAt) mutate(value); return value;}));
    assertIndependentSourcesPreserved(await reader.readState()); assert.equal(reads, 2);
  }
});
