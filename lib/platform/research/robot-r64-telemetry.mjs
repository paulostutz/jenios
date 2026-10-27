/**
 * R64 — signed QA replay admission and observation-only study.
 * A configured collector signature authenticates this export under a pinned key;
 * it does not attest broker activity, customer identity/consent or profitability.
 * No transport, storage write, R63 evolution, order or deployment occurs here.
 */
import { createHash, createPublicKey, verify } from 'node:crypto';
import { scheduleR63AdminReport } from './robot-r63-admin-report.mjs';

export const R64_TELEMETRY_DOMAIN = 'JENIOS_R64_SIGNED_QA_TELEMETRY_V1\0';
export const R64_TELEMETRY_LIMITS = Object.freeze({ maxReceipts: 5000, maxEvidenceEvents: 48,
  maxEnvelopeAgeMs: 120000, maxReplayAgeMs: 86400000, maxMarketAgeMs: 60000 });
export const R64_TELEMETRY_ROBOTS = Object.freeze(['manual', 'hybrid', 'reverse', 'ultrafast']);
export const R64_TELEMETRY_ISSUES = Object.freeze(['NONE', 'STALE_CONTEXT', 'SEQUENCE_GAP',
  'CONNECTION_FAILURE', 'CONTROL_VIOLATION']);
const PAYLOAD_SCHEMA = 'JENIOS_R64_SIGNED_QA_TELEMETRY_V1';
const RECEIPT_SCHEMA = 'JENIOS_R64_TELEMETRY_ADMISSION_V1';
const STUDY_SCHEMA = 'JENIOS_R64_TELEMETRY_STUDY_V1';
const EVIDENCE = 'SIGNED_QA_REPLAY';
const PAYLOAD_KEYS = ['schema', 'evidenceKind', 'scopeId', 'sourceId', 'sessionId', 'eventId',
  'sequence', 'expiresAtMs', 'event'];
const RECEIPT_KEYS = ['schema', 'evidenceKind', 'scopeId', 'sourceId', 'sessionId', 'eventId',
  'sequence', 'payloadDigest', 'admittedAtMs', 'expiresAtMs', 'event', 'proof'];
const EVENT_KEYS = ['policyVersion', 'robot', 'kind', 'decision', 'issue', 'marketAgeMs',
  'occurredAtMs', 'capturedAtMs'];
const STUDY_KEYS = ['schema', 'evidenceKind', 'scopeId', 'period', 'periodKey', 'generatedAtMs',
  'receiptCount', 'sourceCount', 'sessionCount', 'inputDigest', 'metrics', 'evidenceEvents',
  'evidenceSelection', 'findings', 'automaticPromotionAllowed', 'executionAllowed',
  'realOrdersSent', 'externalPaperOrdersSent', 'actualBrokerPnl', 'actualLossesAvoided',
  'realTradeAccuracy', 'independentBrokerAttestation', 'independentCustomerConsentVerified'];
const PROOF_KEYS = ['configuredSourceSignatureVerified', 'configuredSourceKeySha256',
  'independentBrokerAttestation', 'independentCustomerConsentVerified'];
const METRIC_KEYS = ['eventCount', 'decisionCount', 'incidentCount', 'byRobot', 'byIssue', 'blockedDecisions'];
const SHA = /^[a-f0-9]{64}$/;
const POLICY = /^research:r[1-9][0-9]{0,2}-v[1-9][0-9]{0,5}$/;
const fail = code => { throw Object.assign(new Error(code), { name: 'ValidationError', code }); };
const integer = value => Number.isSafeInteger(value) && value >= 0;
const identifier = (value, prefix) => typeof value === 'string' && new RegExp('^' + prefix + ':[a-f0-9]{16}$').test(value);
const sha = text => createHash('sha256').update(text).digest('hex');
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
function exact(input, keys, code) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail(code);
  const descriptors = Object.getOwnPropertyDescriptors(input), ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== 'string' || !keys.includes(key) ||
      !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) fail(code);
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
function array(input, maximum, code) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || input.length > maximum ||
      Reflect.ownKeys(input).length !== input.length + 1) fail(code);
  const result = [];
  for (let index = 0; index < input.length; index++) {
    const p = Object.getOwnPropertyDescriptor(input, String(index));
    if (!p || !Object.hasOwn(p, 'value') || !p.enumerable) fail(code);
    result.push(p.value);
  }
  return result;
}
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value) :
  Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' :
    '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';

/** Bounded plain-JSON fingerprinting for callers; rejects accessors before reads. */
export function canonicalR64Json(input) {
  let nodes = 0;
  const active = new Set();
  function copy(value, depth) {
    if (++nodes > 50000 || depth > 16) fail('R64_CANONICAL_JSON_LIMIT');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.length > 65536) fail('R64_CANONICAL_JSON_LIMIT');
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || active.has(value)) fail('R64_CANONICAL_JSON_VALUE');
    active.add(value);
    let result;
    if (Array.isArray(value)) result = array(value, 5000, 'R64_CANONICAL_JSON_ARRAY').map(v => copy(v, depth + 1));
    else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('R64_CANONICAL_JSON_OBJECT');
      const properties = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(properties);
      if (keys.length > 5000 || keys.some(k => typeof k !== 'string' || !properties[k].enumerable ||
          !Object.hasOwn(properties[k], 'value'))) fail('R64_CANONICAL_JSON_OBJECT');
      result = Object.fromEntries(keys.map(key => [key, copy(properties[key].value, depth + 1)]));
    }
    active.delete(value);
    return result;
  }
  const text = canonical(copy(input, 0));
  if (Buffer.byteLength(text, 'utf8') > 1024 * 1024) fail('R64_CANONICAL_JSON_LIMIT');
  return text;
}
export function digestR64Value(input) { return sha('JENIOS_R64_CANONICAL_JSON_V1\0' + canonicalR64Json(input)); }

function eventRecord(input) {
  const e = exact(input, EVENT_KEYS, 'R64_TELEMETRY_EVENT_SCHEMA');
  if (typeof e.policyVersion !== 'string' || !POLICY.test(e.policyVersion) ||
      !R64_TELEMETRY_ROBOTS.includes(e.robot) || !['decision', 'incident'].includes(e.kind) ||
      !['ALLOW', 'BLOCK', 'ADVISE', 'KEEP'].includes(e.decision) || !R64_TELEMETRY_ISSUES.includes(e.issue) ||
      (e.kind === 'incident' && e.issue === 'NONE') || !integer(e.marketAgeMs) ||
      e.marketAgeMs > R64_TELEMETRY_LIMITS.maxMarketAgeMs) fail('R64_TELEMETRY_EVENT_VALUE');
  if (!integer(e.occurredAtMs) || !integer(e.capturedAtMs) || e.occurredAtMs > e.capturedAtMs ||
      e.capturedAtMs - e.occurredAtMs > R64_TELEMETRY_LIMITS.maxReplayAgeMs)
    fail('R64_TELEMETRY_EVENT_TIME');
  return e;
}
function payloadRecord(input) {
  const p = exact(input, PAYLOAD_KEYS, 'R64_TELEMETRY_PAYLOAD_SCHEMA');
  if (p.schema !== PAYLOAD_SCHEMA || p.evidenceKind !== EVIDENCE ||
      !identifier(p.scopeId, 'scope') || !identifier(p.sourceId, 'source') ||
      !identifier(p.sessionId, 'session') || !identifier(p.eventId, 'evt') ||
      !Number.isSafeInteger(p.sequence) || p.sequence < 1 || p.sequence > 1000000000)
    fail('R64_TELEMETRY_PAYLOAD_VALUE');
  p.event = eventRecord(p.event);
  if (!integer(p.expiresAtMs) || p.expiresAtMs <= p.event.capturedAtMs ||
      p.expiresAtMs - p.event.capturedAtMs > R64_TELEMETRY_LIMITS.maxEnvelopeAgeMs)
    fail('R64_TELEMETRY_ENVELOPE_VALIDITY');
  return p;
}
/** Public protocol canonicalization; it validates the exact payload first. */
export function canonicalR64TelemetryPayload(payload) { return canonical(payloadRecord(payload)); }

export function verifyR64TelemetryEnvelope(input, options) {
  const envelope = exact(input, ['payload', 'signatureBase64'], 'R64_TELEMETRY_ENVELOPE_SCHEMA');
  const { trustedSource: configured, nowMs } = exact(options, ['trustedSource', 'nowMs'], 'R64_TELEMETRY_CONTEXT');
  const source = exact(configured, ['sourceId', 'scopeId', 'publicKeyPem', 'enabled', 'evidenceKind'],
    'R64_TELEMETRY_TRUST_ROOT');
  const p = payloadRecord(envelope.payload);
  if (source.enabled !== true || source.evidenceKind !== EVIDENCE || !identifier(source.scopeId, 'scope') ||
      !identifier(source.sourceId, 'source') || source.scopeId !== p.scopeId || source.sourceId !== p.sourceId)
    fail('R64_TELEMETRY_SOURCE_OR_SCOPE');
  if (!integer(nowMs) || nowMs < p.event.capturedAtMs || nowMs >= p.expiresAtMs ||
      nowMs - p.event.capturedAtMs > R64_TELEMETRY_LIMITS.maxEnvelopeAgeMs)
    fail('R64_TELEMETRY_STALE_OR_FUTURE');
  if (typeof source.publicKeyPem !== 'string' || source.publicKeyPem.length > 4096)
    fail('R64_TELEMETRY_PUBLIC_KEY');
  let key;
  try { key = createPublicKey(source.publicKeyPem); } catch { fail('R64_TELEMETRY_PUBLIC_KEY'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('R64_TELEMETRY_PUBLIC_KEY');
  if (typeof envelope.signatureBase64 !== 'string' ||
      !/^(?:[A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$/.test(envelope.signatureBase64))
    fail('R64_TELEMETRY_SIGNATURE');
  const signature = Buffer.from(envelope.signatureBase64, 'base64');
  if (signature.length !== 64 || signature.toString('base64') !== envelope.signatureBase64)
    fail('R64_TELEMETRY_SIGNATURE');
  const message = R64_TELEMETRY_DOMAIN + canonical(p);
  if (!verify(null, Buffer.from(message), key, signature)) fail('R64_TELEMETRY_SIGNATURE');
  return freeze({
    schema: RECEIPT_SCHEMA, evidenceKind: EVIDENCE,
    scopeId: p.scopeId, sourceId: p.sourceId, sessionId: p.sessionId, eventId: p.eventId,
    sequence: p.sequence, payloadDigest: sha(message), admittedAtMs: nowMs,
    expiresAtMs: p.expiresAtMs, event: p.event,
    proof: { configuredSourceSignatureVerified: true,
      configuredSourceKeySha256: sha(key.export({ format: 'der', type: 'spki' })),
      independentBrokerAttestation: false, independentCustomerConsentVerified: false },
  });
}

/**
 * Validate a trusted stored admission receipt, without reapplying intake expiry
 * against today's clock. This is structural/integrity validation, not a new
 * signature check or authority to accept receipts submitted by an HTTP caller.
 */
export function inspectR64TelemetryReceipt(input) {
  const r = exact(input, RECEIPT_KEYS, 'R64_TELEMETRY_RECEIPT_SCHEMA');
  if (r.schema !== RECEIPT_SCHEMA) fail('R64_TELEMETRY_RECEIPT_SCHEMA');
  const p = payloadRecord({ schema: PAYLOAD_SCHEMA, evidenceKind: r.evidenceKind,
    scopeId: r.scopeId, sourceId: r.sourceId, sessionId: r.sessionId, eventId: r.eventId,
    sequence: r.sequence, expiresAtMs: r.expiresAtMs, event: r.event });
  const proof = exact(r.proof, PROOF_KEYS, 'R64_TELEMETRY_RECEIPT_PROOF');
  if (proof.configuredSourceSignatureVerified !== true ||
      typeof proof.configuredSourceKeySha256 !== 'string' || !SHA.test(proof.configuredSourceKeySha256) ||
      proof.independentBrokerAttestation !== false || proof.independentCustomerConsentVerified !== false ||
      !integer(r.admittedAtMs) || r.admittedAtMs < p.event.capturedAtMs || r.admittedAtMs >= p.expiresAtMs ||
      r.payloadDigest !== sha(R64_TELEMETRY_DOMAIN + canonical(p))) fail('R64_TELEMETRY_RECEIPT_INTEGRITY');
  return freeze({ ...r, event: p.event, proof });
}

/** Same existing São Paulo calendar; new identity keeps R63/R64 reports separate. */
export function scheduleR64TelemetryPeriod({ nowMs } = {}) {
  const s = scheduleR63AdminReport({ nowMs });
  return freeze({ schema: 'JENIOS_R64_TELEMETRY_SCHEDULE_V1', timeZone: s.timeZone,
    cadence: s.cadence, periodKey: s.periodKey.replace(/^r63:/, 'r64:'), period: s.period,
    scheduledAtMs: s.scheduledAtMs, due: s.due, reason: s.reason,
    nextScheduledAtMs: s.nextScheduledAtMs, schedulerStarted: false, backfillEnabled: false });
}
function studyContext(input) {
  const c = exact(input, ['scopeId', 'period', 'generatedAtMs'], 'R64_TELEMETRY_STUDY_CONTEXT');
  const period = exact(c.period, ['startMs', 'endMs'], 'R64_TELEMETRY_PERIOD');
  if (!identifier(c.scopeId, 'scope') || !integer(c.generatedAtMs)) fail('R64_TELEMETRY_STUDY_CONTEXT');
  const schedule = scheduleR64TelemetryPeriod({ nowMs: c.generatedAtMs });
  if (!schedule.due || period.startMs !== schedule.period.startMs || period.endMs !== schedule.period.endMs)
    fail('R64_TELEMETRY_CLOSED_DAILY_PERIOD_REQUIRED');
  return { ...c, period, periodKey: schedule.periodKey };
}
const counts = keys => Object.fromEntries(keys.map(key => [key, 0]));
const order = (a, b) => a.event.occurredAtMs - b.event.occurredAtMs ||
  (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0) ||
  (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0) || a.sequence - b.sequence ||
  (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0);

export function studyR64AcceptedTelemetry(inputReceipts, input) {
  const c = studyContext(input);
  const receipts = array(inputReceipts, R64_TELEMETRY_LIMITS.maxReceipts, 'R64_TELEMETRY_BATCH')
    .map(inspectR64TelemetryReceipt);
  const unique = new Map();
  for (const receipt of receipts) {
    if (receipt.scopeId !== c.scopeId) fail('R64_TELEMETRY_STUDY_SCOPE');
    if (receipt.event.occurredAtMs < c.period.startMs || receipt.event.occurredAtMs >= c.period.endMs ||
        receipt.admittedAtMs > c.generatedAtMs) fail('R64_TELEMETRY_STUDY_TIME');
    const prior = unique.get(receipt.eventId);
    if (prior && canonical(prior) !== canonical(receipt)) fail('R64_TELEMETRY_CONFLICTING_RECEIPT');
    if (!prior) unique.set(receipt.eventId, receipt);
  }
  const ordered = [...unique.values()].sort(order), sessions = new Map();
  for (const receipt of ordered) {
    const key = receipt.sourceId + ':' + receipt.sessionId, previous = sessions.get(key);
    if (previous && (receipt.sequence <= previous.sequence ||
        receipt.event.occurredAtMs < previous.event.occurredAtMs ||
        receipt.event.capturedAtMs < previous.event.capturedAtMs || receipt.admittedAtMs < previous.admittedAtMs))
      fail('R64_TELEMETRY_SESSION_SEQUENCE');
    sessions.set(key, receipt);
  }
  const metrics = { eventCount: ordered.length, decisionCount: 0, incidentCount: 0,
    byRobot: counts(R64_TELEMETRY_ROBOTS), byIssue: counts(R64_TELEMETRY_ISSUES), blockedDecisions: 0 };
  for (const { event } of ordered) {
    metrics.byRobot[event.robot]++; metrics.byIssue[event.issue]++;
    if (event.kind === 'incident') metrics.incidentCount++;
    else { metrics.decisionCount++; if (event.decision === 'BLOCK') metrics.blockedDecisions++; }
  }
  const selected = ordered.slice(-R64_TELEMETRY_LIMITS.maxEvidenceEvents);
  const evidenceEvents = selected.map(receipt => ({ eventId: receipt.eventId, ...receipt.event }));
  const findings = [];
  for (const robot of R64_TELEMETRY_ROBOTS) for (const issue of R64_TELEMETRY_ISSUES.slice(1)) {
    const matching = ordered.filter(r => r.event.robot === robot && r.event.issue === issue);
    if (matching.length) findings.push({ code: issue, robot, eventCount: matching.length,
      severity: issue === 'CONTROL_VIOLATION' ? 'HIGH' : 'REVIEW',
      evidenceEventIds: evidenceEvents.filter(e => e.robot === robot && e.issue === issue).map(e => e.eventId) });
  }
  return freeze({ schema: STUDY_SCHEMA, evidenceKind: EVIDENCE, scopeId: c.scopeId,
    period: c.period, periodKey: c.periodKey, generatedAtMs: c.generatedAtMs,
    receiptCount: ordered.length, sourceCount: new Set(ordered.map(r => r.sourceId)).size,
    sessionCount: sessions.size,
    inputDigest: sha('JENIOS_R64_ACCEPTED_RECEIPTS_V1\0' + canonical(ordered)),
    metrics, evidenceEvents,
    evidenceSelection: { totalEvents: ordered.length, selectedEvents: selected.length,
      limit: 48, method: 'MOST_RECENT_48' }, findings,
    automaticPromotionAllowed: false, executionAllowed: false, realOrdersSent: 0,
    externalPaperOrdersSent: 0, actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
    independentBrokerAttestation: false, independentCustomerConsentVerified: false });
}

/** Validate an internally built/stored aggregate and its bounded evidence sample.
 * Counts outside the sample remain aggregate claims from the trusted receipt
 * store. This validator does not reconstruct missing receipts or attest origin.
 */
export function inspectR64TelemetryStudy(input) {
  const s = exact(input, STUDY_KEYS, 'R64_TELEMETRY_STUDY_SCHEMA');
  const c = studyContext({ scopeId: s.scopeId, period: s.period, generatedAtMs: s.generatedAtMs });
  if (s.schema !== STUDY_SCHEMA || s.evidenceKind !== EVIDENCE || s.periodKey !== c.periodKey ||
      typeof s.inputDigest !== 'string' || !SHA.test(s.inputDigest) ||
      !integer(s.receiptCount) || s.receiptCount > R64_TELEMETRY_LIMITS.maxReceipts ||
      !integer(s.sourceCount) || !integer(s.sessionCount) || s.sourceCount > s.sessionCount ||
      s.sessionCount > s.receiptCount || (s.receiptCount > 0 && s.sourceCount === 0) ||
      (s.receiptCount === 0 && (s.sourceCount || s.sessionCount))) fail('R64_TELEMETRY_STUDY_VALUE');
  const m = exact(s.metrics, METRIC_KEYS, 'R64_TELEMETRY_METRICS');
  const byRobot = exact(m.byRobot, R64_TELEMETRY_ROBOTS, 'R64_TELEMETRY_METRICS');
  const byIssue = exact(m.byIssue, R64_TELEMETRY_ISSUES, 'R64_TELEMETRY_METRICS');
  if (![m.eventCount, m.decisionCount, m.incidentCount, m.blockedDecisions, ...Object.values(byRobot),
    ...Object.values(byIssue)].every(integer) || m.eventCount !== s.receiptCount ||
    m.decisionCount + m.incidentCount !== m.eventCount || m.blockedDecisions > m.decisionCount ||
    Object.values(byRobot).reduce((a, b) => a + b, 0) !== m.eventCount ||
    Object.values(byIssue).reduce((a, b) => a + b, 0) !== m.eventCount || byIssue.NONE > m.decisionCount)
    fail('R64_TELEMETRY_METRICS');
  const selection = exact(s.evidenceSelection, ['totalEvents', 'selectedEvents', 'limit', 'method'], 'R64_TELEMETRY_SELECTION');
  const events = array(s.evidenceEvents, 48, 'R64_TELEMETRY_SELECTION').map(inputEvent => {
    const { eventId, ...rawEvent } = exact(inputEvent, ['eventId', ...EVENT_KEYS], 'R64_TELEMETRY_SAMPLE');
    const event = eventRecord(rawEvent);
    if (!identifier(eventId, 'evt') || event.occurredAtMs < c.period.startMs || event.occurredAtMs >= c.period.endMs ||
        event.capturedAtMs > c.generatedAtMs) fail('R64_TELEMETRY_SAMPLE');
    return { eventId, ...event };
  });
  if (selection.totalEvents !== s.receiptCount || selection.selectedEvents !== events.length ||
      selection.limit !== 48 || selection.method !== 'MOST_RECENT_48' ||
      events.length !== Math.min(48, s.receiptCount) || new Set(events.map(e => e.eventId)).size !== events.length ||
      events.some((e, i) => i > 0 && e.occurredAtMs < events[i - 1].occurredAtMs)) fail('R64_TELEMETRY_SELECTION');
  for (const robot of R64_TELEMETRY_ROBOTS) if (events.filter(e => e.robot === robot).length > byRobot[robot])
    fail('R64_TELEMETRY_SAMPLE_COUNTS');
  for (const issue of R64_TELEMETRY_ISSUES) if (events.filter(e => e.issue === issue).length > byIssue[issue])
    fail('R64_TELEMETRY_SAMPLE_COUNTS');
  const sampleDecisions = events.filter(e => e.kind === 'decision').length;
  const sampleBlocked = events.filter(e => e.kind === 'decision' && e.decision === 'BLOCK').length;
  if (sampleDecisions > m.decisionCount || events.length - sampleDecisions > m.incidentCount ||
      sampleBlocked > m.blockedDecisions || (events.length === s.receiptCount && sampleBlocked !== m.blockedDecisions))
    fail('R64_TELEMETRY_SAMPLE_COUNTS');
  const seen = new Set();
  const findings = array(s.findings, 16, 'R64_TELEMETRY_FINDINGS').map(raw => {
    const f = exact(raw, ['code', 'robot', 'eventCount', 'severity', 'evidenceEventIds'], 'R64_TELEMETRY_FINDING');
    const key = f.robot + ':' + f.code;
    if (!R64_TELEMETRY_ROBOTS.includes(f.robot) || !R64_TELEMETRY_ISSUES.slice(1).includes(f.code) ||
        !integer(f.eventCount) || !f.eventCount || f.eventCount > byRobot[f.robot] || f.eventCount > byIssue[f.code] ||
        f.severity !== (f.code === 'CONTROL_VIOLATION' ? 'HIGH' : 'REVIEW') || seen.has(key))
      fail('R64_TELEMETRY_FINDING');
    seen.add(key);
    const refs = array(f.evidenceEventIds, 48, 'R64_TELEMETRY_FINDING');
    const expected = events.filter(e => e.robot === f.robot && e.issue === f.code).map(e => e.eventId);
    if (canonical(refs) !== canonical(expected) || refs.length > f.eventCount) fail('R64_TELEMETRY_FINDING');
    return { ...f, evidenceEventIds: refs };
  });
  for (const issue of R64_TELEMETRY_ISSUES.slice(1))
    if (findings.filter(f => f.code === issue).reduce((sum, f) => sum + f.eventCount, 0) !== byIssue[issue])
      fail('R64_TELEMETRY_FINDING_COUNTS');
  for (const robot of R64_TELEMETRY_ROBOTS)
    if (findings.filter(f => f.robot === robot).reduce((sum, f) => sum + f.eventCount, 0) > byRobot[robot])
      fail('R64_TELEMETRY_FINDING_COUNTS');
  for (const key of ['automaticPromotionAllowed', 'executionAllowed', 'independentBrokerAttestation',
    'independentCustomerConsentVerified']) if (s[key] !== false) fail('R64_TELEMETRY_UNSUPPORTED_CLAIM');
  for (const key of ['realOrdersSent', 'externalPaperOrdersSent']) if (s[key] !== 0) fail('R64_TELEMETRY_UNSUPPORTED_CLAIM');
  for (const key of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy'])
    if (s[key] !== null) fail('R64_TELEMETRY_UNSUPPORTED_CLAIM');
  return freeze({ ...s, period: c.period, metrics: { ...m, byRobot, byIssue }, evidenceEvents: events,
    evidenceSelection: selection, findings });
}
