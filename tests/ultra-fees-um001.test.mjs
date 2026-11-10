import test from 'node:test';
import assert from 'node:assert/strict';
import { createUltraStartFeeLaboratory, ULTRA_START_FEE_UM001 } from '../lib/platform/ultra/fees-um001.mjs';

const at = '2026-11-10T15:00:00.000Z';
const terminalAt = '2026-11-10T16:00:00.000Z';
const accountKey = 'synthetic:account-a';
const planId = 'synthetic:plan-chargeable';
const adminSession = Object.freeze({ fixtureSession: 'synthetic:session-admin' });
const readSession = Object.freeze({ fixtureSession: 'synthetic:session-reader' });
const walletReadSession = Object.freeze({ fixtureSession: 'synthetic:wallet-read' });

function registry(overrides = {}) {
  return {
    syntheticOnly: true,
    plans: [
      { syntheticOnly: true, planId, label: 'Plano sujeito fictício', eligibility: 'chargeable', evidenceRef: 'synthetic:approved-registry-1', enabled: true },
      { syntheticOnly: true, planId: 'synthetic:plan-exempt', label: 'Plano isento fictício', eligibility: 'exempt', evidenceRef: 'synthetic:approved-registry-2' },
      { syntheticOnly: true, planId: 'synthetic:plan-pending', label: 'Plano sem enquadramento', eligibility: 'pending' },
    ],
    accounts: [{ syntheticOnly: true, accountKey, ownerKey: 'synthetic:owner-a', planId, currency: 'BRL', balanceCents: 2000 }],
    ...overrides,
  };
}

function fixture({ fixtureRegistry = registry(), authorizationDelay = false } = {}) {
  const sessions = new Map([[adminSession, 'manage'], [readSession, 'read'], [walletReadSession, 'wallet-read']]);
  return createUltraStartFeeLaboratory({
    syntheticOnly: true, fixtureRegistry, now: () => at,
    authorizeAdmin: async (context, request) => {
      if (authorizationDelay) await Promise.resolve();
      const role = sessions.get(context);
      const allowed = role === 'manage' || (role === 'read' && request.permission === ULTRA_START_FEE_UM001.readPermission);
      return { allowed, actorId: role === 'manage' ? 'synthetic:admin-a' : 'synthetic:reader-a', syntheticOnly: true, assurance: 'synthetic-server-session' };
    },
  });
}

function start(overrides = {}) {
  return { syntheticOnly: true, accountKey, cycleId: 'synthetic:cycle-1', requestId: 'synthetic:start-1', platform: 'flow', startedAt: at, intent: 'explicit_new_cycle', ...overrides };
}
function toggle(overrides = {}) {
  return { syntheticOnly: true, planId, enabled: false, expectedVersion: 0, requestId: 'synthetic:admin-change-1', reason: 'Pausa de tarifa no cenário fictício', ...overrides };
}
const hasCode = code => error => error?.code === code;

test('one R$5 reservation per cycle regardless of distinct trades', () => {
  const lab = fixture();
  const cycle = lab.recordStart(start());
  for (let trade = 1; trade <= 7; trade++) lab.observeSyntheticTrade({ syntheticOnly: true, accountKey, cycleId: cycle.cycleId, tradeId: `synthetic:trade-${trade}` });
  lab.observeSyntheticTrade({ syntheticOnly: true, accountKey, cycleId: cycle.cycleId, tradeId: 'synthetic:trade-1' });
  const current = lab.reconnect({ syntheticOnly: true, accountKey, cycleId: cycle.cycleId, platform: 'jenios' });
  assert.equal(current.tradeIds.length, 7);
  assert.equal(current.reservation.reservedCents, 500);
  assert.equal(lab.readReservationJournal().length, 1);
  assert.equal(lab.readAccount(accountKey).availableSimulatedCents, 1500);
  assert.equal(current.robotExecutionConfirmed, false);
});

test('replay and cross-platform reconnect share canonical account + cycle identity', async () => {
  const lab = fixture();
  await Promise.all(Array.from({ length: 20 }, (_, index) => Promise.resolve().then(() => lab.recordStart(start({ platform: index % 2 ? 'jenios' : 'flow', requestId: `synthetic:start-${index}` })))));
  assert.equal(lab.readReservationJournal().length, 1);
  assert.equal(lab.readAccount(accountKey).reservedSimulatedCents, 500);
  assert.equal(lab.reconnect({ syntheticOnly: true, accountKey, cycleId: 'synthetic:cycle-1', platform: 'jenios' }).reservation.key, lab.recordStart(start()).reservation.key);
});

test('concurrent different cycles cannot reserve more than the shared simulated balance', async () => {
  const value = registry(); value.accounts[0].balanceCents = 800;
  const lab = fixture({ fixtureRegistry: value });
  const results = await Promise.all([1, 2].map(index => Promise.resolve().then(() => lab.recordStart(start({ cycleId: `synthetic:cycle-${index}`, requestId: `synthetic:start-${index}` })))));
  assert.deepEqual(results.map(result => result.reservation.status).sort(), ['insufficient_simulated_balance', 'reserved_simulated']);
  assert.equal(lab.readReservationJournal().length, 1);
  assert.equal(lab.readAccount(accountKey).availableSimulatedCents, 300);
});

test('different canonical accounts keep separate reserves even with the same cycle label', () => {
  const value = registry();
  value.accounts.push({ ...value.accounts[0], accountKey: 'synthetic:account-b', ownerKey: 'synthetic:owner-b' });
  const lab = fixture({ fixtureRegistry: value });
  const first = lab.recordStart(start());
  const second = lab.recordStart(start({ accountKey: 'synthetic:account-b' }));
  assert.notEqual(first.reservation.key, second.reservation.key);
  assert.equal(lab.readAccount(accountKey).reservedSimulatedCents, 500);
  assert.equal(lab.readAccount('synthetic:account-b').reservedSimulatedCents, 500);
});

test('unknown simulated balance remains pending and is not fabricated as zero', () => {
  const value = registry(); value.accounts[0].balanceCents = null;
  const lab = fixture({ fixtureRegistry: value });
  assert.equal(lab.recordStart(start()).reservation.status, 'pending_simulated_balance');
  assert.equal(lab.readAccount(accountKey).availableSimulatedCents, null);
  assert.equal(lab.readAccount(accountKey).actualPlatformWalletBalanceCents, null);
  assert.deepEqual(lab.readReservationJournal(), []);
});

test('insufficient simulated balance does not create a debit or a negative balance', () => {
  const value = registry(); value.accounts[0].balanceCents = 499;
  const lab = fixture({ fixtureRegistry: value });
  assert.equal(lab.recordStart(start()).preparationStatus, 'blocked_simulated');
  assert.equal(lab.readAccount(accountKey).availableSimulatedCents, 499);
  assert.deepEqual(lab.readReservationJournal(), []);
});

test('missing and pending plan classification never silently charge or grant exemption', () => {
  for (const unclassified of ['synthetic:plan-pending', 'synthetic:unmapped-plan']) {
    const value = registry(); value.accounts[0].planId = unclassified;
    const lab = fixture({ fixtureRegistry: value });
    const cycle = lab.recordStart(start());
    assert.equal(cycle.reservation.status, 'pending_plan_definition');
    assert.equal(cycle.preparationStatus, 'pending');
    assert.deepEqual(lab.readReservationJournal(), []);
  }
});

test('exemption requires explicit fixture registry evidence and creates no reserve', () => {
  const value = registry(); value.accounts[0].planId = 'synthetic:plan-exempt';
  const lab = fixture({ fixtureRegistry: value });
  assert.equal(lab.recordStart(start()).reservation.status, 'not_required_exempt');
  assert.deepEqual(lab.readReservationJournal(), []);
  delete value.plans[1].evidenceRef;
  assert.throws(() => fixture({ fixtureRegistry: value }), hasCode('PLAN_EVIDENCE_REQUIRED'));
});

test('plan activation undefined is pending; explicitly paused policy prepares no fee', () => {
  const value = registry(); delete value.plans[0].enabled;
  const pending = fixture({ fixtureRegistry: value });
  assert.equal(pending.recordStart(start()).reservation.status, 'pending_activation_definition');
  value.plans[0].enabled = false;
  const paused = fixture({ fixtureRegistry: value });
  assert.equal(paused.recordStart(start()).reservation.status, 'not_required_policy_paused');
  assert.deepEqual(paused.readReservationJournal(), []);
});

test('pause and end preserve reservation pending settlement and never resume a terminal cycle', () => {
  for (const phase of ['paused', 'ended']) {
    const lab = fixture(); lab.recordStart(start());
    const command = { syntheticOnly: true, accountKey, cycleId: 'synthetic:cycle-1', requestId: 'synthetic:close-1', phase, at: terminalAt };
    const closed = lab.closeCycle(command);
    assert.equal(closed.phase, phase);
    assert.equal(closed.reservation.settlement, 'pending_capture_or_release_policy');
    assert.equal(closed.reservation.reservedCents, 500);
    assert.deepEqual(lab.closeCycle(command), closed);
    assert.equal(lab.recordStart(start({ requestId: 'synthetic:repeated-terminal-start' })).phase, phase);
    assert.equal(lab.reconnect({ syntheticOnly: true, accountKey, cycleId: 'synthetic:cycle-1', platform: 'flow' }).phase, phase);
    assert.equal(lab.readReservationJournal().length, 1);
    assert.equal(lab.readAccount(accountKey).availableSimulatedCents, 1500);
    assert.throws(() => lab.observeSyntheticTrade({ syntheticOnly: true, accountKey, cycleId: 'synthetic:cycle-1', tradeId: 'synthetic:trade-after-end' }), hasCode('CYCLE_ALREADY_TERMINAL'));
  }
});

test('cycle identity conflicts and request-id reuse cannot create another reserve', () => {
  const lab = fixture(); lab.recordStart(start());
  assert.throws(() => lab.recordStart(start({ cycleId: 'synthetic:cycle-2' })), hasCode('IDEMPOTENCY_CONFLICT'));
  assert.throws(() => lab.recordStart(start({ requestId: 'synthetic:start-later', startedAt: terminalAt })), hasCode('CYCLE_IDENTITY_CONFLICT'));
  assert.equal(lab.readReservationJournal().length, 1);
});

test('admin permission is resolved by the injected session adapter, not browser role or Wallet connection', async () => {
  const lab = fixture();
  for (const context of [null, { admin: true, role: 'admin' }, readSession, walletReadSession]) {
    await assert.rejects(lab.admin.setPlanEnabled(toggle(), context), hasCode('ADMIN_PERMISSION_REQUIRED'));
  }
  const reader = await lab.admin.read(readSession);
  assert.equal(reader.canManage, false);
  assert.equal(reader.plans[0].enabled, true);
  assert.equal(reader.audit.length, 0);
  await assert.rejects(lab.admin.read(walletReadSession), hasCode('ADMIN_PERMISSION_REQUIRED'));
});

test('admin append audit includes actor, reason, before, after and version; replay is idempotent', async () => {
  const lab = fixture();
  const changed = await lab.admin.setPlanEnabled(toggle(), adminSession);
  const repeated = await lab.admin.setPlanEnabled(toggle(), adminSession);
  assert.deepEqual(changed, repeated);
  const view = await lab.admin.read(adminSession);
  assert.equal(view.audit.length, 1);
  assert.equal(view.audit[0].actorId, 'synthetic:admin-a');
  assert.deepEqual(view.audit[0].before, { enabled: true, version: 0 });
  assert.deepEqual(view.audit[0].after, { enabled: false, version: 1 });
  assert.equal(view.audit[0].reason, toggle().reason);
  assert.equal(view.audit[0].at, at);
  await assert.rejects(lab.admin.setPlanEnabled(toggle({ enabled: true }), adminSession), hasCode('IDEMPOTENCY_CONFLICT'));
});

test('concurrent admin changes with the same expected version have only one winner', async () => {
  const lab = fixture({ authorizationDelay: true });
  const results = await Promise.allSettled([
    lab.admin.setPlanEnabled(toggle(), adminSession),
    lab.admin.setPlanEnabled(toggle({ requestId: 'synthetic:admin-change-2', reason: 'Segunda alteração concorrente' }), adminSession),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'VERSION_CONFLICT');
  assert.equal((await lab.admin.read(adminSession)).audit.length, 1);
});

test('admin cannot enable fees for pending or exempt plans, or write without a reason', async () => {
  const lab = fixture();
  for (const selected of ['synthetic:plan-pending', 'synthetic:plan-exempt', 'synthetic:not-registered']) {
    await assert.rejects(lab.admin.setPlanEnabled(toggle({ planId: selected, enabled: true }), adminSession), hasCode('PLAN_NOT_CONFIRMED_CHARGEABLE'));
  }
  await assert.rejects(lab.admin.setPlanEnabled(toggle({ reason: ' ' }), adminSession), hasCode('CHANGE_REASON_REQUIRED'));
  assert.equal((await lab.admin.read(adminSession)).audit.length, 0);
});

test('pausing tariff affects explicit new cycles and never retroactively releases existing reserve', async () => {
  const lab = fixture(); lab.recordStart(start());
  await lab.admin.setPlanEnabled(toggle(), adminSession);
  const previous = lab.recordStart(start({ requestId: 'synthetic:start-replay-after-policy' }));
  const next = lab.recordStart(start({ cycleId: 'synthetic:cycle-2', requestId: 'synthetic:start-2', startedAt: terminalAt }));
  assert.equal(previous.reservation.reservedCents, 500);
  assert.equal(previous.planAtStart.version, 0);
  assert.equal(next.reservation.status, 'not_required_policy_paused');
  assert.equal(next.planAtStart.version, 1);
  assert.equal(lab.readReservationJournal().length, 1);
});

test('returned views and original registry cannot mutate central reserve or audit', async () => {
  const value = registry(); const lab = fixture({ fixtureRegistry: value });
  value.accounts[0].balanceCents = 1_000_000;
  value.plans[0].enabled = false;
  const cycle = lab.recordStart(start()); cycle.reservation.reservedCents = 0;
  const account = lab.readAccount(accountKey); account.reservedSimulatedCents = 0;
  const journal = lab.readReservationJournal(); journal.pop();
  await lab.admin.setPlanEnabled(toggle(), adminSession);
  const view = await lab.admin.read(adminSession); view.audit[0].actorId = 'synthetic:changed'; view.plans[0].enabled = true;
  assert.equal(lab.readAccount(accountKey).availableSimulatedCents, 1500);
  assert.equal(lab.readReservationJournal().length, 1);
  const fresh = await lab.admin.read(adminSession);
  assert.equal(fresh.audit[0].actorId, 'synthetic:admin-a');
  assert.equal(fresh.plans[0].enabled, false);
});

test('laboratory is sealed to synthetic identities, BRL fixture balance and no wallet-debit fields', () => {
  assert.throws(() => createUltraStartFeeLaboratory({ syntheticOnly: false, fixtureRegistry: registry() }), hasCode('SYNTHETIC_ONLY'));
  const realIdentity = registry(); realIdentity.accounts[0].accountKey = 'real-account';
  assert.throws(() => fixture({ fixtureRegistry: realIdentity }), hasCode('SYNTHETIC_IDENTIFIER_REQUIRED'));
  const wrongCurrency = registry(); wrongCurrency.accounts[0].currency = 'USD';
  assert.throws(() => fixture({ fixtureRegistry: wrongCurrency }), hasCode('SYNTHETIC_BALANCE_CURRENCY_MUST_BE_BRL'));
  const lab = fixture();
  assert.throws(() => lab.recordStart(start({ syntheticOnly: false })), hasCode('SYNTHETIC_ONLY'));
  assert.throws(() => lab.recordStart(start({ walletReadConnected: true })), hasCode('UNEXPECTED_COMMAND_FIELD'));
  assert.throws(() => lab.recordStart(start({ platform: 'kivoryn' })), hasCode('PLATFORM_OUT_OF_SCOPE'));
  assert.equal(lab.realFinanceEnabled, false);
  assert.equal(lab.readAccount(accountKey).walletDebitAuthorized, false);
  assert.equal(lab.capture, undefined);
  assert.equal(lab.refund, undefined);
  assert.equal(lab.debit, undefined);
});
