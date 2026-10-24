/** R71 acceptance infrastructure for an explicitly selected disposable local
 * PostgreSQL database. Protocol fixtures are not private-core execution or
 * hosted evidence. The R71 contract cases are added alongside the schema.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createR71DatabaseStore, R71_DATABASE_RPCS } from '../../../lib/platform/research/robot-r71-database-store.mjs';
import { createR71ProtocolFixture, R71_PROTOCOL_FIXTURE_KIND, R71_FIXTURE_SCENARIOS,
  R71_FIXTURE_POSITION_CONTEXTS } from '../../../tests/fixtures/r71-private-protocol-fixture.mjs';
import { createR71EvolutionState, recordR71Study, registerR71Evaluation, evaluateR71Evolution,
  rollbackR71Evolution, projectR71RuntimeView } from '../../../lib/platform/research/robot-r71-evolution-engine.mjs';
import { collectR71PrivateStudy, r71MembershipDigest } from '../../../lib/platform/research/robot-r71-private-study.mjs';
import { createR71Plan, R71_BOUNDARIES } from '../../../lib/platform/research/robot-r71-policy.mjs';

assert.equal(process.env.JENIOS_R71_DISPOSABLE_DB, 'true', 'Explicit disposable R71 database flag required');
const databaseUrl = new URL(process.env.JENIOS_R71_TEST_DATABASE_URL || 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(databaseUrl.protocol));
assert.equal(databaseUrl.hostname, '127.0.0.1', 'Only literal loopback PostgreSQL is permitted');
assert.equal(databaseUrl.pathname, '/jenios_r71_qa');
assert.equal(databaseUrl.username, 'postgres');
assert.equal(databaseUrl.search, ''); assert.equal(databaseUrl.hash, '');
assert.ok(['5432', '56471'].includes(databaseUrl.port || '5432'));
assert.ok(['', 'r71-test-only'].includes(decodeURIComponent(databaseUrl.password)));
assert.notEqual(process.env.VERCEL_ENV, 'production');
for (const key of ['JENIOS_REAL_EXECUTION_ENABLED', 'JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
  'JENIOS_PRIVATE_PAPER_EXECUTOR', 'JENIOS_ROBOT_ANALYST_PAID_ENABLED']) assert.notEqual(process.env[key], 'true');

const postgresEnv = { PATH: process.env.PATH || '/usr/bin:/bin', PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1',
  PGPORT: databaseUrl.port || '5432', PGUSER: 'postgres', PGPASSWORD: decodeURIComponent(databaseUrl.password),
  PGDATABASE: 'jenios_r71_qa', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5',
  PGOPTIONS: '-c statement_timeout=15000 -c lock_timeout=5000' };
const psql = input => new Promise((resolve, reject) => {
  const child = spawn('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
    { env: postgresEnv, stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
  let stdout = '', stderr = '', problem = null;
  child.stdout.on('data', bytes => {
    stdout += bytes;
    if (stdout.length > 16777216) { problem = Error('R71_POSTGRES_OUTPUT_LIMIT'); child.kill('SIGKILL'); }
  });
  child.stderr.on('data', bytes => { if (stderr.length < 32768) stderr += bytes; });
  child.once('error', () => { problem = Error('R71_POSTGRES_PROCESS_UNAVAILABLE'); });
  child.once('close', code => {
    if (problem) reject(problem);
    else if (code === 0) resolve(stdout.trim());
    else reject(Error(stderr.match(/R(?:64|65|67|71)_[A-Z0-9_]+/)?.[0] || 'R71_POSTGRES_QUERY_FAILED'));
  });
  child.stdin.on('error', () => {}); child.stdin.end(input);
});
const encoded = value => "convert_from(decode('" + Buffer.from(JSON.stringify(value)).toString('base64') + "','base64'),'UTF8')::jsonb";
const checks = [];
const check = (name, condition = true) => {
  assert.ok(condition, name); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name);
};
const clone = value => structuredClone(value);
const randomId = (prefix, bytes = 8) => prefix + ':' + randomBytes(bytes).toString('hex');
const operation = () => randomId('op', 16);
const names = new Set([...Object.values(R71_DATABASE_RPCS), 'jenios_robot_r67_ingest_private_capture']);
const rpc = async (name, input) => {
  assert.ok(names.has(name));
  return JSON.parse(await psql('SET ROLE service_role; SELECT public.' + name + '(' + encoded(input) + ');'));
};
const db = { async rpc(name, args) { try { return { data: await rpc(name, args.p_input), error: null }; }
  catch (error) { return { data: null, error: { message: error.message } }; } } };
const pause = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
const until = async timestamp => { while (Date.now() < timestamp) await pause(Math.min(timestamp - Date.now(), 1000)); };
function heldTransaction(sql, delaySeconds = 1.2) {
  let readyResolve, readyReject, doneResolve, doneReject, stdout = '', stderr = '';
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const done = new Promise((resolve, reject) => { doneResolve = resolve; doneReject = reject; });
  const child = spawn('psql', ['-X', '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
    { env: postgresEnv, stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 });
  child.stdout.on('data', chunk => { stdout += chunk; if (stdout.includes('R71_PENDING_COMMIT')) readyResolve(); });
  child.stderr.on('data', chunk => { if (stderr.length < 8192) stderr += chunk; });
  child.once('error', () => { const error = Error('R71_POSTGRES_PROCESS_UNAVAILABLE'); readyReject(error); doneReject(error); });
  child.once('close', code => {
    if (code === 0) doneResolve();
    else { const error = Error(stderr.match(/R(?:64|65|67|71)_[A-Z0-9_]+/)?.[0] || 'R71_POSTGRES_TRANSACTION_FAILED'); readyReject(error); doneReject(error); }
  });
  child.stdin.on('error', () => {});
  child.stdin.end('BEGIN; SET ROLE service_role; ' + sql + '\n\\echo R71_PENDING_COMMIT\nSELECT pg_sleep(' + delaySeconds + '); COMMIT;');
  // Preserve a rejection until the caller awaits done after ready.
  done.catch(() => {});
  return { ready, done };
}
assert.equal(await psql('SELECT current_database();'), 'jenios_r71_qa');
await psql("DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;" +
  "DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;" +
  "DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;" +
  'GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;');
for (const file of ['robot-r64-operational-store.sql', 'robot-r65-lifecycle-store.sql', 'robot-r67-private-capture-store.sql',
  'robot-r71-private-evolution-store.sql', 'robot-r71-private-evolution-store.sql'])
  await psql(readFileSync(new URL('../../../db/schema/' + file, import.meta.url), 'utf8'));
check('isolated R71 extension applies twice without replacing R64/R65/R67 functions or deleting history');
const legacyTables = ['events_r64', 'config_r64', 'budgets_r64', 'cycles_r64', 'observation_provenance_r65',
  'reconciliations_r65', 'archives_r65', 'archive_items_r65', 'evolution_r65', 'validation_cases_r65'];
const legacySnapshot = () => psql('SELECT jsonb_build_object(' + legacyTables.map(name => "'" + name + "'," +
  "(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.jenios_robot_" + name + ' t)').join(',') + ');');
const legacyBefore = await legacySnapshot();
const r71Tables = ['private_evolution', 'private_observations', 'private_studies', 'private_study_members', 'private_validation_cases'];
for (const table of r71Tables) {
  assert.equal(await psql("SELECT relrowsecurity FROM pg_class WHERE relname='jenios_robot_" + table + "_r71';"), 't');
  for (const role of ['anon', 'authenticated'])
    await assert.rejects(psql('SET ROLE ' + role + '; SELECT * FROM public.jenios_robot_' + table + '_r71;'));
  for (const action of ['UPDATE', 'DELETE']) await assert.rejects(psql('SET ROLE service_role; ' +
    (action === 'UPDATE' ? 'UPDATE public.jenios_robot_' + table + '_r71 SET scope_id=scope_id;' : 'DELETE FROM public.jenios_robot_' + table + '_r71;')));
}
for (const name of Object.values(R71_DATABASE_RPCS)) for (const role of ['anon', 'authenticated'])
  await assert.rejects(psql('SET ROLE ' + role + '; SELECT public.' + name + "('{}'::jsonb);"));
check('all R71 tables use RLS; anon/authenticated lack table/RPC access and service_role lacks update/delete');

async function context() {
  const scopeId = randomId('scope'), sourceId = randomId('source');
  const seed = await createR71ProtocolFixture({ scopeId, sourceId, operationId: operation(), sessionId: randomId('session') });
  const identity = { scopeId, sourceId, sourceKeySha256: seed.receipt.sourceKeySha256 };
  const store = createR71DatabaseStore({ db, ...identity });
  const { nowMs } = await store.now(), state = createR71EvolutionState({ ...identity, nowMs });
  const initialization = { operationId: operation(), expectedRevision: -1, previousDigest: null, state, actorId: 'system:r71' };
  const row = await store.appendState(initialization);
  return { ...identity, store, row, initialization, privateKeyPem: seed.privateKeyPem, trustedSource: seed.trustedSource };
}
async function capture(ctx, options = {}) {
  const fixture = await createR71ProtocolFixture({ scopeId: ctx.scopeId, sourceId: ctx.sourceId, privateKeyPem: ctx.privateKeyPem,
    sessionId: randomId('session'), operationId: operation(), nowMs: Date.now(), runtimeView: projectR71RuntimeView(ctx.row), ...options });
  return { receipt: fixture.receipt, record: fixture.record };
}
const scoped = (ctx, extra) => ({ scopeId: ctx.scopeId, sourceId: ctx.sourceId, sourceKeySha256: ctx.sourceKeySha256, ...extra });
const direct = (ctx, pair) => rpc(R71_DATABASE_RPCS.ingest, scoped(ctx, pair));
const countPairs = ctx => psql("SELECT count(*) FROM public.jenios_robot_private_observations_r71 WHERE scope_id='" + ctx.scopeId + "' AND source_id='" + ctx.sourceId + "';");
const nativeExists = pair => psql("SELECT count(*) FROM public.jenios_robot_private_captures_r67 WHERE scope_id='" + pair.receipt.nativeReceipt.scopeId + "' AND event_id='" + pair.receipt.nativeReceipt.eventId + "';");
async function append(ctx, state, actorId = 'system:r71') {
  ctx.row = await ctx.store.appendState({ operationId: operation(), expectedRevision: ctx.row.revision,
    previousDigest: ctx.row.stateDigest, state, actorId }); return ctx.row;
}
const main = await context();
assert.equal(main.row.state.activeVersion.activationGeneration, 0);
assert.equal((await main.store.appendState(main.initialization)).replayed, true);
await assert.rejects(main.store.appendState({ ...main.initialization, actorId: 'user:71717171-7171-4717-8717-717171717171' }), /R71_DATABASE_OPERATION_CONFLICT/);
await assert.rejects(createR71DatabaseStore({ db, scopeId: main.scopeId, sourceId: main.sourceId, sourceKeySha256: '00'.repeat(32) }).readState(), /R71_DATABASE_STATE_BINDING/);
check('initial state and exact operation retry are durable; conflicting operation/key are rejected');

const first = await capture(main), storedFirst = await main.store.ingest(first);
assert.equal(storedFirst.status, 'STORED'); assert.equal(storedFirst.receipt.admittedAtMs, storedFirst.receipt.nativeReceipt.admittedAtMs);
assert.ok(storedFirst.receipt.admittedAtMs >= first.record.annotation.capturedAtMs);
const retry = await main.store.ingest(first);
assert.equal(retry.status, 'ALREADY_STORED'); assert.deepEqual(retry.receipt, storedFirst.receipt); assert.deepEqual(retry.record, first.record);
assert.equal(await nativeExists(first), '1'); assert.equal(await countPairs(main), '1');
check('native R67 and contextual R71 pair admit atomically with matching DB-owned times and exact retry');

const invalidBase = await capture(main);
for (const mutate of [
  p => { p.record.annotation.entries[0].effectiveDecision.action = 'automatic_buy'; },
  p => { p.record.annotation.wrapperVersion.versionId = null; p.receipt.wrapperVersion.versionId = null; },
  p => { p.record.annotation.entries[1].positionOpen = null; },
  p => { p.receipt.annotationDigest = null; },
  p => { p.record.originalRecord.envelope.payload.scenarios[0].mode = null; },
]) {
  const invalid = clone(invalidBase); mutate(invalid); await assert.rejects(direct(main, invalid), /R(?:67|71)_DATABASE_/);
}
assert.equal(await nativeExists(invalidBase), '0'); assert.equal(await countPairs(main), '1');
check('SQL rejects null/type/decision sidecar inconsistencies before leaving any native or contextual row');

const bare = await capture(main);
await rpc('jenios_robot_r67_ingest_private_capture', { scopeId: main.scopeId, sourceId: main.sourceId,
  receipt: bare.receipt.nativeReceipt, record: bare.record.originalRecord });
const bareBefore = await psql("SELECT to_jsonb(t)::text FROM public.jenios_robot_private_captures_r67 t WHERE scope_id='" + main.scopeId + "' AND event_id='" + bare.receipt.nativeReceipt.eventId + "';");
await assert.rejects(main.store.ingest(bare), /R71_DATABASE_RETROACTIVE_ENRICHMENT/);
assert.equal(await countPairs(main), '1');
check('a preexisting bare R67 record cannot be enriched retrospectively into R71');

// Both RPCs contend for the certified native operation/session locks. The R67
// winner remains bare, and the losing R71 transaction cannot append a sidecar.
const racedBare = await capture(main);
const nativeRace = heldTransaction('SELECT public.jenios_robot_r67_ingest_private_capture(' + encoded({ scopeId: main.scopeId,
  sourceId: main.sourceId, receipt: racedBare.receipt.nativeReceipt, record: racedBare.record.originalRecord }) + ")->>'status';");
await nativeRace.ready;
const rejectedRace = assert.rejects(main.store.ingest(racedBare), /R71_DATABASE_RETROACTIVE_ENRICHMENT/);
await nativeRace.done; await rejectedRace; assert.equal(await countPairs(main), '1');
check('concurrent bare R67 winner prevents sidecar enrichment after lock acquisition');

for (let index = 1; index < 33; index++) await main.store.ingest(await capture(main));
const late = await capture(main);
const lateTransaction = heldTransaction('SELECT public.' + R71_DATABASE_RPCS.ingest + '(' + encoded(scoped(main, late)) + ")->>'status';");
await lateTransaction.ready;
const period = { startMs: 0, endMs: (await main.store.now()).nowMs };
const freezeRequest = { operationId: operation(), period };
const frozen = await main.store.freezeStudy(freezeRequest);
assert.equal(frozen.totalRecords, 33); assert.equal(frozen.totalEntries, 264);
await lateTransaction.done;
const frozenAgain = await main.store.freezeStudy(freezeRequest); assert.deepEqual(frozenAgain, frozen);
const nextFrozen = await main.store.freezeStudy({ operationId: operation(), period });
assert.equal(nextFrozen.totalRecords, 34);
check('one MVCC membership cut freezes 33 records while an uncommitted contextual pair appears only in the next snapshot');

let cursor = 0; const members = []; let pageCount = 0;
do {
  const page = await main.store.readStudyPage({ snapshotId: frozen.snapshotId, afterOrdinal: cursor, limit: 10 }); pageCount++;
  assert.deepEqual(page.snapshot, frozen);
  members.push(...page.rows.map(row => ({ ordinal: row.ordinal, eventId: row.record.annotation.eventId,
    recordDigest: row.receipt.recordDigest, annotationDigest: row.receipt.annotationDigest })));
  cursor = page.nextOrdinal;
} while (cursor !== null);
assert.equal(members.length, 33); assert.equal(pageCount, 4); assert.equal(r71MembershipDigest(members), frozen.membershipDigest);
const study = await collectR71PrivateStudy({ store: main.store, snapshot: frozen, trustedSource: main.trustedSource });
assert.equal(study.metrics.totalRecords, 33); assert.equal(study.metrics.baselineMissedExistingPositionRouting, 99);
check('four immutable pages cover all records beyond read30 and JS membership digest equals actual PostgreSQL JSONB digest');
await assert.rejects(main.store.freezeStudy({ ...freezeRequest, period: { startMs: 1, endMs: period.endMs } }), /R71_DATABASE_OPERATION_CONFLICT/);
await assert.rejects(main.store.freezeStudy({ operationId: operation(), period: { startMs: 0, endMs: Date.now() + 60000 } }), /R71_DATABASE_SNAPSHOT_FUTURE/);
await assert.rejects(rpc(R71_DATABASE_RPCS.readStudyPage, scoped(main, { snapshotId: frozen.snapshotId, afterOrdinal: 0, limit: 11 })), /R71_DATABASE_PAGE_REQUEST/);
await assert.rejects(rpc(R71_DATABASE_RPCS.readStudyPage, { ...scoped(main, { snapshotId: frozen.snapshotId, afterOrdinal: 0, limit: 10 }), sourceId: randomId('source') }), /R71_DATABASE_SNAPSHOT_NOT_FOUND/);
check('snapshot operation conflicts, future periods, oversized pages and foreign source access fail closed');

const studyState = recordR71Study({ state: main.row.state, study, nowMs: (await main.store.now()).nowMs });
const concurrent = await Promise.allSettled([main.store.appendState({ operationId: operation(), expectedRevision: main.row.revision,
  previousDigest: main.row.stateDigest, state: studyState, actorId: 'system:r71' }),
main.store.appendState({ operationId: operation(), expectedRevision: main.row.revision, previousDigest: main.row.stateDigest,
  state: studyState, actorId: 'system:r71' })]);
assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
assert.match(concurrent.find(result => result.status === 'rejected').reason.message, /R71_DATABASE_STALE_STATE/);
main.row = concurrent.find(result => result.status === 'fulfilled').value;
check('real concurrent CAS connections admit one next revision and reject the stale loser');

// A second independent history intentionally receives only three fixed cases.
const incomplete = await context();
await incomplete.store.ingest(await capture(incomplete));
const partialSnapshot = await incomplete.store.freezeStudy({ operationId: operation(), period: { startMs: 0, endMs: (await incomplete.store.now()).nowMs } });
const partialStudy = await collectR71PrivateStudy({ store: incomplete.store, snapshot: partialSnapshot, trustedSource: incomplete.trustedSource });
await append(incomplete, recordR71Study({ state: incomplete.row.state, study: partialStudy, nowMs: (await incomplete.store.now()).nowMs }));
for (const ctx of [incomplete, main]) {
  const plan = createR71Plan({ snapshotId: ctx.row.state.latestStudy.snapshot.snapshotId, studyDigest: ctx.row.state.latestStudy.studyDigest,
    activeVersion: ctx.row.state.activeVersion, nowMs: (await ctx.store.now()).nowMs });
  await append(ctx, registerR71Evaluation({ state: ctx.row.state, plan, nowMs: plan.registeredAtMs }));
}
const plan = main.row.state.pendingEvaluation, partialPlan = incomplete.row.state.pendingEvaluation;
const tooEarly = await capture(main, { purpose: 'VALIDATION' });
await assert.rejects(main.store.ingest(tooEarly), /R71_DATABASE_VALIDATION_WINDOW/); assert.equal(await nativeExists(tooEarly), '0');
check('eight immutable cases register before the real DB window; admission before the window leaves no rows');
await until(Math.max(plan.startsAtMs, partialPlan.startsAtMs) + 10);
const validation = await capture(main, { purpose: 'VALIDATION' });
await main.store.ingest(validation);
const selected = [0, 2, 4].map(index => partialPlan.caseDefinitions[index]);
await incomplete.store.ingest(await capture(incomplete, { purpose: 'VALIDATION', scenarios: selected.map(d => d.scenario),
  positionContexts: selected.map(d => ({ scenarioId: d.scenario.id, positionOpen: d.positionOpen })) }));
const cases = await main.store.readValidationCases({ planId: plan.planId });
assert.equal(cases.length, 8); assert.equal((await incomplete.store.readValidationCases({ planId: partialPlan.planId })).length, 3);
for (const c of cases) assert.ok(c.capturedAtMs >= plan.startsAtMs && c.admittedAtMs >= c.capturedAtMs && c.admittedAtMs < plan.endsAtMs);
check('validation cases are derived atomically from signed batches during the real clock window, including an explicit incomplete batch');
const duplicateCases = await capture(main, { purpose: 'VALIDATION' });
await assert.rejects(main.store.ingest(duplicateCases), /R71_DATABASE_VALIDATION_CONFLICT/); assert.equal(await nativeExists(duplicateCases), '0');
check('a second batch cannot replace registered cases or leave an orphan native R67 admission');

await until(plan.endsAtMs - 650);
const blocked = await capture(main, { purpose: 'VALIDATION' });
const lockName = 'r67-session:' + main.scopeId + ':' + main.sourceId + ':' + blocked.record.annotation.sessionId;
const lockHolder = heldTransaction("SELECT pg_advisory_xact_lock(hashtextextended('" + lockName + "',0));", 1.1);
await lockHolder.ready;
const blockedAdmission = assert.rejects(main.store.ingest(blocked), /R71_DATABASE_VALIDATION_WINDOW/);
await lockHolder.done; await blockedAdmission; assert.equal(await nativeExists(blocked), '0');
check('DB clock is re-read after native locks: a capture that waits across window end is rejected without native/contextual rows');

const now = (await main.store.now()).nowMs;
const evaluation = evaluateR71Evolution({ state: main.row.state, cases, nowMs: now });
assert.equal(evaluation.evaluation.status, 'APPLIED');
await append(main, evaluation.state); assert.equal(main.row.state.activeVersion.activationGeneration, 1);
assert.equal(main.row.state.promotions, 1);
check('complete measured 3-to-0 routing comparison with zero protected changes promotes only the bounded wrapper generation1');
const incompleteCases = await incomplete.store.readValidationCases({ planId: partialPlan.planId });
const incompleteResult = evaluateR71Evolution({ state: incomplete.row.state, cases: incompleteCases, nowMs: (await incomplete.store.now()).nowMs });
assert.equal(incompleteResult.evaluation.status, 'REJECTED_INCOMPLETE');
const forgedResult = clone(incompleteResult.state);
forgedResult.activeVersion = clone(partialPlan.candidateVersion); forgedResult.promotions = 1; forgedResult.candidateRetired = false;
await assert.rejects(rpc(R71_DATABASE_RPCS.appendState, scoped(incomplete, { operationId: operation(), expectedRevision: incomplete.row.revision,
  previousDigest: incomplete.row.stateDigest, state: forgedResult, actorId: 'system:r71' })), /R71_DATABASE_APPLY/);
await append(incomplete, incompleteResult.state); assert.equal(incomplete.row.state.activeVersion.forwardPositionOpen, false);
assert.equal(incomplete.row.state.candidateRetired, true);
check('incomplete registered evidence cannot be promoted by forged derived state; rejection permanently retires that candidate history');

const appliedRecord = await capture(main); const appliedSaved = await main.store.ingest(appliedRecord);
assert.equal(appliedSaved.record.annotation.wrapperVersion.activationGeneration, 1);
assert.equal(appliedSaved.record.annotation.entries.filter(e => e.effectiveDecision.action === 'manage_existing_position').length, 3);
const rolledBack = rollbackR71Evolution({ state: main.row.state, reason: 'OWNER_REQUEST', nowMs: (await main.store.now()).nowMs });
await assert.rejects(main.store.appendState({ operationId: operation(), expectedRevision: main.row.revision,
  previousDigest: main.row.stateDigest, state: rolledBack, actorId: 'system:r71' }), /R71_DATABASE_ROLLBACK/);
await append(main, rolledBack, 'user:71717171-7171-4717-8717-717171717171');
assert.equal(main.row.state.activeVersion.activationGeneration, 2); assert.equal(main.row.state.candidateRetired, true);
const afterRollback = await main.store.ingest(await capture(main));
assert.equal(afterRollback.record.annotation.entries.filter(e => e.effectiveDecision.action === 'manage_existing_position').length, 0);
assert.equal(main.row.state.history.at(-1).action, 'ROLLED_BACK');
check('authenticated-actor rollback preserves history, restores reference generation2 and prevents a system-actor rollback');
const overview = await main.store.readOverview({ limit: 30 });
assert.deepEqual(overview.state, await main.store.readState()); assert.equal(overview.operations.length, 5);
assert.deepEqual((await main.store.readStudyPage({ snapshotId: frozen.snapshotId, afterOrdinal: 0, limit: 1 })).snapshot, frozen);
check('overview and frozen study remain readable after apply/rollback with immutable version operation history');

// Honest signed protocol fixtures, not copied database rows, exercise the hard
// 256-record ceiling. Snapshot construction rejects overflow atomically.
const beforeCap = Number(await countPairs(main));
const capScenarios = [0, 2, 4].map(index => R71_FIXTURE_SCENARIOS[index]);
const capContexts = [0, 2, 4].map(index => R71_FIXTURE_POSITION_CONTEXTS[index]);
for (let i = beforeCap; i < 257; i++) await main.store.ingest(await capture(main, { scenarios: capScenarios, positionContexts: capContexts }));
const snapshotsBeforeCap = await psql("SELECT count(*) FROM public.jenios_robot_private_studies_r71 WHERE scope_id='" + main.scopeId + "';");
await assert.rejects(main.store.freezeStudy({ operationId: operation(), period: { startMs: 0, endMs: (await main.store.now()).nowMs } }), /R71_DATABASE_SNAPSHOT_LIMIT/);
assert.equal(await psql("SELECT count(*) FROM public.jenios_robot_private_studies_r71 WHERE scope_id='" + main.scopeId + "';"), snapshotsBeforeCap);
assert.equal(await psql("SELECT count(*) FROM public.jenios_robot_private_study_members_r71 m LEFT JOIN public.jenios_robot_private_studies_r71 s USING(scope_id,source_id,snapshot_id) WHERE s.snapshot_id IS NULL;"), '0');
check('257 valid signed contextual pairs exceed the ceiling: snapshot rejects atomically instead of truncating or leaving orphan members');
assert.equal(await legacySnapshot(), legacyBefore);
assert.equal(await psql("SELECT to_jsonb(t)::text FROM public.jenios_robot_private_captures_r67 t WHERE scope_id='" + main.scopeId + "' AND event_id='" + bare.receipt.nativeReceipt.eventId + "';"), bareBefore);
check('existing R64/R65 table contents and the bare R67 original remain unchanged through the complete cycle');

const evidence = { schema: 'JENIOS_R71_POSTGRES_ACCEPTANCE_V1', status: 'PASS', commit: process.env.GITHUB_SHA || null,
  capturedAt: new Date().toISOString(), database: 'DISPOSABLE_LOCAL_POSTGRESQL', postgresVersion: await psql('SHOW server_version;'),
  evidenceKind: R71_PROTOCOL_FIXTURE_KIND, originalPrivateExecutableLoaded: false, originalPrivateExecutableExecuted: false,
  realConcurrentConnections: true, clock: 'POSTGRESQL_CLOCK_TIMESTAMP_AFTER_LOCKS', snapshotCut: 'SINGLE_INSERT_SELECT_MVCC',
  membershipDigestAlgorithm: 'SHA256_POSTGRESQL_JSONB_TEXT_UTF8_V1', signatureAuthenticationLayer: 'APPLICATION_VERIFIER',
  sqlCryptographicSignatureVerification: false, serviceRoleBypassesRls: true,
  scopeIsolation: 'EXPLICIT_RPC_AND_SERVER_STORE_BINDING', snapshotRecords: 33, snapshotPages: pageCount,
  lateCommitRecordsInNextSnapshot: 34, validationCases: cases.length, incompleteValidationCases: incompleteCases.length,
  syntheticRoutingBaselineMisses: evaluation.evaluation.summary.baselineMissedExistingPositionRouting,
  syntheticRoutingCandidateMisses: evaluation.evaluation.summary.candidateMissedExistingPositionRouting,
  finalWrapperGeneration: main.row.state.activeVersion.activationGeneration, capTestRetainedPairs: 257,
  counts: { total: checks.length, passed: checks.length, failed: 0, notRun: 0 }, checks, ...R71_BOUNDARIES,
  productionDatabaseAccessed: false, migrationAppliedToSupabase: false, productionConfigurationChanged: false, actualHostIdentityVerified: false };
const directory = process.env.ROBOT_QA_ARTIFACT_DIR;
if (directory) { mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, 'r71-postgres-acceptance.json'), JSON.stringify(evidence, null, 2) + '\n'); }
console.log('R71_POSTGRES_ACCEPTANCE ' + JSON.stringify(evidence));
