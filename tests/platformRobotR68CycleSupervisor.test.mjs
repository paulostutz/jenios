import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { isR68WorkerEnabled, runR68R65Worker } from '../lib/platform/research/robot-r68-cycle-supervisor.mjs';

const env = () => ({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_R65_ENABLED: 'true', JENIOS_ROBOT_R68_WORKER_ENABLED: 'true',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false' });
const result = (overrides = {}) => ({ status: 'WAITING_OBSERVATIONS', revision: 0,
  productionMonitoringStarted: false, privateEngineConnected: false, realOrdersSent: 0, externalPaperOrdersSent: 0,
  actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null, ...overrides });

test('R68 supervisor requires all QA, explicit worker and disabled paid/execution gates before touching runtime', async () => {
  let calls = 0;
  const runtime = { get runTick() { calls++; throw Error('must not touch'); } };
  for (const candidate of [{}, { ...env(), VERCEL_ENV: 'production' }, { ...env(), JENIOS_ROBOT_R65_ENABLED: 'false' },
    { ...env(), JENIOS_ROBOT_R68_WORKER_ENABLED: 'false' }, { ...env(), JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'true' },
    { ...env(), JENIOS_ROBOT_ANALYST_PAID_ENABLED: undefined }, { ...env(), JENIOS_REAL_EXECUTION_ENABLED: 'true' },
    { ...env(), JENIOS_PRIVATE_PAPER_EXECUTOR: 'true' }]) {
    assert.equal(isR68WorkerEnabled(candidate), false);
    await assert.rejects(runR68R65Worker({ runtime, env: candidate }), { code: 'R68_WORKER_DISABLED' });
  }
  const accessor = env();
  Object.defineProperty(accessor, 'JENIOS_ROBOT_R68_WORKER_ENABLED', { get() { calls++; return 'true'; } });
  assert.equal(isR68WorkerEnabled(accessor), false); assert.equal(calls, 0);
});

test('R68 once starts immediately, performs one R65 tick and projects only bounded event fields', async () => {
  const events = []; let calls = 0;
  const summary = await runR68R65Worker({ env: env(), mode: 'once', emitEvent: event => events.push(event),
    runtime: { async runTick() { calls++; return result({ privateJournal: 'secret-provider-token' }); } } });
  assert.equal(calls, 1); assert.equal(summary.status, 'COMPLETED'); assert.equal(summary.ticksSucceeded, 1);
  assert.deepEqual(events.map(event => event.event), ['STARTED', 'TICK_SUCCEEDED', 'STOPPED']);
  assert.equal(events[1].tick, 1); assert.equal(events[1].requestedAtMs >= events[0].observedAtMs, true);
  assert.equal(JSON.stringify({ events, summary }).includes('secret'), false);
  assert.equal(summary.crossProcessFence, false); assert.equal(summary.hostedServiceRegistered, false);
});

test('R68 nextAtMs scheduling preserves the 250 ms floor and 60 second ceiling without waiting for the ceiling', async () => {
  for (const [offset, expected] of [[-1000, 250], [3600000, 60000]]) {
    const controller = new AbortController(), events = [];
    const summary = await runR68R65Worker({ env: env(), signal: controller.signal,
      runtime: { async runTick() { return result({ status: 'WAITING_VALIDATION_WINDOW', nextAtMs: Date.now() + offset }); } },
      emitEvent(event) { events.push(event); if (event.event === 'WAITING') controller.abort(); } });
    assert.equal(events.find(event => event.event === 'WAITING').delayMs, expected);
    assert.equal(summary.ticksStarted, 1); assert.equal(summary.status, 'STOPPED');
  }
});

test('R68 short transient retry remains serial and resets the consecutive failure counter', async () => {
  const controller = new AbortController(), events = []; let calls = 0, active = 0, maximum = 0;
  const summary = await runR68R65Worker({ env: env(), signal: controller.signal,
    runtime: { async runTick() { active++; maximum = Math.max(maximum, active);
      try { if (++calls === 1) throw Object.assign(Error('private-database-secret'), { code: 'R65_DATABASE_UNAVAILABLE' });
        return result(); } finally { active--; } } },
    emitEvent(event) { events.push(event); if (event.event === 'TICK_SUCCEEDED') controller.abort(); } });
  assert.equal(calls, 2); assert.equal(maximum, 1); assert.equal(summary.consecutiveFailures, 0);
  assert.equal(events.find(event => event.event === 'WAITING').delayMs, 1000);
  assert.equal(events.find(event => event.event === 'TICK_FAILED').code, 'R65_DATABASE_UNAVAILABLE');
  assert.equal(JSON.stringify(events).includes('private-database-secret'), false);
});

test('R68 stops after five consecutive failures and never schedules a sixth tick', async () => {
  const events = []; let calls = 0;
  const summary = await runR68R65Worker({ env: env(), runtime: { async runTick() { calls++; throw Error('sensitive exception'); } },
    emitEvent: event => events.push(event) });
  assert.equal(calls, 5); assert.equal(summary.status, 'FAILED'); assert.equal(summary.code, 'R68_WORKER_RETRY_LIMIT');
  assert.equal(events.filter(event => event.event === 'WAITING').length, 4);
  assert.equal(events.filter(event => event.event === 'TICK_FAILED').length, 5);
  assert.equal(JSON.stringify(events).includes('sensitive'), false);
});

test('R68 stop waits for the in-flight tick and retains exclusion until that tick settles', async () => {
  const controller = new AbortController(); let release, calls = 0, resolved = false;
  const pending = new Promise(resolve => { release = resolve; });
  const running = runR68R65Worker({ env: env(), signal: controller.signal,
    runtime: { async runTick() { calls++; return pending; } } });
  running.then(() => { resolved = true; }); await turn();
  controller.abort(); await turn();
  assert.equal(calls, 1); assert.equal(resolved, false);
  await assert.rejects(runR68R65Worker({ env: env(), mode: 'once', runtime: { async runTick() { throw Error('must not run'); } } }),
    { code: 'R68_WORKER_ALREADY_RUNNING' });
  release(result());
  const summary = await running;
  assert.equal(summary.status, 'STOPPED'); assert.equal(summary.ticksSucceeded, 1); assert.equal(calls, 1);
  assert.equal((await runR68R65Worker({ env: env(), mode: 'once', runtime: { async runTick() { return result(); } } })).status, 'COMPLETED');
});

test('R68 rejects malformed or unsafe R65 results without another tick or raw event output', async () => {
  for (const changed of [{ nextAtMs: NaN }, { status: 'PRIVATE_KEY_SECRET' }, { realOrdersSent: 1 },
    { productionMonitoringStarted: true }, { actualBrokerPnl: 50 }]) {
    let calls = 0; const events = [];
    const summary = await runR68R65Worker({ env: env(), runtime: { async runTick() { calls++; return result(changed); } },
      emitEvent: event => events.push(event) });
    assert.equal(summary.status, 'FAILED'); assert.equal(summary.code, 'R68_WORKER_RESULT_INVALID');
    assert.equal(calls, 1); assert.equal(JSON.stringify(events).includes('PRIVATE_KEY_SECRET'), false);
  }
});

test('R68 rejects clock regression and a broken event sink instead of silently continuing', async t => {
  const originalNow = Date.now; let current = originalNow(), calls = 0;
  t.mock.method(Date, 'now', () => current);
  const summary = await runR68R65Worker({ env: env(), runtime: { async runTick() { calls++; current -= 1; return result(); } } });
  assert.equal(summary.code, 'R68_WORKER_CLOCK_REGRESSION'); assert.equal(calls, 1);
  t.mock.restoreAll();
  const stopped = await runR68R65Worker({ env: env(), runtime: { async runTick() { calls++; return result(); } },
    emitEvent() { throw Error('private-sink-secret'); } });
  assert.equal(stopped.code, 'R68_WORKER_EVENT_SINK_FAILED'); assert.equal(calls, 1);
});

test('R68 rechecks mutable environment gates before the next tick', async () => {
  const declared = env(); let calls = 0;
  const summary = await runR68R65Worker({ env: declared, runtime: { async runTick() {
    calls++; return result({ status: 'WAITING_VALIDATION_WINDOW', nextAtMs: Date.now() - 1 }); } },
  emitEvent(event) { if (event.event === 'WAITING') declared.JENIOS_ROBOT_ANALYST_PAID_ENABLED = 'true'; } });
  assert.equal(summary.code, 'R68_WORKER_DISABLED'); assert.equal(calls, 1);
});
