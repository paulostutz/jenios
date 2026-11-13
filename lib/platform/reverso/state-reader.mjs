import { readReversoAccess } from './access.mjs';
import { emptyReversoState, validateReversoState, available, unavailable, confirmedReversoObligation,
  projectReversoOperation, projectReversoPerformancePeriod, reversoOperationScopeKey, reversoPeriodScopeKey } from './state-contract.mjs';
import { decimal8, format8 } from '../ultra/client/reporting.mjs';
const clone = v => structuredClone(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sum = (...values) => values.some(v => v == null) ? null : format8(values.reduce((n, v) => n + decimal8(v), 0n));
const subtract = (left, right) => left == null || right == null ? null : format8(decimal8(left) - decimal8(right));
const identity = (o, subject) => {
  if (o?.active !== true || o.platform !== 'jenios' || o.subject !== subject || o.robotId !== 'reverso' ||
      !['customerId', 'revision', 'bindingId', 'ownerScope'].every(k => typeof o[k] === 'string' && o[k].length > 0 && o[k].length <= 160)) throw Error('REVERSO_OWNER_BINDING_REQUIRED');
  return Object.fromEntries(['active', 'platform', 'subject', 'robotId', 'customerId', 'revision', 'bindingId', 'ownerScope'].map(k => [k, o[k]]));
};

function financialPeriod(finance, binding, stamp) {
  if (finance?.schema !== 'JENIOS_REVERSO_FINANCIAL_STATE_V1' || finance.platform !== 'jenios' || finance.robotId !== 'reverso' || finance.customerId !== binding.customerId ||
      finance.ownerScope !== binding.ownerScope || finance.environment !== 'demo' || finance.syntheticOnly !== true || finance.evidenceMode !== 'offline_fixture') throw Error('REVERSO_FINANCE_SCOPE_MISMATCH');
  const c = finance.totals, p = finance.period;
  const persistedId = finance.obligations.persistedObligationId ?? null;
  const period = { id: persistedId ?? finance.obligations.proposedIntent.proposedObligationId, obligationId: persistedId, robotId: 'reverso', month: p.month,
    accountId: null, accountIds: finance.perAccount.map(a => a.binding.broker_account_id).sort(), provider: 'multiple', environment: 'demo', currency: finance.currency,
    gains: c.gains, losses: c.losses, fees: c.brokerFees, financing: c.financing, eligiblePlatformCosts: c.eligiblePlatformCosts,
    costs: sum(c.brokerFees, c.financing, c.eligiblePlatformCosts), brokerNet: c.brokerNet, net: subtract(c.brokerNet, c.eligiblePlatformCosts),
    eligibleNet: c.eligibleNet, performanceRate: finance.participation.rateBps === null ? null : finance.participation.rateBps / 100,
    participation: finance.participation.amount, status: finance.assessmentStatus, pendingReasons: finance.assessmentPendingReasons,
    reason: finance.assessmentPendingReasons.length ? 'Apuração pendente de confirmação das condições e fontes.' : null, timeZone: p.timeZone };
  const rows = finance.operations.map(entry => {
    const o = entry.operation;
    if (entry.robotId !== 'reverso' || entry.customerId !== binding.customerId || entry.environment !== 'demo' || entry.origin?.robot !== 'reverso') throw Error('REVERSO_OPERATION_SCOPE_MISMATCH');
    const conflict = o.classification === 'conflict';
    return projectReversoOperation({ id: o.id, robotId: 'reverso', accountId: entry.accountBinding, connectionId: entry.connectionId,
      provider: entry.provider, environment: entry.environment, currency: o.currency, month: p.month,
      symbol: o.symbol, state: conflict ? 'unknown' : o.state, side: o.side, quantity: o.entryQuantity,
      openedAt: o.openedAt, closedAt: conflict ? null : o.closedAt,
      gross: conflict ? null : o.gross, fees: conflict ? null : o.fees, financing: conflict ? null : o.financing,
      net: conflict ? null : o.net, costsComplete: conflict ? false : o.costsComplete }, { mode: 'demo', observedAt: stamp });
  });
  return { period: projectReversoPerformancePeriod(period, { mode: 'demo' }), rows };
}

/** Display adapter over one assessment or an authorized monthly history. Every
 * source row is validated before pagination; months and currencies stay separate. */
export function financialSections(finance, binding, stamp) {
  if (finance?.status === 'unavailable') return {};
  const history = finance?.schema === 'JENIOS_REVERSO_FINANCIAL_HISTORY_V1';
  if (history && (finance.platform !== 'jenios' || finance.robotId !== 'reverso' || finance.customerId !== binding.customerId ||
      finance.ownerScope !== binding.ownerScope || finance.environment !== 'demo' || finance.syntheticOnly !== true || finance.evidenceMode !== 'offline_fixture')) throw Error('REVERSO_FINANCE_SCOPE_MISMATCH');
  const sources = history ? finance.periods : [finance];
  if (!Array.isArray(sources) || sources.length > 120) throw Error('REVERSO_FINANCIAL_HISTORY_LIMIT');
  const projected = sources.map(source => financialPeriod(source, binding, stamp));
  const periods = projected.map(source => source.period);
  const ids = new Set(), scopes = new Set(), operationIds = new Set();
  for (const period of periods) {
    const scope = reversoPeriodScopeKey(period);
    if (ids.has(period.id) || scopes.has(scope)) throw Error('REVERSO_DUPLICATE_FINANCIAL_PERIOD');
    ids.add(period.id); scopes.add(scope);
  }
  periods.sort((a, b) => b.month.localeCompare(a.month) || reversoPeriodScopeKey(a).localeCompare(reversoPeriodScopeKey(b)));
  const rows = projected.flatMap(source => source.rows);
  for (const row of rows) {
    const key = reversoOperationScopeKey(row);
    if (operationIds.has(key)) throw Error('REVERSO_DUPLICATE_FINANCIAL_OPERATION');
    operationIds.add(key);
  }
  const operationTime = row => row.closedAt || row.openedAt ? Date.parse(row.closedAt || row.openedAt) : -Infinity;
  rows.sort((a, b) => b.month.localeCompare(a.month) || operationTime(b) - operationTime(a) || reversoOperationScopeKey(a).localeCompare(reversoOperationScopeKey(b)));
  const section = data => available(data, { mode: 'demo', observedAt: stamp });
  return { operations: section({ rows: rows.slice(0, 200), hasMore: rows.length > 200, costsPending: rows.filter(o => o.state === 'unknown' || o.state === 'closed' && !o.costsComplete).length }),
    performance: section({ periods }), policy: section({ status: 'pending', reason: 'Política e ligação financeira produtivas ainda pendentes.' }) };
}

/** Mount behind the existing trusted runtime resolver. All callbacks are
 * backend sources. letterWallet is the existing createLetterWalletReader
 * instance, never a second wallet or a broker balance adapter. */
export function createReversoOwnerStateReader({ subject, readOwner, readAccessSource, readFinancialState, letterWallet,
  readCycles, readObligations, readObligationBinding, readFinancialSnapshot, walletMode = 'live', now = Date.now, timeoutMs = 5000 } = {}) {
  if (typeof readOwner !== 'function' || !['live', 'demo'].includes(walletMode) || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 10000) throw Error('REVERSO_READER_CONFIGURATION_REQUIRED');
  const snapshotMode = readFinancialSnapshot !== undefined;
  if (snapshotMode && (typeof readFinancialSnapshot !== 'function' || readFinancialState !== undefined || readObligations !== undefined)) throw Error('REVERSO_FINANCIAL_SNAPSHOT_EXCLUSIVE_SOURCE_REQUIRED');
  const bounded = async fn => { let timer; try { return await Promise.race([Promise.resolve().then(fn), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('REVERSO_READ_TIMEOUT')), timeoutMs); })]); } finally { clearTimeout(timer); } };
  return Object.freeze({ async readState() {
    const start = now(), state = emptyReversoState({ subject, now: start }), context = Object.freeze({ platform: 'jenios', subject, robotId: 'reverso' });
    let binding;
    try { binding = identity(clone(await bounded(() => readOwner(context))), subject); } catch { return state; }
    let financialInvalid = false;
    const discardFinancial = reason => { financialInvalid = true; for (const name of ['operations', 'performance', 'obligations', 'policy']) state.sections[name] = unavailable(reason); };
    const readSnapshot = async () => {
      const s = clone(await bounded(() => readFinancialSnapshot(context))), f = s?.financialState, obligations = s?.obligations;
      if (s?.schema !== 'JENIOS_REVERSO_PERSISTED_SNAPSHOT_V1' || s.robotId !== 'reverso' || s.subject !== subject ||
          s.customerId !== binding.customerId || s.ownerScope !== binding.ownerScope || typeof s.revision !== 'string' || !/^[a-f0-9]{64}$/.test(s.revision) ||
          f?.schema !== 'JENIOS_REVERSO_FINANCIAL_HISTORY_V1' || f.platform !== 'jenios' || f.robotId !== 'reverso' ||
          f.customerId !== binding.customerId || f.ownerScope !== binding.ownerScope || f.environment !== 'demo' ||
          f.syntheticOnly !== true || f.evidenceMode !== 'offline_fixture' || !Array.isArray(f.periods) || f.periods.length > 120 ||
          obligations?.robotId !== 'reverso' || obligations.subject !== subject || obligations.customerId !== binding.customerId ||
          obligations.mode !== 'demo' || obligations.status !== 'available' || !Array.isArray(obligations.items)) throw Error('REVERSO_FINANCIAL_SNAPSHOT_SCOPE_MISMATCH');
      return s;
    };
    const results = await Promise.allSettled([
      readReversoAccess({ subject, readSource: readAccessSource ? async request => {
        const source = clone(await readAccessSource(request));
        if (source?.identity?.customerId !== binding.customerId || source.identity.bindingId !== binding.bindingId) throw Error('REVERSO_ACCESS_OWNER_MISMATCH');
        return source;
      } : undefined, now, timeoutMs: Math.min(timeoutMs, 10000) }),
      snapshotMode ? readSnapshot() : readFinancialState ? bounded(() => readFinancialState(context)).then(clone) : null,
      letterWallet?.readWallet ? bounded(() => letterWallet.readWallet({ platform: 'jenios', subject })).then(clone) : null,
      readCycles ? bounded(() => readCycles(context)).then(clone) : null,
      !snapshotMode && readObligations ? bounded(() => readObligations(context)).then(clone) : null,
    ]);
    const value = n => results[n].status === 'fulfilled' ? results[n].value : null;
    const access = value(0);
    if (access && access.status !== 'unavailable') state.sections.entitlement = available(access, { mode: access.mode, observedAt: access.source.observedAt });
    const snapshot = snapshotMode ? value(1) : null, finance = snapshotMode ? snapshot?.financialState : value(1);
    try { if (finance) Object.assign(state.sections, financialSections(finance, binding, new Date(now()).toISOString())); }
    catch (error) { if (!snapshotMode) throw error; discardFinancial('Dados financeiros aguardam uma fonte coerente.'); }
    const wallet = value(2);
    if (wallet) {
      if (wallet.source !== 'letter_private.wallets' || wallet.currency !== 'BRL' || wallet.debitAuthorized !== false) throw Error('REVERSO_WALLET_SOURCE_REQUIRED');
      state.sections.wallet = available({ currency: wallet.currency, balanceMinor: null, availableMinor: wallet.availableMinor,
        pendingMinor: wallet.pendingMinor, reservedMinor: wallet.reservedMinor, suspended: wallet.suspended, debitAuthorized: false }, { mode: walletMode, observedAt: wallet.observedAt });
    }
    for (const [index, name] of [[3, 'cycles'], [4, 'obligations']]) {
      if (name === 'obligations' && financialInvalid) continue;
      const source = name === 'obligations' && snapshotMode ? snapshot?.obligations : value(index); if (!source) continue;
      if (source.robotId !== 'reverso' || source.subject !== subject || source.customerId !== binding.customerId || source.status !== 'available') continue;
      try {
      const data = name === 'obligations' ? await Promise.all(source.items.map(async item => {
        const original = readObligationBinding ? clone(await bounded(() => readObligationBinding({ ...context, obligationId: item.id }))) : null;
        const projected = confirmedReversoObligation(item, { customerId: binding.customerId, binding: original, now: now() });
        if (original && !same(original, clone(await bounded(() => readObligationBinding({ ...context, obligationId: item.id }))))) throw Error('REVERSO_OBLIGATION_BINDING_CHANGED');
        return projected;
      })) : source.items;
      state.sections[name] = available(data, { mode: source.mode, observedAt: source.observedAt });
      } catch (error) { if (!snapshotMode || name !== 'obligations') throw error; discardFinancial('Dados financeiros em atualização concorrente.'); }
    }
    if (snapshotMode) {
      try {
        const currentSnapshot = await readSnapshot();
        if (!snapshot || currentSnapshot.revision !== snapshot.revision) throw Error('REVERSO_FINANCIAL_SNAPSHOT_CHANGED');
      } catch { discardFinancial('Dados financeiros em atualização concorrente.'); }
    }
    const current = identity(clone(await bounded(() => readOwner(context))), subject);
    if (!same(current, binding) || !Number.isFinite(now()) || now() < start) throw Error('REVERSO_OWNER_BINDING_CHANGED');
    state.generatedAt = new Date(now()).toISOString();
    return validateReversoState(state, { subject, now: now() });
  } });
}
