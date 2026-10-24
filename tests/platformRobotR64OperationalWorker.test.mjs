import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { runR64OperationalCycle } from '../lib/platform/research/robot-r64-operational-worker.mjs';
import { hashR64CycleInput } from '../lib/platform/research/robot-r64-database-store.mjs';
import { PRO_PRICING_VERSION } from '../lib/assistant/pro-pricing.mjs';
import { createR64TelemetryFixture } from '../scripts/platform/research/r64-telemetry-fixtures.mjs';

const fixture = createR64TelemetryFixture();
const NOW = fixture.generatedAtMs, SCOPE = fixture.trustedSource.scopeId;
const clone = value => JSON.parse(JSON.stringify(value));
const environment = (paid = false) => ({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_REAL_EXECUTION_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false',
  JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_ANALYST_PAID_ENABLED: String(paid),
  JENIOS_ROBOT_ANALYST_MODEL: 'gpt-6-luna', OPENAI_API_KEY: 'sk-r64-worker-fixture-never-real-provider' });
const policy = () => ({ generationEnabled: true, requiresReconciliation: false,
  allowedModels: ['gpt-6-luna'], pricingVersion: PRO_PRICING_VERSION, pricingApproved: true,
  ratesVerifiedAt: new Date(NOW).toISOString(), maxRequestProviderNanoUsd: 100000000,
  monthlyProviderLimitNanoUsd: 1000000000 });
const cycleInput = () => ({ schema: 'JENIOS_R64_OPERATIONAL_CYCLE_INPUT_V1',
  evidenceKind: 'SIGNED_QA_REPLAY', scopeId: SCOPE, periodKey: fixture.study.periodKey, study: fixture.study });
function memoryStore({ previous = null, reservation = true, completeFailure = null } = {}) {
  const calls = [], state = { cycle: previous && clone(previous), receipts: fixture.receipts, result: null };
  const store = {
    async readCycle(args) { calls.push(['readCycle', clone(args)]); return state.cycle && clone(state.cycle); },
    async readReceipts(args) { calls.push(['readReceipts', clone(args)]); return state.receipts; },
    async claimCycle(args) {
      calls.push(['claimCycle', clone(args)]);
      if (state.cycle?.status === 'DISPATCHED') {
        state.cycle.status = 'NEEDS_RECONCILIATION';
        return { status: 'NEEDS_RECONCILIATION', cycleId: state.cycle.cycleId };
      }
      if (state.cycle && state.cycle.inputDigest !== args.inputDigest) throw new Error('R64_INPUT_CONFLICT');
      state.cycle = { ...clone(args), status: 'CLAIMED', cycleId: '00000000-0000-4000-8000-000000000064',
        leaseOwner: '00000000-0000-4000-8000-000000000001',
        leaseGeneration: (state.cycle?.leaseGeneration || 0) + 1, report: null };
      return clone(state.cycle);
    },
    async readAnalystPolicy() { calls.push(['readAnalystPolicy']); return policy(); },
    async reserveAndDispatch(args) {
      calls.push(['reserveAndDispatch', clone(args)]);
      if (!reservation) return { dispatchGranted: false, reason: 'INTERNAL_BUDGET_EXHAUSTED' };
      assert.equal(state.cycle.status, 'CLAIMED'); state.cycle.status = 'DISPATCHED';
      return { dispatchGranted: true, reason: 'DISPATCH_GRANTED' };
    },
    async completeCycle(args) {
      calls.push(['completeCycle', clone(args)]);
      if (completeFailure === 'throw') throw new Error('R64_DURABLE_WRITE_FAILED');
      if (completeFailure === 'missing_report') return { status: 'COMPLETED', cycleId: args.cycleId };
      state.result = clone(args.result);
      state.cycle.status = args.result.kind === 'unknown' ? 'NEEDS_RECONCILIATION' : 'COMPLETED';
      state.cycle.report = clone(args.report);
      return { status: state.cycle.status, cycleId: args.cycleId, report: clone(args.report), replayed: false };
    },
  };
  return { store, calls, state };
}
function providerTransport({ ambiguous = false } = {}) {
  const calls = [];
  return { calls, fetcher: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/input_tokens')) return Response.json({ object: 'response.input_tokens', input_tokens: 100 });
    if (ambiguous) throw new Error('private upstream detail');
    return Response.json({ object: 'response', id: 'resp_r64_worker_fixture', model: 'gpt-6-luna',
      service_tier: 'default', status: 'completed',
      usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 10 },
        output_tokens: 50, output_tokens_details: { reasoning_tokens: 25 }, total_tokens: 150 },
      output: [{ type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text',
        text: JSON.stringify({ schema: 'JENIOS_R64_ANALYST_RESPONSE_V1', assessment: 'HYPOTHESIS_ONLY',
          findings: [], proposals: [] }) }] }] });
  } };
}
const run = (store, options = {}) => runR64OperationalCycle({ store, scopeId: SCOPE,
  env: environment(), nowMs: NOW, ...options });

test('R64 worker stops at disabled or pre-09h gates before consulting durable state', async () => {
  const f = memoryStore();
  await assert.rejects(run(f.store, { env: {} }), /R64_DISABLED/);
  const early = await run(f.store, { nowMs: NOW - 1 });
  assert.equal(early.status, 'NOT_DUE'); assert.equal(f.calls.length, 0);
});

test('R64 observation-only cycle persists its report before returning it, without any provider or promotion', async () => {
  const f = memoryStore(); let invoked = 0;
  const result = await run(f.store, { invokeProvider: async () => { invoked++; throw new Error('must not call'); } });
  assert.equal(result.status, 'STORED_OPERATIONAL_QA_REPORT');
  assert.equal(invoked, 0); assert.equal(f.calls.some(([name]) => name === 'reserveAndDispatch'), false);
  assert.deepEqual(result.report, f.state.cycle.report);
  assert.equal(result.report.observations.eventCount, 7);
  assert.equal(result.report.providerAudit.kind, 'not_generated');
  assert.equal(result.report.automaticPromotionAllowed, false);
  assert.equal(result.report.autonomousChangesApplied, 0);
  assert.equal(result.report.productionMonitoringStarted, false);
  assert.equal(result.report.actualBrokerPnl, null);
  assert.equal(result.report.actualLossesAvoided, null);
  assert.equal(result.report.realTradeAccuracy, null);
  assert.equal(result.report.realOrdersSent, 0);
  assert.equal(result.report.externalPaperOrdersSent, 0);
});

test('R64 resumes the frozen period snapshot and does not incorporate late replay events', async () => {
  const input = cycleInput();
  const f = memoryStore({ previous: { status: 'CLAIMED', cycleId: '00000000-0000-4000-8000-000000000064',
    input, inputDigest: hashR64CycleInput(input), leaseGeneration: 1, report: null } });
  f.state.receipts = createR64TelemetryFixture({ count: 20 }).receipts;
  const result = await run(f.store, { nowMs: NOW + 60000 });
  assert.equal(result.report.observations.eventCount, 7);
  assert.equal(result.report.snapshotCapturedAtMs, NOW);
  assert.equal(result.report.generatedAtMs, NOW + 60000);
  assert.equal(f.calls.some(([name]) => name === 'readReceipts'), false);
  assert.equal(f.state.cycle.leaseGeneration, 2);
});

test('R64 rejects a tampered frozen input before acquiring a lease or reserving funds', async () => {
  const input = cycleInput(), digest = hashR64CycleInput(input), changed = clone(input);
  changed.study.metrics.eventCount++;
  const f = memoryStore({ previous: { status: 'CLAIMED', input: changed, inputDigest: digest } });
  await assert.rejects(run(f.store), /R64_FROZEN_INPUT_INVALID/);
  assert.deepEqual(f.calls.map(([name]) => name), ['readCycle']);
});

test('R64 confirmed provider usage is durably recorded once and a repeated scheduler call cannot redispatch', async () => {
  const f = memoryStore(), transport = providerTransport();
  const first = await run(f.store, { env: environment(true), fetcher: transport.fetcher });
  assert.equal(first.status, 'STORED_OPERATIONAL_QA_REPORT');
  assert.equal(first.report.providerAudit.kind, 'usage_confirmed');
  assert.equal(first.report.providerAudit.costNanoUsd, 33450);
  assert.equal(first.report.providerAudit.httpRequests, 2);
  assert.equal(first.report.providerAudit.inferenceRequests, 1);
  assert.equal(first.report.hypotheses.confidenceIsMeasured, false);
  assert.equal(first.report.automaticPromotionAllowed, false);
  const second = await run(f.store, { env: environment(true), fetcher: transport.fetcher });
  assert.equal(second.status, 'ALREADY_STORED');
  assert.equal(Object.hasOwn(second, 'report'), false);
  assert.equal(transport.calls.length, 2);
  assert.equal(f.calls.filter(([name]) => name === 'reserveAndDispatch').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'completeCycle').length, 1);
});

test('R64 denied durable reservation yields an observation report without invoking transport', async () => {
  const f = memoryStore({ reservation: false }); let invoked = 0;
  const result = await run(f.store, { env: environment(true), invokeProvider: async () => { invoked++; } });
  assert.equal(invoked, 0);
  assert.equal(result.report.providerAudit.reason, 'INTERNAL_BUDGET_EXHAUSTED');
  assert.equal(result.report.providerAudit.costNanoUsd, null);
  assert.equal(result.report.hypotheses, null);
});

test('R64 ambiguous inference is recorded for reconciliation and subsequent cycles never retry it', async () => {
  const f = memoryStore(), transport = providerTransport({ ambiguous: true });
  const first = await run(f.store, { env: environment(true), fetcher: transport.fetcher });
  assert.equal(first.status, 'NEEDS_RECONCILIATION');
  assert.equal(first.report.maturity.stage, 'RECONCILIATION_REQUIRED');
  assert.equal(first.report.providerAudit.costNanoUsd, null);
  assert.equal(first.report.providerAudit.retryAllowed, false);
  assert.equal(first.report.hypotheses, null);
  const second = await run(f.store, { env: environment(true), fetcher: transport.fetcher });
  assert.equal(second.status, 'NEEDS_RECONCILIATION');
  assert.equal(transport.calls.length, 2);
  assert.equal(JSON.stringify(first).includes('private upstream detail'), false);
});

test('R64 exceptions after dispatch or during completion leave the durable attempt blocked without exposing a report', async () => {
  for (const failure of ['provider', 'completion']) {
    const f = memoryStore({ completeFailure: failure === 'completion' ? 'throw' : null });
    const transport = providerTransport(); let unexpectedInvocations = 0;
    const options = { env: environment(true), fetcher: transport.fetcher };
    if (failure === 'provider') options.invokeProvider = async () => { unexpectedInvocations++; throw new Error('unexpected transport fault'); };
    await assert.rejects(run(f.store, options));
    assert.equal(f.state.cycle.status, 'DISPATCHED');
    assert.equal(f.state.cycle.report, null);
    const next = await run(f.store, options);
    assert.equal(next.status, 'NEEDS_RECONCILIATION');
    assert.equal(Object.hasOwn(next, 'report'), false);
    assert.equal(f.calls.filter(([name]) => name === 'reserveAndDispatch').length, 1);
    assert.equal(failure === 'provider' ? unexpectedInvocations : transport.calls.length, failure === 'provider' ? 1 : 2);
  }
});

test('R64 cannot substitute an in-memory report for a completion response that omitted the persisted report', async () => {
  const f = memoryStore({ completeFailure: 'missing_report' });
  await assert.rejects(run(f.store), /R64_DURABLE_COMPLETION_UNCONFIRMED/);
  assert.equal(f.state.cycle.report, null);
});

test('R64 withholds the report until the durable completion promise resolves', async () => {
  const f = memoryStore(); let release, settled = false;
  const gate = new Promise(resolve => { release = resolve; });
  const complete = f.store.completeCycle;
  f.store.completeCycle = async args => { await gate; return complete(args); };
  const pending = run(f.store).then(result => { settled = true; return result; });
  await turn();
  assert.equal(settled, false); assert.equal(f.state.cycle.report, null);
  release(); const done = await pending;
  assert.equal(settled, true); assert.deepEqual(done.report, f.state.cycle.report);
});

test('R64 a busy claim leaves provider policy, dispatch and completion untouched', async () => {
  const f = memoryStore();
  f.store.claimCycle = async () => ({ status: 'BUSY', cycleId: '00000000-0000-4000-8000-000000000064' });
  const result = await run(f.store, { env: environment(true) });
  assert.equal(result.status, 'BUSY');
  assert.equal(f.calls.some(([name]) => ['readAnalystPolicy', 'reserveAndDispatch', 'completeCycle'].includes(name)), false);
});
