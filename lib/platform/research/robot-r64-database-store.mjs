/** R64 — dedicated-Platform RPC adapter. No client wallet, live order or provider call.
 * Receipts must first come from the authenticated intake; inspection of a stored
 * receipt checks its structure/digest and never grants new source authority.
 */
import { canonicalR64Json, digestR64Value, inspectR64TelemetryReceipt } from './robot-r64-telemetry.mjs';

export const R64_DATABASE_RPCS = Object.freeze({
  ingestReceipt: 'jenios_robot_r64_ingest',
  readReceipts: 'jenios_robot_r64_read_receipts',
  claimCycle: 'jenios_robot_r64_claim_cycle',
  readCycle: 'jenios_robot_r64_read_cycle',
  reserveAndDispatch: 'jenios_robot_r64_reserve_dispatch',
  completeCycle: 'jenios_robot_r64_complete_cycle',
  readReports: 'jenios_robot_r64_read_reports',
  readAnalystPolicy: 'jenios_robot_r64_analyst_policy',
});
export const R64_DATABASE_LIMITS = Object.freeze({ receipts: 5000, inputBytes: 1048576,
  reportBytes: 262144, resultBytes: 65536, reports: 30, leaseSeconds: 60,
  maxInputTokens: 8000, maxOutputTokens: 700 });
const fail = code => { throw Object.assign(new Error(code), { code }); };
const SCOPE = /^scope:[a-f0-9]{16}$/;
const HEX = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PERIOD = /^r64:daily:[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const MODEL = /^[A-Za-z0-9._:-]{1,80}$/;
const integer = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && v >= min && v <= max;
const record = value => value && typeof value === 'object' && !Array.isArray(value);
function snapshot(input, bytes = R64_DATABASE_LIMITS.inputBytes) {
  const text = canonicalR64Json(input);
  if (Buffer.byteLength(text, 'utf8') > bytes) fail('R64_DATABASE_INPUT_LIMIT');
  return JSON.parse(text);
}
function scope(value) { if (typeof value !== 'string' || !SCOPE.test(value)) fail('R64_DATABASE_SCOPE'); return value; }
function periodKey(value) {
  if (typeof value !== 'string' || !PERIOD.test(value)) fail('R64_DATABASE_PERIOD');
  const date = value.slice(-10), ms = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) fail('R64_DATABASE_PERIOD');
  return value;
}
function lease(input) {
  if (!UUID.test(input.cycleId || '') || !UUID.test(input.leaseOwner || '') || !integer(input.leaseGeneration, 1))
    fail('R64_DATABASE_LEASE');
}
function inputSnapshot(input, ownerScope, key) {
  const copy = snapshot(input);
  if (!record(copy) || copy.schema !== 'JENIOS_R64_OPERATIONAL_CYCLE_INPUT_V1' ||
      copy.evidenceKind !== 'SIGNED_QA_REPLAY' || copy.scopeId !== ownerScope || copy.periodKey !== key)
    fail('R64_DATABASE_CYCLE_INPUT');
  return copy;
}
export function hashR64CycleInput(input) { return digestR64Value(input); }
export function inspectR64StoredReport(input, expectedScope, expectedPeriod) {
  const report = snapshot(input, R64_DATABASE_LIMITS.reportBytes);
  if (!record(report) || report.schema !== 'JENIOS_R64_OPERATIONAL_REPORT_V1' ||
      report.evidenceKind !== 'SIGNED_QA_REPLAY' || report.scopeId !== expectedScope ||
      report.periodKey !== expectedPeriod || report.actualBrokerPnl !== null ||
      report.actualLossesAvoided !== null || report.realTradeAccuracy !== null ||
      report.realOrdersSent !== 0 || report.externalPaperOrdersSent !== 0 ||
      report.productionMonitoringStarted !== false) fail('R64_DATABASE_REPORT');
  return report;
}
function inspectResult(input) {
  const result = snapshot(input, R64_DATABASE_LIMITS.resultBytes);
  if (!record(result) || !['not_generated', 'usage_confirmed', 'unknown'].includes(result.kind) ||
      result.retryAllowed !== false || result.mayPromote !== false ||
      !integer(result.httpRequests, 0, 2) || !integer(result.inferenceRequests, 0, 1))
    fail('R64_DATABASE_ANALYSIS_RESULT');
  if (result.kind === 'usage_confirmed') {
    if (!integer(result.costNanoUsd) || !record(result.usage) || !MODEL.test(result.model || '') ||
        !HEX.test(result.fingerprint || '') || !MODEL.test(result.pricingVersion || '') ||
        typeof result.providerResponseId !== 'string' || !/^resp_[A-Za-z0-9_-]{1,160}$/.test(result.providerResponseId) ||
        result.inferenceRequests !== 1) fail('R64_DATABASE_ANALYSIS_RESULT');
  } else if (result.costNanoUsd !== null) fail('R64_DATABASE_ANALYSIS_RESULT');
  if (result.kind === 'not_generated' && (result.providerResponseId !== null || result.usage !== null))
    fail('R64_DATABASE_ANALYSIS_RESULT');
  if (result.kind === 'unknown' && !(result.providerResponseId === null ||
      typeof result.providerResponseId === 'string' && /^resp_[A-Za-z0-9_-]{1,160}$/.test(result.providerResponseId)))
    fail('R64_DATABASE_ANALYSIS_RESULT');
  if (result.kind === 'not_generated' && result.inferenceRequests !== 0) fail('R64_DATABASE_ANALYSIS_RESULT');
  return result;
}

export function createR64DatabaseStore({ db } = {}) {
  if (!db || typeof db.rpc !== 'function') fail('R64_DATABASE_CLIENT_REQUIRED');
  async function rpc(method, p_input, allowNull = false) {
    const safe = snapshot(p_input);
    let response;
    try { response = await db.rpc(R64_DATABASE_RPCS[method], { p_input: safe }); }
    catch { fail('R64_DATABASE_UNAVAILABLE'); }
    if (response?.error) {
      const code = typeof response.error.message === 'string' && response.error.message.match(/^(R64_[A-Z0-9_]{1,80})$/)?.[1];
      fail(code || 'R64_DATABASE_UNAVAILABLE');
    }
    if (!response || !Object.hasOwn(response, 'data') || response.data === null && !allowNull) fail('R64_DATABASE_RESPONSE');
    return response.data;
  }
  return Object.freeze({
    async ingestReceipt({ receipt } = {}) {
      const safe = inspectR64TelemetryReceipt(receipt);
      const data = snapshot(await rpc('ingestReceipt', { receipt: safe }));
      if (!record(data) || !['STORED', 'ALREADY_STORED'].includes(data.status) || data.eventId !== safe.eventId ||
          data.scopeId !== safe.scopeId) fail('R64_DATABASE_RESPONSE');
      return Object.freeze(data);
    },
    async readReceipts({ scopeId, period } = {}) {
      scope(scopeId); const p = snapshot(period);
      if (!record(p) || Object.keys(p).length !== 2 || !integer(p.startMs) || !integer(p.endMs, 1) ||
          p.endMs <= p.startMs || p.endMs - p.startMs > 86400000) fail('R64_DATABASE_PERIOD');
      const data = await rpc('readReceipts', { scopeId, period: p });
      if (!Array.isArray(data) || data.length > R64_DATABASE_LIMITS.receipts) fail('R64_DATABASE_RECEIPT_OVERFLOW');
      const rows = data.map(inspectR64TelemetryReceipt);
      if (rows.some(r => r.scopeId !== scopeId || r.event.occurredAtMs < p.startMs || r.event.occurredAtMs >= p.endMs) ||
          new Set(rows.map(r => r.eventId)).size !== rows.length) fail('R64_DATABASE_RESPONSE');
      return Object.freeze(rows);
    },
    async claimCycle({ scopeId, periodKey: key, inputDigest, input } = {}) {
      scope(scopeId); periodKey(key); const safe = inputSnapshot(input, scopeId, key);
      if (!HEX.test(inputDigest || '') || inputDigest !== hashR64CycleInput(safe)) fail('R64_DATABASE_INPUT_DIGEST');
      const data = snapshot(await rpc('claimCycle', { scopeId, periodKey: key, inputDigest, input: safe }));
      if (!record(data) || !['CLAIMED', 'BUSY', 'COMPLETED', 'NEEDS_RECONCILIATION'].includes(data.status) ||
          !UUID.test(data.cycleId || '')) fail('R64_DATABASE_RESPONSE');
      if (data.status === 'CLAIMED') {
        lease(data);
        const frozen = inputSnapshot(data.input, scopeId, key);
        if (hashR64CycleInput(frozen) !== inputDigest) fail('R64_DATABASE_RESPONSE');
      }
      return Object.freeze(data);
    },
    async readCycle({ scopeId, periodKey: key } = {}) {
      scope(scopeId); periodKey(key);
      const response = await rpc('readCycle', { scopeId, periodKey: key }, true);
      if (response === null) return null;
      const data = snapshot(response);
      if (!record(data) || !UUID.test(data.cycleId || '') || data.scopeId !== scopeId || data.periodKey !== key ||
          !['CLAIMED', 'DISPATCHED', 'COMPLETED', 'NEEDS_RECONCILIATION'].includes(data.status) ||
          !integer(data.leaseGeneration, 1) || !integer(data.leaseUntilMs, 1) || Object.hasOwn(data, 'leaseOwner'))
        fail('R64_DATABASE_RESPONSE');
      data.input = inputSnapshot(data.input, scopeId, key);
      if (hashR64CycleInput(data.input) !== data.inputDigest) fail('R64_DATABASE_RESPONSE');
      if (data.report !== null) data.report = inspectR64StoredReport(data.report, scopeId, key);
      return Object.freeze(data);
    },
    async reserveAndDispatch(args) {
      const safe = snapshot(args); lease(safe); const r = safe.request;
      if (!record(r) || Object.keys(r).some(k => !['fingerprint', 'model', 'pricingVersion', 'reservationNanoUsd', 'maxInputTokens', 'maxOutputTokens'].includes(k)) ||
          !HEX.test(r.fingerprint || '') || !MODEL.test(r.model || '') || !MODEL.test(r.pricingVersion || '') ||
          !integer(r.reservationNanoUsd, 1, 1000000000) || r.maxInputTokens !== 8000 || r.maxOutputTokens !== 700)
        fail('R64_DATABASE_RESERVATION');
      const data = snapshot(await rpc('reserveAndDispatch', safe));
      if (!record(data) || typeof data.dispatchGranted !== 'boolean' || !/^[A-Z_]{1,80}$/.test(data.reason || ''))
        fail('R64_DATABASE_RESPONSE');
      return Object.freeze(data);
    },
    async completeCycle(args) {
      const safe = snapshot(args); lease(safe);
      const report = safe.report;
      scope(report?.scopeId); periodKey(report?.periodKey);
      safe.report = inspectR64StoredReport(report, report.scopeId, report.periodKey);
      safe.result = inspectResult(safe.result);
      const data = snapshot(await rpc('completeCycle', safe));
      if (!record(data) || !['COMPLETED', 'NEEDS_RECONCILIATION'].includes(data.status) ||
          data.cycleId !== safe.cycleId || typeof data.replayed !== 'boolean') fail('R64_DATABASE_RESPONSE');
      data.report = inspectR64StoredReport(data.report, report.scopeId, report.periodKey);
      return Object.freeze(data);
    },
    async markDispatchUnknown(args) {
      const safe = snapshot(args);
      if (safe.result?.kind !== 'unknown') fail('R64_DATABASE_ANALYSIS_RESULT');
      return this.completeCycle(safe);
    },
    async readReports({ scopeId, limit = 30 } = {}) {
      scope(scopeId); if (!integer(limit, 1, 30)) fail('R64_DATABASE_REPORT_LIMIT');
      const data = await rpc('readReports', { scopeId, limit });
      if (!Array.isArray(data) || data.length > limit) fail('R64_DATABASE_RESPONSE');
      return Object.freeze(data.map(row => {
        const safe = snapshot(row, R64_DATABASE_LIMITS.reportBytes + 4096);
        if (!UUID.test(safe.cycleId || '') || safe.scopeId !== scopeId || !['COMPLETED', 'NEEDS_RECONCILIATION'].includes(safe.status))
          fail('R64_DATABASE_RESPONSE');
        periodKey(safe.periodKey);
        if (safe.report !== null) safe.report = inspectR64StoredReport(safe.report, scopeId, safe.periodKey);
        else if (safe.status !== 'NEEDS_RECONCILIATION') fail('R64_DATABASE_RESPONSE');
        if (Object.keys(safe).some(k => !['cycleId', 'scopeId', 'periodKey', 'status', 'report'].includes(k))) fail('R64_DATABASE_RESPONSE');
        return Object.freeze(safe);
      }));
    },
    async readAnalystPolicy() {
      const data = snapshot(await rpc('readAnalystPolicy', {}));
      const keys = ['generationEnabled', 'requiresReconciliation', 'allowedModels', 'pricingVersion', 'pricingApproved',
        'ratesVerifiedAt', 'maxRequestProviderNanoUsd', 'monthlyProviderLimitNanoUsd'];
      if (!record(data) || Object.keys(data).length !== keys.length || Object.keys(data).some(k => !keys.includes(k)) ||
          !['generationEnabled', 'requiresReconciliation', 'pricingApproved'].every(k => typeof data[k] === 'boolean') ||
          !Array.isArray(data.allowedModels) || data.allowedModels.length > 16 || data.allowedModels.some(m => !MODEL.test(m)) ||
          !(data.pricingVersion === null || MODEL.test(data.pricingVersion)) ||
          !(data.ratesVerifiedAt === null || typeof data.ratesVerifiedAt === 'string' && Number.isFinite(Date.parse(data.ratesVerifiedAt))) ||
          !integer(data.maxRequestProviderNanoUsd, 0, 1000000000) || !integer(data.monthlyProviderLimitNanoUsd, 0, 1000000000000))
        fail('R64_DATABASE_RESPONSE');
      return Object.freeze(data);
    },
  });
}
