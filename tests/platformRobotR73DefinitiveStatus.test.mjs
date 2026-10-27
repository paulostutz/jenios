import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  R73_PROJECT_ID, R73_DATABASE_ID, R73_BRANCH, R73_TABLES,
  isR73AdministrationEnabled, createR73AdminStatusHandler, createR73DeploymentProbeHandler,
} from '../lib/platform/research/robot-r73-definitive-status.mjs';
import { isRobotR61QaEnabled } from '../lib/platform/research/robot-r61-qa-access.mjs';
import { isRobotR71QaEnabled } from '../lib/platform/research/robot-r71-access.mjs';

// Entirely local SDK double: no credentials, HTTP requests, SQL mutations or source execution.
const instant = 1792886400000;
const token = 'a'.repeat(64);
const admin = { id: '8d30c540-449d-4d91-8502-2aec4bdfe6c1', app_metadata: { platform_role: 'admin' } };
const member = { id: 'fa6a7d42-8181-47f2-9c99-85055e592fbf', app_metadata: {} };
const configuration = { generation_enabled: false, pricing_approved: false };
function environment(patch = {}) {
  return {
    VERCEL_ENV: 'production', VERCEL_PROJECT_ID: R73_PROJECT_ID, VERCEL_GIT_COMMIT_REF: R73_BRANCH,
    VERCEL_GIT_COMMIT_SHA: '1'.repeat(40), JENIOS_ROBOT_R73_ADMIN_ENABLED: 'true',
    PLATFORM_SUPABASE_URL: `https://${R73_DATABASE_ID}.supabase.co`,
    NEXT_PUBLIC_PLATFORM_SUPABASE_URL: `https://${R73_DATABASE_ID}.supabase.co`,
    JENIOS_REAL_EXECUTION_ENABLED: 'false', JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: 'false',
    JENIOS_PRIVATE_PAPER_EXECUTOR: 'false', JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'false',
    JENIOS_ROBOT_R73_VERIFY_TOKEN: token, JENIOS_ROBOT_R73_VERIFY_ISSUED_AT: String(instant),
    ...patch,
  };
}
function sdk(options = {}) {
  const events = [], counts = options.counts || {};
  const db = {
    auth: { async getUser(received) {
      events.push({ operation: 'auth', token: received });
      options.onAuth?.();
      return { data: { user: options.user === undefined ? admin : options.user }, error: options.authError || null };
    } },
    from(table) {
      assert.ok(table === 'jenios_platform_admin_permissions' || R73_TABLES.some(item => item.name === table),
        'The administrative status must not query another product or an arbitrary table.');
      let columns, selectOptions, filter, single = false, signal;
      const query = {
        select(selected, opts) { columns = selected; selectOptions = opts; return query; },
        eq(key, value) { filter = { key, value }; return query; },
        maybeSingle() { single = true; return query; },
        abortSignal(value) { assert.ok(value instanceof AbortSignal); signal = value; return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            events.push({ operation: 'select', table, columns, options: selectOptions, filter, single, signal: Boolean(signal) });
            options.onRead?.(table);
            if (table === 'jenios_platform_admin_permissions') {
              assert.equal(columns, 'permission');
              assert.deepEqual(filter, { key: 'user_id', value: options.user?.id });
              return { data: (options.permissions || []).map(permission => ({ permission })), error: options.permissionError || null };
            }
            if (selectOptions?.head) {
              assert.deepEqual(selectOptions, { count: 'exact', head: true });
              assert.equal(columns, '*');
              assert.equal(single, false);
              assert.equal(Boolean(signal), true);
              if (options.failAllCounts || table === options.failTable) return { count: null, error: { message: 'private diagnostic must not escape' } };
              if (table === options.throwTable) throw Error('private connection detail');
              return { count: Object.hasOwn(counts, table) ? counts[table] : table === 'jenios_robot_config_r64' ? 1 : 0, error: null };
            }
            assert.equal(table, 'jenios_robot_config_r64');
            assert.equal(columns, 'generation_enabled,pricing_approved');
            assert.deepEqual(filter, { key: 'singleton', value: true });
            assert.equal(single, true);
            return { data: options.config === undefined ? configuration : options.config, error: options.configError || null };
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { db, events };
}
const request = (auth = 'fixture-platform-session', suffix = '', method = 'GET') => new Request(
  'https://jenios.example/api/platform/admin/robots/status' + suffix,
  { method, headers: auth === null ? {} : { authorization: 'Bearer ' + auth } });
const tableReads = events => events.filter(event => event.operation === 'select' && event.table !== 'jenios_platform_admin_permissions');

test('R73 refuses disabled, wrong-project, wrong-branch and wrong-database administration before client creation', async () => {
  for (const patch of [{ VERCEL_ENV: 'preview' }, { VERCEL_PROJECT_ID: 'prj_other' },
    { VERCEL_GIT_COMMIT_REF: 'main' }, { JENIOS_ROBOT_R73_ADMIN_ENABLED: 'false' },
    { PLATFORM_SUPABASE_URL: 'https://other.supabase.co' }, { NEXT_PUBLIC_PLATFORM_SUPABASE_URL: undefined },
    { JENIOS_REAL_EXECUTION_ENABLED: 'true' }, { JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED: undefined },
    { JENIOS_PRIVATE_PAPER_EXECUTOR: 'true' }, { JENIOS_ROBOT_ANALYST_PAID_ENABLED: 'true' }]) {
    const env = environment(patch);
    assert.equal(isR73AdministrationEnabled(env), false);
    const handler = createR73AdminStatusHandler({ env, getDb() { assert.fail('Disabled request created a database client'); } });
    assert.equal((await handler(request())).status, 404);
  }
});

test('R73 publication does not open the certified R61 or R71 QA gates in production', () => {
  const env = environment({ JENIOS_QA_CANDIDATE_ENABLED: 'true', JENIOS_ROBOT_QA_ENABLED: 'true',
    JENIOS_ROBOT_R67_ENABLED: 'true', JENIOS_ROBOT_R71_ENABLED: 'true' });
  assert.equal(isR73AdministrationEnabled(env), true);
  assert.equal(isRobotR61QaEnabled(env), false);
  assert.equal(isRobotR71QaEnabled(env), false);
});

test('R73 rejects missing authentication, non-GET methods and query parameters before client creation', async () => {
  const handler = createR73AdminStatusHandler({ env: environment(), getDb() { assert.fail('Rejected input touched the database'); } });
  assert.equal((await handler(request(null))).status, 401);
  assert.equal((await handler(request('fixture', '', 'POST'))).status, 405);
  assert.equal((await handler(request('fixture', '?scope=another'))).status, 400);
});

test('R73 uses the real dedicated Auth verifier and denies invalid or anonymous sessions before table reads', async () => {
  for (const options of [{ user: null }, { user: { ...admin, is_anonymous: true } },
    { authError: { message: 'expired or foreign-project token' } }]) {
    const { db, events } = sdk(options);
    const handler = createR73AdminStatusHandler({ env: environment(), getDb: () => db });
    assert.equal((await handler(request('rejected-fixture-token'))).status, 401);
    assert.deepEqual(events, [{ operation: 'auth', token: 'rejected-fixture-token' }]);
  }
});

test('R73 denies members, reports-only grants and editable user_metadata without reading robot tables', async () => {
  for (const options of [{ user: member }, { user: member, permissions: ['platform.reports'] },
    { user: member, permissions: ['platform.admin'] },
    { user: { ...member, user_metadata: { platform_role: 'admin' } } }]) {
    const { db, events } = sdk(options);
    const handler = createR73AdminStatusHandler({ env: environment(), getDb: () => db });
    assert.equal((await handler(request())).status, 403);
    assert.equal(events[0].operation, 'auth');
    assert.equal(tableReads(events).length, 0);
  }
});

test('R73 permission lookup failure is unavailable, not a role denial or an administrative grant', async () => {
  const { db, events } = sdk({ user: member, permissionError: { message: 'private lookup detail' } });
  const response = await createR73AdminStatusHandler({ env: environment(), getDb: () => db })(request());
  assert.equal(response.status, 503);
  assert.equal(tableReads(events).length, 0);
  assert.doesNotMatch(await response.text(), /private lookup detail/);
});

test('R73 accepts server-controlled admin metadata and returns only real count results after authentication', async () => {
  const counts = { jenios_robot_events_r64: 8, jenios_robot_cycles_r64: 2, jenios_robot_private_captures_r67: 5,
    jenios_robot_private_observations_r71: 4, jenios_robot_private_evolution_r71: 3 };
  const { db, events } = sdk({ counts, config: { ...configuration, unselectedSecret: 'do-not-return' } });
  const result = await createR73AdminStatusHandler({ env: environment(), getDb: () => db, now: () => instant })(request());
  assert.equal(result.status, 200);
  assert.match(result.headers.get('cache-control'), /private, no-store/);
  assert.equal(result.headers.get('vary'), 'Authorization');
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
  const body = await result.json();
  assert.equal(events[0].operation, 'auth');
  assert.equal(events.filter(event => event.operation === 'select' && event.options?.head).length, 16);
  assert.equal(new Set(events.filter(event => event.options?.head).map(event => event.table)).size, 16);
  assert.equal(body.database.status, 'READY');
  assert.equal(body.database.availableTables, 16);
  assert.deepEqual(body.activity, { qaReceipts: 8, qaCycles: 2, privateCaptures: 5, privateObservations: 4, privateRevisions: 3 });
  assert.deepEqual(body.source, { configuration: 'NOT_CONFIGURED', connection: 'NOT_VERIFIED' });
  assert.deepEqual(body.worker, { status: 'WAITING_FOR_SOURCE', scheduled: false });
  assert.equal(body.boundaries.customerMonitoringActive, false);
  for (const key of ['actualBrokerPnl', 'actualLossesAvoided', 'realTradeAccuracy']) assert.equal(body.boundaries[key], null);
  assert.doesNotMatch(JSON.stringify(body), /do-not-return|fixture-platform-session|signed_record|user_metadata/);
});

test('R73 preserves unavailable or malformed counts as null instead of fabricating zero activity', async () => {
  for (const options of [{ failTable: 'jenios_robot_events_r64' }, { throwTable: 'jenios_robot_events_r64' },
    { counts: { jenios_robot_events_r64: '0' } }, { counts: { jenios_robot_events_r64: -1 } }]) {
    const { db } = sdk(options);
    const result = await createR73AdminStatusHandler({ env: environment(), getDb: () => db })(request());
    const body = await result.json();
    assert.equal(result.status, 200);
    assert.equal(body.database.status, 'INCOMPLETE');
    assert.equal(body.activity.qaReceipts, null);
    assert.deepEqual(body.database.tables.find(table => table.name === 'jenios_robot_events_r64'), {
      name: 'jenios_robot_events_r64', label: 'Observações assinadas de QA', available: false, rowCount: null,
    });
    assert.doesNotMatch(JSON.stringify(body), /private diagnostic|private connection/);
  }
  const { db } = sdk({ failAllCounts: true });
  const body = await (await createR73AdminStatusHandler({ env: environment(), getDb: () => db })(request())).json();
  assert.equal(body.database.status, 'UNAVAILABLE');
  assert.equal(body.database.availableTables, 0);
  assert.ok(Object.values(body.activity).every(value => value === null));
});

test('R73 cannot declare the database ready when generation, pricing or their configuration read is unresolved', async () => {
  for (const options of [{ config: { generation_enabled: true, pricing_approved: false } },
    { config: { generation_enabled: false, pricing_approved: true } }, { config: null },
    { configError: { message: 'configuration unavailable' } }]) {
    const { db } = sdk(options);
    const body = await (await createR73AdminStatusHandler({ env: environment(), getDb: () => db })(request())).json();
    assert.equal(body.database.availableTables, 16);
    assert.equal(body.database.status, 'INCOMPLETE');
    if (options.config === null || options.configError) {
      assert.equal(body.database.generationEnabled, null);
      assert.equal(body.database.pricingApproved, null);
    }
  }
});

test('R73 source configuration does not assert a connected private host or active monitoring', async () => {
  const { publicKey } = generateKeyPairSync('ed25519');
  const env = environment({ JENIOS_ROBOT_R67_SCOPE_ID: 'scope:1111111111111111',
    JENIOS_ROBOT_R67_SOURCE_ID: 'source:2222222222222222',
    JENIOS_ROBOT_R67_SOURCE_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }) });
  const { db } = sdk();
  const body = await (await createR73AdminStatusHandler({ env, getDb: () => db })(request())).json();
  assert.deepEqual(body.source, { configuration: 'CONFIGURED', connection: 'NOT_VERIFIED' });
  assert.equal(body.worker.scheduled, false);
  assert.equal(body.boundaries.customerMonitoringActive, false);
});

test('R73 rechecks its access gate after Auth and before returning any table data', async () => {
  for (const phase of ['auth', 'read']) {
    const env = environment();
    const change = () => { env.JENIOS_ROBOT_R73_ADMIN_ENABLED = 'false'; };
    const { db, events } = sdk(phase === 'auth' ? { onAuth: change } : { onRead: change });
    const result = await createR73AdminStatusHandler({ env, getDb: () => db })(request());
    assert.equal(result.status, 404);
    assert.equal(Object.hasOwn(await result.json(), 'database'), false);
    if (phase === 'auth') assert.equal(tableReads(events).length, 0);
  }
});

test('R73 probe denies absent, wrong, future or expired credentials before creating a database client', async () => {
  for (const [auth, patch, now] of [[null, {}, instant], ['b'.repeat(64), {}, instant],
    [token, {}, instant - 1], [token, {}, instant + 3600000], [token, { JENIOS_ROBOT_R73_VERIFY_ISSUED_AT: 'invalid' }, instant],
    [token, { JENIOS_ROBOT_R73_VERIFY_TOKEN: undefined }, instant]]) {
    const handler = createR73DeploymentProbeHandler({ env: environment(patch), now: () => now,
      getDb() { assert.fail('Unauthorized probe touched the database'); } });
    assert.equal((await handler(request(auth))).status, 401);
  }
});

test('R73 valid deployment probe has a reduced verification response and cannot establish administrator identity', async () => {
  const { db, events } = sdk();
  const response = await createR73DeploymentProbeHandler({ env: environment(), getDb: () => db,
    now: () => instant + 1 })(request(token));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schema, 'JENIOS_R73_DEPLOYMENT_PROBE_V1');
  assert.equal(body.verificationOnly, true);
  assert.equal(body.hostedAdministratorLoginVerified, false);
  assert.equal(body.database.availableTables, 16);
  assert.equal(Object.hasOwn(body.database, 'tables'), false);
  assert.equal(Object.hasOwn(body, 'activity'), false);
  assert.equal(events.some(event => event.operation === 'auth'), false);
  const memberSdk = sdk({ user: null });
  const adminResponse = await createR73AdminStatusHandler({ env: environment(), getDb: () => memberSdk.db })(request(token));
  assert.equal(adminResponse.status, 401);
  assert.equal(tableReads(memberSdk.events).length, 0);
});

test('R73 probe refuses incomplete database verification and credentials expiring during the read', async () => {
  const failed = sdk({ failTable: 'jenios_robot_private_captures_r67' });
  const response = await createR73DeploymentProbeHandler({ env: environment(), getDb: () => failed.db,
    now: () => instant + 1 })(request(token));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).database.status, 'INCOMPLETE');
  let call = 0;
  const { db } = sdk();
  const expiry = await createR73DeploymentProbeHandler({ env: environment(), getDb: () => db,
    now: () => [instant, instant + 3599999, instant + 3600000][call++] })(request(token));
  assert.equal(expiry.status, 401);
  assert.equal(Object.hasOwn(await expiry.json(), 'database'), false);
});

test('R73 route entry points expose only dynamic server GET handlers', async () => {
  for (const path of ['app/api/platform/admin/robots/status/route.js', 'app/api/platform/internal/robots/deployment-status/route.js']) {
    const contents = await readFile(new URL('../' + path, import.meta.url), 'utf8');
    assert.match(contents, /export const runtime = 'nodejs'/);
    assert.match(contents, /export const dynamic = 'force-dynamic'/);
    assert.match(contents, /export const GET = createR73/);
    assert.doesNotMatch(contents, /export const (?:POST|PUT|PATCH|DELETE)/);
  }
});
