/** Foreground QA supervisor for the existing R65 tick. No strategy is changed.
 * One invocation/tick runs at a time in this module instance. There is no
 * cross-process/host fence, service registration, provider call or scheduler
 * installation here. Restart reads the authoritative state through R65 itself.
 * A stop request waits for an in-flight tick; no timeout abandons a write and
 * starts an overlapping retry. A hung dependency therefore needs host recovery.
 */
import { isRobotR65CycleEnabled } from './robot-r65-cycle-access.mjs';

export const R68_WORKER_LIMITS = Object.freeze({ minimumDelayMs: 250, maximumDelayMs: 60000,
  transientRetryMs: 1000, maximumConsecutiveFailures: 5 });
const ENV_KEYS = ['VERCEL_ENV', 'JENIOS_QA_CANDIDATE_ENABLED', 'JENIOS_ROBOT_QA_ENABLED',
  'JENIOS_ROBOT_R64_ENABLED', 'JENIOS_ROBOT_R65_ENABLED', 'JENIOS_REAL_EXECUTION_ENABLED',
  'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED', 'JENIOS_PRIVATE_PAPER_EXECUTOR',
  'JENIOS_ROBOT_R68_WORKER_ENABLED', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED'];
const STATUSES = new Set(['NOT_DUE', 'WAITING_VALIDATION_WINDOW', 'VALIDATION_CAPTURED',
  'EVALUATION_REGISTERED', 'AUTO_APPLIED', 'REJECTED', 'NO_CHANGE', 'NO_NEW_AUTHORIZED_CANDIDATE',
  'OBSERVATION_RECONCILIATION_REQUIRED', 'WAITING_OBSERVATIONS', 'SOURCE_CYCLE_ALREADY_USED', 'NO_ELIGIBLE_OBSERVATION']);
const SAFE_FAILURES = new Set(['R64_DATABASE_UNAVAILABLE', 'R65_DATABASE_UNAVAILABLE',
  'R65_DATABASE_REVISION_CONFLICT', 'R65_DATABASE_OPERATION_CONFLICT', 'R65_EVOLUTION_CONFLICT',
  'R65_DURABLE_STATE_UNCONFIRMED']);
const INTERNAL_FAILURES = new Set(['R68_WORKER_DISABLED', 'R68_WORKER_CLOCK_INVALID',
  'R68_WORKER_CLOCK_REGRESSION', 'R68_WORKER_RESULT_INVALID', 'R68_WORKER_EVENT_SINK_FAILED']);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const own = (object, key) => {
  if (!object || typeof object !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
};
let running = false;

export function isR68WorkerEnabled(env = {}) {
  const declared = Object.fromEntries(ENV_KEYS.map(key => [key, own(env, key)]));
  return isRobotR65CycleEnabled(declared) && declared.JENIOS_ROBOT_R68_WORKER_ENABLED === 'true' &&
    declared.JENIOS_ROBOT_ANALYST_PAID_ENABLED === 'false';
}
export function requireR68WorkerEnabled(env = {}) {
  if (!isR68WorkerEnabled(env)) fail('R68_WORKER_DISABLED');
}

function resultFields(value) {
  const status = own(value, 'status'), revision = own(value, 'revision'), next = own(value, 'nextAtMs');
  if (!STATUSES.has(status) || !Number.isSafeInteger(revision) || revision < 0 || revision > 32 ||
      !(next === undefined || next === null || Number.isSafeInteger(next) && next >= 0) ||
      ['NOT_DUE', 'WAITING_VALIDATION_WINDOW', 'VALIDATION_CAPTURED', 'EVALUATION_REGISTERED'].includes(status) &&
        !Number.isSafeInteger(next) ||
      own(value, 'productionMonitoringStarted') !== false || own(value, 'privateEngineConnected') !== false ||
      own(value, 'realOrdersSent') !== 0 || own(value, 'externalPaperOrdersSent') !== 0 ||
      ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy'].some(key => own(value, key) !== null))
    fail('R68_WORKER_RESULT_INVALID');
  return { status, revision, nextAtMs: next ?? null };
}
function pause(milliseconds, signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    let timer;
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    signal.addEventListener('abort', done, { once: true });
    timer = setTimeout(done, milliseconds);
    if (signal.aborted) done();
  });
}

export async function runR68R65Worker({ runtime, env = {}, signal = new AbortController().signal,
  emitEvent = () => {}, mode = 'watch' } = {}) {
  requireR68WorkerEnabled(env);
  if (!['once', 'watch'].includes(mode) || !(signal instanceof AbortSignal) || typeof emitEvent !== 'function' ||
      typeof own(runtime, 'runTick') !== 'function') fail('R68_WORKER_CONFIGURATION');
  if (running) fail('R68_WORKER_ALREADY_RUNNING');
  running = true;
  const runTick = own(runtime, 'runTick');
  let startedAtMs = null, lastObservedAtMs = null, ticksStarted = 0, ticksSucceeded = 0, ticksFailed = 0;
  let consecutiveFailures = 0, last = { status: null, revision: null, nextAtMs: null };
  const clock = () => {
    const value = Date.now();
    if (!Number.isSafeInteger(value) || value < 0) fail('R68_WORKER_CLOCK_INVALID');
    if (lastObservedAtMs !== null && value < lastObservedAtMs) fail('R68_WORKER_CLOCK_REGRESSION');
    lastObservedAtMs = value; return value;
  };
  const emit = async (event, details = {}) => {
    const value = Object.freeze({ schema: 'JENIOS_R68_CYCLE_SUPERVISOR_EVENT_V1', event,
      observedAtMs: lastObservedAtMs, tick: ticksStarted, status: last.status, revision: last.revision,
      nextAtMs: last.nextAtMs, consecutiveFailures, ...details });
    try { await emitEvent(value); } catch { fail('R68_WORKER_EVENT_SINK_FAILED'); }
  };
  const finish = async (status, code) => {
    const summary = Object.freeze({ schema: 'JENIOS_R68_CYCLE_SUPERVISOR_RESULT_V1', mode, status, code,
      startedAtMs, stoppedAtMs: lastObservedAtMs, ticksStarted, ticksSucceeded, ticksFailed,
      consecutiveFailures, lastStatus: last.status, revision: last.revision, nextAtMs: last.nextAtMs,
      singleFlight: true, crossProcessFence: false, hostedServiceRegistered: false,
      productionSchedulerStarted: false });
    await emit('STOPPED', { status, code });
    return summary;
  };
  try {
    startedAtMs = clock(); await emit('STARTED');
    while (true) {
      if (signal.aborted) { clock(); return await finish('STOPPED', 'R68_WORKER_STOP_REQUESTED'); }
      // Recheck mutable process configuration before every subsequent tick.
      requireR68WorkerEnabled(env);
      const requestedAtMs = clock(); ticksStarted++;
      let raw, failed = false, failureCode = null;
      try { raw = await Reflect.apply(runTick, runtime, []); }
      catch (error) {
        failed = true;
        const code = own(error, 'code');
        failureCode = SAFE_FAILURES.has(code) ? code : 'R68_WORKER_TICK_UNAVAILABLE';
      }
      const completedAtMs = clock();
      if (failed) {
        ticksFailed++; consecutiveFailures++;
        await emit('TICK_FAILED', { requestedAtMs, completedAtMs, code: failureCode });
      } else {
        last = resultFields(raw); ticksSucceeded++; consecutiveFailures = 0;
        await emit('TICK_SUCCEEDED', { requestedAtMs, completedAtMs, code: null });
      }
      if (signal.aborted) { clock(); return await finish('STOPPED', 'R68_WORKER_STOP_REQUESTED'); }
      if (mode === 'once') return await finish(failed ? 'FAILED' : 'COMPLETED',
        failed ? failureCode : 'R68_WORKER_ONCE_COMPLETED');
      if (consecutiveFailures >= R68_WORKER_LIMITS.maximumConsecutiveFailures)
        return await finish('FAILED', 'R68_WORKER_RETRY_LIMIT');
      const waitingAtMs = clock();
      const delayMs = failed ? R68_WORKER_LIMITS.transientRetryMs : last.nextAtMs === null
        ? R68_WORKER_LIMITS.maximumDelayMs
        : Math.min(R68_WORKER_LIMITS.maximumDelayMs,
          Math.max(R68_WORKER_LIMITS.minimumDelayMs, last.nextAtMs - waitingAtMs + 50));
      await emit('WAITING', { delayMs, code: failed ? 'R68_WORKER_TRANSIENT_RETRY' : null });
      await pause(delayMs, signal);
    }
  } catch (error) {
    const code = own(error, 'code');
    const safe = INTERNAL_FAILURES.has(code) ? code : 'R68_WORKER_UNAVAILABLE';
    try { return await finish('FAILED', safe); }
    catch {
      // A broken sink cannot justify another tick or a raw diagnostic leak.
      return Object.freeze({ schema: 'JENIOS_R68_CYCLE_SUPERVISOR_RESULT_V1', mode,
        status: 'FAILED', code: 'R68_WORKER_EVENT_SINK_FAILED', startedAtMs, stoppedAtMs: lastObservedAtMs,
        ticksStarted, ticksSucceeded, ticksFailed, consecutiveFailures, lastStatus: last.status,
        revision: last.revision, nextAtMs: last.nextAtMs, singleFlight: true, crossProcessFence: false,
        hostedServiceRegistered: false, productionSchedulerStarted: false });
    }
  } finally { running = false; }
}
