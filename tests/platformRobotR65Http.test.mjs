import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createR65AdminHandler, createR65SchedulerHandler, createR65ObservationHandler } from '../lib/platform/research/robot-r65-http.mjs';
import { isR65AdminFeed, projectR65AdminFeed, requireR65AdminFeed } from '../lib/platform/research/robot-r65-admin-view.mjs';
import { createR65EvolutionState, registerR65Evaluation, runR65EvolutionCycle } from '../lib/platform/research/robot-r65-evolution-engine.mjs';
import { createR65ObservationSource, verifyR65ObservationRecord } from '../lib/platform/research/robot-r65-observation-source.mjs';
import { createR65RegisteredBenchmark } from '../lib/platform/research/robot-r65-cycle-worker.mjs';
import { scheduleR64TelemetryPeriod } from '../lib/platform/research/robot-r64-telemetry.mjs';

const T = Date.UTC(2026, 9, 24, 12), SCOPE = 'scope:0000000000000001';
const USER = '11111111-1111-4111-8111-111111111165';
const CYCLE = '00000000-0000-4000-8000-000000000065';
const ARCHIVE = '00000000-0000-4000-8000-000000000066';
const OP = 'op:' + 'a'.repeat(32), DIGEST = 'b'.repeat(64);
const TOKEN = 'r65-unit-scheduler-token-never-real-000001';
const clone = value => JSON.parse(JSON.stringify(value));
const environment = () => ({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_R65_ENABLED: 'true',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', JENIOS_ROBOT_R65_SCHEDULER_TOKEN: TOKEN });
function request(method = 'GET', { body, token, type = 'application/json', headers = {},
  url = 'https://qa.invalid/api/platform/robot-evolution' } = {}) {
  return new Request(url, { method,
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    headers: { ...(body === undefined ? {} : { 'Content-Type': type }),
      ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers } });
}
function database({ admin = true, invalid = false, anonymous = false, userId = USER, grantFailure = false } = {}) {
  return {
    auth: { async getUser(token) {
      assert.equal(typeof token, 'string');
      return invalid ? { data: { user: null }, error: { message: 'private authentication secret' } } :
        { data: { user: { id: userId, is_anonymous: anonymous, app_metadata: { platform_role: admin ? 'admin' : 'user' } } }, error: null };
    } },
    from(table) {
      assert.equal(table, 'jenios_platform_admin_permissions');
      return { select() { return { async eq() { return grantFailure ?
        { data: null, error: { message: 'private permission failure' } } :
        { data: [{ permission: 'platform.reports' }, { permission: 'platform.admin' }], error: null }; } }; } };
    },
  };
}
function feed() {
  const state = createR65EvolutionState({ scopeId: SCOPE, nowMs: T });
  return projectR65AdminFeed({ scopeId: SCOPE,
    overview: { scopeId: SCOPE, archiveMode: 'LOGICAL_COPY_ONLY', physicalDeletionPerformed: false,
      spaceReclaimedBytes: 0, archives: [], reconciliations: [], pendingReconciliations: [] },
    evolution: { scopeId: SCOPE, revision: 0, stateDigest: DIGEST, state }, generatedAtMs: T });
}
function fixture(options = {}) {
  const f = { calls: [], dbReads: 0, runtimeReads: 0, feed: feed() };
  const result = { status: 'WAITING_VALIDATION_WINDOW', revision: 1,
    activeVersion: { versionId: 'research:r65-v1', maxAgeMs: 750, activatedAtMs: T, activationGeneration: 0 },
    nextAtMs: T + 1000, privateJournal: 'must-not-be-returned' };
  const runtime = {
    scopeId: SCOPE,
    async readFeed(...args) { f.calls.push(['readFeed', args]); return f.feed; },
    async runTick(...args) { f.calls.push(['runTick', args]); return clone(result); },
    async rollback(args) { f.calls.push(['rollback', clone(args)]); return { ...clone(result), status: 'ROLLED_BACK' }; },
    lifecycleStore: {
      async previewArchive(args) { f.calls.push(['previewArchive', clone(args)]); return {
        archiveId: ARCHIVE, status: 'PREVIEW', manifestDigest: DIGEST, eventCount: 2,
        cycleCount: 1, expiresAtMs: T + 60000, rawManifest: 'private archive payload' }; },
      async commitArchive(args) { f.calls.push(['commitArchive', clone(args)]); return {
        archiveId: ARCHIVE, status: 'COMMITTED', manifestDigest: DIGEST, replayed: false,
        physicalDeletionPerformed: false, spaceReclaimedBytes: 0, rawManifest: 'private archive payload' }; },
      async reconcileCost(args) { f.calls.push(['reconcileCost', clone(args)]); return {
        status: 'RECONCILED', replayed: false, generationEnabled: false, rawProviderBody: 'private provider response' }; },
    },
  };
  f.runtime = runtime;
  f.getRuntime = () => { f.runtimeReads++; return runtime; };
  f.getDb = () => { f.dbReads++; return database(options); };
  f.admin = createR65AdminHandler({ env: environment(), getDb: f.getDb, getRuntime: f.getRuntime });
  f.scheduler = createR65SchedulerHandler({ env: environment(), getRuntime: f.getRuntime });
  return f;
}
const rollback = () => ({ action: 'ROLLBACK', operationId: OP, expectedRevision: 2,
  previousDigest: DIGEST, reason: 'OWNER_REQUEST' });
const commit = () => ({ action: 'ARCHIVE_COMMIT', operationId: OP, archiveId: ARCHIVE, manifestDigest: DIGEST });
const reconcile = () => ({ action: 'RECONCILE_COST', operationId: OP, cycleId: CYCLE,
  expectedFingerprint: DIGEST, evidenceDigest: 'c'.repeat(64),
  resolution: { kind: 'CONFIRMED_USAGE', costNanoUsd: 1250, providerResponseId: 'resp_fixture_only' } });

test('R65 HTTP environment gates precede database, session, runtime and worker dependencies', async () => {
  let touched = 0; const forbidden = () => { touched++; throw new Error('must not construct'); };
  for (const env of [{}, { ...environment(), VERCEL_ENV: 'production' },
    { ...environment(), JENIOS_REAL_EXECUTION_ENABLED: 'true' },
    { ...environment(), JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'true' },
    { ...environment(), JENIOS_ROBOT_R65_ENABLED: 'false' }]) {
    const handlers = [createR65AdminHandler({ env, getDb: forbidden, getRuntime: forbidden }),
      createR65SchedulerHandler({ env, getRuntime: forbidden })];
    for (const handler of handlers) assert.equal((await handler(request('POST', { token: TOKEN }))).status, 404);
  }
  assert.equal(touched, 0);
});

test('R65 HTTP refuses unsupported methods and missing bearer authentication before dependencies', async () => {
  const f = fixture();
  assert.equal((await f.admin(request('DELETE', { token: 'fixture-session' }))).status, 405);
  assert.equal((await f.admin(request())).status, 401);
  for (const authorization of ['Basic fixture', 'Bearer', 'Bearer two values'])
    assert.equal((await f.admin(request('GET', { headers: { authorization } }))).status, 401);
  assert.equal(f.dbReads, 0);
  assert.equal(f.runtimeReads, 0);
});

test('R65 admin requires a valid nonanonymous Platform administrator before constructing the runtime', async () => {
  for (const [options, expected] of [[{ invalid: true }, 401], [{ anonymous: true }, 401],
    [{ admin: false }, 403], [{ userId: 'invalid-id' }, 403], [{ userId: '-'.repeat(36) }, 403],
    [{ admin: false, grantFailure: true }, 503]]) {
    const f = fixture(options), response = await f.admin(request('GET', { token: 'fixture-session' }));
    assert.equal(response.status, expected);
    assert.equal(f.runtimeReads, 0);
    assert.equal((await response.text()).includes('private'), false);
  }
});

test('R65 admin GET returns a closed server-scoped feed and ignores attempted scope selection in the URL', async () => {
  const f = fixture();
  const response = await f.admin(request('GET', { token: 'fixture-session',
    url: 'https://qa.invalid/api/platform/robot-evolution?scopeId=scope:ffffffffffffffff' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  const data = await response.json();
  assert.equal(data.scopeId, SCOPE);
  assert.equal(data.privateEngineConnected, false);
  assert.equal(data.customerMonitoringActive, false);
  assert.equal(data.observationEvidenceKind, 'SIGNED_QA_REPLAY');
  assert.equal(data.validationEvidenceKind, 'SYNTHETIC_FIXTURE');
  assert.equal(requireR65AdminFeed(data), data);
  assert.deepEqual(f.calls, [['readFeed', []]]);
});

test('R65 admin tick passes no caller parameters and projects only its reviewable outcome', async () => {
  const f = fixture(), response = await f.admin(request('POST', { token: 'fixture-session', body: { action: 'TICK' } }));
  assert.equal(response.status, 200);
  assert.deepEqual(f.calls, [['runTick', []]]);
  const data = await response.json();
  assert.equal(data.schema, 'JENIOS_R65_ADMIN_ACTION_V1');
  assert.equal(data.action, 'TICK');
  assert.equal(data.result.status, 'WAITING_VALIDATION_WINDOW');
  assert.equal(data.realOrdersSent, 0);
  assert.equal(data.externalPaperOrdersSent, 0);
  assert.equal(data.productionChanged, false);
  assert.equal(JSON.stringify(data).includes('must-not-be-returned'), false);
});

test('R65 rollback actor is derived from the authenticated user and cannot be supplied in the request', async () => {
  const f = fixture(), action = rollback();
  const response = await f.admin(request('POST', { token: 'fixture-session', body: action,
    url: 'https://qa.invalid/api/platform/robot-evolution?actorId=user:attacker&scopeId=scope:ffffffffffffffff' }));
  assert.equal(response.status, 200);
  const { action: _, ...expected } = action;
  assert.deepEqual(f.calls, [['rollback', { ...expected, actorId: 'user:' + USER }]]);
  const bad = await f.admin(request('POST', { token: 'fixture-session', body: { ...action, actorId: 'user:attacker' } }));
  assert.equal(bad.status, 400);
  assert.equal(f.calls.length, 1);
});

test('R65 archive operations pin scope and actor and never expose the archive body or claim physical deletion', async () => {
  const f = fixture();
  const preview = await f.admin(request('POST', { token: 'fixture-session', body: { action: 'ARCHIVE_PREVIEW', cutoffMs: T - 1, limit: 2 } }));
  assert.equal(preview.status, 200);
  assert.deepEqual(f.calls[0], ['previewArchive', { scopeId: SCOPE, cutoffMs: T - 1, limit: 2 }]);
  const p = await preview.json();
  assert.equal(p.result.archiveMode, 'LOGICAL_COPY_ONLY');
  assert.equal(JSON.stringify(p).includes('private archive'), false);
  const committed = await f.admin(request('POST', { token: 'fixture-session', body: commit() }));
  assert.equal(committed.status, 200);
  assert.deepEqual(f.calls[1], ['commitArchive', { scopeId: SCOPE, operationId: OP, archiveId: ARCHIVE,
    manifestDigest: DIGEST, actorId: 'user:' + USER }]);
  const c = await committed.json();
  assert.equal(c.result.physicalDeletionPerformed, false);
  assert.equal(c.result.spaceReclaimedBytes, 0);
  assert.equal(JSON.stringify(c).includes('private archive'), false);
});

test('R65 cost reconciliation pins the trusted scope and actor while leaving paid generation disabled', async () => {
  const f = fixture(), action = reconcile();
  const response = await f.admin(request('POST', { token: 'fixture-session', body: action }));
  assert.equal(response.status, 200);
  const { action: _, ...input } = action;
  assert.deepEqual(f.calls, [['reconcileCost', { ...input, scopeId: SCOPE, actorId: 'user:' + USER }]]);
  const data = await response.json();
  assert.equal(data.result.paidGenerationEnabled, false);
  assert.equal(JSON.stringify(data).includes('private provider'), false);
  const noCharge = reconcile(); noCharge.resolution = { kind: 'CONFIRMED_NO_CHARGE', costNanoUsd: 0, providerResponseId: null };
  assert.equal((await f.admin(request('POST', { token: 'fixture-session', body: noCharge }))).status, 200);
});

test('R65 rejects foreign origins and non-JSON action bodies before constructing the runtime', async () => {
  const f = fixture();
  for (const origin of ['https://foreign.invalid', 'null', 'not-an-origin']) {
    const response = await f.admin(request('POST', { token: 'fixture-session', body: { action: 'TICK' }, headers: { Origin: origin } }));
    assert.equal(response.status, 403);
  }
  assert.equal((await f.admin(request('POST', { token: 'fixture-session', body: '{}', type: 'text/plain' }))).status, 415);
  assert.equal(f.runtimeReads, 0);
  assert.equal((await f.admin(request('POST', { token: 'fixture-session', body: { action: 'TICK' },
    type: 'application/json; charset=utf-8', headers: { Origin: 'https://qa.invalid' } }))).status, 200);
});

test('R65 action schema rejects unknown fields, client-selected scope, invalid ranges and arbitrary resolutions', async () => {
  const f = fixture();
  const invalid = [null, [], {}, { action: 'EXECUTE_ORDER' }, { action: 'TICK', scopeId: 'scope:ffffffffffffffff' },
    { ...rollback(), expectedRevision: -1 }, { ...rollback(), previousDigest: 'short' },
    { ...rollback(), reason: 'disable guards' }, { action: 'ARCHIVE_PREVIEW', cutoffMs: T, limit: 11 },
    { action: 'ARCHIVE_PREVIEW', cutoffMs: -1, limit: 1 }, { ...commit(), extra: 'private' },
    { ...reconcile(), scopeId: 'scope:ffffffffffffffff' }];
  for (const body of invalid)
    assert.equal((await f.admin(request('POST', { token: 'fixture-session', body }))).status, 400);
  for (const resolution of [null, { kind: 'APPROVED', costNanoUsd: 0, providerResponseId: null },
    { kind: 'CONFIRMED_USAGE', costNanoUsd: -1, providerResponseId: 'resp_x' },
    { kind: 'CONFIRMED_NO_CHARGE', costNanoUsd: 10, providerResponseId: null },
    { kind: 'CONFIRMED_NO_CHARGE', costNanoUsd: 0, providerResponseId: 'resp_x' },
    { kind: 'CONFIRMED_USAGE', costNanoUsd: 1, providerResponseId: 'resp_x', rawText: 'private' }]) {
    assert.equal((await f.admin(request('POST', { token: 'fixture-session', body: { ...reconcile(), resolution } }))).status, 400);
  }
  assert.equal(f.runtimeReads, 0);
});

test('R65 rejects malformed, oversized and invalid UTF-8 JSON without calling lifecycle dependencies', async () => {
  const f = fixture();
  for (const body of ['{broken', ' '.repeat(16385), '{"action":"TICK","__proto__":{"scopeId":"forged"}}'])
    assert.equal((await f.admin(request('POST', { token: 'fixture-session', body }))).status, 400);
  const length = await f.admin(request('POST', { token: 'fixture-session', body: { action: 'TICK' },
    headers: { 'Content-Length': '16385' } }));
  assert.equal(length.status, 400);
  const invalidUtf8 = new Request('https://qa.invalid/api/platform/robot-evolution', {
    method: 'POST', body: new Uint8Array([0xff, 0xfe]),
    headers: { Authorization: 'Bearer fixture-session', 'Content-Type': 'application/json' } });
  assert.equal((await f.admin(invalidUtf8)).status, 400);
  assert.equal(f.runtimeReads, 0);
});

test('R65 mandatory operation identifiers reject falsy and malformed values before runtime construction', async () => {
  const f = fixture();
  for (const template of [rollback, commit, reconcile]) for (const operationId of ['', null, false, 0, 'bad', 'op:' + 'g'.repeat(32)]) {
    const response = await f.admin(request('POST', { token: 'fixture-session', body: { ...template(), operationId } }));
    assert.equal(response.status, 400);
  }
  assert.equal(f.runtimeReads, 0);
});

test('R65 action UUIDs and provider response IDs use the same structural limits as the store', async () => {
  const f = fixture();
  for (const body of [{ ...commit(), archiveId: '-'.repeat(36) },
    { ...reconcile(), cycleId: 'a'.repeat(36) },
    { ...reconcile(), resolution: { kind: 'CONFIRMED_USAGE', costNanoUsd: 1, providerResponseId: 'resp_' + 'x'.repeat(161) } }]) {
    assert.equal((await f.admin(request('POST', { token: 'fixture-session', body }))).status, 400);
  }
  assert.equal(f.runtimeReads, 0);
});

test('R65 validates closed admin feed boundaries and refuses private extras or impossible active versions', async () => {
  for (const change of [
    v => { v.privateKey = 'secret-do-not-return'; }, v => { v.privateEngineConnected = true; },
    v => { v.actualBrokerPnl = 100; }, v => { v.operationalDataDisclosureRequired = false; },
    v => { v.state.activeVersion.versionId = null; }, v => { v.state.activeVersion.maxAgeMs = 1000; },
    v => { v.state.rawJournal = 'secret-do-not-return'; }, v => { v.archiveMode = 'PHYSICAL_DELETE'; },
  ]) {
    const f = fixture(); f.feed = clone(f.feed); change(f.feed);
    assert.equal(isR65AdminFeed(f.feed), false);
    const response = await f.admin(request('GET', { token: 'fixture-session' }));
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes('secret-do-not-return'), false);
  }
});

test('R65 feed validation never evaluates getters while refusing malformed server projections', () => {
  let calls = 0; const value = clone(feed());
  Object.defineProperty(value.state.activeVersion, 'maxAgeMs', { enumerable: true, get() { calls++; return 750; } });
  assert.equal(isR65AdminFeed(value), false);
  assert.throws(() => requireR65AdminFeed(value), /R65_ADMIN_FEED_INVALID/);
  assert.equal(calls, 0);
});

test('R65 incomplete evaluation projects its three executed cases without inventing comparison metrics', () => {
  const state = createR65EvolutionState({ scopeId: SCOPE, nowMs: T - 86400000 });
  const { privateKey } = generateKeyPairSync('ed25519'), sessionId = 'session:0000000000000001';
  const { period } = scheduleR64TelemetryPeriod({ nowMs: T });
  const source = createR65ObservationSource({ enabled: true, domain: 'R61_SYNTHETIC_RUNTIME',
    scopeId: SCOPE, sourceId: 'source:0000000000000001', sessionId,
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }),
    getActiveState: () => state, initialSequence: 1, now: () => T,
    getOccurrenceTimeMs: ({ sequence }) => period.endMs - 10000 + sequence,
    ultraConfig: { evidenceKind: 'SYNTHETIC_FIXTURE', sessionId, planCode: 'platform-global-crypto',
      symbol: 'BTC-USD', capital: 1000, leverage: 2 } });
  const receipts = [1, 2, 3].map(index => {
    const observation = source.captureUltra({ operationId: 'op:' + index.toString(16).padStart(32, '0'),
      event: { type: 'snapshot', scenario: 'normal', marketAgeMs: 1000 } });
    return verifyR65ObservationRecord(observation, { trustedSource: source.trustedSource, nowMs: T }).receipt;
  });
  const plan = createR65RegisteredBenchmark({ scopeId: SCOPE, sourceCycleId: CYCLE, nowMs: T + 1 });
  const registered = registerR65Evaluation({ state, receipts, period, studyAtMs: T,
    sourceCycleId: CYCLE, plan, nowMs: T + 1 });
  const validationCases = plan.caseDefinitions.slice(0, 3).map((definition, index) => ({
    ...definition, scopeId: SCOPE, evidenceKind: 'SYNTHETIC_FIXTURE', occurredAtMs: plan.startsAtMs + index }));
  const evaluated = runR65EvolutionCycle({ state: registered, validationCases, nowMs: plan.endsAtMs }).state;
  const projected = projectR65AdminFeed({ scopeId: SCOPE,
    overview: { scopeId: SCOPE, archiveMode: 'LOGICAL_COPY_ONLY', physicalDeletionPerformed: false,
      spaceReclaimedBytes: 0, archives: [], reconciliations: [], pendingReconciliations: [] },
    evolution: { scopeId: SCOPE, revision: evaluated.revision, stateDigest: DIGEST, state: evaluated },
    generatedAtMs: plan.endsAtMs });
  assert.equal(projected.state.lastEvaluation.status, 'REJECTED');
  assert.equal(projected.state.lastEvaluation.reason, 'INCOMPLETE_PREREGISTERED_WINDOW');
  assert.equal(projected.state.lastEvaluation.validationCases, 3);
  for (const key of ['baselineFalseAllows', 'candidateFalseAllows', 'baselineFalseBlocks', 'candidateFalseBlocks'])
    assert.equal(projected.state.lastEvaluation[key], null);
  assert.equal(projected.state.activeVersion.maxAgeMs, 750);
});

test('R65 admin errors are classified without exposing database, source, provider or session details', async () => {
  for (const [code, status] of [['R65_EVOLUTION_CONFLICT', 409], ['R65_FROZEN_OBSERVATION_REPLAY_MISMATCH', 409],
    ['R65_VALIDATION_WINDOW_NOT_OPEN', 409], ['R65_NO_PREVIOUS_VERSION', 409], ['R65_DATABASE_UNAVAILABLE', 503]]) {
    const f = fixture();
    f.runtime.runTick = async () => { throw Object.assign(new Error('private-database-url provider-key user-email'), { code }); };
    const response = await f.admin(request('POST', { token: 'fixture-session', body: { action: 'TICK' } }));
    assert.equal(response.status, status);
    const text = await response.text();
    assert.equal(text.includes('private-database-url'), false);
    assert.equal(text.includes('provider-key'), false);
    assert.equal(text.includes('user-email'), false);
  }
  const f = fixture();
  f.runtime.readFeed = async () => { throw new Error('private-database-url'); };
  const response = await f.admin(request('GET', { token: 'fixture-session' }));
  assert.equal(response.status, 503);
  assert.equal(Object.hasOwn(await response.json(), 'state'), false);
});

test('R65 scheduler authorizes only its configured token and POST before constructing the runtime', async () => {
  const f = fixture();
  assert.equal((await f.scheduler(request('GET', { token: TOKEN }))).status, 405);
  assert.equal((await f.scheduler(request('POST'))).status, 401);
  assert.equal((await f.scheduler(request('POST', { token: 'fixture-session' }))).status, 401);
  for (const configured of ['', 'too-short', 'x'.repeat(257)]) {
    const handler = createR65SchedulerHandler({ env: { ...environment(), JENIOS_ROBOT_R65_SCHEDULER_TOKEN: configured },
      getRuntime: f.getRuntime });
    assert.equal((await handler(request('POST', { token: TOKEN }))).status, 401);
  }
  assert.equal(f.runtimeReads, 0);
});

test('R65 scheduler runs with no arguments and URL parameters cannot select its scope or operation', async () => {
  const f = fixture();
  const response = await f.scheduler(request('POST', { token: TOKEN,
    url: 'https://qa.invalid/api/platform/robot-evolution-scheduler?scopeId=scope:ffffffffffffffff&action=ROLLBACK' }));
  assert.equal(response.status, 200);
  assert.deepEqual(f.calls, [['runTick', []]]);
  const data = await response.json();
  assert.equal(data.schema, 'JENIOS_R65_SCHEDULE_RESULT_V1');
  assert.equal(data.productionSchedulerStarted, false);
  assert.equal(data.realOrdersSent, 0);
  assert.equal(data.externalPaperOrdersSent, 0);
  assert.equal(Object.hasOwn(data, 'privateJournal'), false);
  assert.equal(Object.hasOwn(data, 'scopeId'), false);
});

test('R65 scheduler rejects any body before runtime construction', async () => {
  const f = fixture();
  for (const body of [{}, { scopeId: SCOPE }, ' ', '\n', 'null']) {
    const response = await f.scheduler(request('POST', { token: TOKEN, body }));
    assert.equal(response.status, 400);
  }
  assert.equal(f.runtimeReads, 0);
});

test('R65 scheduler cancels an unbounded body after its first chunk', async () => {
  const f = fixture(); let pulls = 0, cancelled = false;
  const body = new ReadableStream({ pull(controller) {
    pulls++; controller.enqueue(new Uint8Array(65536)); if (pulls >= 10) controller.close();
  }, cancel() { cancelled = true; } });
  const raw = new Request('https://qa.invalid/api/platform/robot-evolution-scheduler', {
    method: 'POST', body, duplex: 'half', headers: { Authorization: 'Bearer ' + TOKEN } });
  assert.equal((await f.scheduler(raw)).status, 400);
  assert.equal(f.runtimeReads, 0);
  assert.equal(cancelled, true);
  assert(pulls < 10);
});

test('R65 scheduler times out a stalled body without invoking work', async () => {
  const f = fixture(); let cancelled = false;
  const body = new ReadableStream({ pull() {}, cancel() { cancelled = true; } });
  const raw = new Request('https://qa.invalid/api/platform/robot-evolution-scheduler', {
    method: 'POST', body, duplex: 'half', headers: { Authorization: 'Bearer ' + TOKEN } });
  assert.equal((await f.scheduler(raw)).status, 400);
  assert.equal(f.runtimeReads, 0);
  assert.equal(cancelled, true);
});

test('R65 scheduler sanitizes worker failures and does not claim a fabricated result', async () => {
  const f = fixture();
  f.runtime.runTick = async () => { throw new Error('private source key and database password'); };
  const response = await f.scheduler(request('POST', { token: TOKEN }));
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(Object.hasOwn(data, 'revision'), false);
  assert.equal(JSON.stringify(data).includes('password'), false);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

function signedObservation() {
  const { privateKey } = generateKeyPairSync('ed25519');
  const state = createR65EvolutionState({ scopeId: SCOPE, nowMs: T - 10000 });
  const sessionId = 'session:0000000000000001';
  const source = createR65ObservationSource({ enabled: true, domain: 'R61_SYNTHETIC_RUNTIME',
    scopeId: SCOPE, sourceId: 'source:0000000000000001', sessionId,
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }),
    getActiveState: () => state, initialSequence: 1, now: () => T,
    ultraConfig: { evidenceKind: 'SYNTHETIC_FIXTURE', sessionId, planCode: 'platform-global-crypto',
      symbol: 'BTC-USD', capital: 1000, leverage: 2 } });
  return { source, record: source.captureUltra({ operationId: OP,
    event: { type: 'snapshot', scenario: 'normal', marketAgeMs: 1000 } }) };
}

test('R65 signed observation gates run before source or persistence dependencies', async () => {
  let sources = 0, stores = 0;
  const dependencies = { getSource: () => { sources++; throw Error('must not read'); },
    getStore: () => { stores++; throw Error('must not write'); }, now: () => T };
  const disabled = createR65ObservationHandler({ ...dependencies, env: {} });
  assert.equal((await disabled(request('POST', { body: {} }))).status, 404);
  const enabled = createR65ObservationHandler({ ...dependencies, env: environment() });
  assert.equal((await enabled(request('GET'))).status, 405);
  assert.equal((await enabled(request('POST', { body: '{}', type: 'text/plain' }))).status, 415);
  assert.equal(sources, 0);
  assert.equal(stores, 0);
});

test('R65 observation intake verifies both real source signatures, persists only the admitted pair and confirms retries', async () => {
  const { source, record } = signedObservation(), stored = [];
  const handler = createR65ObservationHandler({ env: environment(), now: () => T,
    getSource: () => source.trustedSource, getStore: () => ({ async ingestObservation(args) {
      stored.push(args); return { status: stored.length === 1 ? 'STORED' : 'ALREADY_STORED' };
    } }) });
  const first = await handler(request('POST', { body: record }));
  assert.equal(first.status, 202);
  assert.deepEqual(Object.keys(stored[0]).sort(), ['provenance', 'receipt']);
  assert.equal(stored[0].receipt.proof.configuredSourceSignatureVerified, true);
  assert.equal(stored[0].provenance.origin, 'R61_SYNTHETIC_RUNTIME');
  assert.equal(stored[0].provenance.runtimeEvidenceKind, 'SYNTHETIC_FIXTURE');
  assert.equal(stored[0].receipt.evidenceKind, 'SIGNED_QA_REPLAY');
  assert.equal(stored[0].provenance.payloadDigest, stored[0].receipt.payloadDigest);
  const data = await first.json();
  assert.equal(data.scopeId, SCOPE);
  assert.equal(data.eventId, record.envelope.payload.eventId);
  assert.equal(data.runtimeOrigin, 'R61_SYNTHETIC_RUNTIME');
  assert.equal(data.privateEngineConnected, false);
  assert.equal(data.customerMonitoringActive, false);
  assert.equal(data.realOrdersSent, 0);
  assert.equal(data.externalPaperOrdersSent, 0);
  for (const privateField of ['provenance', 'signatureBase64', 'provenanceSignatureBase64', 'inputDigest', 'publicKeyPem'])
    assert.equal(Object.hasOwn(data, privateField), false);
  assert.equal((await handler(request('POST', { body: record }))).status, 200);
  assert.deepEqual(stored[0], stored[1]);
  assert.equal(first.headers.get('Cache-Control'), 'no-store');
});

test('R65 observation intake refuses payload, sidecar and provenance-claim tampering before opening a store', async () => {
  const { source, record } = signedObservation(); let stores = 0;
  const handler = createR65ObservationHandler({ env: environment(), now: () => T,
    getSource: () => source.trustedSource, getStore: () => { stores++; return {}; } });
  for (const change of [
    r => { r.envelope.payload.event.marketAgeMs++; },
    r => { r.provenance.activationGeneration++; },
    r => { r.provenance.automaticPromotionAllowed = true; },
    r => { r.provenance.origin = 'OPERATIONAL'; },
    r => { r.provenance.executionAllowed = true; },
    r => { r.envelope.payload.scopeId = 'scope:ffffffffffffffff'; },
    r => { r.privateCustomerEmail = 'private-customer@example.invalid'; },
  ]) {
    const altered = clone(record); change(altered);
    const response = await handler(request('POST', { body: altered }));
    assert.equal(response.status, 400);
    assert.equal((await response.text()).includes('private-customer'), false);
  }
  assert.equal(stores, 0);
});

test('R65 observation intake refuses a wrong pinned key, source, scope, raw R64 envelope or substituted sidecar', async () => {
  const one = signedObservation(), other = signedObservation(); let stores = 0;
  for (const trustedSource of [other.source.trustedSource,
    { ...one.source.trustedSource, sourceId: 'source:ffffffffffffffff' },
    { ...one.source.trustedSource, scopeId: 'scope:ffffffffffffffff' }]) {
    const handler = createR65ObservationHandler({ env: environment(), now: () => T,
      getSource: () => trustedSource, getStore: () => { stores++; return {}; } });
    assert.equal((await handler(request('POST', { body: one.record }))).status, 400);
  }
  const handler = createR65ObservationHandler({ env: environment(), now: () => T,
    getSource: () => one.source.trustedSource, getStore: () => { stores++; return {}; } });
  assert.equal((await handler(request('POST', { body: one.record.envelope }))).status, 400);
  const substituted = { ...one.record, provenanceSignatureBase64: other.record.provenanceSignatureBase64 };
  assert.equal((await handler(request('POST', { body: substituted }))).status, 400);
  assert.equal(stores, 0);
});

test('R65 observation intake rejects expired records without silently refreshing their signature lifetime', async () => {
  const { source, record } = signedObservation(); let stores = 0;
  const handler = createR65ObservationHandler({ env: environment(), now: () => T + 120000,
    getSource: () => source.trustedSource, getStore: () => { stores++; return {}; } });
  const response = await handler(request('POST', { body: record }));
  assert.equal(response.status, 400);
  assert.equal(stores, 0);
});

test('R65 observation intake bounds JSON at 32 KiB and never stores malformed bodies', async () => {
  const { source } = signedObservation(); let stores = 0;
  const handler = createR65ObservationHandler({ env: environment(), now: () => T,
    getSource: () => source.trustedSource, getStore: () => { stores++; return {}; } });
  for (const body of ['{broken', ' '.repeat(32769), null, []])
    assert.equal((await handler(request('POST', { body }))).status, 400);
  assert.equal(stores, 0);
});

test('R65 observation intake exposes conflict versus unavailable status while sanitizing persistence faults', async () => {
  const { source, record } = signedObservation();
  for (const [code, status] of [['R65_OBSERVATION_CONFLICT', 409], ['R65_SEQUENCE_CONFLICT', 409],
    ['R65_PROVENANCE_REPLAY_MISMATCH', 409], ['R65_DATABASE_UNAVAILABLE', 503]]) {
    const handler = createR65ObservationHandler({ env: environment(), now: () => T,
      getSource: () => source.trustedSource, getStore: () => ({ async ingestObservation() {
        throw Object.assign(new Error('private-storage-password raw-provenance-detail'), { code });
      } }) });
    const response = await handler(request('POST', { body: record }));
    assert.equal(response.status, status);
    const text = await response.text();
    assert.equal(text.includes('private-storage-password'), false);
    assert.equal(text.includes('raw-provenance-detail'), false);
  }
});

test('R65 observation intake never acknowledges an absent or unexpected persistence result', async () => {
  const { source, record } = signedObservation();
  for (const result of [null, {}, { status: 'CLAIMED' }, { status: 'APPLIED' }]) {
    const handler = createR65ObservationHandler({ env: environment(), now: () => T,
      getSource: () => source.trustedSource, getStore: () => ({ async ingestObservation() { return result; } }) });
    const response = await handler(request('POST', { body: record }));
    assert.equal(response.status, 503);
    assert.equal(Object.hasOwn(await response.json(), 'eventId'), false);
  }
});

test('R65 unavailable source configuration returns a sanitized response without reaching persistence', async () => {
  let stores = 0;
  const handler = createR65ObservationHandler({ env: environment(), now: () => T,
    getSource: () => { throw new Error('private-source-key'); }, getStore: () => { stores++; return {}; } });
  const response = await handler(request('POST', { body: {} }));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('private-source-key'), false);
  assert.equal(stores, 0);
});
