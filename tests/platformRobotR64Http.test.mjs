import test from 'node:test';
import assert from 'node:assert/strict';
import { createR64IntakeHandler, createR64SchedulerHandler, createR64AdminHandler }
  from '../lib/platform/research/robot-r64-http.mjs';
import { runR64OperationalCycle } from '../lib/platform/research/robot-r64-operational-worker.mjs';
import { isR64OperationalReport, requireR64AdminFeed } from '../lib/platform/research/robot-r64-admin-view.mjs';
import { createR64TelemetryFixture, signR64QaPayload } from '../scripts/platform/research/r64-telemetry-fixtures.mjs';

const fixture = createR64TelemetryFixture(), NOW = fixture.generatedAtMs, SCOPE = fixture.trustedSource.scopeId;
const TOKEN = 'r64-fixture-scheduler-token-never-real-0001';
const clone = value => JSON.parse(JSON.stringify(value));
const environment = () => ({ VERCEL_ENV: 'preview', JENIOS_QA_CANDIDATE_ENABLED: 'true',
  JENIOS_ROBOT_QA_ENABLED: 'true', JENIOS_REAL_EXECUTION_ENABLED: 'false',
  JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false', JENIOS_PRIVATE_PAPER_EXECUTOR: 'false',
  JENIOS_ROBOT_R64_ENABLED: 'true', JENIOS_ROBOT_R64_SCHEDULER_TOKEN: TOKEN });
const request = (method = 'GET', { body, token, type = 'application/json', url = 'https://qa.invalid/r64', headers = {} } = {}) =>
  new Request(url, { method, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    headers: { ...(body === undefined ? {} : { 'Content-Type': type }), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers } });
const database = ({ admin = true, invalid = false } = {}) => ({
  auth: { async getUser(token) {
    assert.equal(typeof token, 'string');
    return invalid ? { data: { user: null }, error: { message: 'private auth detail' } } :
      { data: { user: { id: '11111111-1111-4111-8111-111111111164',
        app_metadata: { platform_role: admin ? 'admin' : 'user' } } }, error: null };
  } },
  from(table) { assert.equal(table, 'jenios_platform_admin_permissions');
    return { select() { return { async eq() { return { data: [{ permission: 'platform.reports' }], error: null }; } }; } }; },
});
const cycleId = '00000000-0000-4000-8000-000000000064';
const report = (await runR64OperationalCycle({ scopeId: SCOPE, nowMs: NOW, env: environment(), store: {
  async readCycle() { return null; }, async readReceipts() { return fixture.receipts; },
  async claimCycle(args) { return { status: 'CLAIMED', cycleId,
    leaseOwner: '00000000-0000-4000-8000-000000000001', leaseGeneration: 1, input: args.input }; },
  async readAnalystPolicy() { return {}; },
  async completeCycle(args) { return { status: 'COMPLETED', cycleId, report: args.report }; },
} })).report;
const row = (value = report, patch = {}) => ({ cycleId, scopeId: SCOPE, periodKey: fixture.study.periodKey,
  status: 'COMPLETED', report: value, ...patch });
const feed = () => ({ schema: 'JENIOS_R64_ADMIN_FEED_V1', adminOnly: true, evidenceKind: 'SIGNED_QA_REPLAY',
  scopeId: SCOPE, reports: [clone(report)], pendingCycles: 0, updatedAt: new Date(NOW).toISOString(),
  productionIntegrationVerified: false, operationalDataDisclosureRequired: true });

test('R64 HTTP gates return 404 before any source, database, scheduler or identity dependency', async () => {
  let touched = 0; const forbidden = () => { touched++; throw new Error('must not access'); };
  const handlers = [
    createR64IntakeHandler({ env: {}, getStore: forbidden, getTrustedSource: forbidden }),
    createR64SchedulerHandler({ env: {}, runCycle: forbidden }),
    createR64AdminHandler({ env: {}, getStore: forbidden, getDb: forbidden, getScopeId: forbidden }),
  ];
  for (const handler of handlers) assert.equal((await handler(request('POST'))).status, 404);
  assert.equal(touched, 0);
});

test('R64 admin requires bearer identity before DB construction and Platform admin permission before report access', async () => {
  let dbReads = 0, storeReads = 0;
  const missing = createR64AdminHandler({ env: environment(), getDb: () => { dbReads++; return database(); },
    getStore: () => { storeReads++; return {}; }, getScopeId: () => SCOPE });
  assert.equal((await missing(request())).status, 401);
  assert.equal(dbReads, 0); assert.equal(storeReads, 0);
  for (const [options, expected] of [[{ invalid: true }, 401], [{ admin: false }, 403]]) {
    const handler = createR64AdminHandler({ env: environment(), getDb: () => database(options),
      getStore: () => { storeReads++; return {}; }, getScopeId: () => SCOPE });
    assert.equal((await handler(request('GET', { token: 'fixture-session' }))).status, expected);
  }
  assert.equal(storeReads, 0);
});

test('R64 signed intake verifies its source before storing only the minimized receipt', async () => {
  const saved = [];
  const handler = createR64IntakeHandler({ env: environment(), now: () => NOW,
    getTrustedSource: () => fixture.trustedSource,
    getStore: () => ({ async ingestReceipt({ receipt }) { saved.push(receipt);
      return { status: saved.length > 1 ? 'ALREADY_STORED' : 'STORED', scopeId: receipt.scopeId, eventId: receipt.eventId }; } }) });
  const first = await handler(request('POST', { body: fixture.envelopes[0] }));
  assert.equal(first.status, 202); assert.equal(first.headers.get('cache-control'), 'no-store');
  const data = await first.json(); assert.equal(data.customerMonitoringActive, false);
  assert.equal(data.automaticPromotionAllowed, false); assert.equal(data.scopeId, SCOPE);
  assert.equal(saved[0].schema, 'JENIOS_R64_TELEMETRY_ADMISSION_V1');
  assert.equal(Object.hasOwn(saved[0], 'signatureBase64'), false);
  assert.equal(Object.hasOwn(saved[0], 'publicKeyPem'), false);
  assert.equal((await handler(request('POST', { body: fixture.envelopes[0] }))).status, 200);
});

test('R64 intake rejects body-controlled scope, tampered signatures and extra private fields before storage', async () => {
  let stored = 0;
  const handler = createR64IntakeHandler({ env: environment(), now: () => NOW,
    getTrustedSource: () => fixture.trustedSource,
    getStore: () => { stored++; return {}; } });
  const wrongScope = clone(fixture.envelopes[0].payload); wrongScope.scopeId = 'scope:ffffffffffffffff';
  const wrongSignature = clone(fixture.envelopes[0]); wrongSignature.payload.event.marketAgeMs++;
  const secret = clone(fixture.envelopes[0]); secret.payload.event.email = 'private-customer@invalid.example';
  for (const body of [signR64QaPayload(wrongScope, fixture.privateKey), wrongSignature, secret]) {
    const response = await handler(request('POST', { body })); assert.equal(response.status, 400);
    assert.equal(JSON.stringify(await response.json()).includes('private-customer'), false);
  }
  assert.equal(stored, 0);
});

test('R64 intake enforces method, JSON content type and body size without constructing a store', async () => {
  let stored = 0;
  const handler = createR64IntakeHandler({ env: environment(), now: () => NOW,
    getTrustedSource: () => fixture.trustedSource, getStore: () => { stored++; return {}; } });
  assert.equal((await handler(request('GET'))).status, 405);
  assert.equal((await handler(request('POST', { body: '{}', type: 'text/plain' }))).status, 415);
  assert.equal((await handler(request('POST', { body: '{broken' }))).status, 400);
  assert.equal((await handler(request('POST', { body: ' '.repeat(16385) }))).status, 400);
  assert.equal(stored, 0);
});

test('R64 intake exposes a conflict status while sanitizing persistence faults', async () => {
  for (const [code, status] of [['R64_EVENT_CONFLICT', 409], ['R64_DATABASE_UNAVAILABLE', 503]]) {
    const handler = createR64IntakeHandler({ env: environment(), now: () => NOW,
      getTrustedSource: () => fixture.trustedSource, getStore: () => ({ async ingestReceipt() {
        throw Object.assign(new Error('private connection URL and key'), { code });
      } }) });
    const response = await handler(request('POST', { body: fixture.envelopes[0] }));
    assert.equal(response.status, status); assert.equal((await response.text()).includes('private connection'), false);
  }
});

test('R64 scheduler accepts only its configured credential and an empty request with no caller-selected scope', async () => {
  let runs = 0;
  const handler = createR64SchedulerHandler({ env: environment(), runCycle: async () => {
    runs++; return { status: 'STORED_OPERATIONAL_QA_REPORT', periodKey: fixture.study.periodKey }; } });
  assert.equal((await handler(request('GET', { token: TOKEN }))).status, 405);
  assert.equal((await handler(request('POST'))).status, 401);
  assert.equal((await handler(request('POST', { token: 'wrong' }))).status, 401);
  assert.equal((await handler(request('POST', { token: TOKEN, body: { scopeId: 'scope:ffffffffffffffff', paid: true } }))).status, 400);
  assert.equal(runs, 0);
  const response = await handler(request('POST', { token: TOKEN }));
  assert.equal(response.status, 200); assert.equal(runs, 1);
  const result = await response.json(); assert.equal(result.productionSchedulerStarted, false);
  assert.equal(result.realOrdersSent, 0); assert.equal(result.externalPaperOrdersSent, 0);
});

test('R64 scheduler rejects a streaming body without consuming an unbounded request', async () => {
  let pulls = 0, cancelled = false, runs = 0;
  const body = new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array(65536)); if (pulls >= 10) controller.close(); },
    cancel() { cancelled = true; },
  });
  const handler = createR64SchedulerHandler({ env: environment(), runCycle: async () => { runs++; } });
  const raw = new Request('https://qa.invalid/r64', { method: 'POST', body, duplex: 'half',
    headers: { Authorization: 'Bearer ' + TOKEN } });
  const result = await handler(raw);
  assert.equal(result.status, 400); assert.equal(runs, 0); assert.equal(cancelled, true); assert(pulls < 10);
});

test('R64 admin reads only its server-selected scope and returns safe reports plus pending health', async () => {
  let queried;
  const handler = createR64AdminHandler({ env: environment(), now: () => NOW, getDb: () => database(),
    getScopeId: () => SCOPE, getStore: () => ({ async readReports(args) { queried = args;
      return [row(report, { privateSourceKey: 'must-never-leave-server' }),
        row(null, { cycleId: '00000000-0000-4000-8000-000000000065', status: 'NEEDS_RECONCILIATION' })]; } }) });
  const response = await handler(request('GET', { token: 'fixture-session', url: 'https://qa.invalid/r64?scopeId=scope:ffffffffffffffff' }));
  assert.equal(response.status, 200); assert.deepEqual(queried, { scopeId: SCOPE, limit: 30 });
  const data = await response.json(); assert.equal(data.scopeId, SCOPE);
  assert.equal(data.reports.length, 1); assert.equal(data.pendingCycles, 1);
  assert.equal(JSON.stringify(data).includes('must-never-leave-server'), false);
  assert.equal(data.productionIntegrationVerified, false);
  assert.equal(requireR64AdminFeed(data), data);
});

test('R64 admin refuses reports with private extras, scope mismatch or unsupported success claims', async () => {
  for (const patch of [{ privateKey: 'never-return-this' }, { rawInput: { customerId: 'private' } },
    { scopeId: 'scope:ffffffffffffffff' }, { productionMonitoringStarted: true }, { actualBrokerPnl: 10 }]) {
    const invalid = { ...clone(report), ...patch };
    const handler = createR64AdminHandler({ env: environment(), now: () => NOW, getDb: () => database(),
      getScopeId: () => SCOPE, getStore: () => ({ async readReports() { return [row(invalid)]; } }) });
    const response = await handler(request('GET', { token: 'fixture-session' }));
    assert.equal(response.status, 503); assert.equal((await response.text()).includes('never-return-this'), false);
  }
});

test('R64 admin feed validation rejects mixed scope, changed boundaries, private extras and accessors', () => {
  assert.equal(isR64OperationalReport(report), true);
  for (const mutate of [x => { x.productionIntegrationVerified = true; },
    x => { x.operationalDataDisclosureRequired = false; }, x => { x.scopeId = 'scope:ffffffffffffffff'; },
    x => { x.reports[0].providerAudit.rawResponse = 'private'; }, x => { x.reports[0].observations.email = 'private'; },
    x => { x.privateKey = 'private'; }]) {
    const invalid = feed(); mutate(invalid); assert.throws(() => requireR64AdminFeed(invalid), /R64_INVALID_ADMIN_FEED/);
  }
  let getters = 0; const bad = feed();
  Object.defineProperty(bad, 'reports', { enumerable: true, get() { getters++; return []; } });
  assert.throws(() => requireR64AdminFeed(bad), /R64_INVALID_ADMIN_FEED/);
  assert.equal(getters, 0);
});

test('R64 admin persistence failure returns an unavailable response without fabricated reports or internal errors', async () => {
  const handler = createR64AdminHandler({ env: environment(), getDb: () => database(), getScopeId: () => SCOPE,
    getStore: () => ({ async readReports() { throw new Error('private database password'); } }) });
  const response = await handler(request('GET', { token: 'fixture-session' }));
  assert.equal(response.status, 503); const body = await response.json();
  assert.equal(Object.hasOwn(body, 'reports'), false); assert.equal(JSON.stringify(body).includes('password'), false);
});
