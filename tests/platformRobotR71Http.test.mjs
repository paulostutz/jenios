import test from 'node:test';
import assert from 'node:assert/strict';
import { createR71AdminHandler, createR71ObservationHandler, createR71SourceStateHandler,
  createR71SchedulerHandler } from '../lib/platform/research/robot-r71-http.mjs';
import { createR71EvolutionState, projectR71RuntimeView } from '../lib/platform/research/robot-r71-evolution-engine.mjs';
import { projectR71AdminFeed } from '../lib/platform/research/robot-r71-admin-view.mjs';
import { createR71SourceStateQuery, inspectR71SourceStateResult } from '../lib/platform/research/robot-r71-private-protocol.mjs';
import { createR71ProtocolFixture } from './fixtures/r71-private-protocol-fixture.mjs';
import { r67SourceKeyDigest } from '../lib/platform/research/robot-r67-private-protocol.mjs';

const T = Date.UTC(2026, 9, 24, 21), USER = '00000000-0000-4000-8000-000000000071';
const ORIGIN = 'https://r71-fixture.vercel.app', TOKEN = 'r71-fixture-scheduler-not-a-real-secret-001';
const qa = () => ({ VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview', VERCEL_URL: 'r71-fixture.vercel.app',
  VERCEL_PROJECT_ID: 'prj_R71Fixture', VERCEL_DEPLOYMENT_ID: 'dpl_R71Fixture', VERCEL_GIT_COMMIT_SHA: '71'.repeat(20),
  JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_ROBOT_R67_ENABLED: 'true',
  JENIOS_ROBOT_R71_ENABLED: 'true', JENIOS_ROBOT_R70_PREFLIGHT_ENABLED: 'true', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false',
  JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false',
  JENIOS_ROBOT_R71_ADMIN_ORIGIN: ORIGIN, JENIOS_ROBOT_R71_SCHEDULER_TOKEN: TOKEN });
function request({ method = 'GET', path = '/api/platform/admin/robot-private-evolution', body, token, type = 'application/json', headers = {} } = {}) {
  return new Request(ORIGIN + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(body !== undefined ? { 'Content-Type': type } : {}), ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
}
function dbFixture(kind = 'admin', afterAuth = () => {}) {
  return { auth: { async getUser() {
    afterAuth(); return { data: { user: kind === 'invalid' ? null : { id: USER, is_anonymous: kind === 'anonymous',
      app_metadata: { platform_role: kind === 'admin' ? 'admin' : 'member' }, user_metadata: { platform_role: 'admin' } } }, error: null };
  } }, from() { return { select() { return { async eq() {
    return { data: [{ permission: 'platform.admin' }, { permission: 'platform.reports' }], error: null };
  } }; } }; } };
}
async function setup(kind = 'admin') {
  const f = await createR71ProtocolFixture({ nowMs: T }), env = { ...qa(),
    JENIOS_ROBOT_R67_SCOPE_ID: f.trustedSource.scopeId, JENIOS_ROBOT_R67_SOURCE_ID: f.trustedSource.sourceId,
    JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY: f.trustedSource.publicKeyPem };
  const sourceKeySha256 = r67SourceKeyDigest(f.trustedSource);
  const state = createR71EvolutionState({ scopeId: f.trustedSource.scopeId, sourceId: f.trustedSource.sourceId, sourceKeySha256, nowMs: T - 10 });
  const row = { scopeId: state.scopeId, sourceId: state.sourceId, revision: 0, stateDigest: '71'.repeat(32), state };
  const view = projectR71RuntimeView(row), calls = [], counters = { source: 0, store: 0, runtime: 0, auth: 0 };
  const feed = projectR71AdminFeed({ scopeId: state.scopeId, sourceId: state.sourceId, sourceKeySha256,
    overview: { scopeId: state.scopeId, sourceId: state.sourceId, sourceKeySha256, snapshots: [], operations: [], state: row }, generatedAtMs: T });
  const runtime = { async readFeed() { calls.push('readFeed'); return feed; },
    async readRuntimeView() { calls.push('readRuntimeView'); return view; },
    async runTick() { calls.push('tick'); return { status: 'WAITING_CONTEXTUAL_OBSERVATIONS', revision: 0, activeVersion: state.activeVersion, privateJournal: 'not-public' }; },
    async rollback(input) { calls.push(input); return { status: 'ROLLED_BACK', revision: 5,
      activeVersion: { versionId: 'private:r71-reference-v1', activationGeneration: 2, forwardPositionOpen: false } }; } };
  const store = { async ingest(input) { calls.push('ingest'); return { status: 'STORED', ...input }; } };
  const getSource = () => { counters.source++; return f.trustedSource; };
  const getRuntime = () => { counters.runtime++; return runtime; };
  const getStore = () => { counters.store++; return store; };
  const getDb = () => { counters.auth++; return dbFixture(kind); };
  const pins = { schema: 'JENIOS_R70_TARGET_PINS_V1', origin: ORIGIN, projectId: env.VERCEL_PROJECT_ID,
    deploymentId: env.VERCEL_DEPLOYMENT_ID, commitSha: env.VERCEL_GIT_COMMIT_SHA,
    scopeId: state.scopeId, sourceId: state.sourceId, sourceKeySha256 };
  const query = createR71SourceStateQuery({ targetPins: pins, trustedSource: f.trustedSource,
    privateKeyPem: f.privateKeyPem, nowMs: T, nonce: '71'.repeat(32) });
  return { ...f, env, row, view, feed, pins, query, calls, counters, runtime, store, getDb, getSource, getRuntime, getStore,
    admin: createR71AdminHandler({ env, getDb, getRuntime }),
    intake: createR71ObservationHandler({ env, getSource, getStore, now: () => T + 1 }),
    control: createR71SourceStateHandler({ env, getSource, getRuntime, now: () => T + 1 }),
    scheduler: createR71SchedulerHandler({ env, getRuntime }) };
}

test('R71 disabled surfaces stop before body, authentication, source and database dependencies', async () => {
  let calls = 0; const forbidden = () => { calls++; throw Error('not permitted'); };
  for (const env of [{}, { ...qa(), VERCEL_ENV: 'production' }, { ...qa(), JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'true' }]) {
    for (const make of [createR71AdminHandler, createR71ObservationHandler, createR71SourceStateHandler, createR71SchedulerHandler]) {
      const handler = make({ env, getDb: forbidden, getSource: forbidden, getRuntime: forbidden, getStore: forbidden });
      assert.equal((await handler(request({ method: 'POST', body: '{invalid', token: TOKEN }))).status, 404);
    }
  }
  assert.equal(calls, 0);
});

test('R71 admin requires verified Platform admin identity and ignores forged user metadata or table admin grants', async () => {
  const f = await setup();
  assert.equal((await f.admin(request())).status, 401);
  for (const [kind, status] of [['member', 403], ['anonymous', 401], ['invalid', 401]]) {
    const denied = await setup(kind);
    assert.equal((await denied.admin(request({ token: 'explicit-fixture' }))).status, status);
    assert.equal(denied.counters.runtime, 0);
  }
  assert.equal(f.counters.auth, 0);
});

test('R71 admin GET is closed and server scoped; query overrides and malformed feeds expose no data', async () => {
  const f = await setup();
  const response = await f.admin(request({ token: 'explicit-fixture' }));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json(); assert.equal(body.sourceId, f.trustedSource.sourceId);
  assert.equal(body.internalCoreRetuning, false); assert.equal(body.hostedAuthenticationCertified, false);
  assert.equal((await f.admin(request({ token: 'explicit-fixture', path: '/api/platform/admin/robot-private-evolution?sourceId=forged' }))).status, 400);
  f.runtime.readFeed = async () => ({ ...f.feed, privateKey: 'secret-hidden' });
  const invalid = await f.admin(request({ token: 'explicit-fixture' })); assert.equal(invalid.status, 503);
  assert.equal((await invalid.text()).includes('secret-hidden'), false);
});

test('R71 admin mutations enforce canonical origin and closed CAS commands before runtime construction', async () => {
  const f = await setup(), body = { action: 'ROLLBACK', operationId: 'op:' + 'ab'.repeat(16), expectedRevision: 4,
    previousDigest: 'ab'.repeat(32), reason: 'OWNER_REQUEST' };
  for (const invalid of [{ ...body, actorId: 'user:forged' }, { ...body, expectedRevision: 32 },
    { ...body, operationId: '' }, { ...body, reason: 'arbitrary' }, { action: 'TICK', scopeId: f.trustedSource.scopeId }])
    assert.equal((await f.admin(request({ method: 'POST', token: 'explicit-fixture', body: invalid }))).status, 400);
  assert.equal((await f.admin(request({ method: 'POST', token: 'explicit-fixture', body,
    headers: { Origin: 'https://untrusted.invalid', Host: 'r71-fixture.vercel.app' } }))).status, 403);
  assert.equal(f.counters.runtime, 0);
  const response = await f.admin(request({ method: 'POST', token: 'explicit-fixture', body, headers: { Origin: ORIGIN } }));
  assert.equal(response.status, 200); assert.deepEqual(f.calls, [{ ...body, action: undefined, actorId: 'user:' + USER }].map(({ action, ...rest }) => rest));
  const data = await response.json(); assert.equal(data.result.activeVersion.activationGeneration, 2);
  assert.equal(Object.hasOwn(data, 'privateJournal'), false);
});

test('R71 asynchronous authentication and mutation completion recheck the QA gate', async () => {
  const f = await setup();
  const handler = createR71AdminHandler({ env: f.env, getRuntime: f.getRuntime,
    getDb: () => dbFixture('admin', () => { f.env.JENIOS_ROBOT_R71_ENABLED = 'false'; }) });
  assert.equal((await handler(request({ token: 'explicit-fixture' }))).status, 404); assert.equal(f.counters.runtime, 0);
  f.env.JENIOS_ROBOT_R71_ENABLED = 'true';
  f.runtime.runTick = async () => { f.env.JENIOS_ROBOT_R71_ENABLED = 'false'; return { status: 'WAITING_CONTEXTUAL_OBSERVATIONS', revision: 0, activeVersion: f.view.activeVersion }; };
  assert.equal((await f.admin(request({ method: 'POST', token: 'explicit-fixture', body: { action: 'TICK' } }))).status, 404);
});

test('R71 scheduler rejects reused credentials, query/body injection and gate changes before work', async () => {
  const f = await setup();
  for (const req of [request({ method: 'POST', token: 'wrong' }), request({ method: 'POST', token: TOKEN, body: {} }),
    request({ method: 'POST', token: TOKEN, path: '/api/platform/internal/robot-private-evolution?scopeId=forged' })])
    assert.ok([400, 401].includes((await f.scheduler(req)).status));
  f.env.JENIOS_ROBOT_R65_SCHEDULER_TOKEN = TOKEN;
  assert.equal((await f.scheduler(request({ method: 'POST', token: TOKEN }))).status, 401);
  delete f.env.JENIOS_ROBOT_R65_SCHEDULER_TOKEN;
  assert.equal(f.counters.runtime, 0);
  const response = await f.scheduler(request({ method: 'POST', token: TOKEN }));
  assert.equal(response.status, 200); const data = await response.json();
  assert.equal(data.productionSchedulerStarted, false); assert.equal(Object.hasOwn(data, 'privateJournal'), false);
});

test('R71 intake confirms the full contextual record only after the scoped store returns it', async () => {
  const f = await setup();
  for (const [status, http] of [['STORED', 202], ['ALREADY_STORED', 200]]) {
    f.store.ingest = async input => ({ ...input, status });
    const response = await f.intake(request({ method: 'POST', body: f.record }));
    assert.equal(response.status, http); const ack = await response.json();
    assert.equal(ack.recordDigest, f.receipt.recordDigest); assert.equal(ack.annotationDigest, f.receipt.annotationDigest);
    assert.equal(ack.entryCount, 8); assert.equal(ack.internalCoreRetuning, false);
  }
  const other = await createR71ProtocolFixture({ nowMs: T });
  f.store.ingest = async () => ({ status: 'STORED', receipt: other.receipt, record: other.record });
  assert.equal((await f.intake(request({ method: 'POST', body: f.record }))).status, 503);
});

test('R71 invalid signatures, media, oversized bodies and store faults never fabricate an acknowledgement', async () => {
  const f = await setup(), bad = structuredClone(f.record); bad.annotation.entries[0].positionOpen = false;
  for (const req of [request({ method: 'POST', body: bad }), request({ method: 'POST', body: f.record, type: 'text/plain' }),
    request({ method: 'POST', body: ' '.repeat(524289) })]) assert.ok([400, 415].includes((await f.intake(req)).status));
  assert.equal(f.counters.store, 0);
  for (const [code, status] of [['R71_DATABASE_STATE_CONFLICT', 409], ['R71_DATABASE_UNAVAILABLE', 503]]) {
    f.store.ingest = async () => { throw Object.assign(Error('private-password'), { code }); };
    const response = await f.intake(request({ method: 'POST', body: f.record }));
    assert.equal(response.status, status); assert.equal((await response.text()).includes('private-password'), false);
  }
});

test('R71 source-state reads require the extra signature domain and exact deployment pins before any DB read', async () => {
  const f = await setup();
  assert.equal((await f.control(request({ method: 'POST', body: f.query.challenge }))).status, 401);
  const corrupt = structuredClone(f.query); corrupt.signatureBase64 = 'A'.repeat(86) + '==';
  assert.equal((await f.control(request({ method: 'POST', body: corrupt }))).status, 401);
  f.env.VERCEL_GIT_COMMIT_SHA = '00'.repeat(20);
  assert.equal((await f.control(request({ method: 'POST', body: f.query }))).status, 409);
  assert.equal(f.counters.runtime, 0);
});

test('R71 source-state exposes only the bound runtime view, never initializes and rechecks metadata after DB wait', async () => {
  const f = await setup();
  const response = await f.control(request({ method: 'POST', body: f.query }));
  assert.equal(response.status, 200); const data = await response.json();
  const checked = inspectR71SourceStateResult(data, { query: f.query, targetPins: f.pins, trustedSource: f.trustedSource, nowMs: T + 1 });
  assert.deepEqual(checked.runtimeView, f.view);
  assert.equal(JSON.stringify(data).includes('latestStudy'), false); assert.deepEqual(f.calls, ['readRuntimeView']);
  f.runtime.readRuntimeView = async () => null;
  assert.equal((await f.control(request({ method: 'POST', body: f.query }))).status, 503);
  f.runtime.readRuntimeView = async () => { f.env.VERCEL_DEPLOYMENT_ID = 'dpl_Changed'; return f.view; };
  assert.equal((await f.control(request({ method: 'POST', body: f.query }))).status, 409);
});
