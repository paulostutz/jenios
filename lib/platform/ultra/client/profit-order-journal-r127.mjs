import {createHash} from 'node:crypto';
import {ExecutionLedger} from './execution-ledger.mjs';
import {digest} from './journal.mjs';
import {units12} from '../operation.mjs';
import {selectProfitAccount, profitOrderDraft, profitOrderReference, profitSendReceipt,
  profitCancelDraft, observeProfitOrder} from '../../connections/profit-protocol-r109.mjs';

const fail = code => { throw Object.assign(Error(code), {code}); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ref = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(value)) fail('R127_PROFIT_INVALID_REFERENCE');
  return value;
};
const time = value => {
  if (!Number.isSafeInteger(value) || value <= 0) fail('R127_PROFIT_INVALID_TIME');
  return value;
};
const exact = (value, keys) => {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).some(key => !keys.includes(key))) fail('R127_PROFIT_UNEXPECTED_FIELDS');
};
const finalNative = new Set(['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'PARTIAL_CANCELLED', 'PARTIAL_REJECTED', 'ADMIN_CANCELLED']);

/** Offline correlation only, on the existing ExecutionLedger database.
 * No transport, native DLL, credentials, strategy, financial ledger or submit API.
 * Local receipt != broker acceptance != fill != reconciled Ultra operation.
 */
export class ProfitOrderJournalR127 {
  constructor({ledger, binding, selectedAccount}) {
    exact(binding, ['provider', 'environment', 'account']);
    if (!(ledger instanceof ExecutionLedger) || binding.provider !== 'profit' || binding.environment !== 'demo' ||
        ledger.binding !== digest({account: binding.account, environment: binding.environment, provider: binding.provider})) {
      fail('R127_PROFIT_OFFLINE_ACCOUNT_REQUIRED');
    }
    this.ledger = ledger;
    this.selectedAccount = selectProfitAccount([selectedAccount], selectedAccount);
    this.executionEnvironment = 'offline_fixture';
    ledger.db.exec(`CREATE TABLE IF NOT EXISTS ultra_profit_r127_scope(id INTEGER PRIMARY KEY CHECK(id=1),digest TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ultra_profit_r127_sessions(id TEXT PRIMARY KEY,created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ultra_profit_r127_current(id INTEGER PRIMARY KEY CHECK(id=1),session_id TEXT NOT NULL,owner TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ultra_profit_r127_actions(id TEXT PRIMARY KEY,operation_id TEXT NOT NULL,role TEXT NOT NULL,
        command_id TEXT UNIQUE,target_id TEXT,request_digest TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,updated INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS ultra_profit_r127_entry ON ultra_profit_r127_actions(operation_id) WHERE role='entry';
      CREATE TABLE IF NOT EXISTS ultra_profit_r127_refs(ref_key TEXT PRIMARY KEY,action_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ultra_profit_r127_evidence(id TEXT PRIMARY KEY,action_id TEXT NOT NULL,digest TEXT NOT NULL,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ultra_profit_r127_audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,action_id TEXT NOT NULL,kind TEXT NOT NULL,at INTEGER NOT NULL,payload TEXT NOT NULL);`);
    ledger.transaction(() => {
      const fingerprint = hash({accountBinding: ledger.binding, selectedAccount: this.selectedAccount, executionEnvironment: this.executionEnvironment});
      const old = ledger.db.prepare('SELECT digest FROM ultra_profit_r127_scope WHERE id=1').get();
      if (old && old.digest !== fingerprint) fail('R127_PROFIT_NATIVE_ACCOUNT_CHANGED');
      if (!old) ledger.db.prepare('INSERT INTO ultra_profit_r127_scope VALUES(1,?)').run(fingerprint);
    });
  }
  currentSession() { return this.ledger.db.prepare('SELECT session_id FROM ultra_profit_r127_current WHERE id=1').get()?.session_id ?? null; }
  sessionOwner() { return this.ledger.db.prepare('SELECT owner FROM ultra_profit_r127_current WHERE id=1').get()?.owner ?? null; }
  action(id) {
    const row = this.ledger.db.prepare('SELECT * FROM ultra_profit_r127_actions WHERE id=?').get(id);
    return row ? {...row, ...JSON.parse(row.payload)} : null;
  }
  actions() { return this.ledger.db.prepare('SELECT id FROM ultra_profit_r127_actions ORDER BY rowid').all().map(r => this.action(r.id)); }
  audit() { return this.ledger.db.prepare('SELECT * FROM ultra_profit_r127_audit ORDER BY seq').all().map(r => ({...r, payload: JSON.parse(r.payload)})); }
  event(id, kind, now, payload = {}) {
    this.ledger.db.prepare('INSERT INTO ultra_profit_r127_audit(action_id,kind,at,payload) VALUES(?,?,?,?)').run(id, kind, now, JSON.stringify(payload));
  }
  write(action, payload, state, now) {
    this.ledger.db.prepare('UPDATE ultra_profit_r127_actions SET payload=?,state=?,updated=? WHERE id=?').run(JSON.stringify(payload), state, now, action.id);
  }
  payload(action) { return JSON.parse(action.payload); }
  assertActive(now) {
    time(now); this.ledger.ownsLease();
    const lease = this.ledger.db.prepare('SELECT heartbeat FROM runner WHERE id=1').get();
    if (lease.heartbeat > now || now - lease.heartbeat > 10000) fail('R127_PROFIT_STALE_LEASE');
    if (!this.currentSession() || this.sessionOwner() !== this.ledger.worker) fail('R127_PROFIT_SESSION_REQUIRED');
  }
  unresolved(exceptId = null) {
    return this.actions().some(action => action.id !== exceptId &&
      (['sending', 'local_accepted', 'unknown'].includes(action.state) ||
        action.state === 'observed' && (action.reference.sessionId !== this.currentSession() ||
          action.observation?.normalized.independentReconciliationRequired === true)));
  }
  startSession(sessionId, now) {
    ref(sessionId); time(now);
    return this.ledger.transaction(() => {
      this.ledger.ownsLease();
      if (this.currentSession() === sessionId && this.sessionOwner() === this.ledger.worker) return this.recoveryStatus();
      if (this.ledger.db.prepare('SELECT id FROM ultra_profit_r127_sessions WHERE id=?').get(sessionId)) fail('R127_PROFIT_SESSION_REUSE');
      this.ledger.db.prepare('INSERT INTO ultra_profit_r127_sessions VALUES(?,?)').run(sessionId, now);
      this.ledger.db.prepare('INSERT INTO ultra_profit_r127_current VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET session_id=excluded.session_id,owner=excluded.owner').run(sessionId, this.ledger.worker);
      this.ledger.pause();
      for (const action of this.actions()) {
        if (['not_sent', 'local_rejected'].includes(action.state)) continue;
        const state = action.state === 'prepared' ? 'not_sent' : 'unknown';
        this.write(action, this.payload(action), state, now);
        this.event(action.id, 'session_changed', now, {state, resubmitAllowed: false});
        if (action.role === 'entry' && state === 'not_sent' && this.ledger.order(action.operation_id)?.state === 'prepared') {
          this.ledger.transition(action.operation_id, 'prepared', 'cancelled', {reason: 'NOT_SENT_BEFORE_RECOVERY'}, now);
        }
        if (action.command_id) {
          const command = this.ledger.commands({pending: false}).find(c => c.id === action.command_id);
          if (command?.state === 'prepared') this.ledger.markCommand(command.id, 'prepared', 'cancelled', now);
          else if (command?.state === 'sending') this.ledger.markCommand(command.id, 'sending', 'unknown', now);
        }
      }
      return this.recoveryStatus();
    });
  }
  /** Records the original Ultra intent; never changes or inverts its direction. */
  prepare({operationId, role = 'entry', instrument, order, commandId = null}, now) {
    return this.ledger.transaction(() => {
      this.assertActive(now); ref(operationId);
      const operation = this.ledger.operation(operationId), parent = this.ledger.order(operationId);
      if (!operation || operation.market !== 'b3' || operation.currency !== 'BRL' || !['entry', 'close'].includes(role)) fail('R127_PROFIT_ULTRA_INTENT_REQUIRED');
      if (instrument?.ticker !== operation.symbol || !/^(WIN|WDO)[FGHJKMNQUVXZ]\d{2}$/.test(instrument.ticker) || instrument.exchange !== 'F' || order?.mode !== 'ultrafast') fail('R127_PROFIT_MINI_INSTRUMENT_REQUIRED');
      const entry = role === 'entry', expectedSide = entry ? operation.side : operation.side === 'buy' ? 'sell' : 'buy';
      let closeBasis = null;
      if (order.side !== expectedSide || order.action !== (entry ? 'open' : 'close')) fail('R127_PROFIT_STRATEGY_DIRECTION_MISMATCH');
      if (entry) {
        if (this.unresolved()) fail('R127_PROFIT_ORDER_RECONCILIATION_REQUIRED');
        if (this.ledger.paused() || !['prepared', 'sending'].includes(parent.state) || commandId !== null ||
            order.clientOrderId !== operationId || units12(order.quantity) !== units12(operation.requestedQuantity)) fail('R127_PROFIT_ENTRY_SCOPE_MISMATCH');
        if (order.type !== 'market') {
          const plannedPrice = typeof parent.request.entryPrice === 'number' ? parent.request.entryPrice.toFixed(12) : parent.request.entryPrice;
          if (units12(order.price) !== units12(plannedPrice)) fail('R127_PROFIT_ENTRY_PRICE_MISMATCH');
        }
      } else {
        const command = this.ledger.commands().find(c => c.id === commandId);
        if (!command || command.kind !== 'close' || command.operation_id !== operationId || command.state !== 'prepared' ||
            parent.state !== 'working' || !['open', 'partially_closed'].includes(operation.state) ||
            command.request.operationRevision !== operation.revision ||
            units12(command.request.entryQuantity) !== units12(operation.entryQuantity) ||
            units12(command.request.exitQuantity) !== units12(operation.exitQuantity) ||
            order.clientOrderId !== commandId || units12(order.quantity) !== units12(command.request.quantity) ||
            units12(order.quantity) > units12(operation.entryQuantity) - units12(operation.exitQuantity)) fail('R127_PROFIT_CLOSE_COMMAND_REQUIRED');
        closeBasis = {operationRevision: operation.revision, entryQuantity: operation.entryQuantity,
          exitQuantity: operation.exitQuantity, commandRequestDigest: hash(command.request)};
      }
      const draft = profitOrderDraft({selectedAccount: this.selectedAccount, instrument, order, nowMs: now});
      const payload = {operationId, role, commandId, targetId: null, draft, closeBasis, instrumentSnapshot: {...instrument}, sessionId: this.currentSession(),
        reference: {sessionId: this.currentSession(), localOrderId: null, clOrderId: null},
        expected: {account: this.selectedAccount, ticker: instrument.ticker, exchange: instrument.exchange, side: order.side, quantity: order.quantity},
        localReceipt: null, observation: null};
      return this.insert(payload, now);
    });
  }
  insert(payload, now) {
    const key = hash({operationId: payload.operationId, role: payload.role, commandId: payload.commandId});
    const id = 'profit126_' + key.slice(0, 40), previous = this.action(id), fingerprint = hash(payload);
    if (previous) {
      if (previous.request_digest !== fingerprint) fail('R127_PROFIT_INTENT_CONFLICT');
      return {actionId: id, created: false, canSubmit: false};
    }
    this.ledger.db.prepare('INSERT INTO ultra_profit_r127_actions VALUES(?,?,?,?,?,?,?,?,?)').run(id, payload.operationId, payload.role,
      payload.commandId, payload.targetId, fingerprint, JSON.stringify(payload), 'prepared', now);
    this.event(id, 'intent_recorded', now, {operationId: payload.operationId, role: payload.role, executionEnvironment: 'offline_fixture'});
    return {actionId: id, created: true, canSubmit: false};
  }
  reference(actionId) {
    const action = this.action(actionId), target = action?.role === 'cancel' ? this.action(action.target_id) : action;
    if (!target || ['prepared', 'not_sent', 'local_rejected'].includes(target.state)) fail('R127_PROFIT_SENT_REFERENCE_REQUIRED');
    return profitOrderReference({localOrderId: target.reference.localOrderId, clOrderId: target.reference.clOrderId,
      orderSessionId: target.reference.sessionId, currentSessionId: this.currentSession()});
  }
  /** Cancellation remains addressable while openings are paused. No broad cancel-all. */
  cancelDraft(actionId) {
    const action = this.action(actionId);
    if (!action || action.role !== 'entry') fail('R127_PROFIT_OWNED_ENTRY_REQUIRED');
    this.reference(actionId);
    return profitCancelDraft({selectedAccount: this.selectedAccount, orderAccount: action.expected.account,
      orderReference: {localOrderId: action.reference.localOrderId, clOrderId: action.reference.clOrderId,
        orderSessionId: action.reference.sessionId, currentSessionId: this.currentSession()}});
  }
  prepareCancellation({actionId, commandId}, now) {
    return this.ledger.transaction(() => {
      this.assertActive(now); const target = this.action(actionId), draft = this.cancelDraft(actionId);
      const command = this.ledger.commands().find(c => c.id === commandId);
      if (!command || command.kind !== 'cancel' || command.operation_id !== target.operation_id || command.state !== 'prepared') fail('R127_PROFIT_CANCEL_COMMAND_REQUIRED');
      const payload = {operationId: target.operation_id, role: 'cancel', commandId, targetId: actionId,
        draft, sessionId: this.currentSession(), reference: target.reference, expected: target.expected, localReceipt: null, observation: null};
      return this.insert(payload, now);
    });
  }
  markSending(actionId, now) {
    return this.ledger.transaction(() => {
      this.assertActive(now); const action = this.action(actionId);
      if (!action || action.state !== 'prepared' || action.sessionId !== this.currentSession()) fail('R127_PROFIT_ACTION_NOT_PREPARED');
      if (action.instrumentSnapshot && (action.instrumentSnapshot.observedAtMs > now ||
          now - action.instrumentSnapshot.observedAtMs > 30000 || action.instrumentSnapshot.validUntilMs <= now)) fail('R127_PROFIT_STALE_INSTRUMENT');
      if (action.role === 'entry') {
        if (this.ledger.paused()) fail('R127_PROFIT_ENTRY_PAUSED');
        if (this.unresolved(actionId)) fail('R127_PROFIT_ORDER_RECONCILIATION_REQUIRED');
        const state = this.ledger.order(action.operation_id).state;
        if (state === 'prepared') this.ledger.transition(action.operation_id, 'prepared', 'sending', null, now);
        else if (state !== 'sending') fail('R127_PROFIT_ENTRY_ALREADY_RESOLVED');
      }
      if (action.role === 'close') {
        const operation = this.ledger.operation(action.operation_id), parent = this.ledger.order(action.operation_id);
        const command = this.ledger.commands({pending: false}).find(c => c.id === action.command_id), basis = action.closeBasis;
        if (!operation || !parent || !basis || !command || command.kind !== 'close' || command.state !== 'prepared' ||
            command.operation_id !== action.operation_id || parent.state !== 'working' || !['open', 'partially_closed'].includes(operation.state) ||
            operation.revision !== basis.operationRevision || command.request.operationRevision !== operation.revision ||
            hash(command.request) !== basis.commandRequestDigest ||
            units12(operation.entryQuantity) !== units12(basis.entryQuantity) || units12(operation.exitQuantity) !== units12(basis.exitQuantity) ||
            units12(command.request.quantity) !== units12(action.expected.quantity) ||
            units12(action.expected.quantity) > units12(operation.entryQuantity) - units12(operation.exitQuantity)) fail('R127_PROFIT_CLOSE_RECONCILIATION_REQUIRED');
        const remaining = units12(operation.entryQuantity) - units12(operation.exitQuantity);
        if (units12(action.expected.quantity) === remaining && units12(operation.entryQuantity) < units12(operation.requestedQuantity) &&
            parent.receipt?.entryRemainderCancelled !== true) fail('R127_PROFIT_CLOSE_RECONCILIATION_REQUIRED');
      }
      if (action.command_id) this.ledger.markCommand(action.command_id, 'prepared', 'sending', now);
      this.write(action, this.payload(action), 'sending', now);
      this.event(actionId, 'fixture_attempt_recorded', now, {nativeValidated: false, realOrdersSent: 0});
      return this.result(this.action(actionId));
    });
  }
  bindReference(actionId, reference) {
    const refs = [];
    if (reference.localOrderId && reference.localOrderId !== '0') refs.push('local:' + reference.sessionId + ':' + reference.localOrderId);
    if (reference.clOrderId) refs.push('broker:' + reference.clOrderId);
    for (const key of refs) {
      const previous = this.ledger.db.prepare('SELECT action_id FROM ultra_profit_r127_refs WHERE ref_key=?').get(key);
      if (previous && previous.action_id !== actionId) fail('R127_PROFIT_ORDER_ALREADY_BOUND');
      this.ledger.db.prepare('INSERT OR IGNORE INTO ultra_profit_r127_refs VALUES(?,?)').run(key, actionId);
    }
  }
  recordLocalReceipt(actionId, value, now) {
    return this.ledger.transaction(() => {
      this.assertActive(now); const action = this.action(actionId);
      if (!action || action.sessionId !== this.currentSession()) fail('R127_PROFIT_SESSION_MISMATCH');
      let receipt = profitSendReceipt(value);
      if (action.role === 'cancel' && receipt.code === '0') receipt = {...receipt, state: 'LOCAL_ACCEPTED'};
      if (action.role === 'cancel' && receipt.localOrderId !== null) fail('R127_PROFIT_INVALID_CANCEL_RETURN');
      if (action.localReceipt !== null) {
        if (hash(action.localReceipt) !== hash(receipt)) fail('R127_PROFIT_LOCAL_RECEIPT_CHANGED');
        return {...this.result(action), duplicate: true};
      }
      if (action.state !== 'sending') fail('R127_PROFIT_UNSENT_RECEIPT');
      const payload = this.payload(action), state = {LOCAL_ACCEPTED: 'local_accepted', LOCAL_REJECTED: 'local_rejected', UNKNOWN: 'unknown'}[receipt.state];
      payload.localReceipt = receipt;
      if (action.role !== 'cancel' && receipt.localOrderId !== null) {
        payload.reference = {...payload.reference, localOrderId: receipt.localOrderId};
        this.bindReference(actionId, payload.reference);
      }
      this.write(action, payload, state, now); this.event(actionId, 'local_receipt', now, receipt);
      if (state !== 'local_accepted') this.ledger.pause();
      return this.result(this.action(actionId));
    });
  }
  /** A caller supplies fixture GetOrderDetails data, never a callback guessed as a fill. */
  observeOrderDetails(actionId, {evidenceId, observation, source = 'offline_fixture_query'}, now) {
    return this.ledger.transaction(() => {
      this.assertActive(now); ref(evidenceId);
      if (source !== 'offline_fixture_query') fail('R127_PROFIT_NATIVE_EVIDENCE_NOT_RELEASED');
      const action = this.action(actionId);
      if (!action || ['prepared', 'not_sent', 'local_rejected'].includes(action.state)) fail('R127_PROFIT_UNSENT_OBSERVATION');
      const original = {actionId, observation, source}, fingerprint = hash(original);
      const previous = this.ledger.db.prepare('SELECT digest FROM ultra_profit_r127_evidence WHERE id=?').get(evidenceId);
      if (previous) {
        if (previous.digest !== fingerprint) fail('R127_PROFIT_EVIDENCE_CHANGED');
        return {...this.result(action), duplicate: true};
      }
      const target = action.role === 'cancel' ? this.action(action.target_id) : action;
      if (observation?.sessionId !== this.currentSession()) fail('R127_PROFIT_SESSION_MISMATCH');
      if (target.observation && observation.observedAtMs < target.observation.observedAtMs) fail('R127_PROFIT_OLD_OBSERVATION');
      const normalized = observeProfitOrder({expected: {...target.expected, ...target.reference,
        knownFilledQuantity: target.observation?.normalized.cumulativeFilledQuantity ?? '0'}, observation, nowMs: now});
      const old = target.observation?.normalized;
      if (old && finalNative.has(old.state) && (old.state !== normalized.state || old.cumulativeFilledQuantity !== normalized.cumulativeFilledQuantity)) fail('R127_PROFIT_TERMINAL_ORDER_CHANGED');
      const payload = this.payload(target);
      payload.reference = {sessionId: normalized.sessionId, localOrderId: normalized.localOrderId, clOrderId: normalized.clOrderId};
      this.bindReference(target.id, payload.reference);
      payload.observation = {source, evidenceId, observedAtMs: observation.observedAtMs, normalized};
      this.write(target, payload, 'observed', now);
      if (target.id !== action.id) this.write(action, {...this.payload(action), reference: payload.reference, observation: payload.observation}, 'observed', now);
      this.ledger.db.prepare('INSERT INTO ultra_profit_r127_evidence VALUES(?,?,?,?)').run(evidenceId, actionId, fingerprint, JSON.stringify(original));
      this.event(actionId, 'details_observed', now, {targetId: target.id, ...payload.observation});
      // Price, execution timestamps, full position and protection are absent in R109.
      // They cannot become an OperationLedger receipt or a final financial result.
      this.ledger.pause();
      return this.result(this.action(actionId));
    });
  }
  result(action) {
    return {actionId: action.id, operationId: action.operation_id, state: action.state,
      localAccepted: action.localReceipt?.state === 'LOCAL_ACCEPTED', observation: action.observation,
      executionEnvironment: 'offline_fixture', nativeValidated: false, realOrdersSent: 0,
      canSubmit: false, automaticResubmitAllowed: false, positionReconciliationRequired: true,
      financialReceiptReady: false, operationCompleted: false};
  }
  recoveryStatus() {
    return {sessionId: this.currentSession(), executionEnvironment: 'offline_fixture', canSubmit: false,
      automaticResubmitAllowed: false, nativeValidated: false, realOrdersSent: 0,
      actions: this.actions().map(action => ({...this.result(action),
        requiresFreshQuery: !['not_sent', 'local_rejected'].includes(action.state) &&
          (action.state !== 'observed' || action.reference.sessionId !== this.currentSession() ||
            action.observation?.normalized.independentReconciliationRequired === true),
        permanentOrderReferenceKnown: action.reference.clOrderId !== null}))};
  }
}
