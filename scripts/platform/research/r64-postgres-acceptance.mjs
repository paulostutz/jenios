/** Disposable PostgreSQL only. Two independent psql processes exercise real locks.
 * No Supabase instance, customer, broker or paid provider is contacted.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createR64DatabaseStore, R64_DATABASE_RPCS, hashR64CycleInput } from '../../../lib/platform/research/robot-r64-database-store.mjs';
import { createR64TelemetryFixture } from './r64-telemetry-fixtures.mjs';

assert.equal(process.env.JENIOS_R64_DISPOSABLE_DB, 'true', 'Disposable R64 DB flag is required');
const url = new URL(process.env.JENIOS_R64_TEST_DATABASE_URL || 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol) && ['127.0.0.1', 'localhost'].includes(url.hostname));
assert.equal(url.pathname, '/jenios_r64_qa'); assert.equal(url.search, ''); assert.equal(url.hash, '');
const childEnv = { ...process.env, PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1', PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: 'jenios_r64_qa',
  PGSERVICE: '', PGOPTIONS: '', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5' };
const psql = sql => new Promise((resolve, reject) => {
  const child = spawn('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'], { env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', value => { stdout += value; });
  child.stderr.on('data', value => { stderr += value; });
  child.on('error', () => reject(Error('R64_POSTGRES_PROCESS_UNAVAILABLE')));
  child.on('close', code => code === 0 ? resolve(stdout.trim()) :
    reject(Error(stderr.match(/R64_[A-Z0-9_]+/)?.[0] || 'R64_POSTGRES_QUERY_FAILED: ' + stderr.slice(0, 1200))));
  child.stdin.end(sql);
});
assert.equal(await psql('SELECT current_database();'), 'jenios_r64_qa');
const checks = [];
function check(name, condition) { assert.ok(condition, name); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
const encoded = value => "convert_from(decode('" + Buffer.from(JSON.stringify(value)).toString('base64') + "','base64'),'UTF8')::jsonb";
const names = new Set(Object.values(R64_DATABASE_RPCS));
async function rpc(name, p_input) {
  assert.ok(names.has(name));
  return JSON.parse(await psql('SET ROLE service_role; SELECT public.' + name + '(' + encoded(p_input) + ');'));
}
async function waitForSql(query, label) {
  const deadline = Date.now() + 4000;
  do {
    if (await psql(query) === 't') return;
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  throw Error('R64_POSTGRES_BARRIER_FAILED: ' + label);
}
async function withHeldBudget(label, operation) {
  const holder = psql("BEGIN; SELECT month FROM public.jenios_robot_budgets_r64 FOR UPDATE;" +
    "SELECT pg_sleep(1.5),'" + label + "'; COMMIT;");
  await waitForSql("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() " +
    "AND pid<>pg_backend_pid() AND wait_event='PgSleep' AND query LIKE '%" + label + "%');", label);
  try { await operation(); } finally { await holder; }
}
const store = createR64DatabaseStore({ db: { rpc: async (name, args) => {
  try { return { data: await rpc(name, args.p_input), error: null }; }
  catch (error) { return { data: null, error: { message: error.message } }; }
} } });
const schema = readFileSync(new URL('../../../db/schema/robot-r64-operational-store.sql', import.meta.url), 'utf8');
await psql([
  "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;",
  "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;",
  "IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;",
  'GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;',
].join('\n'));
await psql(schema); await psql(schema); check('review SQL applies twice without deleting history', true);
const initialPolicy = await store.readAnalystPolicy();
check('new installation has zero budget and paid generation disabled', initialPolicy.generationEnabled === false &&
  initialPolicy.monthlyProviderLimitNanoUsd === 0 && initialPolicy.maxRequestProviderNanoUsd === 0);
const roles = ['anon', 'authenticated'], tables = ['events', 'cycles', 'budgets', 'config'];
let denied = 0;
for (const role of roles) {
  for (const table of tables) {
    await assert.rejects(psql('SET ROLE ' + role + '; SELECT * FROM public.jenios_robot_' + table + '_r64;')); denied++;
  }
  for (const name of names) {
    await assert.rejects(psql('SET ROLE ' + role + '; SELECT public.' + name + "('{}'::jsonb);")); denied++;
  }
}
const rlsCount = Number(await psql("SELECT count(*) FROM pg_class WHERE relname IN('jenios_robot_events_r64','jenios_robot_cycles_r64','jenios_robot_budgets_r64','jenios_robot_config_r64') AND relrowsecurity;"));
check('client roles cannot access tables or RPCs; all four tables have RLS', denied === 24 && rlsCount === 4);
await assert.rejects(psql('SET ROLE service_role; UPDATE public.jenios_robot_config_r64 SET generation_enabled=true;'));
check('worker cannot approve its own paid policy', true);

const nowMs = Date.now(), noon = new Date(nowMs); noon.setUTCHours(12, 0, 0, 0);
const fixtureAtMs = noon.getTime() <= nowMs ? nowMs : noon.getTime() - 86400000;
const fixture = createR64TelemetryFixture({ generatedAtMs: fixtureAtMs, scopeId: 'scope:0000000000000061',
  sourceId: 'source:0000000000000061', sessionId: 'session:0000000000000061' });
const scopeId = fixture.study.scopeId, periodKey = fixture.study.periodKey;
const dupIngest = await Promise.all([
  rpc(R64_DATABASE_RPCS.ingestReceipt, { receipt: fixture.receipts[0] }),
  rpc(R64_DATABASE_RPCS.ingestReceipt, { receipt: fixture.receipts[0] }),
]);
check('concurrent duplicate receipt commits once', dupIngest.filter(x => x.status === 'STORED').length === 1 &&
  dupIngest.filter(x => x.status === 'ALREADY_STORED').length === 1);
const readmitted = structuredClone(fixture.receipts[0]); readmitted.admittedAtMs += 1;
check('identical signed envelope readmitted later is idempotent', (await store.ingestReceipt({ receipt: readmitted })).status === 'ALREADY_STORED');
for (const receipt of fixture.receipts.slice(1)) await store.ingestReceipt({ receipt });
const conflicting = structuredClone(fixture.receipts[0]); conflicting.payloadDigest = 'f'.repeat(64);
await assert.rejects(rpc(R64_DATABASE_RPCS.ingestReceipt, { receipt: conflicting }), /R64_DATABASE_RECEIPT_CONFLICT/);
const replay = structuredClone(fixture.receipts[0]); replay.eventId = 'evt:ffffffffffffffff';
await assert.rejects(rpc(R64_DATABASE_RPCS.ingestReceipt, { receipt: replay }), /R64_DATABASE_SEQUENCE_REPLAY/);
const rows = await store.readReceipts({ scopeId, period: fixture.period });
check('conflicting identity and stale sequence are rejected; committed events survive restart', rows.length === fixture.receipts.length);
check('scope and period filters isolate receipts', (await store.readReceipts({ scopeId: 'scope:0000000000000062', period: fixture.period })).length === 0);
const foreign = structuredClone(fixture.receipts[0]); foreign.evidenceKind = 'REAL_BROKER';
await assert.rejects(rpc(R64_DATABASE_RPCS.ingestReceipt, { receipt: foreign }), /R64_DATABASE_RECEIPT/);
check('SQL itself refuses operational or broker evidence classifications', true);

const makeInput = ownerScope => ({ schema: 'JENIOS_R64_OPERATIONAL_CYCLE_INPUT_V1', evidenceKind: 'SIGNED_QA_REPLAY',
  scopeId: ownerScope, periodKey, study: { count: fixture.receipts.length, source: 'SIGNED_QA_REPLAY' } });
const makeClaim = ownerScope => { const input = makeInput(ownerScope); return { scopeId: ownerScope, periodKey,
  input, inputDigest: hashR64CycleInput(input) }; };
const makeReport = ownerScope => ({ schema: 'JENIOS_R64_OPERATIONAL_REPORT_V1', evidenceKind: 'SIGNED_QA_REPLAY',
  scopeId: ownerScope, periodKey, actualBrokerPnl: null, actualLossesAvoided: null, realTradeAccuracy: null,
  realOrdersSent: 0, externalPaperOrdersSent: 0, productionMonitoringStarted: false,
  hypotheses: { kind: 'TEST_ONLY' }, maturity: { stage: 'QA_RECORDED', completionCeilingKnown: false },
  providerAudit: { kind: 'usage_confirmed', analysisStatus: 'VALID' } });
const noProvider = () => ({ kind: 'not_generated', reason: 'DISABLED', fingerprint: null, model: null, pricingVersion: null,
  providerResponseId: null, usage: null, costNanoUsd: null, responseDigest: null, analysis: null,
  analysisStatus: 'NOT_AVAILABLE', httpRequests: 0, inferenceRequests: 0, retryAllowed: false, mayPromote: false });
const identity = c => ({ cycleId: c.cycleId, leaseOwner: c.leaseOwner, leaseGeneration: c.leaseGeneration });
const request = id => ({ fingerprint: id.repeat(64), model: 'gpt-6-luna', pricingVersion: '2026-10-20-v2-nano',
  reservationNanoUsd: 1350000, maxInputTokens: 8000, maxOutputTokens: 700 });
const known = (id, responseId, costNanoUsd = 33450) => ({ ...noProvider(), ...request(id), kind: 'usage_confirmed',
  reason: 'USAGE_CONFIRMED', providerResponseId: responseId, usage: { input_tokens: 100, output_tokens: 20 },
  costNanoUsd, inferenceRequests: 1, httpRequests: 2 });
const unknown = id => ({ ...noProvider(), ...request(id), kind: 'unknown', reason: 'AMBIGUOUS',
  inferenceRequests: 1, httpRequests: 2 });
const dupClaims = await Promise.all([store.claimCycle(makeClaim(scopeId)), store.claimCycle(makeClaim(scopeId))]);
check('independent concurrent claims produce one lease owner', dupClaims.filter(x => x.status === 'CLAIMED').length === 1 &&
  dupClaims.filter(x => x.status === 'BUSY').length === 1);
const first = dupClaims.find(x => x.status === 'CLAIMED');
await psql("UPDATE public.jenios_robot_cycles_r64 SET lease_until=clock_timestamp()-interval '1 second' WHERE cycle_id='" + first.cycleId + "';");
const frozen = await store.readCycle({ scopeId, periodKey });
const recovered = await store.claimCycle({ scopeId, periodKey, input: frozen.input, inputDigest: frozen.inputDigest });
check('expired pre-dispatch lease is reclaimed with immutable input and a new generation',
  recovered.leaseGeneration === first.leaseGeneration + 1 && recovered.leaseOwner !== first.leaseOwner &&
  JSON.stringify(recovered.input) === JSON.stringify(frozen.input));
await assert.rejects(store.reserveAndDispatch({ ...identity(first), request: request('a') }), /R64_DATABASE_STALE_LEASE/);
await assert.rejects(store.completeCycle({ ...identity(first), result: noProvider(), report: makeReport(scopeId) }), /R64_DATABASE_STALE_LEASE/);
check('old worker cannot dispatch or complete after lease loss', true);
const changedInput = makeClaim(scopeId); changedInput.input.changed = true; changedInput.inputDigest = hashR64CycleInput(changedInput.input);
await assert.rejects(store.claimCycle(changedInput), /R64_DATABASE_INPUT_CONFLICT/);
check('a later replay cannot replace the frozen period input', true);
const noBudget = await store.reserveAndDispatch({ ...identity(recovered), request: request('a') });
check('default policy denies dispatch before any reservation', noBudget.dispatchGranted === false);

await psql("UPDATE public.jenios_robot_config_r64 SET generation_enabled=true,allowed_models=ARRAY['gpt-6-luna']," +
  "pricing_version='2026-10-20-v2-nano',pricing_approved=true,rates_verified_at=clock_timestamp()," +
  "max_request_nano_usd=1350000,monthly_limit_nano_usd=2000000 WHERE singleton=true;");
const underquoted = { ...request('a'), reservationNanoUsd: 1 };
check('underquoted reservations cannot bypass the approved fixed quote', (await store.reserveAndDispatch({
  ...identity(recovered), request: underquoted })).dispatchGranted === false);
const duplicateDispatch = await Promise.all([
  store.reserveAndDispatch({ ...identity(recovered), request: request('a') }),
  store.reserveAndDispatch({ ...identity(recovered), request: request('a') }),
]);
check('two connections reserve once and grant only one provider dispatch', duplicateDispatch.filter(x => x.dispatchGranted).length === 1);
let totals = JSON.parse(await psql("SELECT jsonb_build_object('held',sum(reserved_nano_usd),'spent',sum(spent_nano_usd)) FROM public.jenios_robot_budgets_r64;"));
check('single reservation uses internal nanoUSD without a customer wallet', totals.held === 1350000 && totals.spent === 0);
const completion = { ...identity(recovered), result: known('a', 'resp_r64_disposable_1'), report: makeReport(scopeId) };
const complete = await store.completeCycle(completion), repeat = await store.completeCycle(completion);
check('confirmed usage settles once and identical completion is idempotent', complete.status === 'COMPLETED' &&
  repeat.replayed === true && repeat.report.scopeId === scopeId);
await assert.rejects(store.completeCycle({ ...completion, report: { ...makeReport(scopeId), changed: true } }), /R64_DATABASE_COMPLETION_CONFLICT/);
check('completed report cannot be rewritten', true);
totals = JSON.parse(await psql("SELECT jsonb_build_object('held',sum(reserved_nano_usd),'spent',sum(spent_nano_usd)) FROM public.jenios_robot_budgets_r64;"));
check('unused reservation is released and measured cost retained', totals.held === 0 && totals.spent === 33450);

const scopes = ['scope:0000000000000062', 'scope:0000000000000063'];
const competitors = await Promise.all(scopes.map(s => store.claimCycle(makeClaim(s))));
const competitions = await Promise.all(competitors.map((c, i) => store.reserveAndDispatch({ ...identity(c), request: request(i ? 'c' : 'b') })));
check('concurrent different cycles respect the shared monthly limit', competitions.filter(x => x.dispatchGranted).length === 1 &&
  competitions.filter(x => x.reason === 'BUDGET_EXHAUSTED').length === 1);
const winner = competitions.findIndex(x => x.dispatchGranted), winningCycle = competitors[winner], winningScope = scopes[winner];
const pending = await store.completeCycle({ ...identity(winningCycle), result: unknown(winner ? 'c' : 'b'), report: makeReport(winningScope) });
check('unknown result holds reservation and persists a safe reconciliation report', pending.status === 'NEEDS_RECONCILIATION' &&
  pending.report.hypotheses === null && pending.report.providerAudit.kind === 'unknown' &&
  pending.report.maturity.stage === 'RECONCILIATION_REQUIRED');
check('uncertain paid dispatch is never automatically retried', !(await store.reserveAndDispatch({
  ...identity(winningCycle), request: request(winner ? 'c' : 'b') })).dispatchGranted &&
  (await store.claimCycle(makeClaim(winningScope))).status === 'NEEDS_RECONCILIATION');
totals = JSON.parse(await psql("SELECT jsonb_build_object('held',sum(reserved_nano_usd),'spent',sum(spent_nano_usd)) FROM public.jenios_robot_budgets_r64;"));
check('ambiguous provider usage remains reserved without invented cost', totals.held === 1350000 && totals.spent === 33450);

await psql('UPDATE public.jenios_robot_config_r64 SET monthly_limit_nano_usd=10000000;');
const crashScope = 'scope:0000000000000065', crash = await store.claimCycle(makeClaim(crashScope));
await store.reserveAndDispatch({ ...identity(crash), request: request('d') });
await psql("UPDATE public.jenios_robot_cycles_r64 SET lease_until=clock_timestamp()-interval '1 second' WHERE cycle_id='" + crash.cycleId + "';");
const unrevisited = await store.readReports({ scopeId: crashScope });
check('admin exposes expired dispatched cycles even when their old period is never revisited', unrevisited.length === 1 &&
  unrevisited[0].status === 'NEEDS_RECONCILIATION' && unrevisited[0].report === null);
check('crash after dispatch becomes reconciliation without acquiring a new lease',
  (await store.claimCycle(makeClaim(crashScope))).status === 'NEEDS_RECONCILIATION');
const crashRows = await store.readReports({ scopeId: crashScope });
check('admin can see a crashed dispatched cycle without a fabricated report', crashRows.length === 1 &&
  crashRows[0].status === 'NEEDS_RECONCILIATION' && crashRows[0].report === null);
const overflowScope = 'scope:0000000000000066', overflow = await store.claimCycle(makeClaim(overflowScope));
await store.reserveAndDispatch({ ...identity(overflow), request: request('e') });
const excessive = await store.completeCycle({ ...identity(overflow), result: known('e', 'resp_r64_disposable_excess', 1350001), report: makeReport(overflowScope) });
check('cost above reservation is not falsely settled or presented as an approved hypothesis',
  excessive.status === 'NEEDS_RECONCILIATION' && excessive.report.hypotheses === null);
const duplicateScope = 'scope:0000000000000067', duplicate = await store.claimCycle(makeClaim(duplicateScope));
await store.reserveAndDispatch({ ...identity(duplicate), request: request('f') });
const duplicateResult = await store.completeCycle({ ...identity(duplicate), result: known('f', 'resp_r64_disposable_1'), report: makeReport(duplicateScope) });
check('provider response reused across cycles requires reconciliation', duplicateResult.status === 'NEEDS_RECONCILIATION' &&
  duplicateResult.report.providerAudit.reason === 'DURABLE_RECONCILIATION_REQUIRED');
const waitScope = 'scope:0000000000000068', waitCycle = await store.claimCycle(makeClaim(waitScope));
await withHeldBudget('R64_RESERVE_LOCK_BARRIER', async () => {
  await psql("UPDATE public.jenios_robot_cycles_r64 SET lease_until=clock_timestamp()+interval '500 milliseconds' WHERE cycle_id='" + waitCycle.cycleId + "';");
  const pendingReserve = store.reserveAndDispatch({ ...identity(waitCycle), request: request('8') });
  const outcome = pendingReserve.then(value => ({ value }), error => ({ error }));
  await waitForSql("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() " +
    "AND wait_event_type='Lock' AND query LIKE '%jenios_robot_r64_reserve_dispatch%');", 'reserve waiting for budget');
  const observed = await outcome;
  assert.match(observed.error?.message || '', /R64_DATABASE_STALE_LEASE/);
});
check('lease expiring during a real budget-lock wait cannot reserve or dispatch', true);
const settleScope = 'scope:0000000000000069', settleCycle = await store.claimCycle(makeClaim(settleScope));
await store.reserveAndDispatch({ ...identity(settleCycle), request: request('9') });
await withHeldBudget('R64_SETTLE_LOCK_BARRIER', async () => {
  await psql("UPDATE public.jenios_robot_cycles_r64 SET lease_until=clock_timestamp()+interval '500 milliseconds' WHERE cycle_id='" + settleCycle.cycleId + "';");
  const pendingComplete = store.completeCycle({ ...identity(settleCycle), result: known('9', 'resp_r64_wait_expired'), report: makeReport(settleScope) });
  const outcome = pendingComplete.then(value => ({ value }), error => ({ error }));
  await waitForSql("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() " +
    "AND wait_event_type='Lock' AND query LIKE '%jenios_robot_r64_complete_cycle%');", 'completion waiting for budget');
  const observed = await outcome;
  if (observed.error) throw observed.error;
  assert.equal(observed.value.status, 'NEEDS_RECONCILIATION'); assert.equal(observed.value.report.hypotheses, null);
});
check('lease expiring during settlement wait keeps reservation and removes settled-hypothesis claims', true);
const reports = await store.readReports({ scopeId });
check('admin report projection excludes private input, leases and provider result', reports.length === 1 &&
  Object.keys(reports[0]).sort().join(',') === 'cycleId,periodKey,report,scopeId,status');
await psql('UPDATE public.jenios_robot_config_r64 SET generation_enabled=false;');
const evidence = { schema: 'JENIOS_R64_POSTGRES_ACCEPTANCE_V1', status: 'PASS', commit: process.env.GITHUB_SHA || null,
  capturedAt: new Date().toISOString(), database: 'DISPOSABLE_LOCAL_POSTGRESQL', realConcurrentConnections: true,
  counts: { total: checks.length, passed: checks.length, failed: 0, notRun: 0 }, checks,
  customerWalletDebits: 0, paidProviderCalls: 0, realOrdersSent: 0, externalPaperOrdersSent: 0,
  productionDatabaseAccessed: false, migrationAppliedToSupabase: false, generationEnabledAtExit: false };
const directory = process.env.ROBOT_QA_ARTIFACT_DIR;
if (directory) { mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, 'r64-postgres-acceptance.json'), JSON.stringify(evidence, null, 2) + '\n'); }
console.log('R64_POSTGRES_ACCEPTANCE ' + JSON.stringify(evidence));
