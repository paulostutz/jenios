/**
 * UM001 — preparation only. A single in-memory, synthetic fixture store.
 * No network, wallet, broker, payment, persistence, capture or refund adapter.
 * The same instance must serve both platform fixtures to prove deduplication.
 */
export const ULTRA_START_FEE_UM001 = Object.freeze({
  schema: 'ultra.start_fee.um001',
  syntheticOnly: true,
  currency: 'BRL',
  amountCents: 500,
  realFinanceEnabled: false,
  managePermission: 'ultra.start_fee.manage',
  readPermission: 'ultra.start_fee.read',
});

export class StartFeePreparationError extends Error {
  constructor(code) { super(code); this.name = 'StartFeePreparationError'; this.code = code; }
}

const fail = code => { throw new StartFeePreparationError(code); };
const copy = value => JSON.parse(JSON.stringify(value));
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const validId = value => typeof value === 'string' && /^synthetic:[a-zA-Z0-9:_-]{1,160}$/.test(value);
const assertId = value => { if (!validId(value)) fail('SYNTHETIC_IDENTIFIER_REQUIRED'); return value; };
const assertSynthetic = value => { if (value?.syntheticOnly !== true) fail('SYNTHETIC_ONLY'); };
const version = value => { if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_VERSION'); return value; };
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) fail('INVALID_TIMESTAMP');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) fail('INVALID_TIMESTAMP');
  return date.toISOString();
}
function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_COMMAND');
  if (Object.keys(value).some(key => !allowed.includes(key))) fail('UNEXPECTED_COMMAND_FIELD');
  assertSynthetic(value);
}
const cycleKey = (accountKey, cycleId) => JSON.stringify([accountKey, cycleId]);
const eventKey = (action, accountKey, requestId) => JSON.stringify([action, accountKey, requestId]);
const reservationKey = (accountKey, cycleId) => `ultra.start_fee.um001:${cycleKey(accountKey, cycleId)}`;

/**
 * fixtureRegistry is supplied by a trusted test harness, never by a browser.
 * All identities must use the synthetic: prefix. Missing plan classification
 * is pending, never an inferred exemption or a chargeable plan.
 */
export function createUltraStartFeeLaboratory({
  syntheticOnly,
  fixtureRegistry,
  authorizeAdmin = async () => ({ allowed: false }),
  now = () => new Date().toISOString(),
} = {}) {
  assertSynthetic({ syntheticOnly });
  assertSynthetic(fixtureRegistry);
  if (!Array.isArray(fixtureRegistry.plans) || !Array.isArray(fixtureRegistry.accounts)) fail('INVALID_FIXTURE_REGISTRY');
  if (typeof authorizeAdmin !== 'function' || typeof now !== 'function') fail('INVALID_HARNESS');
  const plans = new Map(), accounts = new Map(), cycles = new Map(), events = new Map();
  const reservations = [], adminAudit = [], adminRequests = new Map();

  for (const raw of fixtureRegistry.plans) {
    assertSynthetic(raw);
    const planId = assertId(raw.planId);
    if (plans.has(planId)) fail('DUPLICATE_PLAN');
    if (!['chargeable', 'exempt', 'pending'].includes(raw.eligibility)) fail('INVALID_PLAN_CLASSIFICATION');
    if (raw.eligibility !== 'pending' && !validId(raw.evidenceRef)) fail('PLAN_EVIDENCE_REQUIRED');
    if (raw.enabled !== undefined && typeof raw.enabled !== 'boolean') fail('INVALID_ACTIVATION');
    plans.set(planId, {
      planId, label: typeof raw.label === 'string' ? raw.label.slice(0, 120) : planId,
      eligibility: raw.eligibility, evidenceRef: raw.evidenceRef ?? null,
      enabled: raw.eligibility === 'chargeable' ? (raw.enabled ?? null) : null,
      version: 0,
    });
  }
  for (const raw of fixtureRegistry.accounts) {
    assertSynthetic(raw);
    const accountKey = assertId(raw.accountKey);
    if (accounts.has(accountKey)) fail('DUPLICATE_ACCOUNT');
    if (raw.currency !== 'BRL') fail('SYNTHETIC_BALANCE_CURRENCY_MUST_BE_BRL');
    if (raw.balanceCents !== null && (!Number.isSafeInteger(raw.balanceCents) || raw.balanceCents < 0)) fail('INVALID_SIMULATED_BALANCE');
    accounts.set(accountKey, {
      accountKey, ownerKey: assertId(raw.ownerKey), planId: assertId(raw.planId),
      currency: 'BRL', simulatedBalanceCents: raw.balanceCents,
      reservedSimulatedCents: 0, version: 0,
    });
  }

  function accountFor(accountKey) {
    assertId(accountKey);
    const account = accounts.get(accountKey);
    if (!account) fail('UNKNOWN_SYNTHETIC_ACCOUNT');
    return account;
  }
  function getCycle(accountKey, cycleId) {
    accountFor(accountKey); assertId(cycleId);
    const cycle = cycles.get(cycleKey(accountKey, cycleId));
    if (!cycle) fail('UNKNOWN_CYCLE');
    return cycle;
  }
  function available(account) {
    return account.simulatedBalanceCents === null ? null : account.simulatedBalanceCents - account.reservedSimulatedCents;
  }
  function readAccount(accountKey) {
    const account = accountFor(accountKey);
    return copy({
      ...account, syntheticOnly: true, realFinanceEnabled: false,
      availableSimulatedCents: available(account),
      balanceAuthority: 'synthetic-fixture-only',
      actualPlatformWalletBalanceCents: null,
      walletDebitAuthorized: false,
    });
  }
  function cycleView(cycle) {
    return copy({ ...cycle, syntheticOnly: true, robotExecutionConfirmed: false, realFinanceEnabled: false });
  }
  function replay(key, fingerprint) {
    const previous = events.get(key);
    if (!previous) return null;
    if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT');
    return cycleView(cycles.get(previous.cycleKey));
  }

  function recordStart(command) {
    fields(command, ['syntheticOnly', 'accountKey', 'cycleId', 'requestId', 'platform', 'startedAt', 'intent']);
    const { accountKey, cycleId, requestId, platform } = command;
    const account = accountFor(accountKey); assertId(cycleId); assertId(requestId);
    if (!['flow', 'jenios'].includes(platform)) fail('PLATFORM_OUT_OF_SCOPE');
    if (command.intent !== 'explicit_new_cycle') fail('EXPLICIT_NEW_CYCLE_REQUIRED');
    const startedAt = timestamp(command.startedAt);
    const key = cycleKey(accountKey, cycleId);
    // The platform is deliberately excluded: both products share one fee.
    const fingerprint = JSON.stringify([accountKey, cycleId, startedAt, command.intent]);
    const requestKey = eventKey('start', accountKey, requestId);
    const repeated = replay(requestKey, fingerprint);
    if (repeated) return repeated;
    const existing = cycles.get(key);
    if (existing) {
      if (existing.startedAt !== startedAt) fail('CYCLE_IDENTITY_CONFLICT');
      events.set(requestKey, { fingerprint, cycleKey: key });
      return cycleView(existing);
    }

    const plan = plans.get(account.planId);
    let reservationStatus = 'pending_plan_definition';
    let preparationStatus = 'pending';
    let reservedCents = 0;
    if (plan?.eligibility === 'exempt') {
      reservationStatus = 'not_required_exempt'; preparationStatus = 'ready_simulated';
    } else if (plan?.eligibility === 'chargeable') {
      if (plan.enabled === null) reservationStatus = 'pending_activation_definition';
      else if (plan.enabled === false) {
        reservationStatus = 'not_required_policy_paused'; preparationStatus = 'ready_simulated';
      } else if (available(account) === null) reservationStatus = 'pending_simulated_balance';
      else if (available(account) < ULTRA_START_FEE_UM001.amountCents) {
        reservationStatus = 'insufficient_simulated_balance'; preparationStatus = 'blocked_simulated';
      } else {
        reservationStatus = 'reserved_simulated'; preparationStatus = 'ready_simulated';
        reservedCents = ULTRA_START_FEE_UM001.amountCents;
      }
    }
    const recordedAt = timestamp(now());
    const cycle = {
      accountKey, ownerKey: account.ownerKey, cycleId, firstPlatform: platform,
      planId: account.planId, startedAt, recordedAt, phase: 'start_recorded',
      terminalAt: null, tradeIds: [],
      planAtStart: plan ? copy(plan) : { planId: account.planId, eligibility: 'pending', version: null, enabled: null },
      reservation: {
        key: reservationKey(accountKey, cycleId), currency: 'BRL',
        feeCents: ULTRA_START_FEE_UM001.amountCents, reservedCents, status: reservationStatus,
        settlement: reservedCents ? 'pending_capture_or_release_policy' : 'not_applicable',
      },
      preparationStatus,
      walletDebitAuthorized: false, resumePolicy: 'pending',
    };
    // This synchronous section is atomic only within this one JS instance.
    // A persistent Letter transaction/unique constraint is still required.
    cycles.set(key, cycle);
    events.set(requestKey, { fingerprint, cycleKey: key });
    account.version += 1;
    if (reservedCents) {
      account.reservedSimulatedCents += reservedCents;
      reservations.push({
        syntheticOnly: true, key: cycle.reservation.key, accountKey, cycleId,
        currency: 'BRL', amountCents: reservedCents, kind: 'reserve_simulated', recordedAt,
      });
    }
    return cycleView(cycle);
  }

  function observeSyntheticTrade(command) {
    fields(command, ['syntheticOnly', 'accountKey', 'cycleId', 'tradeId']);
    const cycle = getCycle(command.accountKey, command.cycleId);
    assertId(command.tradeId);
    if (cycle.tradeIds.includes(command.tradeId)) return cycleView(cycle);
    if (cycle.phase !== 'start_recorded') fail('CYCLE_ALREADY_TERMINAL');
    cycle.tradeIds.push(command.tradeId);
    return cycleView(cycle);
  }

  function reconnect(command) {
    fields(command, ['syntheticOnly', 'accountKey', 'cycleId', 'platform']);
    if (!['flow', 'jenios'].includes(command.platform)) fail('PLATFORM_OUT_OF_SCOPE');
    return cycleView(getCycle(command.accountKey, command.cycleId));
  }

  function closeCycle(command) {
    fields(command, ['syntheticOnly', 'accountKey', 'cycleId', 'requestId', 'phase', 'at']);
    const cycle = getCycle(command.accountKey, command.cycleId);
    assertId(command.requestId);
    if (!['paused', 'ended'].includes(command.phase)) fail('INVALID_TERMINAL_PHASE');
    const at = timestamp(command.at);
    if (at < cycle.startedAt) fail('TERMINAL_PRECEDES_START');
    const key = cycleKey(command.accountKey, command.cycleId);
    const fingerprint = JSON.stringify([key, command.phase, at]);
    const requestKey = eventKey('close', command.accountKey, command.requestId);
    const repeated = replay(requestKey, fingerprint);
    if (repeated) return repeated;
    if (cycle.phase !== 'start_recorded') {
      if (cycle.phase !== command.phase || cycle.terminalAt !== at) fail('CYCLE_ALREADY_TERMINAL');
    } else {
      cycle.phase = command.phase;
      cycle.terminalAt = at;
      // Pause/end does not infer capture, release, refund or a new cycle.
    }
    events.set(requestKey, { fingerprint, cycleKey: key });
    return cycleView(cycle);
  }

  async function requirePermission(context, permission) {
    const identity = await authorizeAdmin(context, { platform: 'flow', permission, syntheticOnly: true });
    if (identity?.allowed !== true || identity.syntheticOnly !== true || identity.assurance !== 'synthetic-server-session' || !validId(identity.actorId)) fail('ADMIN_PERMISSION_REQUIRED');
    return identity.actorId;
  }
  function administrativeView(canManage) {
    return {
      schema: 'ultra.start_fee.admin.um001', syntheticOnly: true, realFinanceEnabled: false,
      currency: 'BRL', amountCents: ULTRA_START_FEE_UM001.amountCents,
      canManage, plans: [...plans.values()].map(copy),
      unclassifiedAccountPlanIds: [...new Set([...accounts.values()].map(account => account.planId).filter(id => !plans.has(id)))],
      audit: adminAudit.map(copy),
    };
  }
  async function readAdmin(context) {
    await requirePermission(context, ULTRA_START_FEE_UM001.readPermission);
    let canManage = false;
    try { await requirePermission(context, ULTRA_START_FEE_UM001.managePermission); canManage = true; }
    catch (error) { if (error?.code !== 'ADMIN_PERMISSION_REQUIRED') throw error; }
    return administrativeView(canManage);
  }
  async function setPlanEnabled(command, context) {
    fields(command, ['syntheticOnly', 'planId', 'enabled', 'expectedVersion', 'requestId', 'reason']);
    assertId(command.planId); assertId(command.requestId); version(command.expectedVersion);
    if (typeof command.enabled !== 'boolean') fail('INVALID_ACTIVATION');
    if (typeof command.reason !== 'string' || !command.reason.trim() || command.reason.length > 300) fail('CHANGE_REASON_REQUIRED');
    const actorId = await requirePermission(context, ULTRA_START_FEE_UM001.managePermission);
    const fingerprint = JSON.stringify([actorId, command.planId, command.enabled, command.expectedVersion, command.reason.trim()]);
    const previous = adminRequests.get(command.requestId);
    if (previous) {
      if (previous.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT');
      return copy(previous.result);
    }
    const plan = plans.get(command.planId);
    if (!plan || plan.eligibility !== 'chargeable') fail('PLAN_NOT_CONFIRMED_CHARGEABLE');
    // Authorization has completed. Recheck the version immediately before write.
    if (plan.version !== command.expectedVersion) fail('VERSION_CONFLICT');
    if (plan.enabled === command.enabled) {
      const result = { syntheticOnly: true, changed: false, plan: copy(plan), audit: null };
      adminRequests.set(command.requestId, { fingerprint, result });
      return copy(result);
    }
    const before = { enabled: plan.enabled, version: plan.version };
    const after = { enabled: command.enabled, version: plan.version + 1 };
    const entry = {
      syntheticOnly: true, sequence: adminAudit.length + 1,
      requestId: command.requestId, actorId, permission: ULTRA_START_FEE_UM001.managePermission,
      planId: plan.planId, at: timestamp(now()), before, after, reason: command.reason.trim(),
    };
    Object.assign(plan, after);
    adminAudit.push(entry);
    const result = { syntheticOnly: true, changed: true, plan: copy(plan), audit: copy(entry) };
    adminRequests.set(command.requestId, { fingerprint, result });
    return copy(result);
  }

  return Object.freeze({
    schema: ULTRA_START_FEE_UM001.schema, syntheticOnly: true, realFinanceEnabled: false,
    recordStart, observeSyntheticTrade, reconnect, closeCycle, readAccount,
    readReservationJournal: () => copy(reservations),
    admin: Object.freeze({ read: readAdmin, setPlanEnabled }),
  });
}
