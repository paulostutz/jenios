import {UltraExecutionRuntime} from './execution-runtime.mjs';
import {normalizeUltraConfig} from '../policy-r125.mjs';
import {ultraInstrumentScopeR125} from '../scope-r125.mjs';

const fail = code => { throw Error(code); };
const key = 'ultra_runtime_readiness_r127';
const fresh = (value, now) => Number.isSafeInteger(value) && value > 0 && value <= now && now - value <= 5000;
const token = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value);
const fingerprint = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sameState = (a, b) => a.generation === b.generation && a.revision === b.revision;

function validateScope(scope, config, market) {
  if (!scope || Object.keys(scope).sort().join(',') !== 'accountFingerprint,environment,product,provider' ||
      scope.environment !== 'demo' || !fingerprint(scope.accountFingerprint)) fail('R127_OFFLINE_DEMO_SCOPE_REQUIRED');
  const selected = config.markets.find(item => item.id === market);
  if (!selected || selected.provider !== scope.provider ||
      market === 'crypto' && (scope.provider !== 'binance' || !['spot', 'usds_m_futures'].includes(scope.product)) ||
      market === 'b3' && (!['profit', 'mt5'].includes(scope.provider) || scope.product !== 'b3_mini')) fail('R127_ROUTE_SCOPE_MISMATCH');
  return Object.freeze({...scope});
}

/** Current-scope checks around R118. Strategy, sizing and order lifecycle are inherited. */
export class UltraExecutionRuntimeR127 extends UltraExecutionRuntime {
  constructor({config, market, ledger, adapter, scope, now = Date.now, onWarning = async () => false}) {
    const selected = normalizeUltraConfig(config);
    const verifiedScope = validateScope(scope, selected, market);
    if (adapter?.executionEnvironment !== 'offline_fixture' || typeof adapter.runtimeState !== 'function') fail('R127_OFFLINE_RUNTIME_STATE_REQUIRED');
    const previousScope = ledger.transport(key)?.scope;
    if (previousScope && Object.keys(verifiedScope).some(field => previousScope[field] !== verifiedScope[field])) fail('R127_PERSISTED_SCOPE_MISMATCH');
    if (ledger.recordScope && (ledger.recordScope.accountBinding !== ledger.binding || ledger.recordScope.environment !== 'demo' ||
        ledger.recordScope.provider !== verifiedScope.provider || ledger.recordScope.product !== (verifiedScope.product === 'b3_mini' ? 'b3' : verifiedScope.product))) fail('R127_RECORD_SCOPE_MISMATCH');
    const guard = {scope: verifiedScope, current: null, starting: false, started: false, ledger, raw: adapter, now, market};
    const persist = (status, reason, state = null) => {
      ledger.ownsLease();
      ledger.saveTransport(key, {
        schema: 'JENIOS_ULTRA_RUNTIME_READINESS_R127', status, reason,
        accountBinding: ledger.binding, scope: verifiedScope,
        generation: state?.generation ?? null, revision: state?.revision ?? null,
        observedAtMs: now(), nativeValidated: false, liveExecutionAllowed: false,
        externalPaperAllowed: false, evidenceMode: 'offline_fixture'
      });
    };
    guard.block = reason => {
      guard.current = null;
      try { ledger.ownsLease(); ledger.pause(); persist('needs_reconciliation', reason); } catch {}
    };
    guard.validateIdentity = value => {
      if (!value || value.accountBinding !== ledger.binding ||
          ['provider', 'environment', 'product', 'accountFingerprint'].some(field => value[field] !== verifiedScope[field]) ||
          value.connected !== true || !token(value.generation) || !token(value.revision) || !fresh(value.observedAtMs, now())) fail('R127_RUNTIME_IDENTITY_OR_FRESHNESS_UNVERIFIED');
      return {generation: value.generation, revision: value.revision, observedAtMs: value.observedAtMs};
    };
    guard.validateState = value => {
      const identity = guard.validateIdentity(value);
      if (['connected', 'tradingAllowed', 'streamSynchronized', 'ordersComplete', 'positionsComplete', 'fillsComplete']
          .some(field => value[field] !== true) || !Array.isArray(value.unresolvedReferences) || value.unresolvedReferences.length) fail('R127_ACCOUNT_RECONCILIATION_REQUIRED');
      return identity;
    };
    guard.state = async expected => {
      const state = guard.validateState(await adapter.runtimeState());
      if (expected && !sameState(expected, state)) fail('R127_RUNTIME_STATE_CHANGED');
      return state;
    };
    guard.capture = async () => {
      const before = await guard.state();
      const account = await adapter.account();
      const after = await guard.state(before);
      if (!account || account.accountBinding !== ledger.binding || account.accountCurrency !== selected.markets.find(item => item.id === market).currency ||
          ['provider', 'environment', 'product', 'accountFingerprint'].some(field => account[field] !== verifiedScope[field]) ||
          account.connectionGeneration !== before.generation || account.stateRevision !== before.revision ||
          account.reconciled !== true || !fresh(account.observedAtMs, now()) ||
          ['freeMargin', 'realizedLossToday', 'openLoss'].some(field => !Number.isFinite(account[field]) || account[field] < 0)) fail('R127_ACCOUNT_SNAPSHOT_UNVERIFIED');
      guard.current = after;
      persist('locally_reconciled', 'synthetic_account_snapshot', after);
      return account;
    };
    const instrumentAllowed = observation => {
      const instrument = observation.instrument;
      const eligibility = ultraInstrumentScopeR125(observation, now());
      return observation.market === market && eligibility.allowed && instrument?.tradingEnabled === true &&
        Number.isFinite(observation.bid) && Number.isFinite(observation.ask) && observation.bid > 0 && observation.ask >= observation.bid &&
        instrument.accountFingerprint === verifiedScope.accountFingerprint &&
        instrument.provider === verifiedScope.provider && instrument.environment === verifiedScope.environment &&
        (market !== 'crypto' || instrument.eligibility?.accountFingerprint === verifiedScope.accountFingerprint &&
          instrument.eligibility.product === verifiedScope.product);
    };
    const guarded = {
      executionEnvironment: 'offline_fixture',
      async inspect() {
        await guard.state();
        const ready = await adapter.inspect();
        if (ready?.tradingAllowed !== true) fail('R127_TRADING_PERMISSION_REQUIRED');
        return ready;
      },
      account: () => guard.capture(),
      async observations() {
        const expected = guard.current;
        if (!expected) fail('R127_ACCOUNT_RECONCILIATION_REQUIRED');
        const rows = await adapter.observations();
        await guard.state(expected);
        if (!Array.isArray(rows) || rows.length > 1000 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) fail('R127_OBSERVATIONS_INVALID');
        // Preserve all rows so the inherited duplicate-symbol guard still runs.
        return rows.map(row => instrumentAllowed(row) ? row : {...row, marketOpen: false, instrumentRulesVerified: false});
      },
      async preflight(request) {
        if (!guard.current) fail('R127_ACCOUNT_RECONCILIATION_REQUIRED');
        const before = await guard.state(guard.current);
        const result = await adapter.preflight(request);
        await guard.state(before);
        return result;
      },
      async submitProtected(request) {
        if (!guard.current) fail('R127_ACCOUNT_RECONCILIATION_REQUIRED');
        await guard.state(guard.current);
        ledger.ownsLease();
        if (ledger.paused()) fail('R127_OPENINGS_PAUSED');
        if (!fresh(guard.current.observedAtMs, now()) || !Number.isSafeInteger(request.observedAtMs) ||
            request.observedAtMs > now() || now() - request.observedAtMs > 1000) fail('R127_ORDER_SNAPSHOT_EXPIRED');
        return adapter.submitProtected(request);
      }
    };
    // Reductions do not depend on permission for new openings. A fresh identity
    // check is still required before dispatch, not merely after a receipt arrives.
    for (const method of ['lookup', 'lookupCommand', 'collectReceipts', 'protectExisting', 'cancelRemainder', 'closeOwned']) {
      if (typeof adapter[method] !== 'function') fail('R127_ADAPTER_INTERFACE_INCOMPLETE');
      guarded[method] = ['protectExisting', 'cancelRemainder', 'closeOwned'].includes(method)
        ? async (...args) => { guard.validateIdentity(await adapter.runtimeState()); ledger.ownsLease(); return adapter[method](...args); }
        : (...args) => adapter[method](...args);
    }
    super({config: {...selected, markets: selected.markets.map(({provider, ...item}) => item)}, market, ledger, adapter: guarded, now, onWarning});
    this.scope = verifiedScope;
    this.guard = guard;
    this.fixtureOnly = true;
  }
  async start(options = {}) {
    if (this.busy || this.guard.starting) fail('RUNTIME_BUSY');
    this.guard.starting = true;
    this.guard.started = false;
    this.guard.current = null;
    try { const result = await super.start(options); this.guard.started = true; return result; }
    catch (error) { this.guard.block('startup_requires_reconciliation'); throw error; }
    finally { this.guard.starting = false; }
  }
  async reconcile() {
    await super.reconcile();
    // Resume requires a complete account snapshot after the durable lookups.
    if (this.guard.starting) await this.guard.capture();
  }
  async tick() {
    if (this.guard.starting) return {state: 'busy'};
    if (!this.guard.started) return {state: 'startup_required', positionsManaged: false};
    try {
      const result = await super.tick();
      if (['reconciliation_required', 'protection_unconfirmed'].includes(result.state)) this.guard.block(result.state);
      return result;
    } catch (error) { this.guard.block('runtime_state_unverified'); throw error; }
  }
  readiness() {
    const saved = this.ledger.transport(key);
    if (saved) return this.guard.started ? saved : {...saved, status: 'needs_reconciliation', reason: 'startup_required'};
    return {
      schema: 'JENIOS_ULTRA_RUNTIME_READINESS_R127', status: 'needs_reconciliation', reason: 'not_started',
      nativeValidated: false, liveExecutionAllowed: false, externalPaperAllowed: false, evidenceMode: 'offline_fixture'
    };
  }
}
