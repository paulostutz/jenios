/** R65 lifecycle acceptance: real disposable loopback PostgreSQL only.
 * No hosted Supabase, provider HTTP request, customer wallet or trading surface.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createR64DatabaseStore, R64_DATABASE_RPCS, hashR64CycleInput } from '../../../lib/platform/research/robot-r64-database-store.mjs';
import { createR65DatabaseStore, R65_DATABASE_RPCS } from '../../../lib/platform/research/robot-r65-database-store.mjs';
import { createR65EvolutionState, registerR65Evaluation, runR65EvolutionCycle, rollbackR65Evolution,
  executeR65ValidationCase } from '../../../lib/platform/research/robot-r65-evolution-engine.mjs';
import { createR65ObservationSource, verifyR65ObservationRecord } from '../../../lib/platform/research/robot-r65-observation-source.mjs';
import { scheduleR64TelemetryPeriod, studyR64AcceptedTelemetry, digestR64Value } from '../../../lib/platform/research/robot-r64-telemetry.mjs';

assert.equal(process.env.JENIOS_R65_DISPOSABLE_DB, 'true', 'Explicit disposable R65 DB flag is required');
const url = new URL(process.env.JENIOS_R65_TEST_DATABASE_URL || 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol) && ['127.0.0.1', 'localhost'].includes(url.hostname));
assert.equal(url.pathname, '/jenios_r65_qa'); assert.equal(url.search, ''); assert.equal(url.hash, '');
const childEnv = { ...process.env, PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1', PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: 'jenios_r65_qa',
  PGOPTIONS: '', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5' };
delete childEnv.PGSERVICE; delete childEnv.PGSERVICEFILE;
const psql = sql => new Promise((resolve, reject) => {
  const process = spawn('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'], { env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  process.stdout.on('data', bytes => { stdout += bytes; }); process.stderr.on('data', bytes => { stderr += bytes; });
  process.on('error', () => reject(Error('R65_POSTGRES_PROCESS_UNAVAILABLE')));
  process.on('close', code => code === 0 ? resolve(stdout.trim()) :
    reject(Error(stderr.match(/R6[45]_[A-Z0-9_]+/)?.[0] || 'R65_POSTGRES_QUERY_FAILED: ' + stderr.slice(0, 1200))));
  process.stdin.end(sql);
});
assert.equal(await psql('SELECT current_database();'), 'jenios_r65_qa');
const checks = [], check = (name, ok = true) => { assert.ok(ok, name); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
const encoded = value => "convert_from(decode('" + Buffer.from(JSON.stringify(value)).toString('base64') + "','base64'),'UTF8')::jsonb";
const names = new Set([...Object.values(R64_DATABASE_RPCS), ...Object.values(R65_DATABASE_RPCS)]);
async function rpc(name, p_input) {
  assert.ok(names.has(name)); return JSON.parse(await psql('SET ROLE service_role; SELECT public.' + name + '(' + encoded(p_input) + ');'));
}
const db = { rpc: async (name, args) => {
  try { return { data: await rpc(name, args.p_input), error: null }; }
  catch (error) { return { data: null, error: { message: error.message } }; }
} };
const r64 = createR64DatabaseStore({ db }), store = createR65DatabaseStore({ db });
const sql64 = readFileSync(new URL('../../../db/schema/robot-r64-operational-store.sql', import.meta.url), 'utf8');
const sql65 = readFileSync(new URL('../../../db/schema/robot-r65-lifecycle-store.sql', import.meta.url), 'utf8');
await psql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;" +
  "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;" +
  "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;" +
  'GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;');
await psql(sql64); await psql(sql65); await psql(sql65);
check('additive review schema applies twice without dropping or purging history');
assert.equal(await psql('SELECT count(*) FROM public.jenios_robot_cycles_r64;'), '0', 'Use a fresh disposable R65 database');
const tables = ['reconciliations', 'archives', 'archive_items', 'evolution', 'validation_cases', 'observation_provenance'];
let denied = 0;
for (const role of ['anon', 'authenticated']) {
  for (const table of tables) {
    await assert.rejects(psql('SET ROLE ' + role + '; SELECT * FROM public.jenios_robot_' + table + '_r65;')); denied++;
  }
  for (const name of Object.values(R65_DATABASE_RPCS)) {
    await assert.rejects(psql('SET ROLE ' + role + '; SELECT public.' + name + "('{}'::jsonb);")); denied++;
  }
}
check('anonymous and authenticated clients cannot access any lifecycle table or RPC', denied === 34);
const rls = Number(await psql("SELECT count(*) FROM pg_class WHERE relname IN(" + tables.map(x => "'jenios_robot_" + x + "_r65'").join(',') + ') AND relrowsecurity;'));
check('all six lifecycle tables have RLS as defense in depth', rls === 6);
await psql('SET ROLE service_role; UPDATE public.jenios_robot_config_r64 SET generation_enabled=false;');
await assert.rejects(psql('SET ROLE service_role; UPDATE public.jenios_robot_config_r64 SET generation_enabled=true;'), /R65_DATABASE_POLICY_ENABLE_FORBIDDEN/);
await assert.rejects(psql('SET ROLE service_role; UPDATE public.jenios_robot_config_r64 SET monthly_limit_nano_usd=1000000;'));
check('worker can disable paid generation but cannot enable it or approve funding');

const scope = n => 'scope:' + n.toString(16).padStart(16, '0');
const operation = n => 'op:' + n.toString(16).padStart(32, '0');
const actorId = 'user:65000000-0000-4000-8000-000000000003';
const periodKey = 'r64:daily:' + new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const noProvider = () => ({ kind: 'not_generated', reason: 'DISABLED', fingerprint: null, model: null,
  pricingVersion: null, providerResponseId: null, usage: null, costNanoUsd: null, analysis: null,
  analysisStatus: 'NOT_AVAILABLE', httpRequests: 0, inferenceRequests: 0, retryAllowed: false, mayPromote: false });
const report = (scopeId, key = periodKey) => ({ schema: 'JENIOS_R64_OPERATIONAL_REPORT_V1', evidenceKind: 'SIGNED_QA_REPLAY',
  scopeId, periodKey: key, actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
  realOrdersSent: 0, externalPaperOrdersSent: 0, productionMonitoringStarted: false });
const lease = c => ({ cycleId: c.cycleId, leaseOwner: c.leaseOwner, leaseGeneration: c.leaseGeneration });
async function claim(scopeId, study, key = periodKey) {
  const input = { schema: 'JENIOS_R64_OPERATIONAL_CYCLE_INPUT_V1', evidenceKind: 'SIGNED_QA_REPLAY',
    scopeId, periodKey: key, study: study ?? { fixture: true } };
  return r64.claimCycle({ scopeId, periodKey: key, input, inputDigest: hashR64CycleInput(input) });
}
const request = n => ({ fingerprint: n.toString(16).padStart(64, '0'), model: 'gpt-6-luna',
  pricingVersion: '2026-10-20-v2-nano', reservationNanoUsd: 1350000, maxInputTokens: 8000, maxOutputTokens: 700 });
async function policy() {
  await psql("UPDATE public.jenios_robot_config_r64 SET generation_enabled=true,allowed_models=ARRAY['gpt-6-luna']," +
    "pricing_version='2026-10-20-v2-nano',pricing_approved=true,rates_verified_at=clock_timestamp()," +
    'max_request_nano_usd=1350000,monthly_limit_nano_usd=1000000000 WHERE singleton=true;');
}
async function uncertain(scopeId, n, crash = false) {
  await policy(); const cycle = await claim(scopeId); const req = request(n);
  assert.equal((await r64.reserveAndDispatch({ ...lease(cycle), request: req })).dispatchGranted, true);
  if (crash) await psql("UPDATE public.jenios_robot_cycles_r64 SET lease_until=clock_timestamp()-interval '1 second' WHERE cycle_id='" + cycle.cycleId + "';");
  else await r64.completeCycle({ ...lease(cycle), report: report(scopeId), result: { ...noProvider(), ...req,
    kind: 'unknown', reason: 'TEST_AMBIGUOUS_OUTCOME', inferenceRequests: 1, httpRequests: 2 } });
  return { scopeId, cycleId: cycle.cycleId, cycle, req };
}
const reconcileArgs = (pending, n, resolution = { kind: 'CONFIRMED_NO_CHARGE', costNanoUsd: 0, providerResponseId: null }) =>
  ({ scopeId: pending.scopeId, cycleId: pending.cycleId, operationId: operation(n), actorId,
    expectedFingerprint: pending.req.fingerprint, evidenceDigest: n.toString(16).padStart(64, '0'), resolution });

const pending = await uncertain(scope(0x651), 1);
check('unknown provider result is visible as a pending reservation', (await store.readOverview({ scopeId: pending.scopeId })).pendingReconciliations.length === 1);
await assert.rejects(store.previewArchive({ scopeId: pending.scopeId, cutoffMs: Date.now() }), /R65_DATABASE_ARCHIVE_PENDING/);
await assert.rejects(store.reconcileCost({ ...reconcileArgs(pending, 1), actorId: 'system:r65' }), /R65_DATABASE_ACTOR/);
await assert.rejects(rpc(R65_DATABASE_RPCS.reconcileCost, { ...reconcileArgs(pending, 1), actorId: 'system:r65' }), /R65_DATABASE_RECONCILIATION/);
await assert.rejects(store.reconcileCost({ ...reconcileArgs(pending, 1), expectedFingerprint: 'f'.repeat(64) }), /R65_DATABASE_REQUEST_BINDING/);
await assert.rejects(store.reconcileCost({ ...reconcileArgs(pending, 1), scopeId: scope(0x652) }), /R65_DATABASE_CYCLE_MISSING/);
check('pending archive, system cost resolution, wrong fingerprint and cross-scope access are denied');
const historical = await psql("SELECT to_jsonb(c) FROM public.jenios_robot_cycles_r64 c WHERE cycle_id='" + pending.cycleId + "';");
const duplicate = await Promise.all([store.reconcileCost(reconcileArgs(pending, 1)), store.reconcileCost(reconcileArgs(pending, 1))]);
check('independent concurrent administrative retries settle exactly once', duplicate.filter(x => x.replayed).length === 1 && duplicate.every(x => x.status === 'RECONCILED'));
const budget = async () => JSON.parse(await psql("SELECT jsonb_build_object('held',sum(reserved_nano_usd),'spent',sum(spent_nano_usd)) FROM public.jenios_robot_budgets_r64;"));
check('confirmed no-charge releases the hold without invented spending', (await budget()).held === 0 && (await budget()).spent === 0);
check('reconciliation preserves the complete original R64 cycle snapshot', historical === await psql("SELECT to_jsonb(c) FROM public.jenios_robot_cycles_r64 c WHERE cycle_id='" + pending.cycleId + "';"));
check('resolved cycle is removed from pending overview without changing historical state',
  (await store.readOverview({ scopeId: pending.scopeId })).pendingReconciliations.length === 0 &&
  (await store.readOverview({ scopeId: pending.scopeId })).reconciliations.length === 1);
check('cost reconciliation leaves paid generation disabled', (await r64.readAnalystPolicy()).generationEnabled === false);
await assert.rejects(store.reconcileCost({ ...reconcileArgs(pending, 1), evidenceDigest: 'f'.repeat(64) }), /R65_DATABASE_OPERATION_CONFLICT/);
await assert.rejects(store.reconcileCost(reconcileArgs(pending, 2)), /R65_DATABASE_ALREADY_RECONCILED/);
check('divergent or renamed resolution retries cannot alter the accounting decision');

const crashed = await uncertain(scope(0x652), 2, true);
const above = await store.reconcileCost(reconcileArgs(crashed, 3, { kind: 'CONFIRMED_USAGE', costNanoUsd: 1350100, providerResponseId: 'resp_r65_confirmed_overage' }));
check('confirmed cost above reservation is accounted with an explicit overage incident', above.overReservation &&
  (await budget()).held === 0 && (await budget()).spent === 1350100);
await assert.rejects(rpc(R64_DATABASE_RPCS.completeCycle, { ...lease(crashed.cycle), report: report(crashed.scopeId),
  result: { ...noProvider(), ...crashed.req, kind: 'unknown', inferenceRequests: 1, httpRequests: 2 } }), /R65_DATABASE_CYCLE_FROZEN/);
check('late crashed worker cannot rewrite a reconciled cycle');
const collision = await uncertain(scope(0x653), 3);
await assert.rejects(store.reconcileCost(reconcileArgs(collision, 4, { kind: 'CONFIRMED_USAGE', costNanoUsd: 10,
  providerResponseId: 'resp_r65_confirmed_overage' })), /R65_DATABASE_PROVIDER_RESPONSE_CONFLICT/);
check('provider response identity cannot settle another cycle', (await budget()).held === 1350000);
await store.reconcileCost(reconcileArgs(collision, 4));
await assert.rejects(psql('SET ROLE service_role; UPDATE public.jenios_robot_reconciliations_r65 SET cost_nano_usd=0;'));
await assert.rejects(psql('SET ROLE service_role; DELETE FROM public.jenios_robot_reconciliations_r65;'));
check('reconciliation ledger has no worker update or delete capability');

const preview = await store.previewArchive({ scopeId: pending.scopeId, cutoffMs: Date.now(), limit: 1 });
assert.equal(await store.readArchive({ scopeId: pending.scopeId, archiveId: preview.archiveId }), null);
const commit = { scopeId: pending.scopeId, archiveId: preview.archiveId, operationId: operation(5), actorId, manifestDigest: preview.manifestDigest };
await assert.rejects(store.commitArchive({ ...commit, manifestDigest: 'f'.repeat(64) }), /R65_DATABASE_ARCHIVE_INTEGRITY/);
await assert.rejects(store.commitArchive({ ...commit, scopeId: scope(0x654) }), /R65_DATABASE_ARCHIVE_MISSING/);
const commits = await Promise.all([store.commitArchive(commit), store.commitArchive(commit)]);
check('archive commit binds scope and reviewed digest and is concurrent-idempotent', commits.filter(x => x.replayed).length === 1);
const archive = await store.readArchive({ scopeId: pending.scopeId, archiveId: preview.archiveId });
check('logical archive returns a verified copy including the administrative resolution', archive.verified &&
  archive.manifest.cycles[0].reconciliation.resolution_kind === 'CONFIRMED_NO_CHARGE' && archive.manifest.spaceReclaimedBytes === 0);
check('archival retains original rows and claims no physical deletion', historical === await psql("SELECT to_jsonb(c) FROM public.jenios_robot_cycles_r64 c WHERE cycle_id='" + pending.cycleId + "';") &&
  archive.manifest.physicalDeletionPerformed === false);
await assert.rejects(psql("SET ROLE service_role; UPDATE public.jenios_robot_archives_r65 SET status='PREVIEW' WHERE archive_id='" + preview.archiveId + "';"), /R65_DATABASE_ARCHIVE_IMMUTABLE/);
await assert.rejects(psql("BEGIN; ALTER TABLE public.jenios_robot_archives_r65 DISABLE TRIGGER USER; UPDATE public.jenios_robot_archives_r65 " +
  "SET manifest=jsonb_set(manifest,'{spaceReclaimedBytes}','1'::jsonb) WHERE archive_id='" + preview.archiveId + "'; SET ROLE service_role; SELECT public." +
  R65_DATABASE_RPCS.readArchive + '(' + encoded({ scopeId: pending.scopeId, archiveId: preview.archiveId }) + '); ROLLBACK;'), /R65_DATABASE_ARCHIVE_INTEGRITY/);
check('committed archives are immutable and digest verification detects injected corruption');

// Run the actual bounded QA observation source; its sidecar remains explicitly synthetic.
const ownerScope = scope(0x65e), scheduled = scheduleR64TelemetryPeriod({ nowMs: Date.now() });
const initial = createR65EvolutionState({ scopeId: ownerScope, nowMs: scheduled.period.startMs });
const { privateKey } = generateKeyPairSync('ed25519');
const source = createR65ObservationSource({ enabled: true, domain: 'R61_SYNTHETIC_RUNTIME', scopeId: ownerScope,
  sourceId: 'source:000000000000065e', sessionId: 'session:000000000000065e',
  privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }), getActiveState: () => initial, initialSequence: 1,
  now: Date.now, getOccurrenceTimeMs: ({ sequence }) => scheduled.period.endMs - 10000 + sequence * 100,
  ultraConfig: { evidenceKind: 'SYNTHETIC_FIXTURE', sessionId: 'session:000000000000065e',
    planCode: 'platform-global-crypto', symbol: 'BTC-USD', capital: 1000, leverage: 2 } });
const receipts = [], provenances = [];
for (let index = 0; index < 3; index++) {
  const record = source.captureUltra({ operationId: operation(100 + index), event: { type: 'snapshot', scenario: 'normal', marketAgeMs: 800 + index * 100 } });
  const admitted = verifyR65ObservationRecord(record, { trustedSource: source.trustedSource, nowMs: Date.now() });
  receipts.push(admitted.receipt); provenances.push(admitted.provenance);
}
const ingestion = await Promise.all([store.ingestObservation({ receipt: receipts[0], provenance: provenances[0] }),
  store.ingestObservation({ receipt: receipts[0], provenance: provenances[0] })]);
check('observation and signed runtime provenance are atomically idempotent', ingestion.filter(x => x.status === 'STORED').length === 1);
for (let i = 1; i < receipts.length; i++) await store.ingestObservation({ receipt: receipts[i], provenance: provenances[i] });
await assert.rejects(store.ingestObservation({ receipt: receipts[0], provenance: { ...provenances[0], inputDigest: 'f'.repeat(64) } }), /R65_DATABASE_PROVENANCE_CONFLICT/);
check('conflicting runtime provenance cannot replace an admitted observation');
const studyAtMs = Date.now(), study = studyR64AcceptedTelemetry(receipts, { scopeId: ownerScope, period: scheduled.period, generatedAtMs: studyAtMs });
const sourceCycle = await claim(ownerScope, study, study.periodKey);
await r64.completeCycle({ ...lease(sourceCycle), result: noProvider(), report: report(ownerScope, study.periodKey) });
check('disabled generation yields no model hypothesis from a completed source cycle',
  await store.readCycleHypothesis({ scopeId: ownerScope, cycleId: sourceCycle.cycleId }) === null);

const initialize = { scopeId: ownerScope, operationId: operation(200), expectedRevision: -1, previousDigest: null, state: initial, actorId: 'system:r65' };
const inits = await Promise.all([store.appendEvolution(initialize), store.appendEvolution(initialize)]);
check('concurrent initialization creates one immutable evolution revision', inits.filter(x => x.replayed).length === 1);
let current = await store.readEvolution({ scopeId: ownerScope });
await assert.rejects(store.appendEvolution({ ...initialize, operationId: operation(201) }), /R65_DATABASE_REVISION_CONFLICT/);
check('a stale creation cannot overwrite an existing evolution state');

const nowMs = Date.now(), definitions = [[100, true], [200, true], [600, false], [700, false], [900, false], [1000, false]]
  .map(([age, expectedAllow], i) => ({ caseId: 'case:' + (i + 1).toString(16).padStart(16, '0'), snapshotAgesMs: [age, age], expectedAllow }));
const plan = { planId: 'plan:0000000000000001', scopeId: ownerScope, evidenceKind: 'SYNTHETIC_FIXTURE',
  startsAtMs: nowMs + 3000, endsAtMs: nowMs + 8000, caseDefinitions: definitions };
const registered = registerR65Evaluation({ state: initial, receipts, period: scheduled.period, studyAtMs,
  sourceCycleId: sourceCycle.cycleId, plan, nowMs, analystHypothesis: null });
const registerArgs = { scopeId: ownerScope, operationId: operation(202), expectedRevision: 0, previousDigest: current.stateDigest,
  state: registered, actorId: 'system:r65' };
const forged = structuredClone(registered); forged.journal[0].receipts[0].payloadDigest = 'f'.repeat(64);
await assert.rejects(rpc(R65_DATABASE_RPCS.appendEvolution, { ...registerArgs, state: forged }), /R65_DATABASE_PROVENANCE_BINDING/);
check('SQL registration independently requires persisted runtime provenance for every receipt');
const saved = await store.appendEvolution(registerArgs); current = saved;
check('prospective plan is stored with the complete immutable observation journal', saved.revision === 1 && saved.state.pendingEvaluation.plan.planId === plan.planId);
const firstCase = { scopeId: ownerScope, planId: plan.planId, caseId: definitions[0].caseId, baselineAllow: true, candidateAllow: true };
await assert.rejects(store.recordValidationCase(firstCase), /R65_DATABASE_VALIDATION_WINDOW_CLOSED/);
check('validation cannot be recorded before the database-clock window opens');
async function until(time) { while (Date.now() < time) await new Promise(resolve => setTimeout(resolve, Math.min(100, time - Date.now()))); }
await until(plan.startsAtMs + 50);
Object.assign(firstCase, executeR65ValidationCase({ state: registered, caseId: firstCase.caseId, nowMs: Date.now() }));
const observedAt = Date.now(), pair = await Promise.all([store.recordValidationCase(firstCase), store.recordValidationCase(firstCase)]);
check('concurrent case retries retain the first authoritative timestamp', pair.filter(x => x.status === 'STORED').length === 1 &&
  pair[0].case.occurredAtMs === pair[1].case.occurredAtMs && pair[0].case.occurredAtMs >= observedAt - 100);
await assert.rejects(store.recordValidationCase({ ...firstCase, candidateAllow: false }), /R65_DATABASE_VALIDATION_CONFLICT/);
await assert.rejects(store.recordValidationCase({ ...firstCase, caseId: 'case:ffffffffffffffff' }), /R65_DATABASE_VALIDATION_CASE/);
for (const definition of definitions.slice(1)) {
  const decision = executeR65ValidationCase({ state: registered, caseId: definition.caseId, nowMs: Date.now() });
  await store.recordValidationCase({ scopeId: ownerScope, planId: plan.planId, caseId: definition.caseId, ...decision });
}
let cases = await store.readValidationCases({ scopeId: ownerScope, planId: plan.planId });
check('all validation definitions come from the frozen plan and results from R47 execution', cases.length === 6 &&
  cases.every(c => c.occurredAtMs >= plan.startsAtMs && c.occurredAtMs < plan.endsAtMs && c.evidenceKind === 'SYNTHETIC_FIXTURE'));
check('validation evidence is isolated by scope', (await store.readValidationCases({ scopeId: scope(0x65f), planId: plan.planId })).length === 0);
await until(plan.endsAtMs + 20);
await assert.rejects(store.recordValidationCase({ ...firstCase, caseId: 'case:ffffffffffffffff' }), /R65_DATABASE_VALIDATION_WINDOW_CLOSED/);
assert.equal((await store.recordValidationCase(firstCase)).case.occurredAtMs, pair[0].case.occurredAtMs);
check('missing cases cannot be added after closure while acknowledged retries retain the original case');
const tamperedCases = structuredClone(cases); tamperedCases[0].occurredAtMs++;
const syntheticRewrite = runR65EvolutionCycle({ state: registered, validationCases: tamperedCases, nowMs: Date.now() });
await assert.rejects(store.appendEvolution({ scopeId: ownerScope, operationId: operation(203), expectedRevision: 1,
  previousDigest: saved.stateDigest, state: syntheticRewrite.state, actorId: 'system:r65' }), /R65_DATABASE_VALIDATION_EVIDENCE_MISMATCH/);
check('engine-valid but retrospectively changed validation evidence cannot be persisted');
const applied = runR65EvolutionCycle({ state: registered, validationCases: cases, nowMs: Date.now() });
current = await store.appendEvolution({ scopeId: ownerScope, operationId: operation(203), expectedRevision: 1,
  previousDigest: saved.stateDigest, state: applied.state, actorId: 'system:r65' });
check('independently executed validation persists the measured QA version application', applied.evaluation.status === 'AUTO_APPLIED' &&
  current.state.activeVersion.maxAgeMs === 500 && current.state.activeVersion.activationGeneration === 1);
const rollback = rollbackR65Evolution({ state: current.state, reason: 'OWNER_REQUEST', nowMs: Date.now() });
const badPrefix = structuredClone(rollback); badPrefix.history[0].reason = 'FORGED';
await assert.rejects(rpc(R65_DATABASE_RPCS.appendEvolution, { scopeId: ownerScope, operationId: operation(204), expectedRevision: 2,
  previousDigest: current.stateDigest, state: badPrefix, actorId }), /R65_DATABASE_STATE_CONTINUITY/);
const rollbackArgs = { scopeId: ownerScope, operationId: operation(204), expectedRevision: 2, previousDigest: current.stateDigest, state: rollback, actorId };
const rollbackResults = await Promise.all([store.appendEvolution(rollbackArgs), store.appendEvolution(rollbackArgs)]);
check('rollback is durable, monotonic and concurrent-idempotent without deleting the applied version',
  rollbackResults.filter(x => x.replayed).length === 1 && rollbackResults[0].state.activeVersion.maxAgeMs === 750 &&
  rollbackResults[0].state.activeVersion.activationGeneration === 2 && rollbackResults[0].state.versions.length === 2);
const restarted = await createR65DatabaseStore({ db }).readEvolution({ scopeId: ownerScope });
check('a new store instance reloads every revision and the active rollback generation', restarted.revision === 3 &&
  restarted.state.activeVersion.activationGeneration === 2 &&
  Number(await psql("SELECT count(*) FROM public.jenios_robot_evolution_r65 WHERE scope_id='" + ownerScope + "';")) === 4);
await assert.rejects(psql('SET ROLE service_role; UPDATE public.jenios_robot_evolution_r65 SET revision=0;'));
await assert.rejects(psql('SET ROLE service_role; DELETE FROM public.jenios_robot_evolution_r65;'));
check('evolution snapshots cannot be rewritten or deleted by the worker');

const eventPreview = await store.previewArchive({ scopeId: ownerScope, cutoffMs: Date.now() });
await store.commitArchive({ scopeId: ownerScope, archiveId: eventPreview.archiveId, operationId: operation(205),
  actorId, manifestDigest: eventPreview.manifestDigest });
const eventArchive = await store.readArchive({ scopeId: ownerScope, archiveId: eventPreview.archiveId });
check('logical event archives retain signed runtime provenance and unchanged original receipts', eventArchive.manifest.events.length === 3 &&
  eventArchive.manifest.events.every(x => x.provenance.origin === 'R61_SYNTHETIC_RUNTIME') &&
  (await r64.readReceipts({ scopeId: ownerScope, period: scheduled.period })).length === 3);
assert.equal((await store.ingestObservation({ receipt: receipts[0], provenance: provenances[0] })).status, 'ALREADY_STORED');
const stale = structuredClone(receipts[0]); stale.eventId = 'evt:ffffffffffffffff';
await assert.rejects(rpc(R64_DATABASE_RPCS.ingestReceipt, { receipt: stale }), /R64_DATABASE_SEQUENCE_REPLAY/);
check('archive preserves receipt idempotency and the producer sequence replay fence');

const hypothesisScope = scope(0x656); await policy(); const hypothesisCycle = await claim(hypothesisScope);
const hypothesisRequest = request(6); await r64.reserveAndDispatch({ ...lease(hypothesisCycle), request: hypothesisRequest });
const proposal = { kind: 'TIGHTEN_MARKET_FRESHNESS', maxAgeMs: 500, evidenceEventIds: receipts.map(r => r.eventId),
  assessment: 'HYPOTHESIS_REQUIRES_INDEPENDENT_VALIDATION' };
const analysis = { schema: 'JENIOS_R64_ANALYST_HYPOTHESES_V1', proposals: [proposal] };
await r64.completeCycle({ ...lease(hypothesisCycle), report: report(hypothesisScope), result: { ...noProvider(), ...hypothesisRequest,
  kind: 'usage_confirmed', providerResponseId: 'resp_r65_hypothesis_fixture', usage: { input_tokens: 10, output_tokens: 10 },
  costNanoUsd: 10, httpRequests: 2, inferenceRequests: 1, analysis, analysisDigest: digestR64Value(analysis), analysisStatus: 'VALID' } });
const hypothesis = await store.readCycleHypothesis({ scopeId: hypothesisScope, cycleId: hypothesisCycle.cycleId });
check('hypothesis bridge exposes only digest and proposal from an explicitly simulated settled result',
  Object.keys(hypothesis).sort().join(',') === 'analysisDigest,cycleId,proposals' && hypothesis.proposals[0].maxAgeMs === 500);
check('hypothesis bridge never leaks another scope or a reconciled outcome',
  await store.readCycleHypothesis({ scopeId: ownerScope, cycleId: hypothesisCycle.cycleId }) === null &&
  await store.readCycleHypothesis({ scopeId: pending.scopeId, cycleId: pending.cycleId }) === null);
await psql('UPDATE public.jenios_robot_config_r64 SET generation_enabled=false;');
check('acceptance exits with paid generation disabled', (await r64.readAnalystPolicy()).generationEnabled === false);

const evidence = { schema: 'JENIOS_R65_POSTGRES_ACCEPTANCE_V1', status: 'PASS', commit: process.env.GITHUB_SHA || null,
  capturedAt: new Date().toISOString(), database: 'DISPOSABLE_LOCAL_POSTGRESQL', realConcurrentConnections: true,
  counts: { total: checks.length, passed: checks.length, failed: 0, notRun: 0 }, checks,
  archiveMode: 'LOGICAL_COPY_ONLY', physicalDeletionPerformed: false, spaceReclaimedBytes: 0,
  generationEnabledAtExit: false, independentRuntimeAttestation: false,
  paidProviderCalls: 0, customerWalletDebits: 0, realOrdersSent: 0, externalPaperOrdersSent: 0,
  productionDatabaseAccessed: false, migrationAppliedToSupabase: false, productionConfigurationChanged: false };
const directory = process.env.ROBOT_QA_ARTIFACT_DIR;
if (directory) { mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, 'r65-postgres-acceptance.json'), JSON.stringify(evidence, null, 2) + '\n'); }
console.log('R65_POSTGRES_ACCEPTANCE ' + JSON.stringify(evidence));
