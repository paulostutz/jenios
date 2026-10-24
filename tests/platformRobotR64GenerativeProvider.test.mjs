import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { buildR64AnalystRequest, invokeR64AnalystProvider, R64_ANALYST_LIMITS }
  from '../lib/platform/research/robot-r64-generative-provider.mjs';
import { PRO_PRICING_VERSION } from '../lib/assistant/pro-pricing.mjs';
import { createR64TelemetryFixture, signR64QaPayload }
  from '../scripts/platform/research/r64-telemetry-fixtures.mjs';
import { verifyR64TelemetryEnvelope, studyR64AcceptedTelemetry }
  from '../lib/platform/research/robot-r64-telemetry.mjs';

const fixture = createR64TelemetryFixture();
const NOW = fixture.generatedAtMs;
const clone = value => JSON.parse(JSON.stringify(value));
const environment = () => ({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_REAL_EXECUTION_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false',
  JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'true',
  JENIOS_ROBOT_ANALYST_MODEL: 'gpt-6-luna', OPENAI_API_KEY: 'sk-r64-fixture-no-real-provider-key' });
const policy = () => ({ generationEnabled: true, requiresReconciliation: false,
  allowedModels: ['gpt-6-luna'], pricingVersion: PRO_PRICING_VERSION, pricingApproved: true,
  ratesVerifiedAt: new Date(NOW).toISOString(), maxRequestProviderNanoUsd: 100000000,
  monthlyProviderLimitNanoUsd: 1000000000 });
const prepare = (options = {}) => buildR64AnalystRequest({ study: fixture.study,
  policy: policy(), env: environment(), nowMs: NOW, ...options });
const hypothesis = (study = fixture.study) => {
  const refs = study.evidenceEvents.filter(e => e.robot === 'ultrafast' && e.issue === 'STALE_CONTEXT')
    .slice(0, 3).map(e => e.eventId);
  return { schema: 'JENIOS_R64_ANALYST_RESPONSE_V1', assessment: 'HYPOTHESIS_ONLY',
    findings: [{ code: 'STALE_CONTEXT', robot: 'ultrafast', confidence: 'HIGH', evidenceEventIds: refs }],
    proposals: [{ kind: 'TIGHTEN_MARKET_FRESHNESS', maxAgeMs: 500, evidenceEventIds: refs }] };
};
const usage = () => ({ input_tokens: 100, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 10 },
  output_tokens: 50, output_tokens_details: { reasoning_tokens: 25 }, total_tokens: 150 });
const envelope = (options = {}) => ({ object: 'response', id: 'resp_r64_fake_01', model: 'gpt-6-luna',
  service_tier: 'default', status: 'completed', usage: usage(), output: [{ type: 'message',
    status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(hypothesis()) }] }],
  ...options });
const jsonResponse = data => new Response(JSON.stringify(data), { status: 200,
  headers: { 'Content-Type': 'application/json' } });
function transport({ response = envelope(), count = 100 } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse(url.endsWith('/input_tokens') ? { object: 'response.input_tokens', input_tokens: count } : response);
  };
  return { calls, fetcher };
}
const invoke = (prepared, options = {}) => invokeR64AnalystProvider(prepared, {
  env: environment(), dispatchGranted: true, nowMs: NOW, ...options });

test('R64 analyst is disabled before inspecting input unless explicit paid and preview gates pass', () => {
  let touched = 0;
  const study = Object.defineProperty({}, 'schema', { get() { touched++; throw new Error('must not read'); } });
  assert.equal(buildR64AnalystRequest({ study }).status, 'DISABLED');
  for (const [key, value] of [['VERCEL_ENV', 'production'], ['JENIOS_QA_CANDIDATE_ENABLED', 'false'],
    ['JENIOS_ROBOT_QA_ENABLED', 'false'], ['JENIOS_REAL_EXECUTION_ENABLED', 'true'],
    ['JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED', 'true'], ['JENIOS_PRIVATE_PAPER_EXECUTOR', 'true'],
    ['JENIOS_ROBOT_R64_ENABLED', 'false'], ['JENIOS_ROBOT_ANALYST_PAID_ENABLED', 'false']]) {
    assert.equal(prepare({ study, env: { ...environment(), [key]: value } }).status, 'DISABLED');
    const env = environment(); delete env[key];
    assert.equal(prepare({ study, env }).status, 'DISABLED');
  }
  assert.equal(touched, 0);
});

test('R64 analyst requires a configured key, approved model, tariff and internal budget', () => {
  for (const change of [{ generationEnabled: false }, { requiresReconciliation: true },
    { pricingApproved: false }, { pricingVersion: 'unapproved' }, { allowedModels: [] },
    { maxRequestProviderNanoUsd: 0 }, { monthlyProviderLimitNanoUsd: 0 }])
    assert.equal(prepare({ policy: { ...policy(), ...change } }).status, 'BLOCKED');
  for (const key of ['', 'short', 'sk-invalid\nheader-injection-value'])
    assert.equal(prepare({ env: { ...environment(), OPENAI_API_KEY: key } }).status, 'BLOCKED');
  assert.equal(prepare({ env: { ...environment(), JENIOS_ROBOT_ANALYST_MODEL: 'unpriced-model' } }).status, 'BLOCKED');
  assert.equal(prepare({ policy: { ...policy(), maxRequestProviderNanoUsd: 1349999 } }).reason, 'BUDGET_QUOTE_EXCEEDED');
});

test('R64 tariff approval is time bounded and policy getters are never evaluated', () => {
  assert.equal(prepare({ nowMs: NOW + R64_ANALYST_LIMITS.tariffMaxAgeMs }).status, 'READY');
  assert.equal(prepare({ nowMs: NOW + R64_ANALYST_LIMITS.tariffMaxAgeMs + 1 }).reason, 'TARIFF_APPROVAL_EXPIRED');
  assert.equal(prepare({ policy: { ...policy(), ratesVerifiedAt: new Date(NOW + 1).toISOString() } }).status, 'BLOCKED');
  let invoked = 0; const p = policy();
  Object.defineProperty(p, 'generationEnabled', { enumerable: true, get() { invoked++; return true; } });
  assert.equal(prepare({ policy: p }).status, 'BLOCKED'); assert.equal(invoked, 0);
});

test('R64 request excludes identities and timestamps and preserves signed QA evidence kind', () => {
  const p = prepare(); assert.equal(p.status, 'READY');
  const content = JSON.parse(p.body.input[0].content);
  assert.equal(content.evidenceKind, 'SIGNED_QA_REPLAY');
  for (const name of ['scopeId', 'sourceId', 'sessionId', 'policyVersion', 'occurredAtMs', 'capturedAtMs'])
    assert.equal(JSON.stringify(content).includes('"' + name + '"'), false);
  assert.equal(content.automaticPromotionAllowed, false);
  assert.equal(p.body.store, false); assert.deepEqual(p.body.tools, []);
  assert.equal(p.body.tool_choice, 'none'); assert.equal(p.body.max_output_tokens, 700);
  assert.equal(p.body.text.format.strict, true);
  assert.equal(p.body.text.format.schema.additionalProperties, false);
  assert.equal(JSON.stringify(p).includes(environment().OPENAI_API_KEY), false);
});

test('R64 quote is deterministic, immutable and uses the existing integer nanoUSD ceiling', () => {
  const first = prepare(), second = prepare({ study: clone(fixture.study), policy: clone(policy()) });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.reservationNanoUsd, 1350000);
  assert.deepEqual(Object.keys(first.request).sort(), ['fingerprint', 'model', 'pricingVersion',
    'reservationNanoUsd', 'maxInputTokens', 'maxOutputTokens'].sort());
  assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
  assert.throws(() => { first.body.store = true; }, TypeError);
  assert.throws(() => first.body.tools.push({ type: 'web_search' }), TypeError);
});

test('R64 stronger approved model receives its own conservative reservation', () => {
  const p = prepare({ policy: { ...policy(), allowedModels: ['gpt-6.1-sol'] },
    env: { ...environment(), JENIOS_ROBOT_ANALYST_MODEL: 'gpt-6.1-sol' } });
  assert.equal(p.status, 'READY'); assert.equal(p.reservationNanoUsd, 27000000);
  assert.equal(p.model, 'gpt-6.1-sol');
});

test('R64 request includes at most the declared 48-event sample', () => {
  const f = createR64TelemetryFixture({ count: 60 }); const p = prepare({ study: f.study });
  assert.equal(p.status, 'READY'); const context = JSON.parse(p.body.input[0].content);
  assert.equal(context.events.length, 48); assert.equal(context.metrics.eventCount, 60);
  assert.equal(context.evidenceSelection.selectedEvents, 48);
  assert.equal(context.evidenceSelection.totalEvents, 60);
});

test('R64 rejects absent, tampered and relabelled studies without creating a provider request', () => {
  const empty = createR64TelemetryFixture({ count: 0 });
  assert.equal(prepare({ study: empty.study }).reason, 'NO_EVIDENCE');
  for (const change of [{ evidenceKind: 'SYNTHETIC_FIXTURE' }, { evidenceKind: 'VERIFIED_LIVE' },
    { automaticPromotionAllowed: true }, { realOrdersSent: 1 }, { actualBrokerPnl: 10 }])
    assert.equal(prepare({ study: { ...fixture.study, ...change } }).reason, 'STUDY_INVALID');
});

test('R64 transport requires the original prepared object and a successful durable dispatch', async () => {
  const p = prepare(); let calls = 0; const fetcher = () => { calls++; throw new Error('must not call'); };
  assert.equal((await invoke(p, { fetcher, dispatchGranted: false })).reason, 'DURABLE_DISPATCH_REQUIRED');
  assert.equal((await invoke(clone(p), { fetcher })).reason, 'PREPARATION_INVALID');
  assert.equal((await invoke({ ...p, body: { ...p.body, tools: ['malicious'] } }, { fetcher })).reason, 'PREPARATION_INVALID');
  assert.equal(calls, 0);
});

test('R64 rechecks disabled flag, model and expiry after preparation before network access', async () => {
  const p = prepare(); let calls = 0; const fetcher = () => { calls++; throw new Error('must not call'); };
  for (const env of [{ ...environment(), JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false' },
    { ...environment(), JENIOS_ROBOT_ANALYST_MODEL: 'gpt-6.1-sol' }, { ...environment(), OPENAI_API_KEY: '' }])
    assert.equal((await invoke(p, { fetcher, env })).kind, 'not_generated');
  assert.equal((await invoke(p, { fetcher, nowMs: NOW + R64_ANALYST_LIMITS.tariffMaxAgeMs + 1 })).kind, 'not_generated');
  assert.equal(calls, 0);
});

test('R64 valid structured hypothesis confirms usage and records actual inference accounting', async () => {
  const p = prepare(), { calls, fetcher } = transport(); const r = await invoke(p, { fetcher });
  assert.equal(r.kind, 'usage_confirmed'); assert.equal(r.analysisStatus, 'VALID');
  assert.equal(r.costNanoUsd, 33450); assert.equal(r.usage.output_tokens, 50);
  assert.equal(r.usage.output_tokens_details.reasoning_tokens, 25);
  assert.equal(r.httpRequests, 2); assert.equal(r.inferenceRequests, 1);
  assert.equal(r.providerResponseId, 'resp_r64_fake_01'); assert.match(r.responseDigest, /^[a-f0-9]{64}$/);
  assert.match(r.analysisDigest, /^[a-f0-9]{64}$/); assert.equal(r.fingerprint, p.fingerprint);
  assert.equal(r.requiresDurableAudit, true); assert.equal(r.retryAllowed, false); assert.equal(r.mayPromote, false);
  assert.equal(r.analysis.evidenceKind, 'SIGNED_QA_REPLAY'); assert.equal(r.analysis.proposals[0].maxAgeMs, 500);
  assert.equal(r.analysis.findings[0].confidenceIsMeasured, false);
  assert.deepEqual(calls.map(c => c.url), ['https://api.openai.com/v1/responses/input_tokens',
    'https://api.openai.com/v1/responses']);
  for (const call of calls) {
    assert.equal(call.options.method, 'POST'); assert.equal(call.options.redirect, 'error');
    assert.equal(call.options.cache, 'no-store'); assert.ok(call.options.signal instanceof AbortSignal);
    const body = JSON.parse(call.options.body); assert.deepEqual(body.tools, []);
    assert.equal(body.tool_choice, 'none'); assert.equal(body.text.format.type, 'json_schema');
  }
});

test('R64 preflight rejects a request above the reserved input bound without inference', async () => {
  const { calls, fetcher } = transport({ count: 8001 }); const r = await invoke(prepare(), { fetcher });
  assert.equal(r.kind, 'not_generated'); assert.equal(r.reason, 'TOKEN_BOUND_EXCEEDED');
  assert.equal(r.httpRequests, 1); assert.equal(r.inferenceRequests, 0); assert.equal(calls.length, 1);
  assert.equal(r.costNanoUsd, null);
});

test('R64 preflight HTTP, body and transport failures never dispatch inference', async () => {
  for (const response of [new Response('', { status: 429 }), new Response('invalid'),
    jsonResponse({ object: 'wrong', input_tokens: 100 }),
    jsonResponse({ object: 'response.input_tokens', input_tokens: 100, injected: true })]) {
    let calls = 0;
    const r = await invoke(prepare(), { fetcher: async () => { calls++; return response; } });
    assert.equal(r.kind, 'not_generated'); assert.equal(r.inferenceRequests, 0); assert.equal(calls, 1);
  }
  const failed = await invoke(prepare(), { fetcher: async () => { throw new Error('secret upstream error'); } });
  assert.equal(failed.kind, 'not_generated'); assert.equal(JSON.stringify(failed).includes('secret upstream'), false);
});

test('R64 a disabled flag during token preflight stops generation', async () => {
  const env = environment(), p = prepare({ env }); let calls = 0;
  const r = await invoke(p, { env, fetcher: async () => { calls++; env.JENIOS_ROBOT_ANALYST_PAID_ENABLED = 'false';
    return jsonResponse({ object: 'response.input_tokens', input_tokens: 100 }); } });
  assert.equal(r.kind, 'not_generated'); assert.equal(r.inferenceRequests, 0); assert.equal(calls, 1);
});

test('R64 ambiguous inference failures retain unknown usage and never retry', async () => {
  for (const mode of ['throw', 'http', 'malformed', 'oversized']) {
    let calls = 0;
    const r = await invoke(prepare(), { fetcher: async url => {
      calls++; if (url.endsWith('/input_tokens')) return jsonResponse({ object: 'response.input_tokens', input_tokens: 100 });
      if (mode === 'throw') throw new Error('credential should never be printed');
      if (mode === 'http') return new Response('', { status: 429 });
      if (mode === 'malformed') return new Response('{');
      return new Response('x'.repeat(65537));
    } });
    assert.equal(r.kind, 'unknown'); assert.equal(r.costNanoUsd, null);
    assert.equal(r.httpRequests, 2); assert.equal(r.inferenceRequests, 1); assert.equal(calls, 2);
    assert.equal(r.retryAllowed, false); assert.equal(JSON.stringify(r).includes('credential'), false);
  }
});

test('R64 unexpected model, tier, response identity and tool output are unverified', async () => {
  for (const change of [{ model: 'different-model' }, { service_tier: 'priority' },
    { id: 'not-a-response-id' }, { object: 'unexpected' }, { output: [{ type: 'function_call' }] }]) {
    const { fetcher } = transport({ response: envelope(change) });
    const r = await invoke(prepare(), { fetcher });
    assert.equal(r.kind, 'unknown'); assert.equal(r.reason, 'PROVIDER_ENVELOPE_UNVERIFIED');
    assert.equal(r.analysis, null);
  }
});

test('R64 malformed or over-bound usage cannot be treated as a zero charge', async () => {
  const changes = [null, { ...usage(), input_tokens: 8001, total_tokens: 8051 },
    { ...usage(), output_tokens: 701, total_tokens: 801 }, { ...usage(), total_tokens: 1 },
    { ...usage(), input_tokens_details: { cached_tokens: 101, cache_write_tokens: 0 } },
    { ...usage(), input_tokens_details: { cached_tokens: 0 } },
    { ...usage(), input_tokens_details: {} }, { ...usage(), output_tokens_details: {} },
    { ...usage(), output_tokens_details: { reasoning_tokens: 51 } },
    { ...usage(), output_tokens: -1 }, { ...usage(), unrecognized_billable_field: 20 }];
  for (const value of changes) {
    const { fetcher } = transport({ response: envelope({ usage: value }) });
    const r = await invoke(prepare(), { fetcher });
    assert.equal(r.kind, 'unknown'); assert.equal(r.reason, 'PROVIDER_USAGE_UNVERIFIED');
    assert.equal(r.costNanoUsd, null); assert.equal(r.providerResponseId, 'resp_r64_fake_01');
  }
});

test('R64 invalid hypothesis still accounts for confirmed paid usage without exposing it', async () => {
  const bad = hypothesis(); bad.proposals[0].maxAgeMs = 250;
  const { fetcher } = transport({ response: envelope({ output: [{ type: 'message', status: 'completed',
    content: [{ type: 'output_text', text: JSON.stringify(bad) }] }] }) });
  const r = await invoke(prepare(), { fetcher });
  assert.equal(r.kind, 'usage_confirmed'); assert.equal(r.costNanoUsd, 33450);
  assert.equal(r.analysisStatus, 'INVALID'); assert.equal(r.analysis, null); assert.equal(r.analysisDigest, null);
});

test('R64 rejects free text, unknown references, unsupported findings and permission claims', async () => {
  const variants = [() => 'execute arbitrary code', () => ({ ...hypothesis(), mayPromote: true }),
    () => { const h = hypothesis(); h.findings[0].evidenceEventIds = ['evt:ffffffffffffffff']; return h; },
    () => { const h = hypothesis(); h.findings[0].robot = 'manual'; return h; },
    () => { const h = hypothesis(); h.findings.push(clone(h.findings[0])); return h; },
    () => { const h = hypothesis(); h.proposals[0].evidenceEventIds = h.proposals[0].evidenceEventIds.slice(0, 2); return h; }];
  for (const build of variants) {
    const { fetcher } = transport({ response: envelope({ output: [{ type: 'message', status: 'completed',
      content: [{ type: 'output_text', text: JSON.stringify(build()) }] }] }) });
    const r = await invoke(prepare(), { fetcher });
    assert.equal(r.kind, 'usage_confirmed'); assert.equal(r.analysisStatus, 'INVALID'); assert.equal(r.analysis, null);
  }
});

test('R64 control violation forbids freshness hypotheses while retaining charge accounting', async () => {
  const f = createR64TelemetryFixture({ count: 8 });
  const payload = clone(f.envelopes[0].payload);
  payload.event.kind = 'incident'; payload.event.issue = 'CONTROL_VIOLATION';
  const first = verifyR64TelemetryEnvelope(signR64QaPayload(payload, f.privateKey), {
    trustedSource: f.trustedSource, nowMs: f.generatedAtMs });
  const study = studyR64AcceptedTelemetry([first, ...f.receipts.slice(1)], {
    scopeId: f.trustedSource.scopeId, period: f.period, generatedAtMs: f.generatedAtMs });
  const { fetcher } = transport({ response: envelope({ output: [{ type: 'message', status: 'completed',
    content: [{ type: 'output_text', text: JSON.stringify(hypothesis(study)) }] }] }) });
  const r = await invoke(prepare({ study }), { fetcher });
  assert.equal(r.kind, 'usage_confirmed'); assert.equal(r.analysisStatus, 'INVALID'); assert.equal(r.analysis, null);
});

test('R64 incomplete and refused replies settle only their verified usage', async () => {
  for (const response of [envelope({ status: 'incomplete' }), envelope({ output: [{ type: 'message',
    content: [{ type: 'refusal', refusal: 'declined' }] }] })]) {
    const { fetcher } = transport({ response }); const r = await invoke(prepare(), { fetcher });
    assert.equal(r.kind, 'usage_confirmed'); assert.equal(r.costNanoUsd, 33450); assert.equal(r.analysis, null);
    assert.notEqual(r.analysisStatus, 'VALID');
  }
});

test('R64 cancellation before requests makes no attempt; after inference remains unknown', async () => {
  const before = new AbortController(); before.abort(); let calls = 0;
  const r0 = await invoke(prepare(), { signal: before.signal, fetcher: () => { calls++; } });
  assert.equal(r0.kind, 'not_generated'); assert.equal(calls, 0);
  const during = new AbortController();
  const r1 = await invoke(prepare(), { signal: during.signal, fetcher: async url => {
    calls++; if (url.endsWith('/input_tokens')) return jsonResponse({ object: 'response.input_tokens', input_tokens: 100 });
    during.abort(); return new Promise(() => {});
  } });
  assert.equal(r1.kind, 'unknown'); assert.equal(r1.inferenceRequests, 1); assert.equal(calls, 2);
});

test('R64 total transport deadline aborts an unresponsive inference after ten seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0, inferenceSignal;
  const pending = invoke(prepare(), { fetcher: async (url, options) => {
    calls++; if (url.endsWith('/input_tokens')) return jsonResponse({ object: 'response.input_tokens', input_tokens: 100 });
    inferenceSignal = options.signal; return new Promise(() => {});
  } });
  await nextTurn(); assert.equal(calls, 2);
  t.mock.timers.tick(9999); assert.equal(inferenceSignal.aborted, false);
  t.mock.timers.tick(1); const r = await pending;
  assert.equal(inferenceSignal.aborted, true); assert.equal(r.kind, 'unknown'); assert.equal(r.inferenceRequests, 1);
});
