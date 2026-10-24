/**
 * R64 — opt-in transport for observation-only signed QA replay hypotheses.
 * The worker owns durable reservation, single dispatch, audit and settlement.
 * This module does not access wallets, a database, broker accounts or production.
 * No inference retry: an ambiguous dispatched request retains its reservation.
 */
import { readBoundedJson, completedModelText } from '../bounded-response.mjs';
import { PRO_MODEL_RATES, PRO_PRICING_VERSION, proProviderCost } from '../../assistant/pro-pricing.mjs';
import { proReservationMaximum } from '../../assistant/pro-wallet-contract.mjs';
import { isRobotR61QaEnabled } from './robot-r61-qa-access.mjs';
import { inspectR64TelemetryStudy, canonicalR64Json, digestR64Value,
  R64_TELEMETRY_ROBOTS, R64_TELEMETRY_ISSUES } from './robot-r64-telemetry.mjs';

export const R64_ANALYST_LIMITS = Object.freeze({ maxInputTokens: 8000, maxOutputTokens: 700,
  maxEvents: 48, maxRequestBytes: 50000, maxResponseBytes: 65536,
  maxAnalysisChars: 16000, timeoutMs: 10000, tariffMaxAgeMs: 30 * 86400000 });
const RESPONSE_URL = 'https://api.openai.com/v1/responses';
const COUNT_URL = RESPONSE_URL + '/input_tokens';
const PREPARED_SCHEMA = 'JENIOS_R64_ANALYST_PREPARED_V1';
const RESPONSE_SCHEMA = 'JENIOS_R64_ANALYST_RESPONSE_V1';
const POLICY_KEYS = ['generationEnabled', 'requiresReconciliation', 'allowedModels', 'pricingVersion',
  'pricingApproved', 'ratesVerifiedAt', 'maxRequestProviderNanoUsd', 'monthlyProviderLimitNanoUsd'];
const PREVIEW_KEYS = ['VERCEL_ENV', 'JENIOS_QA_CANDIDATE_ENABLED', 'JENIOS_ROBOT_QA_ENABLED',
  'JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED', 'JENIOS_PRIVATE_PAPER_EXECUTOR'];
const INVARIANTS = Object.freeze({ evidenceKind: 'SIGNED_QA_REPLAY', hypothesisOnly: true,
  mayPromote: false, mayExecute: false, mayDeploy: false, retryAllowed: false,
  requiresDurableAudit: true, realOrdersSent: 0, externalPaperOrdersSent: 0,
  actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null });
const preparations = new WeakMap();
const fail = code => { throw Object.assign(new Error(code), { code }); };
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
function exact(value, keys, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(reason);
  const d = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(d);
  if (actual.length !== keys.length || actual.some(key => typeof key !== 'string' || !keys.includes(key) ||
      !Object.hasOwn(d[key], 'value') || !d[key].enumerable)) fail(reason);
  return Object.fromEntries(keys.map(key => [key, d[key].value]));
}
function envValue(env, key) {
  if (!env || typeof env !== 'object') return undefined;
  const d = Object.getOwnPropertyDescriptor(env, key);
  return d && Object.hasOwn(d, 'value') && typeof d.value === 'string' ? d.value : undefined;
}
function enabled(env) {
  const preview = Object.fromEntries(PREVIEW_KEYS.map(key => [key, envValue(env, key)]));
  return isRobotR61QaEnabled(preview) && envValue(env, 'JENIOS_ROBOT_R64_ENABLED') === 'true' &&
    envValue(env, 'JENIOS_ROBOT_ANALYST_PAID_ENABLED') === 'true';
}
function configuredKey(env) {
  const value = envValue(env, 'OPENAI_API_KEY');
  return typeof value === 'string' && /^sk-[A-Za-z0-9_-]{20,500}$/.test(value) ? value : null;
}
function approvedPolicy(input, model, nowMs) {
  const p = exact(JSON.parse(canonicalR64Json(input)), POLICY_KEYS, 'POLICY_INVALID');
  if (!integer(nowMs, 0, Number.MAX_SAFE_INTEGER) || p.generationEnabled !== true ||
      p.requiresReconciliation !== false || p.pricingApproved !== true ||
      p.pricingVersion !== PRO_PRICING_VERSION || typeof model !== 'string' ||
      !Object.hasOwn(PRO_MODEL_RATES, model)) fail('POLICY_NOT_APPROVED');
  if (!Array.isArray(p.allowedModels) || p.allowedModels.length < 1 || p.allowedModels.length > 10 ||
      new Set(p.allowedModels).size !== p.allowedModels.length ||
      p.allowedModels.some(value => typeof value !== 'string' || !Object.hasOwn(PRO_MODEL_RATES, value)) ||
      !p.allowedModels.includes(model)) fail('MODEL_NOT_APPROVED');
  const at = typeof p.ratesVerifiedAt === 'string' ? Date.parse(p.ratesVerifiedAt) : NaN;
  if (!Number.isFinite(at) || at > nowMs || nowMs - at > R64_ANALYST_LIMITS.tariffMaxAgeMs)
    fail('TARIFF_APPROVAL_EXPIRED');
  if (!integer(p.maxRequestProviderNanoUsd, 1, 50000000000) ||
      !integer(p.monthlyProviderLimitNanoUsd, 1, 1000000000000)) fail('BUDGET_NOT_CONFIGURED');
  return p;
}
function responseSchema(eventIds) {
  const references = { type: 'array', items: { type: 'string', enum: eventIds }, minItems: 1, maxItems: 48 };
  return {
    type: 'object', additionalProperties: false,
    properties: {
      schema: { type: 'string', enum: [RESPONSE_SCHEMA] },
      assessment: { type: 'string', enum: ['HYPOTHESIS_ONLY'] },
      findings: { type: 'array', maxItems: 16, items: { type: 'object', additionalProperties: false,
        properties: { code: { type: 'string', enum: R64_TELEMETRY_ISSUES.filter(code => code !== 'NONE') },
          robot: { type: 'string', enum: R64_TELEMETRY_ROBOTS },
          confidence: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] }, evidenceEventIds: references },
        required: ['code', 'robot', 'confidence', 'evidenceEventIds'] } },
      proposals: { type: 'array', maxItems: 1, items: { type: 'object', additionalProperties: false,
        properties: { kind: { type: 'string', enum: ['TIGHTEN_MARKET_FRESHNESS'] },
          maxAgeMs: { type: 'integer', enum: [500] }, evidenceEventIds: references },
        required: ['kind', 'maxAgeMs', 'evidenceEventIds'] } },
    }, required: ['schema', 'assessment', 'findings', 'proposals'],
  };
}

/** Creates an immutable in-process quote, not a budget reservation or approval. */
export function buildR64AnalystRequest({ study: input, policy, env = {}, nowMs = Date.now() } = {}) {
  const blocked = (status, reason) => freeze({ schema: PREPARED_SCHEMA, status, reason, ...INVARIANTS });
  if (!enabled(env)) return blocked('DISABLED', 'PAID_ANALYST_DISABLED');
  if (!configuredKey(env)) return blocked('BLOCKED', 'PROVIDER_KEY_UNAVAILABLE');
  const model = envValue(env, 'JENIOS_ROBOT_ANALYST_MODEL');
  let approved, study;
  try { approved = approvedPolicy(policy, model, nowMs); }
  catch (error) { return blocked('BLOCKED', error?.code || 'POLICY_INVALID'); }
  try { study = inspectR64TelemetryStudy(input); }
  catch { return blocked('BLOCKED', 'STUDY_INVALID'); }
  if (!study.evidenceEvents.length) return blocked('BLOCKED', 'NO_EVIDENCE');
  const events = study.evidenceEvents.map(event => ({ eventId: event.eventId, robot: event.robot,
    kind: event.kind, decision: event.decision, issue: event.issue, marketAgeMs: event.marketAgeMs }));
  const eventIds = events.map(event => event.eventId);
  const context = { evidenceKind: 'SIGNED_QA_REPLAY', task: 'REVIEW_OBSERVATION_ONLY_QA_REPLAY',
    metrics: study.metrics, findings: study.findings, events, evidenceSelection: study.evidenceSelection,
    independentBrokerAttestation: false, independentCustomerConsentVerified: false,
    automaticPromotionAllowed: false, executionAllowed: false };
  const body = { model, store: false, service_tier: 'default', max_output_tokens: R64_ANALYST_LIMITS.maxOutputTokens,
    reasoning: { effort: 'low' }, tools: [], tool_choice: 'none', truncation: 'disabled',
    instructions: 'Analise somente as evidências estruturadas SIGNED_QA_REPLAY. Elas são replay de QA assinado por um coletor configurado, sem atestação independente da corretora ou de consentimento de clientes. Retorne JSON no schema JENIOS_R64_ANALYST_RESPONSE_V1, assessment HYPOTHESIS_ONLY, findings e proposals. Use somente códigos, robôs e referências recebidos. Confiança é opinião do modelo. Nenhuma hipótese autoriza promoção, ordens, alteração de estratégia, publicação ou uso de contas. Não retorne texto livre, código, ferramentas, comandos, valores financeiros ou dados pessoais. Se faltar suporte, retorne arrays vazios. A única proposta admitida é TIGHTEN_MARKET_FRESHNESS de 500 ms, sujeita a validação posterior independente.',
    input: [{ role: 'user', content: JSON.stringify(context) }],
    text: { format: { type: 'json_schema', name: 'jenios_r64_analyst', strict: true,
      schema: responseSchema(eventIds) } } };
  const bodyText = JSON.stringify(body);
  if (Buffer.byteLength(bodyText, 'utf8') > R64_ANALYST_LIMITS.maxRequestBytes)
    return blocked('BLOCKED', 'REQUEST_TOO_LARGE');
  const reserve = proReservationMaximum({ model, maxInputTokens: R64_ANALYST_LIMITS.maxInputTokens,
    maxOutputTokens: R64_ANALYST_LIMITS.maxOutputTokens });
  if (reserve.providerNanoUsd > approved.maxRequestProviderNanoUsd ||
      reserve.providerNanoUsd > approved.monthlyProviderLimitNanoUsd)
    return blocked('BLOCKED', 'BUDGET_QUOTE_EXCEEDED');
  const request = { fingerprint: digestR64Value({ schema: PREPARED_SCHEMA,
    scopeId: study.scopeId, periodKey: study.periodKey, inputDigest: study.inputDigest,
    pricingVersion: PRO_PRICING_VERSION, body }), model, pricingVersion: PRO_PRICING_VERSION,
    reservationNanoUsd: reserve.providerNanoUsd, maxInputTokens: R64_ANALYST_LIMITS.maxInputTokens,
    maxOutputTokens: R64_ANALYST_LIMITS.maxOutputTokens };
  const prepared = freeze({ schema: PREPARED_SCHEMA, status: 'READY', reason: 'READY',
    ...request, request, body, ...INVARIANTS });
  preparations.set(prepared, { study, policy: freeze(approved), bodyText });
  return prepared;
}

function references(input, events) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 48 || new Set(input).size !== input.length ||
      input.some(id => typeof id !== 'string' || !events.has(id))) fail('ANALYSIS_REFERENCE_INVALID');
  return [...input].sort();
}
function inspectAnalysis(text, study) {
  if (typeof text !== 'string' || text.length > R64_ANALYST_LIMITS.maxAnalysisChars) fail('ANALYSIS_INVALID');
  const input = JSON.parse(text);
  exact(input, ['schema', 'assessment', 'findings', 'proposals'], 'ANALYSIS_INVALID');
  if (input.schema !== RESPONSE_SCHEMA || input.assessment !== 'HYPOTHESIS_ONLY' ||
      !Array.isArray(input.findings) || input.findings.length > 16 ||
      !Array.isArray(input.proposals) || input.proposals.length > 1) fail('ANALYSIS_INVALID');
  const events = new Map(study.evidenceEvents.map(event => [event.eventId, event]));
  const seen = new Set(), used = new Set();
  const findings = input.findings.map(item => {
    exact(item, ['code', 'robot', 'confidence', 'evidenceEventIds'], 'ANALYSIS_FINDING_INVALID');
    if (!study.findings.some(f => f.code === item.code && f.robot === item.robot) ||
        !['LOW', 'MEDIUM', 'HIGH'].includes(item.confidence) || seen.has(item.robot + ':' + item.code))
      fail('ANALYSIS_FINDING_UNSUPPORTED');
    const refs = references(item.evidenceEventIds, events);
    if (refs.some(id => events.get(id).robot !== item.robot || events.get(id).issue !== item.code))
      fail('ANALYSIS_FINDING_UNSUPPORTED');
    seen.add(item.robot + ':' + item.code); refs.forEach(id => used.add(id));
    return { code: item.code, robot: item.robot, modelConfidence: item.confidence,
      confidenceIsMeasured: false, evidenceEventIds: refs, classification: 'MODEL_HYPOTHESIS_QA_REPLAY' };
  });
  const proposals = input.proposals.map(item => {
    exact(item, ['kind', 'maxAgeMs', 'evidenceEventIds'], 'ANALYSIS_PROPOSAL_INVALID');
    if (item.kind !== 'TIGHTEN_MARKET_FRESHNESS' || item.maxAgeMs !== 500 ||
        study.metrics.byIssue.CONTROL_VIOLATION !== 0) fail('ANALYSIS_PROPOSAL_UNSUPPORTED');
    const refs = references(item.evidenceEventIds, events), support = refs.map(id => events.get(id));
    if (support.length < 3 || support.some(event => event.robot !== 'ultrafast' ||
        event.issue !== 'STALE_CONTEXT' || event.marketAgeMs <= 500) ||
        new Set(support.map(event => event.occurredAtMs)).size < 3) fail('ANALYSIS_PROPOSAL_UNSUPPORTED');
    refs.forEach(id => used.add(id));
    return { kind: item.kind, maxAgeMs: item.maxAgeMs, evidenceEventIds: refs,
      assessment: 'HYPOTHESIS_REQUIRES_INDEPENDENT_VALIDATION' };
  });
  return freeze({ schema: 'JENIOS_R64_ANALYST_HYPOTHESES_V1', findings, proposals,
    evidenceEventIds: [...used].sort(), ...INVARIANTS });
}
function normalizeUsage(input, prepared) {
  const usage = exact(input, ['input_tokens', 'input_tokens_details', 'output_tokens',
    'output_tokens_details', 'total_tokens'], 'PROVIDER_USAGE_UNVERIFIED');
  const source = exact(usage.input_tokens_details, ['cached_tokens', 'cache_write_tokens'], 'PROVIDER_USAGE_UNVERIFIED');
  const cached = source.cached_tokens, written = source.cache_write_tokens;
  const output = exact(usage.output_tokens_details, ['reasoning_tokens'], 'PROVIDER_USAGE_UNVERIFIED');
  const reasoning = output.reasoning_tokens;
  if (!integer(usage.input_tokens, 1, prepared.maxInputTokens) ||
      !integer(usage.output_tokens, 0, prepared.maxOutputTokens) ||
      !integer(cached, 0, usage.input_tokens) || !integer(written, 0, usage.input_tokens) ||
      cached + written > usage.input_tokens || !integer(reasoning, 0, usage.output_tokens) ||
      usage.total_tokens !== usage.input_tokens + usage.output_tokens) fail('PROVIDER_USAGE_UNVERIFIED');
  return { input_tokens: usage.input_tokens,
    input_tokens_details: { cached_tokens: cached, cache_write_tokens: written },
    output_tokens: usage.output_tokens, output_tokens_details: { reasoning_tokens: reasoning },
    total_tokens: usage.total_tokens };
}
async function abortable(operation, signal) {
  if (signal.aborted) fail('PROVIDER_ABORTED');
  let listener;
  const aborted = new Promise((_, reject) => { listener = () => reject(Object.assign(
    new Error('PROVIDER_ABORTED'), { code: 'PROVIDER_ABORTED' }));
    signal.addEventListener('abort', listener, { once: true }); });
  try { return await Promise.race([Promise.resolve().then(operation), aborted]); }
  finally { signal.removeEventListener('abort', listener); }
}

/** dispatchGranted comes only from the worker's successful durable transaction.
 * Return value is not deliverable until the worker confirms audit/settlement.
 */
export async function invokeR64AnalystProvider(prepared, {
  env = {}, fetcher = fetch, signal, dispatchGranted = false, nowMs = Date.now(),
} = {}) {
  const internal = preparations.get(prepared);
  let httpRequests = 0, inferenceRequests = 0;
  const result = (kind, reason, extra = {}) => freeze({
    schema: 'JENIOS_R64_ANALYST_PROVIDER_RESULT_V1', kind, reason, provider: 'openai',
    fingerprint: internal ? prepared.fingerprint : null, model: internal ? prepared.model : null,
    pricingVersion: internal ? prepared.pricingVersion : null,
    providerResponseId: null, usage: null, costNanoUsd: null, responseDigest: null,
    analysis: null, analysisDigest: null, analysisStatus: 'NOT_AVAILABLE',
    httpRequests, inferenceRequests, ...INVARIANTS, ...extra,
  });
  if (!internal) return result('not_generated', 'PREPARATION_INVALID');
  if (!enabled(env)) return result('not_generated', 'PAID_ANALYST_DISABLED');
  const key = configuredKey(env);
  if (!key || envValue(env, 'JENIOS_ROBOT_ANALYST_MODEL') !== prepared.model)
    return result('not_generated', 'PROVIDER_CONFIGURATION_CHANGED');
  try { approvedPolicy(internal.policy, prepared.model, nowMs); }
  catch { return result('not_generated', 'POLICY_APPROVAL_EXPIRED'); }
  if (dispatchGranted !== true) return result('not_generated', 'DURABLE_DISPATCH_REQUIRED');
  if (typeof fetcher !== 'function') return result('not_generated', 'TRANSPORT_UNAVAILABLE');
  if (signal?.aborted) return result('not_generated', 'ABORTED_BEFORE_REQUEST');
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), R64_ANALYST_LIMITS.timeoutMs);
  const request = body => ({ method: 'POST', redirect: 'error', cache: 'no-store',
    signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(body) });
  let preflightTokens;
  try {
    const countBody = { model: prepared.model, instructions: prepared.body.instructions,
      input: prepared.body.input, tools: [], tool_choice: 'none', text: prepared.body.text,
      reasoning: prepared.body.reasoning, truncation: 'disabled' };
    httpRequests++;
    const count = await abortable(() => fetcher(COUNT_URL, request(countBody)), controller.signal);
    if (!count?.ok) {
      void count?.body?.cancel().catch(() => {});
      return result('not_generated', 'TOKEN_PREFLIGHT_REJECTED');
    }
    const value = await abortable(() => readBoundedJson(count, 8192), controller.signal);
    exact(value, ['object', 'input_tokens'], 'TOKEN_PREFLIGHT_INVALID');
    if (value.object !== 'response.input_tokens' || !integer(value.input_tokens, 1, prepared.maxInputTokens))
      return result('not_generated', 'TOKEN_BOUND_EXCEEDED');
    preflightTokens = value.input_tokens;
    if (controller.signal.aborted || !enabled(env)) return result('not_generated', 'ABORTED_BEFORE_INFERENCE');
    httpRequests++; inferenceRequests++;
    const response = await abortable(() => fetcher(RESPONSE_URL, request(prepared.body)), controller.signal);
    if (!response?.ok) {
      void response?.body?.cancel().catch(() => {});
      return result('unknown', 'PROVIDER_HTTP_UNVERIFIED');
    }
    const raw = await abortable(() => readBoundedJson(response, R64_ANALYST_LIMITS.maxResponseBytes), controller.signal);
    const responseDigest = digestR64Value(raw);
    const providerResponseId = /^resp_[A-Za-z0-9_-]{1,160}$/.test(raw?.id || '') ? raw.id : null;
    const metadata = { providerResponseId, responseDigest, preflightInputTokens: preflightTokens };
    if (!providerResponseId || raw.object !== 'response' || raw.model !== prepared.model ||
        raw.service_tier !== 'default' || !['completed', 'incomplete', 'failed', 'cancelled'].includes(raw.status) ||
        !Array.isArray(raw.output) || raw.output.some(item => !['message', 'reasoning'].includes(item?.type)))
      return result('unknown', 'PROVIDER_ENVELOPE_UNVERIFIED', metadata);
    let usage, cost;
    try {
      usage = normalizeUsage(raw.usage, prepared);
      cost = proProviderCost(usage, { model: prepared.model });
      if (cost.providerCostNanoUsd > prepared.reservationNanoUsd) fail('PROVIDER_COST_OVER_RESERVATION');
    } catch { return result('unknown', 'PROVIDER_USAGE_UNVERIFIED', metadata); }
    let analysis = null, analysisStatus = 'INVALID';
    const text = completedModelText(raw);
    if (raw.status !== 'completed') analysisStatus = 'INCOMPLETE';
    else if (text !== null) {
      try { analysis = inspectAnalysis(text, internal.study); analysisStatus = 'VALID'; } catch {}
    }
    return result('usage_confirmed', analysisStatus === 'VALID' ? 'ANALYSIS_VALIDATED' : 'ANALYSIS_WITHHELD', {
      ...metadata, usage, costNanoUsd: cost.providerCostNanoUsd, analysis, analysisStatus,
      analysisDigest: analysis ? digestR64Value(analysis) : null, providerStatus: raw.status,
    });
  } catch {
    return result(inferenceRequests ? 'unknown' : 'not_generated',
      inferenceRequests ? 'PROVIDER_TRANSPORT_OR_BODY_UNKNOWN' : 'TOKEN_PREFLIGHT_UNAVAILABLE');
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', onAbort);
  }
}
