import {ULTRA_START_FEE_UM001} from '../fees-um001.mjs';
import {digest} from './journal.mjs';

const fail = code => { throw Object.assign(Error(code), {code}); };
const copy = value => JSON.parse(JSON.stringify(value));
const synthetic = value => typeof value === 'string' && /^synthetic:[A-Za-z0-9:_-]{1,160}$/.test(value);
const token = value => typeof value === 'string' && /^[-A-Za-z0-9_.:]{1,160}$/.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const terminal = phase => ['paused', 'ended'].includes(phase);
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const same = (a, b, keys) => object(a) && object(b) && keys.every(key => a[key] === b[key]);
const fixtureKeys = ['registrationId', 'clientId', 'ownerScope', 'evidenceMode'];
const cycleKeys = ['accountKey', 'ownerKey', 'cycleId'];
const identityKeys = ['customer_id', 'billing_account_id', 'environment'];
const authorityInstance = value => typeof value === 'string' && /^letter-lab-r129:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const schema = 'JENIOS_ULTRA_START_CYCLE_BRIDGE_R129';

function freeze(value) {
  if (object(value) || Array.isArray(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/** Local correlation/outbox only; UM001 owns the reservation. Authorities are
 * synchronous, injected offline fixtures. No browser approval, cached balance,
 * returned Promise or real adapter grants an opening. */
export class UltraStartCycleBridgeR129 {
  #authority; #performance; #fixture; #fee; #runtime; #binding; #key; #performanceKey; #performanceScope;
  #verifiedDecision = null; #lastGate = null;

  constructor({fixtureBinding, startFee, performanceAuthority}) {
    if (!object(fixtureBinding) || fixtureBinding.evidenceMode !== 'offline_fixture' ||
        !fixtureKeys.slice(0, 3).every(key => token(fixtureBinding[key]))) fail('R129_FIXTURE_BINDING_REQUIRED');
    if (!object(startFee) || !['authorityId', 'accountKey', 'ownerKey', 'cycleId', 'requestId'].every(key => synthetic(startFee[key]))) fail('R129_SYNTHETIC_CYCLE_BINDING_REQUIRED');
    if (startFee.ownerKey !== fixtureBinding.ownerScope) fail('R129_CYCLE_OWNER_FIXTURE_MISMATCH');
    const authority = startFee.authority;
    if (authority?.schema !== ULTRA_START_FEE_UM001.schema || authority.syntheticOnly !== true || authority.realFinanceEnabled !== false ||
        !['recordStart', 'reconnect', 'closeCycle', 'readAccount'].every(key => typeof authority[key] === 'function')) fail('R129_UM001_FIXTURE_AUTHORITY_REQUIRED');
    if (typeof performanceAuthority !== 'function') fail('R129_PERFORMANCE_AUTHORITY_REQUIRED');
    this.#authority = authority; this.#performance = performanceAuthority;
    this.#fixture = freeze(Object.fromEntries(fixtureKeys.map(key => [key, fixtureBinding[key]])));
    this.#fee = freeze(Object.fromEntries(['authorityId', 'accountKey', 'ownerKey', 'cycleId', 'requestId'].map(key => [key, startFee[key]])));
  }

  attachRuntime({ledger, session, now, sessionId, ownerScope, connectionScope, platform}) {
    if (this.#runtime) fail('R129_BRIDGE_ALREADY_ATTACHED');
    if (this.#fixture.ownerScope !== ownerScope || ledger.recordContext?.ownerScope !== ownerScope ||
        ledger.recordContext?.sessionId !== sessionId || ledger.recordContext?.connectionId !== connectionScope ||
        !['jenios', 'flow'].includes(platform)) fail('R129_RUNTIME_FIXTURE_SCOPE_MISMATCH');
    this.#runtime = {ledger, session, now, sessionId, platform};
    this.#binding = freeze({fixtureBinding: this.#fixture, ...this.#fee, sessionId, ownerScope, connectionScope, accountBinding: ledger.binding});
    this.#key = 'ultra_start_cycle_r129:' + sessionId;
    this.#performanceScope = digest({fixtureBinding: this.#fixture, accountBinding: ledger.binding});
    this.#performanceKey = 'ultra_performance_authority_r129:' + this.#performanceScope;
    this.#saved();
  }

  #saved() {
    if (!this.#runtime) fail('R129_BRIDGE_NOT_ATTACHED');
    const saved = this.#runtime.ledger.transport(this.#key);
    if (saved && (saved.schema !== schema || saved.bindingDigest !== digest(this.#binding) || digest(saved.binding) !== saved.bindingDigest)) fail('R129_PERSISTED_CYCLE_BINDING_MISMATCH');
    const session = this.#runtime.session();
    if (saved && (!session || session.startedAtMs !== saved.startedAtMs)) fail('R129_SESSION_START_MISMATCH');
    return saved;
  }

  #control() {
    this.#runtime.ledger.ownsLease();
    const session = this.#runtime.session();
    if (!session?.attached) fail('SESSION_RESUME_REQUIRED');
    return session;
  }

  #save(value) {
    this.#control(); this.#runtime.ledger.saveTransport(this.#key, value); return value;
  }

  #call(method, argument) {
    this.#control();
    const result = this.#authority[method](argument);
    if (result && typeof result.then === 'function') {
      // Consume rejection only; no eventual result may write behind its controller.
      Promise.resolve(result).catch(() => {});
      fail('R129_SYNCHRONOUS_FIXTURE_AUTHORITY_REQUIRED');
    }
    this.#control(); this.#runtime.now();
    return result;
  }

  #decision(cycle, saved) {
    const reservation = cycle?.reservation, plan = cycle?.planAtStart;
    const now = this.#runtime.now();
    if (!object(cycle) || cycle.syntheticOnly !== true || cycle.realFinanceEnabled !== false || cycle.walletDebitAuthorized !== false ||
        cycle.robotExecutionConfirmed !== false || !same(cycle, this.#fee, cycleKeys) ||
        cycle.startedAt !== new Date(saved.startedAtMs).toISOString() || !time(cycle.recordedAt) || Date.parse(cycle.recordedAt) > now ||
        !['start_recorded', 'paused', 'ended'].includes(cycle.phase) ||
        (cycle.phase === 'start_recorded' ? cycle.terminalAt !== null : !time(cycle.terminalAt) || Date.parse(cycle.terminalAt) < saved.startedAtMs || Date.parse(cycle.terminalAt) > now) ||
        !object(reservation) || reservation.key !== this.reservationKey() || reservation.currency !== 'BRL' || reservation.feeCents !== 500 ||
        !object(plan) || plan.planId !== cycle.planId || !synthetic(cycle.planId)) fail('R129_START_AUTHORITY_PROOF_INVALID');
    const rules = {
      reserved_simulated: ['ready_simulated', 500, 'chargeable', true],
      not_required_exempt: ['ready_simulated', 0, 'exempt', null],
      not_required_policy_paused: ['ready_simulated', 0, 'chargeable', false],
      pending_plan_definition: ['pending', 0, 'pending', null],
      pending_activation_definition: ['pending', 0, 'chargeable', null],
      pending_simulated_balance: ['pending', 0, 'chargeable', true],
      insufficient_simulated_balance: ['blocked_simulated', 0, 'chargeable', true],
    };
    const rule = rules[reservation.status];
    if (!rule || cycle.preparationStatus !== rule[0] || reservation.reservedCents !== rule[1] || plan.eligibility !== rule[2] || plan.enabled !== rule[3] ||
        reservation.settlement !== (rule[1] ? 'pending_capture_or_release_policy' : 'not_applicable') ||
        (plan.eligibility !== 'pending' && (!synthetic(plan.evidenceRef) || !Number.isSafeInteger(plan.version) || plan.version < 0))) fail('R129_START_AUTHORITY_PROOF_INVALID');
    return digest({accountKey: cycle.accountKey, ownerKey: cycle.ownerKey, cycleId: cycle.cycleId, startedAt: cycle.startedAt,
      planAtStart: plan, reservation, preparationStatus: cycle.preparationStatus});
  }

  #accept(cycle) {
    const saved = this.#saved(), decisionDigest = this.#decision(cycle, saved);
    if (saved.decisionDigest && saved.decisionDigest !== decisionDigest) fail('R129_IMMUTABLE_START_DECISION_CHANGED');
    if (terminal(saved.cycle?.phase) && (cycle.phase !== saved.cycle.phase || cycle.terminalAt !== saved.cycle.terminalAt)) fail('R129_TERMINAL_CYCLE_CHANGED');
    const terminalIntent = saved.terminalIntent && terminal(cycle.phase)
      ? {...saved.terminalIntent, status: cycle.phase === saved.terminalIntent.phase && cycle.terminalAt === saved.terminalIntent.at ? 'confirmed' : 'first_authoritative_terminal_preserved'}
      : saved.terminalIntent;
    this.#save({...saved, authorityState: 'confirmed', cycle: copy(cycle), decisionDigest, terminalIntent, lastError: null, confirmedAtMs: this.#runtime.now()});
    this.#verifiedDecision = decisionDigest;
  }

  #unknown(error) {
    this.#verifiedDecision = null;
    const saved = this.#saved();
    this.#save({...saved, authorityState: 'unknown', lastError: typeof error?.code === 'string' ? error.code : typeof error?.message === 'string' ? error.message : 'R129_AUTHORITY_UNAVAILABLE'});
  }

  #sendInitial() {
    let saved = this.#saved();
    if (saved.startAttempted) fail('R129_START_ALREADY_ATTEMPTED');
    const account = this.#call('readAccount', this.#fee.accountKey);
    if (account?.syntheticOnly !== true || account.realFinanceEnabled !== false || account.walletDebitAuthorized !== false ||
        account.accountKey !== this.#fee.accountKey || account.ownerKey !== this.#fee.ownerKey || account.currency !== 'BRL' ||
        account.balanceAuthority !== 'synthetic-fixture-only' || account.actualPlatformWalletBalanceCents !== null) fail('R129_START_ACCOUNT_AUTHORITY_MISMATCH');
    // This durable marker precedes the sole possible dispatch. Recovery queries
    // the authority after uncertainty; it cannot manufacture a second Start.
    saved = this.#save({...saved, startAttempted: true, authorityState: 'awaiting_authority', lastError: null});
    this.#accept(this.#call('recordStart', {syntheticOnly: true, accountKey: this.#fee.accountKey, cycleId: this.#fee.cycleId,
      requestId: this.#fee.requestId, platform: this.#runtime.platform, startedAt: new Date(saved.startedAtMs).toISOString(), intent: 'explicit_new_cycle'}));
  }

  startNewCycle() {
    const session = this.#control();
    if (this.#saved()) return this.reconcile();
    this.#save({schema, binding: this.#binding, bindingDigest: digest(this.#binding), startedAtMs: session.startedAtMs,
      firstPlatform: this.#runtime.platform, startAttempted: false, authorityState: 'awaiting_authority',
      cycle: null, decisionDigest: null, terminalIntent: null, performanceIdentity: null, lastError: null,
      evidenceMode: 'offline_fixture', realFinanceEnabled: false, walletDebitAuthorized: false});
    try { this.#sendInitial(); } catch (error) { this.#unknown(error); }
    return this.snapshot();
  }

  reconcile() {
    this.#control();
    const saved = this.#saved();
    if (!saved) return this.snapshot(); // Never retroactively bill an inherited session.
    this.#verifiedDecision = null;
    try {
      try {
        this.#accept(this.#call('reconnect', {syntheticOnly: true, accountKey: this.#fee.accountKey, cycleId: this.#fee.cycleId, platform: this.#runtime.platform}));
      } catch (error) {
        if (error?.code === 'UNKNOWN_CYCLE' && !this.#saved().startAttempted) this.#sendInitial();
        else throw error;
      }
      const current = this.#saved();
      if (current.terminalIntent && current.cycle.phase === 'start_recorded') {
        this.#save({...current, terminalIntent: {...current.terminalIntent, status: 'awaiting_authority'}});
        this.#accept(this.#call('closeCycle', {syntheticOnly: true, accountKey: this.#fee.accountKey, cycleId: this.#fee.cycleId,
          requestId: current.terminalIntent.requestId, phase: current.terminalIntent.phase, at: current.terminalIntent.at}));
      }
    } catch (error) { this.#unknown(error); }
    return this.snapshot();
  }

  noteTerminal(phase) {
    if (!terminal(phase)) fail('R129_INVALID_TERMINAL_INTENT');
    this.#control();
    const saved = this.#saved();
    if (!saved || saved.terminalIntent || terminal(saved.cycle?.phase)) return this.snapshot();
    const at = new Date(this.#runtime.now()).toISOString();
    const requestId = 'synthetic:r129:terminal:' + digest({accountKey: this.#fee.accountKey, cycleId: this.#fee.cycleId, phase, at});
    this.#save({...saved, terminalIntent: {phase, at, requestId, status: 'prepared'}});
    return this.reconcile();
  }

  reservationKey() { return 'ultra.start_fee.um001:' + JSON.stringify([this.#fee.accountKey, this.#fee.cycleId]); }
  cycleBinding() { return copy(Object.fromEntries(cycleKeys.map(key => [key, this.#fee[key]]))); }

  snapshot() {
    const saved = this.#saved();
    return freeze({schema: 'JENIOS_ULTRA_START_PREPARATION_R129', fixtureBinding: copy(this.#fixture), cycleBinding: this.cycleBinding(),
      authorityId: this.#fee.authorityId, reservationKey: this.reservationKey(), sessionId: this.#runtime.sessionId,
      startedAtMs: saved?.startedAtMs ?? null, startAttempted: saved?.startAttempted ?? false,
      authorityState: saved ? (saved.authorityState === 'confirmed' && !this.#verifiedDecision ? 'unverified' : saved.authorityState) : 'unattributed',
      preparationStatus: saved?.cycle?.preparationStatus ?? 'awaiting_authority',
      startReady: Boolean(saved?.authorityState === 'confirmed' && saved.decisionDigest === this.#verifiedDecision && saved.cycle?.preparationStatus === 'ready_simulated'),
      cycle: saved?.cycle ? copy(saved.cycle) : null, terminalIntent: saved?.terminalIntent ? copy(saved.terminalIntent) : null,
      lastError: saved?.lastError ?? (saved ? null : 'R129_EXISTING_SESSION_START_UNATTRIBUTED'),
      performanceGate: this.#lastGate ? copy(this.#lastGate) : {allowed: false, reason: 'not_checked'},
      evidenceMode: 'offline_fixture', syntheticOnly: true, realFinanceEnabled: false, walletDebitAuthorized: false,
      nativeValidated: false, liveExecutionEnabled: false, externalPaperEnabled: false, billingEnabled: false});
  }

  #openingControl() {
    const session = this.#control(), now = this.#runtime.now();
    if (session.phase !== 'active' || this.#runtime.ledger.paused()) fail('SESSION_OPENINGS_PAUSED');
    if (now >= session.expiresAtMs) fail('SESSION_DURATION_ELAPSED');
    return now;
  }

  #gate(stage, request) {
    this.#openingControl();
    const deny = reason => (this.#lastGate = {allowed: false, reason, stage, observedAtMs: this.#runtime.now()});
    if (!this.snapshot().startReady) return deny('R129_START_PREPARATION_UNCONFIRMED');
    let proof;
    try {
      proof = this.#performance({fixtureBinding: copy(this.#fixture), cycleBinding: this.cycleBinding(), sessionId: this.#runtime.sessionId, stage, request: copy(request)});
      if (proof && typeof proof.then === 'function') { Promise.resolve(proof).catch(() => {}); return deny('R129_SYNCHRONOUS_PERFORMANCE_AUTHORITY_REQUIRED'); }
    } catch { this.#openingControl(); return deny('R129_PERFORMANCE_AUTHORITY_UNAVAILABLE'); }
    const now = this.#openingControl();
    if (!object(proof) || proof.schema !== 'JENIOS_ULTRA_PERFORMANCE_AUTHORITY_R129' || proof.source !== 'letter.monthly.r129' || proof.evidenceMode !== 'offline_fixture' ||
        !same(proof.fixtureBinding, this.#fixture, fixtureKeys) || !same(proof.cycleBinding, this.#fee, cycleKeys) ||
        !object(proof.gateIdentity) || !identityKeys.every(key => token(proof.gateIdentity[key])) || proof.gateIdentity.environment !== 'demo' ||
        proof.gateIdentity.customer_id !== this.#fixture.clientId || proof.gateIdentity.billing_account_id !== this.#fee.accountKey || !authorityInstance(proof.authorityInstanceId) ||
        !Number.isSafeInteger(proof.observedAtMs) || proof.observedAtMs > now || now - proof.observedAtMs > 5000 ||
        proof.gate?.synthetic_only !== true || proof.gate.actual_execution_authorized !== false ||
        typeof proof.gate.allowed_in_simulation !== 'boolean' || !Array.isArray(proof.gate.blocked_obligations) || typeof proof.gate.reason !== 'string') return deny('R129_PERFORMANCE_AUTHORITY_PROOF_INVALID');
    const identity = {...Object.fromEntries(identityKeys.map(key => [key, proof.gateIdentity[key]])), authorityInstanceId: proof.authorityInstanceId}, saved = this.#saved();
    const globalPin = this.#runtime.ledger.transport(this.#performanceKey);
    if (globalPin && (globalPin.schema !== 'JENIOS_ULTRA_PERFORMANCE_AUTHORITY_PIN_R129' || globalPin.scopeDigest !== this.#performanceScope || !object(globalPin.identity))) return deny('R129_PERFORMANCE_AUTHORITY_PIN_UNVERIFIED');
    for (const pinned of [globalPin?.identity, saved.performanceIdentity].filter(Boolean)) {
      if (pinned.authorityInstanceId !== identity.authorityInstanceId) return deny('R129_PERFORMANCE_AUTHORITY_INSTANCE_CHANGED');
      if (!same(pinned, identity, identityKeys)) return deny('R129_PERFORMANCE_AUTHORITY_IDENTITY_CHANGED');
    }
    if (!globalPin) {
      this.#control();
      this.#runtime.ledger.saveTransport(this.#performanceKey, {schema: 'JENIOS_ULTRA_PERFORMANCE_AUTHORITY_PIN_R129',
        scopeDigest: this.#performanceScope, identity, pinnedAtMs: now, evidenceMode: 'offline_fixture', financialActivationAllowed: false});
    }
    if (!saved.performanceIdentity) this.#save({...saved, performanceIdentity: identity});
    if (proof.gate.allowed_in_simulation !== true || proof.gate.blocked_obligations.length !== 0) return deny('R129_PERFORMANCE_OPENINGS_BLOCKED');
    this.#openingControl();
    return this.#lastGate = {allowed: true, reason: proof.gate.reason, stage, observedAtMs: proof.observedAtMs, source: proof.source, authorityInstanceId: proof.authorityInstanceId};
  }

  #withhold(request, reason) {
    const ledger = this.#runtime.ledger;
    this.#control();
    const {clientOrderId, ...originalRequest} = request;
    const order = ledger.order(clientOrderId), operation = ledger.operation(clientOrderId);
    if (!order || order.state !== 'sending' || order.receipt !== null || digest(order.request) !== digest(originalRequest) ||
        !operation || Number(operation.entryQuantity) !== 0 || Number(operation.exitQuantity) !== 0) fail('R129_UNSENT_INTENT_UNVERIFIED');
    // No submit has been invoked: this cancels a local intention, not a broker order.
    ledger.transition(clientOrderId, 'sending', 'cancelled', {reason: 'R129_OPENING_WITHHELD_BEFORE_DISPATCH', gateReason: reason,
      brokerSubmissionAttempted: false, evidenceMode: 'offline_fixture'}, this.#runtime.now());
  }

  guardAdapter(adapter) {
    const bridge = this;
    return new Proxy(adapter, {get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof value !== 'function') return value;
      if (key === 'preflight') return async request => {
        const gate = bridge.#gate('preflight', request);
        if (!gate.allowed) return {allowed: false, protectionSupported: false, reason: gate.reason};
        return value.call(target, request);
      };
      if (key === 'submitProtected') return async request => {
        const gate = bridge.#gate('submitProtected', request);
        if (!gate.allowed) { bridge.#withhold(request, gate.reason); fail('R129_OPENING_GATE_BLOCKED'); }
        return value.call(target, request);
      };
      return value.bind(target);
    }});
  }
}
