/** Focused process/scheduler acceptance, not a recertification of R65 strategy.
 * Two pre-registered synthetic R65 plans use unchanged local PostgreSQL time:
 * restart + short transient failure inside the window; restart after closure.
 * No private R67 executable/source, hosted service, real Auth or paid provider.
 */
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createR68WorkerPostgres } from '../../../tests/fixtures/r68-worker-process.mjs';
import { createR64DatabaseStore, hashR64CycleInput } from '../../../lib/platform/research/robot-r64-database-store.mjs';
import { createR65DatabaseStore } from '../../../lib/platform/research/robot-r65-database-store.mjs';
import { createR65EvolutionState, registerR65Evaluation } from '../../../lib/platform/research/robot-r65-evolution-engine.mjs';
import { createR65RegisteredBenchmark, r65OperationId } from '../../../lib/platform/research/robot-r65-cycle-worker.mjs';
import { createR65ObservationSource, verifyR65ObservationRecord } from '../../../lib/platform/research/robot-r65-observation-source.mjs';
import { scheduleR64TelemetryPeriod, studyR64AcceptedTelemetry } from '../../../lib/platform/research/robot-r64-telemetry.mjs';

const startedAt = new Date().toISOString(), checks = [], children = [];
const check = (name, ok = true) => { assert.ok(ok, name); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const env = { VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
  JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_R65_ENABLED: 'true', JENIOS_ROBOT_R68_WORKER_ENABLED: 'true',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false' };
const { psql, db } = createR68WorkerPostgres();
const observationStore = createR64DatabaseStore({ db }), lifecycleStore = createR65DatabaseStore({ db });
const noProvider = () => ({ kind: 'not_generated', reason: 'DISABLED', fingerprint: null, model: null,
  pricingVersion: null, providerResponseId: null, usage: null, costNanoUsd: null, analysis: null,
  analysisStatus: 'NOT_AVAILABLE', httpRequests: 0, inferenceRequests: 0, retryAllowed: false, mayPromote: false });
const report = (scopeId, periodKey) => ({ schema: 'JENIOS_R64_OPERATIONAL_REPORT_V1', evidenceKind: 'SIGNED_QA_REPLAY',
  scopeId, periodKey, actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
  realOrdersSent: 0, externalPaperOrdersSent: 0, productionMonitoringStarted: false });
const waitUntil = async atMs => {
  while (Date.now() < atMs) await new Promise(resolve => setTimeout(resolve, Math.min(250, atMs - Date.now())));
};

function launch(scopeId, { loseFirstCaptureAck = false, stopAfterStatus = null } = {}) {
  const childEnv = { ...process.env, ...env, JENIOS_R68_WORKER_PROCESS_FIXTURE: 'true' };
  // No inherited preload may replace the wall clock or execute unrelated code.
  delete childEnv.NODE_OPTIONS;
  const child = fork(fileURLToPath(new URL('../../../tests/fixtures/r68-worker-process.mjs', import.meta.url)), [],
    { env: childEnv, execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const messages = [], waiters = new Set(); let outputBytes = 0;
  const state = { child, messages, scopeId, exited: false };
  state.exit = new Promise(resolve => child.once('exit', (code, signal) => { state.exited = true; resolve({ code, signal }); }));
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => {
    outputBytes += bytes.length; if (outputBytes > 65536) child.kill('SIGKILL');
  });
  child.on('message', message => { messages.push(message); for (const wake of waiters) wake(); });
  state.wait = (predicate, timeoutMs = 20000) => new Promise((resolve, reject) => {
    let timer;
    const done = () => {
      const failed = messages.find(message => message.kind === 'error');
      const found = messages.find(predicate);
      if (failed || found) {
        clearTimeout(timer); waiters.delete(done);
        failed ? reject(Error(failed.code)) : resolve(found);
      }
    };
    timer = setTimeout(() => { waiters.delete(done); reject(Error('R68_ACCEPTANCE_CHILD_TIMEOUT')); }, timeoutMs);
    waiters.add(done); done();
  });
  children.push(state); child.send({ action: 'start', scopeId, loseFirstCaptureAck, stopAfterStatus });
  return state;
}
async function killBeforeWindow(processState, plan) {
  const waiting = await processState.wait(message => message.kind === 'event' && message.event.event === 'WAITING');
  assert.equal(waiting.event.status, 'WAITING_VALIDATION_WINDOW');
  assert.equal(waiting.event.nextAtMs, plan.startsAtMs);
  assert.ok(Date.now() < plan.startsAtMs, 'Restart fixture must stop before its future window');
  processState.child.kill('SIGKILL');
  assert.equal((await processState.exit).signal, 'SIGKILL');
  return waiting.event;
}

async function seedPending(scopeId, suffix) {
  const scheduled = scheduleR64TelemetryPeriod({ nowMs: Date.now() });
  const initial = createR65EvolutionState({ scopeId, nowMs: scheduled.period.startMs });
  const { privateKey } = generateKeyPairSync('ed25519');
  const source = createR65ObservationSource({ enabled: true, domain: 'R61_SYNTHETIC_RUNTIME', scopeId,
    sourceId: 'source:' + suffix, sessionId: 'session:' + suffix,
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }), getActiveState: () => initial, initialSequence: 1,
    now: Date.now, getOccurrenceTimeMs: ({ sequence }) => scheduled.period.endMs - 10000 + sequence * 100,
    ultraConfig: { evidenceKind: 'SYNTHETIC_FIXTURE', sessionId: 'session:' + suffix,
      planCode: 'platform-global-crypto', symbol: 'BTC-USD', capital: 1000, leverage: 2 } });
  const receipts = [];
  for (let index = 0; index < 3; index++) {
    const record = source.captureUltra({ operationId: r65OperationId(scopeId, 'R68_SOURCE', index),
      event: { type: 'snapshot', scenario: 'normal', marketAgeMs: 800 + index * 100 } });
    const admitted = verifyR65ObservationRecord(record, { trustedSource: source.trustedSource, nowMs: Date.now() });
    await lifecycleStore.ingestObservation({ receipt: admitted.receipt, provenance: admitted.provenance });
    receipts.push(admitted.receipt);
  }
  const studyAtMs = Date.now(), study = studyR64AcceptedTelemetry(receipts, { scopeId, period: scheduled.period, generatedAtMs: studyAtMs });
  const input = { schema: 'JENIOS_R64_OPERATIONAL_CYCLE_INPUT_V1', evidenceKind: 'SIGNED_QA_REPLAY',
    scopeId, periodKey: study.periodKey, study };
  const sourceCycle = await observationStore.claimCycle({ scopeId, periodKey: study.periodKey, input, inputDigest: hashR64CycleInput(input) });
  await observationStore.completeCycle({ cycleId: sourceCycle.cycleId, leaseOwner: sourceCycle.leaseOwner,
    leaseGeneration: sourceCycle.leaseGeneration, report: report(scopeId, study.periodKey), result: noProvider() });
  const saved = await lifecycleStore.appendEvolution({ scopeId, operationId: r65OperationId(scopeId, 'INITIALIZE'),
    expectedRevision: -1, previousDigest: null, state: initial, actorId: 'system:r65' });
  return { scopeId, initial, saved, receipts, studyAtMs, period: scheduled.period, sourceCycleId: sourceCycle.cycleId };
}
async function registerFuture(prepared) {
  const nowMs = Date.now(), original = createR65RegisteredBenchmark({ scopeId: prepared.scopeId,
    sourceCycleId: prepared.sourceCycleId, nowMs });
  // Prospective fixture scheduling only: four seconds allow two fresh processes
  // to stop/restart in CI. The six original definitions and ten-second window
  // remain unchanged. Date.now and PostgreSQL clocks are never replaced.
  const plan = { ...original, startsAtMs: nowMs + 4000, endsAtMs: nowMs + 14000 };
  const state = registerR65Evaluation({ state: prepared.initial, receipts: prepared.receipts, period: prepared.period,
    studyAtMs: prepared.studyAtMs, sourceCycleId: prepared.sourceCycleId, plan, nowMs, analystHypothesis: null });
  const saved = await lifecycleStore.appendEvolution({ scopeId: prepared.scopeId,
    operationId: r65OperationId(prepared.scopeId, 'REGISTER', prepared.sourceCycleId), expectedRevision: prepared.saved.revision,
    previousDigest: prepared.saved.stateDigest, state, actorId: 'system:r65' });
  return { ...prepared, plan: saved.state.pendingEvaluation.plan, saved, registeredAtMs: nowMs };
}

try {
  assert.equal(await psql('SELECT current_database();'), 'jenios_r68_worker_qa');
  await psql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;" +
    "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;" +
    "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;" +
    'GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;');
  for (const name of ['robot-r64-operational-store.sql', 'robot-r65-lifecycle-store.sql'])
    await psql(readFileSync(new URL('../../../db/schema/' + name, import.meta.url), 'utf8'));
  assert.equal(await psql('SELECT count(*) FROM public.jenios_robot_evolution_r65;'), '0', 'A fresh disposable worker database is required');
  assert.equal(await psql('SELECT count(*) FROM public.jenios_robot_events_r64;'), '0');
  const clockBefore = Date.now(), databaseNow = Number(await psql('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint;'));
  const clockAfter = Date.now();
  assert.ok(databaseNow >= clockBefore - 100 && databaseNow <= clockAfter + 100);
  check('strictly local disposable database uses unmodified PostgreSQL wall clock');
  const seeds = await Promise.all([seedPending('scope:0000000000006801', '0000000000006801'),
    seedPending('scope:0000000000006802', '0000000000006802')]);
  const [resume, missed] = await Promise.all(seeds.map(registerFuture));
  check('two pending plans use original R65 registration, persisted R61 provenance and six unchanged definitions',
    [resume, missed].every(value => value.plan.caseDefinitions.length === 6 && value.plan.startsAtMs > value.registeredAtMs &&
      value.plan.endsAtMs - value.plan.startsAtMs === 10000));

  const initialA = launch(resume.scopeId), initialB = launch(missed.scopeId);
  const [waitingA, waitingB] = await Promise.all([killBeforeWindow(initialA, resume.plan), killBeforeWindow(initialB, missed.plan)]);
  assert.equal((await lifecycleStore.readEvolution({ scopeId: resume.scopeId })).stateDigest, resume.saved.stateDigest);
  assert.equal((await lifecycleStore.readEvolution({ scopeId: missed.scopeId })).stateDigest, missed.saved.stateDigest);
  assert.deepEqual(await lifecycleStore.readValidationCases({ scopeId: resume.scopeId, planId: resume.plan.planId }), []);
  assert.deepEqual(await lifecycleStore.readValidationCases({ scopeId: missed.scopeId, planId: missed.plan.planId }), []);
  check('real process kills before the windows preserve pending plans and create no retrospective cases');

  const recovered = launch(resume.scopeId, { loseFirstCaptureAck: true });
  const immediate = await recovered.wait(message => message.kind === 'event' && message.event.event === 'TICK_SUCCEEDED');
  assert.equal(immediate.event.status, 'WAITING_VALIDATION_WINDOW');
  assert.equal(immediate.event.nextAtMs, resume.plan.startsAtMs);
  assert.ok(immediate.event.completedAtMs < resume.plan.startsAtMs);
  check('restarted supervisor immediately recovers the original pending window from PostgreSQL');

  const failed = await recovered.wait(message => message.kind === 'event' && message.event.event === 'TICK_FAILED');
  assert.equal(failed.event.code, 'R65_DATABASE_UNAVAILABLE');
  const partial = await lifecycleStore.readValidationCases({ scopeId: resume.scopeId, planId: resume.plan.planId });
  assert.equal(partial.length, 1);
  const captured = await recovered.wait(message => message.kind === 'event' && message.event.event === 'TICK_SUCCEEDED' && message.event.status === 'VALIDATION_CAPTURED');
  const cases = await lifecycleStore.readValidationCases({ scopeId: resume.scopeId, planId: resume.plan.planId });
  assert.equal(cases.length, 6);
  assert.ok(cases.every(value => value.occurredAtMs >= resume.plan.startsAtMs && value.occurredAtMs < resume.plan.endsAtMs));
  assert.deepEqual(cases.find(value => value.caseId === partial[0].caseId), partial[0]);
  assert.ok(captured.event.requestedAtMs - failed.event.completedAtMs >= 900);
  assert.equal(recovered.messages.find(message => message.kind === 'event' && message.event.code === 'R68_WORKER_TRANSIENT_RETRY').event.delayMs, 1000);
  check('one-second serial retry recovers a lost capture ACK and retains all six real in-window timestamps');

  await waitUntil(missed.plan.endsAtMs + 50);
  await assert.rejects(lifecycleStore.recordValidationCase({ scopeId: missed.scopeId, planId: missed.plan.planId,
    caseId: missed.plan.caseDefinitions[0].caseId, baselineAllow: false, candidateAllow: false }), /R65_DATABASE_VALIDATION_WINDOW_CLOSED/);
  check('PostgreSQL independently rejects a missing case submitted after its actual window');
  const late = launch(missed.scopeId, { stopAfterStatus: 'REJECTED' });
  const lateResult = await late.wait(message => message.kind === 'result');
  assert.equal(lateResult.summary.status, 'STOPPED'); assert.equal(lateResult.summary.ticksStarted, 1);
  const lateState = await lifecycleStore.readEvolution({ scopeId: missed.scopeId });
  assert.equal(lateState.state.evaluations.at(-1).reason, 'INCOMPLETE_PREREGISTERED_WINDOW');
  assert.equal(lateState.state.activeVersion.maxAgeMs, 750);
  assert.deepEqual(await lifecycleStore.readValidationCases({ scopeId: missed.scopeId, planId: missed.plan.planId }), []);
  check('restart after closure rejects the empty window on its first tick without any backfill');

  await recovered.wait(message => message.kind === 'event' && message.event.event === 'TICK_SUCCEEDED' && message.event.status === 'AUTO_APPLIED');
  recovered.child.kill('SIGTERM');
  const resumedResult = await recovered.wait(message => message.kind === 'result');
  assert.equal(resumedResult.summary.status, 'STOPPED'); assert.equal(resumedResult.fixture.lostCaptureAcks, 1);
  assert.equal(resumedResult.summary.lastStatus, 'AUTO_APPLIED');
  const resumedState = await lifecycleStore.readEvolution({ scopeId: resume.scopeId });
  assert.equal(resumedState.state.activeVersion.maxAgeMs, 500);
  assert.equal(resumedState.state.evaluations.at(-1).validationStartsAtMs, resume.plan.startsAtMs);
  assert.equal((await recovered.exit).code, 0); assert.equal((await late.exit).code, 0);
  check('supervisor follows the persisted closing deadline and exits after the unchanged bounded R65 evaluation');

  assert.equal(await psql('SELECT count(*) FROM public.jenios_robot_validation_cases_r65;'), '6');
  assert.equal(await psql('SELECT count(*) FROM public.jenios_robot_events_r64;'), '6');
  assert.equal(await psql('SELECT count(*) FROM public.jenios_robot_budgets_r64;'), '0');
  assert.equal((await observationStore.readAnalystPolicy()).generationEnabled, false);
  assert.equal(await psql("SELECT to_regclass('public.jenios_robot_private_captures_r67') IS NULL;"), 't');
  check('only six synthetic validation cases exist; paid policy stays disabled and no R67 private table participates');

  const files = ['lib/platform/research/robot-r68-cycle-supervisor.mjs', 'scripts/platform/research/r68-cycle-supervisor.mjs',
    'scripts/platform/research/r68-worker-acceptance.mjs', 'tests/fixtures/r68-worker-process.mjs'];
  const implementationSha256 = Object.fromEntries(files.map(path => [path,
    createHash('sha256').update(readFileSync(new URL('../../../' + path, import.meta.url))).digest('hex')]));
  const evidence = { schema: 'JENIOS_R68_WORKER_ACCEPTANCE_V1', status: 'PASS', commit: process.env.GITHUB_SHA || null,
    startedAt, finishedAt: new Date().toISOString(), counts: { total: checks.length, passed: checks.length, failed: 0, notRun: 0 }, checks,
    scope: { observationOrigin: 'R61_SYNTHETIC_RUNTIME', transportEvidenceKind: 'SIGNED_QA_REPLAY', validationEvidenceKind: 'SYNTHETIC_FIXTURE',
      database: 'REAL_DISPOSABLE_POSTGRESQL', databaseName: 'jenios_r68_worker_qa', databaseRpcTransport: 'LOCAL_PSQL_ADAPTER_NOT_HOSTED_POSTGREST',
      sourceCalendar: 'PINNED_QA_REPLAY_CLOCK_FOR_EXISTING_R65_OBSERVATIONS', validationClock: 'UNMODIFIED_POSTGRESQL_CLOCK_TIMESTAMP',
      prospectiveFixtureStartDelayMs: 4000, originalValidationWindowMs: 10000, originalCaseDefinitionsUnchanged: true,
      productionCliRuntimeFactoryExercised: false, hostedWorkerTested: false, realAdminIdentityTested: false, privateR67SourceLoaded: false,
      crossProcessFenceClaimed: false, supervisorModule: 'runR68R65Worker', tickAlgorithm: 'UNCHANGED_runR65EvolutionTick' },
    execution: { postgresVersion: await psql('SHOW server_version;'), node: process.version, workerProcesses: children.length,
      deliberateSigkills: 2, gracefulSigterms: 1, responseLossesAfterCaptureCommit: 1, validationCases: 6, lateWindowValidationCases: 0,
      windows: [{ scopeId: resume.scopeId, planId: resume.plan.planId, startsAtMs: resume.plan.startsAtMs, endsAtMs: resume.plan.endsAtMs,
        initialWaiting: waitingA, summary: resumedResult.summary, cases },
      { scopeId: missed.scopeId, planId: missed.plan.planId, startsAtMs: missed.plan.startsAtMs, endsAtMs: missed.plan.endsAtMs,
        initialWaiting: waitingB, summary: lateResult.summary, cases: [], rejection: 'INCOMPLETE_PREREGISTERED_WINDOW' }],
      transientFailure: failed.event, recoveredCapture: captured.event }, implementationSha256,
    realOrdersSent: 0, externalPaperOrdersSent: 0, paidProviderCalls: 0, customerMonitoringActive: false,
    privateOperationalSourceActive: false, actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
    commercialPerformanceCertified: false, hostedServiceRegistered: false, productionDatabaseAccessed: false,
    hostedMigrationApplied: false, mergePerformed: false, deploymentPerformed: false };
  const directory = process.env.ROBOT_QA_ARTIFACT_DIR;
  if (directory) { mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, 'r68-worker-acceptance.json'), JSON.stringify(evidence, null, 2) + '\n'); }
  console.log('R68_WORKER_ACCEPTANCE ' + JSON.stringify(evidence));
} finally {
  for (const state of children) if (!state.exited) {
    state.child.kill('SIGTERM');
    const timeout = setTimeout(() => state.child.kill('SIGKILL'), 3000);
    try { await state.exit; } finally { clearTimeout(timeout); }
  }
}
